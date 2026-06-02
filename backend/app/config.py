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
    auth_enabled: bool
    auth_username: str
    auth_password: str
    auth_secret_key: str
    auth_token_ttl_minutes: int
    aws_region: str
    aws_s3_raw_import_bucket: str
    aws_s3_import_prefix: str
    aws_dynamodb_records_table: str
    aws_dynamodb_views_table: str
    aws_dynamodb_imports_table: str
    allow_demo_seed: bool


def _get_bool(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


def get_settings() -> Settings:
    origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    return Settings(
        database_url=_get_required("DATABASE_URL"),
        cors_origins=[origin.strip() for origin in origins.split(",") if origin.strip()],
        supplier_lead_time_days=int(os.getenv("SUPPLIER_LEAD_TIME_DAYS", "30")),
        forecast_interval_seconds=int(os.getenv("FORECAST_INTERVAL_SECONDS", "3600")),
        import_queue_dir=os.getenv("IMPORT_QUEUE_DIR", "/app/import_queue"),
        auth_enabled=_get_bool("AUTH_ENABLED", "true"),
        auth_username=os.getenv("AUTH_USERNAME", ""),
        auth_password=os.getenv("AUTH_PASSWORD", ""),
        auth_secret_key=os.getenv("AUTH_SECRET_KEY", ""),
        auth_token_ttl_minutes=int(os.getenv("AUTH_TOKEN_TTL_MINUTES", "720")),
        aws_region=os.getenv("AWS_REGION", "us-west-2"),
        aws_s3_raw_import_bucket=os.getenv("AWS_S3_RAW_IMPORT_BUCKET", ""),
        aws_s3_import_prefix=os.getenv("AWS_S3_IMPORT_PREFIX", "stocksense/raw-imports"),
        aws_dynamodb_records_table=os.getenv("AWS_DYNAMODB_RECORDS_TABLE", "stocksense_records"),
        aws_dynamodb_views_table=os.getenv("AWS_DYNAMODB_VIEWS_TABLE", "stocksense_views"),
        aws_dynamodb_imports_table=os.getenv("AWS_DYNAMODB_IMPORTS_TABLE", "stocksense_imports"),
        allow_demo_seed=_get_bool("ALLOW_DEMO_SEED", "false"),
    )
