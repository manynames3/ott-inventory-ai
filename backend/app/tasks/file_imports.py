from __future__ import annotations

import logging
import shutil
from pathlib import Path
from typing import Dict

from sqlalchemy.orm import Session

from app.adapters.base import REQUIRED_COLUMNS
from app.adapters.csv_adapter import CSVImportAdapter


logger = logging.getLogger("inventory-ai-import-worker")


def _entity_from_path(path: Path) -> str:
    name = path.stem
    return name.split("__", 1)[0]


def process_import_queue(session: Session, queue_dir: str) -> Dict[str, int]:
    root = Path(queue_dir)
    root.mkdir(parents=True, exist_ok=True)
    processed_dir = root / "processed"
    failed_dir = root / "failed"
    processed_dir.mkdir(exist_ok=True)
    failed_dir.mkdir(exist_ok=True)

    adapter = CSVImportAdapter()
    counts = {"seen": 0, "imported": 0, "failed": 0}

    for path in sorted(root.glob("*.csv")):
        counts["seen"] += 1
        entity = _entity_from_path(path)
        if entity not in REQUIRED_COLUMNS:
            logger.error("Skipping %s; filename must start with a supported entity.", path.name)
            shutil.move(str(path), failed_dir / path.name)
            counts["failed"] += 1
            continue

        with path.open("rb") as file_obj:
            loaded = adapter.load_csv(entity, file_obj)
        if loaded.errors:
            logger.error("Import validation failed for %s: %s", path.name, loaded.errors)
            shutil.move(str(path), failed_dir / path.name)
            counts["failed"] += 1
            continue

        dataframe = getattr(loaded, "dataframe")
        imported = adapter.import_dataframe(session, entity, dataframe)
        if imported.errors:
            logger.error("Import failed for %s: %s", path.name, imported.errors)
            shutil.move(str(path), failed_dir / path.name)
            counts["failed"] += 1
            continue

        logger.info("Imported %s rows from %s", imported.rows_imported, path.name)
        shutil.move(str(path), processed_dir / path.name)
        counts["imported"] += imported.rows_imported

    return counts

