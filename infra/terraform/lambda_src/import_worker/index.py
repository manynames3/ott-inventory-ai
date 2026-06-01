from __future__ import annotations

import json
import os
import time
from typing import Any, Dict
from urllib.parse import unquote_plus

import boto3


dynamodb = boto3.client("dynamodb")


def _put_import_status(bucket: str, key: str, status: str, message: str) -> None:
    now = int(time.time())
    dynamodb.put_item(
        TableName=os.environ["AWS_DYNAMODB_IMPORTS_TABLE"],
        Item={
            "pk": {"S": f"import#{bucket}#{key}"},
            "sk": {"S": "status"},
            "bucket": {"S": bucket},
            "key": {"S": key},
            "status": {"S": status},
            "message": {"S": message},
            "created_at_epoch": {"N": str(now)},
            "ttl_epoch": {"N": str(now + 90 * 24 * 60 * 60)},
        },
    )


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    processed = []
    for record in event.get("Records", []):
        bucket = record.get("s3", {}).get("bucket", {}).get("name", "")
        key = unquote_plus(record.get("s3", {}).get("object", {}).get("key", ""))
        if not bucket or not key:
            continue

        # Placeholder: the production importer should parse Excel/CSV, validate columns,
        # write canonical records, and refresh materialized views.
        _put_import_status(bucket, key, "received", "Raw file received; parser implementation pending.")
        processed.append({"bucket": bucket, "key": key})

    return {"statusCode": 200, "body": json.dumps({"processed": processed})}
