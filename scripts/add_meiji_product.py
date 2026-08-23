"""Add a single Meiji Japan product page to the bundled food database.

Meiji product pages (any category: icecream, sports, dairies, ...) share the
same server-rendered layout used by import_meiji_japan.py: an <h1> product
name and a "栄養成分表示" nutrition table. This script fetches one product
URL directly, so you don't need to crawl a whole category to add one item.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from import_meiji_japan import NAME_RE, fetch, parse_amount, parse_nutrition, simplify_serving  # noqa: E402

ROOT = Path(__file__).parent.parent
DEFAULT_OUTPUT = ROOT / "web/src/data/food.json"
PRODUCT_URL_RE = re.compile(r"/products/([^/]+)/(\d+)\.html$")


def build_food(url: str, html: str) -> dict:
    match = PRODUCT_URL_RE.search(url)
    if not match:
        raise ValueError(f"Unrecognized Meiji product URL: {url}")
    category, jan = match.groups()

    name_match = NAME_RE.search(html)
    if not name_match:
        raise ValueError(f"Could not find product name: {url}")
    parsed = parse_nutrition(html)
    if parsed is None:
        raise ValueError(f"Could not parse nutrition table: {url}")
    amount = parse_amount(html) or "1 serving"

    food = {
        "id": f"meiji-jp-{category}-{jan}",
        "name": {"ja": name_match.group(1).strip()},
        "serving": simplify_serving(amount),
        "nutrition": parsed["nutrition"],
        "source": "bundled",
        "description": "Meiji Japan",
    }
    if parsed["detail"]:
        food["detail"] = parsed["detail"]
    return food


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="Meiji product page, e.g. https://www.meiji.co.jp/products/sports/4902705130883.html")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Bundled Food[] JSON to update")
    args = parser.parse_args()

    food = build_food(args.url, fetch(args.url))
    foods = json.loads(args.output.read_text(encoding="utf-8"))
    if not isinstance(foods, list):
        raise ValueError(f"Expected a JSON array: {args.output}")
    if any(existing.get("id") == food["id"] for existing in foods):
        raise SystemExit(f"Food already exists: {food['id']}")
    foods.append(food)
    args.output.write_text(json.dumps(foods, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Added {food['id']} to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
