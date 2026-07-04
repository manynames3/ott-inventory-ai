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
from datetime import datetime
from io import BytesIO, StringIO
from typing import Any, Dict, List, Optional
from urllib.parse import unquote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError


AWS_REGION = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-west-2"
s3 = boto3.client(
    "s3",
    region_name=AWS_REGION,
    endpoint_url=f"https://s3.{AWS_REGION}.amazonaws.com",
    config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
)
dynamodb = boto3.client("dynamodb")
ssm = boto3.client("ssm")
sns = boto3.client("sns")
cognito = boto3.client("cognito-idp")

TENANT_ID = os.getenv("TENANT_ID", "default").strip() or "default"
TENANT_PK = f"tenant#{TENANT_ID}"
TOKEN_TTL_SECONDS = 12 * 60 * 60
SKU_PATTERN = re.compile(r"\b(?:(?:UPC|EAN)-\d{8,14}|[A-Z]{2,5}(?:-[A-Z0-9]{2,12})+|\d{4,8}[A-Z])\b")
AUTH_CACHE: Dict[str, Any] = {"loaded_at": 0, "config": None}
OPENAI_CACHE: Dict[str, Any] = {"loaded_at": 0, "api_key": None}
APPROVAL_ROLES = {"approver", "admin"}
VALID_ROLES = {"viewer", "planner", "approver", "admin"}
COGNITO_ROLE_GROUPS = {"viewer", "planner", "approver", "admin"}
ALERT_ACTIONS = {
    "api_error",
    "ai_failure",
    "import_preview_failed",
    "import_commit_failed",
    "import_worker_failed",
    "slow_job",
    "slow_request",
}

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
    path = event.get("rawPath") or event.get("path") or "/"
    stage = str(event.get("requestContext", {}).get("stage") or "").strip("/")
    if stage and path == f"/{stage}":
        return "/"
    if stage and path.startswith(f"/{stage}/"):
        return path[len(stage) + 1 :]
    for marker in ("/api/", "/health"):
        marker_index = path.find(marker)
        if marker_index > 0:
            return path[marker_index:]
    return path


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
    users_json = _param("AUTH_USERS_JSON_PARAMETER_NAME") or os.getenv("AUTH_USERS_JSON", "")
    role = os.getenv("AUTH_ROLE", "approver")
    config = {"username": username, "password": password, "secret": secret, "users_json": users_json, "role": role}
    AUTH_CACHE.update({"loaded_at": int(time.time()), "config": config})
    return config


def _ai_enabled() -> bool:
    return os.getenv("AI_QUERY_ENABLED", "true").strip().lower() not in {"0", "false", "no", "off"}


def _openai_model() -> str:
    return os.getenv("OPENAI_MODEL", "gpt-5-mini").strip() or "gpt-5-mini"


def _openai_api_key() -> str:
    cached = OPENAI_CACHE.get("api_key")
    if cached and int(time.time()) - int(OPENAI_CACHE.get("loaded_at", 0)) < 300:
        return str(cached)

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    parameter_name = os.getenv("OPENAI_API_KEY_PARAMETER_NAME", "").strip()
    if not api_key and parameter_name:
        try:
            api_key = ssm.get_parameter(Name=parameter_name, WithDecryption=True)["Parameter"]["Value"].strip()
        except Exception:
            api_key = ""

    OPENAI_CACHE.update({"loaded_at": int(time.time()), "api_key": api_key})
    return api_key


def _ai_status_payload() -> Dict[str, Any]:
    configured = bool(_openai_api_key())
    enabled = _ai_enabled()
    return {
        "provider": "openai",
        "model": _openai_model(),
        "enabled": enabled,
        "configured": configured,
        "mode": "llm_augmented_safe_views" if enabled and configured else "rule_based_fallback",
        "secret_source": "ssm_parameter" if os.getenv("OPENAI_API_KEY_PARAMETER_NAME", "").strip() else "environment",
    }


def _b64encode(payload: bytes) -> str:
    return base64.urlsafe_b64encode(payload).rstrip(b"=").decode("ascii")


def _b64decode(payload: str) -> bytes:
    return base64.urlsafe_b64decode(payload + ("=" * (-len(payload) % 4)))


def _sign(message: str, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).digest()
    return _b64encode(digest)


def _normalize_role(role: str | None) -> str:
    normalized = (role or "planner").strip().lower()
    return normalized if normalized in VALID_ROLES else "planner"


def _configured_users(config: Dict[str, str]) -> Dict[str, Dict[str, str]]:
    users_json = str(config.get("users_json", "")).strip()
    if users_json:
        try:
            parsed = json.loads(users_json)
        except json.JSONDecodeError as exc:
            raise ValueError("AUTH_USERS_JSON_PARAMETER_NAME does not contain valid JSON.") from exc
        if not isinstance(parsed, dict):
            raise ValueError("AUTH_USERS_JSON must be an object keyed by username.")
        users: Dict[str, Dict[str, str]] = {}
        for username, raw_config in parsed.items():
            if not isinstance(raw_config, dict):
                continue
            password = str(raw_config.get("password", ""))
            if not password:
                continue
            users[str(username)] = {
                "password": password,
                "role": _normalize_role(str(raw_config.get("role", config.get("role", "planner")))),
            }
        if users:
            return users
    if config.get("username") and config.get("password"):
        return {
            str(config["username"]): {
                "password": str(config["password"]),
                "role": _normalize_role(config.get("role")),
            }
        }
    return {}


