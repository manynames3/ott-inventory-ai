from __future__ import annotations

import json
from typing import Any, Dict

from import_worker.index import _materialize_views, _now, _put_view


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    counts = _materialize_views()
    payload = {
        "ok": True,
        "updated_at_epoch": _now(),
        "view_counts": counts,
        "message": "Recommendation and natural-language query views refreshed.",
    }
    _put_view("refresh_status", payload)
    return {"statusCode": 200, "body": json.dumps(payload, separators=(",", ":"))}
