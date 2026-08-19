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
    return ValueError(f"Invalid food JSON: {message}")


def parse_food(raw: str) -> dict:
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as error:
        raise invalid(error.msg) from error
    if not isinstance(value, dict):
        raise invalid("must be an object")

    name = value.get("name")
    serving = value.get("serving")
    nutrition = value.get("nutrition")
    if not isinstance(name, str) or not name.strip():
        raise invalid("name must be a non-empty string")
    if not isinstance(serving, str) or not serving.strip():
        raise invalid("serving must be a non-empty string")
    if not isinstance(nutrition, dict) or set(nutrition) != set(NUTRIENTS):
        raise invalid(f"nutrition must contain exactly: {', '.join(NUTRIENTS)}")
    if not all(
        isinstance(nutrition[nutrient], (int, float))
        and not isinstance(nutrition[nutrient], bool)
        and math.isfinite(nutrition[nutrient])
        and nutrition[nutrient] >= 0
        for nutrient in NUTRIENTS
    ):
        raise invalid("nutrition values must be non-negative finite numbers")

    names = {"en": name.strip()}
    for language in ("ja", "zh"):
        translated_name = value.get(f"name_{language}", "")
        if not isinstance(translated_name, str):
            raise invalid(f"name_{language} must be a string")
        if translated_name.strip():
            names[language] = translated_name.strip()
    return {
        "id": f"manual-{uuid.uuid4().hex[:12]}",
        "name": names,
        "serving": serving.strip(),
        "nutrition": {nutrient: nutrition[nutrient] for nutrient in NUTRIENTS},
        "source": "bundled",
    }


def add_food(foods: list[dict], food: dict) -> None:
    if any(existing.get("id") == food["id"] for existing in foods):
        raise ValueError(f"Food already exists: {food['id']}")
    foods.append(food)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("food", help="Food JSON from the workflow form")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Bundled Food[] JSON to update")
    args = parser.parse_args()

    food = parse_food(args.food)
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