def _role_for_user(subject: str, config: Dict[str, str]) -> str:
    return _configured_users(config).get(subject, {}).get("role", _normalize_role(config.get("role")))


def _can_approve_actions(user: Dict[str, Any]) -> bool:
    return str(user.get("role", "")).lower() in APPROVAL_ROLES


def _can_admin_users(user: Dict[str, Any]) -> bool:
    return str(user.get("role", "")).lower() == "admin"


def _require_admin_user(event: Dict[str, Any]) -> tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    user = _require_user(event)
    if not user:
        return None, _json(event, 401, {"detail": "Login required."})
    if not _can_admin_users(user):
        return None, _json(event, 403, {"detail": "Only admin users can manage pilot access."})
    if not os.getenv("COGNITO_USER_POOL_ID", "").strip():
        return None, _json(event, 503, {"detail": "Cognito user management is not configured."})
    return user, None


def _cognito_error(exc: ClientError) -> str:
    error = exc.response.get("Error", {}) if hasattr(exc, "response") else {}
    return str(error.get("Message") or error.get("Code") or "Cognito request failed.")


def _cognito_attr(attributes: List[Dict[str, str]], name: str) -> str:
    return next((str(attr.get("Value", "")) for attr in attributes if attr.get("Name") == name), "")


def _cognito_datetime(value: Any) -> str:
    return value.isoformat() if hasattr(value, "isoformat") else str(value or "")


def _temporary_password() -> str:
    return f"Aa1{uuid.uuid4().hex[:17]}"


def _cognito_user_payload(user: Dict[str, Any], groups: List[str]) -> Dict[str, Any]:
    attrs = user.get("Attributes") or user.get("UserAttributes") or []
    email = _cognito_attr(attrs, "email")
    role = _role_from_cognito_groups(groups)
    return {
        "username": str(user.get("Username", "")),
        "email": email,
        "enabled": bool(user.get("Enabled", True)),
        "status": str(user.get("UserStatus", "")),
        "role": role,
        "groups": groups,
        "created_at": _cognito_datetime(user.get("UserCreateDate")),
        "last_modified_at": _cognito_datetime(user.get("UserLastModifiedDate")),
    }


def _list_cognito_users(event: Dict[str, Any]) -> Dict[str, Any]:
    admin, error = _require_admin_user(event)
    if error:
        return error
    pool_id = os.environ["COGNITO_USER_POOL_ID"]
    rows: List[Dict[str, Any]] = []
    kwargs: Dict[str, Any] = {"UserPoolId": pool_id, "Limit": 60}
    try:
        while True:
            response = cognito.list_users(**kwargs)
            for user in response.get("Users", []):
                groups_response = cognito.admin_list_groups_for_user(
                    UserPoolId=pool_id,
                    Username=str(user.get("Username", "")),
                )
                groups = [str(group.get("GroupName", "")) for group in groups_response.get("Groups", [])]
                rows.append(_cognito_user_payload(user, groups))
            token = response.get("PaginationToken")
            if not token:
                break
            kwargs["PaginationToken"] = token
    except ClientError as exc:
        return _json(event, 502, {"detail": _cognito_error(exc)})
    rows.sort(key=lambda row: (str(row.get("email", "")), str(row.get("username", ""))))
    _audit_event(event, "admin_users_listed", "cognito_users", {"count": len(rows)}, admin.get("sub"))
    return _json(event, 200, {"rows": rows, "count": len(rows), "user_pool_id": pool_id})


def _set_cognito_role(pool_id: str, username: str, role: str) -> None:
    for group in sorted(COGNITO_ROLE_GROUPS):
        try:
            cognito.admin_remove_user_from_group(UserPoolId=pool_id, Username=username, GroupName=group)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code")
            if code not in {"ResourceNotFoundException", "UserNotFoundException"}:
                raise
    cognito.admin_add_user_to_group(UserPoolId=pool_id, Username=username, GroupName=role)


def _create_cognito_user(event: Dict[str, Any]) -> Dict[str, Any]:
    admin, error = _require_admin_user(event)
    if error:
        return error
    body = _body(event)
    email = str(body.get("email", "")).strip().lower()
    role = _normalize_role(str(body.get("role", "planner")))
    send_invite = bool(body.get("send_invite", True))
    if not email or "@" not in email:
        return _json(event, 400, {"detail": "A valid email is required."})
    if role not in COGNITO_ROLE_GROUPS:
        return _json(event, 400, {"detail": "role must be viewer, planner, approver, or admin."})
    pool_id = os.environ["COGNITO_USER_POOL_ID"]
    password = str(body.get("temporary_password") or _temporary_password())
    create_args: Dict[str, Any] = {
        "UserPoolId": pool_id,
        "Username": email,
        "TemporaryPassword": password,
        "UserAttributes": [
            {"Name": "email", "Value": email},
            {"Name": "email_verified", "Value": "true"},
        ],
    }
    if send_invite:
        create_args["DesiredDeliveryMediums"] = ["EMAIL"]
    else:
        create_args["MessageAction"] = "SUPPRESS"
    try:
        response = cognito.admin_create_user(**create_args)
        username = str(response.get("User", {}).get("Username") or email)
        _set_cognito_role(pool_id, username, role)
        user = cognito.admin_get_user(UserPoolId=pool_id, Username=username)
        groups_response = cognito.admin_list_groups_for_user(UserPoolId=pool_id, Username=username)
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code")
        status = 409 if code == "UsernameExistsException" else 502
        return _json(event, status, {"detail": _cognito_error(exc)})
    groups = [str(group.get("GroupName", "")) for group in groups_response.get("Groups", [])]
    payload: Dict[str, Any] = {"row": _cognito_user_payload(user, groups), "invite_sent": send_invite}
    if not send_invite:
        payload["temporary_password"] = password
    _audit_event(event, "admin_user_created", "cognito_users", {"email": email, "role": role}, admin.get("sub"))
    return _json(event, 201, payload)


