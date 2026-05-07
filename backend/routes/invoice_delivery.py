from fastapi import APIRouter, HTTPException, Request, Response, UploadFile, File
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import io
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/inv")
db = None

def set_db(database):
    global db
    db = database

# ========= Pydantic Models =========

class LineItem(BaseModel):
    product_id: Optional[str] = None
    name: str
    sku: str = ""
    quantity: int = 1
    unit_price: float
    gst_rate: float = 5.0
    gst_inclusive: bool = False
    discount_type: str = "percentage"
    discount_value: float = 0

class CustomerDetails(BaseModel):
    name: str
    email: str = ""
    phone: str = ""
    address: str = ""

class InvoiceCreate(BaseModel):
    invoice_type: str = "tax_invoice"
    invoice_prefix: str = "INV"
    customer_details: CustomerDetails
    line_items: List[LineItem]
    global_discount_type: str = "percentage"
    global_discount_value: float = 0
    coupon_codes: List[str] = []
    due_date: Optional[str] = None
    notes: str = ""

class CouponCreate(BaseModel):
    code: str
    discount_type: str = "percentage"
    discount_value: float
    min_order_value: float = 0
    max_discount: Optional[float] = None
    max_usage: int = 100
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None

class CouponUpdate(BaseModel):
    is_active: Optional[bool] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    min_order_value: Optional[float] = None
    max_discount: Optional[float] = None
    max_usage: Optional[int] = None
    valid_until: Optional[str] = None

class SellerSettings(BaseModel):
    business_name: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    pincode: str = ""
    phone: str = ""
    email: str = ""
    gst_number: str = ""
    tax_id: str = ""
    bank_name: str = ""
    bank_account_number: str = ""
    bank_ifsc: str = ""
    bank_branch: str = ""
    logo_url: str = ""

class OrderStatusUpdate(BaseModel):
    status: str


class OrderTrackingUpdate(BaseModel):
    """Attach (or clear) a courier tracking URL on an existing inv_order."""
    tracking_url: Optional[str] = None  # empty/None = clear


class OrderTrackingManualUpdate(BaseModel):
    """Manual override for the scraped tracking_status."""
    tracking_status: Optional[str] = None
    cancel_override: Optional[bool] = False

# ========= Auth Helpers =========

async def get_current_user(request: Request) -> dict:
    from auth import get_current_user as auth_get_user
    return await auth_get_user(request, db)

