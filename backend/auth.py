from fastapi import Request, HTTPException, status
from typing import Optional
from datetime import datetime, timedelta, timezone
import requests
import logging

logger = logging.getLogger(__name__)

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

async def get_current_user(request: Request, db) -> dict:
    """
    Get current authenticated user from session token (Emergent OAuth)
    OR JWT (email/password). JWT is tried first; falls back to Emergent.
    """
    # Try JWT first (cookie or Bearer header)
    from jwt_auth import try_jwt_auth
    jwt_user = await try_jwt_auth(request, db)
    if jwt_user:
        return jwt_user

    # Fallback: Emergent OAuth session_token (cookie or non-JWT Bearer)
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            candidate = auth_header.replace("Bearer ", "")
            # JWTs have exactly two dots; Emergent session_tokens are opaque random strings
            if candidate.count(".") != 2:
                session_token = candidate

    if session_token:
        session = await db.sessions.find_one({"session_token": session_token})
        if session:
            expires_at = session["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at < datetime.now(timezone.utc):
                await db.sessions.delete_one({"_id": session["_id"]})
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session expired",
                )
            user = await db.users.find_one({"id": session["user_id"]})
            if user:
                return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
    )

async def get_session_data_from_emergent(session_id: str) -> dict:
    """
    Exchange session_id for user data and session_token from Emergent.
    """
    try:
        response = requests.get(
            EMERGENT_SESSION_URL,
            headers={"X-Session-ID": session_id},
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to get session data from Emergent: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to authenticate with Emergent"
        )

def determine_user_role(email: str) -> str:
    """
    Determine user role based on email address.
    Centralized role management for easy maintenance.
    """
    # Admin emails (future use)
    admin_emails = [
        "admin@careable360plus.com",
    ]
    
    # Prescription Manager emails
    prescription_manager_emails = [
        "careable360plus@gmail.com",
    ]
    
    # Check role assignments
    if email in admin_emails:
        return "admin"
    elif email in prescription_manager_emails:
        return "prescription_manager"
    else:
        return "user"

async def create_or_update_user(db, user_data: dict) -> dict:
    """
    Create new user or update existing user's role if needed.
    Checks and updates role on every login based on email.
    """
    email = user_data["email"]
    
    # Determine correct role for this email
    correct_role = determine_user_role(email)
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": email})
    
    if existing_user:
        # Check if role needs updating
        current_role = existing_user.get("role", "user")
        
        if current_role != correct_role:
            # Update role in database
            logger.info(f"Updating role for {email}: {current_role} -> {correct_role}")
            await db.users.update_one(
                {"email": email},
                {"$set": {"role": correct_role, "updated_at": datetime.utcnow().isoformat()}}
            )
            # Update the existing_user dict to reflect new role
            existing_user["role"] = correct_role
            existing_user["updated_at"] = datetime.utcnow().isoformat()
        
        return existing_user
    
    # Create new user with correct role
    from models import User
    user = User(
        email=email,
        name=user_data["name"],
        picture=user_data.get("picture"),
        role=correct_role
    )
    
    user_dict = user.dict()
    # Convert datetime to ISO string
    user_dict["created_at"] = user_dict["created_at"].isoformat()
    user_dict["updated_at"] = user_dict["updated_at"].isoformat()
    
    await db.users.insert_one(user_dict)
    
    logger.info(f"Created new user {email} with role: {correct_role}")
    
    # Create default notification settings
    from models import NotificationSettings
    notification_settings = NotificationSettings(user_id=user.id)
    notif_dict = notification_settings.dict()
    notif_dict["updated_at"] = notif_dict["updated_at"].isoformat()
    await db.notification_settings.insert_one(notif_dict)
    
    return user_dict

async def create_session(db, user_id: str, session_token: str) -> dict:
    """
    Create new session in database.
    """
    from models import Session
    
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session = Session(
        user_id=user_id,
        session_token=session_token,
        expires_at=expires_at
    )
    
    session_dict = session.dict()
    # Convert datetime to ISO string for MongoDB
    session_dict["expires_at"] = session_dict["expires_at"].isoformat()
    session_dict["created_at"] = session_dict["created_at"].isoformat()
    
    await db.sessions.insert_one(session_dict)
    
    return session_dict

async def delete_session(db, session_token: str):
    """
    Delete session from database.
    """
    await db.sessions.delete_one({"session_token": session_token})

async def get_prescription_manager(request: Request, db) -> dict:
    """
    Get current authenticated user and verify they have prescription_manager role.
    """
    user = await get_current_user(request, db)
    
    if user.get("role") != "prescription_manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Prescription manager role required."
        )
    
    return user
