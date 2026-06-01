from __future__ import annotations

from datetime import date, timedelta
from math import ceil, sqrt
from typing import Dict, Iterable, List, Optional

import numpy as np
import pandas as pd

from app.services.forecasting import daily_demand_series


def _as_date(value) -> date:
    if isinstance(value, date):
        return value
    return pd.to_datetime(value).date()


def _filter_inbound(
    inbound_shipments: pd.DataFrame,
    sku: str,
    as_of: date,
    through_date: date,
) -> int:
    if inbound_shipments.empty:
        return 0
    required = {"sku", "quantity", "eta_date", "status"}
    missing = required.difference(inbound_shipments.columns)
    if missing:
        raise ValueError("Missing inbound columns: " + ", ".join(sorted(missing)))

    df = inbound_shipments[inbound_shipments["sku"].astype(str) == str(sku)].copy()
    if df.empty:
        return 0
    df["eta_date"] = pd.to_datetime(df["eta_date"]).dt.date
    active = ~df["status"].astype(str).str.lower().isin(["received", "cancelled", "canceled"])
    window = (df["eta_date"] >= as_of) & (df["eta_date"] <= through_date)
    return int(df[active & window]["quantity"].fillna(0).sum())


def recommend_reorder(
    sku: str,
    warehouse: str,
    inventory_lots: pd.DataFrame,
    orders: pd.DataFrame,
    inbound_shipments: pd.DataFrame,
    as_of: Optional[date] = None,
    lead_time_days: int = 30,
    review_period_days: int = 30,
    service_level_z: float = 1.65,
) -> Dict[str, object]:
    today = as_of or date.today()
    if inventory_lots.empty:
        inv = pd.DataFrame(columns=["sku", "warehouse", "quantity_on_hand", "expiration_date", "unit_cost"])
    else:
        inv = inventory_lots[
            (inventory_lots["sku"].astype(str) == str(sku))
            & (inventory_lots["warehouse"].astype(str) == str(warehouse))
        ].copy()

    if not inv.empty:
        inv["expiration_date"] = pd.to_datetime(inv["expiration_date"]).dt.date
        inv["quantity_on_hand"] = inv["quantity_on_hand"].fillna(0).astype(int)
        usable_inventory = int(
            inv[(inv["quantity_on_hand"] > 0) & (inv["expiration_date"] >= today)]["quantity_on_hand"].sum()
        )
        expiring_within_90 = int(
            inv[
                (inv["quantity_on_hand"] > 0)
                & (inv["expiration_date"] >= today)
                & (inv["expiration_date"] <= today + timedelta(days=90))
            ]["quantity_on_hand"].sum()
        )
        expiring_before_lead = int(
            inv[
                (inv["quantity_on_hand"] > 0)
                & (inv["expiration_date"] >= today)
                & (inv["expiration_date"] <= today + timedelta(days=lead_time_days))
            ]["quantity_on_hand"].sum()
        )
    else:
        usable_inventory = 0
        expiring_within_90 = 0
        expiring_before_lead = 0

    series = daily_demand_series(orders, sku=sku, as_of=today, history_days=365)
    recent = series.tail(90)
    avg_daily_demand = float(recent.mean()) if not recent.empty else 0.0
    demand_std = float(np.std(recent.to_numpy(), ddof=0)) if len(recent) else 0.0

    inbound_lead = _filter_inbound(inbound_shipments, sku, today, today + timedelta(days=lead_time_days))
    inbound_target = _filter_inbound(
        inbound_shipments, sku, today, today + timedelta(days=lead_time_days + review_period_days)
    )

    safety_stock = service_level_z * demand_std * sqrt(max(lead_time_days, 1))
    reorder_point = avg_daily_demand * lead_time_days + safety_stock
    target_stock = avg_daily_demand * (lead_time_days + review_period_days) + safety_stock
    net_position = usable_inventory + inbound_lead
    target_position = usable_inventory + inbound_target
    effective_position = max(0.0, float(net_position - expiring_before_lead))
    recommended_qty = int(ceil(max(0.0, target_stock - target_position)))
    days_of_supply = None if avg_daily_demand <= 0 else round(float(net_position / avg_daily_demand), 1)

    confidence = 0.55 + min(0.35, float((series > 0).sum()) / 180.0)
    confidence = round(min(confidence, 0.95), 2)

    if avg_daily_demand <= 0:
        status = "overstocked" if usable_inventory > 0 else "wait"
        recommended_qty = 0
        reason = (
            "No recent demand is visible for this SKU, so avoid replenishment and review whether existing stock "
            "should be promoted, transferred, or delisted."
        )
        reorder_by = today + timedelta(days=review_period_days)
    elif usable_inventory <= 0:
        status = "stockout risk"
        reason = (
            "Stockout risk because usable inventory is zero while recent average demand is %.2f units/day "
            "and supplier lead time is %s days."
        ) % (avg_daily_demand, lead_time_days)
        reorder_by = today
    elif effective_position < avg_daily_demand * lead_time_days:
        status = "stockout risk"
        reason = (
            "Stockout risk due to %s-day ocean freight lead time: effective inventory %.0f is below lead-time "
            "demand %.0f after excluding %s units expiring before replenishment."
        ) % (lead_time_days, effective_position, avg_daily_demand * lead_time_days, expiring_before_lead)
        reorder_by = today
    elif net_position <= reorder_point:
        status = "reorder now"
        reason = (
            "Reorder now because inventory position %.0f is at or below reorder point %.0f "
            "(average daily demand %.2f plus safety stock %.0f)."
        ) % (net_position, reorder_point, avg_daily_demand, safety_stock)
        reorder_by = today
    elif expiring_within_90 > max(avg_daily_demand * 30, 1) and days_of_supply and days_of_supply > 90:
        status = "overstocked"
        recommended_qty = 0
        reason = (
            "Overstocked: %.1f days of supply and %s units expire within 90 days, so reduce inbound buying "
            "and prioritize FEFO allocation."
        ) % (days_of_supply, expiring_within_90)
        reorder_by = today + timedelta(days=review_period_days)
    else:
        status = "wait"
        reason = (
            "Wait because inventory position %.0f covers the %s-day lead time plus safety stock; next review "
            "should happen before projected days of supply falls below lead time."
        ) % (net_position, lead_time_days)
        days_until_reorder = max(0, int((days_of_supply or lead_time_days) - lead_time_days))
        reorder_by = today + timedelta(days=min(days_until_reorder, review_period_days))

    return {
        "sku": str(sku),
        "warehouse": str(warehouse),
        "status": status,
        "recommended_order_qty": recommended_qty,
        "reorder_by_date": reorder_by.isoformat(),
        "reason": reason,
        "confidence": confidence,
        "average_daily_demand": round(avg_daily_demand, 4),
        "demand_variability": round(demand_std, 4),
        "lead_time_days": int(lead_time_days),
        "safety_stock": round(float(safety_stock), 2),
        "current_inventory": int(usable_inventory),
        "inbound_within_lead_time": int(inbound_lead),
        "inventory_expiring_within_90_days": int(expiring_within_90),
        "days_of_supply": days_of_supply,
        "reorder_point": round(float(reorder_point), 2),
    }


