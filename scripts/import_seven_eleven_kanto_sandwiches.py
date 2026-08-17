"""Import unique Tokyo/Kanagawa sandwiches from 7-Eleven Japan's official page.

This development-time importer reads the explicit category URL requested for
this dataset, then requests each listed official product page at a low rate.
It retains products sold in Tokyo or Kanagawa and deduplicates regional SKUs
that describe the same product. Review the generated raw audit file before
shipping a refreshed dataset.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
import unicodedata
from datetime import date
from pathlib import Path
from urllib.request import Request, urlopen

USER_AGENT = "diet-seed-importer/1.0 (local development)"
CATALOG_URL = "https://www.sej.co.jp/products/a/sandwich/kanto/1/l100/"
TARGET_AREAS = {"東京都", "神奈川県"}
NATIONWIDE_AREA = "全国"


def fetch(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8")


def plain_text(value: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", value)).split())


def parse_catalog(page: str) -> list[dict[str, str]]:
    products = []
    seen_ids = set()
    for product_id, name in re.findall(
        r'href="/products/a/item/(\d+)/kanto/"[^>]*>\s*(?:<[^>]+>\s*)*([^<]+)',
        page,
    ):
        if product_id in seen_ids:
            continue
        seen_ids.add(product_id)
        products.append(
            {
                "id": product_id,
                "nameJa": html.unescape(name).strip(),
                "url": f"https://www.sej.co.jp/products/a/item/{product_id}/kanto/",
            }
        )
    if not products:
        raise ValueError("Official 7-Eleven sandwich catalog did not contain product links")
    return products


def parse_regions(page: str) -> list[str]:
    match = re.search(r"販売地域：</span>(.*?)</p>", page, re.DOTALL)
    if match is None:
        raise ValueError("Official 7-Eleven sales-region markup was not found")
    return [region.strip() for region in plain_text(match.group(1)).split("、")]


def parse_nutrition(page: str) -> dict[str, float]:
    match = re.search(
        r"熱量：(?P<calories>[\d.]+)kcal、たんぱく質：(?P<protein>[\d.]+)g、"
        r"脂質：(?P<fat>[\d.]+)g、炭水化物：(?P<carbohydrates>[\d.]+)g",
        plain_text(page),
    )
    if match is None:
        raise ValueError("Official 7-Eleven nutrition markup did not match the expected layout")
    return {key: float(value) for key, value in match.groupdict().items()}


def product_key(name: str) -> str:
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", name)).replace("ー", "-")


def is_sold_in_target_area(regions: list[str]) -> bool:
    return NATIONWIDE_AREA in regions or bool(TARGET_AREAS.intersection(regions))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("web/src/data/seven_eleven_kanto_sandwiches.json"),
        help="App-format Food[] JSON (bundled dataset)",
    )
    parser.add_argument(
        "--raw-output",
        type=Path,
        default=Path("scripts/output/seven_eleven_kanto_sandwiches.raw.json"),
        help="Raw official product data and provenance, for review",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=2,
        help="Delay between official product-page requests in seconds",
    )
    args = parser.parse_args()
    if args.delay < 1:
        parser.error("--delay must be at least 1 second")

    catalog = parse_catalog(fetch(CATALOG_URL))
    retained = []
    seen_products = set()
    for index, product in enumerate(catalog):
        page = fetch(product["url"])
        regions = parse_regions(page)
        nutrition = parse_nutrition(page)
        key = product_key(product["nameJa"])
        if is_sold_in_target_area(regions) and key not in seen_products:
            seen_products.add(key)
            retained.append({**product, "regions": regions, "nutrition": nutrition})
        if index < len(catalog) - 1:
            time.sleep(args.delay)

    if not retained:
        raise ValueError("No Tokyo or Kanagawa sandwiches were found in the official catalog")

    retrieved_at = date.today().isoformat()
    args.raw_output.parent.mkdir(parents=True, exist_ok=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.raw_output.write_text(
        json.dumps(
            {
                "catalogUrl": CATALOG_URL,
                "retrievedAt": retrieved_at,
                "targetAreas": sorted(TARGET_AREAS),
                "products": retained,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    foods = [
        {
            "id": f"seven-jp-kanto-sandwich-{product['id']}",
            "name": {"ja": product["nameJa"].replace("\u3000", " ")},
            "description": "7-Eleven Japan (Tokyo/Kanagawa)",
            "serving": "1 serving",
            "nutrition": product["nutrition"],
            "source": "bundled",
        }
        for product in retained
    ]
    args.output.write_text(
        json.dumps(foods, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Wrote {len(retained)} unique audited products to {args.raw_output}", file=sys.stderr)
    print(f"Wrote {len(foods)} foods to {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
