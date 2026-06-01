from __future__ import annotations

import base64
import csv
import hashlib
import hmac
import json
import os
import re
import time
import uuid
import zipfile
from io import BytesIO, StringIO
from typing import Any, Dict, List, Optional
from urllib.parse import unquote

import boto3
from botocore.config import Config


AWS_REGION = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-west-2"
s3 = boto3.client(
    "s3",
    region_name=AWS_REGION,
    endpoint_url=f"https://s3.{AWS_REGION}.amazonaws.com",
    config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
)
dynamodb = boto3.client("dynamodb")
ssm = boto3.client("ssm")

TENANT_PK = "tenant#default"
TOKEN_TTL_SECONDS = 12 * 60 * 60
SKU_PATTERN = re.compile(r"\b[A-Z]{2,5}-[A-Z0-9]{3,8}\b")
AUTH_CACHE: Dict[str, Any] = {"loaded_at": 0, "config": None}

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

ENTITY_LABELS = {
    "products": "Products",
    "inventory_lots": "Inventory lots",
    "customers": "Customers",
    "orders": "Orders",
    "inbound_shipments": "Inbound shipments",
}

COLUMN_ALIASES = {
    "sku": ["sku", "item", "itemcode", "itemnumber", "productsku", "productcode", "material", "materialnumber"],
    "name": ["name", "productname", "itemname", "description", "productdescription", "itemdescription"],
    "category": ["category", "productcategory", "family", "class", "department"],
    "case_size": ["casesize", "casepack", "packsize", "unitspercase", "caseqty", "casequantity"],
    "shelf_life_days": ["shelflifedays", "shelflife", "daysshelflife", "expirationdays"],
    "lot_id": ["lotid", "lot", "lotnumber", "batch", "batchnumber", "productionlot"],
    "warehouse": ["warehouse", "wh", "dc", "facility", "location", "inventorylocation"],
    "quantity_on_hand": ["quantityonhand", "qtyonhand", "qoh", "availableqty", "availablequantity", "onhand"],
    "received_date": ["receiveddate", "receiptdate", "dateReceived", "arrivaldate", "inbounddate"],
    "expiration_date": ["expirationdate", "expirydate", "expdate", "bestby", "bestbefore", "sellbydate"],
    "unit_cost": ["unitcost", "cost", "casecost", "standardcost", "landedcost"],
    "customer_id": ["customerid", "customer", "account", "accountid", "customercode", "soldto"],
    "region": ["region", "market", "territory", "salesregion"],
    "channel": ["channel", "saleschannel", "customerchannel", "classoftrade"],
    "order_id": ["orderid", "salesorder", "salesordernumber", "invoice", "invoicenumber", "ordernumber"],
    "order_date": ["orderdate", "shipdate", "invoicedate", "transactiondate", "date"],
    "quantity": ["quantity", "qty", "orderqty", "orderedquantity", "cases", "casequantity"],
    "shipment_id": ["shipmentid", "shipment", "ponumber", "purchaseorder", "container", "containernumber"],
    "eta_date": ["etadate", "eta", "arrivaldate", "expectedarrival", "expectedreceiptdate"],
    "origin": ["origin", "source", "countryoforigin", "portoforigin", "supplierorigin"],
    "status": ["status", "shipmentstatus", "inboundstatus", "poStatus"],
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
        "body": json.dumps(body, default=str, separators=(",", ":")),
    }


def _text(event: Dict[str, Any], status_code: int, body: bytes | str, content_type: str, filename: str) -> Dict[str, Any]:
    is_bytes = isinstance(body, bytes)
    return {
        "statusCode": status_code,
        "headers": {
            **_cors_headers(event, content_type),
            "content-disposition": f'attachment; filename="{filename}"',
        },
        "isBase64Encoded": is_bytes,
        "body": base64.b64encode(body).decode("ascii") if is_bytes else body,
    }


def _path(event: Dict[str, Any]) -> str:
    return event.get("rawPath") or event.get("path") or "/"


def _method(event: Dict[str, Any]) -> str:
    return (event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod") or "GET").upper()


def _body(event: Dict[str, Any]) -> Dict[str, Any]:
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def _query_params(event: Dict[str, Any]) -> Dict[str, str]:
    return event.get("queryStringParameters") or {}


def _param(name: str) -> str:
    parameter_name = os.getenv(name, "")
    if not parameter_name:
        return ""
    return ssm.get_parameter(Name=parameter_name, WithDecryption=True)["Parameter"]["Value"]


def _auth_config() -> Dict[str, str]:
    cached = AUTH_CACHE.get("config")
    if cached and int(time.time()) - int(AUTH_CACHE.get("loaded_at", 0)) < 300:
        return cached
    username = _param("AUTH_USERNAME_PARAMETER_NAME")
    password = _param("AUTH_PASSWORD_PARAMETER_NAME")
    secret = _param("AUTH_SECRET_KEY_PARAMETER_NAME")
    config = {"username": username, "password": password, "secret": secret}
    AUTH_CACHE.update({"loaded_at": int(time.time()), "config": config})
    return config


def _b64encode(payload: bytes) -> str:
    return base64.urlsafe_b64encode(payload).rstrip(b"=").decode("ascii")


def _b64decode(payload: str) -> bytes:
    return base64.urlsafe_b64decode(payload + ("=" * (-len(payload) % 4)))


def _sign(message: str, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).digest()
    return _b64encode(digest)


def _create_token(subject: str, secret: str) -> str:
    now = int(time.time())
    header = _b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode("utf-8"))
    payload = _b64encode(
        json.dumps(
            {"sub": subject, "iat": now, "exp": now + TOKEN_TTL_SECONDS, "aud": "inventory-ai"},
            separators=(",", ":"),
        ).encode("utf-8")
    )
    signing_input = f"{header}.{payload}"
    return f"{signing_input}.{_sign(signing_input, secret)}"


