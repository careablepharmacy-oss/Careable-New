from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from typing import List
from datetime import datetime, timedelta, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import httpx
import uuid
import pytz

# Import models
from models import (
    User, UserUpdate,
    Medication, MedicationCreate, MedicationUpdate,
    AdherenceLog, AdherenceLogCreate,
    BloodGlucose, BloodGlucoseCreate,
    BloodPressure, BloodPressureCreate,
    BodyMetrics, BodyMetricsCreate,
    Appointment, AppointmentCreate,
    FoodLog, FoodLogCreate,
    ExerciseLog, ExerciseLogCreate,
    NotificationSettings, NotificationSettingsUpdate,
    Reminder, ReminderCreate,
    PushSubscription, PushSubscriptionCreate,
    UserPurchaseLinks, UserPurchaseLinksUpdate
)

# Import auth helpers
from auth import (
    get_current_user,
    get_session_data_from_emergent,
    create_or_update_user,
    create_session,
    delete_session
)

# Import product routes
from routes.products import router as products_router, set_db as set_products_db
from routes.checkout import router as checkout_router, set_db as set_checkout_db
from routes.caregivers import router as caregiver_router, set_db as set_caregiver_db
from routes.prescription_manager import router as pm_router, set_db as set_pm_db
from routes.invoice_delivery import router as inv_router, set_db as set_inv_db, create_indexes as create_inv_indexes
from routes.crm import router as crm_router, set_db as set_crm_db, run_startup_migrations as run_crm_migrations
from services.medicine_intel import set_db as set_medicine_intel_db
from helpers import (
    serialize_model, notify_caregiver, send_missed_medication_webhook,
    get_webhook_url, generate_adherence_logs_for_medication,
    ADMIN_EMAIL, MISSED_MEDICATION_WEBHOOK_URL,
    set_db as set_helpers_db
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Set database for product routes
set_products_db(db)
set_checkout_db(db)
set_caregiver_db(db)
set_pm_db(db)
set_helpers_db(db)
set_inv_db(db)
set_crm_db(db)
set_medicine_intel_db(db)

# Create the main app without a prefix
app = FastAPI()

# Initialize scheduler
scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")  # IST timezone

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Add OPTIONS handler for CORS preflight requests
@app.options("/{full_path:path}")
async def options_handler(request: Request, full_path: str):
    """Handle OPTIONS requests for CORS preflight"""
    from fastapi.responses import Response
    
    response = Response()
    origin = request.headers.get("origin", "")
    
    # Check if origin is allowed
    allowed_origins = [
        "http://localhost:3000",
        "http://localhost",
        "https://careable-preview.preview.emergentagent.com",
        "https://medremind-pwa.emergent.host",
        "https://diabexpert.online",
        "https://www.diabexpert.online",
        "capacitor://localhost",
        "ionic://localhost",
    ]
    
    if origin in allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Max-Age"] = "3600"
    
    return response

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def check_missed_medications():
    """
    Scheduled job that runs every 5 minutes to check for missed medications.
    
    Sends push notifications via OneSignal:
    - 0 min (at exact scheduled time) - Initial push notification alongside local alarm
    - 15 min after scheduled time (Reminder #1)
    - 30 min after scheduled time (Reminder #2)
    - 45 min after scheduled time (Reminder #3)
    - 60 min after scheduled time (Final reminder + family webhook)
    
    This ensures sustainable follow-up notifications even if user dismisses local alarms.
    """
    try:
        from services.onesignal_service import onesignal_service
        
        logging.info("[Scheduler] ========================================")
        logging.info("[Scheduler] Checking for missed medications...")
        
        # Get current time in IST
        now_ist = datetime.now(timezone(timedelta(hours=5, minutes=30)))
        current_date = now_ist.strftime('%Y-%m-%d')
        current_time = now_ist.time()
        
        # Calculate time thresholds
        # Add a small buffer (2 min) to account for scheduler timing variations
        two_min_ago = (now_ist - timedelta(minutes=2)).time()
        fifteen_min_ago = (now_ist - timedelta(minutes=15)).time()
        thirty_min_ago = (now_ist - timedelta(minutes=30)).time()
        fortyfive_min_ago = (now_ist - timedelta(minutes=45)).time()
        sixty_min_ago = (now_ist - timedelta(minutes=60)).time()
        
        logging.info(f"[Scheduler] Current IST time: {now_ist.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Find pending adherence logs for today
        # CRITICAL: Also exclude logs that have been marked as completed (reminder_completed = true)
        adherence_logs = await db.adherence_logs.find({
            "status": "pending",
            "date": current_date,
            "$or": [
                {"reminder_completed": {"$ne": True}},
                {"reminder_completed": {"$exists": False}}
            ]
        }).to_list(length=None)
        
        logging.info(f"[Scheduler] Found {len(adherence_logs)} pending adherence logs for today")
        
        # Log all pending logs for debugging
        if adherence_logs:
            logging.info(f"[Scheduler] Pending logs details:")
            for log in adherence_logs:
                logging.info(f"[Scheduler]   - ID: {log.get('id')[:8]}..., Med: {log.get('medication_id', 'unknown')[:8]}..., Time: {log.get('scheduled_time')}, Attempts: {log.get('reminder_attempts', 0)}")
        
        reminders_sent = 0
        
        for log in adherence_logs:
            scheduled_time_obj = datetime.strptime(log['scheduled_time'], '%H:%M').time()
            
            # Skip if scheduled time is in the future
            if scheduled_time_obj > current_time:
                continue
            
            # Get medication and user details
            medication = await db.medications.find_one({"id": log['medication_id']}, {"_id": 0})
            if not medication:
                continue
            
            user = await db.users.find_one({"id": log['user_id']}, {"_id": 0})
            if not user:
                continue
            
            user_id = user.get('id')
            if not user_id:
                continue
            
            # Get current reminder attempts
            reminder_attempts = log.get('reminder_attempts', 0)
            last_reminder = log.get('last_reminder_at')
            
            # Determine if we should send a reminder based on time elapsed
            should_send_reminder = False
            attempt_number = 0
            urgency_level = "normal"
            
            # Reminder schedule: 0, 15, 30, 45, 60 minutes after scheduled time
            # 0 min - Initial push notification at exact scheduled time (alongside local alarm)
            if scheduled_time_obj <= two_min_ago and reminder_attempts == 0:
                should_send_reminder = True
                attempt_number = 1
                urgency_level = "initial"  # New level for exact time notification
            elif scheduled_time_obj <= fifteen_min_ago and reminder_attempts == 1:
                should_send_reminder = True
                attempt_number = 2
                urgency_level = "gentle"
            elif scheduled_time_obj <= thirty_min_ago and reminder_attempts == 2:
                should_send_reminder = True
                attempt_number = 3
                urgency_level = "normal"
            elif scheduled_time_obj <= fortyfive_min_ago and reminder_attempts == 3:
                should_send_reminder = True
                attempt_number = 4
                urgency_level = "important"
            elif scheduled_time_obj <= sixty_min_ago and reminder_attempts == 4:
                should_send_reminder = True
                attempt_number = 5
                urgency_level = "urgent"
            
            # Send push reminder via OneSignal if needed
            if should_send_reminder:
                # CRITICAL: Double-check the log status hasn't changed since we fetched it
                # This prevents race condition where user marks as taken while we're processing
                current_log = await db.adherence_logs.find_one(
                    {"id": log['id']}, 
                    {"_id": 0, "status": 1, "reminder_completed": 1}
                )
                
                # Skip if status changed OR reminder_completed flag is set
                if current_log:
                    if current_log.get('status') != 'pending':
                        logging.info(f"[Scheduler] ⏭️ Skipping {medication['name']} - status changed to '{current_log.get('status')}'")
                        continue
                    if current_log.get('reminder_completed') == True:
                        logging.info(f"[Scheduler] ⏭️ Skipping {medication['name']} - reminder_completed flag is True")
                        continue
                
                logging.info(f"[Scheduler] Sending reminder #{attempt_number} for {medication['name']} to {user.get('name', user_id)}")
                
                # Customize message based on attempt number
                # Attempt 1: At exact scheduled time (0 min) - alongside local alarm
                # Attempt 2: 15 min after
                # Attempt 3: 30 min after
                # Attempt 4: 45 min after
                # Attempt 5: 60 min after (final)
                if attempt_number == 1:
                    # Initial notification at exact scheduled time
                    title = f"⏰ Time for {medication['name']}"
                    body = f"Take {medication.get('dosage', 'your medication')} now. Scheduled for {log['scheduled_time']}"
                elif attempt_number == 2:
                    title = f"💊 Reminder: {medication['name']}"
                    body = f"Time to take {medication.get('dosage', 'your medication')}. Scheduled for {log['scheduled_time']}"
                elif attempt_number == 3:
                    title = f"⏰ Missed Medication: {medication['name']}"
                    body = f"You haven't taken {medication['name']} yet. It was scheduled for {log['scheduled_time']}"
                elif attempt_number == 4:
                    title = f"⚠️ Important: Take {medication['name']}"
                    body = f"Please take {medication['name']} now. Already 45 minutes past scheduled time."
                else:
                    title = f"🚨 Urgent: {medication['name']} Missed"
                    body = f"You've missed {medication['name']} scheduled for {log['scheduled_time']}. Please take it immediately or skip if advised."
                
                # Send via OneSignal
                # Simple deduplication: check reminder_attempts before sending
                current_attempts = log.get('reminder_attempts', 0) or 0
                
                # Skip if we've already sent this attempt level
                if current_attempts >= attempt_number:
                    logging.info(f"[Scheduler] ⏭️ Skipping {medication['name']} - attempt #{attempt_number} already sent (current: {current_attempts})")
                    continue
                
                # Update reminder_attempts BEFORE sending to prevent duplicates
                # This is the atomic lock - if another process tries, they'll see the updated value
                update_result = await db.adherence_logs.update_one(
                    {
                        "id": log['id'],
                        "$or": [
                            {"reminder_attempts": {"$lt": attempt_number}},
                            {"reminder_attempts": {"$exists": False}},
                            {"reminder_attempts": None}
                        ]
                    },
                    {
                        "$set": {
                            "reminder_attempts": attempt_number,
                            "last_reminder_at": datetime.utcnow()
                        }
                    }
                )
                
                # If no document was modified, another process already claimed it
                if update_result.modified_count == 0:
                    logging.info(f"[Scheduler] ⏭️ Skipping {medication['name']} attempt #{attempt_number} - already claimed by another process")
                    continue
                
                # Now send the notification
                result = await onesignal_service.send_to_user(
                    user_id=user_id,
                    title=title,
                    body=body,
                    data={
                        "type": "medication_reminder",
                        "medication_id": medication['id'],
                        "medication_name": medication['name'],
                        "scheduled_time": log['scheduled_time'],
                        "attempt_number": attempt_number,
                        "urgency": urgency_level,
                        "targetPage": "medications"
                    },
                    android_channel_id="medication_reminders"
                )
                
                if result.get('success'):
                    # Update with notification ID
                    await db.adherence_logs.update_one(
                        {"id": log['id']},
                        {"$set": {"last_reminder_notification_id": result.get('notification_id')}}
                    )
                    reminders_sent += 1
                    logging.info(f"[Scheduler] ✅ Sent push reminder #{attempt_number} via OneSignal (ID: {result.get('notification_id')})")
                else:
                    logging.warning(f"[Scheduler] ⚠️ Failed to send reminder: {result.get('error')}")
            
            # Send family webhook after 60 minutes (only once)
            if scheduled_time_obj <= sixty_min_ago and not log.get('webhook_sent_at'):
                if user.get('relative_whatsapp'):
                    logging.info(f"[Scheduler] Sending family webhook for {medication['name']}")
                    await send_missed_medication_webhook(user, medication, log)
                # Also notify linked caregiver via OneSignal
                await notify_caregiver(
                    patient_user_id=user.get('id'),
                    event_type="missed",
                    medication_name=medication.get('name', ''),
                    dosage=medication.get('dosage', ''),
                    scheduled_time=log.get('scheduled_time', '')
                )
        
        logging.info(f"[Scheduler] Check completed. Reminders sent: {reminders_sent}")
        logging.info("[Scheduler] ========================================")
        
    except Exception as e:
        logging.error(f"[Scheduler] Error in check_missed_medications: {str(e)}")
        import traceback
        logging.error(f"[Scheduler] Traceback: {traceback.format_exc()}")



async def generate_daily_adherence_logs():
    """
    Generate adherence logs for all scheduled medications for today.
    Runs daily at midnight to create pending logs for the day.
    Also runs on app startup to ensure logs exist for today.
    """
    try:
        logging.info("[LogGenerator] Starting daily adherence log generation...")
        
        # Get current date in IST
        now_ist = datetime.now(timezone(timedelta(hours=5, minutes=30)))
        today_date = now_ist.strftime('%Y-%m-%d')
        today_weekday = now_ist.strftime('%A').lower()[:3]  # 'mon', 'tue', etc.
        
        logging.info(f"[LogGenerator] Generating logs for: {today_date} ({today_weekday})")
        
        # Get all active medications
        medications = await db.medications.find({}).to_list(length=None)
        logging.info(f"[LogGenerator] Found {len(medications)} total medications")
        
        logs_created = 0
        logs_skipped = 0
        
        for medication in medications:
            # Get schedule object
            schedule = medication.get('schedule', {})
            
            # Check if medication's start date is in the future - skip if not yet started
            start_date = schedule.get('start_date', '')
            if start_date and start_date > today_date:
                logging.debug(f"[LogGenerator] {medication.get('name')}: start_date {start_date} is after today {today_date} - skipping")
                logs_skipped += 1
                continue
            
            # Check if medication's end date has passed - skip if ended
            end_date = schedule.get('end_date', '')
            if end_date and end_date < today_date:
                logging.debug(f"[LogGenerator] {medication.get('name')}: end_date {end_date} is before today {today_date} - skipping")
                logs_skipped += 1
                continue
            
            # Check if medication should be taken today
            frequency = schedule.get('frequency', 'daily')
            
            should_generate = False
            
            if frequency == 'daily':
                should_generate = True
                logging.debug(f"[LogGenerator] {medication.get('name')}: daily frequency - generating")
            elif frequency == 'weekly':
                weekly_days = schedule.get('weekly_days', [])
                if today_weekday in weekly_days:
                    should_generate = True
                    logging.debug(f"[LogGenerator] {medication.get('name')}: weekly frequency, today is {today_weekday} - generating")
                else:
                    logging.debug(f"[LogGenerator] {medication.get('name')}: weekly frequency, today is {today_weekday}, scheduled for {weekly_days} - skipping")
            elif frequency == 'custom':
                # For custom frequency, generate logs (can be refined later)
                should_generate = True
                logging.debug(f"[LogGenerator] {medication.get('name')}: custom frequency - generating")
            else:
                logging.debug(f"[LogGenerator] {medication.get('name')}: unknown frequency '{frequency}' - skipping")
            
            if not should_generate:
                logs_skipped += 1
                continue
            
            # Get scheduled times for this medication
            # Support both new dosage_timings and legacy times formats
            schedule = medication.get('schedule', {})
            dosage_timings = schedule.get('dosage_timings', [])
            legacy_times = schedule.get('times', [])
            
            # Prepare list of time slots with amounts
            time_slots = []
            
            if dosage_timings:
                # New format: use dosage_timings
                for timing in dosage_timings:
                    time_slots.append({
                        'time': timing.get('time'),
                        'amount': timing.get('amount')
                    })
            elif legacy_times:
                # Legacy format: use times without amounts
                for time in legacy_times:
                    time_slots.append({
                        'time': time,
                        'amount': None
                    })
            
            if not time_slots:
                logging.warning(f"[LogGenerator] Medication {medication.get('name')} has no scheduled times")
                continue
            
            for time_slot_info in time_slots:
                time_slot = time_slot_info['time']
                dosage_amount = time_slot_info['amount']
                
                # Check if log already exists for this medication, date, and time
                # Use a deduplication key to absolutely prevent duplicates
                dedup_key = f"{medication['id']}_{today_date}_{time_slot}"
                
                existing_log = await db.adherence_logs.find_one({
                    "$or": [
                        {"medication_id": medication['id'], "date": today_date, "scheduled_time": time_slot},
                        {"dedup_key": dedup_key}
                    ]
                })
                
                if existing_log:
                    logging.debug(f"[LogGenerator] Log already exists for {medication.get('name')} at {time_slot}")
                    logs_skipped += 1
                    continue
                
                # Create pending adherence log with dedup_key
                new_log = {
                    "id": str(uuid.uuid4()),
                    "dedup_key": dedup_key,
                    "user_id": medication['user_id'],
                    "medication_id": medication['id'],
                    "date": today_date,
                    "scheduled_time": time_slot,
                    "dosage_amount": dosage_amount,
                    "status": "pending",
                    "notes": "Auto-generated by system",
                    "webhook_sent_at": None,
                    "created_at": now_ist.isoformat()
                }
                
                await db.adherence_logs.insert_one(new_log)
                logs_created += 1
                logging.info(f"[LogGenerator] ✅ Created pending log: {medication.get('name')} at {time_slot} ({dosage_amount or 'no amount'})")
        
        logging.info(f"[LogGenerator] Completed: {logs_created} logs created, {logs_skipped} skipped (existing or not scheduled today)")
        
    except Exception as e:
        logging.error(f"[LogGenerator] Error generating daily logs: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())

# Startup event to initialize scheduler
@app.on_event("startup")
async def startup_event():
    """Initialize scheduler when app starts"""
    logging.info("[Startup] Starting scheduler with all jobs...")

    # Run CRM lab-booking date migration (idempotent)
    try:
        await run_crm_migrations()
    except Exception as e:
        logging.warning(f"[Startup] CRM migrations failed: {e}")

    # Create unique index on adherence_logs to prevent duplicates at DB level
    try:
        await db.adherence_logs.create_index(
            [("medication_id", 1), ("date", 1), ("scheduled_time", 1)],
            unique=True,
            name="unique_medication_date_time"
        )
        logging.info("[Startup] Created unique index on adherence_logs")
    except Exception as e:
        logging.info(f"[Startup] Index already exists or error: {e}")
    
    # Create invoice delivery indexes
    try:
        await create_inv_indexes()
        logging.info("[Startup] Created invoice delivery indexes")
    except Exception as e:
        logging.info(f"[Startup] Invoice indexes error: {e}")
    
    # Job 1: Check for missed medications every 5 minutes
    # Uses OneSignal for reliable push notification delivery
    # Sends notifications at: 0 min (exact time), 15 min, 30 min, 45 min, 60 min
    scheduler.add_job(
        check_missed_medications,
        'interval',
        minutes=5,
        id='check_missed_medications',
        replace_existing=True
    )
    logging.info("[Startup] Job 1: Check medications (every 5 min via OneSignal - at 0, 15, 30, 45, 60 min) - scheduled")
    
    # Job 2: Generate daily adherence logs at midnight (00:01 IST)
    scheduler.add_job(
        generate_daily_adherence_logs,
        'cron',
        hour=0,
        minute=1,
        timezone='Asia/Kolkata',
        id='generate_daily_logs',
        replace_existing=True
    )
    logging.info("[Startup] Job 2: Generate daily logs (midnight IST) - scheduled")
    
    # Job 3: Send appointment reminders at 7 AM and 8 AM IST
    scheduler.add_job(
        send_appointment_reminders,
        'cron',
        hour='7,8',
        minute=0,
        timezone='Asia/Kolkata',
        id='send_appointment_reminders',
        replace_existing=True
    )
    logging.info("[Startup] Job 3: Appointment reminders (7 AM & 8 AM IST) - scheduled")
    
    # Job 4: Send refill reminders at 9 AM IST daily
    scheduler.add_job(
        send_refill_reminders,
        'cron',
        hour=9,
        minute=0,
        timezone='Asia/Kolkata',
        id='send_refill_reminders',
        replace_existing=True
    )
    logging.info("[Startup] Job 4: Refill reminders (9 AM IST) - scheduled")
    
    # Start the scheduler
    scheduler.start()
    logging.info("[Startup] Scheduler started successfully")
    
    # Run log generation immediately on startup to ensure today's logs exist
    logging.info("[Startup] Running initial log generation for today...")
    await generate_daily_adherence_logs()
    logging.info("[Startup] Initial log generation complete")


# ==================== APPOINTMENT REMINDER SCHEDULER ====================

async def send_appointment_reminders():
    """
    Send push notifications for upcoming appointments.
    - 8 AM day before appointment
    - 7 AM day of appointment
    """
    try:
        from services.onesignal_service import onesignal_service
        
        if not onesignal_service.is_configured():
            logging.warning("[AppointmentReminder] OneSignal not configured, skipping")
            return
        
        # Get current time in IST
        ist = pytz.timezone('Asia/Kolkata')
        now_ist = datetime.now(ist)
        current_hour = now_ist.hour
        today_date = now_ist.strftime('%Y-%m-%d')
        tomorrow_date = (now_ist + timedelta(days=1)).strftime('%Y-%m-%d')
        
        logging.info(f"[AppointmentReminder] Running at {now_ist.strftime('%H:%M')} IST")
        
        reminders_sent = 0
        
        # Find appointments to remind about
        appointments_to_remind = []
        
        # 8 AM reminder for tomorrow's appointments
        if current_hour == 8:
            tomorrow_appointments = await db.appointments.find({
                "date": tomorrow_date,
                "status": "upcoming"
            }).to_list(length=100)
            
            for apt in tomorrow_appointments:
                appointments_to_remind.append({
                    "appointment": apt,
                    "reminder_type": "day_before",
                    "message_prefix": "Tomorrow"
                })
            logging.info(f"[AppointmentReminder] Found {len(tomorrow_appointments)} appointments for tomorrow")
        
        # 7 AM reminder for today's appointments
        if current_hour == 7:
            today_appointments = await db.appointments.find({
                "date": today_date,
                "status": "upcoming"
            }).to_list(length=100)
            
            for apt in today_appointments:
                appointments_to_remind.append({
                    "appointment": apt,
                    "reminder_type": "same_day",
                    "message_prefix": "Today"
                })
            logging.info(f"[AppointmentReminder] Found {len(today_appointments)} appointments for today")
        
        # Send reminders
        for item in appointments_to_remind:
            apt = item["appointment"]
            user_id = apt.get("user_id")
            
            # Check if user has appointment reminders enabled
            user = await db.users.find_one({"id": user_id})
            if user:
                prefs = user.get("notification_preferences", {})
                if not prefs.get("appointment_reminders", True):
                    logging.info(f"[AppointmentReminder] Skipping - user {user_id} has appointment reminders disabled")
                    continue
            
            apt_type = apt.get("type", "appointment")
            title_icon = "🏥" if apt_type == "doctor" else "🔬"
            
            if apt_type == "doctor":
                title = f"{title_icon} Doctor Appointment {item['message_prefix']}"
                body = f"{apt.get('title')} with {apt.get('doctor', 'Doctor')} at {apt.get('time')}"
                if apt.get('hospital'):
                    body += f" - {apt.get('hospital')}"
            else:
                title = f"{title_icon} Lab Appointment {item['message_prefix']}"
                body = f"{apt.get('title')} at {apt.get('time')}"
                if apt.get('location'):
                    body += f" - {apt.get('location')}"
            
            result = await onesignal_service.send_to_user(
                user_id=user_id,
                title=title,
                body=body,
                data={
                    "type": "appointment_reminder",
                    "appointment_id": apt.get("id"),
                    "appointment_type": apt_type,
                    "reminder_type": item["reminder_type"],
                    "targetPage": "appointments"
                },
                android_channel_id="appointment_reminders"
            )
            
            if result.get("success") and result.get("recipients", 0) > 0:
                reminders_sent += 1
                logging.info(f"[AppointmentReminder] ✅ Sent reminder for {apt.get('title')}")
            else:
                logging.warning(f"[AppointmentReminder] ⚠️ Failed to send reminder: {result.get('error', 'No recipients')}")
        
        logging.info(f"[AppointmentReminder] Completed: {reminders_sent} reminders sent")
        
    except Exception as e:
        logging.error(f"[AppointmentReminder] Error: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())


# ==================== MEDICINE REFILL REMINDER SCHEDULER ====================

async def send_refill_reminders():
    """
    Send daily push notifications for medications with low stock.
    Triggers at 9 AM IST for medications with stock <= 10.
    Only sends if refill_reminder.enabled is True.
    """
    try:
        from services.onesignal_service import onesignal_service
        
        if not onesignal_service.is_configured():
            logging.warning("[RefillReminder] OneSignal not configured, skipping")
            return
        
        logging.info("[RefillReminder] Checking for low stock medications...")
        
        reminders_sent = 0
        
        # Find all medications with low stock
        # Check tablet_stock_count for tablets/capsules
        # Check injection_stock_count for injections
        low_stock_medications = await db.medications.find({
            "$or": [
                # Tablets/Capsules with stock <= 10
                {
                    "form": {"$in": ["Tablet", "Capsule"]},
                    "tablet_stock_count": {"$lte": 10, "$gt": 0},
                    "refill_reminder.enabled": True
                },
                # Injections with stock <= 3 vials/pens
                {
                    "form": "Injection",
                    "injection_stock_count": {"$lte": 3, "$gt": 0},
                    "refill_reminder.enabled": True
                }
            ]
        }).to_list(length=500)
        
        logging.info(f"[RefillReminder] Found {len(low_stock_medications)} medications with low stock")
        
        # Group by user to send consolidated reminders
        user_medications = {}
        for med in low_stock_medications:
            user_id = med.get("user_id")
            if user_id not in user_medications:
                user_medications[user_id] = []
            user_medications[user_id].append(med)
        
        # Send reminders per user
        for user_id, medications in user_medications.items():
            # Check if user has medication reminders enabled
            user = await db.users.find_one({"id": user_id})
            if user:
                prefs = user.get("notification_preferences", {})
                if not prefs.get("medication_reminders", True):
                    logging.info(f"[RefillReminder] Skipping - user {user_id} has medication reminders disabled")
                    continue
            
            # Look up medicine purchase link for this user
            purchase_links = await db.user_purchase_links.find_one({"user_id": user_id}, {"_id": 0})
            medicine_link = ""
            if purchase_links:
                medicine_link = purchase_links.get("medicine_invoice_link") or ""
            
            if len(medications) == 1:
                med = medications[0]
                med_name = med.get("name", "Medication")
                stock = med.get("tablet_stock_count") or med.get("injection_stock_count", 0)
                unit = "tablets" if med.get("form") in ["Tablet", "Capsule"] else "vials"
                
                title = "Medicine Refill Reminder"
                if medicine_link:
                    body = f"Low stock alert: {med_name} is running low (only {stock} {unit} left). Tap to refill."
                else:
                    body = f"Low stock alert: {med_name} is running low (only {stock} {unit} left). Please refill soon."
            else:
                title = "Medicine Refill Alert"
                med_names = [m.get("name", "Medication") for m in medications[:3]]
                if len(medications) > 3:
                    names_str = f"{', '.join(med_names)} and {len(medications) - 3} more"
                else:
                    names_str = ', '.join(med_names)
                if medicine_link:
                    body = f"Low stock alert: {names_str} are running low. Tap to refill."
                else:
                    body = f"Low stock alert: {names_str} are running low. Please refill soon."
            
            notification_data = {
                "type": "refill_reminder",
                "medication_ids": [m.get("id") for m in medications],
                "targetPage": "medications"
            }
            if medicine_link:
                notification_data["purchase_link"] = medicine_link
            
            result = await onesignal_service.send_to_user(
                user_id=user_id,
                title=title,
                body=body,
                data=notification_data,
                android_channel_id="low_stock_alerts",
                url=medicine_link or None
            )
            
            if result.get("success") and result.get("recipients", 0) > 0:
                reminders_sent += 1
                logging.info(f"[RefillReminder] Sent reminder to user {user_id[:8]}... for {len(medications)} medications")
            else:
                logging.warning(f"[RefillReminder] Failed to send reminder: {result.get('error', 'No recipients')}")

            # Also notify linked caregiver
            med_names = ', '.join([m.get("name", "Medication") for m in medications[:3]])
            caregiver_dosage = f"{len(medications)} medicine(s) running low"
            await notify_caregiver(
                patient_user_id=user_id,
                event_type="low_stock",
                medication_name=med_names,
                dosage=caregiver_dosage,
                scheduled_time=""
            )
        
        logging.info(f"[RefillReminder] Completed: {reminders_sent} reminders sent")
        
    except Exception as e:
        logging.error(f"[RefillReminder] Error: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())

# Shutdown event to cleanup scheduler
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup scheduler when app shuts down"""
    logging.info("[Shutdown] Stopping scheduler...")
    scheduler.shutdown()
    logging.info("[Shutdown] Scheduler stopped")

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/session")
async def create_auth_session(request: Request, response: Response):
    """
    Exchange session_id for user data and create session.
    """
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="session_id required"
        )
    
    # Get user data from Emergent
    emergent_data = await get_session_data_from_emergent(session_id)
    
    # Create or get existing user
    user = await create_or_update_user(db, emergent_data)
    
    # Create session
    session = await create_session(db, user["id"], emergent_data["session_token"])
    
    # Detect if request is from native app (http://localhost) or PWA (https)
    origin = request.headers.get("origin", "")
    is_native_app = origin.startswith("http://localhost") or origin.startswith("capacitor://")
    
    # Set httpOnly cookie with appropriate settings
    # Native app (HTTP) needs secure=False, samesite="lax"
    # PWA (HTTPS) needs secure=True, samesite="none"
    response.set_cookie(
        key="session_token",
        value=emergent_data["session_token"],
        httponly=True,
        secure=not is_native_app,  # False for native app, True for PWA
        samesite="lax" if is_native_app else "none",  # lax for native, none for PWA
        max_age=7 * 24 * 60 * 60,  # 7 days
        path="/"
    )
    
    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "picture": user.get("picture"),
            "phone": user.get("phone"),
            "sex": user.get("sex"),
            "age": user.get("age"),
            "address": user.get("address"),
            "city": user.get("city"),
            "state": user.get("state"),
            "country": user.get("country"),
            "pincode": user.get("pincode"),
            "diabetes_type": user.get("diabetes_type", "Type 2"),
            "relative_name": user.get("relative_name"),
            "relative_email": user.get("relative_email"),
            "relative_whatsapp": user.get("relative_whatsapp"),
            "role": user.get("role", "user")
        },
        "session_token": emergent_data["session_token"]  # Return token for localStorage
    }

@api_router.get("/auth/me")
async def get_current_user_info(request: Request):
    """
    Get current authenticated user info.
    """
    user = await get_current_user(request, db)
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "picture": user.get("picture"),
        "phone": user.get("phone"),
        "sex": user.get("sex"),
        "age": user.get("age"),
        "address": user.get("address"),
        "city": user.get("city"),
        "state": user.get("state"),
        "country": user.get("country"),
        "pincode": user.get("pincode"),
        "diabetes_type": user.get("diabetes_type", "Type 2"),
        "relative_name": user.get("relative_name"),
        "relative_email": user.get("relative_email"),
        "relative_whatsapp": user.get("relative_whatsapp"),
        "role": user.get("role", "user"),
        "created_at": user.get("created_at")
    }

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """
    Logout user and delete session.
    """
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await delete_session(db, session_token)
    
    response.delete_cookie(key="session_token", path="/")
    
    return {"message": "Logged out successfully"}

# ==================== USER ROUTES ====================

@api_router.get("/users/me")
async def get_user_profile(request: Request):
    """
    Get user profile.
    """
    user = await get_current_user(request, db)
    
    # Remove MongoDB's _id field to avoid serialization issues
    if user and "_id" in user:
        del user["_id"]
    
    return user

@api_router.put("/users/me")
async def update_user_profile(request: Request, update_data: UserUpdate):
    """
    Update user profile.
    """
    user = await get_current_user(request, db)
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.utcnow()
    
    # Serialize datetime before updating
    serialized_update = serialize_model(update_dict)
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": serialized_update}
    )

    # Mirror identity-shared fields to crm_patient_profiles so CRM sees the same data.
    try:
        from routes.crm import mirror_profile_to_crm
        await mirror_profile_to_crm(user["id"], serialized_update)
    except Exception:
        pass

    updated_user = await db.users.find_one({"id": user["id"]})
    
    # Remove MongoDB's _id field to avoid serialization issues
    if updated_user and "_id" in updated_user:
        del updated_user["_id"]
    
    return updated_user

@api_router.post("/users/fcm-token")
async def register_fcm_token(request: Request):
    """
    Register or update user's push notification token.
    Kept for backwards compatibility - now uses OneSignal.
    """
    user = await get_current_user(request, db)
    
    # Get token from JSON body
    body = await request.json()
    token = body.get("token")
    
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")
    
    logging.info(f"[Push] Registering token for user {user['email']}: {token[:20]}...")
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "push_token": token,
            "push_updated_at": datetime.utcnow()
        }}
    )
    
    logging.info(f"[Push] ✅ Token registered successfully for user {user['email']}")
    return {"message": "Push token registered successfully", "token": token[:20] + "..."}


@api_router.post("/users/onesignal-id")
async def register_onesignal_id(request: Request):
    """
    Register user's OneSignal player/subscription ID.
    Called after OneSignal.login() on the frontend.
    """
    user = await get_current_user(request, db)
    
    body = await request.json()
    player_id = body.get("player_id")
    
    if not player_id:
        raise HTTPException(status_code=400, detail="Player ID is required")
    
    logging.info(f"[OneSignal] Registering player ID for user {user['email']}: {player_id[:20]}...")
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "onesignal_player_id": player_id,
            "onesignal_updated_at": datetime.utcnow()
        }}
    )
    
    logging.info(f"[OneSignal] ✅ Player ID registered for user {user['email']}")
    return {"message": "OneSignal ID registered successfully"}


@api_router.post("/users/test-notification")
async def send_test_notification(request: Request):
    """
    Send test push notification to user via OneSignal
    """
    from services.onesignal_service import onesignal_service
    
    user = await get_current_user(request, db)
    user_id = user.get("id")
    
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID not found")
    
    result = await onesignal_service.send_test_notification(user_id)
    
    if result.get("success"):
        return {
            "message": "Test notification sent successfully",
            "notification_id": result.get("notification_id")
        }
    else:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to send test notification: {result.get('error')}"
        )


@api_router.post("/notifications/send")
async def send_push_notification(request: Request):
    """
    Send push notification to specific users (admin endpoint)
    """
    from services.onesignal_service import onesignal_service
    
    user = await get_current_user(request, db)
    
    # Check if user is admin/prescription_manager
    if user.get("role") not in ["admin", "prescription_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    body = await request.json()
    user_ids = body.get("user_ids", [])
    title = body.get("title", "Careable 360+ Notification")
    message = body.get("message", "")
    data = body.get("data", {})
    
    if not user_ids or not message:
        raise HTTPException(status_code=400, detail="user_ids and message are required")
    
    result = await onesignal_service.send_to_users(user_ids, title, message, data)
    
    return {
        "success": result.get("success"),
        "notification_id": result.get("notification_id"),
        "recipients": result.get("recipients", 0)
    }

# ==================== MEDICATION ROUTES ====================

@api_router.get("/medications", response_model=List[Medication])
async def get_medications(request: Request):
    """
    Get all medications for current user.
    """
    user = await get_current_user(request, db)
    medications = await db.medications.find({"user_id": user["id"]}).to_list(1000)
    return medications


@api_router.get("/medications/autocomplete")
async def autocomplete_medicines(q: str = ""):
    """
    Autocomplete search for medicine names.
    Searches from the start of the medicine name (prefix matching).
    Returns maximum 20 results.
    
    Example: /api/medications/autocomplete?q=alleg
    """
    if not q or len(q) < 2:
        return []
    
    # Convert query to lowercase for case-insensitive search
    query_lower = q.lower().strip()
    
    # Find medicines that start with the query (prefix matching)
    # Using regex with ^ to match from start of string
    medicines = await db.medicines.find(
        {"name_lower": {"$regex": f"^{query_lower}", "$options": "i"}}
    ).limit(20).to_list(length=20)
    
    # Return only the medicine names
    return [{"name": med["name"]} for med in medicines]

@api_router.get("/medications/injection-iu")
async def get_injection_iu_data(name: str = ""):
    """
    Get IU (International Units) data for insulin injections.
    Uses fuzzy matching to find the closest match.
    
    Example: /api/medications/injection-iu?name=Actrapid
    
    Returns:
    - found: true/false
    - name: Matched medicine name
    - ml: Volume in milliliters
    - iu_per_package: IU per package
    - total_units: Total IU in package
    """
    if not name or len(name) < 3:
        return {"found": False, "message": "Query too short"}
    
    # Convert to lowercase for search
    query_lower = name.lower().strip()
    
    # Try exact prefix match first
    insulin = await db.insulin_iu_data.find_one(
        {"name_lower": {"$regex": f"^{query_lower}", "$options": "i"}}
    )
    
    # If not found, try partial match (contains)
    if not insulin:
        insulin = await db.insulin_iu_data.find_one(
            {"name_lower": {"$regex": query_lower, "$options": "i"}}
        )
    
    if insulin:
        return {
            "found": True,
            "name": insulin["name"],
            "ml": insulin["ml"],
            "iu_per_package": insulin["iu_per_package"],
            "total_units": insulin["total_units"]
        }
    else:
        return {
            "found": False,
            "message": "Insulin not found in database"
        }

@api_router.post("/medications", response_model=Medication)
async def create_medication(request: Request, medication: MedicationCreate):
    """
    Create new medication.
    """
    user = await get_current_user(request, db)
    
    new_med = Medication(
        user_id=user["id"],
        **medication.dict()
    )
    
    med_dict = serialize_model(new_med.dict())
    await db.medications.insert_one(med_dict)
    
    # Generate adherence logs for today immediately for this new medication
    try:
        await generate_adherence_logs_for_medication(med_dict)
        logging.info(f"[Medication] Generated adherence logs for new medication: {new_med.name}")
    except Exception as e:
        logging.error(f"[Medication] Failed to generate adherence logs: {str(e)}")

    # Refresh CRM Revenue Opportunities (fire-and-forget) so customer-side adds
    # immediately update Expected Revenue.
    try:
        from routes.crm import _trigger_opportunity_refresh
        _trigger_opportunity_refresh()
    except Exception as e:
        logging.debug(f"[Medication] CRM opp refresh skipped: {e}")

    return new_med

@api_router.get("/medications/{medication_id}", response_model=Medication)
async def get_medication(request: Request, medication_id: str):
    """
    Get specific medication.
    """
    user = await get_current_user(request, db)
    
    medication = await db.medications.find_one({
        "id": medication_id,
        "user_id": user["id"]
    })
    
    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    return medication

@api_router.put("/medications/{medication_id}", response_model=Medication)
async def update_medication(request: Request, medication_id: str, update_data: MedicationUpdate):
    """
    Update medication. If schedule changes, old pending reminders are cleared.
    """
    user = await get_current_user(request, db)
    
    # Convert Pydantic model to dict, excluding None values
    update_dict = {}
    for k, v in update_data.dict(exclude_none=True).items():
        if v is not None:
            if isinstance(v, dict):
                update_dict[k] = v
            else:
                update_dict[k] = v
    
    update_dict["updated_at"] = datetime.utcnow()
    
    result = await db.medications.update_one(
        {"id": medication_id, "user_id": user["id"]},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    # If schedule was updated, clear old pending reminders AND adherence logs so they regenerate fresh
    if "schedule" in update_dict:
        deleted = await db.reminders.delete_many({
            "medication_id": medication_id,
            "status": "pending"
        })
        logger.info(f"Schedule updated for {medication_id}: cleared {deleted.deleted_count} old pending reminders")
        
        # CRITICAL: Also delete today's pending adherence logs for this medication.
        # The OneSignal scheduler reads from adherence_logs, so stale logs with the
        # old scheduled_time will keep triggering push notifications if not removed.
        now_ist = datetime.now(timezone(timedelta(hours=5, minutes=30)))
        today_date = now_ist.strftime('%Y-%m-%d')
        deleted_logs = await db.adherence_logs.delete_many({
            "medication_id": medication_id,
            "user_id": user["id"],
            "date": today_date,
            "status": "pending"
        })
        logger.info(f"Schedule updated for {medication_id}: cleared {deleted_logs.deleted_count} old pending adherence logs for today")
        
        # Regenerate adherence logs for the updated medication
        updated_med = await db.medications.find_one({"id": medication_id}, {"_id": 0})
        if updated_med:
            try:
                await generate_adherence_logs_for_medication(updated_med)
                logger.info(f"Regenerated adherence logs for updated medication: {medication_id}")
            except Exception as e:
                logger.error(f"Failed to regenerate adherence logs: {str(e)}")
    
    medication = await db.medications.find_one({"id": medication_id})

    # Refresh CRM Revenue Opportunities (price/schedule/include_in_invoice may have changed)
    try:
        from routes.crm import _trigger_opportunity_refresh
        _trigger_opportunity_refresh()
    except Exception as e:
        logging.debug(f"[Medication] CRM opp refresh skipped: {e}")

    return serialize_model(medication)

@api_router.delete("/medications/{medication_id}")
async def delete_medication(request: Request, medication_id: str):
    """
    Delete medication and its pending reminders.
    """
    user = await get_current_user(request, db)
    
    result = await db.medications.delete_one({
        "id": medication_id,
        "user_id": user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    # Clean up pending reminders for this medication
    deleted_reminders = await db.reminders.delete_many({
        "medication_id": medication_id,
        "status": "pending"
    })
    logger.info(f"Deleted medication {medication_id} and {deleted_reminders.deleted_count} pending reminders")
    
    # Also clean up adherence logs for today (optional, prevents stale entries)
    today = datetime.utcnow().strftime("%Y-%m-%d")
    await db.adherence_logs.delete_many({
        "medication_id": medication_id,
        "user_id": user["id"],
        "date": today,
        "status": "pending"
    })
    
    # Refresh CRM Revenue Opportunities (medicine list changed)
    try:
        from routes.crm import _trigger_opportunity_refresh
        _trigger_opportunity_refresh()
    except Exception as e:
        logging.debug(f"[Medication] CRM opp refresh skipped: {e}")

    return {"message": "Medication and reminders deleted successfully"}


@api_router.post("/medications/{medication_id}/add-stock")
async def add_medication_stock(request: Request, medication_id: str, amount: int):
    """
    Add stock to a medication.
    - For Tablets/Capsules: adds to tablet_stock_count
    - For Injections: adds vials/pens and recalculates total IU
    """
    user = await get_current_user(request, db)
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    medication = await db.medications.find_one({
        "id": medication_id,
        "user_id": user["id"]
    })
    
    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    form = medication.get('form', '').lower()
    
    if form == 'tablet' or form == 'capsule':
        # Add to tablet stock count
        current_stock = medication.get('tablet_stock_count', 0)
        new_stock = current_stock + amount
        
        await db.medications.update_one(
            {"id": medication_id, "user_id": user["id"]},
            {"$set": {"tablet_stock_count": new_stock}}
        )
        
        logger.info(f"Added {amount} tablets to {medication_id}: {current_stock} -> {new_stock}")
        return {
            "message": f"Added {amount} tablets successfully",
            "new_stock": new_stock,
            "form": form
        }
    
    elif form == 'injection':
        # Add vials/pens and recalculate total IU
        current_stock_count = medication.get('injection_stock_count', 0)
        current_iu = medication.get('injection_iu_remaining', 0.0)
        iu_per_package = medication.get('injection_iu_per_package', 0.0)
        
        if iu_per_package <= 0:
            raise HTTPException(
                status_code=400, 
                detail="Cannot add stock: IU per package not configured"
            )
        
        new_stock_count = current_stock_count + amount
        iu_to_add = amount * iu_per_package
        new_iu = current_iu + iu_to_add
        
        await db.medications.update_one(
            {"id": medication_id, "user_id": user["id"]},
            {"$set": {
                "injection_stock_count": new_stock_count,
                "injection_iu_remaining": new_iu
            }}
        )
        
        logger.info(f"Added {amount} vials to {medication_id}: {current_stock_count} -> {new_stock_count} vials, {current_iu} -> {new_iu} IU")
        return {
            "message": f"Added {amount} vials successfully",
            "new_stock_count": new_stock_count,
            "new_iu": new_iu,
            "form": form
        }
    
    else:
        raise HTTPException(
            status_code=400, 
            detail=f"Stock tracking not supported for form: {form}"
        )

# ==================== ADHERENCE LOG ROUTES ====================

@api_router.get("/adherence", response_model=List[AdherenceLog])
async def get_adherence_logs(request: Request, start_date: str = None, end_date: str = None):
    """
    Get adherence logs for current user.
    """
    user = await get_current_user(request, db)
    
    query = {"user_id": user["id"]}
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    logs = await db.adherence_logs.find(query).to_list(1000)
    return logs

@api_router.post("/adherence", response_model=AdherenceLog)
async def create_adherence_log(request: Request, log: AdherenceLogCreate):
    """
    Create adherence log entry.
    Automatically decreases stock when medication is marked as taken.
    - For Tablets: decreases tablet_stock_count by dosage_amount
    - For Injections: decreases injection_iu_remaining by dosage_amount (IU)
    - For other forms (Syrup, etc.): no stock tracking
    """
    user = await get_current_user(request, db)
    
    new_log = AdherenceLog(
        user_id=user["id"],
        **log.dict()
    )
    
    await db.adherence_logs.insert_one(new_log.dict())
    
    # If status is 'taken', decrease stock based on medication form
    if log.status == 'taken' and log.medication_id:
        medication = await db.medications.find_one({
            "id": log.medication_id,
            "user_id": user["id"]
        })
        
        if medication:
            form = medication.get('form', '').lower()
            dosage_amount = log.dosage_amount
            
            # Hybrid stock tracking based on form
            if form == 'tablet' or form == 'capsule':
                # Track by tablet count
                current_stock = medication.get('tablet_stock_count', 0)
                
                if dosage_amount and current_stock > 0:
                    try:
                        amount_to_deduct = int(dosage_amount)
                        new_stock = max(0, current_stock - amount_to_deduct)
                        
                        await db.medications.update_one(
                            {"id": log.medication_id, "user_id": user["id"]},
                            {"$set": {"tablet_stock_count": new_stock}}
                        )
                        logger.info(f"Decreased tablet stock for {log.medication_id}: {current_stock} -> {new_stock} (deducted {amount_to_deduct})")
                    except ValueError:
                        logger.warning(f"Invalid dosage_amount for tablet: {dosage_amount}")
                        
            elif form == 'injection':
                # Track by IU with auto-decrement of vial/pen count
                current_iu = medication.get('injection_iu_remaining', 0.0)
                iu_per_package = medication.get('injection_iu_per_package', 0.0)
                current_stock_count = medication.get('injection_stock_count', 0)
                
                if dosage_amount and current_iu > 0:
                    try:
                        iu_to_deduct = float(dosage_amount)
                        new_iu = max(0.0, current_iu - iu_to_deduct)
                        
                        # Check if we need to auto-decrement the vial/pen count
                        new_stock_count = current_stock_count
                        if iu_per_package > 0 and current_stock_count > 0:
                            # Calculate how many vials remain (round UP to count partial vials)
                            import math
                            packages_remaining = math.ceil(new_iu / iu_per_package) if new_iu > 0 else 0
                            
                            # Update stock count to reflect actual vials remaining
                            if packages_remaining != current_stock_count:
                                new_stock_count = packages_remaining
                                logger.info(f"Auto-updated injection stock count for {log.medication_id}: {current_stock_count} -> {new_stock_count} vials (Remaining: {new_iu} IU)")
                        
                        await db.medications.update_one(
                            {"id": log.medication_id, "user_id": user["id"]},
                            {"$set": {
                                "injection_iu_remaining": new_iu,
                                "injection_stock_count": new_stock_count
                            }}
                        )
                        logger.info(f"Decreased injection IU for {log.medication_id}: {current_iu} -> {new_iu} IU (deducted {iu_to_deduct} IU)")
                    except ValueError:
                        logger.warning(f"Invalid dosage_amount for injection: {dosage_amount}")
            else:
                # No stock tracking for Syrup, Drops, etc.
                logger.info(f"No stock tracking for form: {form}")
                
            # Also update legacy pills_remaining for backward compatibility
            current_pills = medication.get('refill_reminder', {}).get('pills_remaining', 0)
            if current_pills > 0:
                await db.medications.update_one(
                    {"id": log.medication_id, "user_id": user["id"]},
                    {"$set": {"refill_reminder.pills_remaining": current_pills - 1}}
                )
    
    return new_log

@api_router.put("/adherence/{log_id}")
async def update_adherence_log(request: Request, log_id: str, status: str, taken_time: str = None):
    """
    Update adherence log status.
    Automatically decreases stock when medication is marked as taken (from pending).
    """
    user = await get_current_user(request, db)
    
    logging.info(f"[AdherenceLog] Updating log {log_id} to status '{status}' for user {user.get('email')}")
    
    # Get the existing log to check previous status
    existing_log = await db.adherence_logs.find_one({"id": log_id, "user_id": user["id"]}, {"_id": 0})
    
    if not existing_log:
        logging.warning(f"[AdherenceLog] Log {log_id} not found")
        raise HTTPException(status_code=404, detail="Adherence log not found")
    
    previous_status = existing_log.get('status')
    logging.info(f"[AdherenceLog] Previous status: '{previous_status}' -> New status: '{status}'")
    
    update_data = {"status": status}
    if taken_time:
        update_data["taken_time"] = taken_time
    
    # Also clear reminder tracking when marked as taken or skipped to prevent further reminders
    if status in ('taken', 'skipped'):
        update_data["reminder_completed"] = True
        update_data["status_updated_at"] = datetime.utcnow().isoformat()
        logging.info(f"[AdherenceLog] Setting reminder_completed=True to prevent further notifications")
    
    result = await db.adherence_logs.update_one(
        {"id": log_id, "user_id": user["id"]},
        {"$set": update_data}
    )
    
    # Verify the update was applied
    if result.modified_count > 0:
        updated_log = await db.adherence_logs.find_one({"id": log_id}, {"_id": 0, "status": 1, "reminder_completed": 1})
        logging.info(f"[AdherenceLog] ✅ Log {log_id} updated successfully. Current state: status='{updated_log.get('status')}', reminder_completed={updated_log.get('reminder_completed')}")
    else:
        logging.warning(f"[AdherenceLog] ⚠️ Log {log_id} was not modified (possibly already in target state)")
    
    # If status changed from 'pending' to 'taken', decrease stock
    if existing_log.get('status') != 'taken' and status == 'taken' and existing_log.get('medication_id'):
        medication = await db.medications.find_one({
            "id": existing_log['medication_id'],
            "user_id": user["id"]
        }, {"_id": 0})
        
        if medication:
            form = medication.get('form', '').lower()
            dosage_amount = existing_log.get('dosage_amount')
            
            # If dosage_amount not in adherence log, try to get it from medication schedule
            if not dosage_amount:
                scheduled_time = existing_log.get('scheduled_time')
                schedule = medication.get('schedule', {})
                dosage_timings = schedule.get('dosage_timings', [])
                
                # Find the matching dosage timing for this scheduled time
                for timing in dosage_timings:
                    if timing.get('time') == scheduled_time:
                        dosage_amount = timing.get('amount')
                        break
            
            # Hybrid stock tracking based on form
            if form == 'tablet' or form == 'capsule':
                # Track by tablet count
                current_stock = medication.get('tablet_stock_count', 0)
                
                if dosage_amount and current_stock > 0:
                    try:
                        amount_to_deduct = int(dosage_amount)
                        new_stock = max(0, current_stock - amount_to_deduct)
                        
                        await db.medications.update_one(
                            {"id": existing_log['medication_id'], "user_id": user["id"]},
                            {"$set": {"tablet_stock_count": new_stock}}
                        )
                    except (ValueError, TypeError):
                        pass  # Skip if dosage_amount is not a valid number
                        
            elif form == 'injection':
                # Track by IU (International Units)
                current_iu_remaining = medication.get('injection_iu_remaining', 0)
                
                if dosage_amount and current_iu_remaining > 0:
                    try:
                        iu_to_deduct = float(dosage_amount)
                        new_iu_remaining = max(0, current_iu_remaining - iu_to_deduct)
                        
                        await db.medications.update_one(
                            {"id": existing_log['medication_id'], "user_id": user["id"]},
                            {"$set": {"injection_iu_remaining": new_iu_remaining}}
                        )
                    except (ValueError, TypeError):
                        pass  # Skip if dosage_amount is not a valid number
    
    # Notify caregiver when medicine is taken
    if existing_log.get('status') != 'taken' and status == 'taken':
        med_for_notif = await db.medications.find_one(
            {"id": existing_log.get('medication_id')}, {"_id": 0, "name": 1, "dosage": 1}
        ) if existing_log.get('medication_id') else None
        await notify_caregiver(
            patient_user_id=user["id"],
            event_type="taken",
            medication_name=med_for_notif.get("name", "") if med_for_notif else "",
            dosage=med_for_notif.get("dosage", "") if med_for_notif else "",
            scheduled_time=existing_log.get("scheduled_time", "")
        )

    # Notify caregiver when medicine is skipped
    if existing_log.get('status') != 'skipped' and status == 'skipped':
        med_for_notif = await db.medications.find_one(
            {"id": existing_log.get('medication_id')}, {"_id": 0, "name": 1, "dosage": 1}
        ) if existing_log.get('medication_id') else None
        await notify_caregiver(
            patient_user_id=user["id"],
            event_type="skipped",
            medication_name=med_for_notif.get("name", "") if med_for_notif else "",
            dosage=med_for_notif.get("dosage", "") if med_for_notif else "",
            scheduled_time=existing_log.get("scheduled_time", "")
        )

    log = await db.adherence_logs.find_one({"id": log_id}, {"_id": 0})
    return log

# ==================== HEALTH METRICS ROUTES ====================

# Blood Glucose
@api_router.get("/health/glucose", response_model=List[BloodGlucose])
async def get_blood_glucose(request: Request, start_date: str = None, end_date: str = None):
    """
    Get blood glucose readings.
    """
    user = await get_current_user(request, db)
    
    query = {"user_id": user["id"]}
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    readings = await db.blood_glucose.find(query).sort("date", -1).to_list(1000)
    return readings

@api_router.post("/health/glucose", response_model=BloodGlucose)
async def create_blood_glucose(request: Request, reading: BloodGlucoseCreate):
    """
    Create blood glucose reading.
    """
    user = await get_current_user(request, db)
    
    new_reading = BloodGlucose(
        user_id=user["id"],
        **reading.dict()
    )
    
    reading_dict = serialize_model(new_reading.dict())
    await db.blood_glucose.insert_one(reading_dict)
    return new_reading

# Blood Pressure
@api_router.get("/health/bp", response_model=List[BloodPressure])
async def get_blood_pressure(request: Request, start_date: str = None, end_date: str = None):
    """
    Get blood pressure readings.
    """
    user = await get_current_user(request, db)
    
    query = {"user_id": user["id"]}
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    readings = await db.blood_pressure.find(query).sort("date", -1).to_list(1000)
    return readings

@api_router.post("/health/bp", response_model=BloodPressure)
async def create_blood_pressure(request: Request, reading: BloodPressureCreate):
    """
    Create blood pressure reading.
    """
    user = await get_current_user(request, db)
    
    new_reading = BloodPressure(
        user_id=user["id"],
        **reading.dict()
    )
    
    reading_dict = serialize_model(new_reading.dict())
    await db.blood_pressure.insert_one(reading_dict)
    return new_reading

# Body Metrics
@api_router.get("/health/metrics", response_model=List[BodyMetrics])
async def get_body_metrics(request: Request, start_date: str = None, end_date: str = None):
    """
    Get body metrics (weight, height, BMI).
    """
    user = await get_current_user(request, db)
    
    query = {"user_id": user["id"]}
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    metrics = await db.body_metrics.find(query).sort("date", -1).to_list(1000)
    return metrics

@api_router.post("/health/metrics", response_model=BodyMetrics)
async def create_body_metrics(request: Request, metrics: BodyMetricsCreate):
    """
    Create body metrics entry.
    """
    user = await get_current_user(request, db)
    
    new_metrics = BodyMetrics(
        user_id=user["id"],
        **metrics.dict()
    )
    
    metrics_dict = serialize_model(new_metrics.dict())
    await db.body_metrics.insert_one(metrics_dict)
    return new_metrics

# ==================== APPOINTMENT ROUTES ====================

@api_router.get("/appointments", response_model=List[Appointment])
async def get_appointments(request: Request):
    """
    Get all appointments for current user.
    """
    user = await get_current_user(request, db)
    appointments = await db.appointments.find({"user_id": user["id"]}).sort("date", 1).to_list(1000)
    return appointments

@api_router.get("/user/purchase-links")
async def get_my_purchase_links(request: Request):
    """
    Get purchase links for the current logged-in user.
    """
    user = await get_current_user(request, db)
    
    links = await db.user_purchase_links.find_one({"user_id": user["id"]})
    
    if not links:
        return {
            "user_id": user["id"],
            "medicine_order_link": None,
            "medicine_invoice_link": None,
            "medicine_invoice_amount": None,
            "injection_order_link": None,
            "injection_invoice_link": None,
            "injection_invoice_amount": None,
            "product_order_link": None,
            "product_invoice_link": None,
            "product_invoice_amount": None,
            "product_order_completed": False
        }
    
    links.pop("_id", None)
    # Ensure flag is always present for older docs
    if "product_order_completed" not in links:
        links["product_order_completed"] = False
    return links


@api_router.post("/user/purchase-links/product-completed")
async def mark_product_order_completed(request: Request):
    """
    Mark the current user's Product Order Link as completed so the
    "Complete Your Purchase Now" home-card is hidden.
    """
    user = await get_current_user(request, db)
    result = await db.user_purchase_links.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "product_order_completed": True,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"success": True, "matched": result.matched_count, "modified": result.modified_count}

@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(request: Request, appointment: AppointmentCreate):
    """
    Create new appointment.
    Admin users can create appointments for other users by providing user_id.
    """
    user = await get_current_user(request, db)
    
    # Determine the target user_id
    # If user_id is provided and current user is admin, use the provided user_id
    target_user_id = user["id"]
    if appointment.user_id and user.get("role") == "prescription_manager":
        target_user_id = appointment.user_id
    
    # Create appointment data without user_id from the input
    appointment_data = appointment.dict(exclude={"user_id"})
    
    new_appointment = Appointment(
        user_id=target_user_id,
        **appointment_data
    )
    
    await db.appointments.insert_one(new_appointment.dict())

    # Only notify user and caregiver when appointment is created by Prescription Manager
    if user.get("role") == "prescription_manager":
        apt_title = new_appointment.title or "Appointment"
        apt_date = new_appointment.date or ""
        apt_time = new_appointment.time or ""
        notif_body = f"{apt_title} on {apt_date} at {apt_time}"

        try:
            from services.onesignal_service import onesignal_service
            await onesignal_service.send_to_user(
                user_id=target_user_id,
                title="New Appointment Booked",
                body=notif_body,
                data={"type": "appointment_created", "appointment_id": new_appointment.id, "targetPage": "appointments"},
                android_channel_id="appointment_reminders"
            )
            await notify_caregiver(
                patient_user_id=target_user_id,
                event_type="appointment_created",
                medication_name=notif_body,
                dosage="",
                scheduled_time=""
            )
        except Exception as e:
            logging.warning(f"[Appointment] Failed to send creation notification: {str(e)}")

    return new_appointment

@api_router.put("/appointments/{appointment_id}/status")
async def update_appointment_status(request: Request, appointment_id: str, status: str):
    """
    Update appointment status (upcoming, done, postponed, abandoned).
    Prescription managers can update any user's appointment.
    """
    user = await get_current_user(request, db)
    
    valid_statuses = ["upcoming", "done", "postponed", "abandoned"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    # Find the appointment — allow prescription manager to update any appointment
    if user.get("role") == "prescription_manager":
        appointment = await db.appointments.find_one({"id": appointment_id})
    else:
        appointment = await db.appointments.find_one({"id": appointment_id, "user_id": user["id"]})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Update status
    await db.appointments.update_one(
        {"id": appointment_id},
        {"$set": {"status": status, "updated_at": datetime.utcnow()}}
    )
    
    # Only send notification when status is updated by Prescription Manager
    if user.get("role") == "prescription_manager":
        target_user_id = appointment.get("user_id")
        apt_title = appointment.get("title", "Appointment")
        apt_date = appointment.get("date", "")
        apt_time = appointment.get("time", "")
        status_label = status.capitalize()
        notif_body = f"{apt_title} on {apt_date} at {apt_time} — Status: {status_label}"

        try:
            # Notify the patient
            from services.onesignal_service import onesignal_service
            await onesignal_service.send_to_user(
                user_id=target_user_id,
                title="Appointment Updated",
                body=notif_body,
                data={"type": "appointment_update", "appointment_id": appointment_id, "targetPage": "appointments"},
                android_channel_id="appointment_reminders"
            )
            # Notify the caregiver
            await notify_caregiver(
                patient_user_id=target_user_id,
                event_type="appointment_updated",
                medication_name=notif_body,
                dosage="",
                scheduled_time=""
            )
        except Exception as e:
            logging.warning(f"[Appointment] Failed to send update notification: {str(e)}")
    
    # Fetch and return updated appointment
    updated = await db.appointments.find_one({"id": appointment_id})
    updated.pop("_id", None)
    return updated

@api_router.get("/prescription-manager/user/{user_id}/appointments")
async def get_user_appointment_history(request: Request, user_id: str, limit: int = 5):
    """
    Get appointment history for a user (for prescription manager).
    Returns recent appointments sorted by date descending.
    """
    from auth import get_prescription_manager
    
    # Verify prescription manager role
    await get_prescription_manager(request, db)
    
    # Check if user exists
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get recent appointments
    appointments = await db.appointments.find(
        {"user_id": user_id}
    ).sort("date", -1).limit(limit).to_list(limit)
    
    # Remove _id field
    for apt in appointments:
        apt.pop("_id", None)
    
    return appointments

# ==================== FOOD & EXERCISE LOG ROUTES ====================

@api_router.get("/food-logs", response_model=List[FoodLog])
async def get_food_logs(request: Request, date: str = None):
    """
    Get food logs.
    """
    user = await get_current_user(request, db)
    
    query = {"user_id": user["id"]}
    if date:
        query["date"] = date
    
    logs = await db.food_logs.find(query).sort("date", -1).to_list(1000)
    return logs

@api_router.post("/food-logs", response_model=FoodLog)
async def create_food_log(request: Request, log: FoodLogCreate):
    """
    Create food log entry.
    """
    user = await get_current_user(request, db)
    
    new_log = FoodLog(
        user_id=user["id"],
        **log.dict()
    )
    
    await db.food_logs.insert_one(new_log.dict())
    return new_log

@api_router.get("/exercise-logs", response_model=List[ExerciseLog])
async def get_exercise_logs(request: Request, date: str = None):
    """
    Get exercise logs.
    """
    user = await get_current_user(request, db)
    
    query = {"user_id": user["id"]}
    if date:
        query["date"] = date
    
    logs = await db.exercise_logs.find(query).sort("date", -1).to_list(1000)
    return logs

@api_router.post("/exercise-logs", response_model=ExerciseLog)
async def create_exercise_log(request: Request, log: ExerciseLogCreate):
    """
    Create exercise log entry.
    """
    user = await get_current_user(request, db)
    
    new_log = ExerciseLog(
        user_id=user["id"],
        **log.dict()
    )
    
    await db.exercise_logs.insert_one(new_log.dict())
    return new_log

# ==================== NOTIFICATION SETTINGS ROUTES ====================

@api_router.get("/settings/notifications")
async def get_notification_settings(request: Request):
    """
    Get notification settings for current user.
    """
    user = await get_current_user(request, db)
    
    settings = await db.notification_settings.find_one({"user_id": user["id"]}, {"_id": 0})
    
    if not settings:
        # Create default settings
        default_settings = NotificationSettings(user_id=user["id"])
        await db.notification_settings.insert_one(default_settings.dict())
        return default_settings.dict()
    
    # Ensure alarm_enabled field exists for older records
    if "alarm_enabled" not in settings:
        settings["alarm_enabled"] = False
        await db.notification_settings.update_one(
            {"user_id": user["id"]},
            {"$set": {"alarm_enabled": False}}
        )
    
    return settings

@api_router.put("/settings/notifications")
async def update_notification_settings(request: Request, update_data: NotificationSettingsUpdate):
    """
    Update notification settings.
    """
    user = await get_current_user(request, db)
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.utcnow()
    
    # Upsert to handle users who don't have settings yet
    await db.notification_settings.update_one(
        {"user_id": user["id"]},
        {"$set": update_dict},
        upsert=True
    )
    
    settings = await db.notification_settings.find_one({"user_id": user["id"]}, {"_id": 0})
    return settings


# ==================== REMINDER ROUTES ====================

@api_router.get("/reminders", response_model=List[Reminder])
async def get_reminders(request: Request, include_sent: bool = False):
    """
    Get reminders for current user.
    """
    user = await get_current_user(request, db)
    
    query = {"user_id": user["id"]}
    if not include_sent:
        query["status"] = "pending"
    
    reminders = await db.reminders.find(query).sort("trigger_time", 1).to_list(1000)
    return reminders

@api_router.post("/reminders", response_model=Reminder)
async def create_reminder(request: Request, reminder: ReminderCreate):
    """
    Create a new reminder.
    """
    user = await get_current_user(request, db)
    
    new_reminder = Reminder(
        user_id=user["id"],
        **reminder.dict()
    )
    
    reminder_dict = serialize_model(new_reminder.dict())
    await db.reminders.insert_one(reminder_dict)
    return new_reminder

@api_router.delete("/reminders/{reminder_id}")
async def delete_reminder(request: Request, reminder_id: str):
    """
    Delete a reminder.
    """
    user = await get_current_user(request, db)
    
    result = await db.reminders.delete_one({
        "id": reminder_id,
        "user_id": user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    return {"message": "Reminder deleted successfully"}

@api_router.get("/reminders/upcoming")
async def get_upcoming_reminders(request: Request):
    """
    Get upcoming reminders including medication schedules and appointments.
    """
    user = await get_current_user(request, db)
    
    from datetime import datetime, timedelta
    
    today = datetime.utcnow().date()
    tomorrow = today + timedelta(days=1)
    
    # Get today's medication schedule
    medications = await db.medications.find({"user_id": user["id"]}).to_list(1000)
    med_reminders = []
    
    for med in medications:
        if med.get('schedule') and med['schedule'].get('frequency') == 'daily':
            for time in med['schedule'].get('times', []):
                med_reminders.append({
                    'type': 'medication',
                    'title': med['name'],
                    'time': time,
                    'dosage': med.get('dosage', ''),
                    'color': med.get('color', '#FF6B6B')
                })
    
    # Get upcoming appointments
    appointments = await db.appointments.find({
        "user_id": user["id"],
        "status": "upcoming"
    }).sort("date", 1).limit(5).to_list(5)
    
    apt_reminders = []
    for apt in appointments:
        apt_reminders.append({
            'type': 'appointment',
            'appointment_type': apt['type'],
            'title': apt['title'],
            'date': apt['date'],
            'time': apt['time'],
            'doctor': apt.get('doctor', ''),
            'location': apt.get('location', '')
        })
    
    return {
        'medications': med_reminders,
        'appointments': apt_reminders
    }

# ==================== PUSH NOTIFICATION ROUTES ====================

@api_router.post("/push/subscribe")
async def subscribe_to_push(request: Request, subscription: PushSubscriptionCreate):
    """
    Subscribe user to push notifications.
    """
    user = await get_current_user(request, db)
    
    # Check if subscription already exists
    existing = await db.push_subscriptions.find_one({
        "user_id": user["id"],
        "endpoint": subscription.endpoint
    })
    
    if existing:
        return {"message": "Already subscribed"}
    
    new_subscription = PushSubscription(
        user_id=user["id"],
        **subscription.dict()
    )
    
    subscription_dict = serialize_model(new_subscription.dict())
    await db.push_subscriptions.insert_one(subscription_dict)
    return {"message": "Subscribed successfully"}

@api_router.post("/push/unsubscribe")
async def unsubscribe_from_push(request: Request, endpoint: str):
    """
    Unsubscribe from push notifications.
    """
    user = await get_current_user(request, db)
    
    result = await db.push_subscriptions.delete_one({
        "user_id": user["id"],
        "endpoint": endpoint
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    return {"message": "Unsubscribed successfully"}

@api_router.get("/push/vapid-public-key")
async def get_vapid_public_key():
    """
    Get VAPID public key for push notifications.
    """
    vapid_public_key = os.environ.get('VAPID_PUBLIC_KEY', '')
    return {"publicKey": vapid_public_key}


@api_router.post("/push/test")
async def send_test_push_notification(request: Request):
    """
    Send a test push notification to all subscribers.
    Admin/testing endpoint.
    """
    from reminder_service import send_push_notification
    
    # Get all push subscriptions
    subscriptions = await db.push_subscriptions.find({}).to_list(1000)
    
    if not subscriptions:
        return {"message": "No subscriptions found", "sent": 0}
    
    # Create test reminder
    test_reminder = {
        "title": "DiabeXpert Test Notification",
        "message": "Our push message system is working fine.",
        "type": "test"
    }
    
    # Group subscriptions by user
    user_subscriptions = {}
    for sub in subscriptions:
        user_id = sub.get('user_id')
        if user_id not in user_subscriptions:
            user_subscriptions[user_id] = []
        user_subscriptions[user_id].append(sub)
    
    success_count = 0
    for user_id, user_subs in user_subscriptions.items():
        success = await send_push_notification(user_subs, test_reminder)
        if success:
            success_count += 1
    
    return {
        "message": "Test notifications sent",
        "total_subscriptions": len(subscriptions),
        "users_notified": success_count
    }


# ==================== ONESIGNAL TEST PUSH ENDPOINT ====================

@api_router.post("/notifications/test-onesignal")
async def send_test_onesignal_push(request: Request):
    """
    Send a test push notification via OneSignal to the current user.
    Used to verify push notification setup is working correctly.
    """
    try:
        # Get current user
        user = await get_current_user(request, db)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        # Use 'id' field (UUID) not '_id' (MongoDB ObjectId)
        user_id = user.get('id')
        
        # Import OneSignal service
        from services.onesignal_service import onesignal_service
        
        if not onesignal_service.is_configured():
            return {
                "success": False,
                "error": "OneSignal not configured on server",
                "user_id": user_id
            }
        
        # Send test notification
        result = await onesignal_service.send_test_notification(user_id)
        
        return {
            "success": result.get("success", False),
            "user_id": user_id,
            "notification_id": result.get("notification_id"),
            "recipients": result.get("recipients", 0),
            "error": result.get("error"),
            "message": "Test notification sent!" if result.get("success") else "Failed to send - no device registered with this user_id in OneSignal"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Test push error: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


@api_router.get("/notifications/debug-info")
async def get_notification_debug_info(request: Request):
    """
    Get debug information about push notification setup.
    Helps diagnose OneSignal configuration issues.
    """
    try:
        # Get current user
        user = await get_current_user(request, db)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        # Use 'id' field (UUID) not '_id' (MongoDB ObjectId)
        user_id = user.get('id')
        
        # Import OneSignal service
        from services.onesignal_service import onesignal_service
        
        return {
            "user_id": user_id,
            "user_email": user.get('email'),
            "onesignal_configured": onesignal_service.is_configured(),
            "onesignal_app_id": onesignal_service.app_id[:20] + "..." if onesignal_service.app_id else "NOT SET",
            "important": (
                "The user_id shown above must EXACTLY match what OneSignal.login() receives in the app. "
                "If they don't match, push notifications will fail with 'recipients: 0'."
            )
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Debug info error: {str(e)}")
        return {"error": str(e)}


# ==================== SCHEDULER ENDPOINTS (For External Cron) ====================

@api_router.post("/reminders/generate-daily")
async def generate_daily_reminders_endpoint():
    """
    Generate reminders for the next day.
    Called by external cron service daily at midnight.
    No authentication required (can add API key if needed).
    """
    try:
        from reminder_service import generate_daily_reminders
        
        reminder_count = await generate_daily_reminders(db)
        
        return {
            "success": True,
            "message": "Daily reminders generated successfully",
            "reminders_created": reminder_count,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to generate daily reminders: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@api_router.post("/reminders/send-pending")
async def send_pending_reminders_endpoint():
    """
    Check and send pending notifications.
    Called by external cron service every 2-3 minutes.
    No authentication required (can add API key if needed).
    """
    try:
        from reminder_service import send_pending_notifications
        
        sent_count = await send_pending_notifications(db)
        
        return {
            "success": True,
            "message": "Pending reminders processed",
            "notifications_sent": sent_count,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to send pending reminders: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@api_router.get("/reminders/status")
async def get_reminder_status():
    """
    Get status of reminder system.
    Shows pending, sent, and failed reminders.
    """
    try:
        # Count reminders by status
        pending_count = await db.reminders.count_documents({"status": "pending"})
        sent_count = await db.reminders.count_documents({"status": "sent"})
        failed_count = await db.reminders.count_documents({"status": "failed"})
        skipped_count = await db.reminders.count_documents({"status": "skipped"})
        
        # Get next pending reminder
        next_reminder = await db.reminders.find_one(
            {"status": "pending"},
            sort=[("trigger_time", 1)]
        )
        
        # Count push subscriptions
        subscription_count = await db.push_subscriptions.count_documents({})
        
        return {
            "success": True,
            "reminder_stats": {
                "pending": pending_count,
                "sent": sent_count,
                "failed": failed_count,
                "skipped": skipped_count
            },
            "next_reminder": {
                "trigger_time": next_reminder.get("trigger_time") if next_reminder else None,
                "title": next_reminder.get("title") if next_reminder else None,
                "urgency": next_reminder.get("urgency") if next_reminder else None
            } if next_reminder else None,
            "push_subscriptions": subscription_count,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to get reminder status: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@api_router.post("/scheduler/trigger-check")
async def trigger_missed_medication_check():
    """
    Manually trigger the missed medication check.
    Use this for testing server-side follow-up notifications.
    """
    try:
        logger.info("[Manual Trigger] Starting missed medication check...")
        await check_missed_medications()
        return {
            "success": True,
            "message": "Missed medication check triggered successfully",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"[Manual Trigger] Failed: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@api_router.post("/scheduler/trigger-appointment-reminders")
async def trigger_appointment_reminders():
    """
    Manually trigger appointment reminders.
    Sends reminders for today's and tomorrow's appointments.
    """
    try:
        logger.info("[Manual Trigger] Starting appointment reminder check...")
        await send_appointment_reminders()
        return {
            "success": True,
            "message": "Appointment reminders triggered successfully",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"[Manual Trigger] Failed: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@api_router.post("/scheduler/trigger-refill-reminders")
async def trigger_refill_reminders():
    """
    Manually trigger medicine refill reminders.
    Sends reminders for medications with low stock.
    """
    try:
        logger.info("[Manual Trigger] Starting refill reminder check...")
        await send_refill_reminders()
        return {
            "success": True,
            "message": "Refill reminders triggered successfully",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"[Manual Trigger] Failed: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }



@api_router.post("/reminders/cleanup-expired")
async def cleanup_expired_reminders_endpoint():
    """
    Cleanup old expired reminders (older than 24 hours).
    Called by external cron service daily.
    """
    try:
        from reminder_service import cleanup_expired_reminders
        
        expired_count = await cleanup_expired_reminders(db)
        
        return {
            "success": True,
            "message": "Expired reminders cleaned up",
            "reminders_expired": expired_count,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to cleanup expired reminders: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@api_router.post("/reminders/force-send-overdue")
async def force_send_overdue_reminders():
    """
    Emergency endpoint to force-send ALL overdue pending reminders.
    Use for testing or recovery after system downtime.
    """
    try:
        from datetime import datetime, timezone
        
        # Get ALL pending reminders with past trigger times
        now = datetime.now(timezone.utc).isoformat()
        
        overdue_reminders = await db.reminders.find({
            "status": "pending",
            "notification_sent": False,
            "trigger_time": {"$lt": now}
        }).to_list(1000)
        
        sent_count = 0
        failed_count = 0
        
        for reminder in overdue_reminders:
            # Get reminder ID (handle both 'id' and '_id' fields)
            reminder_id = reminder.get('id') or str(reminder.get('_id'))
            
            # Get user's push subscriptions
            subscriptions = await db.push_subscriptions.find({
                "user_id": reminder.get('user_id')
            }).to_list(100)
            
            if not subscriptions:
                failed_count += 1
                # Update using both possible ID fields
                await db.reminders.update_one(
                    {"$or": [{"id": reminder_id}, {"_id": reminder.get('_id')}]},
                    {"$set": {"status": "failed"}}
                )
                continue
            
            # Import and use send_push_notification
            from reminder_service import send_push_notification
            success = await send_push_notification(subscriptions, reminder)
            
            if success:
                await db.reminders.update_one(
                    {"$or": [{"id": reminder_id}, {"_id": reminder.get('_id')}]},
                    {"$set": {
                        "notification_sent": True,
                        "status": "sent",
                        "sent_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                sent_count += 1
            else:
                await db.reminders.update_one(
                    {"$or": [{"id": reminder_id}, {"_id": reminder.get('_id')}]},
                    {"$set": {"status": "failed"}}
                )
                failed_count += 1
        
        return {
            "success": True,
            "message": "Force-sent overdue reminders",
            "notifications_sent": sent_count,
            "failed": failed_count,
            "total_processed": len(overdue_reminders),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        import traceback
        logger.error(f"Failed to force-send overdue reminders: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }



# Define CORS origins as a constant for reuse
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost",
    "https://careable-preview.preview.emergentagent.com",
    "https://medremind-pwa.emergent.host",
    "https://diabexpert.online",
    "https://www.diabexpert.online",
    "capacitor://localhost",
    "ionic://localhost",
]

# Custom exception handler to add CORS headers to error responses
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Add CORS headers to HTTP exceptions"""
    from fastapi.responses import JSONResponse
    
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )
    
    # Add CORS headers manually
    origin = request.headers.get("origin")
    if origin in CORS_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response

# Catch-all exception handler for unexpected errors
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Add CORS headers to all exceptions (including 500 errors)"""
    from fastapi.responses import JSONResponse
    import traceback
    
    # Log the error
    logger.error(f"Unhandled exception: {str(exc)}")
    logger.error(traceback.format_exc())
    
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)}
    )
    
    # Add CORS headers manually
    origin = request.headers.get("origin")
    if origin in CORS_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response

# Add CORS middleware BEFORE including routes (order matters!)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include the router in the main app AFTER middleware
app.include_router(api_router)

# Include product routes
app.include_router(products_router)

# Include checkout routes
app.include_router(checkout_router)

# Include caregiver routes
app.include_router(caregiver_router)

# Include prescription manager routes
app.include_router(pm_router)
app.include_router(inv_router)
app.include_router(crm_router)

# JWT email/password auth (works alongside Emergent OAuth)
from jwt_auth import build_jwt_auth_router
jwt_auth_router = build_jwt_auth_router(db)
app.include_router(jwt_auth_router, prefix="/api")

@app.get("/api/download/{filename}")
async def download_file(filename: str):
    # Check multiple locations for the file
    for base in ["/app/backend/static", "/app"]:
        filepath = os.path.join(base, filename)
        if os.path.exists(filepath):
            return FileResponse(filepath, filename=filename, media_type="application/zip")
    raise HTTPException(status_code=404, detail="File not found")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
