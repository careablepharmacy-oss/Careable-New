"""Careable 360+ CRM routes - Allied Healthcare CRM integrated into main Careable 360+ app.

All endpoints are prefixed with /api/crm and gated by Prescription Manager / Admin role.
Patient identity = main Careable 360+ users. CRM-specific enrichment lives in crm_patient_profiles.
"""
from fastapi import APIRouter, HTTPException, Query, Request, Depends
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import List, Optional, Dict, Any
import uuid
import logging
from datetime import datetime, timezone, timedelta

from auth import get_prescription_manager

logger = logging.getLogger(__name__)

db = None


def set_db(database):
    global db
    db = database


async def require_pm(request: Request):
    """Router-level dependency: ensures caller is Prescription Manager / Admin."""
    return await get_prescription_manager(request, db)


router = APIRouter(prefix="/api/crm", dependencies=[Depends(require_pm)])

# ======================== MODELS (Aligned with Careable 360+) ========================

class Caregiver(BaseModel):
    """Emergency contact / Caregiver - aligned with Careable 360+'s relative fields"""
    name: str
    phone: str
    email: Optional[str] = None
    relationship: str = "Family"

class DosageTiming(BaseModel):
    """Individual dosage timing - matches Careable 360+'s DosageTiming"""
    time: str  # e.g., "08:00"
    amount: str  # e.g., "10" (tablets) or "15" (IU for injection)

class MedicationSchedule(BaseModel):
    """Medicine schedule - aligned with Careable 360+'s MedicationSchedule"""
    frequency: str = "daily"  # daily, weekly, as-needed
    times: List[str] = []  # Legacy: ['09:00', '21:00']
    dosage_timings: List[DosageTiming] = []  # New: [{time, amount}]
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    weekly_days: List[str] = []  # ['monday', 'wednesday'] for weekly

class RefillReminder(BaseModel):
    """Refill settings - aligned with Careable 360+"""
    enabled: bool = True
    pills_remaining: int = 0
    threshold: int = 7

class Medicine(BaseModel):
    """Medicine model - fully aligned with Careable 360+'s Medication model"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    dosage: str = ""  # Legacy field
    form: str = "Tablet"  # Tablet, Capsule, Injection, Syrup, etc.
    color: str = "#FF6B6B"
    instructions: Optional[str] = None
    schedule: MedicationSchedule = MedicationSchedule()
    refill_reminder: RefillReminder = RefillReminder()
    
    # Tablet/Capsule stock tracking
    tablet_stock_count: Optional[int] = None
    tablets_per_strip: Optional[int] = None
    
    # Injection stock tracking (IU-based)
    injection_iu_remaining: Optional[float] = None
    injection_iu_per_ml: Optional[float] = None
    injection_iu_per_package: Optional[float] = None
    injection_ml_volume: Optional[float] = None
    injection_stock_count: Optional[int] = None
    
    # Pricing for invoice calculation
    cost_per_unit: Optional[float] = None
    include_in_invoice: bool = True
    
    # Order/Invoice links
    medicine_order_link: Optional[str] = None
    medicine_invoice_link: Optional[str] = None
    medicine_invoice_amount: Optional[float] = None
    injection_order_link: Optional[str] = None
    injection_invoice_link: Optional[str] = None
    injection_invoice_amount: Optional[float] = None
    product_order_link: Optional[str] = None
    product_invoice_link: Optional[str] = None
    product_invoice_amount: Optional[float] = None
    
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Patient(BaseModel):
    """Patient model - aligned with Careable 360+'s User model"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Basic profile (Careable 360+ alignment)
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    picture: Optional[str] = None
    
    # Demographics
    age: Optional[int] = None
    sex: Optional[str] = None  # Careable 360+ uses 'sex', not 'gender'
    
    # Address fields (Careable 360+ alignment)
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    pincode: Optional[str] = None
    
    # Medical info
    diabetes_type: Optional[str] = "Type 2"
    diseases: List[str] = []
    
    # Emergency contact (Careable 360+ alignment)
    relative_name: Optional[str] = None
    relative_email: Optional[str] = None
    relative_whatsapp: Optional[str] = None
    caregivers: List[Caregiver] = []
    
    # Medications (populated from Careable 360+)
    medicines: List[Medicine] = []
    
    # Invoice links (user-level from Careable 360+)
    medicine_order_link: Optional[str] = None
    medicine_invoice_link: Optional[str] = None
    medicine_invoice_amount: Optional[float] = None
    injection_order_link: Optional[str] = None
    injection_invoice_link: Optional[str] = None
    injection_invoice_amount: Optional[float] = None
    product_order_link: Optional[str] = None
    product_invoice_link: Optional[str] = None
    product_invoice_amount: Optional[float] = None
    
    # CRM-specific fields
    adherence_rate: float = 85.0
    priority: str = "normal"  # high, normal, low
    last_contact: Optional[str] = None
    
    # Timestamps
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PatientCreate(BaseModel):
    """Create patient - aligned with Careable 360+ User fields"""
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    pincode: Optional[str] = None
    diabetes_type: Optional[str] = "Type 2"
    relative_name: Optional[str] = None
    relative_email: Optional[str] = None
    relative_whatsapp: Optional[str] = None

class BloodGlucose(BaseModel):
    """Blood glucose reading - aligned with Careable 360+"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    value: int
    unit: str = "mg/dL"
    time: str
    meal_context: str  # Fasting, Before Breakfast, After Lunch, etc.
    date: str
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BloodPressure(BaseModel):
    """Blood pressure reading - aligned with Careable 360+"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    systolic: int
    diastolic: int
    pulse: Optional[int] = None
    time: str
    date: str
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BodyMetrics(BaseModel):
    """Body metrics - aligned with Careable 360+"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    weight: float
    height: float  # in cm
    bmi: float
    date: str
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Appointment(BaseModel):
    """Appointment model - aligned with Careable 360+"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str  # doctor, lab
    title: str
    doctor: Optional[str] = None
    hospital: Optional[str] = None
    date: str
    time: str
    location: Optional[str] = None
    notes: Optional[str] = None
    status: str = "upcoming"  # upcoming, done, postponed, abandoned
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class AppointmentCreate(BaseModel):
    type: str = "doctor"
    title: str = "Doctor Consultation"
    doctor: Optional[str] = None
    hospital: Optional[str] = None
    date: str
    time: str
    location: Optional[str] = None
    notes: Optional[str] = None

class AdherenceLog(BaseModel):
    """Adherence log - aligned with Careable 360+"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    medication_id: str
    scheduled_time: str
    taken_time: Optional[str] = None
    status: str  # pending, taken, skipped
    date: str
    dosage_amount: Optional[str] = None  # Amount taken at this time
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Interaction(BaseModel):
    """CRM interaction log"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # call, message, visit
    purpose: str = ""  # reason for interaction (comma-separated if multiple)
    notes: str
    outcome: str  # positive, neutral, negative, no_answer
    follow_up_date: str
    follow_up_time: str = "09:00"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: str = "Healthcare Assistant"


class Opportunity(BaseModel):
    """CRM opportunity"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    patient_name: str
    patient_phone: str = ""
    type: str  # refill, lab_test, product, vitals_alert, adherence, invoice
    description: str
    priority: str  # high, medium, low
    expected_revenue: float = 0.0
    status: str = "pending"  # pending, contacted, converted, dismissed
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def normalize_booked_date(value: Any) -> Optional[str]:
    """Normalize any booked_date input to canonical 'YYYY-MM-DD' string.

    Accepts: None, 'YYYY-MM-DD', ISO datetime strings (e.g. '2026-04-20T04:30:00.000Z'),
    datetime objects. Returns None when value is empty/None. Raises ValueError on
    unparseable non-empty input.
    """
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    s = str(value).strip()
    if not s:
        return None
    # Already YYYY-MM-DD
    if len(s) == 10 and s[4] == "-" and s[7] == "-":
        # Validate it actually parses
        datetime.strptime(s, "%Y-%m-%d")
        return s
    # ISO-like: take the date portion before 'T'
    if "T" in s:
        date_part = s.split("T", 1)[0]
        datetime.strptime(date_part, "%Y-%m-%d")
        return date_part
    # Last resort — try full strptime
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).strftime("%Y-%m-%d")
    except ValueError as e:
        raise ValueError(f"Unrecognized booked_date format: {value!r}") from e


class LabBooking(BaseModel):
    """Lab test booking — canonical booked_date is YYYY-MM-DD."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    test_name: str
    booked_date: Optional[str] = None  # 'YYYY-MM-DD'
    status: str = "booked"
    price: float = 0.0
    lab_name: Optional[str] = None
    scheduled_time: Optional[str] = None  # 'HH:MM'
    notes: Optional[str] = None
    source: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @field_validator("booked_date", mode="before")
    @classmethod
    def _normalize_booked_date(cls, v):
        return normalize_booked_date(v)


# ======================== REVENUE CATEGORIZATION ========================

# Detailed opp type -> parent revenue category
# Per product spec: medicine refills + product sales + invoiced items all roll up
# under "Invoice Follow-up". Lab Tests is its own category.
REVENUE_CATEGORY_BY_OPP_TYPE = {
    "refill": "invoice_followup",
    "product": "invoice_followup",
    "invoice": "invoice_followup",
    "lab_test": "lab_test",
}


def get_revenue_category(opp_type: str) -> Optional[str]:
    return REVENUE_CATEGORY_BY_OPP_TYPE.get(opp_type)


async def record_revenue_conversion(
    patient_id: str,
    patient_name: str,
    category: str,
    source: str,
    amount: float,
    description: str = "",
) -> Dict[str, Any]:
    """Persist a converted-revenue event used to track actual conversion against opportunities."""
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "patient_id": patient_id,
        "patient_name": patient_name,
        "category": category,  # invoice_followup | lab_test
        "source": source,      # product_invoice | medicine_refill | lab_booking
        "amount": float(amount or 0),
        "description": description,
        "month": now.strftime("%Y-%m"),
        "created_at": now.isoformat(),
    }
    await db.crm_revenue_conversions.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

# ======================== PRODUCT CATALOG ========================

PRODUCT_CATALOG = {
    "Diabetes": [
        {"name": "Glucometer", "category": "equipment", "purpose": "Monitor blood sugar levels at home", "price": 1200},
        {"name": "Blood Glucose Test Strips (50)", "category": "equipment", "purpose": "For glucometer testing", "price": 650},
        {"name": "Lancets Pack (100)", "category": "equipment", "purpose": "For blood sampling", "price": 250},
        {"name": "Diabetic Foot Cream", "category": "personal_care", "purpose": "Prevent foot complications", "price": 350},
        {"name": "Sugar-Free Supplements", "category": "personal_care", "purpose": "Nutritional support", "price": 480},
    ],
    "Hypertension": [
        {"name": "Digital BP Monitor", "category": "equipment", "purpose": "Track blood pressure daily", "price": 1800},
        {"name": "Automatic Wrist BP Monitor", "category": "equipment", "purpose": "Portable BP monitoring", "price": 1500},
        {"name": "Salt Substitute", "category": "personal_care", "purpose": "Low sodium alternative", "price": 180},
    ],
    "Heart Disease": [
        {"name": "Pulse Oximeter", "category": "equipment", "purpose": "Monitor oxygen levels", "price": 800},
        {"name": "ECG Monitor (Portable)", "category": "equipment", "purpose": "Heart rhythm monitoring", "price": 3500},
        {"name": "Omega-3 Supplements", "category": "personal_care", "purpose": "Heart health support", "price": 650},
    ],
    "Thyroid": [
        {"name": "Thyroid Function Test Kit", "category": "equipment", "purpose": "Home monitoring", "price": 1200},
        {"name": "Weight Scale (Digital)", "category": "equipment", "purpose": "Track weight changes", "price": 1200},
    ],
    "Arthritis": [
        {"name": "Heating Pad", "category": "equipment", "purpose": "Pain relief for joints", "price": 900},
        {"name": "Knee Brace", "category": "equipment", "purpose": "Joint support", "price": 650},
        {"name": "Pain Relief Gel", "category": "personal_care", "purpose": "Topical pain relief", "price": 280},
    ],
    "Elderly Care": [
        {"name": "Walking Stick (Adjustable)", "category": "equipment", "purpose": "Mobility support", "price": 450},
        {"name": "Adult Diapers (Pack of 10)", "category": "personal_care", "purpose": "Incontinence care", "price": 350},
        {"name": "Pill Organizer (Weekly)", "category": "equipment", "purpose": "Medicine management", "price": 180},
    ],
    "Respiratory": [
        {"name": "Nebulizer Machine", "category": "equipment", "purpose": "Medication delivery", "price": 2500},
        {"name": "Peak Flow Meter", "category": "equipment", "purpose": "Monitor lung function", "price": 650},
    ],
}

LAB_TEST_CATALOG = [
    {"name": "HbA1c", "diseases": ["Diabetes"], "frequency_months": 3, "price": 450},
    {"name": "Fasting Blood Sugar", "diseases": ["Diabetes"], "frequency_months": 1, "price": 150},
    {"name": "Lipid Profile", "diseases": ["Diabetes", "Hypertension", "Heart Disease"], "frequency_months": 6, "price": 600},
    {"name": "Kidney Function Test", "diseases": ["Diabetes", "Hypertension"], "frequency_months": 6, "price": 800},
    {"name": "Liver Function Test", "diseases": ["Diabetes", "Heart Disease"], "frequency_months": 6, "price": 700},
    {"name": "Thyroid Profile (T3, T4, TSH)", "diseases": ["Thyroid"], "frequency_months": 3, "price": 550},
    {"name": "Complete Blood Count", "diseases": ["Elderly Care", "Arthritis"], "frequency_months": 6, "price": 350},
    {"name": "ECG", "diseases": ["Heart Disease", "Hypertension"], "frequency_months": 6, "price": 400},
    {"name": "Uric Acid", "diseases": ["Arthritis"], "frequency_months": 3, "price": 200},
    {"name": "Vitamin D", "diseases": ["Elderly Care", "Arthritis"], "frequency_months": 6, "price": 750},
    {"name": "Chest X-Ray", "diseases": ["Respiratory"], "frequency_months": 12, "price": 500},
]

# Medicine-Disease mapping for auto-detection
MEDICINE_DISEASE_MAP = {
    # Diabetes medicines
    "metformin": ["Diabetes"], "glimepiride": ["Diabetes"], "gliclazide": ["Diabetes"],
    "sitagliptin": ["Diabetes"], "empagliflozin": ["Diabetes"], "insulin": ["Diabetes"],
    "pioglitazone": ["Diabetes"], "vildagliptin": ["Diabetes"], "dapagliflozin": ["Diabetes"],
    "januvia": ["Diabetes"], "jardiance": ["Diabetes"], "glucophage": ["Diabetes"],
    # BP medicines
    "amlodipine": ["Hypertension"], "telmisartan": ["Hypertension"], "losartan": ["Hypertension"],
    "atenolol": ["Hypertension"], "metoprolol": ["Hypertension", "Heart Disease"],
    "ramipril": ["Hypertension", "Heart Disease"], "lisinopril": ["Hypertension", "Heart Disease"],
    "chlorthalidone": ["Hypertension"], "hydrochlorothiazide": ["Hypertension"],
    # Heart medicines
    "aspirin": ["Heart Disease"], "clopidogrel": ["Heart Disease"], "atorvastatin": ["Heart Disease"],
    "rosuvastatin": ["Heart Disease"], "ecosprin": ["Heart Disease"],
    # Thyroid medicines
    "thyroxine": ["Thyroid"], "levothyroxine": ["Thyroid"], "eltroxin": ["Thyroid"],
    # Arthritis medicines
    "diclofenac": ["Arthritis"], "ibuprofen": ["Arthritis"], "naproxen": ["Arthritis"],
    "celecoxib": ["Arthritis"], "etoricoxib": ["Arthritis"], "methotrexate": ["Arthritis"],
    # Respiratory medicines
    "salbutamol": ["Respiratory"], "budesonide": ["Respiratory"], "montelukast": ["Respiratory"],
}

