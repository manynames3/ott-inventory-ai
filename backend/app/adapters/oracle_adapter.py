from __future__ import annotations

from typing import Dict, List

from app.adapters.base import REQUIRED_COLUMNS, InventoryImportAdapter


class OracleERPAdapter(InventoryImportAdapter):
    """Placeholder for future Oracle ERP integration."""

    def required_columns(self) -> Dict[str, List[str]]:
        return REQUIRED_COLUMNS

    def connect(self):
        raise NotImplementedError("Oracle ERP live connector is intentionally not implemented in the MVP.")

