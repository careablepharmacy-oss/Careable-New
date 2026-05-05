"""Prescription Manager, Admin, and Dashboard routes."""
from fastapi import APIRouter, Request, HTTPException, File, UploadFile, Form
from datetime import datetime, timezone, timedelta
from typing import List
import logging
import uuid

from auth import get_current_user, get_prescription_manager
from helpers import serialize_model, generate_adherence_logs_for_medication, get_webhook_url, send_missed_medication_webhook, ADMIN_EMAIL
from models import (
    MedicationCreate, MedicationUpdate, UserUpdate,
    BloodGlucoseCreate, BloodPressureCreate, BodyMetricsCreate,
    UserPurchaseLinksUpdate, UserPurchaseLinks
)

logger = logging.getLogger(__name__)

router = APIRouter()

db = None


def set_db(database):
    global db
    db = database


# ==================== PRESCRIPTION MANAGER ROUTES ====================

@router.get("/api/prescription-manager/users")
async def get_all_users_for_manager(request: Request):
    manager = await get_prescription_manager(request, db)
    users_cursor = db.users.find().sort("created_at", -1)
    users = await users_cursor.to_list(length=None)
    user_list = []
    for user in users:
        user_list.append({
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "phone": user.get("phone"),
            "age": user.get("age"),
            "sex": user.get("sex"),
            "diabetes_type": user.get("diabetes_type", "Type 2"),
            "created_at": user.get("created_at"),
            "role": user.get("role", "user")
        })
    return {"users": user_list, "total": len(user_list)}


@router.get("/api/prescription-manager/user/{user_id}")
async def get_user_details_for_manager(request: Request, user_id: str):
    manager = await get_prescription_manager(request, db)
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
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
        "created_at": user.get("created_at"),
        "updated_at": user.get("updated_at"),
        "role": user.get("role", "user")
    }


@router.get("/api/prescription-manager/user/{user_id}/medications")
async def get_user_medications_for_manager(request: Request, user_id: str):
    manager = await get_prescription_manager(request, db)
    medications_cursor = db.medications.find({"user_id": user_id}).sort("created_at", -1)
    medications = await medications_cursor.to_list(length=None)
    for med in medications:
        med.pop('_id', None)
    return {"medications": medications}


@router.post("/api/prescription-manager/user/{user_id}/medications")
async def create_medication_for_user(request: Request, user_id: str, medication: MedicationCreate):
    manager = await get_prescription_manager(request, db)
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    from models import Medication
    new_medication = Medication(user_id=user_id, **medication.dict())
    medication_dict = serialize_model(new_medication.dict())
    await db.medications.insert_one(medication_dict)
    try:
        await generate_adherence_logs_for_medication(medication_dict)
        logging.info(f"[PrescriptionManager] Generated adherence logs for new medication: {new_medication.name}")
    except Exception as e:
        logging.error(f"[PrescriptionManager] Failed to generate adherence logs: {str(e)}")
    medication_dict.pop('_id', None)
    try:
        from routes.crm import _trigger_opportunity_refresh
        _trigger_opportunity_refresh()
    except Exception:
        pass
    return medication_dict


