from fastapi import APIRouter, Request, HTTPException
from datetime import datetime, timezone
import uuid
import secrets
import logging

from models import CaregiverInviteRequest, CaregiverPreferencesUpdate

logger = logging.getLogger(__name__)

INVITE_BASE_URL = "https://diabexpert.online/invite"

router = APIRouter(prefix="/api/caregiver")

db = None

def set_db(database):
    global db
    db = database

async def get_current_user(request: Request):
    from auth import get_current_user as auth_get_current_user
    return await auth_get_current_user(request, db)


# ==================== PATIENT APIs ====================

@router.post("/invite")
async def create_caregiver_invite(request: Request, body: CaregiverInviteRequest):
    """Patient creates an invite for their caregiver. Returns the WhatsApp share URL."""
    user = await get_current_user(request)
    patient_id = user["id"]

    # Check if patient already has a linked caregiver
    existing = await db.caregiver_links.find_one(
        {"patient_user_id": patient_id, "invite_status": {"$in": ["pending", "accepted"]}},
        {"_id": 0}
    )
    if existing and existing.get("invite_status") == "accepted":
        raise HTTPException(status_code=400, detail="You already have a linked caregiver. Please unlink first.")

    # If there's a pending invite, revoke it and create a new one
    if existing and existing.get("invite_status") == "pending":
        await db.caregiver_links.update_one(
            {"id": existing["id"]},
            {"$set": {"invite_status": "expired", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

    # Generate invite token
    invite_token = secrets.token_urlsafe(32)

    phone = body.caregiver_phone.strip().replace(" ", "")

    link_doc = {
        "id": str(uuid.uuid4()),
        "patient_user_id": patient_id,
        "caregiver_user_id": None,
        "caregiver_phone": phone,
        "invite_token": invite_token,
        "invite_status": "pending",
        "notify_on_taken": True,
        "notify_on_missed": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.caregiver_links.insert_one(link_doc)
    link_doc.pop("_id", None)

    invite_link = f"{INVITE_BASE_URL}/{invite_token}"
    patient_name = user.get("name", "A patient")

    message = (
        f"Hi! I'm {patient_name} and I'd like you to be my health caregiver on Careable 360+. "
        f"You'll receive updates about my medication status. "
        f"Click here to connect: {invite_link}"
    )

    # Build wa.me URL with phone (ensure country code)
    wa_phone = phone if phone.startswith("91") else f"91{phone}"
    whatsapp_url = f"https://wa.me/{wa_phone}?text={message}"

    logger.info(f"[Caregiver] Invite created by {user.get('email')} for phone {phone}")

    return {
        "invite_token": invite_token,
        "invite_link": invite_link,
        "whatsapp_url": whatsapp_url,
        "message": message,
        "caregiver_phone": phone,
    }


@router.get("/my-caregiver")
async def get_my_caregiver(request: Request):
    """Patient views their linked caregiver info."""
    user = await get_current_user(request)

    link = await db.caregiver_links.find_one(
        {"patient_user_id": user["id"], "invite_status": {"$in": ["pending", "accepted"]}},
        {"_id": 0}
    )
    if not link:
        return {"linked": False}

    result = {
        "linked": link.get("invite_status") == "accepted",
        "invite_status": link.get("invite_status"),
        "caregiver_phone": link.get("caregiver_phone"),
        "notify_on_taken": link.get("notify_on_taken", True),
        "notify_on_missed": link.get("notify_on_missed", True),
        "created_at": link.get("created_at"),
    }

    # If accepted, include caregiver name
    if link.get("caregiver_user_id"):
        cg = await db.users.find_one({"id": link["caregiver_user_id"]}, {"_id": 0, "name": 1, "email": 1, "picture": 1})
        if cg:
            result["caregiver_name"] = cg.get("name")
            result["caregiver_email"] = cg.get("email")
            result["caregiver_picture"] = cg.get("picture")

    return result


@router.delete("/unlink")
async def unlink_caregiver(request: Request):
    """Either patient or caregiver can unlink."""
    user = await get_current_user(request)
    uid = user["id"]

    # Check if user is patient or caregiver in any active link
    link = await db.caregiver_links.find_one(
        {
            "$or": [
                {"patient_user_id": uid},
                {"caregiver_user_id": uid}
            ],
            "invite_status": {"$in": ["pending", "accepted"]}
        }
    )
    if not link:
        raise HTTPException(status_code=404, detail="No active caregiver link found")

    await db.caregiver_links.update_one(
        {"id": link["id"]},
        {"$set": {"invite_status": "unlinked", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    logger.info(f"[Caregiver] Link {link['id']} unlinked by user {uid}")
    return {"message": "Caregiver link removed successfully"}


# ==================== INVITE ACCEPTANCE APIs ====================

@router.get("/invite/{token}")
async def get_invite_details(token: str):
    """Public endpoint: get invite details so the caregiver can see who invited them."""
    link = await db.caregiver_links.find_one({"invite_token": token}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Invite not found or expired")
    if link.get("invite_status") != "pending":
        raise HTTPException(status_code=400, detail=f"This invite is already {link.get('invite_status')}")

    patient = await db.users.find_one({"id": link["patient_user_id"]}, {"_id": 0, "name": 1, "picture": 1})

    return {
        "patient_name": patient.get("name") if patient else "Unknown",
        "patient_picture": patient.get("picture") if patient else None,
        "invite_status": link.get("invite_status"),
    }


@router.post("/accept/{token}")
async def accept_invite(request: Request, token: str):
    """Authenticated caregiver accepts the invite."""
    user = await get_current_user(request)
    cg_id = user["id"]

    link = await db.caregiver_links.find_one({"invite_token": token}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Invite not found or expired")
    if link.get("invite_status") != "pending":
        raise HTTPException(status_code=400, detail=f"This invite is already {link.get('invite_status')}")
    if link.get("patient_user_id") == cg_id:
        raise HTTPException(status_code=400, detail="You cannot be your own caregiver")

    await db.caregiver_links.update_one(
        {"id": link["id"]},
        {"$set": {
            "caregiver_user_id": cg_id,
            "invite_status": "accepted",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    patient = await db.users.find_one({"id": link["patient_user_id"]}, {"_id": 0, "name": 1})
    logger.info(f"[Caregiver] Invite accepted by {user.get('email')} for patient {link['patient_user_id']}")

    return {
        "message": "You are now linked as a caregiver",
        "patient_name": patient.get("name") if patient else "Unknown",
        "patient_user_id": link["patient_user_id"],
    }


# ==================== CAREGIVER DASHBOARD APIs ====================

@router.get("/my-patient")
async def get_my_patient(request: Request):
    """Caregiver views the patient they are linked to."""
    user = await get_current_user(request)

    link = await db.caregiver_links.find_one(
        {"caregiver_user_id": user["id"], "invite_status": "accepted"},
        {"_id": 0}
    )
    if not link:
        return {"linked": False}

    patient = await db.users.find_one(
        {"id": link["patient_user_id"]},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "picture": 1, "phone": 1, "age": 1, "sex": 1, "diabetes_type": 1}
    )

    return {
        "linked": True,
        "patient": patient,
        "notify_on_taken": link.get("notify_on_taken", True),
        "notify_on_missed": link.get("notify_on_missed", True),
    }


@router.get("/patient/{patient_id}/medications")
async def get_patient_medications(request: Request, patient_id: str):
    """Caregiver views patient's medications."""
    user = await get_current_user(request)

    # Verify caregiver link
    link = await db.caregiver_links.find_one(
        {"caregiver_user_id": user["id"], "patient_user_id": patient_id, "invite_status": "accepted"}
    )
    if not link:
        raise HTTPException(status_code=403, detail="You are not linked as caregiver for this patient")

    medications = await db.medications.find(
        {"user_id": patient_id},
        {"_id": 0}
    ).sort("name", 1).to_list(100)

    return medications


@router.get("/patient/{patient_id}/adherence")
async def get_patient_adherence(request: Request, patient_id: str, date: str = None):
    """Caregiver views patient's adherence logs for a given date (defaults to today)."""
    user = await get_current_user(request)

    link = await db.caregiver_links.find_one(
        {"caregiver_user_id": user["id"], "patient_user_id": patient_id, "invite_status": "accepted"}
    )
    if not link:
        raise HTTPException(status_code=403, detail="You are not linked as caregiver for this patient")

    from datetime import timedelta
    if not date:
        now_ist = datetime.now(timezone(timedelta(hours=5, minutes=30)))
        date = now_ist.strftime('%Y-%m-%d')

    logs = await db.adherence_logs.find(
        {"user_id": patient_id, "date": date},
        {"_id": 0}
    ).sort("scheduled_time", 1).to_list(100)

    # Enrich with medication names
    for log in logs:
        med = await db.medications.find_one({"id": log.get("medication_id")}, {"_id": 0, "name": 1, "dosage": 1, "form": 1})
        if med:
            log["medication_name"] = med.get("name")
            log["medication_dosage"] = med.get("dosage")
            log["medication_form"] = med.get("form")

    return logs


@router.put("/preferences")
async def update_notification_preferences(request: Request, body: CaregiverPreferencesUpdate):
    """Caregiver updates their notification preferences."""
    user = await get_current_user(request)

    link = await db.caregiver_links.find_one(
        {"caregiver_user_id": user["id"], "invite_status": "accepted"}
    )
    if not link:
        raise HTTPException(status_code=404, detail="No active caregiver link found")

    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.notify_on_taken is not None:
        update_data["notify_on_taken"] = body.notify_on_taken
    if body.notify_on_missed is not None:
        update_data["notify_on_missed"] = body.notify_on_missed

    await db.caregiver_links.update_one({"id": link["id"]}, {"$set": update_data})

    logger.info(f"[Caregiver] Preferences updated by {user.get('email')}: taken={body.notify_on_taken}, missed={body.notify_on_missed}")
    return {"message": "Preferences updated", "notify_on_taken": body.notify_on_taken, "notify_on_missed": body.notify_on_missed}
