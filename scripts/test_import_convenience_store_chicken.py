import unittest

from import_convenience_store_chicken import parse_nutrition


class ParseNutritionTests(unittest.TestCase):
    def test_parses_each_official_layout(self) -> None:
        self.assertEqual(
            parse_nutrition(
                "seven",
                "<td>熱量：174kcal、たんぱく質：13.4g、脂質：9.0g、"
                "炭水化物：10.0g（糖質：9.7g）</td>",
            ),
            {"calories": 174, "protein": 13.4, "fat": 9, "carbohydrates": 10},
        )
        self.assertEqual(
            parse_nutrition(
                "lawson",
                "<dt>熱量</dt><dd>226kcal</dd><dt>たんぱく質</dt><dd>14.4g</dd>"
                "<dt>脂質</dt><dd>15.4g</dd><dt>炭水化物</dt><dd>7.8g</dd>",
            ),
            {"calories": 226, "protein": 14.4, "fat": 15.4, "carbohydrates": 7.8},
        )
        self.assertEqual(
            parse_nutrition(
                "familymart",
                "<table><tr><td>熱量<br>（kcal）</td><td>たんぱく質<br>（g）</td>"
                "<td>脂質<br>（g）</td><td>炭水化物<br>（g）</td></tr><tr>"
                "<td>251.7</td><td>12.7</td><td>15.7</td><td>14.8</td></tr></table>",
            ),
            {"calories": 251.7, "protein": 12.7, "fat": 15.7, "carbohydrates": 14.8},
        )


if __name__ == "__main__":
    unittest.main()
