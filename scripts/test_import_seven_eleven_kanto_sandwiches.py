import unittest

from import_seven_eleven_kanto_sandwiches import (
    parse_catalog,
    parse_nutrition,
    parse_regions,
    product_key,
    is_sold_in_target_area,
)


class SevenElevenKantoSandwichImporterTests(unittest.TestCase):
    def test_parses_catalog_regions_and_nutrition(self) -> None:
        catalog = parse_catalog(
            '<a href="/products/a/item/053813/kanto/">照焼チキンとたまごサンド</a>'
        )
        self.assertEqual(
            catalog,
            [
                {
                    "id": "053813",
                    "nameJa": "照焼チキンとたまごサンド",
                    "url": "https://www.sej.co.jp/products/a/item/053813/kanto/",
                }
            ],
        )
        self.assertEqual(parse_regions("<p>販売地域：</span>東京都、神奈川県、甲信越</p>"), ["東京都", "神奈川県", "甲信越"])
        self.assertEqual(
            parse_nutrition(
                "<td>熱量：338kcal、たんぱく質：15.8g、脂質：19.1g、炭水化物：26.5g</td>"
            ),
            {"calories": 338, "protein": 15.8, "fat": 19.1, "carbohydrates": 26.5},
        )

    def test_normalizes_regional_product_name_variants_for_deduplication(self) -> None:
        self.assertEqual(
            product_key("セブンーイレブンこだわりＴＨＥたまごサンド"),
            product_key("セブン－イレブンこだわりTHEたまごサンド"),
        )

    def test_treats_nationwide_products_as_available_in_the_target_areas(self) -> None:
        self.assertTrue(is_sold_in_target_area(["全国"]))
        self.assertTrue(is_sold_in_target_area(["東京都"]))
        self.assertTrue(is_sold_in_target_area(["神奈川県"]))
        self.assertFalse(is_sold_in_target_area(["茨城県", "栃木県"]))


if __name__ == "__main__":
    unittest.main()
