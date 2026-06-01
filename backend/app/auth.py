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
            "AUTH_USERNAME": settings.auth_username,
            "AUTH_PASSWORD": settings.auth_password,
            "AUTH_SECRET_KEY": settings.auth_secret_key,
        }.items()
        if not value
    ]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Authentication is enabled but missing config: {', '.join(missing)}",
        )


def create_access_token(subject: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    _require_auth_config(settings)
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + settings.auth_token_ttl_minutes * 60,
        "aud": "inventory-ai",
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

    if payload.get("aud") != "inventory-ai":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token audience.")
    if int(payload.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired.")
    return payload


def authenticate(username: str, password: str, settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    _require_auth_config(settings)
    username_ok = hmac.compare_digest(username, settings.auth_username)
    password_ok = hmac.compare_digest(password, settings.auth_password)
    return username_ok and password_ok


def require_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Dict[str, Any]:
    settings = get_settings()
    if not settings.auth_enabled:
        return {"sub": "auth-disabled"}
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required.")
    return verify_access_token(credentials.credentials, settings=settings)
