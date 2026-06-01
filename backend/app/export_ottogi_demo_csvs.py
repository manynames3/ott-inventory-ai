from __future__ import annotations

import csv
import os
from pathlib import Path
from typing import Any, Iterable

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")

from app import seed_ottogi_demo as demo


ENTITY_FIELDS = {
    "products": ["sku", "name", "category", "case_size", "shelf_life_days"],
    "inventory_lots": [
        "lot_id",
        "sku",
        "warehouse",
        "quantity_on_hand",
        "received_date",
        "expiration_date",
        "unit_cost",
    ],
    "customers": ["customer_id", "name", "region", "channel"],
    "orders": ["order_id", "customer_id", "order_date", "sku", "quantity"],
    "inbound_shipments": ["shipment_id", "sku", "quantity", "eta_date", "origin", "status"],
}


def _value(row: Any, field: str) -> Any:
    value = getattr(row, field)
    return value.isoformat() if hasattr(value, "isoformat") else value


def _write_csv(path: Path, fields: list[str], rows: Iterable[Any]) -> int:
    count = 0
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: _value(row, field) for field in fields})
            count += 1
    return count


def export(output_dir: Path = Path("sample_data/ottogi_demo")) -> dict[str, int]:
    demo.random.seed(87)
    products = demo.build_products()
    customers = demo.build_customers()
    orders = demo.build_orders(products, customers)
    lots = demo.build_inventory_lots(products)
    inbound = demo.build_inbound_shipments(products)

    output_dir.mkdir(parents=True, exist_ok=True)
    datasets = {
        "products": products,
        "inventory_lots": lots,
        "customers": customers,
        "orders": orders,
        "inbound_shipments": inbound,
    }
    return {
        entity: _write_csv(output_dir / f"{entity}.csv", ENTITY_FIELDS[entity], rows)
        for entity, rows in datasets.items()
    }


if __name__ == "__main__":
    summary = export()
    print(f"Exported Ottogi-style demo CSVs: {summary}")
