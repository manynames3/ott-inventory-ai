from __future__ import annotations

from datetime import date, datetime
from typing import Dict, List, Optional, Tuple

import pandas as pd


def _as_date(value) -> date:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    return pd.to_datetime(value).date()


def classify_expiration(expiration_date, as_of: Optional[date] = None) -> Dict[str, object]:
    today = as_of or date.today()
    exp_date = _as_date(expiration_date)
    days = (exp_date - today).days

    if days < 0:
        return {
            "days_to_expiration": days,
            "bucket": "expired",
            "risk_level": "critical",
            "suggested_action": "Quarantine lot, block allocation, and investigate write-off exposure.",
        }
    if days <= 30:
        return {
            "days_to_expiration": days,
            "bucket": "0-30 days",
            "risk_level": "critical",
            "suggested_action": "Priority allocate to fastest-turning customers or discount immediately.",
        }
    if days <= 60:
        return {
            "days_to_expiration": days,
            "bucket": "31-60 days",
            "risk_level": "high",
            "suggested_action": "Transfer to higher-demand warehouse or attach to near-term promotions.",
        }
    if days <= 90:
        return {
            "days_to_expiration": days,
            "bucket": "61-90 days",
            "risk_level": "medium",
            "suggested_action": "Flag for priority allocation before newer lots are shipped.",
        }
    return {
        "days_to_expiration": days,
        "bucket": "90+ days",
        "risk_level": "normal",
        "suggested_action": "Use standard FEFO allocation.",
    }


def _lot_record(row: pd.Series, as_of: Optional[date]) -> Dict[str, object]:
    exp_date = _as_date(row["expiration_date"])
    flags = classify_expiration(exp_date, as_of)
    return {
        "lot_id": str(row["lot_id"]),
        "sku": str(row["sku"]),
        "warehouse": str(row["warehouse"]),
        "quantity_on_hand": int(row["quantity_on_hand"]),
        "expiration_date": exp_date.isoformat(),
        "unit_cost": float(row.get("unit_cost", 0) or 0),
        **flags,
    }


def recommend_fefo(lots: pd.DataFrame, as_of: Optional[date] = None) -> List[Dict[str, object]]:
    """Return one FEFO picking recommendation per SKU and warehouse.

    The function is intentionally DataFrame-based so CSV imports, database reads,
    and future ERP adapters can all feed the same optimization logic.
    """
    required = {"lot_id", "sku", "warehouse", "quantity_on_hand", "expiration_date"}
    missing = required.difference(lots.columns)
    if missing:
        raise ValueError("Missing FEFO columns: " + ", ".join(sorted(missing)))

    if lots.empty:
        return []

    df = lots.copy()
    df = df[df["quantity_on_hand"].fillna(0).astype(float) > 0]
    if df.empty:
        return []

    df["expiration_sort"] = pd.to_datetime(df["expiration_date"])
    if "received_date" in df.columns:
        df["received_sort"] = pd.to_datetime(df["received_date"])
    else:
        df["received_sort"] = pd.Timestamp.max

    df = df.sort_values(["sku", "warehouse", "expiration_sort", "received_sort", "lot_id"])
    recommendations: List[Dict[str, object]] = []

    for (sku, warehouse), group in df.groupby(["sku", "warehouse"], sort=True):
        first = group.iloc[0]
        first_lot = _lot_record(first, as_of)
        next_lot = _lot_record(group.iloc[1], as_of) if len(group) > 1 else None

        if next_lot:
            gap = int(next_lot["days_to_expiration"]) - int(first_lot["days_to_expiration"])
            reason = (
                "Ship Lot {lot} first because it expires {gap} days before Lot {next_lot}."
            ).format(lot=first_lot["lot_id"], gap=gap, next_lot=next_lot["lot_id"])
        else:
            reason = "Ship Lot {lot} first because it is the only available lot for this SKU and warehouse.".format(
                lot=first_lot["lot_id"]
            )

        recommendations.append(
            {
                "sku": str(sku),
                "warehouse": str(warehouse),
                "ship_first_lot": first_lot["lot_id"],
                "expiration_date": first_lot["expiration_date"],
                "days_to_expiration": first_lot["days_to_expiration"],
                "risk_bucket": first_lot["bucket"],
                "suggested_action": first_lot["suggested_action"],
                "reason": reason,
                "lots": [_lot_record(row, as_of) for _, row in group.iterrows()],
            }
        )

    return recommendations


def waste_risk_alerts(
    lots: pd.DataFrame, as_of: Optional[date] = None, horizon_days: int = 90
) -> List[Dict[str, object]]:
    required = {"lot_id", "sku", "warehouse", "quantity_on_hand", "expiration_date"}
    missing = required.difference(lots.columns)
    if missing:
        raise ValueError("Missing waste-risk columns: " + ", ".join(sorted(missing)))

    alerts: List[Dict[str, object]] = []
    today = as_of or date.today()
    if lots.empty:
        return alerts

    for _, row in lots.iterrows():
        quantity = int(row["quantity_on_hand"] or 0)
        if quantity <= 0:
            continue

        exp_date = _as_date(row["expiration_date"])
        days = (exp_date - today).days
        if days > horizon_days:
            continue

        flags = classify_expiration(exp_date, today)
        alerts.append(
            {
                "sku": str(row["sku"]),
                "lot_id": str(row["lot_id"]),
                "warehouse": str(row["warehouse"]),
                "quantity_at_risk": quantity,
                "expiration_date": exp_date.isoformat(),
                "risk_bucket": flags["bucket"],
                "suggested_action": flags["suggested_action"],
            }
        )

    return sorted(alerts, key=lambda item: (item["expiration_date"], item["sku"], item["warehouse"]))


def expiration_bucket_summary(lots: pd.DataFrame, as_of: Optional[date] = None) -> List[Dict[str, object]]:
    buckets: Dict[str, Tuple[int, float]] = {
        "expired": (0, 0.0),
        "0-30 days": (0, 0.0),
        "31-60 days": (0, 0.0),
        "61-90 days": (0, 0.0),
        "90+ days": (0, 0.0),
    }

    if lots.empty:
        return [{"bucket": key, "quantity": qty, "value": value} for key, (qty, value) in buckets.items()]

    for _, row in lots.iterrows():
        quantity = int(row.get("quantity_on_hand", 0) or 0)
        if quantity <= 0:
            continue
        flags = classify_expiration(row["expiration_date"], as_of)
        bucket = str(flags["bucket"])
        qty, value = buckets[bucket]
        buckets[bucket] = (qty + quantity, value + quantity * float(row.get("unit_cost", 0) or 0))

    return [
        {"bucket": key, "quantity": qty, "value": round(value, 2)}
        for key, (qty, value) in buckets.items()
    ]

