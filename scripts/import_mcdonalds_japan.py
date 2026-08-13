"""Import McDonald's Japan's public nutrition table into local Food JSON.

Fetches the official Japanese nutrition table and, for each product,
the official English product page title. McDonald's Japan does not
publish an official Chinese menu; Chinese names are optional and only
filled in from a reviewed JSON map (--zh-map). Missing Chinese names
are simply omitted, never invented.

Writes two files:
  --raw-output   the raw scraped rows/names/provenance, for audit
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
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BASE = "https://www.mcdonalds.co.jp"
NUTRIENT_URL = f"{BASE}/quality/allergy_Nutrition/nutrient/"
EN_PRODUCT_URL = BASE + "/en/products/{product_id}/"
USER_AGENT = "diet-seed-importer/1.0 (local development)"


def fetch(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8")


def text(value: str) -> str:
    return " ".join(value.split())


class NutritionParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None
        self._product_id: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        if tag == "tr":
            self._row = []
            self._product_id = None
        elif tag == "td" and self._row is not None:
            self._cell = []
        elif tag == "a" and self._cell is not None:
            href = attrs_dict.get("href", "")
            match = re.fullmatch(r"/products/(\d+)/", href or "")
            if match:
                self._product_id = match.group(1)

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "td" and self._row is not None and self._cell is not None:
            self._row.append(text("".join(self._cell)))
            self._cell = None
        elif tag == "tr" and self._row and self._product_id:
            self.rows.append([self._product_id, *self._row])
            self._row = None


TITLE_RE = re.compile(r"<title>\s*([^<|]+?)\s*\|", re.IGNORECASE)


def fetch_english_name(product_id: str, delay: float) -> str | None:
    """Fetch the official English product page title, or None if it 404s."""
    try:
        page = fetch(EN_PRODUCT_URL.format(product_id=product_id))
    except HTTPError as error:
        if error.code == 404:
            return None
        raise
    finally:
        time.sleep(delay)
    match = TITLE_RE.search(page)
    return match.group(1).strip() if match else None


def number(value: str) -> float:
    match = re.search(r"-?\d+(?:\.\d+)?", value.replace(",", ""))
    if not match:
        raise ValueError(f"Expected numeric nutrition value, got {value!r}")
    parsed = float(match.group())
    return int(parsed) if parsed.is_integer() else parsed


def load_chinese_map(path: Path | None) -> dict[str, str]:
    if path is None:
        return {}
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict) or any(
        not isinstance(k, str) or not isinstance(v, str) or not v.strip()
        for k, v in value.items()
    ):
        raise SystemExit(
            "Chinese map must be a JSON object of product ID to non-empty name"
        )
    return value


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("mcdonalds_japan.json"),
        help="App-format Food[] JSON (built-in/bundled dataset)",
    )
    parser.add_argument(
        "--raw-output",
        type=Path,
        default=Path("mcdonalds_japan.raw.json"),
        help="Raw scraped rows/names/provenance, for audit",
    )
    parser.add_argument(
        "--zh-map",
        type=Path,
        help='Optional reviewed JSON map: {"1030": "虾堡"}; McDonald\'s Japan '
        "does not publish official Chinese names, so entries without a "
        "reviewed mapping simply omit the Chinese name.",
    )
    parser.add_argument(
        "--delay", type=float, default=1.5, help="Delay between official requests"
    )
    parser.add_argument(
        "--limit", type=int, help="Only process the first N products (for smoke tests)"
    )
    args = parser.parse_args()
    if args.delay < 1:
        parser.error("--delay must be at least 1 second")

    retrieved_at = date.today().isoformat()
    nutrition_page = fetch(NUTRIENT_URL)
    time.sleep(args.delay)
    chinese = load_chinese_map(args.zh_map)

    nutrition = NutritionParser()
    nutrition.feed(nutrition_page)

    rows = []
    seen: set[str] = set()
    for row in nutrition.rows:
        product_id, *cells = row
        if product_id in seen or len(cells) < 6:
            continue
        seen.add(product_id)
        rows.append((product_id, cells))
    if args.limit is not None:
        rows = rows[: args.limit]

    raw_products = []
    foods = []
    for product_id, cells in rows:
        english_name = fetch_english_name(product_id, args.delay)
        if english_name is None:
            print(
                f"Skipping product {product_id}: no official English page",
                file=sys.stderr,
            )
            continue
        raw_products.append(
            {
                "productId": product_id,
                "nameJa": cells[0],
                "nameEn": english_name,
                "nutritionRow": cells,
            }
        )
        name = {"ja": cells[0], "en": english_name}
        if product_id in chinese:
            name["zh"] = chinese[product_id]
        foods.append(
            {
                "id": f"mcd-jp-{product_id}",
                "name": name,
                "serving": "1 serving",
                "nutrition": {
                    "calories": number(cells[1]),
                    "protein": number(cells[2]),
                    "fat": number(cells[3]),
                    "carbohydrates": number(cells[5]),
                },
                "source": "bundled",
            }
        )

    if not foods:
        raise SystemExit("No products found; the official page layout may have changed")

    raw = {
        "retrievedAt": retrieved_at,
        "sources": {
            "nutrition": NUTRIENT_URL,
            "englishProduct": EN_PRODUCT_URL,
        },
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
