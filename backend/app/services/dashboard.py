from __future__ import annotations

from datetime import date, timedelta
from typing import Dict, List

import pandas as pd
from sqlalchemy.orm import Session

from app.services.dataframes import load_core_dataframes
from app.services.fefo import expiration_bucket_summary, recommend_fefo, waste_risk_alerts
from app.services.forecasting import ForecastEngine
from app.services.reorder import generate_reorder_recommendations


def _jsonify_rows(rows: List[Dict[str, object]]) -> List[Dict[str, object]]:
    normalized = []
    for row in rows:
        next_row = {}
        for key, value in row.items():
            if hasattr(value, "isoformat"):
                next_row[key] = value.isoformat()
            elif pd.isna(value) if not isinstance(value, (list, dict)) else False:
                next_row[key] = None
            else:
                next_row[key] = value
        normalized.append(next_row)
    return normalized


def _demand_trend(orders: pd.DataFrame, max_skus: int = 5) -> List[Dict[str, object]]:
    if orders.empty:
        return []

    df = orders.copy()
    df["order_date"] = pd.to_datetime(df["order_date"])
    cutoff = df["order_date"].max() - pd.DateOffset(months=12)
    df = df[df["order_date"] >= cutoff]
    if df.empty:
        return []

    top_skus = df.groupby("sku")["quantity"].sum().sort_values(ascending=False).head(max_skus).index.tolist()
    df["month"] = df["order_date"].dt.strftime("%Y-%m")
    grouped = df[df["sku"].isin(top_skus)].groupby(["sku", "month"])["quantity"].sum().reset_index()

    results = []
    for sku in top_skus:
        rows = grouped[grouped["sku"] == sku].sort_values("month")
        results.append(
            {
                "sku": sku,
                "points": [
                    {"label": row["month"], "value": int(row["quantity"])}
                    for _, row in rows.iterrows()
                ],
            }
        )
    return results


def build_dashboard(session: Session, lead_time_days: int) -> Dict[str, object]:
    today = date.today()
    data = load_core_dataframes(session)
    products = data["products"]
    inventory = data["inventory_lots"]
    orders = data["orders"]
    inbound = data["inbound_shipments"]

    if inventory.empty:
        return {
            "kpis": {
                "total_inventory_value": 0,
                "inventory_at_risk_value": 0,
                "projected_stockouts": 0,
                "recommended_reorder_value": 0,
                "waste_reduction_opportunity": 0,
            },
            "charts": {
                "demand_trend_by_sku": [],
                "inventory_by_expiration_bucket": [],
                "reorder_urgency": [],
            },
            "recommendations": [],
            "fefo": [],
            "waste_risk_alerts": [],
        }

    inventory = inventory.copy()
    inventory["quantity_on_hand"] = inventory["quantity_on_hand"].fillna(0).astype(int)
    inventory["unit_cost"] = inventory["unit_cost"].fillna(0).astype(float)
    inventory["expiration_date"] = pd.to_datetime(inventory["expiration_date"]).dt.date
    inventory_value = float((inventory["quantity_on_hand"] * inventory["unit_cost"]).sum())

    at_risk_inventory = inventory[
        (inventory["quantity_on_hand"] > 0)
        & (inventory["expiration_date"] >= today)
        & (inventory["expiration_date"] <= today + timedelta(days=90))
    ]
    at_risk_value = float((at_risk_inventory["quantity_on_hand"] * at_risk_inventory["unit_cost"]).sum())

    skus = products["sku"].tolist() if not products.empty else sorted(inventory["sku"].astype(str).unique())
    recommendations = generate_reorder_recommendations(
        inventory_lots=inventory,
        orders=orders,
        inbound_shipments=inbound,
        skus=skus,
        as_of=today,
        lead_time_days=lead_time_days,
    )

    unit_cost_by_sku = inventory.groupby("sku")["unit_cost"].mean().to_dict()
    reorder_value = sum(
        float(rec["recommended_order_qty"]) * float(unit_cost_by_sku.get(rec["sku"], 0))
        for rec in recommendations
    )
    stockouts = len([rec for rec in recommendations if rec["status"] == "stockout risk"])

    urgency_counts = pd.Series([rec["status"] for rec in recommendations]).value_counts().to_dict()
    reorder_urgency = [{"status": key, "count": int(value)} for key, value in urgency_counts.items()]

    alerts = waste_risk_alerts(inventory, as_of=today, horizon_days=90)
    fefo = recommend_fefo(inventory, as_of=today)

    return {
        "kpis": {
            "total_inventory_value": round(inventory_value, 2),
            "inventory_at_risk_value": round(at_risk_value, 2),
            "projected_stockouts": stockouts,
            "recommended_reorder_value": round(reorder_value, 2),
            "waste_reduction_opportunity": round(at_risk_value * 0.35, 2),
        },
        "charts": {
            "demand_trend_by_sku": _demand_trend(orders),
            "inventory_by_expiration_bucket": expiration_bucket_summary(inventory, as_of=today),
            "reorder_urgency": reorder_urgency,
        },
        "recommendations": recommendations[:20],
        "fefo": fefo[:20],
        "waste_risk_alerts": alerts[:20],
        "roi_explanation": (
            "Waste reduction opportunity estimates 35% recoverable value from near-expiring inventory through "
            "FEFO allocation, transfer, promotion, or discount actions."
        ),
    }


