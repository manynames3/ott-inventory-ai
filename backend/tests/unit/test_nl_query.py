from __future__ import annotations

import os
import sys
import unittest


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.services.nl_query import SKU_PATTERN, _source_citations


class NaturalLanguageQueryTest(unittest.TestCase):
    def test_sku_pattern_accepts_public_distributor_item_code(self):
        match = SKU_PATTERN.search("Which customers buy SKU 08252K every month?")

        self.assertIsNotNone(match)
        self.assertEqual(match.group(0), "08252K")

    def test_sku_pattern_accepts_upc_backed_demo_identifier(self):
        match = SKU_PATTERN.search("Show demand for UPC-645175525196")

        self.assertIsNotNone(match)
        self.assertEqual(match.group(0), "UPC-645175525196")

    def test_sku_pattern_accepts_internal_demo_fallback_identifier(self):
        match = SKU_PATTERN.search("Which customers buy OTK-DEMO-SOU-005?")

        self.assertIsNotNone(match)
        self.assertEqual(match.group(0), "OTK-DEMO-SOU-005")

    def test_source_citations_include_materialized_view_and_sample_ids(self):
        sources = _source_citations(
            {
                "template": "stockout_risk",
                "columns": ["sku", "warehouse", "status"],
                "rows": [{"sku": "08252K", "warehouse": "LA DC", "status": "stockout risk"}],
            }
        )

        self.assertEqual(sources[0]["source_id"], "view:stockout_risk")
        self.assertEqual(sources[0]["row_count"], 1)
        self.assertEqual(sources[0]["sample_record_ids"], ["08252K / LA DC"])


if __name__ == "__main__":
    unittest.main()