@router.put("/api/prescription-manager/user/{user_id}/medications/{medication_id}")
async def update_medication_for_user(request: Request, user_id: str, medication_id: str, medication: MedicationUpdate):
    manager = await get_prescription_manager(request, db)
    existing_medication = await db.medications.find_one({"id": medication_id, "user_id": user_id})
    if not existing_medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    update_data = {k: v for k, v in medication.dict(exclude_unset=True).items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.utcnow().isoformat()
        update_data = serialize_model(update_data)
        await db.medications.update_one({"id": medication_id, "user_id": user_id}, {"$set": update_data})

        # If schedule changed, clear old pending adherence logs and regenerate
        if "schedule" in update_data:
            await db.reminders.delete_many({"medication_id": medication_id, "status": "pending"})
            now_ist = datetime.now(timezone(timedelta(hours=5, minutes=30)))
            today_date = now_ist.strftime('%Y-%m-%d')
            await db.adherence_logs.delete_many({
                "medication_id": medication_id,
                "user_id": user_id,
                "date": today_date,
                "status": "pending"
            })
            updated_med = await db.medications.find_one({"id": medication_id}, {"_id": 0})
            if updated_med:
                try:
                    await generate_adherence_logs_for_medication(updated_med)
                    logger.info(f"[PM] Regenerated adherence logs for {medication_id} after schedule change")
                except Exception as e:
                    logger.error(f"[PM] Failed to regenerate adherence logs: {str(e)}")

    updated_medication = await db.medications.find_one({"id": medication_id})
    if updated_medication:
        updated_medication.pop('_id', None)
    try:
        from routes.crm import _trigger_opportunity_refresh
        _trigger_opportunity_refresh()
    except Exception:
        pass
    return updated_medication


@router.delete("/api/prescription-manager/user/{user_id}/medications/{medication_id}")
async def delete_medication_for_user(request: Request, user_id: str, medication_id: str):
    manager = await get_prescription_manager(request, db)
    result = await db.medications.delete_one({"id": medication_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Medication not found")
    await db.reminders.delete_many({"medication_id": medication_id, "status": "pending"})
    try:
        from routes.crm import _trigger_opportunity_refresh
        _trigger_opportunity_refresh()
    except Exception:
        pass
    return {"message": "Medication and reminders deleted successfully"}


@router.post("/api/prescription-manager/users/{user_id}/medications/{medication_id}/add-stock")
async def add_stock_for_user(request: Request, user_id: str, medication_id: str, amount: int):
    """Add stock to a user's medication (Prescription Manager only)."""
    manager = await get_prescription_manager(request, db)

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    medication = await db.medications.find_one({"id": medication_id, "user_id": user_id})
    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")

    form = medication.get('form', '').lower()

    if form in ('tablet', 'capsule'):
        current_stock = medication.get('tablet_stock_count', 0)
        new_stock = current_stock + amount
        await db.medications.update_one(
            {"id": medication_id, "user_id": user_id},
            {"$set": {"tablet_stock_count": new_stock}}
        )
        logger.info(f"[PM] {manager['email']} added {amount} tablets to {medication_id} for user {user_id}: {current_stock} -> {new_stock}")
        return {"message": f"Added {amount} {form}s successfully", "new_stock": new_stock, "form": form}

    elif form == 'injection':
        current_stock_count = medication.get('injection_stock_count', 0)
        current_iu = medication.get('injection_iu_remaining', 0.0)
        iu_per_package = medication.get('injection_iu_per_package', 0.0)
        if iu_per_package <= 0:
            raise HTTPException(status_code=400, detail="Cannot add stock: IU per package not configured")
        new_stock_count = current_stock_count + amount
        new_iu = current_iu + (amount * iu_per_package)
        await db.medications.update_one(
            {"id": medication_id, "user_id": user_id},
            {"$set": {"injection_stock_count": new_stock_count, "injection_iu_remaining": new_iu}}
        )
        logger.info(f"[PM] {manager['email']} added {amount} vials to {medication_id} for user {user_id}: {current_stock_count} -> {new_stock_count}")
        return {"message": f"Added {amount} vials successfully", "new_stock_count": new_stock_count, "new_iu": new_iu, "form": form}

    else:
        raise HTTPException(status_code=400, detail=f"Stock tracking not supported for form: {form}")


@router.delete("/api/prescription-manager/user/{user_id}")
async def delete_user(request: Request, user_id: str):
    manager = await get_prescription_manager(request, db)
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get('role') == 'prescription_manager':
        raise HTTPException(status_code=403, detail="Cannot delete other prescription managers")
    await db.medications.delete_many({"user_id": user_id})
    await db.blood_glucose.delete_many({"user_id": user_id})
    await db.blood_pressure.delete_many({"user_id": user_id})
    await db.body_metrics.delete_many({"user_id": user_id})
    await db.appointments.delete_many({"user_id": user_id})
    await db.adherence_records.delete_many({"user_id": user_id})
    await db.adherence_logs.delete_many({"user_id": user_id})
    await db.sessions.delete_many({"user_id": user_id})
    # Purge CRM-side data so the user stops appearing in the CRM dashboard after PM deletion
    await db.crm_patient_profiles.delete_one({"id": user_id})
    await db.crm_opportunities.delete_many({"patient_id": user_id})
    await db.crm_lab_bookings.delete_many({"patient_id": user_id})
    await db.crm_revenue_conversions.delete_many({"patient_id": user_id})
    await db.user_purchase_links.delete_many({"user_id": user_id})
    await db.reminders.delete_many({"user_id": user_id})
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User and all associated data deleted successfully"}


@router.put("/api/prescription-manager/user/{user_id}")
async def update_user_profile(request: Request, user_id: str, user_update: UserUpdate):
    await get_prescription_manager(request, db)
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    update_data = user_update.dict(exclude_unset=True)
    if 'email' in update_data:
        del update_data['email']
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    update_data['updated_at'] = datetime.utcnow()
    await db.users.update_one({"id": user_id}, {"$set": update_data})

    # Mirror identity-shared fields to crm_patient_profiles so CRM sees the same data.
    try:
        from routes.crm import mirror_profile_to_crm
        await mirror_profile_to_crm(user_id, update_data)
    except Exception:
        pass

    updated_user = await db.users.find_one({"id": user_id})
    updated_user.pop("_id", None)
    return updated_user


@router.get("/api/prescription-manager/user/{user_id}/purchase-links")
async def get_user_purchase_links(request: Request, user_id: str):
    await get_prescription_manager(request, db)
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    links = await db.user_purchase_links.find_one({"user_id": user_id})
    if not links:
        return {
            "user_id": user_id,
            "medicine_order_link": None, "medicine_invoice_link": None,
            "medicine_invoice_amount": None, "injection_order_link": None,
            "injection_invoice_link": None, "injection_invoice_amount": None,
            "product_order_link": None, "product_invoice_link": None,
            "product_invoice_amount": None, "product_order_completed": False
        }
    links.pop("_id", None)
    if "product_order_completed" not in links:
        links["product_order_completed"] = False
    return links


@router.put("/api/prescription-manager/user/{user_id}/purchase-links")
async def update_user_purchase_links(request: Request, user_id: str, links_update: UserPurchaseLinksUpdate):
    manager = await get_prescription_manager(request, db)
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    existing = await db.user_purchase_links.find_one({"user_id": user_id})
    update_data = links_update.dict(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()
    update_data["updated_by"] = manager["id"]
    # If PM updates the product order link, reset the "completed" flag so the
    # customer's home-card "Complete Your Purchase Now" shows again for the new link.
    if "product_order_link" in update_data:
        new_link = update_data.get("product_order_link") or ""
        prev_link = (existing or {}).get("product_order_link") or ""
        if new_link.strip() != prev_link.strip():
            update_data["product_order_completed"] = False
    if existing:
        await db.user_purchase_links.update_one({"user_id": user_id}, {"$set": update_data})
    else:
        new_links = UserPurchaseLinks(user_id=user_id, **update_data)
        await db.user_purchase_links.insert_one(new_links.dict())
    updated = await db.user_purchase_links.find_one({"user_id": user_id})
    updated.pop("_id", None)
    return updated


@router.get("/api/prescription-manager/user/{user_id}/appointments")
async def get_user_appointment_history(request: Request, user_id: str, limit: int = 5):
    await get_prescription_manager(request, db)
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    appointments = await db.appointments.find({"user_id": user_id}).sort("date", -1).limit(limit).to_list(limit)
    for apt in appointments:
        apt.pop("_id", None)
    return appointments


@router.post("/api/prescription-manager/cleanup-database")
async def cleanup_production_database(request: Request):
    current_user = await get_prescription_manager(request, db)
    try:
        body = await request.json()
        confirmation_password = body.get('confirmation_password', '')
    except:
        raise HTTPException(status_code=400, detail="Request body required")
    CLEANUP_PASSWORD = "DELETE_ALL_DATA_2025"
    if confirmation_password != CLEANUP_PASSWORD:
        raise HTTPException(status_code=403, detail="Incorrect confirmation password")
    logging.info(f"[DATABASE CLEANUP] Initiated by {current_user.get('email')}")
    try:
        admin = await db.users.find_one({"email": ADMIN_EMAIL})
        if not admin:
            raise HTTPException(status_code=500, detail="Admin user not found")
        admin_id = admin['id']
        users_before = await db.users.count_documents({})
        meds_before = await db.medications.count_documents({})
        logs_before = await db.adherence_logs.count_documents({})
        non_admin_users = await db.users.find({"email": {"$ne": ADMIN_EMAIL}}).to_list(length=None)
        non_admin_ids = [u['id'] for u in non_admin_users]
        if non_admin_ids:
            await db.medications.delete_many({"user_id": {"$in": non_admin_ids}})
            await db.adherence_logs.delete_many({"user_id": {"$in": non_admin_ids}})
            await db.adherence_records.delete_many({"user_id": {"$in": non_admin_ids}})
            await db.blood_glucose.delete_many({"user_id": {"$in": non_admin_ids}})
            await db.blood_pressure.delete_many({"user_id": {"$in": non_admin_ids}})
            await db.body_metrics.delete_many({"user_id": {"$in": non_admin_ids}})
            await db.appointments.delete_many({"user_id": {"$in": non_admin_ids}})
            await db.sessions.delete_many({"user_id": {"$in": non_admin_ids}})
            await db.users.delete_many({"email": {"$ne": ADMIN_EMAIL}})
        await db.medications.delete_many({"user_id": admin_id})
        await db.adherence_logs.delete_many({"user_id": admin_id})
        await db.adherence_records.delete_many({"user_id": admin_id})
        await db.blood_glucose.delete_many({"user_id": admin_id})
        await db.blood_pressure.delete_many({"user_id": admin_id})
        await db.body_metrics.delete_many({"user_id": admin_id})
        await db.appointments.delete_many({"user_id": admin_id})
        await db.medications.delete_many({})
        await db.adherence_logs.delete_many({})
        await db.adherence_records.delete_many({})
        users_after = await db.users.count_documents({})
        return {
            "success": True, "message": "Database cleaned successfully",
            "deleted": {"users": len(non_admin_ids), "medications": meds_before, "adherence_logs": logs_before},
            "remaining": {"users": users_after, "medications": await db.medications.count_documents({}), "adherence_logs": await db.adherence_logs.count_documents({})}
        }
    except Exception as e:
        logging.error(f"[CLEANUP] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")


# ==================== ADMIN CSV / IMPORT ROUTES ====================

@router.post("/api/admin/upload-csv")
async def upload_csv_file(request: Request, file: UploadFile = File(...), upload_type: str = Form(...)):
    user = await get_current_user(request, db)
    if user.get('email') != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access required")
    if upload_type not in ['medicines', 'insulin']:
        raise HTTPException(status_code=400, detail="Invalid upload type. Must be 'medicines' or 'insulin'")
    contents = await file.read()
    csv_text = contents.decode('utf-8')
    import csv
    from io import StringIO
    csv_reader = csv.DictReader(StringIO(csv_text))
    try:
        if upload_type == 'medicines':
            medicines = []
            for row in csv_reader:
                name = row.get('Medicine Name', '').strip()
                if name:
                    medicines.append({'id': str(uuid.uuid4()), 'name': name, 'name_lower': name.lower()})
            if not medicines:
                raise HTTPException(status_code=400, detail="No valid medicine names found in CSV")
            await db.medicines.drop()
            await db.medicines.insert_many(medicines)
            await db.medicines.create_index([('name_lower', 1)])
            return {"success": True, "message": f"Successfully imported {len(medicines)} medicines", "total_imported": len(medicines)}
        elif upload_type == 'insulin':
            products = []
            for row in csv_reader:
                name = row.get('Medicine Name', '').strip()
                ml = row.get('ML', '').strip()
                iu = row.get('IU/Package', '').strip()
                units = row.get('Total Units', '').strip()
                if name and ml and iu and units:
                    products.append({'id': str(uuid.uuid4()), 'name': name, 'name_lower': name.lower(), 'ml': float(ml), 'iu_per_package': int(iu), 'total_units': int(units)})
            if not products:
                raise HTTPException(status_code=400, detail="No valid insulin products found in CSV")
            await db.insulin_iu_data.drop()
            await db.insulin_iu_data.insert_many(products)
            await db.insulin_iu_data.create_index([('name_lower', 1)])
            return {"success": True, "message": f"Successfully imported {len(products)} insulin products", "total_imported": len(products)}
    except Exception as e:
        logging.error(f"[Direct Upload] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/api/admin/upload-insulin-direct")
async def upload_insulin_direct(request: Request):
    user = await get_current_user(request, db)
    if user.get('email') != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        body = await request.body()
        csv_text = body.decode('utf-8')
        import csv
        from io import StringIO
        csv_reader = csv.DictReader(StringIO(csv_text))
        products = []
        for row in csv_reader:
            name = row.get('Medicine Name', '').strip()
            ml = row.get('ML', '').strip()
            iu = row.get('IU/Package', '').strip()
            units = row.get('Total Units', '').strip()
            if name and ml and iu and units:
                products.append({'id': str(uuid.uuid4()), 'name': name, 'name_lower': name.lower(), 'ml': float(ml), 'iu_per_package': int(iu), 'total_units': int(units)})
        if not products:
            raise HTTPException(status_code=400, detail="No valid insulin products found in CSV")
        await db.insulin_iu_data.drop()
        await db.insulin_iu_data.insert_many(products)
        await db.insulin_iu_data.create_index([('name_lower', 1)])
        return {"success": True, "message": f"Successfully imported {len(products)} insulin products", "total_imported": len(products)}
    except Exception as e:
        logging.error(f"[Direct Upload] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/api/admin/import-medicines")
async def import_medicines_to_production(request: Request):
    current_user = await get_prescription_manager(request, db)
    logging.info(f"[MEDICINE IMPORT] Initiated by {current_user.get('email')}")
    try:
        import csv
        csv_path = 'medicines.csv'
        medicines = []
        with open(csv_path, 'r', encoding='utf-8') as file:
            for row in csv.DictReader(file):
                name = row.get('Brand Name', '').strip()
                if name:
                    medicines.append({'id': str(uuid.uuid4()), 'name': name, 'name_lower': name.lower()})
        if not medicines:
            raise HTTPException(status_code=400, detail="No medicines found in CSV")
        existing_count = await db.medicines.count_documents({})
        if existing_count > 0:
            await db.medicines.drop()
        await db.medicines.insert_many(medicines)
        await db.medicines.create_index([('name_lower', 1)])
        return {"success": True, "message": "Medicines imported successfully", "total_imported": len(medicines), "sample_medicines": [m['name'] for m in medicines[:10]]}
    except Exception as e:
        logging.error(f"[MEDICINE IMPORT] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.post("/api/admin/import-insulin-products")
async def import_insulin_products(request: Request):
    current_user = await get_prescription_manager(request, db)
    logging.info(f"[INSULIN IMPORT] Initiated by {current_user.get('email')}")
    try:
        import csv
        from pathlib import Path
        csv_path = Path(__file__).parent.parent / 'insulin_products.csv'
        products = []
        with open(csv_path, 'r', encoding='utf-8') as file:
            for row in csv.DictReader(file):
                name = row.get('Medicine Name', '').strip()
                ml = row.get('ML', '').strip()
                iu = row.get('IU/Package', '').strip()
                units = row.get('Total Units', '').strip()
                if name and ml and iu and units:
                    products.append({'id': str(uuid.uuid4()), 'name': name, 'name_lower': name.lower(), 'ml': float(ml), 'iu_per_package': int(iu), 'total_units': int(units)})
        if not products:
            raise HTTPException(status_code=400, detail="No insulin products found in CSV")
        existing_count = await db.insulin_iu_data.count_documents({})
        if existing_count > 0:
            await db.insulin_iu_data.drop()
        await db.insulin_iu_data.insert_many(products)
        await db.insulin_iu_data.create_index([('name_lower', 1)])
        return {"success": True, "message": "Insulin products imported successfully", "total_imported": len(products), "sample_products": [p['name'] for p in products[:10]]}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="insulin_products.csv not found on server")
    except Exception as e:
        logging.error(f"[INSULIN IMPORT] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== WEBHOOK CONFIG ====================

@router.get("/api/prescription-manager/webhook-config")
async def get_webhook_config_endpoint(request: Request):
    from helpers import MISSED_MEDICATION_WEBHOOK_URL
    manager = await get_prescription_manager(request, db)
    config = await db.webhook_config.find_one({})
    if not config:
        return {"webhook_url": MISSED_MEDICATION_WEBHOOK_URL, "enabled": True, "description": "Missed medication webhook (default)", "is_default": True}
    config.pop('_id', None)
    return config


@router.put("/api/prescription-manager/webhook-config")
async def update_webhook_config(request: Request, webhook_url: str, enabled: bool = True, description: str = ""):
    manager = await get_prescription_manager(request, db)
    if not webhook_url.startswith('http'):
        raise HTTPException(status_code=400, detail="Invalid webhook URL. Must start with http or https")
    config_data = {
        "webhook_url": webhook_url, "enabled": enabled, "description": description,
        "updated_at": datetime.now(timezone.utc), "updated_by": manager['id']
    }
    existing_config = await db.webhook_config.find_one({})
    if existing_config:
        await db.webhook_config.update_one({"id": existing_config['id']}, {"$set": config_data})
        return {"message": "Webhook configuration updated successfully", **config_data}
    else:
        from models import WebhookConfig
        new_config = WebhookConfig(**config_data)
        config_dict = serialize_model(new_config.dict())
        await db.webhook_config.insert_one(config_dict)
        return {"message": "Webhook configuration created successfully", **config_data}


@router.post("/api/prescription-manager/webhook-test")
async def test_webhook(request: Request):
    manager = await get_prescription_manager(request, db)
    webhook_url = await get_webhook_url()
    test_user = {"name": "Test User (John Doe)", "phone": "+919876543210", "relative_name": "Test Family Member (Jane Doe)", "relative_whatsapp": "+919876543211"}
    test_medication = {"name": "Test Medication (Metformin)", "dosage": "500mg"}
    test_log = {"id": None, "scheduled_time": "09:00", "date": datetime.now(timezone.utc).strftime('%Y-%m-%d')}
    result = await send_missed_medication_webhook(test_user, test_medication, test_log, webhook_url)
    if result.get('success'):
        return {"message": "Test webhook sent successfully", "webhook_url": webhook_url, "status_code": result.get('status_code'), "response": result.get('response')}
    else:
        raise HTTPException(status_code=500, detail=f"Failed to send test webhook: {result.get('error', result.get('response'))}")


# ==================== HEALTH REPORTS FOR PM ====================

@router.get("/api/prescription-manager/user/{user_id}/health-reports")
async def get_user_health_reports_for_manager(request: Request, user_id: str):
    manager = await get_prescription_manager(request, db)
    glucose_data = await db.blood_glucose.find({"user_id": user_id}).sort("date", -1).limit(50).to_list(length=50)
    bp_data = await db.blood_pressure.find({"user_id": user_id}).sort("date", -1).limit(50).to_list(length=50)
    metrics_data = await db.body_metrics.find({"user_id": user_id}).sort("date", -1).limit(50).to_list(length=50)
    for item in glucose_data + bp_data + metrics_data:
        item.pop('_id', None)
    return {"blood_glucose": glucose_data, "blood_pressure": bp_data, "body_metrics": metrics_data}


@router.post("/api/prescription-manager/user/{user_id}/health/glucose")
async def create_glucose_reading_for_user(request: Request, user_id: str, reading: BloodGlucoseCreate):
    manager = await get_prescription_manager(request, db)
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    from models import BloodGlucose
    new_reading = BloodGlucose(user_id=user_id, **reading.dict())
    reading_dict = serialize_model(new_reading.dict())
    await db.blood_glucose.insert_one(reading_dict)
    return reading_dict


@router.post("/api/prescription-manager/user/{user_id}/health/bp")
async def create_bp_reading_for_user(request: Request, user_id: str, reading: BloodPressureCreate):
    manager = await get_prescription_manager(request, db)
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    from models import BloodPressure
    new_reading = BloodPressure(user_id=user_id, **reading.dict())
    reading_dict = serialize_model(new_reading.dict())
    await db.blood_pressure.insert_one(reading_dict)
    return reading_dict


@router.post("/api/prescription-manager/user/{user_id}/health/metrics")
async def create_body_metrics_for_user(request: Request, user_id: str, metrics: BodyMetricsCreate):
    manager = await get_prescription_manager(request, db)
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    from models import BodyMetrics
    new_metrics = BodyMetrics(user_id=user_id, **metrics.dict())
    metrics_dict = serialize_model(new_metrics.dict())
    await db.body_metrics.insert_one(metrics_dict)
    return metrics_dict


# ==================== ADMIN CLEANUP ====================

@router.post("/api/admin/cleanup-duplicates")
async def cleanup_duplicate_users(request: Request):
    manager = await get_prescription_manager(request, db)
    try:
        from collections import defaultdict
        all_users = await db.users.find().to_list(length=None)
        email_groups = defaultdict(list)
        for user in all_users:
            email_groups[user['email']].append(user)
        duplicates = {email: users for email, users in email_groups.items() if len(users) > 1}
        if not duplicates:
            return {"success": True, "message": "No duplicates found", "duplicates_removed": 0, "total_users": len(all_users)}
        deleted_count = 0
        medications_transferred = 0
        for email, users in duplicates.items():
            users_sorted = sorted(users, key=lambda x: x.get('created_at', '1970-01-01T00:00:00'), reverse=True)
            keep_user = users_sorted[0]
            for user in users_sorted[1:]:
                user_meds = await db.medications.count_documents({"user_id": user['id']})
                if user_meds > 0:
                    result = await db.medications.update_many({"user_id": user['id']}, {"$set": {"user_id": keep_user['id']}})
                    medications_transferred += result.modified_count
                result = await db.users.delete_one({"id": user['id']})
                if result.deleted_count > 0:
                    deleted_count += 1
        try:
            await db.users.create_index("email", unique=True)
        except:
            pass
        final_count = await db.users.count_documents({})
        return {"success": True, "message": f"Successfully cleaned up {deleted_count} duplicate users", "duplicates_removed": deleted_count, "medications_transferred": medications_transferred, "total_users_before": len(all_users), "total_users_after": final_count}
    except Exception as e:
        import traceback
        return {"success": False, "message": f"Error during cleanup: {str(e)}", "error": traceback.format_exc()}


# ==================== DASHBOARD METRICS ====================

@router.get("/api/prescription-manager/dashboard/metrics")
async def get_dashboard_metrics(request: Request):
    try:
        manager = await get_prescription_manager(request, db)
    except Exception as e:
        logging.error(f"[Dashboard] Auth error: {str(e)}")
        raise
    now = datetime.now(timezone.utc)
    last_24_hours = now - timedelta(hours=24)
    last_7_days = now - timedelta(days=7)
    total_users = await db.users.count_documents({})
    active_users_count = await db.users.count_documents({"$or": [{"updated_at": {"$gte": last_24_hours}}, {"last_activity": {"$gte": last_24_hours}}]})
    users_with_meds = await db.medications.distinct("user_id")
    no_medications_count = await db.users.count_documents({"id": {"$nin": users_with_meds}})
    users_with_recent_reports = set()
    for collection_name in ["blood_glucose", "blood_pressure", "body_metrics"]:
        recent_users = await db[collection_name].distinct("user_id", {"created_at": {"$gte": last_7_days}})
        users_with_recent_reports.update(recent_users)
    no_reports_count = await db.users.count_documents({"id": {"$nin": list(users_with_recent_reports)}})
    users_with_recent_adherence = await db.adherence_logs.distinct("user_id", {"created_at": {"$gte": last_7_days}})
    no_adherence_count = await db.users.count_documents({"id": {"$in": users_with_meds, "$nin": users_with_recent_adherence}})
    no_family_count = await db.users.count_documents({"$or": [{"relative_name": {"$in": [None, ""]}}, {"relative_name": {"$exists": False}}]})
    users_with_invoices = await db.user_purchase_links.distinct("user_id", {"$or": [{"medicine_invoice_link": {"$nin": [None, ""]}}, {"injection_invoice_link": {"$nin": [None, ""]}}]})
    no_invoices_count = await db.users.count_documents({"id": {"$nin": users_with_invoices}})
    critical_meds = await db.medications.find({"$or": [{"refill_reminder.pills_remaining": {"$lt": 10}, "form": {"$nin": ["Injection", "Vial"]}}, {"refill_reminder.pills_remaining": {"$lte": 1}, "form": {"$in": ["Injection", "Vial"]}}]}).to_list(length=None)
    critical_stock_count = len(set([m["user_id"] for m in critical_meds]))
    past_due_appointments = await db.appointments.find({"date": {"$lt": now.strftime("%Y-%m-%d")}, "status": {"$nin": ["completed", "cancelled"]}}).to_list(length=None)
    past_due_count = len(set([a["user_id"] for a in past_due_appointments]))
    return {
        "total_users": total_users, "active_users_24h": active_users_count,
        "no_medications": no_medications_count, "no_reports_7d": no_reports_count,
        "no_adherence_7d": no_adherence_count, "no_family_details": no_family_count,
        "no_invoices": no_invoices_count, "critical_stock": critical_stock_count,
        "past_due_appointments": past_due_count
    }


@router.get("/api/prescription-manager/dashboard/users/{metric_type}")
async def get_users_by_metric(request: Request, metric_type: str):
    manager = await get_prescription_manager(request, db)
    now = datetime.now(timezone.utc)
    last_24_hours = now - timedelta(hours=24)
    last_7_days = now - timedelta(days=7)

    def fmt(users):
        return {"users": [{"id": u["id"], "name": u["name"], "email": u["email"], "phone": u.get("phone")} for u in users]}

    if metric_type == "total_users":
        return fmt(await db.users.find({}, {"id": 1, "name": 1, "email": 1, "phone": 1}).to_list(length=None))
    elif metric_type == "active_users_24h":
        return fmt(await db.users.find({"$or": [{"updated_at": {"$gte": last_24_hours}}, {"last_activity": {"$gte": last_24_hours}}]}, {"id": 1, "name": 1, "email": 1, "phone": 1}).to_list(length=None))
    elif metric_type == "no_medications":
        ids = await db.medications.distinct("user_id")
        return fmt(await db.users.find({"id": {"$nin": ids}}, {"id": 1, "name": 1, "email": 1, "phone": 1}).to_list(length=None))
    elif metric_type == "no_reports_7d":
        ids = set()
        for c in ["blood_glucose", "blood_pressure", "body_metrics"]:
            ids.update(await db[c].distinct("user_id", {"created_at": {"$gte": last_7_days}}))
        return fmt(await db.users.find({"id": {"$nin": list(ids)}}, {"id": 1, "name": 1, "email": 1, "phone": 1}).to_list(length=None))
    elif metric_type == "no_adherence_7d":
        med_ids = await db.medications.distinct("user_id")
        adh_ids = await db.adherence_logs.distinct("user_id", {"created_at": {"$gte": last_7_days}})
        return fmt(await db.users.find({"id": {"$in": med_ids, "$nin": adh_ids}}, {"id": 1, "name": 1, "email": 1, "phone": 1}).to_list(length=None))
    elif metric_type == "no_family_details":
        return fmt(await db.users.find({"$or": [{"relative_name": {"$in": [None, ""]}}, {"relative_name": {"$exists": False}}]}, {"id": 1, "name": 1, "email": 1, "phone": 1}).to_list(length=None))
    elif metric_type == "no_invoices":
        ids = await db.user_purchase_links.distinct("user_id", {"$or": [{"medicine_invoice_link": {"$nin": [None, ""]}}, {"injection_invoice_link": {"$nin": [None, ""]}}]})
        return fmt(await db.users.find({"id": {"$nin": ids}}, {"id": 1, "name": 1, "email": 1, "phone": 1}).to_list(length=None))
    elif metric_type == "critical_stock":
        meds = await db.medications.find({"$or": [{"refill_reminder.pills_remaining": {"$lt": 10}, "form": {"$nin": ["Injection", "Vial"]}}, {"refill_reminder.pills_remaining": {"$lte": 1}, "form": {"$in": ["Injection", "Vial"]}}]}).to_list(length=None)
        ids = list(set([m["user_id"] for m in meds]))
        return fmt(await db.users.find({"id": {"$in": ids}}, {"id": 1, "name": 1, "email": 1, "phone": 1}).to_list(length=None))
    elif metric_type == "past_due_appointments":
        apts = await db.appointments.find({"date": {"$lt": now.strftime("%Y-%m-%d")}, "status": {"$nin": ["completed", "cancelled"]}}).to_list(length=None)
        ids = list(set([a["user_id"] for a in apts]))
        return fmt(await db.users.find({"id": {"$in": ids}}, {"id": 1, "name": 1, "email": 1, "phone": 1}).to_list(length=None))
    else:
        raise HTTPException(status_code=400, detail=f"Invalid metric type: {metric_type}")


# ===== ORDER MANAGEMENT ROUTES =====

@router.get("/api/admin/orders")
async def get_all_orders(request: Request):
    """Get all orders with customer info (Prescription Manager only)."""
    manager = await get_prescription_manager(request, db)

    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)

    # Enrich with customer name from users collection
    user_ids = list(set(o.get("user_id") for o in orders if o.get("user_id")))
    users = {}
    if user_ids:
        user_docs = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1}).to_list(None)
        users = {u["id"]: u for u in user_docs}

    for order in orders:
        user_info = users.get(order.get("user_id"), {})
        order["customer_name"] = user_info.get("name", "Unknown")
        order["customer_email"] = user_info.get("email", "")
        order["customer_phone"] = user_info.get("phone", "")

    return orders


@router.patch("/api/admin/orders/{order_id}")
async def update_order(request: Request, order_id: str):
    """Update order status and/or tracking number (Prescription Manager only)."""
    manager = await get_prescription_manager(request, db)
    body = await request.json()

    update_fields = {}

    # Validate and set order_status
    if "order_status" in body:
        valid_statuses = ["confirmed", "processing", "shipped", "delivered", "cancelled"]
        if body["order_status"] not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        update_fields["order_status"] = body["order_status"]

    # Set tracking_number
    if "tracking_number" in body:
        update_fields["tracking_number"] = body["tracking_number"]

    if not update_fields:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = await db.orders.update_one({"id": order_id}, {"$set": update_fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")

    logger.info(f"[PM] Order {order_id} updated: {update_fields}")
    return {"message": "Order updated successfully"}
