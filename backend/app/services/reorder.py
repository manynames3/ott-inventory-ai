from __future__ import annotations

from datetime import date, timedelta
from math import ceil, sqrt
from typing import Dict, Iterable, List, Optional

import numpy as np
import pandas as pd

from app.services.forecasting import daily_demand_series

REGION_WAREHOUSE_WEIGHTS = {
    "West": {"LA DC": 0.7, "Seattle DC": 0.3},
    "Northeast": {"NJ DC": 1.0},
    "South": {"Dallas DC": 0.75, "LA DC": 0.25},
    "Midwest": {"Dallas DC": 0.65, "NJ DC": 0.35},
    "National": {"LA DC": 0.3, "NJ DC": 0.3, "Dallas DC": 0.25, "Seattle DC": 0.15},
    "Canada": {"Seattle DC": 0.55, "NJ DC": 0.45},
}


def _as_date(value) -> date:
    if isinstance(value, date):
        return value
    return pd.to_datetime(value).date()


def _filter_inbound(
    inbound_shipments: pd.DataFrame,
    sku: str,
    as_of: date,
    through_date: date,
    warehouse: Optional[str] = None,
    allocation_share: float = 1.0,
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
    share = allocation_share
    if warehouse and "warehouse" in df.columns:
        df = df[df["warehouse"].astype(str) == str(warehouse)]
        share = 1.0
        if df.empty:
            return 0
    df["eta_date"] = pd.to_datetime(df["eta_date"]).dt.date
    active = ~df["status"].astype(str).str.lower().isin(["received", "cancelled", "canceled"])
    window = (df["eta_date"] >= as_of) & (df["eta_date"] <= through_date)
    return int(round(float(df[active & window]["quantity"].fillna(0).sum()) * max(0.0, share)))


def _warehouse_demand_shares(
    inventory_lots: pd.DataFrame,
    orders: pd.DataFrame,
    customers: Optional[pd.DataFrame] = None,
) -> Dict[tuple[str, str], float]:
    if inventory_lots.empty or not {"sku", "warehouse"}.issubset(inventory_lots.columns):
        return {}

    inventory = inventory_lots.copy()
    inventory["sku"] = inventory["sku"].astype(str)
    inventory["warehouse"] = inventory["warehouse"].astype(str)
    if "quantity_on_hand" not in inventory.columns:
        inventory["quantity_on_hand"] = 0
    inventory["quantity_on_hand"] = inventory["quantity_on_hand"].fillna(0).astype(float)
    sku_warehouses = inventory.groupby("sku")["warehouse"].apply(lambda rows: sorted(set(rows))).to_dict()

    inventory_shares: Dict[tuple[str, str], float] = {}
    grouped_inventory = inventory.groupby(["sku", "warehouse"])["quantity_on_hand"].sum().reset_index()
    for sku, group in grouped_inventory.groupby("sku"):
        total = float(group["quantity_on_hand"].clip(lower=0).sum())
        rows = group.to_dict("records")
        if total <= 0:
            equal_share = 1.0 / max(len(rows), 1)
            for row in rows:
                inventory_shares[(str(sku), str(row["warehouse"]))] = equal_share
        else:
            for row in rows:
                inventory_shares[(str(sku), str(row["warehouse"]))] = max(0.0, float(row["quantity_on_hand"]) / total)

    if orders.empty or not {"sku", "quantity"}.issubset(orders.columns):
        return inventory_shares

    if "warehouse" in orders.columns:
        exact_orders = orders.copy()
        exact_orders["quantity"] = pd.to_numeric(exact_orders["quantity"], errors="coerce").fillna(0)
        demand_by_group = (
            exact_orders.assign(sku=exact_orders["sku"].astype(str), warehouse=exact_orders["warehouse"].astype(str))
            .groupby(["sku", "warehouse"])["quantity"]
            .sum()
            .reset_index()
        )
        demand_shares: Dict[tuple[str, str], float] = {}
        for sku, group in demand_by_group.groupby("sku"):
            known = set(sku_warehouses.get(str(sku), []))
            group = group[group["warehouse"].isin(known)] if known else group
            total = float(group["quantity"].sum())
            if total <= 0:
                continue
            for row in group.to_dict("records"):
                demand_shares[(str(sku), str(row["warehouse"]))] = float(row["quantity"]) / total
        return {**inventory_shares, **demand_shares}

    if customers is None or customers.empty or not {"customer_id", "region"}.issubset(customers.columns) or "customer_id" not in orders.columns:
        return inventory_shares

    customer_regions = customers[["customer_id", "region"]].copy()
    customer_regions["customer_id"] = customer_regions["customer_id"].astype(str)
    enriched = orders[["customer_id", "sku", "quantity"]].copy()
    enriched["customer_id"] = enriched["customer_id"].astype(str)
    enriched["sku"] = enriched["sku"].astype(str)
    enriched["quantity"] = enriched["quantity"].fillna(0).astype(float)
    enriched = enriched.merge(customer_regions, on="customer_id", how="left")

    allocated: Dict[tuple[str, str], float] = {}
    for row in enriched.to_dict("records"):
        sku = str(row["sku"])
        quantity = max(0.0, float(row.get("quantity", 0) or 0))
        warehouses = sku_warehouses.get(sku, [])
        if quantity <= 0 or not warehouses:
            continue
        region = str(row.get("region") or "")
        region_weights = REGION_WAREHOUSE_WEIGHTS.get(region, {})
        matched = [(warehouse, float(region_weights[warehouse])) for warehouse in warehouses if warehouse in region_weights]
        if not matched:
            matched = [(warehouse, inventory_shares.get((sku, warehouse), 0.0)) for warehouse in warehouses]
        total_weight = sum(weight for _, weight in matched)
        if total_weight <= 0:
            matched = [(warehouse, 1.0) for warehouse in warehouses]
            total_weight = float(len(matched))
        for warehouse, weight in matched:
            allocated[(sku, warehouse)] = allocated.get((sku, warehouse), 0.0) + quantity * (weight / total_weight)

    if not allocated:
        return inventory_shares

    totals_by_sku: Dict[str, float] = {}
    for (sku, _warehouse), quantity in allocated.items():
        totals_by_sku[sku] = totals_by_sku.get(sku, 0.0) + quantity

    demand_shares = dict(inventory_shares)
    for (sku, warehouse), quantity in allocated.items():
        total = totals_by_sku.get(sku, 0.0)
        if total > 0:
            demand_shares[(sku, warehouse)] = quantity / total
    return demand_shares


def _confidence(nonzero_days: int, avg_daily_demand: float, demand_std: float) -> tuple[float, str]:
    if avg_daily_demand <= 0:
        return 0.55, "Low confidence: no recent demand is visible for this SKU."

    coverage_score = min(0.3, nonzero_days / 240.0)
    variability_ratio = demand_std / max(avg_daily_demand, 1)
    variability_penalty = min(0.12, variability_ratio * 0.04)
    value = round(max(0.5, min(0.94, 0.58 + coverage_score - variability_penalty)), 2)

    if nonzero_days >= 120 and variability_ratio < 2:
        reason = "High confidence: demand history is broad and recent variability is manageable."
    elif nonzero_days >= 45:
        reason = "Medium confidence: demand history is usable, but variability or sparse order days should be reviewed."
    else:
        reason = "Lower confidence: limited recent order frequency; planner review is recommended before committing."
    return value, reason


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
    demand_share: float = 1.0,
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
        avg_unit_cost = float(inv["unit_cost"].fillna(0).astype(float).mean()) if "unit_cost" in inv.columns else 0.0
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
        avg_unit_cost = 0.0

    series = daily_demand_series(orders, sku=sku, as_of=today, history_days=365) * max(0.0, demand_share)
    recent = series.tail(90)
    avg_daily_demand = float(recent.mean()) if not recent.empty else 0.0
    demand_std = float(np.std(recent.to_numpy(), ddof=0)) if len(recent) else 0.0

    inbound_lead = _filter_inbound(
        inbound_shipments,
        sku,
        today,
        today + timedelta(days=lead_time_days),
        warehouse=warehouse,
        allocation_share=demand_share,
    )
    inbound_target = _filter_inbound(
        inbound_shipments,
        sku,
        today,
        today + timedelta(days=lead_time_days + review_period_days),
        warehouse=warehouse,
        allocation_share=demand_share,
    )

    safety_stock = service_level_z * demand_std * sqrt(max(lead_time_days, 1))
    lead_time_demand = avg_daily_demand * lead_time_days
    reorder_point = avg_daily_demand * lead_time_days + safety_stock
    target_stock = avg_daily_demand * (lead_time_days + review_period_days) + safety_stock
    net_position = usable_inventory + inbound_lead
    target_position = usable_inventory + inbound_target
    effective_position = max(0.0, float(net_position - expiring_before_lead))
    recommended_qty = int(ceil(max(0.0, target_stock - target_position)))
    net_days_of_supply = None if avg_daily_demand <= 0 else round(float(net_position / avg_daily_demand), 1)
    effective_days_of_supply = None if avg_daily_demand <= 0 else round(float(effective_position / avg_daily_demand), 1)

    confidence, confidence_reason = _confidence(int((series > 0).sum()), avg_daily_demand, demand_std)
    action = "Review next cycle."
    days_of_supply = net_days_of_supply

    if avg_daily_demand <= 0:
        status = "overstocked" if usable_inventory > 0 else "wait"
        recommended_qty = 0
        reason = (
            "No recent demand is visible for this SKU, so avoid replenishment and review whether existing stock "
            "should be promoted, transferred, or delisted."
        )
        action = "Hold replenishment and review slow-moving inventory."
        reorder_by = today + timedelta(days=review_period_days)
    elif usable_inventory <= 0:
        status = "stockout risk"
        recommended_qty = max(recommended_qty, int(ceil(lead_time_demand + safety_stock)))
        reason = (
            "Stockout risk because usable inventory is zero while recent average demand is %.2f units/day "
            "and supplier lead time is %s days."
        ) % (avg_daily_demand, lead_time_days)
        action = "Place replenishment order and review transfer or expedite options."
        days_of_supply = 0.0
        reorder_by = today
    elif effective_position < lead_time_demand:
        status = "stockout risk"
        recommended_qty = max(recommended_qty, int(ceil(lead_time_demand + safety_stock - effective_position)))
        reason = (
            "Stockout risk due to %s-day ocean freight lead time: effective inventory %.0f is below lead-time "
            "demand %.0f after excluding %s units expiring before replenishment."
        ) % (lead_time_days, effective_position, lead_time_demand, expiring_before_lead)
        action = "Order replenishment and prioritize allocation until inbound supply arrives."
        days_of_supply = effective_days_of_supply
        reorder_by = today
    elif net_position <= reorder_point:
        status = "reorder now"
        recommended_qty = max(recommended_qty, int(ceil(reorder_point - net_position)))
        reason = (
            "Reorder now because inventory position %.0f is at or below reorder point %.0f "
            "(average daily demand %.2f plus safety stock %.0f)."
        ) % (net_position, reorder_point, avg_daily_demand, safety_stock)
        action = "Place replenishment order this week."
        reorder_by = today
    elif expiring_within_90 > max(avg_daily_demand * 30, 1) and net_days_of_supply and net_days_of_supply > 90:
        status = "overstocked"
        recommended_qty = 0
        reason = (
            "Overstocked: %.1f days of supply and %s units expire within 90 days, so reduce inbound buying "
            "and prioritize FEFO allocation."
        ) % (net_days_of_supply, expiring_within_90)
        action = "Pause buying and move older lots through transfer, promotion, or discount."
        reorder_by = today + timedelta(days=review_period_days)
    else:
        status = "wait"
        reason = (
            "Wait because inventory position %.0f covers the %s-day lead time plus safety stock; next review "
            "should happen before projected days of supply falls below lead time."
        ) % (net_position, lead_time_days)
        action = "No buy this week; monitor inbound and demand."
        days_until_reorder = max(0, int((net_days_of_supply or lead_time_days) - lead_time_days))
        reorder_by = today + timedelta(days=min(days_until_reorder, review_period_days))

    return {
        "sku": str(sku),
        "warehouse": str(warehouse),
        "status": status,
        "recommended_order_qty": recommended_qty,
        "estimated_order_value": round(recommended_qty * avg_unit_cost, 2),
        "unit_cost": round(avg_unit_cost, 2),
        "reorder_by_date": reorder_by.isoformat(),
        "action": action,
        "reason": reason,
        "confidence": confidence,
        "confidence_reason": confidence_reason,
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
    customers: Optional[pd.DataFrame] = None,
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
    demand_shares = _warehouse_demand_shares(inventory_lots, orders, customers)
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
                    demand_share=demand_shares.get((sku, warehouse), 1.0),
                )
            )

    priority = {"stockout risk": 0, "reorder now": 1, "wait": 2, "overstocked": 3}
    return sorted(results, key=lambda item: (priority.get(str(item["status"]), 9), item["sku"], item["warehouse"]))
