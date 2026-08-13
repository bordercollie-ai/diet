#!/usr/bin/env python3
"""Import McDonald's Japan's public nutrition table into local Food JSON.

The Japanese site publishes Japanese and English menu pages, but not an
official Chinese menu. Supply a reviewed JSON map for the Chinese names.
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
from urllib.request import Request, urlopen

BASE = "https://www.mcdonalds.co.jp"
NUTRIENT_URL = f"{BASE}/quality/allergy_Nutrition/nutrient/"
EN_MENU_URL = f"{BASE}/en/menu/"
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


def english_names(page: str) -> dict[str, str]:
    # The official English page exposes the same product IDs in its data layer.
    return {
        product_id: name
        for product_id, name in re.findall(r'"id":"(\d+)","name":"([^"]+)"', page)
    }


def number(value: str) -> float:
    match = re.search(r"-?\d+(?:\.\d+)?", value.replace(",", ""))
    if not match:
        raise ValueError(f"Expected numeric nutrition value, got {value!r}")
    parsed = float(match.group())
    return int(parsed) if parsed.is_integer() else parsed


def load_chinese_map(path: Path | None) -> dict[str, str]:
    if path is None:
        raise SystemExit("--zh-map is required: McDonald's Japan does not publish official Chinese names")
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict) or any(not isinstance(k, str) or not isinstance(v, str) or not v.strip()
                                          for k, v in value.items()):
        raise SystemExit("Chinese map must be a JSON object of product ID to non-empty name")
    return value


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("mcdonalds_japan.json"))
    parser.add_argument("--zh-map", type=Path, help="Reviewed JSON map: {\"1030\": \"虾堡\"}")
    parser.add_argument("--delay", type=float, default=1.5, help="Delay between official requests")
    args = parser.parse_args()
    if args.delay < 1:
        parser.error("--delay must be at least 1 second")

    nutrition_page = fetch(NUTRIENT_URL)
    time.sleep(args.delay)
    english_page = fetch(EN_MENU_URL)
    chinese = load_chinese_map(args.zh_map)

    nutrition = NutritionParser()
    nutrition.feed(nutrition_page)
    english = english_names(english_page)

    foods = []
    seen: set[str] = set()
    for row in nutrition.rows:
        product_id, *cells = row
        if product_id in seen or len(cells) < 6:
            continue
        seen.add(product_id)
        if product_id not in english:
            raise SystemExit(f"Missing official English name for product {product_id}")
        if product_id not in chinese:
            raise SystemExit(f"Missing reviewed Chinese name for product {product_id}")
        foods.append({
            "id": f"mcd-jp-{product_id}",
            "name": {"ja": cells[0], "en": english[product_id], "zh": chinese[product_id]},
            "serving": "1 serving",
            "nutrition": {
                "calories": number(cells[1]),
                "protein": number(cells[2]),
                "fat": number(cells[3]),
                "carbohydrates": number(cells[5]),
            },
            "source": "bundled",
            "provenance": {"url": NUTRIENT_URL, "retrievedAt": date.today().isoformat()},
        })

    if not foods:
        raise SystemExit("No products found; the official page layout may have changed")
    args.output.write_text(json.dumps(foods, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(foods)} foods to {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