def _verify_token(token: str, secret: str) -> Dict[str, Any]:
    try:
        encoded_header, encoded_payload, signature = token.split(".")
    except ValueError as exc:
        raise ValueError("Invalid token.") from exc
    signing_input = f"{encoded_header}.{encoded_payload}"
    if not hmac.compare_digest(signature, _sign(signing_input, secret)):
        raise ValueError("Invalid token.")
    payload = json.loads(_b64decode(encoded_payload))
    if payload.get("aud") != "inventory-ai":
        raise ValueError("Invalid token audience.")
    if int(payload.get("exp", 0)) < int(time.time()):
        raise ValueError("Token expired.")
    return payload


def _require_user(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    try:
        config = _auth_config()
    except Exception:
        return None
    if not config["secret"]:
        return None
    headers = event.get("headers") or {}
    auth_header = headers.get("authorization") or headers.get("Authorization") or ""
    if not auth_header.lower().startswith("bearer "):
        return None
    try:
        return _verify_token(auth_header.split(" ", 1)[1], config["secret"])
    except Exception:
        return None


def _login(event: Dict[str, Any]) -> Dict[str, Any]:
    try:
        config = _auth_config()
    except Exception as exc:
        return _json(event, 503, {"detail": f"Authentication is not configured: {exc}"})
    if not config["username"] or not config["password"] or not config["secret"]:
        return _json(event, 503, {"detail": "Authentication SSM parameters are not configured."})
    body = _body(event)
    username = str(body.get("username", ""))
    password = str(body.get("password", ""))
    if not hmac.compare_digest(username, config["username"]) or not hmac.compare_digest(password, config["password"]):
        _audit_event(event, "login_failed", "auth", {"username": username}, username or "unknown")
        return _json(event, 401, {"detail": "Invalid username or password."})
    _audit_event(event, "login_success", "auth", {}, username)
    return _json(
        event,
        200,
        {"access_token": _create_token(username, config["secret"]), "token_type": "bearer", "user": {"username": username}},
    )


def _csv_template(entity: str) -> bytes:
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=REQUIRED_COLUMNS[entity])
    writer.writeheader()
    writer.writerow(SAMPLE_ROWS[entity])
    return output.getvalue().encode("utf-8")


def _xlsx_template(entity: str) -> bytes:
    headers = REQUIRED_COLUMNS[entity]
    values = [SAMPLE_ROWS[entity].get(header, "") for header in headers]

    def cell(col: int, row: int, value: Any) -> str:
        ref = f"{chr(64 + col)}{row}"
        escaped = str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        return f'<c r="{ref}" t="inlineStr"><is><t>{escaped}</t></is></c>'

    sheet = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        "<sheetData>"
        f'<row r="1">{"".join(cell(i + 1, 1, header) for i, header in enumerate(headers))}</row>'
        f'<row r="2">{"".join(cell(i + 1, 2, value) for i, value in enumerate(values))}</row>'
        "</sheetData></worksheet>"
    )
    output = BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            "</Types>",
        )
        archive.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            "</Relationships>",
        )
        archive.writestr(
            "xl/workbook.xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            f'<sheets><sheet name="{entity[:31]}" sheetId="1" r:id="rId1"/></sheets></workbook>',
        )
        archive.writestr(
            "xl/_rels/workbook.xml.rels",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            "</Relationships>",
        )
        archive.writestr("xl/worksheets/sheet1.xml", sheet)
    return output.getvalue()


def _template_response(event: Dict[str, Any], path: str) -> Dict[str, Any]:
    filename = path.rsplit("/", 1)[-1]
    entity, _, extension = filename.partition(".")
    if entity not in REQUIRED_COLUMNS:
        return _json(event, 404, {"detail": "Unsupported template entity."})
    if extension == "csv":
        return _text(event, 200, _csv_template(entity), "text/csv", f"{entity}_template.csv")
    if extension == "xlsx":
        return _text(
            event,
            200,
            _xlsx_template(entity),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            f"{entity}_template.xlsx",
        )
    return _json(event, 404, {"detail": "Template format must be csv or xlsx."})


