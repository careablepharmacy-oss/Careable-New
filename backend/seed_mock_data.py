"""
Seed script for Careable 360+plus
Creates mock data: admin, customer, medications, products, invoices, orders.

Run: cd /app/backend && python seed_mock_data.py
"""
import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / '.env')

import sys
sys.path.insert(0, str(Path(__file__).parent))
from jwt_auth import hash_password

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

ADMIN_EMAIL = "careable360plus@gmail.com"
CUSTOMER_EMAIL = "encarelife@gmail.com"
SEED_PASSWORD = "Sarun123#"

ADMIN_ID = "seed-admin-careable-001"
CUSTOMER_ID = "seed-customer-careable-001"

now_iso = lambda: datetime.now(timezone.utc).isoformat()
today_str = lambda: datetime.now(timezone(timedelta(hours=5, minutes=30))).strftime('%Y-%m-%d')


async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(f"Seeding database: {DB_NAME}")

    # Compute password hash once (idempotent for re-runs)
    password_hash = hash_password(SEED_PASSWORD)

    # ============ Admin (Prescription Manager) ============
    admin = {
        "id": ADMIN_ID,
        "email": ADMIN_EMAIL,
        "name": "Careable Admin",
        "picture": None,
        "phone": "+919999900001",
        "role": "prescription_manager",
        "password_hash": password_hash,
        "diabetes_type": "Type 2",
        "city": "Bengaluru",
        "state": "Karnataka",
        "country": "India",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.users.replace_one({"email": ADMIN_EMAIL}, admin, upsert=True)
    print(f"  ✅ Admin seeded: {ADMIN_EMAIL}")

    # ============ Customer ============
    customer = {
        "id": CUSTOMER_ID,
        "email": CUSTOMER_EMAIL,
        "name": "Sample Customer",
        "picture": None,
        "phone": "+919999900002",
        "role": "user",
        "password_hash": password_hash,
        "diabetes_type": "Type 2",
        "age": 52,
        "sex": "M",
        "address": "123 Test Street",
        "city": "Bengaluru",
        "state": "Karnataka",
        "country": "India",
        "pincode": "560001",
        "relative_name": "Family Contact",
        "relative_email": "family@example.com",
        "relative_whatsapp": "+919999900003",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.users.replace_one({"email": CUSTOMER_EMAIL}, customer, upsert=True)
    print(f"  ✅ Customer seeded: {CUSTOMER_EMAIL}")

    # ============ 5 Medications for the customer ============
    today = today_str()
    meds = [
        {
            "name": "Metformin 500mg",
            "form": "Tablet",
            "dosage": "1 tablet",
            "color": "#2BA89F",
            "instructions": "Take with food after meals",
            "tablet_stock_count": 60,
            "tablets_per_strip": 10,
            "cost_per_unit": 2.5,
            "schedule": {
                "frequency": "daily",
                "times": ["08:00", "20:00"],
                "dosage_timings": [{"time": "08:00", "amount": "1"}, {"time": "20:00", "amount": "1"}],
                "start_date": today,
                "weekly_days": [],
            },
        },
        {
            "name": "Paracetamol 650mg",
            "form": "Tablet",
            "dosage": "1 tablet",
            "color": "#E8A93C",
            "instructions": "For fever or pain. Max 4 per day.",
            "tablet_stock_count": 20,
            "tablets_per_strip": 10,
            "cost_per_unit": 1.5,
            "schedule": {
                "frequency": "as-needed",
                "times": ["12:00"],
                "dosage_timings": [{"time": "12:00", "amount": "1"}],
                "start_date": today,
                "weekly_days": [],
            },
        },
        {
            "name": "Vitamin D3 60K",
            "form": "Capsule",
            "dosage": "1 capsule",
            "color": "#7AB648",
            "instructions": "Once a week",
            "tablet_stock_count": 8,
            "tablets_per_strip": 4,
            "cost_per_unit": 25,
            "schedule": {
                "frequency": "weekly",
                "times": ["09:00"],
                "dosage_timings": [{"time": "09:00", "amount": "1"}],
                "start_date": today,
                "weekly_days": ["sun"],
            },
        },
        {
            "name": "Telmisartan 40mg",
            "form": "Tablet",
            "dosage": "1 tablet",
            "color": "#1E3A5F",
            "instructions": "BP medication, take in morning",
            "tablet_stock_count": 30,
            "tablets_per_strip": 10,
            "cost_per_unit": 3.0,
            "schedule": {
                "frequency": "daily",
                "times": ["08:00"],
                "dosage_timings": [{"time": "08:00", "amount": "1"}],
                "start_date": today,
                "weekly_days": [],
            },
        },
        {
            "name": "Insulin Actrapid",
            "form": "Injection",
            "dosage": "10 IU",
            "color": "#2BA89F",
            "instructions": "Subcutaneous injection before meals",
            "injection_stock_count": 2,
            "injection_iu_per_package": 1000,
            "injection_iu_remaining": 1850,
            "injection_iu_per_ml": 100,
            "injection_ml_volume": 10,
            "cost_per_unit": 350,
            "schedule": {
                "frequency": "daily",
                "times": ["07:30", "13:00", "19:30"],
                "dosage_timings": [
                    {"time": "07:30", "amount": "10"},
                    {"time": "13:00", "amount": "12"},
                    {"time": "19:30", "amount": "10"},
                ],
                "start_date": today,
                "weekly_days": [],
            },
        },
    ]

    await db.medications.delete_many({"user_id": CUSTOMER_ID})
    for m in meds:
        m["id"] = str(uuid.uuid4())
        m["user_id"] = CUSTOMER_ID
        m["refill_reminder"] = {"enabled": True, "pills_remaining": m.get("tablet_stock_count", 0), "threshold": 7}
        m["include_in_invoice"] = True
        m["created_at"] = now_iso()
        m["updated_at"] = now_iso()
        await db.medications.insert_one(m)
    print(f"  ✅ {len(meds)} medications seeded")

    # ============ 3 Products ============
    products = [
        {"name": "Digital BP Monitor", "description": "Automatic upper-arm BP monitor with memory.", "mrp": 2499, "selling_price": 1899, "category": "medical_equipment", "subcategory": "monitoring"},
        {"name": "Glucose Test Strips (50)", "description": "Pack of 50 strips for blood glucose meters.", "mrp": 850, "selling_price": 649, "category": "medical_equipment", "subcategory": "diabetes"},
        {"name": "Diabetic Foot Cream", "description": "Daily moisturizer for diabetic skin care.", "mrp": 450, "selling_price": 349, "category": "personal_care", "subcategory": "skincare"},
    ]
    await db.products.delete_many({"name": {"$in": [p["name"] for p in products]}})
    for p in products:
        p["id"] = str(uuid.uuid4())
        p["discount_percent"] = round((p["mrp"] - p["selling_price"]) / p["mrp"] * 100, 1)
        p["is_active"] = True
        p["image_url"] = None
        p["created_at"] = now_iso()
        p["updated_at"] = now_iso()
        await db.products.insert_one(p)
    print(f"  ✅ {len(products)} products seeded")

    # ============ User Purchase Links (for "Complete Your Purchase Now" card) ============
    purchase_links = {
        "id": str(uuid.uuid4()),
        "user_id": CUSTOMER_ID,
        "medicine_order_link": "https://example.com/order/medicines",
        "medicine_invoice_link": "https://example.com/invoice/MED-001",
        "medicine_invoice_amount": 1245.50,
        "injection_order_link": "https://example.com/order/insulin",
        "injection_invoice_link": "https://example.com/invoice/INJ-001",
        "injection_invoice_amount": 700.00,
        "product_order_link": "https://example.com/order/products",
        "product_invoice_link": "https://example.com/invoice/PROD-001",
        "product_invoice_amount": 2897.00,
        "product_order_completed": False,
        "updated_at": now_iso(),
        "updated_by": ADMIN_ID,
    }
    await db.user_purchase_links.replace_one({"user_id": CUSTOMER_ID}, purchase_links, upsert=True)
    print("  ✅ User purchase links seeded")

    # ============ 2 Invoices (1 paid, 1 pending) - using inv_invoices collection ============
    today_dt = datetime.now(timezone.utc)
    invoices = [
        {
            "id": str(uuid.uuid4()),
            "invoice_id": "INV-2026-0001",
            "invoice_number": "INV-2026-0001",
            "user_id": CUSTOMER_ID,
            "patient_name": customer["name"],
            "patient_email": CUSTOMER_EMAIL,
            "patient_phone": customer["phone"],
            "items": [
                {"name": "Metformin 500mg", "quantity": 60, "unit_price": 2.5, "total": 150},
                {"name": "Telmisartan 40mg", "quantity": 30, "unit_price": 3.0, "total": 90},
            ],
            "subtotal": 240,
            "discount": 0,
            "tax": 0,
            "total": 240,
            "status": "paid",
            "payment_status": "paid",
            "paid_at": (today_dt - timedelta(days=2)).isoformat(),
            "created_by": ADMIN_ID,
            "created_at": (today_dt - timedelta(days=3)).isoformat(),
            "updated_at": now_iso(),
        },
        {
            "id": str(uuid.uuid4()),
            "invoice_id": "INV-2026-0002",
            "invoice_number": "INV-2026-0002",
            "user_id": CUSTOMER_ID,
            "patient_name": customer["name"],
            "patient_email": CUSTOMER_EMAIL,
            "patient_phone": customer["phone"],
            "items": [
                {"name": "Insulin Actrapid (2 vials)", "quantity": 2, "unit_price": 350, "total": 700},
            ],
            "subtotal": 700,
            "discount": 0,
            "tax": 0,
            "total": 700,
            "status": "pending",
            "payment_status": "pending",
            "created_by": ADMIN_ID,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        },
    ]
    await db.inv_invoices.delete_many({"user_id": CUSTOMER_ID})
    for inv in invoices:
        await db.inv_invoices.insert_one(inv)
    print(f"  ✅ {len(invoices)} invoices seeded")

    # ============ 2 Orders (1 ecommerce, 1 invoice-based) ============
    sample_addr = {
        "full_name": customer["name"],
        "phone": customer["phone"],
        "address_line1": "123 Test Street",
        "address_line2": "Near MG Road",
        "city": "Bengaluru",
        "state": "Karnataka",
        "pincode": "560001",
        "country": "India",
    }
    orders = [
        {
            "id": str(uuid.uuid4()),
            "user_id": CUSTOMER_ID,
            "order_number": "ORD-2026-0001",
            "items": [
                {"product_id": products[0]["id"], "product_name": products[0]["name"], "quantity": 1, "mrp": 2499, "selling_price": 1899, "item_total": 1899},
            ],
            "billing_address": sample_addr,
            "shipping_address": sample_addr,
            "subtotal": 1899,
            "discount": 0,
            "delivery_charge": 50,
            "total": 1949,
            "payment_status": "paid",
            "order_status": "delivered",
            "tracking_number": "TRK00123456",
            "razorpay_order_id": "order_mock_001",
            "razorpay_payment_id": "pay_mock_001",
            "created_at": (today_dt - timedelta(days=5)).isoformat(),
            "updated_at": now_iso(),
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": CUSTOMER_ID,
            "order_number": "ORD-2026-0002",
            "items": [
                {"product_id": products[1]["id"], "product_name": products[1]["name"], "quantity": 2, "mrp": 850, "selling_price": 649, "item_total": 1298},
            ],
            "billing_address": sample_addr,
            "shipping_address": sample_addr,
            "subtotal": 1298,
            "discount": 0,
            "delivery_charge": 0,
            "total": 1298,
            "payment_status": "pending",
            "order_status": "confirmed",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        },
    ]
    await db.orders.delete_many({"user_id": CUSTOMER_ID})
    for o in orders:
        await db.orders.insert_one(o)
    print(f"  ✅ {len(orders)} orders seeded")

    # ============ 1 CRM Patient Profile ============
    crm_profile = {
        "id": str(uuid.uuid4()),
        "user_id": CUSTOMER_ID,
        "name": customer["name"],
        "email": CUSTOMER_EMAIL,
        "phone": customer["phone"],
        "age": customer["age"],
        "sex": customer["sex"],
        "diabetes_type": customer["diabetes_type"],
        "city": customer["city"],
        "state": customer["state"],
        "lifecycle_stage": "active_patient",
        "onboarding_completed": True,
        # Medical Information (so the panel renders for the demo customer)
        "main_disease": "Type 2 Diabetes",
        "diseases": ["Type 2 Diabetes", "Hypertension"],
        "consulting_doctor_name": "Dr. Anand Iyer",
        "clinic_hospital_details": "Apollo Clinic, Indiranagar, Bengaluru",
        "last_doctor_visit_date": (today_dt - timedelta(days=20)).strftime("%Y-%m-%d"),
        "next_doctor_visit_due": (today_dt + timedelta(days=10)).strftime("%Y-%m-%d"),
        "regular_lab_details": "Thyrocare - HbA1c & Lipid panel",
        "last_lab_visit_date": (today_dt - timedelta(days=45)).strftime("%Y-%m-%d"),
        "next_lab_visit_due": (today_dt + timedelta(days=15)).strftime("%Y-%m-%d"),
        "mobility_status": "Independent - walks unaided",
        "other_critical_info": "Allergic to sulfa drugs. Family history of cardiac issues.",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.crm_patient_profiles.replace_one({"user_id": CUSTOMER_ID}, crm_profile, upsert=True)
    print("  ✅ CRM patient profile seeded")

    # ============ 1 Revenue Conversion ============
    revenue = {
        "id": str(uuid.uuid4()),
        "user_id": CUSTOMER_ID,
        "patient_name": customer["name"],
        "type": "invoice",
        "source_id": invoices[0]["id"],
        "amount": 240,
        "status": "converted",
        "converted_at": (today_dt - timedelta(days=2)).isoformat(),
        "created_at": now_iso(),
    }
    await db.crm_revenue_conversions.delete_many({"user_id": CUSTOMER_ID})
    await db.crm_revenue_conversions.insert_one(revenue)
    print("  ✅ Revenue conversion seeded")

    # Notification settings for customer
    await db.notification_settings.replace_one(
        {"user_id": CUSTOMER_ID},
        {
            "id": str(uuid.uuid4()),
            "user_id": CUSTOMER_ID,
            "medication_reminders": True,
            "appointment_reminders": True,
            "health_tips": False,
            "email_notifications": True,
            "push_notifications": True,
            "alarm_enabled": True,
            "updated_at": now_iso(),
        },
        upsert=True,
    )

    print("\n🎉 Seed complete!")
    print(f"   Admin login email:    {ADMIN_EMAIL}")
    print(f"   Customer login email: {CUSTOMER_EMAIL}")
    print(f"   Password (both):      {SEED_PASSWORD}")
    print(f"   Note: You can log in via Google OAuth (Emergent) OR email/password (JWT).")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
