from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Dict, List

import pandas as pd
from sqlalchemy.orm import Session

from app.services.ai_query import augment_query_answer
from app.services.dataframes import load_core_dataframes
from app.services.fefo import waste_risk_alerts
from app.services.product_context import enrich_product_rows
from app.services.reorder import generate_reorder_recommendations


SKU_PATTERN = re.compile(r"\b(?:(?:UPC|EAN)-\d{8,14}|[A-Z]{2,5}(?:-[A-Z0-9]{2,12})+|\d{4,8}[A-Z])\b")


def _summary(template: str, rows: List[Dict[str, object]]) -> List[str]:
    if not rows:
        return ["No immediate action rows matched this question in the current dataset."]
    first = rows[0]
    if template == "stockout_risk":
        return [
            f"{len(rows)} SKU/warehouse combinations need action now.",
            f"Highest priority: {first.get('sku')} {first.get('product_name', '')} in {first.get('warehouse')} with {first.get('days_of_supply', '—')} days of supply.",
            "Review transfer, expedite, and order placement before normal replenishment lead time closes."
        ]
    if template == "reorder_this_week":
        return [
            f"{len(rows)} replenishment actions are due this week.",
            f"Top buy: {first.get('sku')} {first.get('product_name', '')} for {first.get('warehouse')} at {first.get('recommended_order_qty')} cases.",
            "Quantities include lead-time demand, safety stock, inbound supply, and expiration risk."
        ]
    if template == "expiring_inventory":
        return [
            f"{len(rows)} lots are inside the 90-day expiration action window.",
            f"Oldest priority: lot {first.get('lot_id')} for {first.get('sku')} {first.get('product_name', '')} in {first.get('warehouse')}.",
            "Use FEFO allocation, transfer, promotion, or discount before newer lots ship."
        ]
    if template == "customer_reorder_cadence":
        return [
            f"{len(rows)} customers appear past normal reorder cadence.",
            f"Start with {first.get('name', first.get('customer_id'))}; last order was {first.get('days_since_last_order')} days ago.",
            "Use this as a sales follow-up queue, not an automatic order."
        ]
    if template == "monthly_sku_buyers":
        return [
            f"{len(rows)} customers show recurring monthly demand for this SKU.",
            f"Top recurring buyer: {first.get('name', first.get('customer_id'))}.",
            "Use this list to protect allocation when supply is constrained."
        ]
    return [f"{len(rows)} matching rows returned."]


def _serialize(rows: List[Dict[str, object]]) -> List[Dict[str, object]]:
    output = []
    for row in rows:
        next_row = {}
        for key, value in row.items():
            if hasattr(value, "isoformat"):
                next_row[key] = value.isoformat()
            elif pd.isna(value) if not isinstance(value, (list, dict)) else False:
                next_row[key] = None
            else:
                next_row[key] = value
        output.append(next_row)
    return output


