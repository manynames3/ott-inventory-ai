from datetime import date, timedelta
import os
import sys
import unittest

import pandas as pd


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.services.forecasting import ForecastEngine, MovingAverageForecast, daily_demand_series  # noqa: E402


class ForecastingTest(unittest.TestCase):
    def test_moving_average_forecast_projects_30_60_90_days(self):
        as_of = date(2026, 6, 1)
        orders = pd.DataFrame(
            [
                {"sku": "OTG-001", "order_date": as_of - timedelta(days=offset), "quantity": 10}
                for offset in range(30)
            ]
        )
        engine = ForecastEngine(models=[MovingAverageForecast(window_days=30)])

        forecast = engine.forecast_sku(orders, "OTG-001", as_of=as_of)

        self.assertEqual(forecast["models"]["moving_average"], 10.0)
        self.assertEqual(forecast["horizons"][0]["forecast_quantity"], 300.0)
        self.assertEqual(forecast["horizons"][1]["forecast_quantity"], 600.0)
        self.assertEqual(forecast["horizons"][2]["forecast_quantity"], 900.0)
        self.assertTrue(forecast["seasonality"].startswith("Not estimated"))

    def test_daily_demand_series_fills_missing_dates_with_zero(self):
        as_of = date(2026, 6, 1)
        orders = pd.DataFrame(
            [
                {"sku": "OTG-001", "order_date": as_of, "quantity": 8},
                {"sku": "OTG-001", "order_date": as_of - timedelta(days=2), "quantity": 4},
            ]
        )

        series = daily_demand_series(orders, "OTG-001", as_of=as_of, history_days=3)

        self.assertEqual(list(series.astype(int)), [4, 0, 8])

    def test_seasonality_uses_actual_prior_year_orders(self):
        as_of = date(2026, 6, 1)
        orders = pd.DataFrame(
            [
                {"sku": "OTG-001", "order_date": date(2025, 6, day), "quantity": 30}
                for day in (1, 10, 20)
            ]
        )

        forecast = ForecastEngine(models=[MovingAverageForecast(window_days=30)]).forecast_sku(
            orders,
            "OTG-001",
            as_of=as_of,
        )

        self.assertEqual(forecast["seasonality"], "Same-month last-year daily demand averaged 3.00 units.")


if __name__ == "__main__":
    unittest.main()
