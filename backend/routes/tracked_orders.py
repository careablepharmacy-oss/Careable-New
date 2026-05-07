"""Tracked delivery orders.

Admin routes (/api/crm/tracked-orders):
  - PM/Admin can create, list, manually override, refresh, delete.
Patient routes (/api/users/me/tracked-orders):
  - Authenticated user can list their own and trigger a refresh.

Background scheduler refreshes non-terminal orders every 3 hours.
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
import logging
from datetime import datetime, timezone, timedelta

from auth import get_current_user, get_prescription_manager
from services.delivery_tracker import (
    detect_carrier,
    extract_waybill,
    fetch_delivery_status,
    compute_flags,
    TERMINAL_STATUSES,
)

logger = logging.getLogger(__name__)

db = None
COLL = "tracked_orders"


def set_db(database):
    global db
    db = database


# ----------------- Models -----------------

ALLOWED_TYPES = ("medicine", "injection", "product")
ALLOWED_STATUSES = (
    "Pending", "Shipped", "In Transit", "Out for Delivery",
    "Delivered", "Cancelled", "Failed",
)


class TrackedOrderCreate(BaseModel):
    user_id: str
    type: str = "medicine"
    label: Optional[str] = None
    tracking_url: str
    notes: Optional[str] = None


class TrackedOrderManualUpdate(BaseModel):
    status: Optional[str] = None
    label: Optional[str] = None
    notes: Optional[str] = None
    cancel_override: Optional[bool] = False  # set true to clear manual_override


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _public(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return doc
    doc = {k: v for k, v in doc.items() if k != "_id"}
    return doc


# ----------------- Internal helpers -----------------

async def _refresh_one(order: Dict[str, Any]) -> Dict[str, Any]:
    """Hit the tracker, persist new status; respect manual_override."""
    if order.get("manual_override"):
        return order

    url = order.get("tracking_url")
    if not url:
        return order

    try:
        result = await fetch_delivery_status(url)
    except Exception as e:
        logger.warning(f"[Tracker] Failed for order {order.get('id')}: {e}")
        await db[COLL].update_one(
            {"id": order["id"]},
            {"$set": {"last_error": str(e)[:300], "last_checked_at": _now_iso()}},
        )
        order["last_error"] = str(e)[:300]
        order["last_checked_at"] = _now_iso()
        return order

    is_stuck, is_delayed = compute_flags(result["status"], result.get("last_event_at"))
    update = {
        "carrier": result.get("carrier") or order.get("carrier"),
        "waybill": result.get("waybill") or order.get("waybill"),
        "status": result["status"],
        "current_location": result.get("current_location") or "",
        "last_event": result.get("last_event") or "",
        "last_event_at": result.get("last_event_at"),
        "events": result.get("events") or [],
        "flags": {"stuck": is_stuck, "delayed": is_delayed},
        "last_checked_at": _now_iso(),
        "last_error": None,
        "updated_at": _now_iso(),
    }
    await db[COLL].update_one({"id": order["id"]}, {"$set": update})
    order.update(update)
    return order


async def refresh_all_pending() -> Dict[str, int]:
    """Scheduler job: refresh every non-terminal, non-overridden order."""
    if db is None:
        return {"checked": 0, "updated": 0}

    pending = await db[COLL].find({
        "manual_override": {"$ne": True},
        "status": {"$nin": list(TERMINAL_STATUSES)},
    }).to_list(length=500)

    updated = 0
    for order in pending:
        prev_status = order.get("status")
        await _refresh_one(order)
        new_status = order.get("status")
        if new_status != prev_status:
            updated += 1
    logger.info(f"[Tracker] Refresh cycle done: checked={len(pending)} status_changed={updated}")
    return {"checked": len(pending), "updated": updated}


# ===================== ADMIN (CRM) ROUTER =====================

admin_router = APIRouter(
    prefix="/api/crm/tracked-orders",
    tags=["tracked-orders-admin"],
)


async def _require_pm(request: Request):
    return await get_prescription_manager(request, db)


@admin_router.post("", dependencies=[Depends(_require_pm)])
async def admin_create_order(payload: TrackedOrderCreate, request: Request):
    if payload.type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"type must be one of {ALLOWED_TYPES}")

    user = await db.users.find_one({"id": payload.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    pm = await get_prescription_manager(request, db)
    carrier = detect_carrier(payload.tracking_url)
    waybill = extract_waybill(payload.tracking_url)

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": payload.user_id,
        "type": payload.type,
        "label": (payload.label or "").strip() or None,
        "tracking_url": payload.tracking_url.strip(),
        "carrier": carrier,
        "waybill": waybill,
        "status": "Pending",
        "current_location": "",
        "last_event": "",
        "last_event_at": None,
        "events": [],
        "flags": {"stuck": False, "delayed": False},
        "manual_override": False,
        "notes": payload.notes,
        "created_by": pm["id"],
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "last_checked_at": None,
        "last_error": None,
    }
    await db[COLL].insert_one(doc.copy())

    # Try first refresh inline; ignore errors (scheduler will retry)
    try:
        await _refresh_one(doc)
    except Exception as e:
        logger.debug(f"[Tracker] Initial refresh failed: {e}")

    saved = await db[COLL].find_one({"id": doc["id"]}, {"_id": 0})
    return _public(saved)


@admin_router.get("", dependencies=[Depends(_require_pm)])
async def admin_list_orders(
    user_id: Optional[str] = None,
    flagged_only: bool = False,
    active_only: bool = False,
    limit: int = 200,
):
    q: Dict[str, Any] = {}
    if user_id:
        q["user_id"] = user_id
    if flagged_only:
        q["$or"] = [{"flags.stuck": True}, {"flags.delayed": True}]
    if active_only:
        q["status"] = {"$nin": list(TERMINAL_STATUSES)}

    cur = db[COLL].find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = await cur.to_list(length=limit)

    # enrich with patient name for the dashboard widget
    user_ids = list({i["user_id"] for i in items})
    users = await db.users.find(
        {"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1, "phone": 1}
    ).to_list(length=len(user_ids))
    by_id = {u["id"]: u for u in users}
    for it in items:
        u = by_id.get(it["user_id"]) or {}
        it["patient_name"] = u.get("name") or "Unknown"
        it["patient_phone"] = u.get("phone") or ""
    return items


@admin_router.get("/{order_id}", dependencies=[Depends(_require_pm)])
async def admin_get_order(order_id: str):
    doc = await db[COLL].find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    return doc


@admin_router.patch("/{order_id}", dependencies=[Depends(_require_pm)])
async def admin_update_order(order_id: str, body: TrackedOrderManualUpdate):
    doc = await db[COLL].find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")

    update: Dict[str, Any] = {"updated_at": _now_iso()}
    if body.cancel_override:
        update["manual_override"] = False
    if body.status is not None:
        if body.status not in ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail=f"status must be in {ALLOWED_STATUSES}")
        update["status"] = body.status
        update["manual_override"] = True
        # When admin marks delivered/cancelled manually, also clear flags
        if body.status in TERMINAL_STATUSES:
            update["flags"] = {"stuck": False, "delayed": False}
    if body.label is not None:
        update["label"] = body.label.strip() or None
    if body.notes is not None:
        update["notes"] = body.notes

    await db[COLL].update_one({"id": order_id}, {"$set": update})
    saved = await db[COLL].find_one({"id": order_id}, {"_id": 0})
    return saved


@admin_router.post("/{order_id}/refresh", dependencies=[Depends(_require_pm)])
async def admin_refresh_order(order_id: str):
    doc = await db[COLL].find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    if doc.get("manual_override"):
        raise HTTPException(status_code=400, detail="Manual override active - clear it first to auto-refresh")
    await _refresh_one(doc)
    saved = await db[COLL].find_one({"id": order_id}, {"_id": 0})
    return saved


@admin_router.delete("/{order_id}", dependencies=[Depends(_require_pm)])
async def admin_delete_order(order_id: str):
    res = await db[COLL].delete_one({"id": order_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"deleted": True}


# ===================== PATIENT ROUTER =====================

patient_router = APIRouter(prefix="/api/users/me/tracked-orders", tags=["tracked-orders-patient"])


@patient_router.get("")
async def patient_list_orders(request: Request):
    user = await get_current_user(request, db)
    cur = db[COLL].find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cur.to_list(length=200)


@patient_router.post("/{order_id}/refresh")
async def patient_refresh_order(order_id: str, request: Request):
    user = await get_current_user(request, db)
    doc = await db[COLL].find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    if doc.get("manual_override"):
        # Patient just gets the existing record - admin controls it
        return doc

    # Throttle: don't allow more than once per 60s per order from patient side
    last = doc.get("last_checked_at")
    if last:
        try:
            ts = datetime.fromisoformat(last.replace("Z", "+00:00"))
            if (datetime.now(timezone.utc) - ts) < timedelta(seconds=60):
                return doc
        except Exception:
            pass

    await _refresh_one(doc)
    saved = await db[COLL].find_one({"id": order_id}, {"_id": 0})
    return saved
