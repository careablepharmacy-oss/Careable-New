from pydantic import BaseModel, Field, EmailStr, validator
from typing import Optional, List
from datetime import datetime
import uuid

# User Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    picture: Optional[str] = None
    phone: Optional[str] = None
    sex: Optional[str] = None
    age: Optional[int] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    pincode: Optional[str] = None
    diabetes_type: Optional[str] = "Type 2"
    # Emergency contact fields
    relative_name: Optional[str] = None
    relative_email: Optional[str] = None
    relative_whatsapp: Optional[str] = None
    # Role field for admin/prescription manager access
    role: str = "user"  # user, prescription_manager, admin
    # FCM token for push notifications
    fcm_token: Optional[str] = None
    fcm_updated_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    sex: Optional[str] = None
    age: Optional[int] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    pincode: Optional[str] = None
    diabetes_type: Optional[str] = None
    # Emergency contact fields
    relative_name: Optional[str] = None
    relative_email: Optional[str] = None
    relative_whatsapp: Optional[str] = None

    @validator('age', pre=True, always=True)
    def parse_age(cls, v):
        if v is None or v == '' or v == 'null':
            return None
        try:
            return int(v)
        except (ValueError, TypeError):
            return None

# Caregiver Models
class CaregiverLink(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_user_id: str
    caregiver_user_id: Optional[str] = None
    caregiver_phone: str
    invite_token: str
    invite_status: str = "pending"  # pending, accepted, expired
    notify_on_taken: bool = True
    notify_on_missed: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CaregiverInviteRequest(BaseModel):
    caregiver_phone: str

class CaregiverPreferencesUpdate(BaseModel):
    notify_on_taken: Optional[bool] = None
    notify_on_missed: Optional[bool] = None

# User Purchase Links Model (user-level, not medication-level)
class UserPurchaseLinks(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    medicine_order_link: Optional[str] = None
    medicine_invoice_link: Optional[str] = None
    medicine_invoice_amount: Optional[float] = None
    injection_order_link: Optional[str] = None
    injection_invoice_link: Optional[str] = None
    injection_invoice_amount: Optional[float] = None
    product_order_link: Optional[str] = None
    product_invoice_link: Optional[str] = None
    product_invoice_amount: Optional[float] = None
    product_order_completed: Optional[bool] = False
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: Optional[str] = None  # prescription manager who updated

class UserPurchaseLinksUpdate(BaseModel):
    medicine_order_link: Optional[str] = None
    medicine_invoice_link: Optional[str] = None
    medicine_invoice_amount: Optional[float] = None
    injection_order_link: Optional[str] = None
    injection_invoice_link: Optional[str] = None
    injection_invoice_amount: Optional[float] = None
    product_order_link: Optional[str] = None
    product_invoice_link: Optional[str] = None
    product_invoice_amount: Optional[float] = None
    product_order_completed: Optional[bool] = None

# Session Model
class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Medication Models
class DosageTiming(BaseModel):
    time: str  # e.g., "08:00"
    amount: str  # e.g., "10" (for tablets) or "15" (for IU)

class MedicationSchedule(BaseModel):
    frequency: str  # daily, weekly, as-needed
    times: List[str] = []  # ['09:00', '21:00'] - DEPRECATED, kept for backward compatibility
    dosage_timings: Optional[List[DosageTiming]] = []  # New: [{time: "08:00", amount: "10"}, ...]
    start_date: str
    end_date: Optional[str] = None
    weekly_days: List[str] = []  # ['monday', 'wednesday', 'friday'] for weekly frequency

class RefillReminder(BaseModel):
    enabled: bool = True
    pills_remaining: int = 0
    threshold: int = 7

class Medication(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    dosage: str  # DEPRECATED: kept for backward compatibility, use dosage_timings instead
    form: str  # Tablet, Capsule, Injection, Syrup, etc.
    color: str = "#FF6B6B"
    instructions: Optional[str] = None
    schedule: MedicationSchedule
    refill_reminder: RefillReminder
    # New fields for hybrid stock tracking
    tablet_stock_count: Optional[int] = None  # For tablets/capsules: total number of tablets remaining
    injection_iu_remaining: Optional[float] = None  # For injections: current IU remaining (auto-calculated)
    injection_iu_per_ml: Optional[float] = None  # For injections: IU per ml (concentration)
    injection_iu_per_package: Optional[float] = None  # For injections: Total IU per vial/pen (ml × iu_per_ml)
    injection_ml_volume: Optional[float] = None  # For injections: volume in ml per package
    injection_stock_count: Optional[int] = None  # For injections: number of vials/pens remaining
    # Prescription manager specific fields
    tablets_per_strip: Optional[int] = None  # Number of tablets/capsules per strip
    cost_per_unit: Optional[float] = None  # Cost per tablet/capsule/vial
    include_in_invoice: Optional[bool] = True  # Include in monthly savings calculation
    medicine_order_link: Optional[str] = None  # URL to order medicine
    medicine_invoice_link: Optional[str] = None  # URL to invoice/receipt
    medicine_invoice_amount: Optional[float] = None  # Total invoice amount for medicine
    injection_order_link: Optional[str] = None  # URL to order injection
    injection_invoice_link: Optional[str] = None  # URL to injection invoice/receipt
    injection_invoice_amount: Optional[float] = None  # Total invoice amount for injection
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class MedicationCreate(BaseModel):
    name: str
    dosage: str  # Can be empty string if using dosage_timings
    form: str
    color: str = "#FF6B6B"
    instructions: Optional[str] = None
    schedule: MedicationSchedule
    refill_reminder: RefillReminder
    # New fields for hybrid stock tracking
    tablet_stock_count: Optional[int] = None
    injection_iu_remaining: Optional[float] = None
    injection_iu_per_ml: Optional[float] = None
    injection_iu_per_package: Optional[float] = None
    injection_ml_volume: Optional[float] = None
    injection_stock_count: Optional[int] = None
    # Prescription manager specific fields
    tablets_per_strip: Optional[int] = None
    cost_per_unit: Optional[float] = None
    include_in_invoice: Optional[bool] = True
    medicine_order_link: Optional[str] = None
    medicine_invoice_link: Optional[str] = None
    medicine_invoice_amount: Optional[float] = None
    injection_order_link: Optional[str] = None
    injection_invoice_link: Optional[str] = None
    injection_invoice_amount: Optional[float] = None

class MedicationUpdate(BaseModel):
    name: Optional[str] = None
    dosage: Optional[str] = None
    form: Optional[str] = None
    color: Optional[str] = None
    instructions: Optional[str] = None
    schedule: Optional[MedicationSchedule] = None
    refill_reminder: Optional[RefillReminder] = None
    # New fields for hybrid stock tracking
    tablet_stock_count: Optional[int] = None
    injection_iu_remaining: Optional[float] = None
    injection_iu_per_ml: Optional[float] = None
    injection_iu_per_package: Optional[float] = None
    injection_ml_volume: Optional[float] = None
    injection_stock_count: Optional[int] = None
    # Prescription manager specific fields
    tablets_per_strip: Optional[int] = None
    cost_per_unit: Optional[float] = None
    include_in_invoice: Optional[bool] = None
    medicine_order_link: Optional[str] = None
    medicine_invoice_link: Optional[str] = None
    medicine_invoice_amount: Optional[float] = None
    injection_order_link: Optional[str] = None
    injection_invoice_link: Optional[str] = None
    injection_invoice_amount: Optional[float] = None

# Adherence Log Models
class AdherenceLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    medication_id: str
    scheduled_time: str
    taken_time: Optional[str] = None
    status: str  # pending, taken, skipped
    date: str
    dosage_amount: Optional[str] = None  # The amount taken at this time (e.g., "10" tablets or "15" IU)
    webhook_sent_at: Optional[datetime] = None  # Track when webhook was sent for missed medication
    # FCM push reminder tracking
    reminder_attempts: int = 0  # Number of push reminders sent (0-4)
    last_reminder_at: Optional[datetime] = None  # Timestamp of last reminder
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Webhook Configuration Model
class WebhookConfig(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    webhook_url: str
    enabled: bool = True
    description: Optional[str] = "Missed medication webhook"
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: Optional[str] = None  # User ID who last updated

class AdherenceLogCreate(BaseModel):
    medication_id: str
    scheduled_time: str
    status: str
    taken_time: Optional[str] = None
    date: str
    dosage_amount: Optional[str] = None

# Health Metrics Models
class BloodGlucose(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    value: int
    unit: str = "mg/dL"
    time: str
    meal_context: str  # Fasting, After Lunch, etc.
    date: str
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class BloodGlucoseCreate(BaseModel):
    value: int
    time: str
    meal_context: str
    date: str
    notes: Optional[str] = None

class BloodPressure(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    systolic: int
    diastolic: int
    pulse: Optional[int] = None
    time: str
    date: str
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class BloodPressureCreate(BaseModel):
    systolic: int
    diastolic: int
    pulse: Optional[int] = None
    time: str
    date: str
    notes: Optional[str] = None

class BodyMetrics(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    weight: float
    height: float  # in cm
    bmi: float
    date: str
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class BodyMetricsCreate(BaseModel):
    weight: float
    height: float
    bmi: float
    date: str
    notes: Optional[str] = None

# Appointment Models
class Appointment(BaseModel):
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
    status: str = "upcoming"  # upcoming, completed, cancelled
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AppointmentCreate(BaseModel):
    type: str
    title: str
    doctor: Optional[str] = None
    hospital: Optional[str] = None
    date: str
    time: str
    location: Optional[str] = None
    notes: Optional[str] = None
    user_id: Optional[str] = None  # For admin use - to create appointment for another user

# Food & Exercise Log Models
class FoodLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    date: str
    time: str
    meal: str  # Breakfast, Lunch, Dinner, Snack
    items: str
    carbs: Optional[int] = None
    calories: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class FoodLogCreate(BaseModel):
    date: str
    time: str
    meal: str
    items: str
    carbs: Optional[int] = None
    calories: Optional[int] = None

class ExerciseLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    date: str
    time: str
    activity: str
    duration: int  # minutes
    calories: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ExerciseLogCreate(BaseModel):
    date: str
    time: str
    activity: str
    duration: int
    calories: Optional[int] = None
    notes: Optional[str] = None

# Notification Settings Model
class NotificationSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    medication_reminders: bool = True
    appointment_reminders: bool = True
    health_tips: bool = False
    email_notifications: bool = True
    push_notifications: bool = True
    alarm_enabled: bool = False
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class NotificationSettingsUpdate(BaseModel):
    medication_reminders: Optional[bool] = None
    appointment_reminders: Optional[bool] = None
    health_tips: Optional[bool] = None
    email_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    alarm_enabled: Optional[bool] = None


# Reminder Models
class Reminder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str  # medication, appointment, low_stock
    title: str
    message: str
    trigger_time: str  # ISO datetime string when notification should be sent
    related_id: Optional[str] = None  # medication_id or appointment_id
    status: str = "pending"  # pending, sent, failed, skipped
    notification_sent: bool = False
    urgency: Optional[str] = "normal"  # gentle, normal, followup, urgent
    vibration: Optional[List[int]] = [200, 100, 200]  # Vibration pattern
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ReminderCreate(BaseModel):
    type: str
    title: str
    message: str
    trigger_time: str
    related_id: Optional[str] = None
    urgency: Optional[str] = "normal"
    vibration: Optional[List[int]] = [200, 100, 200]

# Push Subscription Model
class PushSubscription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    endpoint: str
    keys: dict  # Contains p256dh and auth keys
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PushSubscriptionCreate(BaseModel):
    endpoint: str
    keys: dict



# ==================== E-COMMERCE MODELS ====================

# Product Models
class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    mrp: float  # Maximum Retail Price
    selling_price: float  # Discounted selling price
    discount_percent: Optional[float] = None  # Calculated: ((mrp - selling_price) / mrp) * 100
    category: str  # "medical_equipment" or "personal_care"
    subcategory: Optional[str] = None
    image_url: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    mrp: float
    selling_price: float
    discount_percent: Optional[float] = None
    category: str
    subcategory: Optional[str] = None
    image_url: Optional[str] = None
    is_active: bool = True

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    mrp: Optional[float] = None
    selling_price: Optional[float] = None
    discount_percent: Optional[float] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None

# Cart Models
class CartItem(BaseModel):
    product_id: str
    quantity: int = 1

class Cart(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    items: List[CartItem] = []
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CartItemAdd(BaseModel):
    product_id: str
    quantity: int = 1

class CartItemUpdate(BaseModel):
    quantity: int

# Address & Order Models
class Address(BaseModel):
    full_name: str
    phone: str
    address_line1: str
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: str
    pincode: str
    country: str = "India"

class OrderItem(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    mrp: float
    selling_price: float
    item_total: float
    image_url: Optional[str] = None

class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    order_number: str
    items: List[OrderItem] = []
    billing_address: Address
    shipping_address: Address
    subtotal: float
    discount: float = 0
    delivery_charge: float = 0
    total: float
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    payment_status: str = "pending"  # pending, paid, failed
    order_status: str = "confirmed"  # confirmed, processing, shipped, delivered, cancelled
    tracking_number: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CheckoutRequest(BaseModel):
    billing_address: Address
    shipping_address: Address
