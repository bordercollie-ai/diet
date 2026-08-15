"""Import Meiji Japan's ice cream ("アイス") catalogue into local Food JSON.

Meiji Japan's ice-cream category page (www.meiji.co.jp/products/icecream/)
lists every product inline as plain server-rendered HTML, each linking to a
product detail page (a 13-digit JAN code, e.g. 4902705125308.html) with an
official per-serving nutrition table ("栄養成分表示"). This script crawls
that structure and converts each product into the app's Food[] shape.

Meiji does not publish official English or Chinese product names, so only
the Japanese name is recorded — never invented.

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

BASE = "https://www.meiji.co.jp"
CATEGORY_URL = f"{BASE}/products/icecream/"
USER_AGENT = "diet-seed-importer/1.0 (local development)"

PRODUCT_LINK_RE = re.compile(r'href="(/products/icecream/(\d+)\.html)"')
NAME_RE = re.compile(
    r'<h1 class="m-heading1[^"]*">(?:<span class="m-heading-sup">[^<]*</span>)?\s*([^<]+?)\s*</h1>'
)
OVERVIEW_BLOCK_RE = re.compile(r"商品概要\s*</h2>.*?<table[^>]*>(.*?)</table>", re.S)
NUTRITION_BLOCK_RE = re.compile(r"栄養成分表示[^<]*</h2>.*?<table[^>]*>(.*?)</table>", re.S)
ROW_RE = re.compile(r"<th[^>]*>\s*([^<]+?)\s*</th>\s*<td[^>]*>\s*([^<]+?)\s*</td>", re.S)

# Label -> (Nutrition/NutritionDetail key, unit suffix to strip)
NUTRITION_FIELDS = {
    "エネルギー": ("calories", "kcal"),
    "たんぱく質": ("protein", "g"),
    "脂質": ("fat", "g"),
    "炭水化物": ("carbohydrates", "g"),
}
DETAIL_FIELDS = {
    "食塩相当量": ("salt", "g"),
    "食物繊維": ("fiber", "g"),
    "糖類": ("sugar", "g"),
    "ナトリウム": ("sodium", "mg"),
    "カリウム": ("potassium", "mg"),
    "トランス脂肪酸": ("transFat", "g"),
    "飽和脂肪酸": ("saturatedFat", "g"),
    "カフェイン": ("caffeine", "mg"),
}


def fetch(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8")


def parse_number(raw: str, unit: str) -> float | None:
    match = re.search(r"-?[\d.]+", raw.replace(unit, ""))
    if not match:
        return None
    value = float(match.group())
    return int(value) if value.is_integer() else value


def list_product_paths(delay: float) -> list[str]:
    html = fetch(CATEGORY_URL)
    time.sleep(delay)
    seen: set[str] = set()
    paths: list[str] = []
    for match in PRODUCT_LINK_RE.finditer(html):
        path = match.group(1)
        if path not in seen:
            seen.add(path)
            paths.append(path)
    return paths


def parse_amount(html: str) -> str | None:
    block = OVERVIEW_BLOCK_RE.search(html)
    if not block:
        return None
    for label, value in ROW_RE.findall(block.group(1)):
        if label == "内容量":
            return value.strip()
    return None


def parse_nutrition(html: str) -> dict | None:
    block = NUTRITION_BLOCK_RE.search(html)
    if not block:
        return None
    nutrition: dict[str, float] = {}
    detail: dict[str, float] = {}
    for label, value in ROW_RE.findall(block.group(1)):
        if label in NUTRITION_FIELDS:
            key, unit = NUTRITION_FIELDS[label]
            parsed = parse_number(value, unit)
            if parsed is not None:
                nutrition[key] = parsed
        elif label in DETAIL_FIELDS:
            key, unit = DETAIL_FIELDS[label]
            parsed = parse_number(value, unit)
            if parsed is not None:
                detail[key] = parsed
    required = {"calories", "protein", "fat", "carbohydrates"}
    if not required.issubset(nutrition):
        return None
    return {"nutrition": nutrition, "detail": detail}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output", type=Path, default=Path("meiji_japan.json"),
        help="App-format Food[] JSON (built-in/bundled dataset)",
    )
    parser.add_argument(
        "--raw-output", type=Path, default=Path("meiji_japan.raw.json"),
        help="Raw scraped fields per product, for audit",
    )
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between requests")
    parser.add_argument(
        "--limit", type=int, help="Only process the first N products (for smoke tests)"
    )
    args = parser.parse_args()

    retrieved_at = date.today().isoformat()
    paths = list_product_paths(args.delay)
    if args.limit is not None:
        paths = paths[: args.limit]

    raw_products = []
    foods = []
    for path in paths:
        jan_match = re.fullmatch(r"/products/icecream/(\d+)\.html", path)
        jan = jan_match.group(1)
        url = BASE + path
        try:
            html = fetch(url)
        except Exception as error:  # noqa: BLE001
            print(f"Skipping {url}: {error}", file=sys.stderr)
            continue
        finally:
            time.sleep(args.delay)

        name_match = NAME_RE.search(html)
        if not name_match:
            print(f"Skipping {url}: missing product name", file=sys.stderr)
            continue
        parsed = parse_nutrition(html)
        if parsed is None:
            print(f"Skipping {url}: could not parse nutrition values", file=sys.stderr)
            continue
        amount = parse_amount(html) or "1 serving"
        name_ja = name_match.group(1).strip()

        raw_products.append(
            {
                "url": url,
                "jan": jan,
                "nameJa": name_ja,
                "amount": amount,
                "nutrition": parsed["nutrition"],
                "detail": parsed["detail"],
            }
        )
        food = {
            "id": f"meiji-jp-ice-{jan}",
            "name": {"ja": name_ja},
            "serving": amount,
            "nutrition": parsed["nutrition"],
            "source": "bundled",
            "description": "Meiji Japan",
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