def _customers_due_for_order(data: Dict[str, pd.DataFrame]) -> Dict[str, object]:
    today = date.today()
    orders = data["orders"].copy()
    customers = data["customers"].copy()
    if orders.empty:
        return {
            "template": "customer_reorder_cadence",
            "explanation": "No historical orders are available yet, so customer reorder cadence cannot be inferred.",
            "columns": [],
            "rows": [],
        }

    orders["order_date"] = pd.to_datetime(orders["order_date"])
    rows = []
    for customer_id, group in orders.sort_values("order_date").groupby("customer_id"):
        dates = group["order_date"].drop_duplicates().sort_values()
        last_order = dates.max().date()
        days_since = (today - last_order).days
        diffs = dates.diff().dt.days.dropna()
        avg_interval = float(diffs.mean()) if not diffs.empty else 30.0
        due_threshold = max(21.0, avg_interval * 1.2)
        if days_since >= due_threshold:
            rows.append(
                {
                    "customer_id": customer_id,
                    "last_order_date": last_order,
                    "days_since_last_order": days_since,
                    "avg_days_between_orders": round(avg_interval, 1),
                    "reason": "Customer is past its normal reorder cadence.",
                }
            )

    result = pd.DataFrame(rows)
    if result.empty:
        return {
            "template": "customer_reorder_cadence",
            "explanation": "No customers are currently past their normal reorder cadence.",
            "columns": ["customer_id", "last_order_date", "days_since_last_order", "avg_days_between_orders", "reason"],
            "rows": [],
        }

    if not customers.empty:
        result = result.merge(customers, on="customer_id", how="left")
    result = result.sort_values("days_since_last_order", ascending=False).head(25)
    columns = [
        "customer_id",
        "name",
        "region",
        "channel",
        "last_order_date",
        "days_since_last_order",
        "avg_days_between_orders",
        "reason",
    ]
    columns = [column for column in columns if column in result.columns]
    return {
        "template": "customer_reorder_cadence",
        "explanation": "These customers appear due for another order based on their historical buying cadence.",
        "columns": columns,
        "rows": _serialize(result[columns].to_dict("records")),
    }


def _stockout_risk(data: Dict[str, pd.DataFrame], lead_time_days: int) -> Dict[str, object]:
    today = date.today()
    products = data["products"]
    inventory = data["inventory_lots"]
    recommendations = generate_reorder_recommendations(
        inventory_lots=inventory,
        orders=data["orders"],
        inbound_shipments=data["inbound_shipments"],
        customers=data["customers"],
        skus=products["sku"].tolist() if not products.empty else None,
        as_of=today,
        lead_time_days=lead_time_days,
    )
    rows = enrich_product_rows([
        rec
        for rec in recommendations
        if rec["status"] in {"stockout risk", "reorder now"} and rec["reorder_by_date"] <= today.isoformat()
    ][:25], products)
    columns = [
        "sku",
        "product_name",
        "category",
        "warehouse",
        "status",
        "recommended_order_qty",
        "estimated_order_value",
        "reorder_by_date",
        "days_of_supply",
        "action",
        "reason",
        "confidence",
        "confidence_reason",
    ]
    return {
        "template": "stockout_risk",
        "explanation": "These SKU and warehouse combinations are projected to need action based on demand, lead time, inbound supply, and current inventory.",
        "action_summary": _summary("stockout_risk", rows),
        "columns": columns,
        "rows": rows,
    }


def _expiring_inventory(data: Dict[str, pd.DataFrame]) -> Dict[str, object]:
    alerts = enrich_product_rows(waste_risk_alerts(data["inventory_lots"], as_of=date.today(), horizon_days=90), data["products"])
    columns = [
        "sku",
        "product_name",
        "category",
        "lot_id",
        "warehouse",
        "quantity_at_risk",
        "at_risk_value",
        "expiration_date",
        "risk_bucket",
        "suggested_action",
    ]
    return {
        "template": "expiring_inventory",
        "explanation": "These lots expire within 90 days and should be prioritized before newer inventory.",
        "action_summary": _summary("expiring_inventory", alerts[:50]),
        "columns": columns,
        "rows": alerts[:50],
    }


