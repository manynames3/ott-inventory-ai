from __future__ import annotations

import logging
import time
from datetime import date

from app.config import get_settings
from app.database import SessionLocal
from app.services.jobs import refresh_recommendation_tables
from app.tasks.file_imports import process_import_queue


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("stocksense-worker")


def run_forever() -> None:
    settings = get_settings()
    logger.info("StockSense AI worker started; interval=%ss", settings.forecast_interval_seconds)

    while True:
        session = SessionLocal()
        try:
            import_counts = process_import_queue(session, settings.import_queue_dir)
            if import_counts["seen"]:
                logger.info("Processed queued imports: %s", import_counts)
            counts = refresh_recommendation_tables(
                session,
                as_of=date.today(),
                lead_time_days=settings.supplier_lead_time_days,
            )
            logger.info("Refreshed recommendation tables: %s", counts)
        except Exception:
            logger.exception("Recommendation refresh failed")
        finally:
            session.close()

        time.sleep(settings.forecast_interval_seconds)


if __name__ == "__main__":
    run_forever()
