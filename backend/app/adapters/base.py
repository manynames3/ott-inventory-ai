from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List


REQUIRED_COLUMNS: Dict[str, List[str]] = {
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


@dataclass
class ImportResult:
    entity: str
    rows_seen: int = 0
    rows_imported: int = 0
    errors: List[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors


class InventoryImportAdapter(ABC):
    @abstractmethod
    def required_columns(self) -> Dict[str, List[str]]:
        raise NotImplementedError

