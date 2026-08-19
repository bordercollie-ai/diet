"""Add one official 7-Eleven Japan product to the bundled food data."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from pathlib import Path
from urllib.parse import urlsplit

from import_seven_eleven_kanto_sandwiches import parse_nutrition, plain_text

ROOT = Path(__file__).parent.parent
DEFAULT_OUTPUT = ROOT / "web/src/data/convenience_store_japan.json"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_9) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15"
FULL_WIDTH_ASCII = str.maketrans(
    {**{chr(code): chr(code - 0xFEE0) for code in range(0xFF01, 0xFF5F)}, "\u3000": " "}
)


def fetch(url: str) -> str:
    result = subprocess.run(
        [
            "curl",
            "--fail",
            "--silent",
            "--show-error",
            "--location",
            "--user-agent",
            USER_AGENT,
            url,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        raise ValueError(
            f"Could not fetch official 7-Eleven page: {result.stderr.strip()}"
        )
    return result.stdout


def product_id_from_url(url: str) -> str:
    parts = urlsplit(url)
    match = re.fullmatch(r"/products/a/item/(\d+)/?", parts.path)
    if (
        parts.scheme != "https"
        or parts.hostname != "www.sej.co.jp"
        or parts.port is not None
        or parts.query
        or parts.fragment
        or match is None
    ):
        raise ValueError(
            "Expected an official URL like https://www.sej.co.jp/products/a/item/053705/"
        )
    return match.group(1)


def parse_name(page: str) -> str:
    match = re.search(r"<h1[^>]*>(.*?)</h1>", page, re.DOTALL)
    if match is None:
        raise ValueError("Official 7-Eleven product name was not found")
    name = plain_text(match.group(1)).translate(FULL_WIDTH_ASCII)
    if not name:
        raise ValueError("Official 7-Eleven product name was empty")
    return name


def parse_detail(page: str) -> dict[str, float]:
    match = re.search(
        r"糖質：(?P<sugar>[\d.]+)g、食物繊維：(?P<fiber>[\d.]+)g.*?食塩相当量：(?P<salt>[\d.]+)g",
        plain_text(page),
    )
    return (
        {}
        if match is None
        else {key: float(value) for key, value in match.groupdict().items()}
    )


def add_food(
    foods: list[dict],
    product_id: str,
    name: str,
    nutrition: dict[str, float],
    detail: dict[str, float],
) -> dict:
    food_id = f"seven-jp-{product_id}"
    if any(food.get("id") == food_id for food in foods):
        raise ValueError(f"Food already exists: {food_id}")
    food = {
        "id": food_id,
        "name": {"ja": f"711 {name}"},
        "description": "711 Japan",
        "serving": "1 serving",
        "nutrition": nutrition,
        "source": "bundled",
    }
    if detail:
        food["detail"] = detail
    foods.append(food)
    return food


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="Official 7-Eleven product URL")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Bundled Food[] JSON to update",
    )
    args = parser.parse_args()

    product_id = product_id_from_url(args.url)
    foods = json.loads(args.output.read_text(encoding="utf-8"))
    if any(food.get("id") == f"seven-jp-{product_id}" for food in foods):
        raise ValueError(f"Food already exists: seven-jp-{product_id}")
    page = fetch(args.url)
    nutrition = parse_nutrition(page)
    detail = parse_detail(page)
    food = add_food(foods, product_id, parse_name(page), nutrition, detail)

    args.output.write_text(
        json.dumps(foods, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Added {food['id']} to {args.output}")

    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as handle:
            handle.write(f"item_id={product_id}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
