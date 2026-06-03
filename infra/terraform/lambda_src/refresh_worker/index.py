from __future__ import annotations

import json
import time
from typing import Any, Dict

from import_worker.index import _materialize_views, _now, _put_audit_event, _put_view


SLOW_REFRESH_SECONDS = 60


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    started = time.perf_counter()
    try:
        counts = _materialize_views()
    except Exception as exc:
        _put_audit_event("refresh_failed", "materialized_views", {"error": type(exc).__name__})
        raise
    duration_seconds = round(time.perf_counter() - started, 3)
    if duration_seconds >= SLOW_REFRESH_SECONDS:
        _put_audit_event("slow_job", "refresh_worker", {"duration_seconds": duration_seconds, "view_counts": counts})
    payload = {
        "ok": True,
        "updated_at_epoch": _now(),
        "duration_seconds": duration_seconds,
        "view_counts": counts,
        "message": "Recommendation and natural-language query views refreshed.",
    }
    _put_view("refresh_status", payload)
    return {"statusCode": 200, "body": json.dumps(payload, separators=(",", ":"))}
