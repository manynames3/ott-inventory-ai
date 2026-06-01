from __future__ import annotations

import csv
import json
import os
import time
from io import StringIO
from typing import Any, Dict
from urllib.parse import unquote

import boto3


s3 = boto3.client("s3")
dynamodb = boto3.client("dynamodb")

REQUIRED_COLUMNS = {
    "products": ["sku", "name", "category", "case_size", "shelf_life_days"],
    "inventory_lots": [
        "lot_id",
        "sku",
        "warehouse",
        "quantity_on_hand",
        "received_date",
        "expiration_date",
        "unit_cost",
    ],
    "customers": ["customer_id", "name", "region", "channel"],
    "orders": ["order_id", "customer_id", "order_date", "sku", "quantity"],
    "inbound_shipments": ["shipment_id", "sku", "quantity", "eta_date", "origin", "status"],
}

SAMPLE_ROWS = {
    "products": {
        "sku": "OTG-RAM-001",
        "name": "Golden Kettle Mild Ramyeon Case",
        "category": "Noodles",
        "case_size": 24,
        "shelf_life_days": 270,
    },
    "inventory_lots": {
        "lot_id": "LOT-LA-240601-001",
        "sku": "OTG-RAM-001",
        "warehouse": "LA DC",
        "quantity_on_hand": 840,
        "received_date": "2026-04-15",
        "expiration_date": "2026-08-30",
        "unit_cost": 18.75,
    },
    "customers": {
        "customer_id": "CUST-HMART-WEST",
        "name": "H Mart West",
        "region": "West",
        "channel": "Retail",
    },
    "orders": {
        "order_id": "ORD-20260531-001",
        "customer_id": "CUST-HMART-WEST",
        "order_date": "2026-05-31",
        "sku": "OTG-RAM-001",
        "quantity": 120,
    },
    "inbound_shipments": {
        "shipment_id": "INB-BUSAN-001",
        "sku": "OTG-RAM-001",
        "quantity": 1800,
        "eta_date": "2026-06-28",
        "origin": "Busan",
        "status": "in_transit",
    },
}


def _origin(event: Dict[str, Any]) -> str:
    headers = event.get("headers") or {}
    return headers.get("origin") or headers.get("Origin") or ""


def _cors_headers(event: Dict[str, Any], content_type: str = "application/json") -> Dict[str, str]:
    allowed = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "").split(",") if origin.strip()]
    origin = _origin(event)
    allow_origin = origin if origin in allowed else (allowed[0] if allowed else "*")
    return {
        "access-control-allow-origin": allow_origin,
        "access-control-allow-headers": "authorization,content-type",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "content-type": content_type,
    }


def _json(event: Dict[str, Any], status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": _cors_headers(event),
        "body": json.dumps(body, default=str),
    }


def _csv_template(entity: str) -> str:
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=REQUIRED_COLUMNS[entity])
    writer.writeheader()
    writer.writerow(SAMPLE_ROWS[entity])
    return output.getvalue()


def _path(event: Dict[str, Any]) -> str:
    return event.get("rawPath") or event.get("path") or "/"


def _method(event: Dict[str, Any]) -> str:
    return (event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod") or "GET").upper()


def _body(event: Dict[str, Any]) -> Dict[str, Any]:
    raw = event.get("body") or "{}"
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def _template_response(event: Dict[str, Any], path: str) -> Dict[str, Any]:
    filename = path.rsplit("/", 1)[-1]
    entity, _, extension = filename.partition(".")
    if entity not in REQUIRED_COLUMNS or extension != "csv":
        return _json(event, 404, {"detail": "Template must be one of the supported entities with .csv format."})
    content = _csv_template(entity)
    return {
        "statusCode": 200,
        "headers": {
            **_cors_headers(event, "text/csv"),
            "content-disposition": f'attachment; filename="{entity}_template.csv"',
        },
        "body": content,
    }


def _presign_upload(event: Dict[str, Any]) -> Dict[str, Any]:
    body = _body(event)
    entity = body.get("entity", "")
    filename = body.get("filename", "upload.csv")
    content_type = body.get("content_type", "application/octet-stream")

    if entity not in REQUIRED_COLUMNS:
        return _json(event, 400, {"detail": "Unsupported import entity."})

    safe_filename = unquote(filename).replace("/", "_").replace("\\", "_")
    key = f"{os.environ['AWS_S3_IMPORT_PREFIX'].rstrip('/')}/{entity}/{int(time.time())}-{safe_filename}"
    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": os.environ["AWS_S3_RAW_IMPORT_BUCKET"],
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=900,
    )
    return _json(
        event,
        200,
        {
            "bucket": os.environ["AWS_S3_RAW_IMPORT_BUCKET"],
            "key": key,
            "upload_url": upload_url,
            "expires_in_seconds": 900,
            "next_step": "PUT the file to upload_url. The S3 event import worker will record import status.",
        },
    )


def _view(event: Dict[str, Any], view_key: str) -> Dict[str, Any]:
    response = dynamodb.get_item(
        TableName=os.environ["AWS_DYNAMODB_VIEWS_TABLE"],
        Key={"pk": {"S": "tenant#default"}, "sk": {"S": view_key}},
    )
    item = response.get("Item")
    if not item:
        return _json(
            event,
            404,
            {
                "detail": "View has not been materialized yet.",
                "view": view_key,
                "hint": "Upload demo data or run the refresh worker.",
            },
        )
    return _json(event, 200, {"view": view_key, "item": item})


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = _method(event)
    path = _path(event)

    if method == "OPTIONS":
        return {"statusCode": 204, "headers": _cors_headers(event), "body": ""}
    if path == "/health":
        return _json(event, 200, {"ok": True, "service": "inventory-ai-low-idle-api"})
    if path == "/api/import/requirements":
        return _json(
            event,
            200,
            {
                "csv_required_columns": REQUIRED_COLUMNS,
                "supported_upload_formats": [".csv", ".xlsx", ".xlsm"],
                "raw_file_storage": {
                    "service": "s3",
                    "enabled": True,
                    "bucket_configured": True,
                    "bucket": os.environ["AWS_S3_RAW_IMPORT_BUCKET"],
                    "prefix": os.environ["AWS_S3_IMPORT_PREFIX"],
                },
                "query_store": {
                    "service": "dynamodb",
                    "records_table": os.environ["AWS_DYNAMODB_RECORDS_TABLE"],
                    "views_table": os.environ["AWS_DYNAMODB_VIEWS_TABLE"],
                },
            },
        )
    if method == "GET" and path.startswith("/api/templates/"):
        return _template_response(event, path)
    if method == "POST" and path == "/api/uploads/presign":
        return _presign_upload(event)
    if method == "GET" and path.startswith("/api/views/"):
        return _view(event, path.rsplit("/", 1)[-1])
    return _json(event, 404, {"detail": "Route not implemented in the low-idle Lambda stub.", "path": path})