# ======================== HELPER FUNCTIONS ========================

def detect_diseases_from_medicines(medicines: List[Dict]) -> List[str]:
    """Detect diseases based on medicines - works with Careable 360+ medicine format."""
    diseases = set()
    for med in medicines:
        med_name = med.get("name", "").lower()
        for key, disease_list in MEDICINE_DISEASE_MAP.items():
            if key in med_name:
                diseases.update(disease_list)
    return list(diseases)

def calculate_stock_status(medicine: Dict) -> Dict:
    """Calculate stock status based on medicine form - aligned with Careable 360+."""
    form = medicine.get("form", "").lower()
    
    if form in ["tablet", "capsule"]:
        stock = medicine.get("tablet_stock_count", 0) or 0
        # Calculate days based on dosage_timings
        schedule = medicine.get("schedule", {})
        dosage_timings = schedule.get("dosage_timings", [])
        daily_consumption = len(dosage_timings) if dosage_timings else 1
        
        # Sum up actual amounts if available
        if dosage_timings:
            try:
                daily_consumption = sum(int(dt.get("amount", 1)) for dt in dosage_timings)
            except:
                daily_consumption = len(dosage_timings)
        
        days_left = int(stock / daily_consumption) if daily_consumption > 0 else 999
        return {
            "stock": stock,
            "unit": "tablets" if form == "tablet" else "capsules",
            "days_left": days_left,
            "is_low": days_left <= 10
        }
    
    elif form == "injection":
        iu_remaining = medicine.get("injection_iu_remaining", 0) or 0
        stock_count = medicine.get("injection_stock_count", 0) or 0
        
        # Calculate days based on daily IU consumption
        schedule = medicine.get("schedule", {})
        dosage_timings = schedule.get("dosage_timings", [])
        daily_iu = 0
        if dosage_timings:
            try:
                daily_iu = sum(float(dt.get("amount", 0)) for dt in dosage_timings)
            except:
                daily_iu = 0
        
        days_left = int(iu_remaining / daily_iu) if daily_iu > 0 else 999
        return {
            "stock": stock_count,
            "iu_remaining": iu_remaining,
            "unit": "vials/pens",
            "days_left": days_left,
            "is_low": days_left <= 7 or stock_count <= 1
        }
    
    return {"stock": 0, "unit": "units", "days_left": 999, "is_low": False}

def _disease_matches(catalog_disease: str, selected: List[str]) -> bool:
    """Case-insensitive substring matcher between a catalog disease key (e.g. "Diabetes")
    and the HA-selected diseases (e.g. ["Type 2 Diabetes Mellitus"]).
    Either direction substring counts as a match — so "Diabetes" ⇄ "Type 2 Diabetes Mellitus"
    will both resolve correctly."""
    cat = (catalog_disease or "").strip().lower()
    if not cat:
        return False
    for d in selected or []:
        if not isinstance(d, str):
            continue
        sel = d.strip().lower()
        if not sel:
            continue
        if cat == sel or cat in sel or sel in cat:
            return True
    return False


def get_product_suggestions(diseases: List[str]) -> List[Dict]:
    """Get product suggestions based on diseases (fuzzy-matched against PRODUCT_CATALOG)."""
    suggestions = []
    seen_names = set()
    for catalog_disease, products in PRODUCT_CATALOG.items():
        if _disease_matches(catalog_disease, diseases):
            for product in products:
                key = product["name"].lower()
                if key in seen_names:
                    continue
                seen_names.add(key)
                suggestions.append({**product, "disease": catalog_disease})
    return suggestions

def get_lab_test_suggestions(diseases: List[str]) -> List[Dict]:
    """Get lab test suggestions based on diseases (built-in catalog only, sync, fuzzy match)."""
    suggestions = []
    for test in LAB_TEST_CATALOG:
        if any(_disease_matches(td, diseases) for td in test["diseases"]):
            suggestions.append(test)
    return suggestions

async def get_lab_test_suggestions_with_custom(diseases: List[str]) -> List[Dict]:
    """Get lab test suggestions including custom tests from DB (fuzzy match)."""
    if not diseases:
        return []

    # Built-in catalog with price overrides
    overrides = await db.crm_lab_test_overrides.find({}, {"_id": 0}).to_list(500)
    override_map = {o["test_name"]: o for o in overrides}

    suggestions = []
    seen_names = set()
    for test in LAB_TEST_CATALOG:
        if any(_disease_matches(td, diseases) for td in test["diseases"]):
            t = {**test, "source": "auto"}
            if test["name"] in override_map:
                t["price"] = override_map[test["name"]]["price"]
            suggestions.append(t)
            seen_names.add(test["name"])

    # Custom tests from MongoDB
    custom_tests = await db.crm_custom_lab_tests.find({}, {"_id": 0}).to_list(500)
    for ct in custom_tests:
        if ct["name"] not in seen_names and any(
            _disease_matches(td, diseases) for td in ct.get("diseases", [])
        ):
            ct["source"] = "custom"
            suggestions.append(ct)

    return suggestions

# ======================== API ROUTES ========================

@router.get("/")
async def root():
    return {"message": "Careable 360+ Healthcare CRM - Allied Platform API", "version": "2.0.0"}

# ======================== BRIDGE: MAIN APP USERS -> CRM PROFILES ========================

def _translate_main_medication(med: Dict) -> Dict:
    """Translate a main-app medications document into CRM Medicine format."""
    return {
        "id": med.get("id") or str(uuid.uuid4()),
        "user_id": med.get("user_id", ""),
        "name": med.get("name", ""),
        "dosage": med.get("dosage", ""),
        "form": med.get("form", "Tablet"),
        "color": med.get("color", "#FF6B6B"),
        "instructions": med.get("instructions"),
        "schedule": med.get("schedule", {"frequency": "daily", "times": [], "dosage_timings": []}),
        "refill_reminder": med.get("refill_reminder", {"enabled": True, "pills_remaining": 0, "threshold": 7}),
        "tablet_stock_count": med.get("tablet_stock_count"),
        "tablets_per_strip": med.get("tablets_per_strip"),
        "injection_iu_remaining": med.get("injection_iu_remaining"),
        "injection_iu_per_ml": med.get("injection_iu_per_ml"),
        "injection_iu_per_package": med.get("injection_iu_per_package"),
        "injection_ml_volume": med.get("injection_ml_volume"),
        "injection_stock_count": med.get("injection_stock_count"),
        "cost_per_unit": med.get("cost_per_unit"),
        "include_in_invoice": med.get("include_in_invoice", True),
        "medicine_order_link": med.get("medicine_order_link"),
        "medicine_invoice_link": med.get("medicine_invoice_link"),
        "medicine_invoice_amount": med.get("medicine_invoice_amount"),
        "created_at": med.get("created_at", datetime.now(timezone.utc).isoformat()),
        "updated_at": med.get("updated_at", datetime.now(timezone.utc).isoformat()),
    }


# Profile fields that must stay in sync between db.users (main app / PM) and
# db.crm_patient_profiles (CRM enrichment). Updates to any of these from one UI
# are mirrored to the other so PM and CRM always see the same patient identity.
SHARED_PROFILE_FIELDS = [
    "name", "email", "phone", "picture", "age", "sex",
    "address", "city", "state", "country", "pincode",
    "relative_name", "relative_email", "relative_whatsapp",
    "diabetes_type",
]


async def mirror_profile_to_users(user_id: str, updates: Dict) -> None:
    """Mirror any SHARED_PROFILE_FIELDS in `updates` into db.users for this user_id."""
    if not updates:
        return
    mirrored = {k: v for k, v in updates.items() if k in SHARED_PROFILE_FIELDS}
    if not mirrored:
        return
    mirrored["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        await db.users.update_one({"id": user_id}, {"$set": mirrored})
    except Exception as e:
        logger.warning(f"[CRM] mirror_profile_to_users failed for {user_id}: {e}")


async def mirror_profile_to_crm(user_id: str, updates: Dict) -> None:
    """Mirror any SHARED_PROFILE_FIELDS in `updates` into crm_patient_profiles.
    Creates the profile row first if it doesn't exist (so PM-only users still
    show up in CRM after their first identity edit)."""
    if not updates:
        return
    mirrored = {k: v for k, v in updates.items() if k in SHARED_PROFILE_FIELDS}
    if not mirrored:
        return
    mirrored["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        existing = await db.crm_patient_profiles.find_one({"id": user_id}, {"_id": 0})
        if not existing:
            await ensure_crm_profile_for_user(user_id)
        await db.crm_patient_profiles.update_one({"id": user_id}, {"$set": mirrored})
    except Exception as e:
        logger.warning(f"[CRM] mirror_profile_to_crm failed for {user_id}: {e}")


async def ensure_crm_profile_for_user(user_id: str) -> Optional[Dict]:
    """Ensure a crm_patient_profiles document exists for the given main-app user.
    Returns the profile (with _id stripped) or None if the user doesn't exist.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return None
    profile = await db.crm_patient_profiles.find_one({"id": user_id}, {"_id": 0})
    now_iso = datetime.now(timezone.utc).isoformat()
    if not profile:
        profile = {
            "id": user_id,
            "encare_user_id": user_id,
            "name": user.get("name", ""),
            "email": user.get("email"),
            "phone": user.get("phone"),
            "picture": user.get("picture"),
            "age": user.get("age"),
            "sex": user.get("sex"),
            "address": user.get("address"),
            "city": user.get("city"),
            "state": user.get("state"),
            "country": user.get("country"),
            "pincode": user.get("pincode"),
            "diabetes_type": user.get("diabetes_type", "Type 2"),
            "diseases": [],
            "relative_name": user.get("relative_name"),
            "relative_email": user.get("relative_email"),
            "relative_whatsapp": user.get("relative_whatsapp"),
            "caregivers": [],
            "medicine_invoice_link": user.get("medicine_invoice_link"),
            "medicine_invoice_amount": user.get("medicine_invoice_amount"),
            "adherence_rate": 85.0,
            "priority": "normal",
            "marketing_consent": "open",
            "interactions": [],
            "last_contact": None,
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        await db.crm_patient_profiles.insert_one(dict(profile))  # insert_one mutates; we pass a copy
    else:
        # Keep user-identity fields in sync with main app on every read
        sync_updates = {}
        for key in ("name", "email", "phone", "picture", "age", "sex",
                    "address", "city", "state", "country", "pincode", "diabetes_type",
                    "relative_name", "relative_email", "relative_whatsapp"):
            if user.get(key) is not None and profile.get(key) != user.get(key):
                sync_updates[key] = user.get(key)
        if sync_updates:
            sync_updates["updated_at"] = now_iso
            await db.crm_patient_profiles.update_one({"id": user_id}, {"$set": sync_updates})
            profile.update(sync_updates)
    return profile


async def ensure_all_crm_profiles() -> int:
    """One-shot: create CRM profiles for every main-app user missing one AND purge orphaned
    CRM profiles whose user no longer exists in db.users. Returns count of profiles created.
    """
    created = 0
    existing_ids = set()
    async for p in db.crm_patient_profiles.find({}, {"_id": 0, "id": 1}):
        existing_ids.add(p.get("id"))

    user_ids = set()
    async for u in db.users.find({}, {"_id": 0}):
        uid = u.get("id")
        if not uid:
            continue
        user_ids.add(uid)
        # Skip caregiver/admin roles from appearing as patients
        role = u.get("role", "user")
        if role in ("prescription_manager", "admin"):
            continue
        if uid not in existing_ids:
            await ensure_crm_profile_for_user(uid)
            created += 1

    # Orphan cleanup — profiles whose user was deleted from db.users
    orphans = [pid for pid in existing_ids if pid not in user_ids]
    if orphans:
        await db.crm_patient_profiles.delete_many({"id": {"$in": orphans}})
        await db.crm_opportunities.delete_many({"patient_id": {"$in": orphans}})
        await db.crm_lab_bookings.delete_many({"patient_id": {"$in": orphans}})
        await db.crm_revenue_conversions.delete_many({"patient_id": {"$in": orphans}})
        logger.info(f"[CRM] Purged {len(orphans)} orphan CRM profiles (user deleted from main app)")

    return created


async def compute_adherence_rate_7d(user_id: str) -> Optional[int]:
    """Compute medication adherence % over the last 7 days for a user.

    Mirrors the formula used by the user-facing Reports page:
        rate = taken / (taken + skipped + missed)          # ignores "pending"

    Returns an integer 0-100, or None if the user has no non-pending logs
    in the window (so the UI can render "—").
    """
    if not user_id:
        return None
    today = datetime.now(timezone(timedelta(hours=5, minutes=30))).date()
    start = (today - timedelta(days=6)).strftime("%Y-%m-%d")  # inclusive 7-day window
    end = today.strftime("%Y-%m-%d")
    total = await db.adherence_logs.count_documents({
        "user_id": user_id,
        "date": {"$gte": start, "$lte": end},
        "status": {"$ne": "pending"},
    })
    if total == 0:
        return None
    taken = await db.adherence_logs.count_documents({
        "user_id": user_id,
        "date": {"$gte": start, "$lte": end},
        "status": "taken",
    })
    return round((taken / total) * 100)


async def attach_medications_to_profile(profile: Dict) -> Dict:
    """Pull the patient's medications from the main app medications collection and inject into profile.
    Also overlay the live db.users identity (name/phone/etc.) so CRM always reflects the
    latest data — guards against any past write that only touched users (or vice versa)."""
    user_id = profile.get("id")
    if not user_id:
        profile["medicines"] = []
        profile["adherence_rate"] = None
        return profile
    # Overlay shared identity fields from db.users (source of truth for identity in PM)
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user:
        for f in SHARED_PROFILE_FIELDS:
            if user.get(f) is not None:
                profile[f] = user[f]
    meds = await db.medications.find({"user_id": user_id}, {"_id": 0}).to_list(200)
    profile["medicines"] = [_translate_main_medication(m) for m in meds]
    # Re-detect diseases if none set on profile
    if not profile.get("diseases"):
        detected = detect_diseases_from_medicines(profile["medicines"])
        if profile.get("age", 0) and profile["age"] >= 65:
            detected.append("Elderly Care")
        profile["diseases"] = list(set(detected))
    # Live-compute adherence from the same source the Reports page uses (last 7 days).
    # This overrides any stored static value so CRM and the user-facing report always agree.
    profile["adherence_rate"] = await compute_adherence_rate_7d(user_id)
    return profile


@router.post("/sync/from-main-app")
async def sync_profiles_from_main(request: Request):
    """Create CRM profiles for every main-app user that doesn't yet have one."""
    await get_prescription_manager(request, db)
    count = await ensure_all_crm_profiles()
    total = await db.crm_patient_profiles.count_documents({})
    return {"created": count, "total_profiles": total}


@router.get("/onboarding/pending")
async def get_pending_onboarding(days: int = Query(30, description="Lookback window in days")):
    """List patients that still need onboarding (joined recently, profile fields empty).

    A patient needs onboarding if ANY of:
      - no diseases set, OR
      - no consulting_doctor_name, OR
      - no last_doctor_visit_date, OR
      - no main_disease / diabetes_type.
    Only users joined within the last `days` window are returned (most recent first).
    """
    await ensure_all_crm_profiles()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    query = {
        "$and": [
            {"created_at": {"$gte": cutoff}},
            {"$or": [{"onboarding_completed": {"$ne": True}}, {"onboarding_completed": {"$exists": False}}]},
            {"$or": [
                {"diseases": {"$in": [None, []]}},
                {"diseases": {"$exists": False}},
                {"consulting_doctor_name": {"$in": [None, ""]}},
                {"consulting_doctor_name": {"$exists": False}},
                {"last_doctor_visit_date": {"$in": [None, ""]}},
                {"last_doctor_visit_date": {"$exists": False}},
            ]}
        ]
    }
    pending = await db.crm_patient_profiles.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "created_at": 1,
         "diseases": 1, "consulting_doctor_name": 1, "last_doctor_visit_date": 1, "priority": 1},
    ).sort("created_at", -1).limit(200).to_list(200)
    return {"count": len(pending), "patients": pending}


