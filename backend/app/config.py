from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List


def _get_required(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


@dataclass(frozen=True)
class Settings:
    database_url: str
    cors_origins: List[str]
    supplier_lead_time_days: int
    forecast_interval_seconds: int
    import_queue_dir: str


def get_settings() -> Settings:
    origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    return Settings(
        database_url=_get_required("DATABASE_URL"),
        cors_origins=[origin.strip() for origin in origins.split(",") if origin.strip()],
        supplier_lead_time_days=int(os.getenv("SUPPLIER_LEAD_TIME_DAYS", "30")),
        forecast_interval_seconds=int(os.getenv("FORECAST_INTERVAL_SECONDS", "3600")),
        import_queue_dir=os.getenv("IMPORT_QUEUE_DIR", "/app/import_queue"),
    )