def build_sku_detail(session: Session, sku: str, lead_time_days: int) -> Dict[str, object]:
    today = date.today()
    data = load_core_dataframes(session)
    products = data["products"]
    inventory = data["inventory_lots"]
    orders = data["orders"]
    inbound = data["inbound_shipments"]

    product_rows = products[products["sku"].astype(str) == sku].to_dict("records") if not products.empty else []
    sku_inventory = inventory[inventory["sku"].astype(str) == sku].copy() if not inventory.empty else inventory
    sku_inbound = inbound[inbound["sku"].astype(str) == sku].copy() if not inbound.empty else inbound
    sku_orders = orders[orders["sku"].astype(str) == sku].copy() if not orders.empty else orders
    warehouses = sorted(sku_inventory["warehouse"].astype(str).unique()) if not sku_inventory.empty else []

    forecast = ForecastEngine().forecast_sku(orders, sku=sku, as_of=today)
    recs = generate_reorder_recommendations(
        inventory_lots=sku_inventory,
        orders=orders,
        inbound_shipments=inbound,
        skus=[sku],
        warehouses=warehouses,
        as_of=today,
        lead_time_days=lead_time_days,
    )

    return {
        "product": _jsonify_rows(product_rows)[0] if product_rows else None,
        "inventory_lots": _jsonify_rows(sku_inventory.sort_values("expiration_date").to_dict("records"))
        if not sku_inventory.empty
        else [],
        "inbound_shipments": _jsonify_rows(sku_inbound.sort_values("eta_date").to_dict("records"))
        if not sku_inbound.empty
        else [],
        "forecast": forecast,
        "reorder_recommendations": recs,
        "fefo": recommend_fefo(sku_inventory, as_of=today) if not sku_inventory.empty else [],
        "demand_trend": _demand_trend(sku_orders, max_skus=1),
    }


def build_customer_detail(session: Session, customer_id: str) -> Dict[str, object]:
    data = load_core_dataframes(session)
    customers = data["customers"]
    orders = data["orders"]
    products = data["products"]

    customer_rows = (
        customers[customers["customer_id"].astype(str) == customer_id].to_dict("records")
        if not customers.empty
        else []
    )
    customer_orders = orders[orders["customer_id"].astype(str) == customer_id].copy() if not orders.empty else orders
    if customer_orders.empty:
        return {
            "customer": _jsonify_rows(customer_rows)[0] if customer_rows else None,
            "summary": {"total_orders": 0, "total_units": 0},
            "top_skus": [],
            "monthly_trend": [],
        }

    customer_orders["order_date"] = pd.to_datetime(customer_orders["order_date"])
    customer_orders["month"] = customer_orders["order_date"].dt.strftime("%Y-%m")
    top = (
        customer_orders.groupby("sku")["quantity"]
        .sum()
        .sort_values(ascending=False)
        .head(10)
        .reset_index()
    )
    if not products.empty:
        top = top.merge(products[["sku", "name", "category"]], on="sku", how="left")

    monthly = customer_orders.groupby("month")["quantity"].sum().reset_index().sort_values("month")
    return {
        "customer": _jsonify_rows(customer_rows)[0] if customer_rows else None,
        "summary": {
            "total_orders": int(customer_orders["order_id"].nunique()),
            "total_units": int(customer_orders["quantity"].sum()),
            "last_order_date": customer_orders["order_date"].max().date().isoformat(),
        },
        "top_skus": _jsonify_rows(top.to_dict("records")),
        "monthly_trend": [
            {"label": row["month"], "value": int(row["quantity"])}
            for _, row in monthly.iterrows()
        ],
    }
