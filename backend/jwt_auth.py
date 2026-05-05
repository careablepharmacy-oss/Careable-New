"""
JWT email/password authentication — works ALONGSIDE the existing Emergent OAuth flow.
Endpoints:
    POST /api/auth/jwt-register
    POST /api/auth/jwt-login
    POST /api/auth/jwt-logout
The same /api/auth/me works for both auth methods (handled by get_current_user in auth.py).
"""
import os
import re
import bcrypt
import jwt as pyjwt
import uuid
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from auth import determine_user_role

logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TTL_MIN = 60 * 24       # 1 day
REFRESH_TOKEN_TTL_DAYS = 30
LOCKOUT_THRESHOLD = 5
LOCKOUT_WINDOW_MIN = 15

PASSWORD_MIN_LEN = 8


def _jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET env var is not set")
    return secret


# ---------------------- Password hashing ----------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ---------------------- JWT helpers ----------------------
def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_TTL_MIN),
        "iat": datetime.now(timezone.utc),
    }
    return pyjwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_TTL_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return pyjwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> dict:
    """Returns payload dict, or raises HTTPException(401)."""
    try:
        return pyjwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------------- Pydantic schemas ----------------------
class JWTRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LEN)
    name: str = Field(min_length=1, max_length=100)
    phone: str | None = None


class JWTLoginRequest(BaseModel):
    email: EmailStr
    password: str


# ---------------------- Brute-force protection ----------------------
async def _check_lockout(db, identifier: str):
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=LOCKOUT_WINDOW_MIN)
    cutoff_iso = cutoff.isoformat()
    fails = await db.login_attempts.count_documents(
        {"identifier": identifier, "ts": {"$gte": cutoff_iso}, "success": False}
    )
    if fails >= LOCKOUT_THRESHOLD:
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in {LOCKOUT_WINDOW_MIN} minutes.",
        )


async def _record_attempt(db, identifier: str, success: bool):
    await db.login_attempts.insert_one(
        {
            "identifier": identifier,
            "success": success,
            "ts": datetime.now(timezone.utc).isoformat(),
        }
    )
    if success:
        # Clear failures for this identifier on success
        await db.login_attempts.delete_many(
            {"identifier": identifier, "success": False}
        )


def _client_id(request: Request, email: str) -> str:
    # Prefer client IP from X-Forwarded-For (k8s/proxy), fallback to request.client.host
    ip = None
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        ip = fwd.split(",")[0].strip()
    if not ip:
        ip = request.headers.get("x-real-ip")
    if not ip:
        ip = request.client.host if request.client else "unknown"
    return f"{ip}:{email.lower()}"


# ---------------------- Cookie helpers ----------------------
def _set_auth_cookies(response: Response, access: str, refresh: str):
    # Clear any stale Emergent OAuth session_token cookie so JWT auth is unambiguous
    response.delete_cookie("session_token", path="/")
    # secure=True is fine on HTTPS; samesite=none lets it work across the preview origin
    response.set_cookie(
        key="access_token",
        value=access,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=ACCESS_TOKEN_TTL_MIN * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=REFRESH_TOKEN_TTL_DAYS * 86400,
        path="/",
    )


def _clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


def _strip_user(user: dict) -> dict:
    """Remove sensitive fields before returning user to client."""
    safe = {k: v for k, v in user.items() if k not in ("password_hash", "_id")}
    return safe


