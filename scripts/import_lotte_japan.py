"""Import Lotte Japan's ice cream ("アイス") catalogue into local Food JSON.

Lotte Japan's product catalogue (www.lotte.co.jp/products/catalogue/ice/) is
plain server-rendered HTML: a category index links to brand folders
(.../ice/<brand-id>/), each of which links to individual product detail
pages (detail<NN>.html) containing an official per-serving nutrition
declaration (栄養成分表示). This script crawls that structure and converts
each product into the app's Food[] shape.

Unlike McDonald's Japan, Lotte does not publish official English or Chinese
product names, so only the Japanese name is recorded — never invented.

Writes two files:
  --raw-output   the raw scraped fields per product, for audit
  --output       records converted to the app's Food[] shape, ready to
                 ship as a bundled/built-in dataset
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import date
from pathlib import Path
from urllib.request import Request, urlopen

BASE = "https://www.lotte.co.jp"
CATEGORY_URL = f"{BASE}/products/catalogue/ice/"
USER_AGENT = "diet-seed-importer/1.0 (local development)"

BRAND_LINK_RE = re.compile(r'href="(/products/catalogue/ice/(\d+)/)"')
DETAIL_LINK_RE = re.compile(r'href="(/products/catalogue/ice/(\d+)/(detail(\d+)\.html))"')
NAME_RE = re.compile(r'class="prdNam rt_cf_p_name">([^<]+)</h4>')
BRAND_RE = re.compile(r'class="blandNam rt_cf_p_brand_name">([^<]+)</h3>')
AMOUNT_RE = re.compile(r'rt_cf_p_amount[^>]*>(.*?)</dd>', re.S)
NUTRITION_RE = re.compile(r'rt_cf_p_nutrition[^>]*>(.*?)</dd>', re.S)


def fetch(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8")


def number(pattern: re.Pattern[str], text: str) -> float | None:
    match = pattern.search(text)
    if not match:
        return None
    value = float(match.group(1))
    return int(value) if value.is_integer() else value


CALORIES_RE = re.compile(r"エネルギー([\d.]+)\s*kcal")
PROTEIN_RE = re.compile(r"たんぱく質([\d.]+)\s*g")
FAT_RE = re.compile(r"脂質([\d.]+)\s*g")
CARBS_RE = re.compile(r"炭水化物([\d.]+)\s*g")
SALT_RE = re.compile(r"食塩相当量([\d.]+)\s*g")
FIBER_RE = re.compile(r"食物繊維([\d.]+)\s*g")
SUGAR_RE = re.compile(r"(?<!糖質)糖類([\d.]+)\s*g")


# Multi-piece packages (e.g. "53ml×7本", "80ml×2種×3個") declare the official
# nutrition per single piece, not per package; the serving shown should match
# that single-piece amount, so the "×N本/個/種" multiplier is dropped.
SERVING_MULTIPLIER_RE = re.compile(r"([\d.]+\s?(?:ml|kg|g|L))\s*[x×]", re.I)


def simplify_serving(amount: str) -> str:
    match = SERVING_MULTIPLIER_RE.search(amount)
    return match.group(1).replace(" ", "") if match else amount


def parse_nutrition(text: str) -> dict | None:
    calories = number(CALORIES_RE, text)
    protein = number(PROTEIN_RE, text)
    fat = number(FAT_RE, text)
    carbohydrates = number(CARBS_RE, text)
    if None in (calories, protein, fat, carbohydrates):
        return None
    nutrition = {
        "calories": calories,
        "protein": protein,
        "fat": fat,
        "carbohydrates": carbohydrates,
    }
    detail = {}
    salt = number(SALT_RE, text)
    fiber = number(FIBER_RE, text)
    sugar = number(SUGAR_RE, text)
    if salt is not None:
        detail["salt"] = salt
    if fiber is not None:
        detail["fiber"] = fiber
    if sugar is not None:
        detail["sugar"] = sugar
    return {"nutrition": nutrition, "detail": detail}


def list_brand_ids(delay: float) -> list[str]:
    html = fetch(CATEGORY_URL)
    time.sleep(delay)
    ids = sorted({m.group(2) for m in BRAND_LINK_RE.finditer(html)}, key=int)
    return ids


def list_detail_paths(brand_id: str, delay: float) -> list[str]:
    html = fetch(f"{BASE}/products/catalogue/ice/{brand_id}/")
    time.sleep(delay)
    paths = sorted(
        {m.group(1) for m in DETAIL_LINK_RE.finditer(html) if m.group(2) == brand_id}
    )
    return paths


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output", type=Path, default=Path("lotte_japan.json"),
        help="App-format Food[] JSON (built-in/bundled dataset)",
    )
    parser.add_argument(
        "--raw-output", type=Path, default=Path("lotte_japan.raw.json"),
        help="Raw scraped fields per product, for audit",
    )
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between requests")
    parser.add_argument(
        "--limit", type=int, help="Only process the first N products (for smoke tests)"
    )
    args = parser.parse_args()

    retrieved_at = date.today().isoformat()
    brand_ids = list_brand_ids(args.delay)

    detail_paths: list[str] = []
    for brand_id in brand_ids:
        detail_paths.extend(list_detail_paths(brand_id, args.delay))
    if args.limit is not None:
        detail_paths = detail_paths[: args.limit]

    raw_products = []
    foods = []
    path_re = re.compile(r"/products/catalogue/ice/(\d+)/detail(\d+)\.html")
    for path in detail_paths:
        m = path_re.fullmatch(path)
        if not m:
            print(f"Skipping unrecognized path: {path}", file=sys.stderr)
            continue
        brand_id, product_num = m.group(1), m.group(2)
        url = BASE + path
        try:
            html = fetch(url)
        except Exception as error:  # noqa: BLE001
            print(f"Skipping {url}: {error}", file=sys.stderr)
            continue
        finally:
            time.sleep(args.delay)

        name_match = NAME_RE.search(html)
        brand_match = BRAND_RE.search(html)
        amount_match = AMOUNT_RE.search(html)
        nutrition_match = NUTRITION_RE.search(html)
        if not (name_match and nutrition_match):
            print(f"Skipping {url}: missing name or nutrition table", file=sys.stderr)
            continue

        parsed = parse_nutrition(nutrition_match.group(1))
        if parsed is None:
            print(f"Skipping {url}: could not parse nutrition values", file=sys.stderr)
            continue

        name_ja = name_match.group(1).strip()
        brand_ja = brand_match.group(1).strip() if brand_match else None
        amount = (
            re.sub(r"\s+", " ", re.sub(r"<br\s*/?>", "; ", amount_match.group(1))).strip()
            if amount_match
            else "1 serving"
        )

        raw_products.append(
            {
                "url": url,
                "brandId": brand_id,
                "productNum": product_num,
                "nameJa": name_ja,
                "brandJa": brand_ja,
                "amount": amount,
                "nutritionRaw": nutrition_match.group(1),
            }
        )
        food = {
            "id": f"lotte-jp-ice-{brand_id}-{product_num}",
            "name": {"ja": name_ja},
            "serving": simplify_serving(amount),
            "nutrition": parsed["nutrition"],
            "source": "bundled",
            "description": "Lotte Japan",
        }
        if parsed["detail"]:
            food["detail"] = parsed["detail"]
        foods.append(food)

    if not foods:
        raise SystemExit("No products found; the official page layout may have changed")

    raw = {
        "retrievedAt": retrieved_at,
        "sources": {"category": CATEGORY_URL},
        "products": raw_products,
    }
    args.raw_output.write_text(
        json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    args.output.write_text(
        json.dumps(foods, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Wrote {len(foods)} raw products to {args.raw_output}", file=sys.stderr)
    print(f"Wrote {len(foods)} foods to {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