def _update_cognito_user_role(event: Dict[str, Any], username: str) -> Dict[str, Any]:
    admin, error = _require_admin_user(event)
    if error:
        return error
    role = _normalize_role(str(_body(event).get("role", "planner")))
    if role not in COGNITO_ROLE_GROUPS:
        return _json(event, 400, {"detail": "role must be viewer, planner, approver, or admin."})
    pool_id = os.environ["COGNITO_USER_POOL_ID"]
    try:
        _set_cognito_role(pool_id, username, role)
        user = cognito.admin_get_user(UserPoolId=pool_id, Username=username)
        groups_response = cognito.admin_list_groups_for_user(UserPoolId=pool_id, Username=username)
    except ClientError as exc:
        return _json(event, 502, {"detail": _cognito_error(exc)})
    groups = [str(group.get("GroupName", "")) for group in groups_response.get("Groups", [])]
    _audit_event(event, "admin_user_role_updated", "cognito_users", {"username": username, "role": role}, admin.get("sub"))
    return _json(event, 200, {"row": _cognito_user_payload(user, groups)})


def _set_cognito_user_enabled(event: Dict[str, Any], username: str, enabled: bool) -> Dict[str, Any]:
    admin, error = _require_admin_user(event)
    if error:
        return error
    pool_id = os.environ["COGNITO_USER_POOL_ID"]
    try:
        if enabled:
            cognito.admin_enable_user(UserPoolId=pool_id, Username=username)
        else:
            cognito.admin_disable_user(UserPoolId=pool_id, Username=username)
        user = cognito.admin_get_user(UserPoolId=pool_id, Username=username)
        groups_response = cognito.admin_list_groups_for_user(UserPoolId=pool_id, Username=username)
    except ClientError as exc:
        return _json(event, 502, {"detail": _cognito_error(exc)})
    groups = [str(group.get("GroupName", "")) for group in groups_response.get("Groups", [])]
    _audit_event(
        event,
        "admin_user_enabled" if enabled else "admin_user_disabled",
        "cognito_users",
        {"username": username},
        admin.get("sub"),
    )
    return _json(event, 200, {"row": _cognito_user_payload(user, groups)})


