from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any, Dict

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings, get_settings


bearer_scheme = HTTPBearer(auto_error=False)
APPROVAL_ROLES = {"approver", "admin"}
VALID_ROLES = {"viewer", "planner", "approver", "admin"}


def _b64encode(payload: bytes) -> str:
    return base64.urlsafe_b64encode(payload).rstrip(b"=").decode("ascii")


def _b64decode(payload: str) -> bytes:
    padding = "=" * (-len(payload) % 4)
    return base64.urlsafe_b64decode(payload + padding)


def _sign(message: str, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).digest()
    return _b64encode(digest)


def _require_auth_config(settings: Settings) -> None:
    if not settings.auth_enabled:
        return
    missing = [
        name
        for name, value in {
            "AUTH_USERNAME/AUTH_USERS_JSON": settings.auth_username or settings.auth_users_json,
            "AUTH_PASSWORD/AUTH_USERS_JSON": settings.auth_password or settings.auth_users_json,
            "AUTH_SECRET_KEY": settings.auth_secret_key,
        }.items()
        if not value
    ]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Authentication is enabled but missing config: {', '.join(missing)}",
        )


def _normalize_role(role: str | None) -> str:
    normalized = (role or "planner").strip().lower()
    return normalized if normalized in VALID_ROLES else "planner"


def _configured_users(settings: Settings) -> Dict[str, Dict[str, str]]:
    if settings.auth_users_json.strip():
        try:
            parsed = json.loads(settings.auth_users_json)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AUTH_USERS_JSON is not valid JSON.",
            ) from exc
        if not isinstance(parsed, dict):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AUTH_USERS_JSON must be an object keyed by username.",
            )
        users: Dict[str, Dict[str, str]] = {}
        for username, raw_config in parsed.items():
            if not isinstance(raw_config, dict):
                continue
            password = str(raw_config.get("password", ""))
            if not password:
                continue
            users[str(username)] = {
                "password": password,
                "role": _normalize_role(str(raw_config.get("role", settings.auth_role))),
            }
        if users:
            return users
    if settings.auth_username and settings.auth_password:
        return {
            settings.auth_username: {
                "password": settings.auth_password,
                "role": _normalize_role(settings.auth_role),
            }
        }
    return {}


def role_for_user(subject: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    users = _configured_users(settings)
    return users.get(subject, {}).get("role", _normalize_role(settings.auth_role))


def can_approve_actions(user: Dict[str, Any]) -> bool:
    return str(user.get("role", "")).lower() in APPROVAL_ROLES


def create_access_token(subject: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    _require_auth_config(settings)
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + settings.auth_token_ttl_minutes * 60,
        "aud": "stocksense",
        "tenant_id": settings.tenant_id,
        "role": role_for_user(subject, settings=settings),
    }
    encoded_header = _b64encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    encoded_payload = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{encoded_header}.{encoded_payload}"
    signature = _sign(signing_input, settings.auth_secret_key)
    return f"{signing_input}.{signature}"


def verify_access_token(token: str, settings: Settings | None = None) -> Dict[str, Any]:
    settings = settings or get_settings()
    _require_auth_config(settings)
    try:
        encoded_header, encoded_payload, signature = token.split(".")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.") from exc

    signing_input = f"{encoded_header}.{encoded_payload}"
    expected = _sign(signing_input, settings.auth_secret_key)
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.")

    try:
        payload = json.loads(_b64decode(encoded_payload))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload.") from exc

    if payload.get("aud") != "stocksense":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token audience.")
    if payload.get("tenant_id", settings.tenant_id) != settings.tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token tenant.")
    if int(payload.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired.")
    return payload


def authenticate(username: str, password: str, settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    _require_auth_config(settings)
    users = _configured_users(settings)
    user = users.get(username)
    if not user:
        return False
    return hmac.compare_digest(password, user["password"])


def require_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Dict[str, Any]:
    settings = get_settings()
    if not settings.auth_enabled:
        return {"sub": "auth-disabled", "tenant_id": settings.tenant_id, "role": "admin"}
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required.")
    return verify_access_token(credentials.credentials, settings=settings)