async def require_pm(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") not in ["prescription_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Admin/PM access required")
    return user

# ========= Medicine Products (from existing medicines collection) =========

@router.get("/products/all")
async def list_all_medicines(request: Request):
    await require_pm(request)
    medicines = await db.medicines.find({}, {"_id": 0}).sort("name", 1).to_list(5000)
    # Map to product-like format for invoice creator
    products = []
    for med in medicines:
        products.append({
            "product_id": med.get("id", med.get("name", "")),
            "name": med.get("name", ""),
            "sku": "",
            "price": 0,
            "category": "medicine",
            "gst_rate": 5.0,
            "gst_inclusive": False,
            "description": ""
        })
    return {"products": products}

@router.get("/products")
async def search_medicines(request: Request, page: int = 1, limit: int = 20, search: str = "", category: str = ""):
    await require_pm(request)
    query = {}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    total = await db.medicines.count_documents(query)
    skip = (page - 1) * limit
    medicines = await db.medicines.find(query, {"_id": 0}).skip(skip).limit(limit).sort("name", 1).to_list(limit)
    products = []
    for med in medicines:
        products.append({
            "product_id": med.get("id", med.get("name", "")),
            "name": med.get("name", ""),
            "sku": "",
            "price": 0,
            "category": "medicine",
            "gst_rate": 5.0,
            "gst_inclusive": False,
            "description": ""
        })
    return {"products": products, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}

# ========= Generate Invoice from User Medications =========

async def compute_monthly_medicine_invoice_total(user_id: str) -> float:
    """System-computed monthly invoice total for a user's medications.

    Mirrors `generate_invoice_data_from_medications` qty/price logic — sums
    `qty × unit_price` for every medication flagged `include_in_invoice` (default True).
    Returns 0.0 if no medications. Used by CRM revenue opportunity calculator.
    """
    if db is None:
        return 0.0
    medications = await db.medications.find({"user_id": user_id}, {"_id": 0}).to_list(200)
    DAYS_IN_MONTH = 30
    total = 0.0
    for med in medications:
        if not med.get("include_in_invoice", True):
            continue
        price = float(med.get("cost_per_unit", 0) or 0)
        qty = 1
        schedule = med.get("schedule", {}) or {}
        daily_consumption = 0.0
        freq = schedule.get("frequency", "daily")
        timings = schedule.get("dosage_timings", []) or []
        if freq == "daily" and timings:
            for t in timings:
                daily_consumption += float(t.get("amount", 0) or 0)
        elif freq == "weekly" and timings:
            weekly_total = sum(float(t.get("amount", 0) or 0) for t in timings)
            daily_consumption = weekly_total / 7
        monthly_need = daily_consumption * DAYS_IN_MONTH
        form = med.get("form", "")
        if form in ("Tablet", "Capsule"):
            tablets_per_strip = med.get("tablets_per_strip") or 1
            if monthly_need > 0:
                import math
                qty = math.ceil(monthly_need / tablets_per_strip)
        elif form == "Injection":
            iu_per_package = med.get("injection_iu_per_package") or 1
            if monthly_need > 0:
                import math
                qty = math.ceil(monthly_need / iu_per_package)
        qty = max(int(qty), 1)
        total += qty * price
    return float(round(total, 2))


@router.get("/generate-from-medications/{user_id}")
async def generate_invoice_data_from_medications(user_id: str, request: Request):
    """Generate invoice line items from a user's medications."""
    await require_pm(request)
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    medications = await db.medications.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    line_items = []
    DAYS_IN_MONTH = 30
    for med in medications:
        if not med.get("include_in_invoice", True):
            continue
        price = med.get("cost_per_unit", 0) or 0
        qty = 1
        # Calculate monthly consumption using the same logic as MedicationsPage
        schedule = med.get("schedule", {})
        daily_consumption = 0
        freq = schedule.get("frequency", "daily")
        timings = schedule.get("dosage_timings", [])
        if freq == "daily" and timings:
            for t in timings:
                daily_consumption += float(t.get("amount", 0) or 0)
        elif freq == "weekly" and timings:
            weekly_total = sum(float(t.get("amount", 0) or 0) for t in timings)
            daily_consumption = weekly_total / 7
        monthly_need = daily_consumption * DAYS_IN_MONTH
        form = med.get("form", "")
        if form in ("Tablet", "Capsule"):
            tablets_per_strip = med.get("tablets_per_strip") or 1
            if monthly_need > 0:
                import math
                qty = math.ceil(monthly_need / tablets_per_strip)
            else:
                qty = 1
        elif form == "Injection":
            iu_per_package = med.get("injection_iu_per_package") or 1
            if monthly_need > 0:
                import math
                qty = math.ceil(monthly_need / iu_per_package)
            else:
                qty = 1
        line_items.append({
            "product_id": None,
            "name": med.get("name", ""),
            "sku": "",
            "quantity": max(qty, 1),
            "unit_price": float(price),
            "gst_rate": 5.0,
            "gst_inclusive": True,
            "discount_type": "percentage",
            "discount_value": 0
        })
    customer_details = {
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "phone": user.get("phone", ""),
        "address": ", ".join(filter(None, [user.get("address", ""), user.get("city", ""), user.get("state", ""), user.get("pincode", "")]))
    }
    return {"customer_details": customer_details, "line_items": line_items}

# ========= Seller Settings Routes =========

@router.get("/settings/seller")
async def get_seller_settings(request: Request):
    await require_pm(request)
    settings = await db.inv_seller_settings.find_one({}, {"_id": 0})
    return settings or {}

@router.put("/settings/seller")
async def update_seller_settings(settings: SellerSettings, request: Request):
    await require_pm(request)
    doc = settings.model_dump()
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.inv_seller_settings.update_one({}, {"$set": doc}, upsert=True)
    return doc

@router.get("/settings/seller/public")
async def get_seller_settings_public():
    settings = await db.inv_seller_settings.find_one({}, {"_id": 0})
    return settings or {}

# ========= Coupon Routes =========

@router.post("/coupons")
async def create_coupon(coupon: CouponCreate, request: Request):
    await require_pm(request)
    existing = await db.inv_coupons.find_one({"code": coupon.code.upper()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    coupon_id = f"cpn_{uuid.uuid4().hex[:12]}"
    doc = {
        "coupon_id": coupon_id, "code": coupon.code.upper(),
        **coupon.model_dump(exclude={"code"}),
        "is_active": True, "usage_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.inv_coupons.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.get("/coupons")
async def list_coupons(request: Request):
    await require_pm(request)
    coupons = await db.inv_coupons.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"coupons": coupons}

@router.put("/coupons/{coupon_id}")
async def update_coupon(coupon_id: str, coupon: CouponUpdate, request: Request):
    await require_pm(request)
    update_data = {k: v for k, v in coupon.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.inv_coupons.update_one({"coupon_id": coupon_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    updated = await db.inv_coupons.find_one({"coupon_id": coupon_id}, {"_id": 0})
    return updated

@router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, request: Request):
    await require_pm(request)
    result = await db.inv_coupons.delete_one({"coupon_id": coupon_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return {"message": "Coupon deleted"}

@router.post("/coupons/validate")
async def validate_coupon(request: Request):
    body = await request.json()
    code = body.get("code", "").upper()
    order_total = body.get("order_total", 0)
    coupon = await db.inv_coupons.find_one({"code": code, "is_active": True}, {"_id": 0})
    if not coupon:
        raise HTTPException(status_code=400, detail="Invalid or inactive coupon code")
    if coupon.get("max_usage") and coupon.get("usage_count", 0) >= coupon["max_usage"]:
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")
    if coupon.get("min_order_value") and order_total < coupon["min_order_value"]:
        raise HTTPException(status_code=400, detail=f"Minimum order value is {coupon['min_order_value']}")
    if coupon.get("valid_until"):
        valid_until = datetime.fromisoformat(coupon["valid_until"])
        if valid_until.tzinfo is None:
            valid_until = valid_until.replace(tzinfo=timezone.utc)
        if valid_until < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Coupon has expired")
    discount = coupon["discount_value"]
    if coupon["discount_type"] == "percentage":
        discount = order_total * (coupon["discount_value"] / 100)
        if coupon.get("max_discount"):
            discount = min(discount, coupon["max_discount"])
    return {"valid": True, "coupon": coupon, "discount_amount": round(discount, 2)}

# ========= Invoice Routes =========

async def generate_invoice_number(prefix: str) -> str:
    count = await db.inv_invoices.count_documents({})
    return f"{prefix}-{str(count + 1).zfill(6)}"

@router.post("/invoices")
async def create_invoice(invoice_data: InvoiceCreate, request: Request):
    user = await require_pm(request)
    seller = await db.inv_seller_settings.find_one({}, {"_id": 0}) or {}
    line_items = []
    subtotal = 0
    total_tax = 0
    total_item_discount = 0
    for item in invoice_data.line_items:
        if item.gst_inclusive and item.gst_rate > 0:
            base_price = item.unit_price / (1 + item.gst_rate / 100)
        else:
            base_price = item.unit_price
        item_subtotal = item.quantity * base_price
        item_discount = 0
        if item.discount_type == "percentage":
            item_discount = item_subtotal * (item.discount_value / 100)
        else:
            item_discount = item.discount_value
        taxable_amount = item_subtotal - item_discount
        tax_amount = taxable_amount * (item.gst_rate / 100)
        item_total = taxable_amount + tax_amount
        line_items.append({
            **item.model_dump(),
            "base_price": round(base_price, 2),
            "item_subtotal": round(item_subtotal, 2),
            "item_discount": round(item_discount, 2),
            "taxable_amount": round(taxable_amount, 2),
            "tax_amount": round(tax_amount, 2),
            "item_total": round(item_total, 2)
        })
        subtotal += item_subtotal
        total_tax += tax_amount
        total_item_discount += item_discount
    coupon_discount = 0
    applied_coupons = []
    for code in invoice_data.coupon_codes:
        coupon = await db.inv_coupons.find_one({"code": code.upper(), "is_active": True}, {"_id": 0})
        if coupon:
            if coupon["discount_type"] == "percentage":
                disc = subtotal * (coupon["discount_value"] / 100)
                if coupon.get("max_discount"):
                    disc = min(disc, coupon["max_discount"])
            else:
                disc = coupon["discount_value"]
            coupon_discount += disc
            applied_coupons.append({"code": coupon["code"], "discount": round(disc, 2)})
            await db.inv_coupons.update_one({"coupon_id": coupon["coupon_id"]}, {"$inc": {"usage_count": 1}})
    global_discount = 0
    if invoice_data.global_discount_value > 0:
        if invoice_data.global_discount_type == "percentage":
            global_discount = subtotal * (invoice_data.global_discount_value / 100)
        else:
            global_discount = invoice_data.global_discount_value
    total_discount = total_item_discount + coupon_discount + global_discount
    grand_total = subtotal - coupon_discount - global_discount + total_tax
    invoice_id = f"inv_{uuid.uuid4().hex[:12]}"
    invoice_number = await generate_invoice_number(invoice_data.invoice_prefix)
    public_token = uuid.uuid4().hex
    due_date = invoice_data.due_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    doc = {
        "invoice_id": invoice_id, "invoice_number": invoice_number,
        "invoice_type": invoice_data.invoice_type,
        "seller_details": seller,
        "customer_details": invoice_data.customer_details.model_dump(),
        "line_items": line_items,
        "subtotal": round(subtotal, 2), "total_tax": round(total_tax, 2),
        "coupon_discount": round(coupon_discount, 2),
        "global_discount": round(global_discount, 2),
        "global_discount_type": invoice_data.global_discount_type,
        "global_discount_value": invoice_data.global_discount_value,
        "total_discount": round(total_discount, 2),
        "grand_total": round(max(grand_total, 0), 2),
        "applied_coupons": applied_coupons,
        "status": "created", "payment_status": "unpaid",
        "public_token": public_token,
        "created_by": user.get("id", user.get("user_id", "")),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "due_date": due_date, "notes": invoice_data.notes
    }
    await db.inv_invoices.insert_one(doc)
    doc.pop("_id", None)
    for cp in applied_coupons:
        await db.inv_coupon_usage.insert_one({
            "code": cp["code"], "invoice_id": invoice_id,
            "discount_amount": cp["discount"],
            "used_at": datetime.now(timezone.utc).isoformat()
        })
    return doc

@router.get("/invoices")
async def list_invoices(request: Request, page: int = 1, limit: int = 20, search: str = "", status: str = ""):
    await require_pm(request)
    query = {}
    if search:
        query["$or"] = [
            {"invoice_number": {"$regex": search, "$options": "i"}},
            {"customer_details.name": {"$regex": search, "$options": "i"}},
            {"customer_details.email": {"$regex": search, "$options": "i"}}
        ]
    if status:
        query["payment_status"] = status
    total = await db.inv_invoices.count_documents(query)
    skip = (page - 1) * limit
    invoices = await db.inv_invoices.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    return {"invoices": invoices, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}

@router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, request: Request):
    await get_current_user(request)
    invoice = await db.inv_invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, request: Request):
    await require_pm(request)
    invoice = await db.inv_invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Cannot delete a paid invoice")
    await db.inv_invoices.delete_one({"invoice_id": invoice_id})
    return {"message": "Invoice deleted"}

@router.delete("/invoices/bulk/unpaid")
async def delete_all_unpaid_invoices(request: Request):
    await require_pm(request)
    result = await db.inv_invoices.delete_many({"payment_status": {"$ne": "paid"}})
    return {"message": f"{result.deleted_count} unpaid invoices deleted", "deleted_count": result.deleted_count}

@router.get("/invoices/public/{invoice_id}/{token}")
async def get_public_invoice(invoice_id: str, token: str):
    invoice = await db.inv_invoices.find_one({"invoice_id": invoice_id, "public_token": token}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

@router.get("/customer/invoices")
async def get_customer_invoices(request: Request):
    user = await get_current_user(request)
    invoices = await db.inv_invoices.find(
        {"customer_details.email": user["email"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"invoices": invoices}

# ========= Customer Routes =========

@router.get("/customers")
async def list_customers(request: Request, search: str = ""):
    await require_pm(request)
    # Search registered users from the main users collection
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    users = await db.users.find(query, {"_id": 0}).to_list(50)
    customers = []
    for u in users:
        customers.append({
            "customer_id": f"user:{u.get('id', '')}",
            "name": u.get("name", ""),
            "email": u.get("email", ""),
            "phone": u.get("phone", ""),
            "address": ", ".join(filter(None, [u.get("address", ""), u.get("city", ""), u.get("state", ""), u.get("pincode", "")])),
            "source": "registered_user",
        })
    # Also search inv_customers collection
    cust_query = {}
    if search:
        cust_query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    inv_customers = await db.inv_customers.find(cust_query, {"_id": 0}).sort("updated_at", -1).to_list(50)
    seen_emails = {c.get("email", "").lower() for c in customers if c.get("email")}
    for c in inv_customers:
        if c.get("email", "").lower() in seen_emails:
            continue
        customers.append(c)
    return {"customers": customers}

@router.get("/customers/{customer_id}")
async def get_customer(customer_id: str, request: Request):
    await require_pm(request)
    if customer_id.startswith("user:"):
        user_id = customer_id[5:]
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="Customer not found")
        return {
            "customer_id": customer_id,
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "phone": user.get("phone", ""),
            "address": ", ".join(filter(None, [user.get("address", ""), user.get("city", ""), user.get("state", ""), user.get("pincode", "")])),
            "source": "registered_user",
        }
    cust = await db.inv_customers.find_one({"customer_id": customer_id}, {"_id": 0})
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    return cust

@router.get("/customers/{customer_id}/history")
async def get_customer_history(customer_id: str, request: Request):
    await require_pm(request)
    if customer_id.startswith("user:"):
        user_id = customer_id[5:]
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="Customer not found")
        or_conditions = []
        if user.get("email"):
            or_conditions.append({"customer_details.email": user["email"]})
        if user.get("name"):
            or_conditions.append({"customer_details.name": user["name"]})
        if not or_conditions:
            return {"invoices": [], "items_from_registration": []}
        invoices = await db.inv_invoices.find(
            {"$or": or_conditions}, {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        return {"invoices": invoices, "items_from_registration": []}
    cust = await db.inv_customers.find_one({"customer_id": customer_id}, {"_id": 0})
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    or_conditions = []
    if cust.get("email"):
        or_conditions.append({"customer_details.email": cust["email"]})
    if cust.get("phone"):
        or_conditions.append({"customer_details.phone": cust["phone"]})
    if cust.get("name"):
        or_conditions.append({"customer_details.name": cust["name"]})
    if not or_conditions:
        return {"invoices": [], "items_from_registration": cust.get("items", [])}
    invoices = await db.inv_invoices.find(
        {"$or": or_conditions}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"invoices": invoices, "items_from_registration": cust.get("items", [])}

# ========= Payment Monitoring =========

VALID_DELIVERY_STATUSES = ["pending", "dispatched", "in_transit", "delivered", "returned"]
VALID_TRACKING_STATUSES = ["payment_pending", "payment_received", "returned_without_payment", "order_cancelled", "refund_initiated"]

@router.put("/invoices/{invoice_id}/tracking")
async def update_invoice_tracking(invoice_id: str, request: Request):
    await require_pm(request)
    body = await request.json()
    update = {}
    if "delivery_status" in body and body["delivery_status"] in VALID_DELIVERY_STATUSES:
        update["delivery_status"] = body["delivery_status"]
    if "tracking_status" in body and body["tracking_status"] in VALID_TRACKING_STATUSES:
        update["tracking_status"] = body["tracking_status"]
    if "tracking_notes" in body:
        update["tracking_notes"] = body.get("tracking_notes", "")
    if not update:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    update["tracking_updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.inv_invoices.update_one({"invoice_id": invoice_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    updated = await db.inv_invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    try:
        from services.email_invoice import send_delivery_status_email, send_refund_initiated_email
        if "delivery_status" in update and update["delivery_status"] in ("dispatched", "delivered", "returned"):
            send_delivery_status_email(updated, update["delivery_status"])
        if "tracking_status" in update and update["tracking_status"] == "refund_initiated":
            send_refund_initiated_email(updated)
    except Exception as e:
        print(f"[EMAIL-INV] Tracking notification error: {e}")
    # Sync to linked order
    try:
        linked_order = await db.inv_orders.find_one({"invoice_id": invoice_id}, {"_id": 0})
        if linked_order:
            delivery_to_order_map = {"pending": "Pending", "dispatched": "Shipped", "in_transit": "Shipped", "delivered": "Delivered", "returned": "Pending"}
            ds = update.get("delivery_status")
            if ds and ds in delivery_to_order_map:
                await db.inv_orders.update_one(
                    {"invoice_id": invoice_id},
                    {"$set": {"status": delivery_to_order_map[ds], "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
    except Exception as e:
        print(f"[SYNC-INV] Failed to sync: {e}")
    return updated

@router.get("/monitor/cod")
async def get_cod_monitor(request: Request):
    await require_pm(request)
    invoices = await db.inv_invoices.find({"payment_method": "cod"}, {"_id": 0}).sort("created_at", -1).to_list(500)
    total = len(invoices)
    total_amount = sum(inv.get("grand_total", 0) for inv in invoices)
    stats = {"payment_pending": 0, "payment_received": 0, "returned_without_payment": 0, "order_cancelled": 0, "refund_initiated": 0}
    delivery_stats = {"pending": 0, "dispatched": 0, "in_transit": 0, "delivered": 0, "returned": 0}
    for inv in invoices:
        ts = inv.get("tracking_status", "payment_pending")
        if ts in stats:
            stats[ts] += 1
        ds = inv.get("delivery_status", "pending")
        if ds in delivery_stats:
            delivery_stats[ds] += 1
    invoice_ids = [inv["invoice_id"] for inv in invoices]
    linked_orders = await db.inv_orders.find({"invoice_id": {"$in": invoice_ids}}, {"_id": 0, "invoice_id": 1, "order_id": 1, "status": 1}).to_list(500)
    order_map = {o["invoice_id"]: o for o in linked_orders}
    for inv in invoices:
        linked = order_map.get(inv["invoice_id"])
        inv["linked_order_id"] = linked["order_id"] if linked else None
        inv["linked_order_status"] = linked["status"] if linked else None
    return {"invoices": invoices, "total": total, "total_amount": round(total_amount, 2), "tracking_stats": stats, "delivery_stats": delivery_stats}

@router.get("/monitor/online")
async def get_online_monitor(request: Request):
    await require_pm(request)
    invoices = await db.inv_invoices.find({"payment_method": "online"}, {"_id": 0}).sort("created_at", -1).to_list(500)
    total = len(invoices)
    total_amount = sum(inv.get("grand_total", 0) for inv in invoices)
    stats = {"payment_pending": 0, "payment_received": 0, "returned_without_payment": 0, "order_cancelled": 0, "refund_initiated": 0}
    delivery_stats = {"pending": 0, "dispatched": 0, "in_transit": 0, "delivered": 0, "returned": 0}
    for inv in invoices:
        ts = inv.get("tracking_status", "payment_received")
        if ts in stats:
            stats[ts] += 1
        ds = inv.get("delivery_status", "pending")
        if ds in delivery_stats:
            delivery_stats[ds] += 1
    invoice_ids = [inv["invoice_id"] for inv in invoices]
    linked_orders = await db.inv_orders.find({"invoice_id": {"$in": invoice_ids}}, {"_id": 0, "invoice_id": 1, "order_id": 1, "status": 1}).to_list(500)
    order_map = {o["invoice_id"]: o for o in linked_orders}
    for inv in invoices:
        linked = order_map.get(inv["invoice_id"])
        inv["linked_order_id"] = linked["order_id"] if linked else None
        inv["linked_order_status"] = linked["status"] if linked else None
    return {"invoices": invoices, "total": total, "total_amount": round(total_amount, 2), "tracking_stats": stats, "delivery_stats": delivery_stats}

# ========= Analytics Routes =========

@router.get("/analytics/dashboard")
async def dashboard_analytics(request: Request):
    await require_pm(request)
    total_invoices = await db.inv_invoices.count_documents({})
    total_products = await db.medicines.count_documents({})
    total_coupons = await db.inv_coupons.count_documents({})
    pipeline = [
        {"$group": {
            "_id": None,
            "total_revenue": {"$sum": "$grand_total"},
            "paid_revenue": {"$sum": {"$cond": [{"$eq": ["$payment_status", "paid"]}, "$grand_total", 0]}},
            "unpaid_revenue": {"$sum": {"$cond": [{"$eq": ["$payment_status", "unpaid"]}, "$grand_total", 0]}}
        }}
    ]
    revenue = await db.inv_invoices.aggregate(pipeline).to_list(1)
    revenue_data = revenue[0] if revenue else {"total_revenue": 0, "paid_revenue": 0, "unpaid_revenue": 0}
    revenue_data.pop("_id", None)
    payment_method_pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {
            "_id": {"$ifNull": ["$payment_method", "online"]},
            "count": {"$sum": 1},
            "amount": {"$sum": "$grand_total"}
        }}
    ]
    pm_data = await db.inv_invoices.aggregate(payment_method_pipeline).to_list(10)
    payment_methods = {}
    for pm in pm_data:
        method = pm["_id"] if pm["_id"] else "online"
        payment_methods[method] = {"count": pm["count"], "amount": round(pm["amount"], 2)}
    recent_invoices = await db.inv_invoices.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    six_months_ago = (datetime.now(timezone.utc) - timedelta(days=180)).isoformat()
    monthly_pipeline = [
        {"$match": {"created_at": {"$gte": six_months_ago}}},
        {"$group": {"_id": {"$substr": ["$created_at", 0, 7]}, "revenue": {"$sum": "$grand_total"}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    monthly = await db.inv_invoices.aggregate(monthly_pipeline).to_list(12)
    return {
        "total_invoices": total_invoices, "total_products": total_products,
        "total_coupons": total_coupons, **revenue_data,
        "payment_methods": payment_methods,
        "recent_invoices": recent_invoices,
        "monthly_data": [{"month": m["_id"], "revenue": m["revenue"], "count": m["count"]} for m in monthly]
    }

# ========= Payment Routes (MOCKED) =========

@router.post("/payments/create-order")
async def create_payment_order(request: Request):
    body = await request.json()
    invoice_id = body.get("invoice_id")
    invoice = await db.inv_invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    order_id = f"order_{uuid.uuid4().hex[:16]}"
    payment_id = f"pay_{uuid.uuid4().hex[:12]}"
    await db.inv_payments.insert_one({
        "payment_id": payment_id, "invoice_id": invoice_id,
        "order_id": order_id, "amount": invoice["grand_total"],
        "status": "created", "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"order_id": order_id, "amount": int(invoice["grand_total"] * 100), "currency": "INR", "payment_id": payment_id}

@router.post("/payments/verify")
async def verify_payment(request: Request):
    body = await request.json()
    payment_id = body.get("payment_id")
    invoice_id = body.get("invoice_id")
    payment_method = body.get("payment_method", "online")
    # Capture pre-update state so we only record converted revenue once per invoice
    prev_invoice = await db.inv_invoices.find_one({"invoice_id": invoice_id}, {"_id": 0, "payment_status": 1})
    was_already_paid = bool(prev_invoice and prev_invoice.get("payment_status") == "paid")
    await db.inv_payments.update_one(
        {"payment_id": payment_id},
        {"$set": {"status": "paid", "payment_method": payment_method, "paid_at": datetime.now(timezone.utc).isoformat()}}
    )
    await db.inv_invoices.update_one(
        {"invoice_id": invoice_id},
        {"$set": {"payment_status": "paid", "status": "paid", "payment_method": payment_method}}
    )
    # Auto-create order from paid invoice
    try:
        invoice = await db.inv_invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
        if invoice:
            customer = invoice.get("customer_details", {})
            line_items = invoice.get("line_items", [])
            product_names = ", ".join([item.get("name", "") for item in line_items])
            total_qty = sum(item.get("quantity", 1) for item in line_items)
            order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
            order_doc = {
                "order_id": order_id, "invoice_id": invoice_id,
                "customer_email": customer.get("email", ""),
                "customer_name": customer.get("name", ""),
                "product_name": product_names[:200],
                "quantity": total_qty,
                "price": invoice.get("grand_total", 0),
                "shipping_address": customer.get("address", ""),
                "payment_info": f"{payment_method.upper()} - Invoice {invoice.get('invoice_number', '')}",
                "tracking_number": None,
                "status": "Pending",
                "payment_method": payment_method,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.inv_orders.insert_one(order_doc)
    except Exception as e:
        print(f"[ORDER-INV] Failed to auto-create order: {e}")
    # Send email notifications
    try:
        from services.email_invoice import send_payment_confirmation_to_customer, send_payment_notification_to_admin
        invoice = await db.inv_invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
        if invoice:
            send_payment_confirmation_to_customer(invoice)
            send_payment_notification_to_admin(invoice)
    except Exception as e:
        print(f"[EMAIL-INV] Notification error: {e}")
    # Record Converted Revenue for the matching CRM patient (idempotent — only on
    # the transition unpaid → paid). Match by phone or email from customer_details.
    if not was_already_paid:
        try:
            from routes.crm import record_revenue_conversion
            invoice = await db.inv_invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
            if invoice:
                cust = invoice.get("customer_details") or {}
                phone_raw = (cust.get("phone") or "").strip()
                phone = "".join(ch for ch in phone_raw if ch.isdigit())[-10:] if phone_raw else ""
                email = (cust.get("email") or "").strip().lower()
                patient = None
                if phone:
                    patient = await db.crm_patient_profiles.find_one(
                        {"$or": [{"phone": phone}, {"phone": {"$regex": phone + "$"}}]},
                        {"_id": 0, "id": 1, "name": 1},
                    )
                if not patient and email:
                    patient = await db.crm_patient_profiles.find_one(
                        {"email": {"$regex": f"^{email}$", "$options": "i"}},
                        {"_id": 0, "id": 1, "name": 1},
                    )
                amount = float(invoice.get("grand_total") or 0)
                if patient and amount > 0:
                    await record_revenue_conversion(
                        patient_id=patient["id"],
                        patient_name=patient.get("name") or cust.get("name") or "",
                        category="invoice_followup",
                        source=f"invoice_paid_{payment_method}",
                        amount=amount,
                        description=f"Invoice {invoice.get('invoice_number') or invoice_id} paid via {payment_method.upper()}",
                    )
        except Exception as e:
            logger.warning(f"[INV->CRM] Failed to record converted revenue: {e}")
    return {"status": "success", "message": "Payment verified"}

# ========= Order Management Routes =========

@router.get("/admin/orders")
async def get_all_orders(request: Request):
    await require_pm(request)
    orders = await db.inv_orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return orders

@router.patch("/admin/orders/{order_id}")
async def update_order_status(order_id: str, update_data: OrderStatusUpdate, request: Request):
    await require_pm(request)
    valid_statuses = ["Pending", "Processing", "Shipped", "Delivered"]
    if update_data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    result = await db.inv_orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": update_data.status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    order = await db.inv_orders.find_one({"order_id": order_id}, {"_id": 0})
    if order and order.get("invoice_id"):
        invoice_id = order["invoice_id"]
        status_map = {
            "Pending": {"delivery_status": "pending"},
            "Processing": {"delivery_status": "pending"},
            "Shipped": {"delivery_status": "dispatched"},
            "Delivered": {"delivery_status": "delivered"},
        }
        invoice_update = status_map.get(update_data.status, {})
        if invoice_update:
            invoice_update["tracking_updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.inv_invoices.update_one({"invoice_id": invoice_id}, {"$set": invoice_update})
        try:
            from services.email_invoice import send_delivery_status_email
            updated_invoice = await db.inv_invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
            if updated_invoice and update_data.status in ("Shipped", "Delivered"):
                ds = "dispatched" if update_data.status == "Shipped" else "delivered"
                send_delivery_status_email(updated_invoice, ds)
        except Exception as e:
            print(f"[EMAIL-INV] Order status sync error: {e}")
    return {"message": "Order status updated"}

@router.get("/orders")
async def get_my_orders(request: Request):
    user = await get_current_user(request)
    orders = await db.inv_orders.find({"customer_email": user["email"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # Strip courier-identifying fields from the customer-facing response.
    # The customer sees normalized status + last event + location + timeline,
    # but never the 1mg/ClickPost URL, carrier name, or AWB.
    HIDE = {"tracking_url", "tracking_carrier", "tracking_waybill"}
    for o in orders:
        # Add a safe boolean so the UI knows tracking is attached without exposing the URL
        o["has_tracking"] = bool(o.get("tracking_url"))
        for k in HIDE:
            o.pop(k, None)
        events = o.get("tracking_events") or []
        # Also clean per-event raw status fields that could expose courier-specific codes
        for ev in events:
            ev.pop("raw_status", None)
            ev.pop("bucket", None)
    return orders


# ========= Order Tracking Routes (1mg/ClickPost integration) =========
# Tracking is attached to the existing inv_order — no parallel record.
# Customer-facing API (`/api/inv/orders`) returns these fields too, but the
# frontend strips carrier/AWB before showing them to the customer.

# Mapping from scraped tracking_status -> internal status.
# Out for Delivery normalises to "Shipped" since admin already moves to "Delivered" on confirmation.
TRACKING_TO_INTERNAL_STATUS = {
    "Pending": "Pending",
    "Shipped": "Shipped",
    "In Transit": "Shipped",
    "Out for Delivery": "Shipped",
    "Delivered": "Delivered",
    "Cancelled": "Pending",  # let admin decide explicitly
    "Failed": "Pending",
}

ALLOWED_TRACKING_STATUSES = (
    "Pending", "Shipped", "In Transit", "Out for Delivery",
    "Delivered", "Cancelled", "Failed",
)
TRACKING_TERMINAL_STATUSES = {"Delivered", "Cancelled", "Failed"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _refresh_order_tracking(order: dict) -> dict:
    """Hit the tracker for one order; respect manual_override.

    Updates the inv_orders document in-place. Also auto-updates internal
    `status` when scraped tracking_status changes (unless tracking_manual_override
    is set, or admin has already moved the internal status manually past Pending).
    """
    from services.delivery_tracker import fetch_delivery_status, compute_flags

    if order.get("tracking_manual_override"):
        return order
    url = order.get("tracking_url")
    if not url:
        return order

    try:
        result = await fetch_delivery_status(url)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[Tracker] inv_order {order.get('order_id')} failed: {e}")
        await db.inv_orders.update_one(
            {"order_id": order["order_id"]},
            {"$set": {
                "tracking_last_error": str(e)[:300],
                "tracking_last_checked_at": _now_iso(),
            }},
        )
        return order

    is_stuck, _ = compute_flags(result["status"], result.get("last_event_at"))
    update = {
        "tracking_carrier": result.get("carrier"),
        "tracking_waybill": result.get("waybill"),
        "tracking_status": result["status"],
        "tracking_current_location": result.get("current_location") or "",
        "tracking_last_event": result.get("last_event") or "",
        "tracking_last_event_at": result.get("last_event_at"),
        "tracking_events": result.get("events") or [],
        "tracking_flags": {"stuck": is_stuck, "delayed": False},
        "tracking_last_checked_at": _now_iso(),
        "tracking_last_error": None,
        "updated_at": _now_iso(),
    }

    # Auto-sync internal status if not manually set beyond Pending.
    new_internal = TRACKING_TO_INTERNAL_STATUS.get(result["status"])
    if new_internal and order.get("status") in (None, "Pending", "Processing"):
        update["status"] = new_internal
    # Always upgrade to Delivered when courier confirms delivery
    if result["status"] == "Delivered":
        update["status"] = "Delivered"

    await db.inv_orders.update_one({"order_id": order["order_id"]}, {"$set": update})
    order.update(update)

    # Mirror to invoice delivery_status (Shipped/Delivered) for backward compat
    inv_id = order.get("invoice_id")
    if inv_id and "status" in update:
        ds = {"Shipped": "dispatched", "Delivered": "delivered"}.get(update["status"])
        if ds:
            await db.inv_invoices.update_one(
                {"invoice_id": inv_id},
                {"$set": {"delivery_status": ds, "tracking_updated_at": _now_iso()}},
            )

    return order


async def refresh_all_inv_orders_tracking() -> dict:
    """Scheduler entry-point: refresh every order with a tracking_url and a
    non-terminal tracking_status, that is not under manual override."""
    if db is None:
        return {"checked": 0, "updated": 0}
    pending = await db.inv_orders.find({
        "tracking_url": {"$nin": [None, ""]},
        "tracking_manual_override": {"$ne": True},
        "$or": [
            {"tracking_status": {"$exists": False}},
            {"tracking_status": {"$nin": list(TRACKING_TERMINAL_STATUSES)}},
        ],
    }, {"_id": 0}).to_list(length=500)

    changed = 0
    for order in pending:
        prev = order.get("tracking_status")
        await _refresh_order_tracking(order)
        if order.get("tracking_status") != prev:
            changed += 1
    logger.info(f"[Tracker] inv_orders refresh: checked={len(pending)} changed={changed}")
    return {"checked": len(pending), "updated": changed}


@router.patch("/admin/orders/{order_id}/tracking")
async def attach_order_tracking(order_id: str, body: OrderTrackingUpdate, request: Request):
    """Attach or clear the courier tracking URL on an inv_order. Triggers an
    initial fetch so admin sees the status immediately."""
    from services.delivery_tracker import detect_carrier, extract_waybill
    await require_pm(request)

    order = await db.inv_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    url = (body.tracking_url or "").strip() or None

    if url is None:
        # Clear all tracking fields
        clear = {
            "tracking_url": None,
            "tracking_carrier": None,
            "tracking_waybill": None,
            "tracking_status": None,
            "tracking_current_location": "",
            "tracking_last_event": "",
            "tracking_last_event_at": None,
            "tracking_events": [],
            "tracking_flags": {"stuck": False, "delayed": False},
            "tracking_manual_override": False,
            "tracking_last_checked_at": None,
            "tracking_last_error": None,
            "updated_at": _now_iso(),
        }
        await db.inv_orders.update_one({"order_id": order_id}, {"$set": clear})
        return {**order, **clear}

    update = {
        "tracking_url": url,
        "tracking_carrier": detect_carrier(url),
        "tracking_waybill": extract_waybill(url),
        "tracking_manual_override": False,
        "tracking_last_error": None,
        "updated_at": _now_iso(),
    }
    await db.inv_orders.update_one({"order_id": order_id}, {"$set": update})
    order.update(update)

    # Initial fetch (best-effort; scheduler will retry)
    try:
        await _refresh_order_tracking(order)
    except Exception as e:  # noqa: BLE001
        logger.debug(f"[Tracker] initial fetch failed: {e}")

    saved = await db.inv_orders.find_one({"order_id": order_id}, {"_id": 0})
    return saved


@router.post("/admin/orders/{order_id}/tracking/refresh")
async def refresh_order_tracking_now(order_id: str, request: Request):
    await require_pm(request)
    order = await db.inv_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not order.get("tracking_url"):
        raise HTTPException(status_code=400, detail="No tracking URL attached to this order")
    if order.get("tracking_manual_override"):
        raise HTTPException(status_code=400, detail="Manual override active — clear it first")
    await _refresh_order_tracking(order)
    saved = await db.inv_orders.find_one({"order_id": order_id}, {"_id": 0})
    return saved


@router.patch("/admin/orders/{order_id}/tracking/manual")
async def set_order_tracking_manual(order_id: str, body: OrderTrackingManualUpdate, request: Request):
    await require_pm(request)
    order = await db.inv_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    update: dict = {"updated_at": _now_iso()}
    if body.cancel_override:
        update["tracking_manual_override"] = False
    if body.tracking_status is not None:
        if body.tracking_status not in ALLOWED_TRACKING_STATUSES:
            raise HTTPException(status_code=400, detail=f"tracking_status must be in {ALLOWED_TRACKING_STATUSES}")
        update["tracking_status"] = body.tracking_status
        update["tracking_manual_override"] = True
        # When admin manually marks delivered/cancelled, auto-sync internal status too
        if body.tracking_status == "Delivered":
            update["status"] = "Delivered"
        elif body.tracking_status in ("Cancelled", "Failed"):
            # leave internal status — admin decides separately
            pass
        update["tracking_flags"] = {"stuck": False, "delayed": False}

    await db.inv_orders.update_one({"order_id": order_id}, {"$set": update})
    return await db.inv_orders.find_one({"order_id": order_id}, {"_id": 0})


@router.get("/admin/orders/flagged")
async def list_flagged_orders(request: Request, limit: int = 50):
    """Active or flagged shipments — used by the CRM Delivery Health widget."""
    await require_pm(request)
    flagged = await db.inv_orders.find(
        {"tracking_url": {"$nin": [None, ""]}, "tracking_flags.stuck": True},
        {"_id": 0},
    ).sort("tracking_last_event_at", 1).to_list(length=limit)

    active = await db.inv_orders.count_documents({
        "tracking_url": {"$nin": [None, ""]},
        "tracking_status": {"$nin": list(TRACKING_TERMINAL_STATUSES)},
    })

    # Enrich with patient name via customer_email
    emails = list({o.get("customer_email") for o in flagged if o.get("customer_email")})
    users = []
    if emails:
        users = await db.users.find({"email": {"$in": emails}}, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(length=len(emails))
    by_email = {u["email"]: u for u in users}
    for f in flagged:
        u = by_email.get(f.get("customer_email")) or {}
        f["patient_id"] = u.get("id")
        f["patient_name"] = u.get("name") or f.get("customer_name") or "Unknown"

    return {"flagged": flagged, "active_count": active, "flagged_count": len(flagged)}

# ========= CSV Export =========

@router.get("/export/invoices")
async def export_invoices_csv(request: Request):
    await require_pm(request)
    invoices = await db.inv_invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    import csv
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Invoice Number", "Type", "Customer", "Email", "Subtotal", "Tax", "Discount", "Total", "Status", "Payment Mode", "Date", "Due Date"])
    for inv in invoices:
        pm = inv.get("payment_method", "")
        payment_mode = "COD" if pm == "cod" else "Online" if pm == "online" else ""
        writer.writerow([
            inv.get("invoice_number", ""), inv.get("invoice_type", ""),
            inv.get("customer_details", {}).get("name", ""),
            inv.get("customer_details", {}).get("email", ""),
            inv.get("subtotal", 0), inv.get("total_tax", 0),
            inv.get("total_discount", 0), inv.get("grand_total", 0),
            inv.get("payment_status", ""), payment_mode,
            inv.get("created_at", ""), inv.get("due_date", "")
        ])
    output.seek(0)
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=invoices_export.csv"}
    )

# ========= DB Indexes =========

async def create_indexes():
    await db.inv_invoices.create_index("invoice_id", unique=True)
    await db.inv_invoices.create_index("invoice_number")
    await db.inv_coupons.create_index("code", unique=True)
    await db.inv_customers.create_index("customer_id", unique=True)
    await db.inv_orders.create_index("order_id", unique=True)
    await db.inv_orders.create_index("invoice_id")