def _csv_export(entity: str, rows: List[Dict[str, Any]]) -> bytes:
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=REQUIRED_COLUMNS[entity], lineterminator="\n")
    writer.writeheader()
    for row in rows:
        writer.writerow({column: row.get(column, "") for column in REQUIRED_COLUMNS[entity]})
    return output.getvalue().encode("utf-8")


def _export_response(event: Dict[str, Any], path: str) -> Dict[str, Any]:
    user = _require_user(event)
    if not user:
        return _json(event, 401, {"detail": "Login required."})
    filename = path.rsplit("/", 1)[-1]
    entity, _, extension = filename.partition(".")
    if entity not in REQUIRED_COLUMNS or extension != "csv":
        return _json(event, 404, {"detail": "Export format must be a supported entity CSV."})
    rows = _query_all_records(entity)
    _audit_event(event, "export_downloaded", entity, {"rows": len(rows), "format": "csv"}, user.get("sub"))
    return _text(event, 200, _csv_export(entity, rows), "text/csv", f"{entity}_export.csv")


def _record_pk(entity: str) -> str:
    return f"{TENANT_PK}#entity#{entity}"


def _query_all_records(entity: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    start_key = None
    while True:
        kwargs: Dict[str, Any] = {
            "TableName": os.environ["AWS_DYNAMODB_RECORDS_TABLE"],
            "KeyConditionExpression": "pk = :pk",
            "ExpressionAttributeValues": {":pk": {"S": _record_pk(entity)}},
        }
        if start_key:
            kwargs["ExclusiveStartKey"] = start_key
        response = dynamodb.query(**kwargs)
        for item in response.get("Items", []):
            rows.append(json.loads(item.get("data", {}).get("S", "{}")))
        start_key = response.get("LastEvaluatedKey")
        if not start_key:
            return rows


def _query_records(entity: str, limit: int = 500) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    start_key = None
    while True:
        kwargs: Dict[str, Any] = {
            "TableName": os.environ["AWS_DYNAMODB_RECORDS_TABLE"],
            "KeyConditionExpression": "pk = :pk",
            "ExpressionAttributeValues": {":pk": {"S": _record_pk(entity)}},
            "Limit": min(limit - len(rows), 100),
        }
        if start_key:
            kwargs["ExclusiveStartKey"] = start_key
        response = dynamodb.query(**kwargs)
        for item in response.get("Items", []):
            rows.append(json.loads(item.get("data", {}).get("S", "{}")))
        start_key = response.get("LastEvaluatedKey")
        if not start_key or len(rows) >= limit:
            return rows


def _parse_limit(event: Dict[str, Any], default: int = 500, maximum: int = 1000) -> int:
    raw = _query_params(event).get("limit", str(default))
    try:
        return max(1, min(int(raw), maximum))
    except ValueError:
        return default


def _get_view(sk: str) -> Optional[Dict[str, Any]]:
    response = dynamodb.get_item(
        TableName=os.environ["AWS_DYNAMODB_VIEWS_TABLE"],
        Key={"pk": {"S": TENANT_PK}, "sk": {"S": sk}},
    )
    item = response.get("Item")
    return json.loads(item["data"]["S"]) if item and "data" in item else None


def _worker_helpers():
    from import_worker.index import _normalize, _parse_content, _put_import_status

    return _parse_content, _normalize, _put_import_status


def _safe_filename(filename: str) -> str:
    safe = unquote(filename or "upload.csv").replace("/", "_").replace("\\", "_")
    return safe or "upload.csv"


def _s3_preview_prefix() -> str:
    parts = os.environ["AWS_S3_IMPORT_PREFIX"].strip("/").split("/")
    if parts and parts[-1] == "incoming":
        parts[-1] = "preview"
    else:
        parts.append("preview")
    return "/".join(parts) + "/"


def _canonical_column(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _suggest_mapping(entity: str, detected_columns: List[str]) -> Dict[str, str]:
    canonical_sources = {_canonical_column(column): column for column in detected_columns}
    used = set()
    mapping: Dict[str, str] = {}
    for required in REQUIRED_COLUMNS[entity]:
        candidates = [_canonical_column(required), *[_canonical_column(alias) for alias in COLUMN_ALIASES.get(required, [])]]
        selected = ""
        for candidate in candidates:
            source = canonical_sources.get(candidate)
            if source and source not in used:
                selected = source
                break
        if selected:
            used.add(selected)
        mapping[required] = selected
    return mapping


def _apply_mapping(entity: str, rows: List[Dict[str, Any]], mapping: Dict[str, str]) -> List[Dict[str, Any]]:
    return [{column: row.get(mapping.get(column, ""), "") for column in REQUIRED_COLUMNS[entity]} for row in rows]


def _mapped_csv(entity: str, rows: List[Dict[str, Any]]) -> bytes:
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=REQUIRED_COLUMNS[entity])
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


def _client_ip(event: Dict[str, Any]) -> str:
    return (
        event.get("requestContext", {}).get("http", {}).get("sourceIp")
        or event.get("requestContext", {}).get("identity", {}).get("sourceIp")
        or ""
    )


def _audit_event(
    event: Dict[str, Any],
    action: str,
    resource: str,
    details: Optional[Dict[str, Any]] = None,
    subject: Optional[str] = None,
) -> None:
    try:
        user = subject or (_require_user(event) or {}).get("sub") or "anonymous"
        now_ms = int(time.time() * 1000)
        payload = {
            "record_type": "audit",
            "action": action,
            "resource": resource,
            "user": user,
            "origin": _origin(event),
            "source_ip": _client_ip(event),
            "details": details or {},
            "created_at_epoch": int(now_ms / 1000),
        }
        dynamodb.put_item(
            TableName=os.environ["AWS_DYNAMODB_IMPORTS_TABLE"],
            Item={
                "pk": {"S": f"audit#{TENANT_PK}"},
                "sk": {"S": f"{now_ms:013d}#{uuid.uuid4().hex[:8]}"},
                "data": {"S": json.dumps(payload, separators=(",", ":"), default=str)},
                "ttl_epoch": {"N": str(int(now_ms / 1000) + 180 * 24 * 60 * 60)},
            },
        )
    except Exception:
        return


def _load_audit_events(limit: int = 100) -> List[Dict[str, Any]]:
    response = dynamodb.query(
        TableName=os.environ["AWS_DYNAMODB_IMPORTS_TABLE"],
        KeyConditionExpression="pk = :pk",
        ExpressionAttributeValues={":pk": {"S": f"audit#{TENANT_PK}"}},
        Limit=limit,
        ScanIndexForward=False,
    )
    return [json.loads(item.get("data", {}).get("S", "{}")) for item in response.get("Items", [])]


def _audit_events(event: Dict[str, Any]) -> Dict[str, Any]:
    if not _require_user(event):
        return _json(event, 401, {"detail": "Login required."})
    limit = _parse_limit(event, default=100, maximum=250)
    rows = _load_audit_events(limit=limit)
    return _json(event, 200, {"rows": rows, "count": len(rows)})


def _read_staged_rows(entity: str, bucket: str, key: str) -> List[Dict[str, str]]:
    if entity not in REQUIRED_COLUMNS:
        raise ValueError("Unsupported import entity.")
    if bucket != os.environ["AWS_S3_RAW_IMPORT_BUCKET"]:
        raise ValueError("Preview bucket does not match the configured raw import bucket.")
    obj = s3.get_object(Bucket=bucket, Key=key)
    content = obj["Body"].read()
    parse_content, _, _ = _worker_helpers()
    return parse_content(key, content)


def _import_preview(event: Dict[str, Any]) -> Dict[str, Any]:
    user = _require_user(event)
    if not user:
        return _json(event, 401, {"detail": "Login required."})
    body = _body(event)
    entity = str(body.get("entity", ""))
    bucket = str(body.get("bucket", ""))
    key = str(body.get("key", ""))
    filename = str(body.get("filename", "")) or key.rsplit("/", 1)[-1]
    if entity not in REQUIRED_COLUMNS or not bucket or not key:
        return _json(event, 400, {"detail": "entity, bucket, and key are required."})
    try:
        rows = _read_staged_rows(entity, bucket, key)
    except Exception as exc:
        _audit_event(event, "import_preview_failed", entity, {"key": key, "error": str(exc)}, user.get("sub"))
        return _json(event, 400, {"detail": str(exc)})
    detected_columns = list(rows[0].keys()) if rows else []
    mapping = _suggest_mapping(entity, detected_columns)
    mapped_sample = _apply_mapping(entity, rows[:5], mapping)
    _, normalize, _ = _worker_helpers()
    _, errors = normalize(entity, _apply_mapping(entity, rows[:25], mapping))
    missing_mappings = [column for column in REQUIRED_COLUMNS[entity] if not mapping.get(column)]
    _audit_event(
        event,
        "import_previewed",
        entity,
        {"filename": filename, "key": key, "rows_seen": len(rows), "missing_mappings": missing_mappings},
        user.get("sub"),
    )
    return _json(
        event,
        200,
        {
            "entity": entity,
            "bucket": bucket,
            "key": key,
            "filename": filename,
            "row_count_estimate": len(rows),
            "detected_columns": detected_columns,
            "required_columns": REQUIRED_COLUMNS[entity],
            "suggested_mapping": mapping,
            "sample_rows": rows[:5],
            "mapped_sample_rows": mapped_sample,
            "validation": {
                "missing_mappings": missing_mappings,
                "sample_errors": errors[:10],
                "status": "needs_mapping" if missing_mappings or errors else "ready",
            },
        },
    )


def _commit_import(event: Dict[str, Any]) -> Dict[str, Any]:
    user = _require_user(event)
    if not user:
        return _json(event, 401, {"detail": "Login required."})
    body = _body(event)
    entity = str(body.get("entity", ""))
    bucket = str(body.get("bucket", ""))
    key = str(body.get("key", ""))
    mapping = body.get("mapping") if isinstance(body.get("mapping"), dict) else {}
    if entity not in REQUIRED_COLUMNS or not bucket or not key:
        return _json(event, 400, {"detail": "entity, bucket, and key are required."})
    missing_mappings = [column for column in REQUIRED_COLUMNS[entity] if not str(mapping.get(column, "")).strip()]
    if missing_mappings:
        return _json(event, 400, {"detail": f"Missing mappings for: {', '.join(missing_mappings)}"})
    try:
        rows = _read_staged_rows(entity, bucket, key)
        mapped_rows = _apply_mapping(entity, rows, {str(k): str(v) for k, v in mapping.items()})
        _, normalize, put_import_status = _worker_helpers()
        normalized, errors = normalize(entity, mapped_rows)
    except Exception as exc:
        _audit_event(event, "import_commit_failed", entity, {"key": key, "error": str(exc)}, user.get("sub"))
        return _json(event, 400, {"detail": str(exc)})
    if errors:
        put_import_status(bucket, key, "failed", "Mapped import validation failed.", entity=entity, rows_seen=len(rows), errors=errors[:100])
        _audit_event(
            event,
            "import_commit_failed",
            entity,
            {"key": key, "rows_seen": len(rows), "error_count": len(errors)},
            user.get("sub"),
        )
        return _json(event, 400, {"detail": {"message": "Mapped import validation failed.", "errors": errors[:100]}})

    target_key = (
        f"{os.environ['AWS_S3_IMPORT_PREFIX'].rstrip('/')}/{entity}/"
        f"{int(time.time())}-{uuid.uuid4().hex[:8]}-mapped-{_safe_filename(key.rsplit('/', 1)[-1])}.csv"
    )
    put_import_status(
        bucket,
        target_key,
        "queued",
        f"Mapping approved for {entity}. Import worker is queued.",
        entity=entity,
        rows_seen=len(rows),
        source_key=key,
    )
    s3.put_object(
        Bucket=bucket,
        Key=target_key,
        Body=_mapped_csv(entity, normalized),
        ContentType="text/csv",
        Metadata={"entity": entity, "mapped-from": key[-900:]},
    )
    _audit_event(
        event,
        "import_committed",
        entity,
        {"source_key": key, "target_key": target_key, "rows_seen": len(rows), "mapped_columns": len(mapping)},
        user.get("sub"),
    )
    return _json(
        event,
        200,
        {
            "entity": entity,
            "bucket": bucket,
            "key": target_key,
            "status": "queued",
            "rows_seen": len(rows),
            "message": "Mapping approved. The import worker will validate, import, and refresh insights.",
        },
    )


def _import_status(event: Dict[str, Any]) -> Dict[str, Any]:
    if not _require_user(event):
        return _json(event, 401, {"detail": "Login required."})
    params = _query_params(event)
    bucket = params.get("bucket", "")
    key = params.get("key", "")
    if not bucket or not key:
        return _json(event, 400, {"detail": "bucket and key query parameters are required."})
    response = dynamodb.get_item(
        TableName=os.environ["AWS_DYNAMODB_IMPORTS_TABLE"],
        Key={"pk": {"S": f"import#{bucket}#{key}"}, "sk": {"S": "status"}},
    )
    item = response.get("Item")
    if not item:
        return _json(event, 202, {"status": "queued", "message": "Upload received. Import worker has not reported status yet."})
    return _json(event, 200, json.loads(item["data"]["S"]))


def _load_import_history(limit: int = 100) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    start_key = None
    while len(rows) < limit:
        kwargs: Dict[str, Any] = {
            "TableName": os.environ["AWS_DYNAMODB_IMPORTS_TABLE"],
            "Limit": min(100, limit - len(rows)),
        }
        if start_key:
            kwargs["ExclusiveStartKey"] = start_key
        response = dynamodb.scan(**kwargs)
        for item in response.get("Items", []):
            if item.get("pk", {}).get("S", "").startswith("audit#"):
                continue
            try:
                row = json.loads(item.get("data", {}).get("S", "{}"))
            except json.JSONDecodeError:
                continue
            if row.get("record_type") == "audit":
                continue
            row.setdefault("source_key", item.get("pk", {}).get("S", "").replace("import#", "", 1))
            rows.append(row)
        start_key = response.get("LastEvaluatedKey")
        if not start_key:
            break
    rows.sort(key=lambda row: float(row.get("updated_at_epoch", 0) or 0), reverse=True)
    return rows[:limit]


def _import_checklist(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    latest_by_entity: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        entity = str(row.get("entity", ""))
        if entity in REQUIRED_COLUMNS and entity not in latest_by_entity:
            latest_by_entity[entity] = row

    checklist = []
    for entity, required in REQUIRED_COLUMNS.items():
        row = latest_by_entity.get(entity)
        if not row:
            checklist.append(
                {
                    "entity": entity,
                    "label": ENTITY_LABELS.get(entity, entity.replace("_", " ").title()),
                    "status": "missing",
                    "required_columns": required,
                    "message": "Not loaded",
                    "rows_imported": 0,
                    "error_count": 0,
                }
            )
            continue
        import_status = str(row.get("status", "queued"))
        errors = row.get("errors") if isinstance(row.get("errors"), list) else []
        if import_status == "imported":
            checklist_status = "complete"
            message = f"{row.get('rows_imported', 0)} rows imported."
        elif import_status == "failed":
            checklist_status = "needs_fix"
            message = row.get("message") or "Fix validation errors and re-upload."
        else:
            checklist_status = "processing"
            message = row.get("message") or "Import worker is still processing this file."
        checklist.append(
            {
                "entity": entity,
                "label": ENTITY_LABELS.get(entity, entity.replace("_", " ").title()),
                "status": checklist_status,
                "required_columns": required,
                "message": message,
                "rows_imported": row.get("rows_imported", 0),
                "error_count": len(errors),
                "updated_at_epoch": row.get("updated_at_epoch"),
            }
        )
    return checklist


def _import_history(event: Dict[str, Any]) -> Dict[str, Any]:
    if not _require_user(event):
        return _json(event, 401, {"detail": "Login required."})
    limit = _parse_limit(event, default=100, maximum=250)
    rows = _load_import_history(limit=limit)
    return _json(event, 200, {"rows": rows, "count": len(rows), "checklist": _import_checklist(rows)})


def _presign_upload(event: Dict[str, Any]) -> Dict[str, Any]:
    user = _require_user(event)
    if not user:
        return _json(event, 401, {"detail": "Login required."})
    body = _body(event)
    entity = body.get("entity", "")
    filename = body.get("filename", "upload.csv")
    content_type = body.get("content_type", "application/octet-stream")
    mode = str(body.get("mode", "import")).lower()
    if entity not in REQUIRED_COLUMNS:
        return _json(event, 400, {"detail": "Unsupported import entity."})
    if mode not in {"import", "preview"}:
        return _json(event, 400, {"detail": "Upload mode must be import or preview."})
    safe_filename = _safe_filename(filename)
    prefix = _s3_preview_prefix() if mode == "preview" else os.environ["AWS_S3_IMPORT_PREFIX"]
    key = f"{prefix.rstrip('/')}/{entity}/{int(time.time())}-{safe_filename}"
    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": os.environ["AWS_S3_RAW_IMPORT_BUCKET"], "Key": key, "ContentType": content_type},
        ExpiresIn=900,
    )
    _audit_event(
        event,
        "upload_url_created",
        str(entity),
        {"mode": mode, "filename": safe_filename, "key": key},
        user.get("sub"),
    )
    return _json(
        event,
        200,
        {
            "entity": entity,
            "bucket": os.environ["AWS_S3_RAW_IMPORT_BUCKET"],
            "key": key,
            "upload_url": upload_url,
            "expires_in_seconds": 900,
            "mode": mode,
            "message": (
                "Upload URL created for preview. The file will not import until the mapping is approved."
                if mode == "preview"
                else "Upload URL created. The file will be imported automatically after upload."
            ),
        },
    )


def _query_answer(question: str) -> Dict[str, Any]:
    normalized = question.lower()
    sku_match = SKU_PATTERN.search(question.upper())
    if sku_match and "customer" in normalized and "buy" in normalized:
        key = f"query#monthly_buyers#{sku_match.group(0)}"
    elif "who" in normalized and ("another order" in normalized or "needs" in normalized):
        key = "query#customer_reorder_cadence"
    elif "stock out" in normalized or "stockout" in normalized:
        key = "query#stockout_risk"
    elif "expires" in normalized or "expir" in normalized:
        key = "query#expiring_inventory"
    elif "reorder" in normalized or "order this week" in normalized:
        key = "query#reorder_this_week"
    else:
        return {
            "question": question,
            "template": "unsupported",
            "explanation": "Try asking: Which SKUs will stock out in the next 30 days? Which inventory expires soon? What should we reorder this week?",
            "columns": [],
            "rows": [],
            "safe_query_mode": "rule_based_materialized_views",
        }
    answer = _get_view(key)
    if not answer:
        return {
            "question": question,
            "template": key.replace("query#", ""),
            "explanation": "No materialized answer is available yet. Upload inventory, order, customer, and inbound files, then let the import worker refresh views.",
            "columns": [],
            "rows": [],
            "safe_query_mode": "rule_based_materialized_views",
        }
    answer["question"] = question
    answer["safe_query_mode"] = "rule_based_materialized_views"
    return answer


def _to_date(value: Any) -> str:
    return str(value or "")[:10]


def _as_epoch(value: Any) -> Optional[float]:
    text = _to_date(value)
    if not text:
        return None
    try:
        return time.mktime(time.strptime(text, "%Y-%m-%d"))
    except ValueError:
        return None


def _month_key(value: Any) -> str:
    return _to_date(value)[:7]


def _sku_detail(sku: str) -> Dict[str, Any]:
    products = _query_records("products", limit=1000)
    lots = [row for row in _query_records("inventory_lots", limit=1000) if str(row.get("sku")) == sku]
    inbounds = [row for row in _query_records("inbound_shipments", limit=1000) if str(row.get("sku")) == sku]
    orders = [row for row in _query_records("orders", limit=5000) if str(row.get("sku")) == sku]
    product = next((row for row in products if str(row.get("sku")) == sku), None)
    if not product:
        return {"detail": f"SKU '{sku}' not found."}

    today = time.time()
    quantities_by_day: Dict[str, float] = {}
    quantities_by_month: Dict[str, float] = {}
    for order in orders:
        if not _as_epoch(order.get("order_date")):
            continue
        day = _to_date(order.get("order_date"))
        month = _month_key(order.get("order_date"))
        qty = float(order.get("quantity", 0) or 0)
        quantities_by_day[day] = quantities_by_day.get(day, 0.0) + qty
        quantities_by_month[month] = quantities_by_month.get(month, 0.0) + qty

    daily_90 = []
    for offset in range(89, -1, -1):
        day = time.strftime("%Y-%m-%d", time.localtime(today - offset * 24 * 60 * 60))
        daily_90.append(quantities_by_day.get(day, 0.0))
    recent_30 = daily_90[-30:]
    prior_30 = daily_90[-60:-30]
    moving_30 = sum(recent_30) / 30 if recent_30 else 0.0
    moving_90 = sum(daily_90) / 90 if daily_90 else 0.0
    smoothed = 0.0
    alpha = 0.35
    for value in daily_90:
        smoothed = value if smoothed == 0 else alpha * value + (1 - alpha) * smoothed
    blended = round((moving_30 * 0.5) + (moving_90 * 0.2) + (smoothed * 0.3), 4)
    recent_avg = sum(recent_30) / 30 if recent_30 else 0.0
    prior_avg = sum(prior_30) / 30 if prior_30 else 0.0
    if recent_avg > prior_avg * 1.15:
        trend = "upward placeholder: recent 30-day demand is above the prior 30 days"
    elif recent_avg < prior_avg * 0.85:
        trend = "downward placeholder: recent 30-day demand is below the prior 30 days"
    else:
        trend = "stable placeholder: no significant trend detected"

    demand_points = [
        {"label": month, "value": quantity}
        for month, quantity in sorted(quantities_by_month.items())[-12:]
    ]
    recs = [
        row for row in (_get_view("reorder_recommendations") or {}).get("rows", [])
        if str(row.get("sku")) == sku
    ]
    fefo = [
        row for row in (_get_view("fefo") or {}).get("rows", [])
        if str(row.get("sku")) == sku
    ]
    return {
        "product": product,
        "inventory_lots": lots,
        "inbound_shipments": inbounds,
        "forecast": {
            "blended_daily_demand": blended,
            "horizons": [
                {"horizon_days": horizon, "forecast_quantity": round(blended * horizon, 1), "daily_demand": blended}
                for horizon in [30, 60, 90]
            ],
            "models": {
                "moving_average_30": round(moving_30, 4),
                "moving_average_90": round(moving_90, 4),
                "exponential_smoothing": round(smoothed, 4),
            },
            "trend": trend,
            "seasonality": "seasonality placeholder: compare against same-month demand once more annual cycles are available",
        },
        "reorder_recommendations": recs,
        "fefo": fefo,
        "demand_trend": [{"sku": sku, "points": demand_points}],
    }


def _customer_detail(customer_id: str) -> Dict[str, Any]:
    customers = _query_records("customers", limit=1000)
    products = _query_records("products", limit=1000)
    orders = [row for row in _query_records("orders", limit=5000) if str(row.get("customer_id")) == customer_id]
    customer = next((row for row in customers if str(row.get("customer_id")) == customer_id), None)
    if not customer:
        return {"detail": f"Customer '{customer_id}' not found."}
    product_by_sku = {str(product.get("sku")): product for product in products}
    total_units = sum(float(order.get("quantity", 0) or 0) for order in orders)
    last_order = max((_to_date(order.get("order_date")) for order in orders), default="")
    qty_by_sku: Dict[str, float] = {}
    qty_by_month: Dict[str, float] = {}
    for order in orders:
        sku = str(order.get("sku", ""))
        qty = float(order.get("quantity", 0) or 0)
        qty_by_sku[sku] = qty_by_sku.get(sku, 0.0) + qty
        month = _month_key(order.get("order_date"))
        if month:
            qty_by_month[month] = qty_by_month.get(month, 0.0) + qty
    top_skus = []
    for sku, quantity in sorted(qty_by_sku.items(), key=lambda item: item[1], reverse=True)[:10]:
        product = product_by_sku.get(sku, {})
        top_skus.append(
            {"sku": sku, "name": product.get("name", ""), "category": product.get("category", ""), "quantity": quantity}
        )
    return {
        "customer": customer,
        "summary": {"total_orders": len(orders), "total_units": total_units, "last_order_date": last_order},
        "top_skus": top_skus,
        "monthly_trend": [{"label": month, "value": quantity} for month, quantity in sorted(qty_by_month.items())[-12:]],
    }


def _protected_json(event: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    if not _require_user(event):
        return _json(event, 401, {"detail": "Login required."})
    return _json(event, 200, payload)


def _empty_dashboard() -> Dict[str, Any]:
    return {
        "kpis": {
            "total_inventory_value": 0,
            "inventory_at_risk_value": 0,
            "projected_stockouts": 0,
            "recommended_reorder_value": 0,
            "waste_reduction_opportunity": 0,
        },
        "charts": {
            "demand_trend_by_sku": [],
            "inventory_by_expiration_bucket": [],
            "reorder_urgency": [],
        },
        "recommendations": [],
        "fefo": [],
        "waste_risk_alerts": [],
        "roi_explanation": "Upload products, inventory lots, orders, customers, and inbound shipments to calculate ROI.",
    }


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = _method(event)
    path = _path(event).rstrip("/") or "/"

    if method == "OPTIONS":
        return {"statusCode": 204, "headers": _cors_headers(event), "body": ""}
    if path == "/health":
        return _json(event, 200, {"ok": True, "service": "inventory-ai-low-idle-api"})
    if method == "POST" and path == "/api/auth/login":
        return _login(event)
    if method == "GET" and path == "/api/auth/me":
        user = _require_user(event)
        return _json(event, 200, {"user": {"username": user.get("sub")}}) if user else _json(event, 401, {"detail": "Login required."})
    if path == "/api/import/requirements":
        return _json(
            event,
            200,
            {
                "csv_required_columns": REQUIRED_COLUMNS,
                "supported_upload_formats": [".csv", ".xlsx", ".xlsm"],
                "template_formats": ["csv", "xlsx"],
                "upload_mode": "presigned_s3",
                "import_workflow": "preview_map_commit",
                "mapping_preview": {
                    "enabled": True,
                    "preview_prefix": _s3_preview_prefix(),
                    "commit_endpoint": "/api/imports/commit",
                },
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
                "erp_adapters": {
                    "sap": "placeholder only; see docs/erp_integration.md",
                    "oracle": "placeholder only; see docs/erp_integration.md",
                },
            },
        )
    if method == "GET" and path.startswith("/api/exports/"):
        return _export_response(event, path)
    if method == "GET" and path.startswith("/api/templates/"):
        return _template_response(event, path)
    if method == "POST" and path == "/api/uploads/presign":
        return _presign_upload(event)
    if method == "POST" and path == "/api/import-preview":
        return _import_preview(event)
    if method == "POST" and path == "/api/imports/commit":
        return _commit_import(event)
    if method == "GET" and path == "/api/import-status":
        return _import_status(event)
    if method == "GET" and path == "/api/import-history":
        return _import_history(event)
    if method == "GET" and path == "/api/audit-events":
        return _audit_events(event)
    if method == "GET" and path == "/api/dashboard":
        return _protected_json(event, _get_view("dashboard") or _empty_dashboard())
    if method == "GET" and path == "/api/products":
        rows = _query_records("products", limit=_parse_limit(event))
        return _protected_json(event, {"rows": rows, "count": len(rows)})
    if method == "GET" and path == "/api/customers":
        rows = _query_records("customers", limit=_parse_limit(event))
        return _protected_json(event, {"rows": rows, "count": len(rows)})
    if method == "GET" and path.startswith("/api/sku/"):
        detail = _sku_detail(unquote(path.rsplit("/", 1)[-1]))
        return _protected_json(event, detail) if "product" in detail else _json(event, 404, detail)
    if method == "GET" and path.startswith("/api/customers/"):
        detail = _customer_detail(unquote(path.rsplit("/", 1)[-1]))
        return _protected_json(event, detail) if "customer" in detail else _json(event, 404, detail)
    if method == "GET" and path == "/api/fefo":
        return _protected_json(event, {"rows": (_get_view("fefo") or {}).get("rows", [])})
    if method == "GET" and path == "/api/waste-risk-alerts":
        return _protected_json(event, {"rows": (_get_view("waste_risk_alerts") or {}).get("rows", [])})
    if method == "GET" and path == "/api/reorder-recommendations":
        return _protected_json(event, {"rows": (_get_view("reorder_recommendations") or {}).get("rows", [])})
    if method == "POST" and path == "/api/query":
        user = _require_user(event)
        if not user:
            return _json(event, 401, {"detail": "Login required."})
        question = str(_body(event).get("question", ""))
        answer = _query_answer(question)
        _audit_event(
            event,
            "query_answered",
            str(answer.get("template", "unsupported")),
            {"question_preview": question[:160], "row_count": len(answer.get("rows", []))},
            user.get("sub"),
        )
        return _json(event, 200, answer)
    if method == "GET" and path.startswith("/api/views/"):
        return _protected_json(event, _get_view(path.rsplit("/", 1)[-1]) or {"rows": []})
    return _json(event, 404, {"detail": "Route not implemented in the low-idle Lambda API.", "path": path})
