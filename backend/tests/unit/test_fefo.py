from datetime import date
import os
import sys
import unittest

import pandas as pd


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.services.fefo import classify_expiration, recommend_fefo, waste_risk_alerts  # noqa: E402


class FEFOTest(unittest.TestCase):
    def test_recommends_earliest_expiring_lot_first(self):
        lots = pd.DataFrame(
            [
                {
                    "lot_id": "LOT-B",
                    "sku": "OTG-001",
                    "warehouse": "LA DC",
                    "quantity_on_hand": 100,
                    "received_date": "2026-01-15",
                    "expiration_date": "2026-08-15",
                    "unit_cost": 12.5,
                },
                {
                    "lot_id": "LOT-A",
                    "sku": "OTG-001",
                    "warehouse": "LA DC",
                    "quantity_on_hand": 80,
                    "received_date": "2026-02-01",
                    "expiration_date": "2026-07-01",
                    "unit_cost": 12.5,
                },
            ]
        )

        recs = recommend_fefo(lots, as_of=date(2026, 6, 1))

        self.assertEqual(recs[0]["ship_first_lot"], "LOT-A")
        self.assertEqual(recs[0]["risk_bucket"], "0-30 days")
        self.assertIn("expires 45 days before Lot LOT-B", recs[0]["reason"])

    def test_waste_risk_alerts_include_30_60_90_day_buckets(self):
        lots = pd.DataFrame(
            [
                {
                    "lot_id": "L30",
                    "sku": "A",
                    "warehouse": "LA DC",
                    "quantity_on_hand": 10,
                    "expiration_date": "2026-06-20",
                },
                {
                    "lot_id": "L60",
                    "sku": "A",
                    "warehouse": "LA DC",
                    "quantity_on_hand": 10,
                    "expiration_date": "2026-07-20",
                },
                {
                    "lot_id": "L90",
                    "sku": "A",
                    "warehouse": "LA DC",
                    "quantity_on_hand": 10,
                    "expiration_date": "2026-08-20",
                },
            ]
        )

        alerts = waste_risk_alerts(lots, as_of=date(2026, 6, 1), horizon_days=90)
        buckets = [alert["risk_bucket"] for alert in alerts]

        self.assertEqual(buckets, ["0-30 days", "31-60 days", "61-90 days"])
        self.assertEqual(classify_expiration("2026-08-20", date(2026, 6, 1))["risk_level"], "medium")


if __name__ == "__main__":
    unittest.main()