# ---------------------- Router builder ----------------------
def build_jwt_auth_router(db) -> APIRouter:
    router = APIRouter(prefix="/auth", tags=["auth-jwt"])

    @router.post("/jwt-register")
    async def jwt_register(payload: JWTRegisterRequest, response: Response):
        email_lower = payload.email.lower().strip()

        existing = await db.users.find_one({"email": email_lower})
        if existing and existing.get("password_hash"):
            raise HTTPException(
                status_code=400,
                detail="An account with this email already exists. Please login.",
            )

        role = determine_user_role(email_lower)
        now_iso = datetime.now(timezone.utc).isoformat()
        password_hash = hash_password(payload.password)

        if existing:
            # Existing user (e.g. from Google OAuth) — attach a password to their account
            await db.users.update_one(
                {"email": email_lower},
                {
                    "$set": {
                        "password_hash": password_hash,
                        "name": existing.get("name") or payload.name,
                        "phone": existing.get("phone") or payload.phone,
                        "updated_at": now_iso,
                    }
                },
            )
            user_doc = await db.users.find_one({"email": email_lower})
        else:
            user_doc = {
                "id": str(uuid.uuid4()),
                "email": email_lower,
                "name": payload.name,
                "phone": payload.phone,
                "picture": None,
                "role": role,
                "password_hash": password_hash,
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            await db.users.insert_one(user_doc)

            # Default notification settings (mirrors Emergent OAuth flow)
            await db.notification_settings.insert_one(
                {
                    "id": str(uuid.uuid4()),
                    "user_id": user_doc["id"],
                    "medication_reminders": True,
                    "appointment_reminders": True,
                    "health_tips": False,
                    "email_notifications": True,
                    "push_notifications": True,
                    "alarm_enabled": True,
                    "updated_at": now_iso,
                }
            )

        access = create_access_token(user_doc["id"], email_lower)
        refresh = create_refresh_token(user_doc["id"])
        _set_auth_cookies(response, access, refresh)

        return {
            "user": _strip_user(user_doc),
            "access_token": access,
            "auth_method": "jwt",
        }

    @router.post("/jwt-login")
    async def jwt_login(payload: JWTLoginRequest, request: Request, response: Response):
        email_lower = payload.email.lower().strip()
        identifier = _client_id(request, email_lower)

        await _check_lockout(db, identifier)

        user = await db.users.find_one({"email": email_lower})
        if not user or not user.get("password_hash"):
            await _record_attempt(db, identifier, success=False)
            raise HTTPException(status_code=401, detail="Invalid email or password")

        if not verify_password(payload.password, user["password_hash"]):
            await _record_attempt(db, identifier, success=False)
            raise HTTPException(status_code=401, detail="Invalid email or password")

        # Re-evaluate role on every login (mirrors Emergent OAuth flow)
        correct_role = determine_user_role(email_lower)
        if user.get("role") != correct_role:
            await db.users.update_one(
                {"email": email_lower},
                {"$set": {"role": correct_role, "updated_at": datetime.now(timezone.utc).isoformat()}},
            )
            user["role"] = correct_role

        await _record_attempt(db, identifier, success=True)

        access = create_access_token(user["id"], email_lower)
        refresh = create_refresh_token(user["id"])
        _set_auth_cookies(response, access, refresh)

        return {
            "user": _strip_user(user),
            "access_token": access,
            "auth_method": "jwt",
        }

    @router.post("/jwt-logout")
    async def jwt_logout(response: Response):
        _clear_auth_cookies(response)
        return {"ok": True}

    @router.post("/jwt-refresh")
    async def jwt_refresh(request: Request, response: Response):
        token = request.cookies.get("refresh_token")
        if not token:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]
        if not token:
            raise HTTPException(status_code=401, detail="No refresh token")
        payload = decode_jwt(token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access = create_access_token(user["id"], user["email"])
        # Keep existing refresh; just refresh the access cookie
        response.set_cookie(
            key="access_token",
            value=access,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=ACCESS_TOKEN_TTL_MIN * 60,
            path="/",
        )
        return {"access_token": access}

    return router


# ---------------------- Helper for get_current_user ----------------------
async def try_jwt_auth(request: Request, db) -> dict | None:
    """
    Try to authenticate via JWT (cookie or bearer). Returns user dict or None.
    Used as a fallback path inside get_current_user in auth.py.
    """
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            candidate = auth_header[7:]
            # Heuristic: JWT has exactly 2 dots; Emergent session_token usually does not.
            if candidate.count(".") == 2:
                token = candidate
    if not token:
        return None
    try:
        payload = pyjwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
    except pyjwt.PyJWTError:
        return None
    if payload.get("type") != "access":
        return None
    user = await db.users.find_one({"id": payload.get("sub")})
    return user
