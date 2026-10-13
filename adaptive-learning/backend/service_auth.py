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


def is_staff(identity) -> bool:
    """Another service, a teacher or an admin: may read any learner's data."""
    return has_role(identity, TEACHER_ROLES)


def is_service(identity) -> bool:
    return bool(identity) and identity.get("role") == "service"


def owns(identity, student_id, aliases=None) -> bool:
    """May this caller act on `student_id`'s data? Staff always may. A
    student may only when it is their own id: the `userId` inside their
    token (or one of its `aliases`, e.g. the pseudonym of that id).
    "anonymous" carries no personal data and is allowed."""
    if is_staff(identity):
        return True
    if not identity or student_id is None:
        return False
    sid = str(student_id)
    if sid in ("", "anonymous"):
        return True
    own = str(identity.get("userId", ""))
    allowed = {own}
    if aliases and own:
        allowed.update(str(x) for x in aliases(own))
    return bool(own) and sid in allowed


_ID_KEYS = ("student_id", "studentId")
_FORBIDDEN = {"success": False, "error": "You do not have permission to do this", "reason": "forbidden"}


# ------------------------------------------------------------------ Flask
def protect_flask(app, teacher_only=(), service_only=(), id_aliases=None):
    """Guards a Flask app.

    1. Every request needs a valid credential (401 otherwise).
    2. `service_only` / `teacher_only` are sets of (METHOD, url rule), e.g.
       ("GET", "/students/<student_id>/history"). They are refused (403) for
       anyone else.
    3. Ownership: a student may only name their own id. Any `student_id` /
       `studentId` found in the URL, the query string or the JSON body is
       compared with the id inside their token, so a student who edits the
       id in a request gets 403 instead of another learner's data.

    The caller's identity is left on flask.g.identity."""
    from flask import g, jsonify, request

    teacher_only, service_only = set(teacher_only), set(service_only)

    @app.before_request
    def _require_credentials():
        g.identity = None
        if not ENABLED or is_public(request.method, request.path):
            return None
        identity = identify(request.headers.get("Authorization", ""), request.headers.get("X-Internal-Token", ""))
        if identity is None:
            return jsonify({"success": False, "error": "Authentication required", "reason": "unauthenticated"}), 401
        g.identity = identity

        key = (request.method, request.url_rule.rule if request.url_rule else request.path)
        if key in service_only and not is_service(identity):
            return jsonify(_FORBIDDEN), 403
        if key in teacher_only and not is_staff(identity):
            return jsonify(_FORBIDDEN), 403

        if not is_staff(identity):
            named = [(request.view_args or {}).get(k) for k in _ID_KEYS] + [request.args.get(k) for k in _ID_KEYS]
            body = request.get_json(silent=True) if request.method in ("POST", "PUT", "PATCH", "DELETE") else None
            if isinstance(body, dict):
                named += [body.get(k) for k in _ID_KEYS]
            for student_id in named:
                if student_id is not None and not owns(identity, student_id, id_aliases):
                    return jsonify(_FORBIDDEN), 403
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
def protect_fastapi(app, teacher_only=(), service_only=()):
    """Same rules as protect_flask, as HTTP middleware. `teacher_only` /
    `service_only` are sets of (METHOD, path). A `student_id` in the query
    string is checked here; ids in a JSON body are checked by the route with
    ensure_owner(), because middleware must not consume the body. Register
    this BEFORE CORSMiddleware so CORS stays the outer layer and a 401/403
    still carries the CORS headers the browser needs to read it. WebSocket
    routes are not covered by HTTP middleware; they call identify() and
    owns() themselves."""
    from fastapi import Request
    from fastapi.responses import JSONResponse

    teacher_only, service_only = set(teacher_only), set(service_only)

    @app.middleware("http")
    async def _require_credentials(request: Request, call_next):
        request.state.identity = None
        if ENABLED and not is_public(request.method, request.url.path):
            identity = identify(request.headers.get("authorization", ""), request.headers.get("x-internal-token", ""))
            if identity is None:
                return JSONResponse(status_code=401, content={"success": False, "detail": "Authentication required", "reason": "unauthenticated"})
            request.state.identity = identity
            key = (request.method, request.url.path.rstrip("/") or "/")
            if (key in service_only and not is_service(identity)) or (key in teacher_only and not is_staff(identity)):
                return JSONResponse(status_code=403, content={"success": False, "detail": _FORBIDDEN["error"], "reason": "forbidden"})
            if not is_staff(identity):
                for k in _ID_KEYS:
                    value = request.query_params.get(k)
                    if value is not None and not owns(identity, value):
                        return JSONResponse(status_code=403, content={"success": False, "detail": _FORBIDDEN["error"], "reason": "forbidden"})
        return await call_next(request)


def ensure_owner(request, student_id):
    """For FastAPI routes that receive a student id in the JSON body:
    raises 403 unless the caller may act on that learner's data."""
    from fastapi import HTTPException

    if ENABLED and not owns(getattr(request.state, "identity", None), student_id):
        raise HTTPException(status_code=403, detail=_FORBIDDEN["error"])


def fastapi_require_role(*roles):
    """Dependency: the route needs a logged-in user with one of `roles`."""
    from fastapi import HTTPException, Request

    async def dependency(request: Request):
        if ENABLED and not has_role(getattr(request.state, "identity", None), roles):
            raise HTTPException(status_code=403, detail="You do not have permission to do this")
    return dependency
