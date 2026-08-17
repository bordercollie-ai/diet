"""Import a deliberately small set of Japanese convenience-store chicken foods.

The importer fetches an explicit, small set of official public counter-food
pages from 7-Eleven Japan, Lawson, and FamilyMart. It does not enumerate
catalogs, crawl, or make runtime app requests. Review the generated raw audit
file before shipping a refreshed dataset.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
from datetime import date
from pathlib import Path
from urllib.request import Request, urlopen

USER_AGENT = "diet-seed-importer/1.0 (local development)"

PRODUCTS = (
    {
        "id": "seven-jp-nana-chiki",
        "nameJa": "ななチキ",
        "description": "7-Eleven Japan",
        "url": "https://www.sej.co.jp/products/a/item/150398/",
        "parser": "seven",
    },
    {
        "id": "seven-jp-karaage-stick",
        "nameJa": "からあげ棒",
        "description": "7-Eleven Japan",
        "url": "https://www.sej.co.jp/products/a/item/150386/",
        "parser": "seven",
    },
    {
        "id": "seven-jp-charcoal-grilled-chicken-salt",
        "nameJa": "炭火焼き鳥（塩）",
        "description": "7-Eleven Japan",
        "url": "https://www.sej.co.jp/products/a/item/150403/",
        "parser": "seven",
    },
    {
        "id": "seven-jp-spice-chicken",
        "nameJa": "スパイスチキン",
        "description": "7-Eleven Japan",
        "url": "https://www.sej.co.jp/products/a/item/150071/",
        "parser": "seven",
    },
    {
        "id": "lawson-jp-karaage-kun-regular",
        "nameJa": "からあげクン　レギュラー",
        "description": "Lawson",
        "url": "https://www.lawson.co.jp/recommend/original/detail/1390563_1996.html",
        "parser": "lawson",
    },
    {
        "id": "lawson-jp-l-chiki-red",
        "nameJa": "Ｌチキ　レッド",
        "description": "Lawson",
        "url": "https://www.lawson.co.jp/recommend/original/detail/1390579_1996.html",
        "parser": "lawson",
    },
    {
        "id": "lawson-jp-marumaru-dori",
        "nameJa": "まんまる鶏",
        "description": "Lawson",
        "url": "https://www.lawson.co.jp/recommend/original/detail/1508176_1996.html",
        "parser": "lawson",
    },
    {
        "id": "familymart-jp-famichiki",
        "nameJa": "ファミチキ",
        "description": "FamilyMart",
        "url": "https://www.family.co.jp/goods/friedfoods/0253116.html",
        "parser": "familymart",
    },
    {
        "id": "familymart-jp-famichiki-red",
        "nameJa": "ファミチキ（レッド）",
        "description": "FamilyMart",
        "url": "https://www.family.co.jp/goods/friedfoods/0250924.html",
        "parser": "familymart",
    },
    {
        "id": "familymart-jp-spicy-chicken",
        "nameJa": "スパイシーチキン",
        "description": "FamilyMart",
        "url": "https://www.family.co.jp/goods/friedfoods/0252102.html",
        "parser": "familymart",
    },
    {
        "id": "familymart-jp-crispy-chicken-plain",
        "nameJa": "クリスピーチキン（プレーン）",
        "description": "FamilyMart",
        "url": "https://www.family.co.jp/goods/friedfoods/0250610.html",
        "parser": "familymart",
    },
)


def fetch(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8")


def plain_text(value: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", value)).split())


def nutrition_from_match(pattern: str, value: str) -> dict[str, float]:
    match = re.search(pattern, plain_text(value), re.DOTALL)
    if match is None:
        raise ValueError("Official nutrition markup did not match the expected layout")
    return {
        "calories": float(match["calories"]),
        "protein": float(match["protein"]),
        "fat": float(match["fat"]),
        "carbohydrates": float(match["carbohydrates"]),
    }


def parse_nutrition(parser: str, page: str) -> dict[str, float]:
    if parser == "seven":
        return nutrition_from_match(
            r"熱量：(?P<calories>[\d.]+)kcal、たんぱく質：(?P<protein>[\d.]+)g、"
            r"脂質：(?P<fat>[\d.]+)g、炭水化物：(?P<carbohydrates>[\d.]+)g",
            page,
        )
    if parser == "lawson":
        return nutrition_from_match(
            r"熱量\s+(?P<calories>[\d.]+)kcal.*?たんぱく質\s+(?P<protein>[\d.]+)g"
            r".*?脂質\s+(?P<fat>[\d.]+)g.*?炭水化物\s+(?P<carbohydrates>[\d.]+)g",
            page,
        )
    if parser == "familymart":
        table = re.search(r"<table>.*?</table>", page, re.DOTALL)
        if table is None:
            raise ValueError("Official FamilyMart nutrition table was not found")
        return nutrition_from_match(
            r"熱量\s*（kcal）\s*たんぱく質\s*（g）\s*脂質\s*（g）\s*炭水化物\s*（g）"
            r".*?(?P<calories>[\d.]+)\s+(?P<protein>[\d.]+)\s+(?P<fat>[\d.]+)"
            r"\s+(?P<carbohydrates>[\d.]+)",
            table.group(),
        )
    raise ValueError(f"Unknown parser: {parser}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("convenience_store_japan.json"),
        help="App-format Food[] JSON (bundled dataset)",
    )
    parser.add_argument(
        "--raw-output",
        type=Path,
        default=Path("convenience_store_japan.raw.json"),
        help="Raw official product data and provenance, for review",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=2,
        help="Delay between official requests in seconds",
    )
    args = parser.parse_args()
    if args.delay < 1:
        parser.error("--delay must be at least 1 second")

    raw_products = []
    foods = []
    for index, product in enumerate(PRODUCTS):
        page = fetch(product["url"])
        nutrition = parse_nutrition(product["parser"], page)
        raw_products.append({**product, "nutrition": nutrition})
        foods.append(
            {
                "id": product["id"],
                "name": {"ja": product["nameJa"]},
                "description": product["description"],
                "serving": "1 serving",
                "nutrition": nutrition,
                "source": "bundled",
            }
        )
        if index < len(PRODUCTS) - 1:
            time.sleep(args.delay)

    retrieved_at = date.today().isoformat()
    args.raw_output.write_text(
        json.dumps(
            {"retrievedAt": retrieved_at, "products": raw_products},
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    args.output.write_text(
        json.dumps(foods, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Wrote {len(foods)} audited products to {args.raw_output}", file=sys.stderr)
    print(f"Wrote {len(foods)} foods to {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
