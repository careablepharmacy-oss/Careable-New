from fastapi import APIRouter, Request, HTTPException
from datetime import datetime, timezone
import uuid
import os
import hmac
import hashlib
import logging
import razorpay

from models import (
    Address, Order, OrderItem, CheckoutRequest
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

db = None
razorpay_client = None

def set_db(database):
    global db, razorpay_client
    db = database
    key_id = os.environ.get("RAZORPAY_KEY_ID")
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET")
    if key_id and key_secret:
        razorpay_client = razorpay.Client(auth=(key_id, key_secret))
        logger.info("[Razorpay] Client initialized")
    else:
        logger.warning("[Razorpay] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET")


async def get_current_user(request: Request):
    from auth import get_current_user as auth_get_current_user
    return await auth_get_current_user(request, db)


def generate_order_number():
    now = datetime.now(timezone.utc)
    return f"ORD-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"


@router.post("/checkout/create-order")
async def create_checkout_order(request: Request, checkout: CheckoutRequest):
    """
    Create a Razorpay order from the user's cart.
    Saves billing/shipping addresses and returns Razorpay order details.
    """
    user = await get_current_user(request)
    user_id = user.get("id")

    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")

    # Get user's cart
    cart = await db.carts.find_one({"user_id": user_id}, {"_id": 0})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")

    # Build order items and calculate total
    order_items = []
    subtotal = 0
    total_mrp = 0

    for cart_item in cart["items"]:
        product = await db.products.find_one(
            {"id": cart_item["product_id"], "is_active": True}, {"_id": 0}
        )
        if not product:
            continue

        item_total = product["selling_price"] * cart_item["quantity"]
        mrp_total = product["mrp"] * cart_item["quantity"]
        subtotal += item_total
        total_mrp += mrp_total

        order_items.append(OrderItem(
            product_id=product["id"],
            product_name=product["name"],
            quantity=cart_item["quantity"],
            mrp=product["mrp"],
            selling_price=product["selling_price"],
            item_total=item_total,
            image_url=product.get("image_url")
        ))

    if not order_items:
        raise HTTPException(status_code=400, detail="No valid products in cart")

    discount = round(total_mrp - subtotal, 2)
    total = round(subtotal, 2)
    amount_paise = int(total * 100)

    order_number = generate_order_number()

    # Create Razorpay order
    try:
        razorpay_order = razorpay_client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": order_number[:40],
            "payment_capture": 1
        })
    except Exception as e:
        logger.error(f"[Razorpay] Order creation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create payment order")

    # Save order to DB (payment_status = pending)
    order = Order(
        id=str(uuid.uuid4()),
        user_id=user_id,
        order_number=order_number,
        items=[item.dict() for item in order_items],
        billing_address=checkout.billing_address,
        shipping_address=checkout.shipping_address,
        subtotal=subtotal,
        discount=discount,
        delivery_charge=0,
        total=total,
        razorpay_order_id=razorpay_order["id"],
        payment_status="pending",
        order_status="pending",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )

    order_dict = order.dict()
    order_dict["created_at"] = order.created_at.isoformat()
    order_dict["updated_at"] = order.updated_at.isoformat()

    await db.orders.insert_one(order_dict)

    logger.info(f"[Checkout] Order {order_number} created for user {user_id}, amount: {total}")

    return {
        "order_id": order.id,
        "order_number": order_number,
        "razorpay_order_id": razorpay_order["id"],
        "razorpay_key_id": os.environ.get("RAZORPAY_KEY_ID"),
        "amount": amount_paise,
        "currency": "INR",
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "user_phone": user.get("phone", "")
    }


@router.post("/checkout/verify-payment")
async def verify_payment(request: Request):
    """
    Verify Razorpay payment signature and finalize order.
    """
    user = await get_current_user(request)
    body = await request.json()

    razorpay_order_id = body.get("razorpay_order_id")
    razorpay_payment_id = body.get("razorpay_payment_id")
    razorpay_signature = body.get("razorpay_signature")
    order_id = body.get("order_id")

    if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id]):
        raise HTTPException(status_code=400, detail="Missing payment verification fields")

    # Verify signature
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET", "")
    message = f"{razorpay_order_id}|{razorpay_payment_id}"
    expected_signature = hmac.new(
        key_secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    if expected_signature != razorpay_signature:
        # Update order as failed
        await db.orders.update_one(
            {"id": order_id, "user_id": user["id"]},
            {"$set": {
                "payment_status": "failed",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.warning(f"[Checkout] Payment signature mismatch for order {order_id}")
        raise HTTPException(status_code=400, detail="Payment verification failed")

    # Update order as paid
    await db.orders.update_one(
        {"id": order_id, "user_id": user["id"]},
        {"$set": {
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
            "payment_status": "paid",
            "order_status": "confirmed",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    # Clear user's cart after successful payment
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$set": {"items": [], "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    logger.info(f"[Checkout] Payment verified for order {order_id}, payment: {razorpay_payment_id}")

    return {"success": True, "order_id": order_id, "message": "Payment verified successfully"}


@router.get("/orders")
async def get_orders(request: Request):
    """
    Get all orders for the current user.
    """
    user = await get_current_user(request)
    orders = await db.orders.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return orders


@router.get("/orders/{order_id}")
async def get_order(request: Request, order_id: str):
    """
    Get a specific order by ID.
    """
    user = await get_current_user(request)
    order = await db.orders.find_one(
        {"id": order_id, "user_id": user["id"]},
        {"_id": 0}
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order
