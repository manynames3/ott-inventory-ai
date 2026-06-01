from datetime import date, timedelta
import os
import sys
import unittest

import pandas as pd


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.services.reorder import recommend_reorder  # noqa: E402


class ReorderTest(unittest.TestCase):
    def test_stockout_risk_accounts_for_lead_time_and_safety_stock(self):
        as_of = date(2026, 6, 1)
        orders = pd.DataFrame(
            [
                {"sku": "OTG-001", "order_date": as_of - timedelta(days=offset), "quantity": 10}
                for offset in range(90)
            ]
        )
        inventory = pd.DataFrame(
            [
                {
                    "sku": "OTG-001",
                    "warehouse": "LA DC",
                    "quantity_on_hand": 100,
                    "expiration_date": as_of + timedelta(days=180),
                    "unit_cost": 20.0,
                }
            ]
        )
        inbound = pd.DataFrame(columns=["sku", "quantity", "eta_date", "origin", "status"])

        rec = recommend_reorder(
            sku="OTG-001",
            warehouse="LA DC",
            inventory_lots=inventory,
            orders=orders,
            inbound_shipments=inbound,
            as_of=as_of,
            lead_time_days=30,
        )

        self.assertEqual(rec["status"], "stockout risk")
        self.assertGreater(rec["recommended_order_qty"], 0)
        self.assertIn("30-day ocean freight lead time", rec["reason"])

    def test_waits_when_inventory_position_covers_lead_time(self):
        as_of = date(2026, 6, 1)
        orders = pd.DataFrame(
            [
                {"sku": "RAM-001", "order_date": as_of - timedelta(days=offset), "quantity": 2}
                for offset in range(90)
            ]
        )
        inventory = pd.DataFrame(
            [
                {
                    "sku": "RAM-001",
                    "warehouse": "NJ DC",
                    "quantity_on_hand": 500,
                    "expiration_date": as_of + timedelta(days=240),
                    "unit_cost": 8.0,
                }
            ]
        )
        inbound = pd.DataFrame(columns=["sku", "quantity", "eta_date", "origin", "status"])

        rec = recommend_reorder(
            sku="RAM-001",
            warehouse="NJ DC",
            inventory_lots=inventory,
            orders=orders,
            inbound_shipments=inbound,
            as_of=as_of,
            lead_time_days=30,
        )

        self.assertEqual(rec["status"], "wait")
        self.assertEqual(rec["recommended_order_qty"], 0)

    def test_stockout_risk_never_has_zero_recommended_qty(self):
        as_of = date(2026, 6, 1)
        orders = pd.DataFrame(
            [
                {"sku": "OTG-RAM-002", "order_date": as_of - timedelta(days=offset), "quantity": 8}
                for offset in range(90)
            ]
        )
        inventory = pd.DataFrame(
            [
                {
                    "sku": "OTG-RAM-002",
                    "warehouse": "LA DC",
                    "quantity_on_hand": 120,
                    "expiration_date": as_of + timedelta(days=12),
                    "unit_cost": 18.5,
                }
            ]
        )
        inbound = pd.DataFrame(
            [
                {
                    "sku": "OTG-RAM-002",
                    "quantity": 2000,
                    "eta_date": as_of + timedelta(days=45),
                    "origin": "Busan",
                    "status": "in_transit",
                }
            ]
        )

        rec = recommend_reorder(
            sku="OTG-RAM-002",
            warehouse="LA DC",
            inventory_lots=inventory,
            orders=orders,
            inbound_shipments=inbound,
            as_of=as_of,
            lead_time_days=30,
        )

        self.assertEqual(rec["status"], "stockout risk")
        self.assertGreater(rec["recommended_order_qty"], 0)
        self.assertIn("confidence_reason", rec)
        self.assertIn("action", rec)


if __name__ == "__main__":
    unittest.main()
