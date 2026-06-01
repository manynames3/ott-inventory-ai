from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.config import Settings, get_settings


@dataclass(frozen=True)
class StoredObject:
    service: str
    bucket: str
    key: str
    region: str
    etag: str | None = None


def _safe_filename(filename: str) -> str:
    name = Path(filename).name or "upload"
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name)


class RawFileStorage:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    @property
    def enabled(self) -> bool:
        return bool(self.settings.aws_s3_raw_import_bucket)

    def store(self, *, entity: str, filename: str, content: bytes, content_type: str | None = None) -> Optional[StoredObject]:
        if not self.enabled:
            return None

        try:
            import boto3
        except ImportError as exc:
            raise RuntimeError("boto3 is required for S3 raw import storage.") from exc

        now = datetime.now(timezone.utc)
        safe_name = _safe_filename(filename)
        prefix = self.settings.aws_s3_import_prefix.strip("/")
        key = (
            f"{prefix}/{entity}/{now:%Y/%m/%d}/"
            f"{now:%H%M%S}-{safe_name}"
        )
        client = boto3.client("s3", region_name=self.settings.aws_region)
        response = client.put_object(
            Bucket=self.settings.aws_s3_raw_import_bucket,
            Key=key,
            Body=content,
            ContentType=content_type or "application/octet-stream",
            Metadata={"entity": entity, "source": "inventory-ai"},
        )
        return StoredObject(
            service="s3",
            bucket=self.settings.aws_s3_raw_import_bucket,
            key=key,
            region=self.settings.aws_region,
            etag=response.get("ETag"),
        )
