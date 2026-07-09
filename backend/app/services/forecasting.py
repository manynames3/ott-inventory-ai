from __future__ import annotations

import calendar
from abc import ABC, abstractmethod
from datetime import date, timedelta
from typing import Dict, Iterable, List, Optional

import numpy as np
import pandas as pd


def _as_date(value) -> date:
    if isinstance(value, date):
        return value
    return pd.to_datetime(value).date()


def daily_demand_series(
    orders: pd.DataFrame,
    sku: str,
    as_of: Optional[date] = None,
    history_days: int = 365,
) -> pd.Series:
    today = as_of or date.today()
    start = today - timedelta(days=history_days - 1)
    index = pd.date_range(start=start, end=today, freq="D")

    if orders.empty:
        return pd.Series(0.0, index=index)

    required = {"sku", "order_date", "quantity"}
    missing = required.difference(orders.columns)
    if missing:
        raise ValueError("Missing demand columns: " + ", ".join(sorted(missing)))

    df = orders[orders["sku"].astype(str) == str(sku)].copy()
    if df.empty:
        return pd.Series(0.0, index=index)

    df["order_date"] = pd.to_datetime(df["order_date"]).dt.normalize()
    df = df[(df["order_date"] >= pd.Timestamp(start)) & (df["order_date"] <= pd.Timestamp(today))]
    grouped = df.groupby("order_date")["quantity"].sum().astype(float)
    return grouped.reindex(index, fill_value=0.0)


class ForecastModel(ABC):
    name: str

    @abstractmethod
    def predict_daily_demand(self, series: pd.Series) -> float:
        raise NotImplementedError


class MovingAverageForecast(ForecastModel):
    name = "moving_average"

    def __init__(self, window_days: int = 30) -> None:
        self.window_days = window_days

    def predict_daily_demand(self, series: pd.Series) -> float:
        if series.empty:
            return 0.0
        return float(series.tail(self.window_days).mean())


class ExponentialSmoothingForecast(ForecastModel):
    name = "exponential_smoothing"

    def __init__(self, alpha: float = 0.35) -> None:
        if alpha <= 0 or alpha > 1:
            raise ValueError("alpha must be in the range (0, 1]")
        self.alpha = alpha

    def predict_daily_demand(self, series: pd.Series) -> float:
        if series.empty:
            return 0.0
        values = series.astype(float).to_numpy()
        level = values[0]
        for value in values[1:]:
            level = self.alpha * value + (1 - self.alpha) * level
        return float(max(level, 0.0))


class ForecastEngine:
    def __init__(self, models: Optional[List[ForecastModel]] = None) -> None:
        self.models = models or [MovingAverageForecast(), ExponentialSmoothingForecast()]

    def forecast_sku(
        self,
        orders: pd.DataFrame,
        sku: str,
        as_of: Optional[date] = None,
        horizons: Iterable[int] = (30, 60, 90),
        history_days: int = 365,
    ) -> Dict[str, object]:
        today = as_of or date.today()
        series = daily_demand_series(orders, sku=sku, as_of=today, history_days=history_days)
        model_daily = {model.name: model.predict_daily_demand(series) for model in self.models}

        blended_daily = float(np.mean(list(model_daily.values()))) if model_daily else 0.0
        horizon_rows = [
            {
                "horizon_days": int(days),
                "forecast_quantity": round(blended_daily * int(days), 2),
                "daily_demand": round(blended_daily, 4),
            }
            for days in horizons
        ]

        last_30 = float(series.tail(30).mean()) if len(series) >= 30 else float(series.mean())
        prior_30 = float(series.tail(60).head(30).mean()) if len(series) >= 60 else last_30
        if last_30 > prior_30 * 1.1:
            trend = "Upward: recent 30-day demand is above the prior 30 days."
        elif last_30 < prior_30 * 0.9:
            trend = "Downward: recent 30-day demand is below the prior 30 days."
        else:
            trend = "Stable: no significant change was detected between the two most recent 30-day windows."

        sku_orders = orders[orders["sku"].astype(str) == str(sku)].copy() if not orders.empty else pd.DataFrame()
        if not sku_orders.empty:
            sku_orders["order_date"] = pd.to_datetime(sku_orders["order_date"])
            same_month_last_year = sku_orders[
                (sku_orders["order_date"].dt.month == today.month)
                & (sku_orders["order_date"].dt.year == today.year - 1)
            ]
        else:
            same_month_last_year = pd.DataFrame()
        if same_month_last_year.empty:
            seasonality = "Not estimated: another annual demand cycle is needed for a reliable same-month comparison."
        else:
            days_in_month = calendar.monthrange(today.year - 1, today.month)[1]
            daily_average = float(same_month_last_year["quantity"].sum()) / days_in_month
            seasonality = "Same-month last-year daily demand averaged %.2f units." % daily_average

        return {
            "sku": sku,
            "as_of": today.isoformat(),
            "models": {key: round(value, 4) for key, value in model_daily.items()},
            "blended_daily_demand": round(blended_daily, 4),
            "horizons": horizon_rows,
            "trend": trend,
            "seasonality": seasonality,
        }

    def forecast_all(
        self,
        orders: pd.DataFrame,
        skus: Iterable[str],
        as_of: Optional[date] = None,
        horizons: Iterable[int] = (30, 60, 90),
    ) -> List[Dict[str, object]]:
        return [self.forecast_sku(orders, sku, as_of=as_of, horizons=horizons) for sku in skus]
