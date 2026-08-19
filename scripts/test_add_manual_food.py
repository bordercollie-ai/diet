import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from add_manual_food import add_food, build_food, main


class AddManualFoodTests(unittest.TestCase):
    def test_builds_a_bundled_food_from_individual_fields(self) -> None:
        food = build_food("Food", "食品", "食物", "100g", 100, 10, 2, 5)
        self.assertEqual(food["name"], {"en": "Food", "ja": "食品", "zh": "食物"})
        self.assertEqual(food["source"], "bundled")
        self.assertTrue(food["id"].startswith("manual-"))

    def test_omits_untranslated_optional_names(self) -> None:
        food = build_food("Food", "", "", "100g", 100, 10, 2, 5)
        self.assertEqual(food["name"], {"en": "Food"})

    def test_rounds_to_one_decimal_and_ints_stay_ints(self) -> None:
        food = build_food("Food", "", "", "100g", 100.0, 4.444, 3.3, 2.2)
        self.assertEqual(food["nutrition"], {"calories": 100, "protein": 4.4, "fat": 3.3, "carbohydrates": 2.2})
        self.assertIsInstance(food["nutrition"]["calories"], int)
        self.assertIsInstance(food["nutrition"]["protein"], float)

    def test_rejects_invalid_nutrition(self) -> None:
        with self.assertRaisesRegex(ValueError, "nutrition values"):
            build_food("Food", "", "", "100g", -1, 0, 0, 0)

    def test_rejects_empty_name_or_serving(self) -> None:
        with self.assertRaisesRegex(ValueError, "name must not be empty"):
            build_food(" ", "", "", "100g", 0, 0, 0, 0)
        with self.assertRaisesRegex(ValueError, "serving must not be empty"):
            build_food("Food", "", "", " ", 0, 0, 0, 0)

    def test_refuses_duplicate_without_writing(self) -> None:
        food = build_food("Food", "", "", "100g", 100, 10, 2, 5)
        foods = [food]
        with self.assertRaisesRegex(ValueError, "already exists"):
            add_food(foods, food)
        self.assertEqual(foods, [food])

    def test_writes_the_requested_database(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "foods.json"
            output.write_text("[]", encoding="utf-8")
            argv = [
                "add_manual_food.py",
                "--name", "Food",
                "--serving", "100g",
                "--calories", "100",
                "--protein", "10",
                "--fat", "2",
                "--carbohydrates", "5",
                "--output", str(output),
            ]
            with patch.object(sys, "argv", argv):
                self.assertEqual(main(), 0)
            self.assertEqual(len(json.loads(output.read_text(encoding="utf-8"))), 1)


if __name__ == "__main__":
    unittest.main()
