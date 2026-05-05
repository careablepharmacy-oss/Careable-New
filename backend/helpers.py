"""Shared helper functions used across route modules and schedulers."""
import logging
import httpx
from datetime import datetime, timezone, timedelta
import uuid

logger = logging.getLogger(__name__)

db = None

ADMIN_EMAIL = "careable360plus@gmail.com"
MISSED_MEDICATION_WEBHOOK_URL = "https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjkwNTZmMDYzZjA0MzE1MjZlNTUzNDUxMzci_pc"


def set_db(database):
    global db
    db = database


def serialize_model(data):
    """Recursively serialize model data for MongoDB storage."""
    if isinstance(data, dict):
        return {k: serialize_model(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [serialize_model(item) for item in data]
    elif isinstance(data, datetime):
        return data.isoformat()
    else:
        return data


async def get_webhook_url():
    """Get the configured webhook URL from database or fall back to default."""
    config = await db.webhook_config.find_one({})
    if config and config.get("enabled", True) and config.get("webhook_url"):
        return config["webhook_url"]
    return MISSED_MEDICATION_WEBHOOK_URL


async def send_missed_medication_webhook(user, medication, adherence_log, webhook_url=None):
    """Send webhook for missed medication to Pabbly/WhatsApp automation."""
    try:
        if not webhook_url:
            webhook_url = await get_webhook_url()

        payload = {
            "patient_name": user.get('name', 'Unknown Patient'),
            "patient_phone": user.get('phone', ''),
            "medication_name": medication.get('name', 'Unknown Medication'),
            "medication_dosage": medication.get('dosage', ''),
            "scheduled_time": adherence_log.get('scheduled_time', ''),
            "scheduled_date": adherence_log.get('date', ''),
            "family_member_name": user.get('relative_name', ''),
            "family_member_phone": user.get('relative_whatsapp', ''),
            "missed_at": datetime.now(timezone.utc).isoformat(),
            "message_type": "missed_medication_alert"
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(webhook_url, json=payload, timeout=10)

        if response.status_code in [200, 201]:
            if adherence_log.get('id'):
                await db.adherence_logs.update_one(
                    {"id": adherence_log['id']},
                    {"$set": {"webhook_sent_at": datetime.now(timezone.utc).isoformat()}}
                )
            return {"success": True, "status_code": response.status_code, "response": response.text}
        else:
            return {"success": False, "status_code": response.status_code, "response": response.text}

    except Exception as e:
        logging.error(f"[Webhook] Error sending webhook: {str(e)}")
        return {"success": False, "error": str(e)}


async def notify_caregiver(patient_user_id: str, event_type: str, medication_name: str, dosage: str, scheduled_time: str):
    """
    Send a OneSignal push notification to the patient's linked caregiver.
    event_type: 'taken', 'missed', 'low_stock', 'appointment_created', 'appointment_updated'
    """
    try:
        link = await db.caregiver_links.find_one(
            {"patient_user_id": patient_user_id, "invite_status": "accepted"},
            {"_id": 0}
        )
        if not link or not link.get("caregiver_user_id"):
            return

        # Check notification preferences
        if event_type == "taken" and not link.get("notify_on_taken", True):
            return
        if event_type == "missed" and not link.get("notify_on_missed", True):
            return

        patient = await db.users.find_one({"id": patient_user_id}, {"_id": 0, "name": 1})
        patient_name = patient.get("name", "Your patient") if patient else "Your patient"
        caregiver_user_id = link["caregiver_user_id"]

        if event_type == "taken":
            title = f"{patient_name} took their medicine"
            dosage_part = f" ({dosage})" if dosage else ""
            body = f"{medication_name}{dosage_part} was taken. Scheduled for {scheduled_time}."
        elif event_type == "missed":
            title = f"{patient_name} missed their medicine"
            dosage_part = f" ({dosage})" if dosage else ""
            body = f"{medication_name}{dosage_part} was NOT taken within 1 hour. Scheduled for {scheduled_time}."
        elif event_type == "skipped":
            title = f"{patient_name} skipped their medicine"
            dosage_part = f" ({dosage})" if dosage else ""
            body = f"{medication_name}{dosage_part} was skipped. Scheduled for {scheduled_time}."
        elif event_type == "low_stock":
            title = f"{patient_name}'s medicine is running low"
            body = f"{medication_name} — {dosage}. Please help arrange a refill."
        elif event_type == "appointment_created":
            title = f"Appointment booked for {patient_name}"
            body = f"{medication_name}"
        elif event_type == "appointment_updated":
            title = f"Appointment update for {patient_name}"
            body = f"{medication_name}"
        else:
            title = f"Update for {patient_name}"
            body = medication_name

        from services.onesignal_service import onesignal_service
        result = await onesignal_service.send_to_user(
            user_id=caregiver_user_id,
            title=title,
            body=body,
            data={
                "type": f"caregiver_{event_type}",
                "patient_user_id": patient_user_id,
                "medication_name": medication_name,
                "scheduled_time": scheduled_time,
                "targetPage": "caregiver-dashboard"
            }
        )
        if result.get("success"):
            logging.info(f"[Caregiver] Sent '{event_type}' notification to caregiver {caregiver_user_id} for patient {patient_user_id}")
        else:
            logging.warning(f"[Caregiver] Failed to send notification: {result.get('error')}")
    except Exception as e:
        logging.error(f"[Caregiver] Error sending notification: {str(e)}")


async def generate_adherence_logs_for_medication(medication):
    """Generate today's adherence logs for a single medication (full version with dedup and frequency check)."""
    try:
        now_ist = datetime.now(timezone(timedelta(hours=5, minutes=30)))
        today_date = now_ist.strftime('%Y-%m-%d')
        today_weekday = now_ist.strftime('%A').lower()[:3]

        logging.info(f"[LogGenerator] Generating logs for medication: {medication.get('name')} on {today_date}")

        schedule = medication.get('schedule', {})
        if not schedule:
            return

        # Check if medication's start date is in the future - skip if not yet started
        start_date = schedule.get('start_date', '')
        if start_date and start_date > today_date:
            logging.info(f"[LogGenerator] Skipping {medication.get('name')} - start_date {start_date} is after today {today_date}")
            return

        # Check if medication's end date has passed - skip if ended
        end_date = schedule.get('end_date', '')
        if end_date and end_date < today_date:
            logging.info(f"[LogGenerator] Skipping {medication.get('name')} - end_date {end_date} is before today {today_date}")
            return

        frequency = schedule.get('frequency', 'daily')
        should_generate = False
        if frequency == 'daily':
            should_generate = True
        elif frequency in ('weekly', 'specific-days'):
            selected_days = schedule.get('selectedDays', [])
            if today_weekday in [d.lower()[:3] for d in selected_days]:
                should_generate = True
        elif frequency == 'as-needed':
            should_generate = False
        else:
            should_generate = True

        if not should_generate:
            logging.info(f"[LogGenerator] Skipping {medication.get('name')} - not scheduled for {today_weekday}")
            return

        dosage_timings = schedule.get('dosage_timings', [])
        legacy_times = schedule.get('times', [])

        time_slots = []
        if dosage_timings:
            for timing in dosage_timings:
                if isinstance(timing, dict):
                    time_slots.append({'time': timing.get('time'), 'amount': timing.get('amount', '')})
        elif legacy_times:
            time_slots = [{'time': t, 'amount': ''} for t in legacy_times]

        logs_created = 0
        for time_slot_info in time_slots:
            time_slot = time_slot_info['time']
            dosage_amount = time_slot_info['amount']
            if not time_slot:
                continue

            dedup_key = f"{medication['id']}_{today_date}_{time_slot}"
            existing_log = await db.adherence_logs.find_one({
                "$or": [
                    {"medication_id": medication['id'], "date": today_date, "scheduled_time": time_slot},
                    {"dedup_key": dedup_key}
                ]
            })
            if existing_log:
                continue

            new_log = {
                "id": str(uuid.uuid4()),
                "dedup_key": dedup_key,
                "user_id": medication['user_id'],
                "medication_id": medication['id'],
                "date": today_date,
                "scheduled_time": time_slot,
                "dosage_amount": dosage_amount,
                "status": "pending",
                "taken_time": None,
                "skipped_reason": None,
                "reminder_attempts": 0,
                "reminder_completed": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            try:
                await db.adherence_logs.insert_one(new_log)
                logs_created += 1
            except Exception as e:
                if "duplicate key" in str(e).lower():
                    logging.debug(f"[LogGenerator] Duplicate log skipped for {medication.get('name')} at {time_slot}")
                else:
                    raise

        logging.info(f"[LogGenerator] Created {logs_created} adherence logs for {medication.get('name')}")

    except Exception as e:
        logging.error(f"[LogGenerator] Error generating logs for medication: {str(e)}")
        raise
