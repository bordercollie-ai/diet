import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from add_seven_eleven_item import add_food, fetch, main, parse_detail, parse_name, product_id_from_url


class AddSevenElevenItemTests(unittest.TestCase):
    def test_parses_an_official_product_and_adds_it_once(self) -> None:
        self.assertEqual(
            product_id_from_url("https://www.sej.co.jp/products/a/item/053705/"),
            "053705",
        )
        page = (
            "<h1>たんぱく質が摂れるチキン＆チリ</h1>"
            "糖質：19.3g、食物繊維：4.0g、食塩相当量：2.1g"
        )
        foods = []
        food = add_food(
            foods,
            "053705",
            parse_name(page),
            {"calories": 261, "protein": 24.1, "fat": 8.8, "carbohydrates": 23.3},
            parse_detail(page),
        )
        self.assertEqual(food["id"], "seven-jp-053705")
        self.assertEqual(food["detail"], {"sugar": 19.3, "fiber": 4, "salt": 2.1})
        with self.assertRaisesRegex(ValueError, "already exists"):
            add_food(foods, "053705", "duplicate", food["nutrition"], {})

    def test_normalizes_full_width_ascii_in_product_names(self) -> None:
        self.assertEqual(parse_name("<h1>ＴＨＥ　チキン１２３ＡＢＣ</h1>"), "THE チキン123ABC")

    def test_rejects_non_official_urls(self) -> None:
        with self.assertRaisesRegex(ValueError, "Expected an official URL"):
            product_id_from_url("https://example.com/products/a/item/053705/")

    @patch("add_seven_eleven_item.subprocess.run")
    def test_fetches_with_curl_without_network_access(self, run) -> None:
        run.return_value = SimpleNamespace(returncode=0, stdout="<html>official</html>", stderr="")
        self.assertEqual(fetch("https://www.sej.co.jp/products/a/item/053705/"), "<html>official</html>")
        run.return_value = SimpleNamespace(returncode=22, stdout="", stderr="404")
        with self.assertRaisesRegex(ValueError, "Could not fetch official 7-Eleven page: 404"):
            fetch("https://www.sej.co.jp/products/a/item/053705/")

    @patch("add_seven_eleven_item.fetch")
    def test_writes_only_the_requested_food_database(self, fetch_page) -> None:
        fetch_page.return_value = (
            "<h1>チキン＆チリ</h1>"
            "熱量：261kcal、たんぱく質：24.1g、脂質：8.8g、"
            "炭水化物：23.3g（糖質：19.3g、食物繊維：4.0g）、食塩相当量：2.1g"
        )
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "foods.json"
            output.write_text("[]", encoding="utf-8")
            with patch.object(
                sys,
                "argv",
                ["add_seven_eleven_item.py", "https://www.sej.co.jp/products/a/item/053705/", "--output", str(output)],
            ):
                self.assertEqual(main(), 0)
            self.assertEqual([path.name for path in Path(directory).iterdir()], ["foods.json"])
            self.assertEqual(json.loads(output.read_text(encoding="utf-8"))[0]["id"], "seven-jp-053705")


if __name__ == "__main__":
    unittest.main()
