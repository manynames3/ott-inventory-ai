from __future__ import annotations

from typing import Dict, List

from app.adapters.base import REQUIRED_COLUMNS, InventoryImportAdapter


class SAPAdapter(InventoryImportAdapter):
    """Placeholder for future SAP integration.

    MVP scope intentionally avoids live SAP credentials or network calls. The
    expected field contract is documented in docs/erp_integration.md.
    """

    def required_columns(self) -> Dict[str, List[str]]:
        return REQUIRED_COLUMNS

    def connect(self):
        raise NotImplementedError("SAP live connector is intentionally not implemented in the MVP.")

