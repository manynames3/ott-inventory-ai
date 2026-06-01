from __future__ import annotations

from typing import Dict, Type

import pandas as pd
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import Session

from app.models import Customer, CustomerOrder, InboundShipment, InventoryLot, Product


TABLE_MODELS: Dict[str, Type] = {
    "products": Product,
    "inventory_lots": InventoryLot,
    "customers": Customer,
    "orders": CustomerOrder,
    "inbound_shipments": InboundShipment,
}


def model_to_dataframe(session: Session, model: Type) -> pd.DataFrame:
    rows = session.query(model).all()
    columns = [column.key for column in inspect(model).mapper.column_attrs]
    return pd.DataFrame([{column: getattr(row, column) for column in columns} for row in rows], columns=columns)


def load_core_dataframes(session: Session) -> Dict[str, pd.DataFrame]:
    return {name: model_to_dataframe(session, model) for name, model in TABLE_MODELS.items()}