def generate_reorder_recommendations(
    inventory_lots: pd.DataFrame,
    orders: pd.DataFrame,
    inbound_shipments: pd.DataFrame,
    skus: Optional[Iterable[str]] = None,
    warehouses: Optional[Iterable[str]] = None,
    as_of: Optional[date] = None,
    lead_time_days: int = 30,
) -> List[Dict[str, object]]:
    if skus is None:
        sku_values = sorted(set(inventory_lots.get("sku", pd.Series(dtype=str)).astype(str)))
    else:
        sku_values = sorted(set(str(sku) for sku in skus))

    if warehouses is None:
        warehouse_values = sorted(set(inventory_lots.get("warehouse", pd.Series(dtype=str)).astype(str)))
    else:
        warehouse_values = sorted(set(str(warehouse) for warehouse in warehouses))

    results: List[Dict[str, object]] = []
    for sku in sku_values:
        for warehouse in warehouse_values:
            has_inventory = not inventory_lots[
                (inventory_lots["sku"].astype(str) == sku)
                & (inventory_lots["warehouse"].astype(str) == warehouse)
            ].empty
            if not has_inventory:
                continue
            results.append(
                recommend_reorder(
                    sku=sku,
                    warehouse=warehouse,
                    inventory_lots=inventory_lots,
                    orders=orders,
                    inbound_shipments=inbound_shipments,
                    as_of=as_of,
                    lead_time_days=lead_time_days,
                )
            )

    priority = {"stockout risk": 0, "reorder now": 1, "wait": 2, "overstocked": 3}
    return sorted(results, key=lambda item: (priority.get(str(item["status"]), 9), item["sku"], item["warehouse"]))