def _monthly_buyers_for_sku(data: Dict[str, pd.DataFrame], sku: str) -> Dict[str, object]:
    orders = data["orders"].copy()
    customers = data["customers"].copy()
    if orders.empty:
        return {
            "template": "monthly_sku_buyers",
            "explanation": f"No orders are available for {sku}.",
            "columns": [],
            "rows": [],
        }

    orders = orders[orders["sku"].astype(str) == sku].copy()
    if orders.empty:
        return {
            "template": "monthly_sku_buyers",
            "explanation": f"No customer has ordered {sku} in the loaded history.",
            "columns": [],
            "rows": [],
        }

    orders["order_date"] = pd.to_datetime(orders["order_date"])
    orders["month"] = orders["order_date"].dt.to_period("M").astype(str)
    total_months = max(1, orders["month"].nunique())
    grouped = (
        orders.groupby("customer_id")
        .agg(
            months_with_orders=("month", "nunique"),
            total_quantity=("quantity", "sum"),
            last_order_date=("order_date", "max"),
        )
        .reset_index()
    )
    grouped["monthly_coverage"] = grouped["months_with_orders"] / total_months
    grouped["avg_monthly_quantity"] = grouped["total_quantity"] / grouped["months_with_orders"]
    grouped = grouped[grouped["monthly_coverage"] >= 0.45]
    if not customers.empty:
        grouped = grouped.merge(customers, on="customer_id", how="left")
    grouped = grouped.sort_values(["monthly_coverage", "avg_monthly_quantity"], ascending=False).head(25)

    columns = [
        "customer_id",
        "name",
        "region",
        "channel",
        "months_with_orders",
        "monthly_coverage",
        "avg_monthly_quantity",
        "last_order_date",
    ]
    columns = [column for column in columns if column in grouped.columns]
    return {
        "template": "monthly_sku_buyers",
        "explanation": f"Customers shown here buy {sku} with recurring monthly behavior in the loaded order history.",
        "columns": columns,
        "rows": _serialize(grouped[columns].to_dict("records")),
    }


def _reorder_this_week(data: Dict[str, pd.DataFrame], lead_time_days: int) -> Dict[str, object]:
    today = date.today()
    products = data["products"]
    recs = generate_reorder_recommendations(
        inventory_lots=data["inventory_lots"],
        orders=data["orders"],
        inbound_shipments=data["inbound_shipments"],
        customers=data["customers"],
        skus=products["sku"].tolist() if not products.empty else None,
        as_of=today,
        lead_time_days=lead_time_days,
    )
    rows = enrich_product_rows([
        rec
        for rec in recs
        if rec["recommended_order_qty"] > 0
        and pd.to_datetime(rec["reorder_by_date"]).date() <= today + timedelta(days=7)
    ][:25], products)
    columns = [
        "sku",
        "product_name",
        "category",
        "warehouse",
        "status",
        "recommended_order_qty",
        "estimated_order_value",
        "reorder_by_date",
        "action",
        "reason",
        "confidence",
        "confidence_reason",
    ]
    return {
        "template": "reorder_this_week",
        "explanation": "These replenishment actions are due within the next 7 days based on stock position and lead-time demand.",
        "action_summary": _summary("reorder_this_week", rows),
        "columns": columns,
        "rows": rows,
    }


def answer_question(session: Session, question: str, lead_time_days: int) -> Dict[str, object]:
    text = question.strip()
    normalized = text.lower()
    data = load_core_dataframes(session)

    sku_match = SKU_PATTERN.search(text.upper())
    if sku_match and "customer" in normalized and "buy" in normalized:
        answer = _monthly_buyers_for_sku(data, sku_match.group(0))
    elif "who" in normalized and ("another order" in normalized or "needs" in normalized):
        answer = _customers_due_for_order(data)
    elif "stock out" in normalized or "stockout" in normalized:
        answer = _stockout_risk(data, lead_time_days)
    elif "expires" in normalized or "expir" in normalized:
        answer = _expiring_inventory(data)
    elif "reorder" in normalized or "order this week" in normalized:
        answer = _reorder_this_week(data, lead_time_days)
    else:
        answer = {
            "template": "unsupported",
            "explanation": (
                "I can answer operational inventory questions using safe predefined templates. Try: "
                "'Which SKUs will stock out in the next 30 days?', 'Which inventory expires soon?', "
                "'Which customers usually buy SKU 08252K every month?', or 'What should we reorder this week?'"
            ),
            "columns": [],
            "rows": [],
        }

    answer["question"] = question
    answer["safe_query_mode"] = "rule_based_templates_only"
    answer.setdefault("action_summary", _summary(str(answer.get("template", "")), answer.get("rows", [])))
    return augment_query_answer(question, answer)