def _create_token(subject: str, secret: str, role: str) -> str:
    now = int(time.time())
    header = _b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode("utf-8"))
    payload = _b64encode(
        json.dumps(
            {
                "sub": subject,
                "iat": now,
                "exp": now + TOKEN_TTL_SECONDS,
                "aud": "stocksense",
                "tenant_id": TENANT_ID,
                "role": _normalize_role(role),
            },
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
    if payload.get("aud") != "stocksense":
        raise ValueError("Invalid token audience.")
    if payload.get("tenant_id", TENANT_ID) != TENANT_ID:
        raise ValueError("Invalid token tenant.")
    if int(payload.get("exp", 0)) < int(time.time()):
        raise ValueError("Token expired.")
    return payload


def _role_from_cognito_groups(groups_claim: Any) -> str:
    if isinstance(groups_claim, str):
        try:
            parsed = json.loads(groups_claim)
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, list):
            groups = {str(part).strip().lower() for part in parsed if str(part).strip()}
        else:
            groups = {
                part.strip().strip("\"'[]").lower()
                for part in groups_claim.replace(",", " ").split()
                if part.strip().strip("\"'[]")
            }
    elif isinstance(groups_claim, list):
        groups = {str(part).strip().lower() for part in groups_claim if str(part).strip()}
    else:
        groups = set()
    if "admin" in groups:
        return "admin"
    if "approver" in groups or "ops-manager" in groups:
        return "approver"
    if "viewer" in groups:
        return "viewer"
    return "planner"


def _cognito_authorized_user(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    jwt = event.get("requestContext", {}).get("authorizer", {}).get("jwt")
    if not isinstance(jwt, dict):
        return None
    claims = jwt.get("claims") or {}
    if not isinstance(claims, dict):
        return None
    subject = claims.get("email") or claims.get("username") or claims.get("cognito:username") or claims.get("sub")
    if not subject:
        return None
    return {
        "sub": str(subject),
        "tenant_id": TENANT_ID,
        "role": _role_from_cognito_groups(claims.get("cognito:groups")),
        "auth_provider": "cognito",
        "claims": {"sub": claims.get("sub"), "email": claims.get("email")},
    }


def _require_user(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    cognito_user = _cognito_authorized_user(event)
    if cognito_user:
        return cognito_user
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
    try:
        users = _configured_users(config)
    except ValueError as exc:
        return _json(event, 503, {"detail": str(exc)})
    if not config["secret"] or not users:
        return _json(event, 503, {"detail": "Authentication SSM parameters are not configured."})
    body = _body(event)
    username = str(body.get("username", ""))
    password = str(body.get("password", ""))
    user_config = users.get(username)
    if not user_config or not hmac.compare_digest(password, user_config["password"]):
        _audit_event(event, "login_failed", "auth", {"username": username}, username or "unknown")
        return _json(event, 401, {"detail": "Invalid username or password."})
    role = _normalize_role(user_config.get("role"))
    _audit_event(event, "login_success", "auth", {}, username)
    return _json(
        event,
        200,
        {
            "access_token": _create_token(username, config["secret"], role),
            "token_type": "bearer",
            "user": {
                "username": username,
                "tenant_id": TENANT_ID,
                "role": role,
                "can_approve_actions": role in APPROVAL_ROLES,
            },
        },
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
        _archive_audit_event(payload, now_ms)
        _publish_alert(payload)
    except Exception:
        return


def _archive_audit_event(payload: Dict[str, Any], now_ms: int) -> None:
    bucket = os.getenv("AWS_S3_AUDIT_ARCHIVE_BUCKET", "").strip()
    if not bucket:
        return
    try:
        created = datetime.utcfromtimestamp(int(payload.get("created_at_epoch", int(now_ms / 1000)))).date()
        key = (
            f"tenant={TENANT_ID}/year={created.year:04d}/month={created.month:02d}/day={created.day:02d}/"
            f"{now_ms:013d}-{uuid.uuid4().hex}.json"
        )
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=(json.dumps(payload, separators=(",", ":"), default=str) + "\n").encode("utf-8"),
            ContentType="application/json",
        )
    except Exception:
        return


def _publish_alert(payload: Dict[str, Any]) -> None:
    topic_arn = os.getenv("ALERT_SNS_TOPIC_ARN", "").strip()
    if not topic_arn or payload.get("action") not in ALERT_ACTIONS:
        return
    try:
        sns.publish(
            TopicArn=topic_arn,
            Subject=f"StockSense {payload.get('action')} - {TENANT_ID}",
            Message=json.dumps(payload, indent=2, default=str),
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


def _action_reviews_pk() -> str:
    return f"action_reviews#{TENANT_PK}"


def _load_action_reviews(limit: int = 250) -> List[Dict[str, Any]]:
    response = dynamodb.query(
        TableName=os.environ["AWS_DYNAMODB_IMPORTS_TABLE"],
        KeyConditionExpression="pk = :pk",
        ExpressionAttributeValues={":pk": {"S": _action_reviews_pk()}},
        Limit=limit,
    )
    rows = [json.loads(item.get("data", {}).get("S", "{}")) for item in response.get("Items", [])]
    return sorted(rows, key=lambda row: int(row.get("updated_at_epoch", 0) or 0), reverse=True)


def _action_reviews(event: Dict[str, Any]) -> Dict[str, Any]:
    if not _require_user(event):
        return _json(event, 401, {"detail": "Login required."})
    rows = _load_action_reviews(limit=_parse_limit(event, default=250, maximum=1000))
    return _json(event, 200, {"rows": rows, "count": len(rows), "storage": "server"})


def _upsert_action_review(event: Dict[str, Any]) -> Dict[str, Any]:
    user = _require_user(event)
    if not user:
        return _json(event, 401, {"detail": "Login required."})
    body = _body(event)
    action_key = str(body.get("action_key", "")).strip()
    review_status = str(body.get("status", "")).strip().lower()
    note = str(body.get("note", ""))
    action_snapshot = body.get("action_snapshot") if isinstance(body.get("action_snapshot"), dict) else {}
    if not action_key:
        return _json(event, 400, {"detail": "action_key is required."})
    if review_status not in {"open", "accepted", "dismissed"}:
        return _json(event, 400, {"detail": "status must be open, accepted, or dismissed."})
    if review_status == "accepted" and not _can_approve_actions(user):
        return _json(event, 403, {"detail": "Only approver or admin roles can approve planner actions."})
    now = int(time.time())
    payload = {
        "action_key": action_key,
        "status": review_status,
        "note": note,
        "action_snapshot": action_snapshot,
        "updated_by": user.get("sub") or "unknown",
        "updated_at_epoch": now,
    }
    if review_status == "accepted":
        payload["approved_by"] = user.get("sub") or "unknown"
        payload["approved_at_epoch"] = now
    dynamodb.put_item(
        TableName=os.environ["AWS_DYNAMODB_IMPORTS_TABLE"],
        Item={
            "pk": {"S": _action_reviews_pk()},
            "sk": {"S": action_key},
            "data": {"S": json.dumps(payload, separators=(",", ":"), default=str)},
            "updated_at_epoch": {"N": str(now)},
        },
    )
    _audit_event(
        event,
        "action_review_updated",
        str(action_snapshot.get("sku") or action_snapshot.get("action_type") or "planner_action"),
        {"action_key": action_key, "status": review_status},
        user.get("sub"),
    )
    return _json(event, 200, {"row": payload, "storage": "server"})


def _clear_action_reviews(event: Dict[str, Any]) -> Dict[str, Any]:
    user = _require_user(event)
    if not user:
        return _json(event, 401, {"detail": "Login required."})
    if not _can_approve_actions(user):
        return _json(event, 403, {"detail": "Only approver or admin roles can clear planner review history."})
    deleted = 0
    while True:
        response = dynamodb.query(
            TableName=os.environ["AWS_DYNAMODB_IMPORTS_TABLE"],
            KeyConditionExpression="pk = :pk",
            ExpressionAttributeValues={":pk": {"S": _action_reviews_pk()}},
            ProjectionExpression="pk, sk",
            Limit=25,
        )
        items = response.get("Items", [])
        if not items:
            break
        for item in items:
            dynamodb.delete_item(
                TableName=os.environ["AWS_DYNAMODB_IMPORTS_TABLE"],
                Key={"pk": item["pk"], "sk": item["sk"]},
            )
            deleted += 1
        if not response.get("LastEvaluatedKey"):
            break
    _audit_event(event, "action_reviews_cleared", "planner_actions", {"deleted": deleted}, user.get("sub"))
    return _json(event, 200, {"deleted": deleted, "storage": "server"})


def _audit_events(event: Dict[str, Any]) -> Dict[str, Any]:
    if not _require_user(event):
        return _json(event, 401, {"detail": "Login required."})
    limit = _parse_limit(event, default=100, maximum=250)
    rows = _load_audit_events(limit=limit)
    return _json(event, 200, {"rows": rows, "count": len(rows)})


def _monitoring_summary(event: Dict[str, Any]) -> Dict[str, Any]:
    if not _require_user(event):
        return _json(event, 401, {"detail": "Login required."})
    now = int(time.time())
    cutoff = now - 24 * 60 * 60
    audits = [row for row in _load_audit_events(limit=250) if int(row.get("created_at_epoch", 0) or 0) >= cutoff]
    imports = [row for row in _load_import_history(limit=250) if int(row.get("updated_at_epoch", 0) or 0) >= cutoff]
    api_errors = [row for row in audits if row.get("action") == "api_error"]
    import_failures = [
        row
        for row in imports
        if row.get("status") == "failed"
    ] + [row for row in audits if str(row.get("action", "")).startswith("import_") and str(row.get("action", "")).endswith("_failed")]
    slow_items = [row for row in audits if row.get("action") in {"slow_request", "slow_job"}]
    ai_failures = [row for row in audits if row.get("action") == "ai_failure"]
    checks = [
        {
            "name": "API errors",
            "status": "attention" if api_errors else "ok",
            "count": len(api_errors),
            "message": "Unhandled API errors captured in the last 24 hours.",
        },
        {
            "name": "Import failures",
            "status": "attention" if import_failures else "ok",
            "count": len(import_failures),
            "message": "CSV/XLSX validation, mapping, or worker failures in the last 24 hours.",
        },
        {
            "name": "Slow requests/jobs",
            "status": "attention" if slow_items else "ok",
            "count": len(slow_items),
            "message": "Requests or jobs that exceeded configured pilot thresholds.",
        },
        {
            "name": "Failed AI calls",
            "status": "attention" if ai_failures else "ok",
            "count": len(ai_failures),
            "message": "LLM failures that fell back to safe materialized views.",
        },
    ]
    events = sorted([*audits, *imports], key=lambda row: int(row.get("created_at_epoch", row.get("updated_at_epoch", 0)) or 0), reverse=True)
    return _json(
        event,
        200,
        {
            "generated_at_epoch": now,
            "window_hours": 24,
            "checks": checks,
            "events": events[:25],
            "storage": "dynamodb_audit_and_import_status",
        },
    )


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


def _json_schema_for_ai_answer() -> Dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["explanation", "action_summary", "risk_notes", "confidence_note"],
        "properties": {
            "explanation": {
                "type": "string",
                "description": "A concise plain-English answer grounded only in the provided StockSense data.",
            },
            "action_summary": {
                "type": "array",
                "minItems": 1,
                "maxItems": 5,
                "items": {"type": "string"},
                "description": "Short planner-ready bullets with concrete actions, quantities, dates, SKUs, lots, or warehouses when available.",
            },
            "risk_notes": {
                "type": "array",
                "maxItems": 4,
                "items": {"type": "string"},
                "description": "Important caveats, assumptions, or planner review notes.",
            },
            "confidence_note": {
                "type": "string",
                "description": "One sentence explaining confidence based on the available rows and data freshness.",
            },
        },
    }


def _compact_rows(rows: List[Dict[str, Any]], limit: int = 10) -> List[Dict[str, Any]]:
    compacted = []
    preferred_keys = [
        "priority",
        "sku",
        "product_name",
        "category",
        "warehouse",
        "status",
        "lot_id",
        "ship_first_lot",
        "quantity_at_risk",
        "at_risk_value",
        "recommended_order_qty",
        "estimated_order_value",
        "reorder_by_date",
        "expiration_date",
        "risk_bucket",
        "days_to_expiration",
        "customer_id",
        "name",
        "region",
        "channel",
        "last_order_date",
        "days_since_last_order",
        "monthly_coverage",
        "avg_monthly_quantity",
        "suggested_action",
        "action",
        "reason",
        "confidence",
        "confidence_reason",
    ]
    for row in rows[:limit]:
        compacted.append({key: row.get(key) for key in preferred_keys if key in row})
    return compacted


def _row_identifier(row: Dict[str, Any]) -> str:
    for fields in [
        ("sku", "warehouse", "lot_id"),
        ("sku", "warehouse"),
        ("sku", "customer_id"),
        ("customer_id",),
        ("lot_id",),
        ("sku",),
    ]:
        values = [str(row.get(field, "")).strip() for field in fields if row.get(field)]
        if values:
            return " / ".join(values)
    return "row"


def _source_citations(answer: Dict[str, Any]) -> List[Dict[str, Any]]:
    template = str(answer.get("template") or "unsupported")
    rows = answer.get("rows", [])
    if not isinstance(rows, list):
        rows = []
    descriptions = {
        "stockout_risk": "Materialized reorder recommendations joined with product, inventory, order, inbound, and warehouse context.",
        "reorder_this_week": "Materialized reorder recommendations filtered to actions due within seven days.",
        "expiring_inventory": "Materialized waste-risk alerts generated from inventory lots inside the 90-day expiration window.",
        "customer_reorder_cadence": "Historical orders grouped by customer and compared with each customer's average reorder interval.",
        "monthly_sku_buyers": "Historical orders for the requested SKU grouped by customer and monthly buying coverage.",
    }
    return [
        {
            "source_id": f"view:{template}",
            "source_type": "materialized_view",
            "description": descriptions.get(template, "Safe predefined query template over structured inventory data."),
            "row_count": len(rows),
            "columns": answer.get("columns", []),
            "sample_record_ids": [_row_identifier(row) for row in rows[:5] if isinstance(row, dict)],
        }
    ]


def _query_context(question: str, answer: Dict[str, Any]) -> Dict[str, Any]:
    dashboard = _get_view("dashboard") or _empty_dashboard()
    return {
        "question": question,
        "matched_template": answer.get("template"),
        "safe_query_mode": answer.get("safe_query_mode"),
        "row_count": len(answer.get("rows", [])),
        "columns": answer.get("columns", []),
        "rows": _compact_rows(answer.get("rows", []), 12),
        "sources": answer.get("sources", []),
        "dashboard_kpis": dashboard.get("kpis", {}),
        "top_reorder_recommendations": _compact_rows(dashboard.get("recommendations", []), 5),
        "top_fefo_actions": _compact_rows(dashboard.get("fefo", []), 5),
        "top_waste_risk_alerts": _compact_rows(dashboard.get("waste_risk_alerts", []), 5),
        "available_views": [
            "stockout_risk",
            "expiring_inventory",
            "reorder_this_week",
            "customer_reorder_cadence",
            "monthly_sku_buyers",
        ],
    }


def _extract_response_text(response: Dict[str, Any]) -> str:
    if isinstance(response.get("output_text"), str):
        return str(response["output_text"])
    chunks = []
    for item in response.get("output", []) or []:
        if item.get("type") != "message":
            continue
        for content in item.get("content", []) or []:
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                chunks.append(content["text"])
    return "\n".join(chunks).strip()


def _ai_augmented_answer(question: str, answer: Dict[str, Any]) -> Dict[str, Any]:
    status = _ai_status_payload()
    answer["ai"] = status
    if not status["enabled"] or not status["configured"] or not answer.get("rows"):
        answer["ai_status"] = status["mode"]
        return answer

    system_prompt = (
        "You are StockSense AI, a decision-support assistant for food and CPG inventory planners. "
        "Use only the provided JSON context. Do not invent SKUs, customers, lots, quantities, dates, costs, or ERP facts. "
        "Do not produce SQL. Your job is to explain the matched safe materialized view in business language, "
        "prioritize actions that protect fill rate and reduce expiration waste, and call out confidence limits. "
        "Treat the sources array as the citations backing the answer."
    )
    payload = {
        "model": status["model"],
        "input": [
            {
                "role": "system",
                "content": [{"type": "input_text", "text": system_prompt}],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": json.dumps(_query_context(question, answer), default=str, separators=(",", ":")),
                    }
                ],
            },
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "stocksense_query_answer",
                "strict": True,
                "schema": _json_schema_for_ai_answer(),
            }
        },
        "reasoning": {"effort": "minimal"},
        "store": False,
        "max_output_tokens": 900,
    }

    request = Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {_openai_api_key()}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=18) as response:
            model_response = json.loads(response.read().decode("utf-8"))
        model_text = _extract_response_text(model_response)
        model_json = json.loads(model_text)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError) as exc:
        answer["ai_status"] = "llm_error_rule_based_fallback"
        answer["ai_error"] = type(exc).__name__
        return answer

    answer["explanation"] = str(model_json.get("explanation") or answer.get("explanation") or "")
    action_summary = model_json.get("action_summary")
    if isinstance(action_summary, list) and action_summary:
        answer["action_summary"] = [str(item) for item in action_summary[:5]]
    answer["ai_risk_notes"] = [str(item) for item in model_json.get("risk_notes", [])[:4] if str(item).strip()]
    answer["ai_confidence_note"] = str(model_json.get("confidence_note") or "")
    answer["ai_status"] = "llm_augmented"
    answer["safe_query_mode"] = "openai_augmented_materialized_views"
    return answer


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
        answer = {
            "question": question,
            "template": "unsupported",
            "explanation": "Try asking: Which SKUs will stock out in the next 30 days? Which inventory expires soon? What should we reorder this week?",
            "action_summary": ["No supported operational template matched that question."],
            "columns": [],
            "rows": [],
            "safe_query_mode": "rule_based_materialized_views",
            "ai": _ai_status_payload(),
            "ai_status": "unsupported_template",
        }
        answer["sources"] = []
        return answer
    answer = _get_view(key)
    if not answer:
        answer = {
            "question": question,
            "template": key.replace("query#", ""),
            "explanation": "No materialized answer is available yet. Upload inventory, order, customer, and inbound files, then let the import worker refresh views.",
            "action_summary": ["No refreshed materialized view is available for this question yet."],
            "columns": [],
            "rows": [],
            "safe_query_mode": "rule_based_materialized_views",
            "ai": _ai_status_payload(),
            "ai_status": "missing_materialized_view",
        }
        answer["sources"] = _source_citations(answer)
        return answer
    answer = json.loads(json.dumps(answer, default=str))
    answer["question"] = question
    answer["safe_query_mode"] = "rule_based_materialized_views"
    answer["sources"] = _source_citations(answer)
    return _ai_augmented_answer(question, answer)


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