# ======================== MEDICINE INTEL (AI DISEASE DETECTION) ========================

@router.get("/patients/{patient_id}/detected-diseases")
async def get_patient_detected_diseases(patient_id: str, warm: bool = Query(True)):
    """Get AI-detected diseases + product suggestions for a patient based on their medications.

    - Reads from db.crm_medicine_intel cache (NO Gemini call if already cached).
    - If `warm=true` (default): kicks off a background Gemini call for any uncached medicine
      so the NEXT request for this patient returns richer data.
    - Respects per-patient `excluded_diseases[]` so HA-deleted diseases stay hidden.
    Response: {diseases: [...], medical_equipment: [...], personal_care: [...], warmed: N}
    """
    profile = await db.crm_patient_profiles.find_one({"id": patient_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Patient not found")

    meds = await db.medications.find({"user_id": patient_id}, {"_id": 0, "name": 1}).to_list(200)
    med_names = [m["name"] for m in meds if m.get("name")]

    from services import medicine_intel as _mi
    agg = await _mi.aggregate_for_medicines(med_names)

    excluded = {d.lower() for d in (profile.get("excluded_diseases") or [])}
    agg["diseases"] = [d for d in agg["diseases"] if d["name"].lower() not in excluded]

    warmed = 0
    if warm:
        # Kick off background warming for any not-yet-cached medicines; return immediately
        import asyncio as _asyncio
        _asyncio.create_task(_mi.warm_cache_for_medicines(med_names))
    return {**agg, "medicine_count": len(med_names), "excluded": sorted(excluded), "warmed": warmed}


@router.post("/patients/{patient_id}/detected-diseases/select")
async def select_detected_diseases(patient_id: str, payload: Dict):
    """HA explicitly selects AI-detected diseases (checkbox-based).

    Body: {"diseases": ["Type 2 Diabetes", "Hypertension"]}

    Effects:
      • patient.diseases is replaced with the unique selected list (case-preserved
        from input but de-duped case-insensitively).
      • patient.main_disease is set to a comma-joined view so it shows up in the
        "Medical Information → Main Disease / Primary Condition" field.
      • Lab-test and Product suggestion endpoints rely on patient.diseases, so the
        suggestions automatically follow the new selection.
    """
    profile = await db.crm_patient_profiles.find_one({"id": patient_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Patient not found")

    raw = payload.get("diseases") if isinstance(payload, dict) else None
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail="'diseases' must be a list of strings")

    seen: set = set()
    selected: List[str] = []
    for d in raw:
        if not isinstance(d, str):
            continue
        name = d.strip()
        key = name.lower()
        if name and key not in seen:
            seen.add(key)
            selected.append(name)

    main_disease_value = ", ".join(selected) if selected else ""
    await db.crm_patient_profiles.update_one(
        {"id": patient_id},
        {"$set": {
            "diseases": selected,
            "main_disease": main_disease_value,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    # Lab/product Revenue Opportunity depends on selected diseases → refresh opps
    _trigger_opportunity_refresh()
    return {
        "message": "Selected diseases saved to patient profile",
        "diseases": selected,
        "main_disease": main_disease_value,
    }


@router.delete("/patients/{patient_id}/detected-diseases/{disease_name}")
async def delete_detected_disease(patient_id: str, disease_name: str):
    """HA marks a detected disease as incorrect. Stored in excluded_diseases[] so it stays hidden
    even if re-detected from medicines later."""
    profile = await db.crm_patient_profiles.find_one({"id": patient_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Patient not found")
    dn = (disease_name or "").strip()
    if not dn:
        raise HTTPException(status_code=400, detail="Disease name required")
    excluded = set(profile.get("excluded_diseases") or [])
    excluded.add(dn)
    # Also remove from profile.diseases if present so the UI updates immediately
    remaining = [d for d in (profile.get("diseases") or []) if d.lower() != dn.lower()]
    await db.crm_patient_profiles.update_one(
        {"id": patient_id},
        {"$set": {
            "excluded_diseases": sorted(excluded),
            "diseases": remaining,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"message": f"Disease '{dn}' excluded for patient", "excluded_diseases": sorted(excluded)}


@router.post("/patients/{patient_id}/detected-diseases/{disease_name}/restore")
async def restore_detected_disease(patient_id: str, disease_name: str):
    """Undo exclusion — bring back an AI-detected disease."""
    dn = (disease_name or "").strip()
    await db.crm_patient_profiles.update_one(
        {"id": patient_id},
        {"$pull": {"excluded_diseases": {"$regex": f"^{dn}$", "$options": "i"}},
         "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"message": f"Disease '{dn}' restored"}


@router.post("/medicine-intel/warm")
async def warm_medicine_intel(payload: Dict):
    """Admin utility: warm the cache for a list of medicine names.
    Body: {"medicines": ["Metformin", "Atorvastatin"]}
    Runs Gemini call for each uncached medicine. Returns number of LLM calls made.
    """
    names = payload.get("medicines") or []
    if not isinstance(names, list):
        raise HTTPException(status_code=400, detail="`medicines` must be a list")
    from services import medicine_intel as _mi
    count = await _mi.warm_cache_for_medicines(names)
    return {"llm_calls": count, "requested": len(names)}


@router.get("/medicine-intel/cache")
async def get_medicine_intel_cache(limit: int = 100):
    """Return the cached medicine intel docs (for debugging / admin)."""
    docs = await db.crm_medicine_intel.find({}, {"_id": 0}).sort("cached_at", -1).to_list(limit)
    return {"count": len(docs), "items": docs}


# ======================== PATIENT ROUTES ========================

async def compute_priority_reason(patient: Dict) -> str:
    """Compute a human-readable reason for the patient's current priority."""
    reasons = []
    priority = patient.get("priority", "normal")
    pid = patient.get("id")

    # Check medicine stock
    for med in patient.get("medicines", []):
        stock = calculate_stock_status(med)
        if stock.get("is_low") and stock.get("days_left", 999) <= 3:
            reasons.append(f"{med.get('name', 'Medicine')} critically low ({stock['days_left']} days left)")
        elif stock.get("is_low"):
            reasons.append(f"{med.get('name', 'Medicine')} running low ({stock['days_left']} days left)")

    # Check adherence (computed live from last-7-day adherence logs)
    adherence = patient.get("adherence_rate")
    if adherence is not None and adherence < 70:
        reasons.append(f"Low adherence ({adherence}%)")

    # Check doctor visit overdue (3+ months)
    if pid:
        three_months_ago = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")
        last_done = await db.appointments.find_one(
            {"user_id": pid, "status": "done"}, {"_id": 0, "date": 1}, sort=[("date", -1)]
        )
        if last_done and last_done["date"] < three_months_ago:
            reasons.append(f"Doctor visit overdue (last: {last_done['date']})")
        elif not last_done:
            any_appt = await db.appointments.find_one({"user_id": pid}, {"_id": 0})
            if any_appt:
                reasons.append("Doctor visit overdue (no completed visits)")

    # Check number of diseases
    diseases = patient.get("diseases", [])
    if len(diseases) >= 3:
        reasons.append(f"Multiple conditions ({', '.join(diseases[:3])})")

    if not reasons:
        if priority == "high":
            reasons.append("Marked as high priority")
        elif priority == "normal":
            reasons.append("Standard care plan")
        else:
            reasons.append("Stable condition")

    return "; ".join(reasons)


@router.get("/patients", response_model=List[Dict])
async def get_patients(
    request: Request,
    search: Optional[str] = None,
    disease: Optional[str] = None,
    priority: Optional[str] = None
):
    """Get all patients with optional filters. Auto-creates profiles for new main-app users."""
    await get_prescription_manager(request, db)

    # Ensure every main-app user has a CRM profile (on-demand sync, idempotent)
    await ensure_all_crm_profiles()

    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    if disease:
        query["diseases"] = disease
    if priority:
        query["priority"] = priority

    patients = await db.crm_patient_profiles.find(query, {"_id": 0}).to_list(1000)

    # Attach medications from main app + compute enrichment
    for patient in patients:
        await attach_medications_to_profile(patient)
        for med in patient.get("medicines", []):
            med["stock_status"] = calculate_stock_status(med)
        patient["priority_reason"] = await compute_priority_reason(patient)

    return patients

@router.get("/patients/{patient_id}", response_model=Dict)
async def get_patient(request: Request, patient_id: str):
    """Get a single patient by ID with vitals and lab tests."""
    await get_prescription_manager(request, db)

    patient = await ensure_crm_profile_for_user(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Attach medications from main app
    await attach_medications_to_profile(patient)

    # Enrich with stock status
    for med in patient.get("medicines", []):
        med["stock_status"] = calculate_stock_status(med)

    # Enrich with priority reason
    patient["priority_reason"] = await compute_priority_reason(patient)

    # Include latest vitals
    cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).strftime("%Y-%m-%d")
    patient["blood_glucose"] = await db.blood_glucose.find(
        {"user_id": patient_id, "date": {"$gte": cutoff}}, {"_id": 0}
    ).sort("date", -1).to_list(50)
    patient["blood_pressure"] = await db.blood_pressure.find(
        {"user_id": patient_id, "date": {"$gte": cutoff}}, {"_id": 0}
    ).sort("date", -1).to_list(50)
    patient["body_metrics"] = await db.body_metrics.find(
        {"user_id": patient_id, "date": {"$gte": cutoff}}, {"_id": 0}
    ).sort("date", -1).to_list(50)
    
    # Include lab test bookings
    patient["lab_tests"] = await db.crm_lab_bookings.find(
        {"patient_id": patient_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)

    # Calculate next due dates from onboarding visit dates (3-month interval)
    if patient.get("last_doctor_visit_date"):
        try:
            last_doc = datetime.strptime(patient["last_doctor_visit_date"], "%Y-%m-%d")
            patient["next_doctor_visit_due"] = (last_doc + timedelta(days=90)).strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            patient["next_doctor_visit_due"] = None
    else:
        patient["next_doctor_visit_due"] = None

    if patient.get("last_lab_visit_date"):
        try:
            last_lab = datetime.strptime(patient["last_lab_visit_date"], "%Y-%m-%d")
            patient["next_lab_visit_due"] = (last_lab + timedelta(days=90)).strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            patient["next_lab_visit_due"] = None
    else:
        patient["next_lab_visit_due"] = None

    return patient

@router.post("/patients", response_model=Dict)
async def create_patient(patient_data: PatientCreate):
    """Create a new patient."""
    patient_dict = patient_data.model_dump()
    
    # Detect diseases from medicines (if any)
    diseases = []
    if patient_dict.get("age", 0) and patient_dict["age"] >= 65:
        diseases.append("Elderly Care")
    
    # Build caregiver from relative fields
    caregivers = []
    if patient_dict.get("relative_name"):
        caregivers.append({
            "name": patient_dict["relative_name"],
            "phone": patient_dict.get("relative_whatsapp", ""),
            "email": patient_dict.get("relative_email", ""),
            "relationship": "Family"
        })
    
    new_patient = Patient(
        **patient_dict,
        diseases=diseases,
        caregivers=caregivers,
        medicines=[],
        priority="normal"
    )
    
    doc = new_patient.model_dump()
    await db.crm_patient_profiles.insert_one(doc)
    
    return await db.crm_patient_profiles.find_one({"id": new_patient.id}, {"_id": 0})

@router.put("/patients/{patient_id}", response_model=Dict)
async def update_patient(patient_id: str, updates: Dict):
    """Update patient details."""
    # Re-detect diseases if medicines updated
    if "medicines" in updates:
        diseases = detect_diseases_from_medicines(updates["medicines"])
        existing = await db.crm_patient_profiles.find_one({"id": patient_id}, {"_id": 0})
        if existing and existing.get("age", 0) >= 65:
            diseases.append("Elderly Care")
        updates["diseases"] = list(set(diseases))
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.crm_patient_profiles.update_one(
        {"id": patient_id},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Mirror identity-shared fields back to db.users so PM and mobile see the change.
    await mirror_profile_to_users(patient_id, updates)

    return await db.crm_patient_profiles.find_one({"id": patient_id}, {"_id": 0})

@router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str):
    """Remove CRM profile enrichment for this patient.
    NOTE: Does NOT delete the underlying Careable 360+ user, medications, vitals, or appointments —
    those belong to the main app. Only CRM-specific data (interactions, opportunities,
    lab bookings, revenue conversions) is removed so the patient can re-enter CRM cleanly.
    """
    result = await db.crm_patient_profiles.delete_one({"id": patient_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    await db.crm_lab_bookings.delete_many({"patient_id": patient_id})
    await db.crm_opportunities.delete_many({"patient_id": patient_id})
    await db.crm_revenue_conversions.delete_many({"patient_id": patient_id})
    return {"message": "CRM profile removed (main-app user data preserved)"}

@router.put("/patients/{patient_id}/medicines/{medicine_index}/refill")
async def refill_medicine(patient_id: str, medicine_index: int, quantity: int = Query(30)):
    """Refill a medicine. Operates on shared db.medications (same as PM / mobile)."""
    meds = await db.medications.find({"user_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    if medicine_index < 0 or medicine_index >= len(meds):
        raise HTTPException(status_code=400, detail="Invalid medicine index")
    med = meds[medicine_index]
    form = (med.get("form") or "Tablet").lower()
    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if form in ("tablet", "capsule"):
        new_stock = (med.get("tablet_stock_count") or 0) + quantity
        updates["tablet_stock_count"] = new_stock
        if med.get("refill_reminder"):
            refill = {**med["refill_reminder"], "pills_remaining": new_stock}
            updates["refill_reminder"] = refill
    elif form == "injection":
        iu_per_pkg = med.get("injection_iu_per_package") or 300
        updates["injection_stock_count"] = (med.get("injection_stock_count") or 0) + 1
        updates["injection_iu_remaining"] = (med.get("injection_iu_remaining") or 0) + iu_per_pkg
    else:
        updates["tablet_stock_count"] = (med.get("tablet_stock_count") or 0) + quantity
    await db.medications.update_one({"id": med["id"], "user_id": patient_id}, {"$set": updates})
    med.update(updates)
    return {"message": "Medicine refilled", "medicine": med}


@router.post("/patients/{patient_id}/medicines", response_model=Dict)
async def add_medicine(patient_id: str, data: Dict):
    """Add a medicine to a patient — FULL PARITY with PM's `/api/prescription-manager/user/{id}/medications`.
    Writes to shared db.medications and generates adherence logs so mobile app reminders fire correctly.
    Also warms the AI disease-detection cache for this medicine (Gemini call runs in background).
    """
    user = await db.users.find_one({"id": patient_id})
    if not user:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Reuse the main app's Medication model so the record is identical to what PM inserts.
    try:
        from models import Medication as MainMedication
    except ImportError:
        MainMedication = None

    now_iso = datetime.now(timezone.utc).isoformat()
    if MainMedication is not None:
        # Filter unexpected keys out
        med_fields = {k: v for k, v in data.items() if k != "id" and k != "user_id"}
        new_med_model = MainMedication(user_id=patient_id, **med_fields)
        medication_dict = new_med_model.dict()
        # serialize datetime to string for Mongo
        for k, v in list(medication_dict.items()):
            if isinstance(v, datetime):
                medication_dict[k] = v.isoformat()
    else:
        medication_dict = {
            "id": str(uuid.uuid4()),
            "user_id": patient_id,
            "name": data["name"],
            "dosage": data.get("dosage", ""),
            "form": data.get("form", "Tablet"),
            "color": data.get("color", "#FF6B6B"),
            "instructions": data.get("instructions"),
            "schedule": data.get("schedule", {"frequency": "daily", "times": [], "dosage_timings": []}),
            "refill_reminder": data.get("refill_reminder", {"enabled": True, "pills_remaining": 0, "threshold": 7}),
            "tablet_stock_count": data.get("tablet_stock_count"),
            "tablets_per_strip": data.get("tablets_per_strip"),
            "injection_iu_remaining": data.get("injection_iu_remaining"),
            "injection_iu_per_ml": data.get("injection_iu_per_ml"),
            "injection_iu_per_package": data.get("injection_iu_per_package"),
            "injection_ml_volume": data.get("injection_ml_volume"),
            "injection_stock_count": data.get("injection_stock_count"),
            "cost_per_unit": data.get("cost_per_unit"),
            "include_in_invoice": data.get("include_in_invoice", True),
            "created_at": now_iso,
            "updated_at": now_iso,
        }
    await db.medications.insert_one(dict(medication_dict))

    # Generate adherence logs exactly like PM does, so OneSignal reminder scheduler picks this up
    try:
        from helpers import generate_adherence_logs_for_medication
        await generate_adherence_logs_for_medication(medication_dict)
    except Exception as e:
        logger.warning(f"[CRM] Adherence log generation failed for new medicine: {e}")

    # Warm AI disease/product cache in the background (non-blocking; 1 Gemini call per unique name)
    try:
        import asyncio as _asyncio
        from services import medicine_intel
        med_name = medication_dict.get("name")
        if med_name:
            _asyncio.create_task(medicine_intel.warm_cache_for_medicines([med_name]))
    except Exception as e:
        logger.debug(f"[CRM] Medicine intel warm skipped: {e}")

    medication_dict.pop("_id", None)

    # Revenue Opportunity depends on medications → invalidate stale opps in background
    _trigger_opportunity_refresh()
    return medication_dict


@router.put("/patients/{patient_id}/medicines/{medicine_id}", response_model=Dict)
async def update_medicine(patient_id: str, medicine_id: str, data: Dict):
    """Update a medicine — writes to shared db.medications; regenerates adherence logs when schedule changes."""
    existing = await db.medications.find_one({"id": medicine_id, "user_id": patient_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Medicine not found")

    update_data = {k: v for k, v in data.items() if k not in ("id", "user_id") and v is not None}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.medications.update_one(
            {"id": medicine_id, "user_id": patient_id}, {"$set": update_data}
        )
        # If schedule changed, regenerate adherence logs like PM does
        if "schedule" in update_data:
            await db.reminders.delete_many({"medication_id": medicine_id, "status": "pending"})
            try:
                from datetime import timezone as _tz
                ist = _tz(timedelta(hours=5, minutes=30))
                today_ist = datetime.now(ist).strftime("%Y-%m-%d")
                await db.adherence_logs.delete_many({
                    "medication_id": medicine_id, "user_id": patient_id,
                    "date": today_ist, "status": "pending",
                })
                updated = await db.medications.find_one({"id": medicine_id}, {"_id": 0})
                if updated:
                    from helpers import generate_adherence_logs_for_medication
                    await generate_adherence_logs_for_medication(updated)
            except Exception as e:
                logger.warning(f"[CRM] Adherence regeneration failed on medicine update: {e}")

    updated = await db.medications.find_one({"id": medicine_id}, {"_id": 0})
    # Revenue Opportunity depends on medication price/qty/include_in_invoice → refresh opps
    _trigger_opportunity_refresh()
    return updated


@router.delete("/patients/{patient_id}/medicines/{medicine_id}")
async def delete_medicine(patient_id: str, medicine_id: str):
    """Delete a medicine from shared db.medications and clean up pending reminders."""
    result = await db.medications.delete_one({"id": medicine_id, "user_id": patient_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")
    await db.reminders.delete_many({"medication_id": medicine_id, "status": "pending"})
    _trigger_opportunity_refresh()
    return {"message": "Medicine deleted"}

# ======================== VITALS ROUTES (Aligned with Careable 360+) ========================

@router.post("/patients/{patient_id}/vitals", response_model=Dict)
async def add_vital_unified(patient_id: str, data: Dict):
    """Unified vital recording endpoint - dispatches based on type."""
    vital_type = data.get("type", "bp")
    now = datetime.now(timezone.utc)
    date_str = data.get("date", now.strftime("%Y-%m-%d"))
    time_str = data.get("time", now.strftime("%H:%M"))
    
    if vital_type == "bp":
        bp = BloodPressure(
            user_id=patient_id,
            systolic=int(data.get("systolic", 120)),
            diastolic=int(data.get("diastolic", 80)),
            pulse=data.get("pulse"),
            time=time_str,
            date=date_str,
            notes=data.get("notes")
        )
        await db.blood_pressure.insert_one(bp.model_dump())
        return bp.model_dump()
    elif vital_type in ("sugar", "glucose"):
        glucose = BloodGlucose(
            user_id=patient_id,
            value=int(data.get("value", 100)),
            time=time_str,
            meal_context=data.get("meal_context", "Random"),
            date=date_str,
            notes=data.get("notes")
        )
        await db.blood_glucose.insert_one(glucose.model_dump())
        return glucose.model_dump()
    elif vital_type in ("weight", "metrics"):
        height = float(data.get("height", 170))
        weight = float(data.get("value", data.get("weight", 70)))
        bmi = round(weight / ((height / 100) ** 2), 1)
        metrics = BodyMetrics(
            user_id=patient_id,
            weight=weight,
            height=height,
            bmi=bmi,
            date=date_str,
            notes=data.get("notes")
        )
        await db.body_metrics.insert_one(metrics.model_dump())
        return metrics.model_dump()
    else:
        raise HTTPException(status_code=400, detail=f"Unknown vital type: {vital_type}")

@router.post("/patients/{patient_id}/vitals/glucose", response_model=Dict)
async def add_glucose_reading(patient_id: str, reading: Dict):
    """Add blood glucose reading - aligned with Careable 360+."""
    glucose = BloodGlucose(
        user_id=patient_id,
        value=reading["value"],
        time=reading.get("time", datetime.now(timezone.utc).strftime("%H:%M")),
        meal_context=reading.get("meal_context", "Random"),
        date=reading.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        notes=reading.get("notes")
    )
    
    await db.blood_glucose.insert_one(glucose.model_dump())
    return glucose.model_dump()

@router.post("/patients/{patient_id}/vitals/bp", response_model=Dict)
async def add_bp_reading(patient_id: str, reading: Dict):
    """Add blood pressure reading - aligned with Careable 360+."""
    bp = BloodPressure(
        user_id=patient_id,
        systolic=reading["systolic"],
        diastolic=reading["diastolic"],
        pulse=reading.get("pulse"),
        time=reading.get("time", datetime.now(timezone.utc).strftime("%H:%M")),
        date=reading.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        notes=reading.get("notes")
    )
    
    await db.blood_pressure.insert_one(bp.model_dump())
    return bp.model_dump()

@router.post("/patients/{patient_id}/vitals/metrics", response_model=Dict)
async def add_body_metrics(patient_id: str, reading: Dict):
    """Add body metrics - aligned with Careable 360+."""
    height = reading.get("height", 170)
    weight = reading["weight"]
    bmi = round(weight / ((height / 100) ** 2), 1)
    
    metrics = BodyMetrics(
        user_id=patient_id,
        weight=weight,
        height=height,
        bmi=bmi,
        date=reading.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        notes=reading.get("notes")
    )
    
    await db.body_metrics.insert_one(metrics.model_dump())
    return metrics.model_dump()

@router.get("/patients/{patient_id}/vitals", response_model=Dict)
async def get_patient_vitals(patient_id: str, days: int = 30):
    """Get all vitals for a patient."""
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    
    glucose = await db.blood_glucose.find(
        {"user_id": patient_id, "date": {"$gte": cutoff_date}},
        {"_id": 0}
    ).sort("date", -1).to_list(100)
    
    bp = await db.blood_pressure.find(
        {"user_id": patient_id, "date": {"$gte": cutoff_date}},
        {"_id": 0}
    ).sort("date", -1).to_list(100)
    
    metrics = await db.body_metrics.find(
        {"user_id": patient_id, "date": {"$gte": cutoff_date}},
        {"_id": 0}
    ).sort("date", -1).to_list(100)
    
    return {
        "blood_glucose": glucose,
        "blood_pressure": bp,
        "body_metrics": metrics
    }

# ======================== APPOINTMENT ROUTES (Aligned with Careable 360+) ========================

@router.get("/patients/{patient_id}/appointments", response_model=List[Dict])
async def get_patient_appointments(patient_id: str):
    """Get appointments for a patient, sorted by date desc."""
    appointments = await db.appointments.find(
        {"user_id": patient_id},
        {"_id": 0}
    ).sort([("date", -1), ("time", -1)]).to_list(200)
    return appointments

@router.post("/patients/{patient_id}/appointments", response_model=Dict)
async def create_appointment(patient_id: str, appointment: AppointmentCreate):
    """Create an appointment for a patient — FULL PARITY with main app POST /api/appointments.
    Writes to shared db.appointments, fires OneSignal push to patient, and notifies caregiver
    so mobile app's Upcoming Appointments screen and CRM's Appointment History stay in sync.
    """
    user = await db.users.find_one({"id": patient_id}, {"_id": 0, "name": 1})
    if not user:
        raise HTTPException(status_code=404, detail="Patient not found")

    new_apt = Appointment(user_id=patient_id, **appointment.model_dump())
    apt_dict = new_apt.model_dump()
    await db.appointments.insert_one(dict(apt_dict))

    # Same OneSignal push that PM fires when booking for a user (mobile visibility)
    try:
        from services.onesignal_service import onesignal_service
        from helpers import notify_caregiver
        apt_title = new_apt.title or "Appointment"
        notif_body = f"{apt_title} on {new_apt.date or ''} at {new_apt.time or ''}"
        await onesignal_service.send_to_user(
            user_id=patient_id,
            title="New Appointment Booked",
            body=notif_body,
            data={"type": "appointment_created", "appointment_id": new_apt.id, "targetPage": "appointments"},
            android_channel_id="appointment_reminders",
        )
        await notify_caregiver(
            patient_user_id=patient_id,
            event_type="appointment_created",
            medication_name=notif_body,
            dosage="",
            scheduled_time="",
        )
    except Exception as e:
        logger.warning(f"[CRM] Appointment notification failed: {e}")

    apt_dict.pop("_id", None)
    return apt_dict

@router.put("/patients/{patient_id}/appointments/{apt_id}/status")
async def update_apt_status(patient_id: str, apt_id: str, data: dict):
    """Update appointment status - aligned with Careable 360+ statuses."""
    new_status = data.get("status")
    valid_statuses = ["upcoming", "done", "postponed", "abandoned"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    result = await db.appointments.update_one(
        {"id": apt_id, "user_id": patient_id},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Auto-flag patient as high priority if last done visit was 3+ months ago
    if new_status == "done":
        three_months_ago = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")
        last_done = await db.appointments.find_one(
            {"user_id": patient_id, "status": "done"},
            {"_id": 0, "date": 1}, sort=[("date", -1)]
        )
        if not last_done or last_done["date"] < three_months_ago:
            await db.crm_patient_profiles.update_one({"id": patient_id}, {"$set": {"priority": "high"}})

    updated = await db.appointments.find_one({"id": apt_id}, {"_id": 0})
    return updated

# ======================== INTERACTION ROUTES ========================

@router.post("/patients/{patient_id}/interactions", response_model=Dict)
async def add_interaction(patient_id: str, interaction: Dict):
    """Log an interaction with a patient."""
    follow_up_date = interaction.get("follow_up_date", "")
    follow_up_time = interaction.get("follow_up_time", "09:00")
    if not follow_up_date:
        raise HTTPException(status_code=400, detail="Follow-up date is required")

    # Validate follow-up is in the future
    try:
        follow_up_dt = datetime.fromisoformat(f"{follow_up_date}T{follow_up_time}")
        if follow_up_dt <= datetime.now():
            raise HTTPException(status_code=400, detail="Follow-up date and time must be in the future")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid follow-up date or time format")

    interaction_obj = Interaction(
        type=interaction["type"],
        purpose=interaction.get("purpose", ""),
        notes=interaction["notes"],
        outcome=interaction["outcome"],
        follow_up_date=follow_up_date,
        follow_up_time=follow_up_time
    )
    
    # Add to patient's interactions array
    result = await db.crm_patient_profiles.update_one(
        {"id": patient_id},
        {
            "$push": {"interactions": interaction_obj.model_dump()},
            "$set": {"last_contact": datetime.now(timezone.utc).isoformat()}
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    return interaction_obj.model_dump()

@router.get("/patients/{patient_id}/interactions", response_model=List[Dict])
async def get_interactions(patient_id: str):
    """Get interactions for a patient."""
    patient = await db.crm_patient_profiles.find_one({"id": patient_id}, {"_id": 0, "interactions": 1})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient.get("interactions", [])



# ======================== LAB TEST BOOKING ROUTES ========================

@router.post("/patients/{patient_id}/lab-tests/book", response_model=Dict)
async def book_lab_test(patient_id: str, data: Dict):
    """Book a lab test for a patient.
    Writes rich record to crm_lab_bookings AND dual-writes to shared db.appointments (type='lab')
    so the customer-facing mobile app + Home page see the booking. Records revenue conversion.
    """
    patient = await ensure_crm_profile_for_user(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    try:
        booking = LabBooking(
            patient_id=patient_id,
            test_name=data["test_name"],
            booked_date=data.get("booked_date"),
            price=data.get("price", 0) or 0,
            lab_name=data.get("lab_name"),
            scheduled_time=data.get("scheduled_time"),
            notes=data.get("notes"),
            source=data.get("source"),
        ).model_dump()
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid booking data: {e}")

    await db.crm_lab_bookings.insert_one(booking)
    booking.pop("_id", None)

    # DUAL-WRITE: also create a matching entry in db.appointments (type="lab") so the customer-facing
    # mobile app + Home page + reminder scheduler all see the booking.
    try:
        lab_apt = {
            "id": str(uuid.uuid4()),
            "user_id": patient_id,
            "type": "lab",
            "title": f"Lab: {booking['test_name']}",
            "doctor": None,
            "hospital": booking.get("lab_name") or "",
            "date": booking.get("booked_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "time": booking.get("scheduled_time") or "09:00",
            "location": booking.get("lab_name") or "",
            "notes": booking.get("notes"),
            "status": "upcoming",
            "source": "crm_lab_booking",
            "lab_booking_id": booking["id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.appointments.insert_one(dict(lab_apt))
        # Send same-day notification so the customer sees it immediately
        from services.onesignal_service import onesignal_service
        await onesignal_service.send_to_user(
            user_id=patient_id,
            title="Lab Test Booked",
            body=f"{lab_apt['title']} on {lab_apt['date']} at {lab_apt['time']}",
            data={"type": "appointment_created", "appointment_id": lab_apt["id"], "targetPage": "appointments"},
            android_channel_id="appointment_reminders",
        )
    except Exception as e:
        logger.warning(f"[CRM] Lab booking dual-write/notification failed: {e}")

    # Auto-record converted revenue for lab tests (category: lab_test)
    if booking["price"]:
        try:
            await record_revenue_conversion(
                patient_id=patient_id,
                patient_name=patient.get("name", ""),
                category="lab_test",
                source="lab_booking",
                amount=float(booking["price"]),
                description=f"{booking['test_name']} at {booking.get('lab_name') or 'Lab'}",
            )
        except Exception as e:
            logger.warning(f"Failed to record lab test revenue: {e}")

    return booking

@router.get("/patients/{patient_id}/lab-tests", response_model=List[Dict])
async def get_lab_tests(patient_id: str):
    """Get lab test bookings for a patient."""
    bookings = await db.crm_lab_bookings.find(
        {"patient_id": patient_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return bookings

@router.put("/patients/{patient_id}/lab-tests/{test_id}", response_model=Dict)
async def update_lab_test(patient_id: str, test_id: str, data: Dict):
    """Update a lab test booking status."""
    update_doc = dict(data)
    if "booked_date" in update_doc:
        try:
            update_doc["booked_date"] = normalize_booked_date(update_doc["booked_date"])
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    result = await db.crm_lab_bookings.update_one(
        {"id": test_id, "patient_id": patient_id},
        {"$set": update_doc}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lab test booking not found")
    return {"message": "Lab test updated"}

# ======================== SUGGESTIONS ROUTES ========================

@router.get("/patients/{patient_id}/suggestions/products", response_model=List[Dict])
async def get_product_suggestions_for_patient(patient_id: str):
    """Get product suggestions based on patient's diseases.

    Merges:
      • Curated product catalog (legacy, mapped from patient.diseases)
      • AI-detected equipment items from Gemini cache (with estimated INR prices)
    Returned shape: [{name, disease, purpose, price, category}]  — same schema for both sources.
    Kicks off a non-blocking warm for any uncached medicines so prices fill in on the next visit.
    """
    patient = await db.crm_patient_profiles.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    diseases = patient.get("diseases", []) or []
    curated = get_product_suggestions(diseases)

    # Pull AI equipment suggestions (cache-only, fire warm in background)
    meds = await db.medications.find({"user_id": patient_id}, {"_id": 0, "name": 1}).to_list(200)
    med_names = [m["name"] for m in meds if m.get("name")]

    ai_items: List[Dict] = []
    if med_names:
        from services import medicine_intel as _mi
        agg = await _mi.aggregate_for_medicines(med_names)
        # AI items are now strictly tied to HA-SELECTED diseases (patient.diseases).
        # If no diseases are selected yet, AI items are hidden — the HA must explicitly
        # select diseases via the AI Detected Diseases card to see suggestions.
        # Match is fuzzy/case-insensitive so "Type 2 Diabetes" overlaps with
        # "Type 2 Diabetes Mellitus" / "Diabetes".

        # Include BOTH medical equipment AND personal care as "suggested products" per user request
        # (user considers "equipment" to mean both categories). Both use the same schema.
        for eq in agg.get("medical_equipment", []):
            for_diseases = [
                d for d in (eq.get("for_diseases") or [])
                if isinstance(d, str) and _disease_matches(d, diseases)
            ]
            if not for_diseases:
                continue
            ai_items.append({
                "name": eq["name"],
                "disease": ", ".join(for_diseases),
                "purpose": eq.get("purpose") or "",
                "price": eq.get("price_inr"),
                "category": "equipment",
                "source": "ai",
            })
        for pc in agg.get("personal_care", []):
            for_diseases = [
                d for d in (pc.get("for_diseases") or [])
                if isinstance(d, str) and _disease_matches(d, diseases)
            ]
            if not for_diseases:
                continue
            ai_items.append({
                "name": pc["name"],
                "disease": ", ".join(for_diseases),
                "purpose": pc.get("purpose") or "",
                "price": pc.get("price_inr"),
                "category": "personal_care",
                "source": "ai",
            })

        # Background-warm any not-yet-cached medicines (non-blocking)
        try:
            import asyncio as _asyncio
            _asyncio.create_task(_mi.warm_cache_for_medicines(med_names))
        except Exception:
            pass

    # Dedup curated vs AI (prefer AI record when names match exactly)
    ai_name_set = {i["name"].lower() for i in ai_items}
    curated_filtered = [p for p in curated if p.get("name", "").lower() not in ai_name_set]
    # Mark curated with source tag so frontend can differentiate
    for p in curated_filtered:
        p["source"] = "curated"

    return ai_items + curated_filtered

@router.get("/patients/{patient_id}/suggestions/lab-tests", response_model=List[Dict])
async def get_lab_test_suggestions_for_patient(patient_id: str):
    """Get lab test suggestions based on patient's diseases."""
    patient = await db.crm_patient_profiles.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    diseases = patient.get("diseases", [])
    return await get_lab_test_suggestions_with_custom(diseases)

# ======================== OPPORTUNITIES ROUTES ========================

@router.get("/opportunities", response_model=List[Dict])
async def get_opportunities(
    opportunity_type: Optional[str] = None,
    status: Optional[str] = "pending"
):
    """Get all opportunities. Auto-generates on first call if none exist yet for pending status."""
    query = {}
    if opportunity_type:
        query["type"] = opportunity_type
    if status:
        query["status"] = status

    opportunities = await db.crm_opportunities.find(query, {"_id": 0}).to_list(500)

    # If there are no pending opportunities yet, auto-run the generator so the UI never
    # looks empty after deployment / first-time setup.
    if not opportunities and (status == "pending" or status is None):
        try:
            await generate_opportunities()
            opportunities = await db.crm_opportunities.find(query, {"_id": 0}).to_list(500)
        except Exception as e:
            logger.warning(f"[CRM] Auto-generate opportunities failed: {e}")

    # Enrich with parent revenue_category for UI grouping
    for opp in opportunities:
        opp["revenue_category"] = get_revenue_category(opp.get("type"))
    return opportunities

_opp_refresh_lock: Optional[Any] = None  # asyncio.Lock; lazy-init in event loop


def _trigger_opportunity_refresh():
    """Fire-and-forget background regeneration of CRM Revenue Opportunities.
    Safe to call from any mutation that affects medicine prices, schedules, diseases,
    lab tests, or products. Uses a lock so concurrent triggers coalesce into a single
    regen pass."""
    import asyncio as _asyncio
    try:
        loop = _asyncio.get_event_loop()
    except RuntimeError:
        return
    global _opp_refresh_lock
    if _opp_refresh_lock is None:
        try:
            _opp_refresh_lock = _asyncio.Lock()
        except Exception:
            return

    async def _runner():
        # If another regen is in flight, skip — it'll capture our changes.
        if _opp_refresh_lock.locked():
            return
        async with _opp_refresh_lock:
            try:
                await generate_opportunities()
            except Exception as e:
                logger.warning(f"[CRM] Background opp refresh failed: {e}")

    try:
        loop.create_task(_runner())
    except Exception:
        pass


@router.post("/opportunities/generate")
async def generate_opportunities():
    """Generate opportunities + Revenue Opportunity (Expected Revenue) per patient.

    Revenue Opportunity rules (current spec):
      • Medicine = SYSTEM-computed monthly invoice (sum of qty × cost_per_unit across
        the patient's `db.medications`, mirroring the Invoice Manager auto-generator).
        Manually-entered onboarding invoice amounts (purchase_links.*) are IGNORED here.
      • Lab Test  = SUM of every suggested lab test's price for the patient's selected diseases.
      • Product   = SUM of every AI/curated product suggestion's price for selected diseases.

    Refill tasks are still generated per-medicine for the Patient Profile checklist
    but carry expected_revenue = 0 (revenue is rolled up into the medicine invoice opp).
    """
    # Make sure every main-app user has a CRM profile first
    await ensure_all_crm_profiles()

    from routes.invoice_delivery import compute_monthly_medicine_invoice_total

    patients = await db.crm_patient_profiles.find({}, {"_id": 0}).to_list(5000)
    opportunities = []

    for patient in patients:
        patient_id = patient["id"]
        patient_name = patient.get("name") or patient.get("email") or "Unknown"
        patient_phone = patient.get("phone", "")

        # Pull real medications from main app
        meds = await db.medications.find({"user_id": patient_id}, {"_id": 0}).to_list(200)
        medicines = [_translate_main_medication(m) for m in meds]

        # HA-selected diseases drive lab-test + product suggestions
        diseases = patient.get("diseases") or []

        # ---- 1) Refill task entries (per-medicine, revenue=0) ----
        for med in medicines:
            stock_status = calculate_stock_status(med)
            if stock_status["is_low"]:
                opportunities.append(Opportunity(
                    patient_id=patient_id,
                    patient_name=patient_name,
                    patient_phone=patient_phone,
                    type="refill",
                    description=f"{med['name']} running low ({stock_status['days_left']} days left)",
                    priority="high" if stock_status["days_left"] <= 3 else "medium",
                    expected_revenue=0.0,
                ).model_dump())

        # ---- 2) Medicine Refill Revenue (system-computed monthly invoice) ----
        medicine_invoice_total = await compute_monthly_medicine_invoice_total(patient_id)
        if medicine_invoice_total > 0:
            opportunities.append(Opportunity(
                patient_id=patient_id,
                patient_name=patient_name,
                patient_phone=patient_phone,
                type="invoice",
                description=f"Monthly medicine invoice: ₹{medicine_invoice_total:,.0f}",
                priority="medium",
                expected_revenue=float(medicine_invoice_total),
            ).model_dump())

        # ---- 3) Lab Test Revenue (sum of all suggested test prices) ----
        if diseases:
            lab_tests = await get_lab_test_suggestions_with_custom(diseases)
            lab_total = sum(float(t.get("price") or 0) for t in lab_tests)
            if lab_total > 0:
                opportunities.append(Opportunity(
                    patient_id=patient_id,
                    patient_name=patient_name,
                    patient_phone=patient_phone,
                    type="lab_test",
                    description=f"{len(lab_tests)} suggested lab test(s) — ₹{lab_total:,.0f}",
                    priority="medium",
                    expected_revenue=float(lab_total),
                ).model_dump())

        # ---- 4) Product Revenue (AI + curated suggestion prices) ----
        if diseases:
            curated_products = get_product_suggestions(diseases)
            ai_total = 0.0
            ai_count = 0
            med_names = [m["name"] for m in meds if m.get("name")]
            if med_names:
                from services import medicine_intel as _mi
                agg = await _mi.aggregate_for_medicines(med_names)
                for eq in agg.get("medical_equipment", []):
                    if any(_disease_matches(d, diseases) for d in (eq.get("for_diseases") or [])):
                        price = eq.get("price_inr")
                        if price:
                            ai_total += float(price)
                            ai_count += 1
                for pc in agg.get("personal_care", []):
                    if any(_disease_matches(d, diseases) for d in (pc.get("for_diseases") or [])):
                        price = pc.get("price_inr")
                        if price:
                            ai_total += float(price)
                            ai_count += 1
            curated_total = sum(float(p.get("price") or 0) for p in curated_products)
            product_total = ai_total + curated_total
            product_count = ai_count + len(curated_products)
            if product_total > 0:
                opportunities.append(Opportunity(
                    patient_id=patient_id,
                    patient_name=patient_name,
                    patient_phone=patient_phone,
                    type="product",
                    description=f"{product_count} suggested product(s) — ₹{product_total:,.0f}",
                    priority="low",
                    expected_revenue=float(product_total),
                ).model_dump())

        # ---- 5) Adherence task (revenue=0, kept as alert only) ----
        adherence_rate = patient.get("adherence_rate")
        if adherence_rate is not None and adherence_rate < 70:
            opportunities.append(Opportunity(
                patient_id=patient_id,
                patient_name=patient_name,
                patient_phone=patient_phone,
                type="adherence",
                description=f"Low adherence ({adherence_rate}%) - needs follow-up",
                priority="high",
                expected_revenue=0.0,
            ).model_dump())

    # Clear old pending opportunities and insert new ones
    await db.crm_opportunities.delete_many({"status": "pending"})
    if opportunities:
        await db.crm_opportunities.insert_many(opportunities)

    logger.info(f"[CRM] Generated {len(opportunities)} opportunities for {len(patients)} patients")
    return {"generated": len(opportunities), "patients_scanned": len(patients)}

@router.put("/opportunities/{opportunity_id}", response_model=Dict)
async def update_opportunity(opportunity_id: str, updates: Dict):
    """Update opportunity status."""
    result = await db.crm_opportunities.update_one(
        {"id": opportunity_id},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return {"message": "Opportunity updated"}

# ======================== DASHBOARD ROUTES ========================

@router.get("/dashboard/stats")
async def get_dashboard_stats():
    """Get dashboard statistics. Auto-ensures every main-app user has a CRM profile,
    and auto-generates opportunities on first load so tiles never appear empty."""
    await ensure_all_crm_profiles()

    # Auto-generate opportunities if the DB has none yet
    existing_opp_count = await db.crm_opportunities.count_documents({"status": "pending"})
    if existing_opp_count == 0:
        try:
            await generate_opportunities()
        except Exception as e:
            logger.warning(f"[CRM] Auto-generate opportunities (dashboard) failed: {e}")

    total_patients = await db.crm_patient_profiles.count_documents({})
    high_priority = await db.crm_patient_profiles.count_documents({"priority": "high"})
    
    # Get opportunities stats
    refill_opps = await db.crm_opportunities.count_documents({"type": "refill", "status": "pending"})
    lab_opps = await db.crm_opportunities.count_documents({"type": "lab_test", "status": "pending"})
    product_opps = await db.crm_opportunities.count_documents({"type": "product", "status": "pending"})
    invoice_opps = await db.crm_opportunities.count_documents({"type": "invoice", "status": "pending"})
    adherence_opps = await db.crm_opportunities.count_documents({"type": "adherence", "status": "pending"})
    
    # Calculate expected revenue
    pipeline = [
        {"$match": {"status": "pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$expected_revenue"}}}
    ]
    revenue_result = await db.crm_opportunities.aggregate(pipeline).to_list(1)
    expected_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # Calculate total invoice amounts from patients
    patients = await db.crm_patient_profiles.find({}, {"_id": 0, "medicine_invoice_amount": 1, "injection_invoice_amount": 1, "product_invoice_amount": 1}).to_list(1000)
    total_monthly_invoice = sum(
        (p.get("medicine_invoice_amount", 0) or 0) + (p.get("injection_invoice_amount", 0) or 0) + (p.get("product_invoice_amount", 0) or 0)
        for p in patients
    )
    
    # Get today's tasks
    today_tasks = await db.crm_opportunities.find(
        {"status": "pending", "priority": {"$in": ["high", "medium"]}},
        {"_id": 0}
    ).limit(10).to_list(10)
    
    # Disease distribution
    disease_pipeline = [
        {"$unwind": "$diseases"},
        {"$group": {"_id": "$diseases", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    disease_dist = await db.crm_patient_profiles.aggregate(disease_pipeline).to_list(10)
    
    return {
        "total_patients": total_patients,
        "high_priority_patients": high_priority,
        "opportunities": {
            "refills": refill_opps,
            "lab_tests": lab_opps,
            "products": product_opps,
            "invoices": invoice_opps,
            "adherence": adherence_opps
        },
        "expected_revenue": expected_revenue,
        "total_monthly_invoice": total_monthly_invoice,
        "today_tasks": today_tasks,
        "disease_distribution": [{"disease": d["_id"], "count": d["count"]} for d in disease_dist]
    }


@router.get("/patients/{patient_id}/monthly-invoice-amount")
async def get_patient_monthly_invoice_amount(patient_id: str):
    """System-computed Monthly Medicine Invoice Amount for a patient.

    Mirrors the same logic used by the unified PM Invoice Creator
    (sum of qty × cost_per_unit across all medications flagged
    `include_in_invoice`). Used by the CRM "Create Medicine Invoice"
    section to display the auto-computed monthly amount and also to
    record Converted Revenue when HA generates the monthly invoice.
    """
    patient = await db.crm_patient_profiles.find_one({"id": patient_id}, {"_id": 0, "name": 1})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    from routes.invoice_delivery import compute_monthly_medicine_invoice_total
    amount = await compute_monthly_medicine_invoice_total(patient_id)
    return {"patient_id": patient_id, "amount": amount}


@router.post("/patients/{patient_id}/revenue/convert")
async def record_conversion_endpoint(patient_id: str, data: Dict):
    """Record a converted-revenue event (e.g. product invoice confirmed, medicine refill invoiced).

    Body:
        category: 'invoice_followup' | 'lab_test'
        source: 'product_invoice' | 'medicine_refill' | 'lab_booking' | custom
        amount: float
        description: str (optional)
    """
    patient = await db.crm_patient_profiles.find_one({"id": patient_id}, {"_id": 0, "name": 1})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    category = (data.get("category") or "").strip()
    source = (data.get("source") or "").strip()
    try:
        amount = float(data.get("amount", 0))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="amount must be numeric")

    if category not in ("invoice_followup", "lab_test"):
        raise HTTPException(status_code=400, detail="category must be invoice_followup or lab_test")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be > 0")
    if not source:
        raise HTTPException(status_code=400, detail="source is required")

    doc = await record_revenue_conversion(
        patient_id=patient_id,
        patient_name=patient.get("name", ""),
        category=category,
        source=source,
        amount=amount,
        description=data.get("description", ""),
    )
    return doc


@router.get("/patients/{patient_id}/revenue/mtd")
async def get_patient_mtd_revenue(patient_id: str, month: Optional[str] = None):
    """Return Month-to-Date Converted Revenue for a single patient, plus last-month trend.

    Response:
      { month, total, count, by_category, previous: { month, total }, trend: { direction, percent } }
    """
    patient = await db.crm_patient_profiles.find_one({"id": patient_id}, {"_id": 0, "name": 1})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    now = datetime.now(timezone.utc)
    if not month:
        month = now.strftime("%Y-%m")

    # Compute previous month string (YYYY-MM)
    try:
        year, mon = [int(p) for p in month.split("-")]
        prev_year = year - 1 if mon == 1 else year
        prev_mon = 12 if mon == 1 else mon - 1
        prev_month = f"{prev_year:04d}-{prev_mon:02d}"
    except Exception:
        prev_month = ""

    # Current month aggregation
    by_category = {"invoice_followup": 0.0, "lab_test": 0.0}
    count = 0
    cursor = db.crm_revenue_conversions.find(
        {"patient_id": patient_id, "month": month},
        {"_id": 0, "category": 1, "amount": 1},
    )
    async for c in cursor:
        cat = c.get("category")
        if cat in by_category:
            by_category[cat] += float(c.get("amount", 0) or 0)
        count += 1
    total = round(sum(by_category.values()), 2)

    # Previous month total
    prev_total = 0.0
    if prev_month:
        prev_cursor = db.crm_revenue_conversions.find(
            {"patient_id": patient_id, "month": prev_month},
            {"_id": 0, "amount": 1},
        )
        async for c in prev_cursor:
            prev_total += float(c.get("amount", 0) or 0)
        prev_total = round(prev_total, 2)

    # Trend calculation
    if prev_total <= 0 and total <= 0:
        direction, percent = "flat", 0.0
    elif prev_total <= 0 and total > 0:
        direction, percent = "new", 0.0  # first conversion ever for this patient this month
    else:
        delta = total - prev_total
        percent = round((delta / prev_total) * 100, 1)
        if delta > 0:
            direction = "up"
        elif delta < 0:
            direction = "down"
        else:
            direction = "flat"

    return {
        "month": month,
        "total": total,
        "count": count,
        "by_category": {
            "invoice_followup": round(by_category["invoice_followup"], 2),
            "lab_test": round(by_category["lab_test"], 2),
        },
        "previous": {
            "month": prev_month,
            "total": prev_total,
        },
        "trend": {
            "direction": direction,  # up | down | flat | new
            "percent": percent,
        },
    }


@router.get("/dashboard/revenue-summary")
async def get_revenue_summary(month: Optional[str] = None):
    """Return Expected vs Converted revenue for the given month (YYYY-MM, default = current).

    Expected = sum(expected_revenue) of pending opportunities, split by Revenue Category.
    Converted = sum(amount) of revenue_conversions documents whose month matches, split by category.
    """
    if not month:
        month = datetime.now(timezone.utc).strftime("%Y-%m")

    # --- Expected (from pending opportunities, grouped into parent category) ---
    expected_by_cat = {"invoice_followup": 0.0, "lab_test": 0.0}
    pending_opps = await db.crm_opportunities.find(
        {"status": "pending"}, {"_id": 0, "type": 1, "expected_revenue": 1}
    ).to_list(5000)
    for opp in pending_opps:
        cat = get_revenue_category(opp.get("type"))
        if cat in expected_by_cat:
            expected_by_cat[cat] += float(opp.get("expected_revenue", 0) or 0)

    # --- Converted (from revenue_conversions for the month) ---
    converted_by_cat = {"invoice_followup": 0.0, "lab_test": 0.0}
    conv_cursor = db.crm_revenue_conversions.find(
        {"month": month}, {"_id": 0, "category": 1, "amount": 1}
    )
    async for c in conv_cursor:
        cat = c.get("category")
        if cat in converted_by_cat:
            converted_by_cat[cat] += float(c.get("amount", 0) or 0)

    expected_total = round(sum(expected_by_cat.values()), 2)
    converted_total = round(sum(converted_by_cat.values()), 2)
    denom = expected_total + converted_total
    conversion_rate = round((converted_total / denom) * 100, 1) if denom > 0 else 0.0

    return {
        "month": month,
        "expected": {
            "invoice_followup": round(expected_by_cat["invoice_followup"], 2),
            "lab_test": round(expected_by_cat["lab_test"], 2),
            "total": expected_total,
        },
        "converted": {
            "invoice_followup": round(converted_by_cat["invoice_followup"], 2),
            "lab_test": round(converted_by_cat["lab_test"], 2),
            "total": converted_total,
        },
        "conversion_rate": conversion_rate,
    }


@router.get("/reports/lab-reconciliation")
async def get_lab_reconciliation(
    period: str = "month",
    month: Optional[str] = None,
    year: Optional[int] = None,
):
    """Lab-test reconciliation with lab-wise / test-wise / disease-wise breakdowns.

    Query params:
        period: 'month' (default) or 'ytd'
        month:  YYYY-MM (used when period='month'; default = current month)
        year:   YYYY (used when period='ytd'; default = current year)

    Response:
        {
          period, month, year, range: { start, end },
          totals: { count, amount },
          by_lab: [ {label, count, amount} ],
          by_test: [ {label, count, amount, diseases} ],
          by_disease: [ {label, count, amount} ]
        }
    """
    now = datetime.now(timezone.utc)
    period = (period or "month").lower()

    if period == "ytd":
        yr = int(year) if year else now.year
        start_str = f"{yr:04d}-01-01"
        end_str = f"{yr:04d}-12-31"
        label_month = None
        label_year = yr
    else:
        m = month or now.strftime("%Y-%m")
        try:
            y, mo = [int(p) for p in m.split("-")]
        except Exception:
            raise HTTPException(status_code=400, detail="month must be YYYY-MM")
        # Month range
        start_str = f"{y:04d}-{mo:02d}-01"
        # End = first day next month minus 1 day
        if mo == 12:
            next_y, next_mo = y + 1, 1
        else:
            next_y, next_mo = y, mo + 1
        end_dt = datetime(next_y, next_mo, 1) - timedelta(days=1)
        end_str = end_dt.strftime("%Y-%m-%d")
        label_month = m
        label_year = y

    # Lookup test -> diseases via catalog (supports custom tests too via DB)
    test_disease_map: Dict[str, List[str]] = {
        t["name"]: t.get("diseases", []) for t in LAB_TEST_CATALOG
    }
    custom_tests = await db.crm_custom_lab_tests.find({}, {"_id": 0, "name": 1, "diseases": 1}).to_list(1000) \
        if "custom_lab_tests" in await db.list_collection_names() else []
    for ct in custom_tests:
        if ct.get("name") and ct["name"] not in test_disease_map:
            test_disease_map[ct["name"]] = ct.get("diseases", []) or []

    # Patient diseases fallback for custom tests without catalog mapping
    patients_rows = await db.crm_patient_profiles.find({}, {"_id": 0, "id": 1, "diseases": 1}).to_list(5000)
    patient_diseases: Dict[str, List[str]] = {p["id"]: p.get("diseases", []) or [] for p in patients_rows}

    # Pull bookings; booked_date is canonicalized to 'YYYY-MM-DD' by validator + startup migration
    bookings = await db.crm_lab_bookings.find({}, {"_id": 0}).to_list(5000)

    def booking_date_str(b: Dict[str, Any]) -> str:
        raw = b.get("booked_date") or b.get("created_at") or ""
        return str(raw).split("T", 1)[0]

    # Filter by range (string comparison works on YYYY-MM-DD)
    filtered = [
        b for b in bookings
        if start_str <= booking_date_str(b) <= end_str
    ]

    totals = {"count": 0, "amount": 0.0}
    by_lab: Dict[str, Dict[str, float]] = {}
    by_test: Dict[str, Dict[str, Any]] = {}
    by_disease: Dict[str, Dict[str, float]] = {}

    for b in filtered:
        amt = float(b.get("price", 0) or 0)
        lab = (b.get("lab_name") or "Unknown Lab").strip() or "Unknown Lab"
        test = (b.get("test_name") or "Unknown Test").strip() or "Unknown Test"
        pid = b.get("patient_id")

        totals["count"] += 1
        totals["amount"] += amt

        lab_row = by_lab.setdefault(lab, {"count": 0, "amount": 0.0})
        lab_row["count"] += 1
        lab_row["amount"] += amt

        test_row = by_test.setdefault(test, {"count": 0, "amount": 0.0, "diseases": set()})
        test_row["count"] += 1
        test_row["amount"] += amt

        # Disease attribution: catalog map, else patient diseases
        diseases = test_disease_map.get(test) or patient_diseases.get(pid) or ["Uncategorised"]
        for d in diseases:
            test_row["diseases"].add(d)
            d_row = by_disease.setdefault(d, {"count": 0, "amount": 0.0})
            d_row["count"] += 1
            d_row["amount"] += amt

    def sort_rows(d: Dict[str, Dict[str, Any]], with_diseases: bool = False):
        out = []
        for label, row in d.items():
            item = {
                "label": label,
                "count": row["count"],
                "amount": round(row["amount"], 2),
            }
            if with_diseases:
                item["diseases"] = sorted(row.get("diseases", []))
            out.append(item)
        out.sort(key=lambda x: (-x["amount"], -x["count"], x["label"]))
        return out

    return {
        "period": period,
        "month": label_month,
        "year": label_year,
        "range": {"start": start_str, "end": end_str},
        "totals": {"count": totals["count"], "amount": round(totals["amount"], 2)},
        "by_lab": sort_rows(by_lab),
        "by_test": sort_rows(by_test, with_diseases=True),
        "by_disease": sort_rows(by_disease),
    }


@router.get("/reports/lab-reconciliation/details")
async def get_lab_reconciliation_details(
    group_by: str,
    value: str,
    period: str = "month",
    month: Optional[str] = None,
    year: Optional[int] = None,
):
    """Return all lab-booking records matching a specific group (lab|test|disease) + value,
    within the same period as the parent reconciliation report.
    """
    if group_by not in ("lab", "test", "disease"):
        raise HTTPException(status_code=400, detail="group_by must be lab|test|disease")
    if not value:
        raise HTTPException(status_code=400, detail="value is required")

    now = datetime.now(timezone.utc)
    period = (period or "month").lower()

    if period == "ytd":
        yr = int(year) if year else now.year
        start_str = f"{yr:04d}-01-01"
        end_str = f"{yr:04d}-12-31"
    else:
        m = month or now.strftime("%Y-%m")
        try:
            y, mo = [int(p) for p in m.split("-")]
        except Exception:
            raise HTTPException(status_code=400, detail="month must be YYYY-MM")
        start_str = f"{y:04d}-{mo:02d}-01"
        if mo == 12:
            next_y, next_mo = y + 1, 1
        else:
            next_y, next_mo = y, mo + 1
        end_dt = datetime(next_y, next_mo, 1) - timedelta(days=1)
        end_str = end_dt.strftime("%Y-%m-%d")

    test_disease_map: Dict[str, List[str]] = {
        t["name"]: t.get("diseases", []) for t in LAB_TEST_CATALOG
    }
    patients_rows = await db.crm_patient_profiles.find({}, {"_id": 0, "id": 1, "name": 1, "diseases": 1}).to_list(5000)
    patient_map: Dict[str, Dict[str, Any]] = {p["id"]: p for p in patients_rows}

    bookings = await db.crm_lab_bookings.find({}, {"_id": 0}).to_list(5000)

    def booking_date_str(b: Dict[str, Any]) -> str:
        raw = b.get("booked_date") or b.get("created_at") or ""
        return str(raw).split("T", 1)[0]

    result = []
    total_amount = 0.0
    for b in bookings:
        d = booking_date_str(b)
        if not (start_str <= d <= end_str):
            continue
        lab = (b.get("lab_name") or "Unknown Lab").strip() or "Unknown Lab"
        test = (b.get("test_name") or "Unknown Test").strip() or "Unknown Test"
        pid = b.get("patient_id")
        diseases = test_disease_map.get(test) or (patient_map.get(pid) or {}).get("diseases") or ["Uncategorised"]

        matches = False
        if group_by == "lab" and lab == value:
            matches = True
        elif group_by == "test" and test == value:
            matches = True
        elif group_by == "disease" and value in diseases:
            matches = True
        if not matches:
            continue

        amt = float(b.get("price", 0) or 0)
        total_amount += amt
        result.append({
            "id": b.get("id"),
            "patient_id": pid,
            "patient_name": (patient_map.get(pid) or {}).get("name") or "Unknown",
            "test_name": test,
            "lab_name": lab,
            "booked_date": d,
            "scheduled_time": b.get("scheduled_time"),
            "price": amt,
            "status": b.get("status") or "booked",
            "source": b.get("source") or "",
            "diseases": diseases,
        })

    result.sort(key=lambda r: (r["booked_date"], r["patient_name"]), reverse=True)

    return {
        "group_by": group_by,
        "value": value,
        "period": period,
        "range": {"start": start_str, "end": end_str},
        "count": len(result),
        "total_amount": round(total_amount, 2),
        "bookings": result,
    }


@router.get("/dashboard/patients-to-call")
async def get_patients_to_call():
    """Daily task list for callers — individual entries with statuses.
    Sources: 1) Follow-ups scheduled today, 2) Pending opportunities, 3) No contact 30+ days.
    Statuses: pending, completed, upcoming, overdue.
    """
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    now_time_str = now.strftime("%H:%M")
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    entries = []

    all_patients = await db.crm_patient_profiles.find(
        {}, {"_id": 0, "id": 1, "name": 1, "interactions": 1, "priority": 1}
    ).to_list(500)

    patient_map = {p["id"]: p for p in all_patients}

    # Helper: check if patient has any interaction logged today AFTER a given timestamp
    def has_later_interaction_today(interactions, after_created_at):
        for inter in interactions:
            created = inter.get("created_at", "")
            if created > after_created_at and created[:10] == today_str[:10]:
                return True
        return False

    def has_any_interaction_today(interactions):
        for inter in interactions:
            created = inter.get("created_at", "")
            if created[:10] == today_str[:10]:
                return True
        return False

    # --- Source 1: Follow-up entries (each follow-up = separate entry) ---
    for p in all_patients:
        interactions = p.get("interactions", [])
        for inter in interactions:
            if inter.get("follow_up_date") == today_str:
                fu_time = inter.get("follow_up_time", "09:00")
                created_at = inter.get("created_at", "")

                if has_later_interaction_today(interactions, created_at):
                    status = "completed"
                elif fu_time > now_time_str:
                    status = "upcoming"
                else:
                    status = "overdue"

                entries.append({
                    "id": inter.get("id", created_at),
                    "patient_id": p["id"],
                    "patient_name": p["name"],
                    "status": status,
                    "task_type": "follow_up",
                    "description": f"Scheduled follow-up at {fu_time}",
                    "follow_up_time": fu_time,
                    "revenue": 0,
                    "priority": p.get("priority", "medium"),
                })

    # --- Source 2: Opportunity entries ---
    opportunities = await db.crm_opportunities.find(
        {"status": "pending"}, {"_id": 0}
    ).to_list(200)

    for opp in opportunities:
        pid = opp["patient_id"]
        p = patient_map.get(pid)
        interactions = p.get("interactions", []) if p else []
        contacted_today = has_any_interaction_today(interactions)

        entries.append({
            "id": opp.get("id", ""),
            "patient_id": pid,
            "patient_name": opp["patient_name"],
            "status": "completed" if contacted_today else "pending",
            "task_type": "opportunity",
            "description": opp["description"],
            "follow_up_time": None,
            "revenue": opp.get("expected_revenue", 0),
            "priority": opp.get("priority", "medium"),
        })

    # --- Source 3: No contact in 30+ days ---
    patients_with_entries = set(e["patient_id"] for e in entries)
    for p in all_patients:
        pid = p["id"]
        if pid in patients_with_entries:
            continue
        interactions = p.get("interactions", [])
        if not interactions:
            entries.append({
                "id": f"nc-{pid}",
                "patient_id": pid,
                "patient_name": p["name"],
                "status": "pending",
                "task_type": "no_contact",
                "description": "No interactions recorded",
                "follow_up_time": None,
                "revenue": 0,
                "priority": p.get("priority", "low"),
            })
        else:
            last_date = max(i.get("created_at", "") for i in interactions)
            if last_date and last_date < thirty_days_ago:
                contacted_today = has_any_interaction_today(interactions)
                entries.append({
                    "id": f"nc-{pid}",
                    "patient_id": pid,
                    "patient_name": p["name"],
                    "status": "completed" if contacted_today else "pending",
                    "task_type": "no_contact",
                    "description": f"Last contacted {last_date[:10]}",
                    "follow_up_time": None,
                    "revenue": 0,
                    "priority": p.get("priority", "low"),
                })

    # --- Source 4: Doctor appointments today + 3-month overdue ---
    three_months_ago = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")
    today_appointments = await db.appointments.find(
        {"date": today_str, "status": "upcoming"}, {"_id": 0}
    ).to_list(100)

    for apt in today_appointments:
        pid = apt.get("user_id") or apt.get("patient_id")
        p = patient_map.get(pid)
        pname = p["name"] if p else apt.get("patient_name", "Unknown")
        entries.append({
            "id": apt["id"],
            "patient_id": pid,
            "patient_name": pname,
            "status": "upcoming",
            "task_type": "doctor_appointment",
            "description": f"Dr. {apt.get('doctor', 'N/A')} at {apt.get('hospital', apt.get('location', 'N/A'))} — {apt.get('time', '')}",
            "follow_up_time": apt.get("time"),
            "revenue": 0,
            "priority": p.get("priority", "medium") if p else "medium",
        })

    # 3-month overdue doctor visits — flag as high priority + add to list
    for p in all_patients:
        pid = p["id"]
        last_done = await db.appointments.find_one(
            {"user_id": pid, "status": "done"}, {"_id": 0, "date": 1},
            sort=[("date", -1)]
        )
        is_overdue = False
        if last_done and last_done["date"] < three_months_ago:
            is_overdue = True
        elif not last_done:
            # Check if patient has ANY appointments at all
            any_appt = await db.appointments.find_one({"user_id": pid}, {"_id": 0, "id": 1})
            if any_appt:
                is_overdue = True

        if is_overdue:
            # Auto-flag as high priority
            await db.crm_patient_profiles.update_one({"id": pid}, {"$set": {"priority": "high"}})
            # Add entry if not already in list from other sources
            already_has_appt_entry = any(e["patient_id"] == pid and e["task_type"] == "doctor_appointment" for e in entries)
            if not already_has_appt_entry:
                entries.append({
                    "id": f"doc-overdue-{pid}",
                    "patient_id": pid,
                    "patient_name": p["name"],
                    "status": "overdue",
                    "task_type": "doctor_visit_overdue",
                    "description": f"Last doctor visit: {last_done['date'] if last_done else 'Never'} (3+ months ago)",
                    "follow_up_time": None,
                    "revenue": 0,
                    "priority": "high",
                })

    # --- Source 5: Post-visit feedback calls ---
    # All past appointments (any status) and lab bookings where date < today.
    # Persist until HA logs an interaction AFTER the appointment date.
    yesterday_str = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    # Build interaction lookup: for each patient, list of interaction dates
    patient_interaction_dates = {}
    for p in all_patients:
        pid = p["id"]
        interactions = p.get("interactions", [])
        dates = [i.get("created_at", "")[:10] for i in interactions if i.get("created_at")]
        patient_interaction_dates[pid] = dates

    # Doctor appointments where date has passed (date < today)
    past_appts = await db.appointments.find(
        {"date": {"$lt": today_str}}, {"_id": 0}
    ).to_list(500)

    feedback_patient_ids = set()
    for apt in past_appts:
        pid = apt.get("user_id")
        p = patient_map.get(pid)
        if not p:
            continue
        appt_date = apt["date"]
        # Day after appointment is when feedback is expected
        feedback_due_date = (datetime.strptime(appt_date, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
        # Check if HA logged an interaction on or after the feedback due date
        interaction_dates = patient_interaction_dates.get(pid, [])
        has_followup = any(d >= feedback_due_date for d in interaction_dates)

        days_since = (datetime.now() - datetime.strptime(appt_date, "%Y-%m-%d")).days
        day_label = "yesterday" if days_since == 1 else f"{days_since} days ago"

        entries.append({
            "id": f"feedback-appt-{apt['id']}",
            "patient_id": pid,
            "patient_name": p["name"],
            "status": "completed" if has_followup else "pending",
            "task_type": "feedback_call",
            "description": f"Feedback: {apt.get('title','Doctor visit')} with {apt.get('doctor','Dr.')} ({day_label})",
            "follow_up_time": None,
            "revenue": 0,
            "priority": p.get("priority", "medium"),
        })
        feedback_patient_ids.add(pid)

    # Lab test bookings where date has passed (booked_date < today)
    past_lab_tests = await db.crm_lab_bookings.find(
        {"booked_date": {"$lt": today_str}}, {"_id": 0}
    ).to_list(500)

    for lt in past_lab_tests:
        pid = lt.get("patient_id")
        p = patient_map.get(pid)
        if not p:
            continue
        booked_date_raw = lt.get("booked_date", "")
        if not booked_date_raw:
            continue
        # booked_date is canonicalized to 'YYYY-MM-DD' by validator + startup migration
        # (defensive split kept for resilience against any stray legacy data)
        booked_date = str(booked_date_raw).split("T", 1)[0]
        try:
            booked_dt = datetime.strptime(booked_date, "%Y-%m-%d")
        except ValueError:
            continue
        feedback_due_date = (booked_dt + timedelta(days=1)).strftime("%Y-%m-%d")
        interaction_dates = patient_interaction_dates.get(pid, [])
        has_followup = any(d >= feedback_due_date for d in interaction_dates)

        days_since = (datetime.now() - booked_dt).days
        day_label = "yesterday" if days_since == 1 else f"{days_since} days ago"

        entries.append({
            "id": f"feedback-lab-{lt.get('id', pid)}",
            "patient_id": pid,
            "patient_name": p["name"],
            "status": "completed" if has_followup else "pending",
            "task_type": "feedback_call",
            "description": f"Feedback: {lt.get('test_name','Lab test')} ({day_label})",
            "follow_up_time": None,
            "revenue": 0,
            "priority": p.get("priority", "medium"),
        })

    # Sort: overdue first, then upcoming, pending, completed last
    status_order = {"overdue": 0, "upcoming": 1, "pending": 2, "completed": 3}
    priority_order = {"high": 0, "medium": 1, "low": 2}
    entries.sort(key=lambda x: (
        status_order.get(x["status"], 4),
        priority_order.get(x["priority"], 3),
        x.get("follow_up_time") or "99:99",
        -x["revenue"]
    ))

    return entries


@router.get("/dashboard/patients-to-call-grouped")
async def get_patients_to_call_grouped():
    """Daily Task List aggregated at CUSTOMER level — ONE entry per patient regardless of task count.
    Returns: [{patient_id, patient_name, phone, priority, task_counts, total_tasks,
               expected_revenue, next_action_time, overall_status, task_types}]
    task_counts: {refill, lab_test, product, adherence, invoice, follow_up, doctor_appointment,
                  feedback_call, no_contact, onboarding}
    """
    entries = await get_patients_to_call()

    groups: Dict[str, Dict[str, Any]] = {}
    status_rank = {"overdue": 0, "pending": 1, "upcoming": 2, "completed": 3}

    for e in entries:
        pid = e.get("patient_id")
        if not pid:
            continue
        if pid not in groups:
            groups[pid] = {
                "patient_id": pid,
                "patient_name": e.get("patient_name", "Unknown"),
                "phone": None,
                "priority": e.get("priority", "medium"),
                "task_counts": {},
                "total_tasks": 0,
                "expected_revenue": 0.0,
                "next_action_time": None,
                "overall_status": e.get("status", "pending"),
                "task_types": set(),
                "revenue_by_category": {},
            }
        g = groups[pid]
        # only count tasks that still need action (pending / overdue / upcoming)
        if e.get("status") != "completed":
            t = e.get("task_type", "other")
            g["task_counts"][t] = g["task_counts"].get(t, 0) + 1
            g["total_tasks"] += 1
            g["task_types"].add(t)
            rev = float(e.get("revenue") or 0)
            g["expected_revenue"] += rev
            if rev > 0:
                g["revenue_by_category"][t] = g["revenue_by_category"].get(t, 0) + rev
            # earliest action time
            if e.get("follow_up_time"):
                if not g["next_action_time"] or e["follow_up_time"] < g["next_action_time"]:
                    g["next_action_time"] = e["follow_up_time"]
            # worst (most urgent) status wins
            if status_rank.get(e.get("status"), 99) < status_rank.get(g["overall_status"], 99):
                g["overall_status"] = e["status"]
        # highest priority for the patient wins
        pr = {"high": 0, "medium": 1, "low": 2}
        if pr.get(e.get("priority", "medium"), 3) < pr.get(g["priority"], 3):
            g["priority"] = e["priority"]

    # Enrich with phone numbers from profiles
    if groups:
        phones = await db.crm_patient_profiles.find(
            {"id": {"$in": list(groups.keys())}}, {"_id": 0, "id": 1, "phone": 1}
        ).to_list(len(groups))
        phone_map = {p["id"]: p.get("phone") for p in phones}
        for pid, g in groups.items():
            g["phone"] = phone_map.get(pid)
            g["task_types"] = sorted(g["task_types"])

    # Only keep patients that have pending/actionable tasks, sort by overall urgency
    result = [g for g in groups.values() if g["total_tasks"] > 0]
    pr_order = {"high": 0, "medium": 1, "low": 2}
    result.sort(key=lambda g: (
        status_rank.get(g["overall_status"], 4),
        pr_order.get(g["priority"], 3),
        -g["total_tasks"],
        -g["expected_revenue"],
    ))
    return result


@router.get("/patients/{patient_id}/pending-tasks")
async def get_patient_pending_tasks(patient_id: str):
    """All pending tasks for a single patient — for the PatientDetail Tasks tab.
    Each task is checkbox-togglable via POST /patients/{id}/tasks/toggle.
    """
    all_entries = await get_patients_to_call()
    tasks = [e for e in all_entries if e.get("patient_id") == patient_id and e.get("status") != "completed"]

    # Also include onboarding if the patient qualifies
    profile = await db.crm_patient_profiles.find_one({"id": patient_id}, {"_id": 0})
    if profile:
        needs_onboard = (
            not profile.get("diseases") or
            not profile.get("consulting_doctor_name") or
            not profile.get("last_doctor_visit_date")
        )
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        if needs_onboard and profile.get("created_at", "") >= cutoff:
            tasks.append({
                "id": f"onboarding-{patient_id}",
                "patient_id": patient_id,
                "patient_name": profile.get("name", ""),
                "status": "pending",
                "task_type": "onboarding",
                "description": "Complete onboarding (diseases / doctor / last visit)",
                "follow_up_time": None,
                "revenue": 0,
                "priority": "medium",
            })

    return tasks


class TaskToggle(BaseModel):
    task_id: str
    task_type: str
    done: bool = True


@router.post("/patients/{patient_id}/tasks/toggle")
async def toggle_patient_task(patient_id: str, data: TaskToggle):
    """Mark a task done/undone. Supports opportunity, follow_up, no_contact, feedback_call, doctor_appointment, onboarding.
    For opportunity-type tasks, updates crm_opportunities.status. For interaction-based ones, appends a quick
    interaction record so the task falls off the Daily List automatically."""
    t_type = (data.task_type or "").lower()
    now_iso = datetime.now(timezone.utc).isoformat()

    if t_type == "opportunity":
        new_status = "converted" if data.done else "pending"
        result = await db.crm_opportunities.update_one(
            {"id": data.task_id, "patient_id": patient_id},
            {"$set": {"status": new_status, "completed_at": now_iso if data.done else None}},
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        return {"message": "Task updated", "task_type": t_type, "done": data.done}

    if t_type in ("follow_up", "no_contact", "feedback_call"):
        # Record a lightweight interaction so the daily generator excludes this task today onward
        interaction = {
            "id": str(uuid.uuid4()),
            "type": "task_done",
            "notes": f"Marked '{t_type}' task {data.task_id} done via CRM dashboard",
            "created_at": now_iso,
        }
        await db.crm_patient_profiles.update_one(
            {"id": patient_id},
            {"$push": {"interactions": interaction}, "$set": {"last_contact": now_iso, "updated_at": now_iso}},
        )
        return {"message": "Task marked done via interaction log", "interaction_id": interaction["id"]}

    if t_type == "doctor_appointment":
        new_status = "done" if data.done else "upcoming"
        await db.appointments.update_one(
            {"id": data.task_id, "user_id": patient_id},
            {"$set": {"status": new_status}},
        )
        return {"message": "Appointment status updated", "status": new_status}

    if t_type == "onboarding":
        # Onboarding is marked done implicitly when the Edit Profile fields are filled;
        # here we just note it so the dashboard card hides it for today.
        interaction = {
            "id": str(uuid.uuid4()),
            "type": "onboarding_acknowledged",
            "notes": "Onboarding task acknowledged",
            "created_at": now_iso,
        }
        await db.crm_patient_profiles.update_one(
            {"id": patient_id},
            {"$push": {"interactions": interaction}, "$set": {"updated_at": now_iso}},
        )
        return {"message": "Onboarding acknowledged"}

    # Catch-all for other task types (doctor_visit_overdue, refill, lab_test, product, adherence,
    # invoice, etc.) — record a generic "task_done" interaction so the task suppresses itself
    # for today. Keeps the checkbox UX consistent regardless of task source.
    interaction = {
        "id": str(uuid.uuid4()),
        "type": "task_done",
        "notes": f"Marked '{t_type}' task {data.task_id} done via CRM dashboard",
        "created_at": now_iso,
    }
    await db.crm_patient_profiles.update_one(
        {"id": patient_id},
        {"$push": {"interactions": interaction}, "$set": {"last_contact": now_iso, "updated_at": now_iso}},
    )
    return {"message": f"Task '{t_type}' marked done via interaction log", "interaction_id": interaction["id"]}


# ======================== CATALOG ROUTES ========================

@router.get("/catalog/products")
async def get_product_catalog():
    """Get the full product catalog."""
    return PRODUCT_CATALOG

@router.get("/catalog/lab-tests")
async def get_lab_test_catalog():
    """Get the full lab test catalog — merges built-in + custom tests from DB."""
    custom_tests = await db.crm_custom_lab_tests.find({}, {"_id": 0}).to_list(500)
    
    # Start with built-in catalog, apply any price overrides from DB
    overrides = await db.crm_lab_test_overrides.find({}, {"_id": 0}).to_list(500)
    override_map = {o["test_name"]: o for o in overrides}
    
    merged = []
    for test in LAB_TEST_CATALOG:
        t = {**test, "source": "auto"}
        if test["name"] in override_map:
            t["price"] = override_map[test["name"]]["price"]
        merged.append(t)
    
    for ct in custom_tests:
        ct["source"] = "custom"
        merged.append(ct)
    
    return merged

@router.post("/catalog/lab-tests")
async def add_custom_lab_test(data: Dict):
    """Add a custom lab test to the catalog."""
    test = {
        "id": str(uuid.uuid4()),
        "name": data["name"],
        "diseases": data.get("diseases", []),
        "frequency_months": data.get("frequency_months", 6),
        "price": data.get("price", 0),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.crm_custom_lab_tests.insert_one(test)
    return {k: v for k, v in test.items() if k != "_id"}

@router.put("/catalog/lab-tests/{test_name}/price")
async def update_lab_test_price(test_name: str, data: Dict):
    """Update the price of any lab test (built-in or custom)."""
    new_price = data.get("price")
    if new_price is None:
        raise HTTPException(status_code=400, detail="price is required")
    
    # Check if it's a custom test
    result = await db.crm_custom_lab_tests.update_one(
        {"name": test_name},
        {"$set": {"price": new_price}}
    )
    if result.matched_count > 0:
        return {"message": "Custom test price updated"}
    
    # Check if it's a built-in test — store override
    if any(t["name"] == test_name for t in LAB_TEST_CATALOG):
        await db.crm_lab_test_overrides.update_one(
            {"test_name": test_name},
            {"$set": {"test_name": test_name, "price": new_price}},
            upsert=True
        )
        return {"message": "Test price updated"}
    
    raise HTTPException(status_code=404, detail="Lab test not found")

@router.put("/catalog/lab-tests/{test_id}")
async def update_custom_lab_test(test_id: str, data: Dict):
    """Update a custom lab test."""
    updates = {}
    for key in ["name", "diseases", "frequency_months", "price"]:
        if key in data:
            updates[key] = data[key]
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.crm_custom_lab_tests.update_one({"id": test_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Custom lab test not found")
    return {"message": "Lab test updated"}

@router.delete("/catalog/lab-tests/{test_id}")
async def delete_custom_lab_test(test_id: str):
    """Delete a custom lab test."""
    result = await db.crm_custom_lab_tests.delete_one({"id": test_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Custom lab test not found")
    return {"message": "Lab test deleted"}

# ======================== LABORATORIES ========================

@router.get("/laboratories")
async def get_laboratories():
    """Get all laboratories."""
    labs = await db.crm_laboratories.find({}, {"_id": 0}).to_list(500)
    return labs

@router.post("/laboratories")
async def add_laboratory(data: Dict):
    """Add a new laboratory."""
    lab = {
        "id": str(uuid.uuid4()),
        "name": data["name"],
        "address": data.get("address", ""),
        "city": data.get("city", ""),
        "state": data.get("state", ""),
        "pincode": data.get("pincode", ""),
        "phone": data.get("phone", ""),
        "email": data.get("email", ""),
        "tests_available": data.get("tests_available", []),
        "notes": data.get("notes", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.crm_laboratories.insert_one(lab)
    return {k: v for k, v in lab.items() if k != "_id"}

@router.put("/laboratories/{lab_id}")
async def update_laboratory(lab_id: str, data: Dict):
    """Update a laboratory."""
    updates = {}
    for key in ["name", "address", "city", "state", "pincode", "phone", "email", "tests_available", "notes"]:
        if key in data:
            updates[key] = data[key]
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.crm_laboratories.update_one({"id": lab_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Laboratory not found")
    return {"message": "Laboratory updated"}

@router.delete("/laboratories/{lab_id}")
async def delete_laboratory(lab_id: str):
    """Delete a laboratory."""
    result = await db.crm_laboratories.delete_one({"id": lab_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Laboratory not found")
    return {"message": "Laboratory deleted"}

# ======================== MEDICINE ANALYSIS ========================

@router.post("/medicine/analyze")
async def analyze_medicine(medicine_name: str = Query(...)):
    """Analyze a medicine name and detect associated diseases."""
    detected = []
    name_lower = medicine_name.lower()
    for key, diseases in MEDICINE_DISEASE_MAP.items():
        if key in name_lower:
            detected.extend(diseases)
    detected = list(set(detected))
    
    products = get_product_suggestions(detected) if detected else []
    lab_tests = await get_lab_test_suggestions_with_custom(detected) if detected else []
    
    return {
        "medicine": medicine_name,
        "detected_diseases": detected,
        "suggested_products": products[:5],
        "suggested_lab_tests": lab_tests[:10]
    }


@router.get("/patients/{patient_id}/invoices")
async def list_patient_invoices(patient_id: str):
    """Consolidated invoice + order history for a patient (used by the
    'Invoices & Orders' tab in the Patient Profile)."""
    profile = await db.crm_patient_profiles.find_one({"id": patient_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Match invoices on email OR phone (covers manual/CRM-created invoices that may
    # not always have the patient's email populated).
    or_clauses = []
    email = (profile.get("email") or "").strip()
    phone = (profile.get("phone") or "").strip()
    if email:
        or_clauses.append({"customer_details.email": email})
    if phone:
        or_clauses.append({"customer_details.phone": phone})

    invoices = []
    if or_clauses:
        invoices = await db.inv_invoices.find(
            {"$or": or_clauses}, {"_id": 0}
        ).sort("created_at", -1).to_list(200)

    return {
        "order_links": {
            "medicine_order_link": profile.get("medicine_order_link", ""),
            "medicine_invoice_link": profile.get("medicine_invoice_link", ""),
            "medicine_invoice_amount": profile.get("medicine_invoice_amount"),
            "injection_order_link": profile.get("injection_order_link", ""),
            "injection_invoice_link": profile.get("injection_invoice_link", ""),
            "injection_invoice_amount": profile.get("injection_invoice_amount"),
            "product_order_link": profile.get("product_order_link", ""),
            "product_invoice_link": profile.get("product_invoice_link", ""),
            "product_invoice_amount": profile.get("product_invoice_amount"),
        },
        "invoices": invoices,
        "invoice_count": len(invoices),
    }


# ======================== ONBOARDING PROFILE ========================

@router.get("/patients/{patient_id}/onboarding")
async def get_onboarding_profile(patient_id: str):
    """Get patient onboarding profile data aligned with Careable 360+ fields."""
    patient = await db.crm_patient_profiles.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Return structured onboarding fields
    return {
        "id": patient["id"],
        "encare_user_id": patient.get("encare_user_id"),
        "last_synced_at": patient.get("last_synced_at"),
        "sync_source": patient.get("sync_source"),
        # Personal info
        "name": patient.get("name", ""),
        "email": patient.get("email", ""),
        "phone": patient.get("phone", ""),
        "picture": patient.get("picture", ""),
        "age": patient.get("age"),
        "sex": patient.get("sex", ""),
        # Address
        "address": patient.get("address", ""),
        "city": patient.get("city", ""),
        "state": patient.get("state", ""),
        "country": patient.get("country", "India"),
        "pincode": patient.get("pincode", ""),
        # Medical
        "diseases": patient.get("diseases", []),
        "adherence_rate": patient.get("adherence_rate", 85),
        "main_disease": patient.get("main_disease", ""),
        "consulting_doctor_name": patient.get("consulting_doctor_name", ""),
        "clinic_hospital_details": patient.get("clinic_hospital_details", ""),
        "last_doctor_visit_date": patient.get("last_doctor_visit_date", ""),
        "regular_lab_details": patient.get("regular_lab_details", ""),
        "last_lab_visit_date": patient.get("last_lab_visit_date", ""),
        "mobility_status": patient.get("mobility_status", ""),
        "other_critical_info": patient.get("other_critical_info", ""),
        "marketing_consent": patient.get("marketing_consent", ""),
        # Caregiver / Emergency
        "relative_name": patient.get("relative_name", ""),
        "relative_email": patient.get("relative_email", ""),
        "relative_whatsapp": patient.get("relative_whatsapp", ""),
        "caregivers": patient.get("caregivers", []),
        # Invoice
        "medicine_order_link": patient.get("medicine_order_link", ""),
        "medicine_invoice_link": patient.get("medicine_invoice_link", ""),
        "medicine_invoice_amount": patient.get("medicine_invoice_amount"),
        "injection_order_link": patient.get("injection_order_link", ""),
        "injection_invoice_link": patient.get("injection_invoice_link", ""),
        "injection_invoice_amount": patient.get("injection_invoice_amount"),
        "product_order_link": patient.get("product_order_link", ""),
        "product_invoice_link": patient.get("product_invoice_link", ""),
        "product_invoice_amount": patient.get("product_invoice_amount"),
        # Meta
        "priority": patient.get("priority", "normal"),
        "onboarding_completed": bool(patient.get("onboarding_completed", False)),
        "onboarding_completed_at": patient.get("onboarding_completed_at"),
        "created_at": patient.get("created_at"),
        "updated_at": patient.get("updated_at"),
    }


@router.put("/patients/{patient_id}/onboarding")
async def update_onboarding_profile(patient_id: str, data: Dict):
    """Update patient onboarding profile — full profile update mirroring Careable 360+ fields."""
    patient = await db.crm_patient_profiles.find_one({"id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    now_iso = datetime.now(timezone.utc).isoformat()

    # Allowed onboarding fields (Careable 360+-aligned)
    allowed_fields = [
        "name", "email", "phone", "picture", "age", "sex",
        "address", "city", "state", "country", "pincode",
        "adherence_rate",
        "main_disease", "consulting_doctor_name", "clinic_hospital_details",
        "last_doctor_visit_date", "regular_lab_details", "last_lab_visit_date",
        "mobility_status", "other_critical_info", "marketing_consent",
        "relative_name", "relative_email", "relative_whatsapp",
        "medicine_order_link", "medicine_invoice_link", "medicine_invoice_amount",
        "injection_order_link", "injection_invoice_link", "injection_invoice_amount",
        "product_order_link", "product_invoice_link", "product_invoice_amount",
        "priority",
        "onboarding_completed",
    ]

    updates = {}
    for field in allowed_fields:
        if field in data:
            updates[field] = data[field]

    # Timestamp when onboarding was marked complete
    if data.get("onboarding_completed") and not patient.get("onboarding_completed"):
        updates["onboarding_completed_at"] = now_iso

    # Rebuild caregivers from relative fields
    rel_name = data.get("relative_name", patient.get("relative_name"))
    if rel_name:
        updates["caregivers"] = [{
            "name": rel_name,
            "phone": data.get("relative_whatsapp", patient.get("relative_whatsapp", "")),
            "email": data.get("relative_email", patient.get("relative_email", "")),
            "relationship": "Family"
        }]

    # Auto-update Elderly Care disease if age >= 65
    new_age = data.get("age", patient.get("age", 0))
    current_diseases = patient.get("diseases", [])
    if new_age and new_age >= 65 and "Elderly Care" not in current_diseases:
        current_diseases.append("Elderly Care")
        updates["diseases"] = current_diseases
    elif new_age and new_age < 65 and "Elderly Care" in current_diseases:
        current_diseases.remove("Elderly Care")
        # Re-detect from medicines
        med_diseases = detect_diseases_from_medicines(patient.get("medicines", []))
        updates["diseases"] = list(set(med_diseases + [d for d in current_diseases if d != "Elderly Care"]))

    updates["updated_at"] = now_iso

    await db.crm_patient_profiles.update_one({"id": patient_id}, {"$set": updates})

    # Mirror identity-shared fields to db.users so PM and mobile reflect the change.
    await mirror_profile_to_users(patient_id, updates)

    # Auto-create/update appointment records from onboarding visit dates
    if "last_doctor_visit_date" in data and data["last_doctor_visit_date"]:
        await db.appointments.update_one(
            {"user_id": patient_id, "source": "onboarding", "type": "doctor"},
            {
                "$set": {
                    "user_id": patient_id,
                    "type": "doctor",
                    "title": "Doctor Visit (from onboarding)",
                    "doctor": data.get("consulting_doctor_name", patient.get("consulting_doctor_name", "")),
                    "hospital": data.get("clinic_hospital_details", patient.get("clinic_hospital_details", "")),
                    "date": data["last_doctor_visit_date"],
                    "time": "00:00",
                    "status": "done",
                    "source": "onboarding",
                    "notes": "Auto-recorded from onboarding profile",
                },
                "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": now_iso}
            },
            upsert=True
        )

    if "last_lab_visit_date" in data and data["last_lab_visit_date"]:
        await db.appointments.update_one(
            {"user_id": patient_id, "source": "onboarding", "type": "lab"},
            {
                "$set": {
                    "user_id": patient_id,
                    "type": "lab",
                    "title": "Lab Visit (from onboarding)",
                    "doctor": "",
                    "hospital": data.get("regular_lab_details", patient.get("regular_lab_details", "")),
                    "date": data["last_lab_visit_date"],
                    "time": "00:00",
                    "status": "done",
                    "source": "onboarding",
                    "notes": "Auto-recorded from onboarding profile",
                },
                "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": now_iso}
            },
            upsert=True
        )

    return await db.crm_patient_profiles.find_one({"id": patient_id}, {"_id": 0})



# ======================== DATA MIGRATIONS ========================

async def migrate_lab_booking_dates() -> Dict[str, int]:
    """One-time migration: normalize lab_bookings.booked_date to 'YYYY-MM-DD'.

    Idempotent — only touches documents whose booked_date is not already a
    10-char 'YYYY-MM-DD' string.
    """
    stats = {"total": 0, "already_canonical": 0, "migrated": 0, "null_or_empty": 0, "failed": 0}
    cursor = db.crm_lab_bookings.find({}, {"_id": 0, "id": 1, "booked_date": 1})
    async for b in cursor:
        stats["total"] += 1
        raw = b.get("booked_date")
        if raw is None or raw == "":
            stats["null_or_empty"] += 1
            continue
        if isinstance(raw, str) and len(raw) == 10 and raw[4] == "-" and raw[7] == "-":
            try:
                datetime.strptime(raw, "%Y-%m-%d")
                stats["already_canonical"] += 1
                continue
            except ValueError:
                pass
        try:
            normalized = normalize_booked_date(raw)
        except ValueError as e:
            logger.warning(f"lab_booking {b.get('id')} booked_date not parseable ({raw!r}): {e}")
            stats["failed"] += 1
            continue
        await db.crm_lab_bookings.update_one(
            {"id": b["id"]}, {"$set": {"booked_date": normalized}}
        )
        stats["migrated"] += 1
    return stats


@router.post("/admin/migrate/lab-bookings-dates")
async def admin_migrate_lab_booking_dates(request: Request):
    """Admin: manually trigger the lab_bookings.booked_date normalization migration."""
    await get_prescription_manager(request, db)
    stats = await migrate_lab_booking_dates()
    logger.info(f"lab_booking date migration stats: {stats}")
    return {"message": "Migration complete", "stats": stats}


async def run_startup_migrations():
    """Run idempotent data migrations on boot. Called from server.py startup."""
    try:
        stats = await migrate_lab_booking_dates()
        if stats["migrated"] > 0 or stats["failed"] > 0:
            logger.info(f"[startup] crm_lab_bookings date migration: {stats}")
    except Exception as e:
        logger.warning(f"[startup] crm_lab_bookings date migration failed: {e}")
