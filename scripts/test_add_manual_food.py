import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from add_manual_food import add_food, main, parse_food


class AddManualFoodTests(unittest.TestCase):
    def test_converts_names_and_nutrition_to_a_bundled_food(self) -> None:
        food = parse_food(
            '{"name":"Food","name_ja":"食品","name_zh":"食物","serving":"100g",'
            '"nutrition":{"calories":100,"protein":10,"fat":2,"carbohydrates":5}}'
        )
        self.assertEqual(food["name"], {"en": "Food", "ja": "食品", "zh": "食物"})
        self.assertEqual(food["source"], "bundled")
        self.assertTrue(food["id"].startswith("manual-"))

    def test_rejects_invalid_nutrition(self) -> None:
        with self.assertRaisesRegex(ValueError, "nutrition values"):
            parse_food(
                '{"name":"Food","serving":"100g",'
                '"nutrition":{"calories":-1,"protein":0,"fat":0,"carbohydrates":0}}'
            )

    def test_refuses_duplicate_without_writing(self) -> None:
        food = parse_food(
            '{"name":"Food","serving":"100g",'
            '"nutrition":{"calories":100,"protein":10,"fat":2,"carbohydrates":5}}'
        )
        foods = [food]
        with self.assertRaisesRegex(ValueError, "already exists"):
            add_food(foods, food)
        self.assertEqual(foods, [food])

    def test_writes_the_requested_database(self) -> None:
        raw_food = (
            '{"name":"Food","serving":"100g",'
            '"nutrition":{"calories":100,"protein":10,"fat":2,"carbohydrates":5}}'
        )
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "foods.json"
            output.write_text("[]", encoding="utf-8")
            with patch.object(sys, "argv", ["add_manual_food.py", raw_food, "--output", str(output)]):
                self.assertEqual(main(), 0)
            self.assertEqual(len(json.loads(output.read_text(encoding="utf-8"))), 1)


if __name__ == "__main__":
    unittest.main()