def _safe_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _forecast_validation(horizon_days: int = 30) -> Dict[str, Any]:
    horizon = max(7, min(int(horizon_days or 30), 90))
    today_epoch = time.time()
    cutoff_epoch = today_epoch - horizon * 24 * 60 * 60
    today_iso = time.strftime("%Y-%m-%d", time.localtime(today_epoch))
    window_start_iso = time.strftime("%Y-%m-%d", time.localtime(cutoff_epoch + 24 * 60 * 60))
    products = {str(row.get("sku", "")): row for row in _query_records("products", limit=1000)}
    orders = _query_all_records("orders")
    by_sku: Dict[str, List[Dict[str, Any]]] = {}
    for order in orders:
        sku = str(order.get("sku", "")).strip()
        order_epoch = _as_epoch(order.get("order_date"))
        if not sku or not order_epoch:
            continue
        by_sku.setdefault(sku, []).append({**order, "_epoch": order_epoch})

    rows: List[Dict[str, Any]] = []
    for sku, sku_orders in sorted(by_sku.items()):
        train = [order for order in sku_orders if float(order["_epoch"]) <= cutoff_epoch]
        test = [order for order in sku_orders if cutoff_epoch < float(order["_epoch"]) <= today_epoch]
        if not train or not test:
            continue

        train_start = min(float(order["_epoch"]) for order in train)
        history_days = max(1, int((cutoff_epoch - train_start) / (24 * 60 * 60)) + 1)
        recent_start = cutoff_epoch - min(90, history_days) * 24 * 60 * 60
        recent_train = [order for order in train if float(order["_epoch"]) >= recent_start]
        recent_days = max(1, int((cutoff_epoch - recent_start) / (24 * 60 * 60)))
        recent_quantity = sum(_safe_float(order.get("quantity")) for order in recent_train)
        forecast_quantity = (recent_quantity / recent_days) * horizon
        actual_quantity = sum(_safe_float(order.get("quantity")) for order in test)
        absolute_error = abs(forecast_quantity - actual_quantity)
        ape = None if actual_quantity <= 0 else absolute_error / actual_quantity
        nonzero_days = len({time.strftime("%Y-%m-%d", time.localtime(float(order["_epoch"]))) for order in train if _safe_float(order.get("quantity")) > 0})
        if history_days < 90 or nonzero_days < 45:
            confidence = "low"
        elif ape is not None and ape > 0.45:
            confidence = "medium"
        else:
            confidence = "high"
        if ape is None:
            note = "No actual demand in the holdout window; planner should review before using this SKU for reorder tuning."
        elif confidence == "low":
            note = "Low-confidence SKU: sparse or short demand history; use planner override until more buyer data is loaded."
        elif ape <= 0.2:
            note = "Forecast is close enough for pilot reorder-point calibration."
        elif forecast_quantity > actual_quantity:
            note = "Forecast overcalled demand; review promotion flags, discontinued accounts, or slow-moving lots."
        else:
            note = "Forecast undercalled demand; review promotional spikes, customer onboarding, or allocation constraints."

        product = products.get(sku, {})
        rows.append(
            {
                "sku": sku,
                "product_name": product.get("name", ""),
                "category": product.get("category", ""),
                "forecast_quantity": round(forecast_quantity, 1),
                "actual_quantity": round(actual_quantity, 1),
                "absolute_error": round(absolute_error, 1),
                "absolute_percentage_error": None if ape is None else round(ape, 3),
                "bias": round(forecast_quantity - actual_quantity, 1),
                "confidence": confidence,
                "history_days": history_days,
                "validation_window": f"{window_start_iso} to {today_iso}",
                "business_note": note,
            }
        )

    rows.sort(
        key=lambda row: (
            row.get("absolute_percentage_error") is None,
            -float(row.get("absolute_percentage_error") or 0),
            -float(row.get("absolute_error") or 0),
        )
    )
    total_forecast = sum(float(row.get("forecast_quantity") or 0) for row in rows)
    total_actual = sum(float(row.get("actual_quantity") or 0) for row in rows)
    total_error = sum(float(row.get("absolute_error") or 0) for row in rows)
    apes = [float(row["absolute_percentage_error"]) for row in rows if row.get("absolute_percentage_error") is not None]
    apes.sort()
    if apes:
        midpoint = len(apes) // 2
        median_ape = apes[midpoint] if len(apes) % 2 else (apes[midpoint - 1] + apes[midpoint]) / 2
    else:
        median_ape = None
    return {
        "summary": {
            "sku_count": len(rows),
            "horizon_days": horizon,
            "median_absolute_percentage_error": None if median_ape is None else round(median_ape, 3),
            "weighted_absolute_percentage_error": round(total_error / total_actual, 3) if total_actual > 0 else None,
            "total_forecast_quantity": round(total_forecast, 1),
            "total_actual_quantity": round(total_actual, 1),
            "low_confidence_skus": sum(1 for row in rows if row.get("confidence") == "low"),
        },
        "rows": rows[:100],
    }


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


