"""Add one hand-curated food to the bundled food database."""

from __future__ import annotations

import argparse
import json
import math
import os
import uuid
from pathlib import Path

ROOT = Path(__file__).parent.parent
DEFAULT_OUTPUT = ROOT / "web/src/data/food.json"
NUTRIENTS = ("calories", "protein", "fat", "carbohydrates")


def invalid(message: str) -> ValueError:
    return ValueError(f"Invalid food: {message}")


def valid_nutrient(value: float) -> bool:
    return math.isfinite(value) and value >= 0


def round_nutrient(value: float) -> float | int:
    # ponytail: nutrition labels publish at most 1 decimal place; round instead
    # of trusting typed-in precision, and emit whole numbers as ints to match
    # the rest of food.json.
    rounded = round(value, 1)
    return int(rounded) if rounded == int(rounded) else rounded


def build_food(
    name: str,
    name_ja: str,
    name_zh: str,
    serving: str,
    calories: float,
    protein: float,
    fat: float,
    carbohydrates: float,
) -> dict:
    if not name.strip():
        raise invalid("name must not be empty")
    if not serving.strip():
        raise invalid("serving must not be empty")
    nutrition = {"calories": calories, "protein": protein, "fat": fat, "carbohydrates": carbohydrates}
    if not all(valid_nutrient(nutrition[nutrient]) for nutrient in NUTRIENTS):
        raise invalid("nutrition values must be non-negative finite numbers")
    nutrition = {nutrient: round_nutrient(value) for nutrient, value in nutrition.items()}

    names = {"en": name.strip()}
    if name_ja.strip():
        names["ja"] = name_ja.strip()
    if name_zh.strip():
        names["zh"] = name_zh.strip()
    return {
        "id": f"manual-{uuid.uuid4().hex[:12]}",
        "name": names,
        "serving": serving.strip(),
        "nutrition": nutrition,
        "source": "bundled",
    }


def add_food(foods: list[dict], food: dict) -> None:
    if any(existing.get("id") == food["id"] for existing in foods):
        raise ValueError(f"Food already exists: {food['id']}")
    foods.append(food)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", required=True, help="Default/English name")
    parser.add_argument("--name-ja", default="", help="Optional Japanese name")
    parser.add_argument("--name-zh", default="", help="Optional Chinese name")
    parser.add_argument("--serving", required=True, help='Serving size, e.g. "100g"')
    parser.add_argument("--calories", type=float, required=True)
    parser.add_argument("--protein", type=float, required=True)
    parser.add_argument("--fat", type=float, required=True)
    parser.add_argument("--carbohydrates", type=float, required=True)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Bundled Food[] JSON to update")
    args = parser.parse_args()

    food = build_food(
        args.name,
        args.name_ja,
        args.name_zh,
        args.serving,
        args.calories,
        args.protein,
        args.fat,
        args.carbohydrates,
    )
    foods = json.loads(args.output.read_text(encoding="utf-8"))
    if not isinstance(foods, list):
        raise ValueError(f"Expected a JSON array: {args.output}")
    add_food(foods, food)
    args.output.write_text(json.dumps(foods, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Added {food['id']} to {args.output}")

    if github_output := os.environ.get("GITHUB_OUTPUT"):
        with open(github_output, "a", encoding="utf-8") as handle:
            handle.write(f"item_id={food['id']}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
