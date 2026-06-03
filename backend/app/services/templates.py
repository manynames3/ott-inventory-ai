from __future__ import annotations

from io import BytesIO
from typing import Dict, List

import pandas as pd

from app.adapters.base import REQUIRED_COLUMNS


SAMPLE_ROWS: Dict[str, List[dict]] = {
    "products": [
        {
            "sku": "08252K",
            "name": "Ottogi Jin Ramen Hot Case",
            "category": "Noodles",
            "case_size": 24,
            "shelf_life_days": 270,
        }
    ],
    "inventory_lots": [
        {
            "lot_id": "LOT-LA-240601-001",
            "sku": "08252K",
            "warehouse": "LA DC",
            "quantity_on_hand": 840,
            "received_date": "2026-04-15",
            "expiration_date": "2026-08-30",
            "unit_cost": 18.75,
        }
    ],
    "customers": [
        {
            "customer_id": "CUST-HMART-WEST",
            "name": "H Mart West",
            "region": "West",
            "channel": "Retail",
        }
    ],
    "orders": [
        {
            "order_id": "ORD-20260531-001",
            "customer_id": "CUST-HMART-WEST",
            "order_date": "2026-05-31",
            "sku": "08252K",
            "quantity": 120,
        }
    ],
    "inbound_shipments": [
        {
            "shipment_id": "INB-BUSAN-001",
            "sku": "08252K",
            "quantity": 1800,
            "eta_date": "2026-06-28",
            "origin": "Busan",
            "status": "in_transit",
        }
    ],
}


def template_dataframe(entity: str) -> pd.DataFrame:
    if entity not in REQUIRED_COLUMNS:
        raise KeyError(entity)
    return pd.DataFrame(SAMPLE_ROWS[entity], columns=REQUIRED_COLUMNS[entity])


def csv_template(entity: str) -> bytes:
    return template_dataframe(entity).to_csv(index=False).encode("utf-8")


def xlsx_template(entity: str) -> bytes:
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        template_dataframe(entity).to_excel(writer, sheet_name=entity[:31], index=False)
    return buffer.getvalue()


def next_questions(entity: str) -> List[str]:
    questions = {
        "products": ["Which SKUs have the shortest shelf life?", "What categories carry the most expiration risk?"],
        "inventory_lots": ["Which inventory expires soon?", "Which lots should ship first?"],
        "customers": ["Who needs another order right now?", "Which customers buy 08252K every month?"],
        "orders": ["Which SKUs will stock out in the next 30 days?", "What should we reorder this week?"],
        "inbound_shipments": ["Which inbound shipments arrive after projected stockout?", "What should we reorder this week?"],
    }
    return questions.get(entity, ["What should we reorder this week?"])
