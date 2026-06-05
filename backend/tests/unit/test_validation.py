from datetime import date, timedelta
import os
import sys
import unittest

import pandas as pd


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.services.validation import forecast_backtest  # noqa: E402


class ValidationTest(unittest.TestCase):
    def test_forecast_backtest_reports_holdout_accuracy(self):
        as_of = date(2026, 6, 1)
        orders = pd.DataFrame(
            [
                {"sku": "08252K", "order_date": as_of - timedelta(days=offset), "quantity": 10}
                for offset in range(180)
            ]
        )
        products = pd.DataFrame(
            [{"sku": "08252K", "name": "Ottogi Jin Ramen Hot Case", "category": "Noodles"}]
        )

        result = forecast_backtest(orders, products, as_of=as_of, horizon_days=30)

        self.assertEqual(result["summary"]["sku_count"], 1)
        self.assertEqual(result["summary"]["weighted_absolute_percentage_error"], 0)
        self.assertEqual(result["rows"][0]["product_name"], "Ottogi Jin Ramen Hot Case")
        self.assertIn("pilot reorder-point calibration", result["rows"][0]["business_note"])


if __name__ == "__main__":
    unittest.main()
