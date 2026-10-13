"""Shared request authentication for the Python services (R26-IT-097).

Every service accepts a request only if it carries one of:

  * ``Authorization: Bearer <JWT>`` - the token the account service
    (backend/, Express) issues at login, signed HS256 with JWT_SECRET.
  * ``X-Internal-Token: <INTERNAL_SERVICE_TOKEN>`` - used for the
    service-to-service calls (emotion-service -> emotion-backend ->
    analytics-service, and so on), which have no logged-in user.

Health checks, CORS pre-flights and the public short-notes PDFs stay open.
Only the standard library is used, so no service gains a dependency.

This file is deliberately identical in every service folder (like
anonymize.py). Change all copies together.

Settings (environment variable, or the repository's root .env):
  JWT_SECRET              same secret the account service signs with
  INTERNAL_SERVICE_TOKEN  shared secret for service-to-service calls
  SERVICE_AUTH_ENABLED    "false" switches checks off (local debugging only)
"""
import base64
import hashlib
import hmac
import json
import os
import time
from pathlib import Path

TEACHER_ROLES = ("teacher", "admin")

_PUBLIC_EXACT = {"/", "/health", "/api/health", "/docs", "/openapi.json", "/redoc", "/favicon.ico"}
_PUBLIC_PREFIXES = ("/static/notes/",)


def _root_env() -> dict:
    """KEY=VALUE pairs from the first .env above this file that defines
    JWT_SECRET (the repository root's .env, shared with backend/)."""
    for parent in Path(__file__).resolve().parents:
        candidate = parent / ".env"
        if not candidate.is_file():
            continue
        values = {}
        try:
            for line in candidate.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                values[key.strip()] = value.strip().strip('"').strip("'")
        except OSError:
            continue
        if "JWT_SECRET" in values:
            return values
    return {}


_ENV = _root_env()


def _setting(name: str, default: str = "") -> str:
    return os.environ.get(name) or _ENV.get(name) or default


JWT_SECRET = _setting("JWT_SECRET")
INTERNAL_TOKEN = _setting("INTERNAL_SERVICE_TOKEN")
ENABLED = _setting("SERVICE_AUTH_ENABLED", "true").lower() != "false"


def _b64url_decode(part: str) -> bytes:
    return base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))


def verify_jwt(token: str):
    """Returns the payload of a valid, unexpired HS256 token, else None."""
    if not token or not JWT_SECRET:
        return None
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
        header = json.loads(_b64url_decode(header_b64))
        if header.get("alg") != "HS256":  # never trust "none" or another algorithm
            return None
        expected = hmac.new(JWT_SECRET.encode(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64url_decode(signature_b64)):
            return None
        payload = json.loads(_b64url_decode(payload_b64))
        if "exp" in payload and time.time() >= float(payload["exp"]):
            return None
        return payload
    except Exception:
        return None


def internal_headers() -> dict:
    """Headers for an outgoing service-to-service request."""
    return {"X-Internal-Token": INTERNAL_TOKEN} if INTERNAL_TOKEN else {}


def is_public(method: str, path: str) -> bool:
    return method == "OPTIONS" or path in _PUBLIC_EXACT or path.startswith(_PUBLIC_PREFIXES)


def identify(authorization: str = "", internal_token: str = "", query_token: str = ""):
    """Who is calling: {"role": "service"} for another service, the JWT
    payload ({"userId", "email", "role", ...}) for a logged-in user, or
    None if the request carries no valid credential."""
    if internal_token and INTERNAL_TOKEN and hmac.compare_digest(internal_token, INTERNAL_TOKEN):
        return {"role": "service"}
    token = query_token or ""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    return verify_jwt(token)


def has_role(identity, roles) -> bool:
    """Other services are trusted for every role; users need one of `roles`."""
    return bool(identity) and (identity.get("role") == "service" or identity.get("role") in roles)


# ------------------------------------------------------------------ Flask
def protect_flask(app):
    """Rejects unauthenticated requests to a Flask app with 401. The caller's
    identity is left on flask.g.identity for role checks."""
    from flask import g, jsonify, request

    @app.before_request
    def _require_credentials():
        g.identity = None
        if not ENABLED or is_public(request.method, request.path):
            return None
        g.identity = identify(request.headers.get("Authorization", ""), request.headers.get("X-Internal-Token", ""))
        if g.identity is None:
            return jsonify({"success": False, "error": "Authentication required", "reason": "unauthenticated"}), 401
        return None


def flask_require_role(*roles):
    """Decorator: the route needs a logged-in user with one of `roles`."""
    from functools import wraps
    from flask import g, jsonify

    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            if ENABLED and not has_role(getattr(g, "identity", None), roles):
                return jsonify({"success": False, "error": "You do not have permission to do this", "reason": "forbidden"}), 403
            return view(*args, **kwargs)
        return wrapper
    return decorator


# ------------------------------------------------------------------ FastAPI
def protect_fastapi(app):
    """Same check as protect_flask, as HTTP middleware. Register it BEFORE
    CORSMiddleware so CORS stays the outer layer and a 401 still carries the
    CORS headers the browser needs to read it. WebSocket routes are not
    covered by HTTP middleware; they call identify(query_token=...) themselves."""
    from fastapi import Request
    from fastapi.responses import JSONResponse

    @app.middleware("http")
    async def _require_credentials(request: Request, call_next):
        request.state.identity = None
        if ENABLED and not is_public(request.method, request.url.path):
            request.state.identity = identify(request.headers.get("authorization", ""), request.headers.get("x-internal-token", ""))
            if request.state.identity is None:
                return JSONResponse(status_code=401, content={"success": False, "detail": "Authentication required", "reason": "unauthenticated"})
        return await call_next(request)


def fastapi_require_role(*roles):
    """Dependency: the route needs a logged-in user with one of `roles`."""
    from fastapi import HTTPException, Request

    async def dependency(request: Request):
        if ENABLED and not has_role(getattr(request.state, "identity", None), roles):
            raise HTTPException(status_code=403, detail="You do not have permission to do this")
    return dependency
