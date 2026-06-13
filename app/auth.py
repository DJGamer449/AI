import base64
import hashlib
import hmac
import secrets
import time
from typing import Optional

from fastapi import Cookie, Depends, HTTPException, Response, status

from .config import Settings, get_settings

COOKIE_NAME = "melantrance_session"


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _sign(payload: str, secret: str) -> str:
    return _b64(hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest())


def create_session_token(settings: Settings) -> str:
    expires = int(time.time()) + settings.session_ttl_seconds
    nonce = secrets.token_urlsafe(24)
    payload = f"{expires}.{nonce}"
    return f"{payload}.{_sign(payload, settings.signing_secret)}"


def verify_session_token(token: Optional[str], settings: Settings) -> bool:
    if not token:
        return False
    try:
        expires_raw, nonce, signature = token.split(".", 2)
        payload = f"{expires_raw}.{nonce}"
        expected = _sign(payload, settings.signing_secret)
        return hmac.compare_digest(signature, expected) and int(expires_raw) >= int(time.time())
    except Exception:
        return False


def require_auth(
    session: Optional[str] = Cookie(default=None, alias=COOKIE_NAME),
    settings: Settings = Depends(get_settings),
) -> None:
    if not verify_session_token(session, settings):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")


def set_auth_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=settings.session_ttl_seconds,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/")
