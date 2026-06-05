from __future__ import annotations

from datetime import date, timedelta
from statistics import median
from typing import Dict, List, Optional

import pandas as pd

from app.services.forecasting import ForecastEngine
from app.services.product_context import enrich_product_rows


def forecast_backtest(
    orders: pd.DataFrame,
    products: pd.DataFrame,
    *,
    as_of: Optional[date] = None,
    horizon_days: int = 30,
    min_history_days: int = 90,
) -> Dict[str, object]:
    today = as_of or date.today()
    cutoff = today - timedelta(days=horizon_days)
    if orders.empty:
        return {
            "summary": {
                "sku_count": 0,
                "horizon_days": horizon_days,
                "median_absolute_percentage_error": None,
                "weighted_absolute_percentage_error": None,
                "total_forecast_quantity": 0,
                "total_actual_quantity": 0,
                "low_confidence_skus": 0,
            },
            "rows": [],
        }

    required = {"sku", "order_date", "quantity"}
    missing = required.difference(orders.columns)
    if missing:
        raise ValueError("Missing validation columns: " + ", ".join(sorted(missing)))

    normalized = orders.copy()
    normalized["sku"] = normalized["sku"].astype(str)
    normalized["order_date"] = pd.to_datetime(normalized["order_date"]).dt.date
    normalized["quantity"] = pd.to_numeric(normalized["quantity"], errors="coerce").fillna(0.0)

    engine = ForecastEngine()
    rows: List[Dict[str, object]] = []
    for sku in sorted(normalized["sku"].dropna().unique()):
        sku_orders = normalized[normalized["sku"] == sku]
        train = sku_orders[sku_orders["order_date"] <= cutoff]
        test = sku_orders[(sku_orders["order_date"] > cutoff) & (sku_orders["order_date"] <= today)]
        if train.empty or test.empty:
            continue

        history_days = (cutoff - min(train["order_date"])).days + 1
        if history_days < min_history_days:
            confidence = "low"
        elif int((train["quantity"] > 0).sum()) < 45:
            confidence = "low"
        elif float(train["quantity"].std(ddof=0) or 0) > max(float(train["quantity"].mean() or 0) * 3, 1):
            confidence = "medium"
        else:
            confidence = "high"

        forecast = engine.forecast_sku(train, sku, as_of=cutoff, horizons=(horizon_days,))
        forecast_quantity = float(forecast["horizons"][0]["forecast_quantity"])
        actual_quantity = float(test["quantity"].sum())
        absolute_error = abs(forecast_quantity - actual_quantity)
        absolute_percentage_error = None if actual_quantity <= 0 else absolute_error / actual_quantity
        bias = forecast_quantity - actual_quantity
        rows.append(
            {
                "sku": sku,
                "forecast_quantity": round(forecast_quantity, 1),
                "actual_quantity": round(actual_quantity, 1),
                "absolute_error": round(absolute_error, 1),
                "absolute_percentage_error": None
                if absolute_percentage_error is None
                else round(absolute_percentage_error, 3),
                "bias": round(bias, 1),
                "confidence": confidence,
                "history_days": int(history_days),
                "validation_window": f"{(cutoff + timedelta(days=1)).isoformat()} to {today.isoformat()}",
                "business_note": _business_note(absolute_percentage_error, bias, confidence),
            }
        )

    rows = enrich_product_rows(rows, products)
    rows.sort(
        key=lambda row: (
            row.get("absolute_percentage_error") is None,
            -float(row.get("absolute_percentage_error") or 0),
            -float(row.get("absolute_error") or 0),
        )
    )

    total_forecast = sum(float(row.get("forecast_quantity") or 0) for row in rows)
    total_actual = sum(float(row.get("actual_quantity") or 0) for row in rows)
    total_error = sum(float(row.get("absolute_error") or 0) for row in rows)
    percentage_errors = [
        float(row["absolute_percentage_error"])
        for row in rows
        if row.get("absolute_percentage_error") is not None
    ]
    return {
        "summary": {
            "sku_count": len(rows),
            "horizon_days": horizon_days,
            "median_absolute_percentage_error": round(median(percentage_errors), 3) if percentage_errors else None,
            "weighted_absolute_percentage_error": round(total_error / total_actual, 3) if total_actual > 0 else None,
            "total_forecast_quantity": round(total_forecast, 1),
            "total_actual_quantity": round(total_actual, 1),
            "low_confidence_skus": sum(1 for row in rows if row.get("confidence") == "low"),
        },
        "rows": rows[:100],
    }


def _business_note(absolute_percentage_error: Optional[float], bias: float, confidence: str) -> str:
    if absolute_percentage_error is None:
        return "No actual demand in the holdout window; planner should review before using this SKU for reorder tuning."
    if confidence == "low":
        return "Low-confidence SKU: sparse or short demand history; use planner override until more buyer data is loaded."
    if absolute_percentage_error <= 0.2:
        return "Forecast is close enough for pilot reorder-point calibration."
    if bias > 0:
        return "Forecast overcalled demand; review promotion flags, discontinued accounts, or slow-moving lots."
    return "Forecast undercalled demand; review promotional spikes, customer onboarding, or allocation constraints."
