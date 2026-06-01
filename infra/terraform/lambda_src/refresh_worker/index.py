from __future__ import annotations

import json
import os
import time
from typing import Any, Dict

import boto3


dynamodb = boto3.client("dynamodb")


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    now = int(time.time())
    dynamodb.put_item(
        TableName=os.environ["AWS_DYNAMODB_VIEWS_TABLE"],
        Item={
            "pk": {"S": "tenant#default"},
            "sk": {"S": "refresh_status"},
            "status": {"S": "ok"},
            "message": {"S": "Refresh worker placeholder invoked. Recommendation materialization pending."},
            "updated_at_epoch": {"N": str(now)},
        },
    )
    return {"statusCode": 200, "body": json.dumps({"ok": True, "updated_at_epoch": now})}
