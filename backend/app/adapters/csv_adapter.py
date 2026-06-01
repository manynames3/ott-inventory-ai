from __future__ import annotations

from datetime import date
from io import BytesIO
from pathlib import Path
from typing import Dict, List

import pandas as pd
from sqlalchemy.orm import Session

from app.adapters.base import REQUIRED_COLUMNS, ImportResult, InventoryImportAdapter
from app.models import Customer, CustomerOrder, InboundShipment, InventoryLot, Product


MODEL_MAP = {
    "products": Product,
    "inventory_lots": InventoryLot,
    "customers": Customer,
    "orders": CustomerOrder,
    "inbound_shipments": InboundShipment,
}

DATE_COLUMNS = {
    "inventory_lots": ["received_date", "expiration_date"],
    "orders": ["order_date"],
    "inbound_shipments": ["eta_date"],
}

INTEGER_COLUMNS = {
    "products": ["case_size", "shelf_life_days"],
    "inventory_lots": ["quantity_on_hand"],
    "orders": ["quantity"],
    "inbound_shipments": ["quantity"],
}

FLOAT_COLUMNS = {
    "inventory_lots": ["unit_cost"],
}


class CSVImportAdapter(InventoryImportAdapter):
    def required_columns(self) -> Dict[str, List[str]]:
        return REQUIRED_COLUMNS

    def load_csv(self, entity: str, file_obj) -> ImportResult:
        try:
            content = file_obj.read()
        except Exception as exc:
            result = ImportResult(entity=entity)
            result.errors.append(f"Could not read upload: {exc}")
            return result
        return self.load_file(entity, "upload.csv", content)

    def load_file(self, entity: str, filename: str, content: bytes) -> ImportResult:
        result = ImportResult(entity=entity)
        if entity not in REQUIRED_COLUMNS:
            result.errors.append(f"Unsupported import entity '{entity}'.")
            return result

        suffix = Path(filename).suffix.lower()
        try:
            if suffix == ".csv" or not suffix:
                df = pd.read_csv(BytesIO(content))
            elif suffix in {".xlsx", ".xlsm"}:
                df = pd.read_excel(BytesIO(content), engine="openpyxl")
            elif suffix == ".xls":
                result.errors.append("Legacy .xls files are not supported. Save the workbook as .xlsx or CSV.")
                return result
            else:
                result.errors.append("Unsupported file type. Upload a .csv or .xlsx file.")
                return result
        except Exception as exc:
            result.errors.append(f"Could not read {suffix or 'uploaded'} file: {exc}")
            return result

        result.rows_seen = len(df)
        missing = [column for column in REQUIRED_COLUMNS[entity] if column not in df.columns]
        if missing:
            result.errors.append("Missing required columns: " + ", ".join(missing))
            return result

        normalized, errors = self.normalize(entity, df)
        result.errors.extend(errors)
        if result.errors:
            return result

        result.rows_seen = len(normalized)
        result.rows_imported = len(normalized)
        result.dataframe = normalized  # type: ignore[attr-defined]
        return result

    def normalize(self, entity: str, df: pd.DataFrame):
        errors: List[str] = []
        normalized = df[REQUIRED_COLUMNS[entity]].copy()
        normalized = normalized.where(pd.notnull(normalized), None)

        for column in DATE_COLUMNS.get(entity, []):
            try:
                normalized[column] = pd.to_datetime(normalized[column]).dt.date
            except Exception as exc:
                errors.append(f"Column '{column}' must contain parseable dates: {exc}")

        for column in INTEGER_COLUMNS.get(entity, []):
            try:
                normalized[column] = normalized[column].astype(int)
            except Exception as exc:
                errors.append(f"Column '{column}' must contain integers: {exc}")

        for column in FLOAT_COLUMNS.get(entity, []):
            try:
                normalized[column] = normalized[column].astype(float)
            except Exception as exc:
                errors.append(f"Column '{column}' must contain numeric values: {exc}")

        return normalized, errors

    def import_dataframe(self, session: Session, entity: str, dataframe: pd.DataFrame) -> ImportResult:
        result = ImportResult(entity=entity, rows_seen=len(dataframe))
        if entity not in MODEL_MAP:
            result.errors.append(f"Unsupported import entity '{entity}'.")
            return result

        model = MODEL_MAP[entity]
        try:
            for _, row in dataframe.iterrows():
                payload = row.to_dict()
                for key, value in list(payload.items()):
                    if isinstance(value, pd.Timestamp):
                        payload[key] = value.date()
                    if isinstance(value, date):
                        payload[key] = value
                session.merge(model(**payload))
            session.commit()
            result.rows_imported = len(dataframe)
        except Exception as exc:
            session.rollback()
            result.errors.append(f"Database import failed: {exc}")
        return result