def _dispatch(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = _method(event)
    path = _path(event).rstrip("/") or "/"

    if method == "OPTIONS":
        return {"statusCode": 204, "headers": _cors_headers(event), "body": ""}
    if path == "/health":
        return _json(event, 200, {"ok": True, "service": "stocksense-low-idle-api", "tenant_id": TENANT_ID})
    if method == "POST" and path == "/api/auth/login":
        return _login(event)
    if method == "GET" and path == "/api/auth/me":
        user = _require_user(event)
        return (
            _json(
                event,
                200,
                {
                    "user": {
                        "username": user.get("sub"),
                        "tenant_id": user.get("tenant_id", TENANT_ID),
                        "role": user.get("role", "planner"),
                        "can_approve_actions": _can_approve_actions(user),
                    }
                },
            )
            if user
            else _json(event, 401, {"detail": "Login required."})
        )
    if method == "GET" and path == "/api/admin/users":
        return _list_cognito_users(event)
    if method == "POST" and path == "/api/admin/users":
        return _create_cognito_user(event)
    if path.startswith("/api/admin/users/"):
        admin_path = path.removeprefix("/api/admin/users/")
        if method == "POST" and admin_path.endswith("/role"):
            return _update_cognito_user_role(event, unquote(admin_path.removesuffix("/role").rstrip("/")))
        if method == "POST" and admin_path.endswith("/enable"):
            return _set_cognito_user_enabled(event, unquote(admin_path.removesuffix("/enable").rstrip("/")), True)
        if method == "POST" and admin_path.endswith("/disable"):
            return _set_cognito_user_enabled(event, unquote(admin_path.removesuffix("/disable").rstrip("/")), False)
    if method == "GET" and path == "/api/ai/status":
        return _protected_json(event, _ai_status_payload())
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
                "scheduled_imports": {
                    "enabled": bool(os.getenv("SCHEDULED_IMPORT_PREFIXES", "").strip()),
                    "prefixes": [part.strip() for part in os.getenv("SCHEDULED_IMPORT_PREFIXES", "").split(",") if part.strip()],
                    "mode": "scheduled_s3_scan_sftp_landing_ready",
                },
                "auth": {
                    "mode": "cognito_or_password",
                    "cognito_ready": bool(os.getenv("COGNITO_USER_POOL_ID", "").strip()),
                    "cognito_user_pool_id": os.getenv("COGNITO_USER_POOL_ID", ""),
                },
                "audit": {
                    "immutable_archive_configured": bool(os.getenv("AWS_S3_AUDIT_ARCHIVE_BUCKET", "").strip()),
                    "alerts_configured": bool(os.getenv("ALERT_SNS_TOPIC_ARN", "").strip()),
                },
                "retention": {
                    "raw_upload_days": int(os.getenv("RAW_FILE_RETENTION_DAYS", "365")),
                    "audit_event_days": int(os.getenv("AUDIT_EVENT_RETENTION_DAYS", "180")),
                    "import_status_days": int(os.getenv("IMPORT_STATUS_RETENTION_DAYS", "90")),
                    "immutable_archive_days": int(os.getenv("AUDIT_ARCHIVE_RETENTION_DAYS", "2555")),
                },
                "siem": {
                    "mode": "s3_archive_or_customer_forwarder",
                    "configured": bool(os.getenv("SIEM_HTTP_ENDPOINT", "").strip()),
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
    if method == "GET" and path == "/api/monitoring/summary":
        return _monitoring_summary(event)
    if method == "GET" and path == "/api/action-reviews":
        return _action_reviews(event)
    if method == "POST" and path == "/api/action-reviews":
        return _upsert_action_review(event)
    if method == "POST" and path == "/api/action-reviews/clear":
        return _clear_action_reviews(event)
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
    if method == "GET" and path == "/api/validation/forecast":
        try:
            horizon_days = int(_query_params(event).get("horizon_days", "30"))
        except ValueError:
            horizon_days = 30
        return _protected_json(event, _forecast_validation(horizon_days))
    if method == "POST" and path == "/api/query":
        user = _require_user(event)
        if not user:
            return _json(event, 401, {"detail": "Login required."})
        question = str(_body(event).get("question", ""))
        answer = _query_answer(question)
        if str(answer.get("ai_status", "")).startswith("llm_error"):
            _audit_event(
                event,
                "ai_failure",
                str(answer.get("template", "query")),
                {"ai_error": answer.get("ai_error"), "question_preview": question[:160]},
                user.get("sub"),
            )
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


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    started = time.perf_counter()
    method = _method(event)
    path = _path(event).rstrip("/") or "/"
    try:
        response = _dispatch(event, context)
    except Exception as exc:
        duration_ms = int((time.perf_counter() - started) * 1000)
        _audit_event(
            event,
            "api_error",
            path,
            {"method": method, "duration_ms": duration_ms, "error": type(exc).__name__},
        )
        return _json(event, 500, {"detail": "Internal server error."})
    duration_ms = int((time.perf_counter() - started) * 1000)
    response.setdefault("headers", {})
    response["headers"]["x-stocksense-duration-ms"] = str(duration_ms)
    status_code = int(response.get("statusCode", 200))
    if status_code >= 500:
        _audit_event(
            event,
            "api_error",
            path,
            {"method": method, "duration_ms": duration_ms, "status_code": status_code},
        )
    elif path.startswith("/api/") and duration_ms >= 2_000:
        _audit_event(
            event,
            "slow_request",
            path,
            {"method": method, "duration_ms": duration_ms, "status_code": status_code},
        )
    return response
