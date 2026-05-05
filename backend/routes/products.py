from fastapi import APIRouter, Request, HTTPException, UploadFile, File
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import io
import logging

# Import models from the main models.py file
from models import (
    Product, ProductCreate, ProductUpdate,
    Cart, CartItem, CartItemAdd, CartItemUpdate
)

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api")

# Database will be injected from server.py
db = None

def set_db(database):
    global db
    db = database

# Helper to get current user (imported from auth)
async def get_current_user(request: Request):
    from auth import get_current_user as auth_get_current_user
    return await auth_get_current_user(request, db)

# Helper to verify prescription manager role
async def get_prescription_manager(request: Request):
    from auth import get_prescription_manager as auth_get_pm
    return await auth_get_pm(request, db)

# ==================== PRODUCT ROUTES (PUBLIC) ====================

@router.get("/products", response_model=List[dict])
async def get_products(
    request: Request,
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    search: Optional[str] = None,
    is_active: bool = True
):
    """
    Get all products. Optionally filter by category, subcategory, or search term.
    Categories: "medical_equipment" or "personal_care"
    """
    query = {"is_active": is_active}
    
    if category:
        query["category"] = category
    
    if subcategory:
        query["subcategory"] = subcategory
    
    if search:
        # Case-insensitive search on name and description
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    products = await db.products.find(query, {"_id": 0}).sort("name", 1).to_list(1000)
    return products

@router.get("/products/subcategories")
async def get_subcategories(category: Optional[str] = None):
    """
    Get all unique subcategories, optionally filtered by category.
    """
    query = {}
    if category:
        query["category"] = category
    
    # Get distinct subcategories
    subcategories = await db.products.distinct("subcategory", query)
    # Filter out None values
    subcategories = [s for s in subcategories if s]
    return sorted(subcategories)

@router.get("/products/{product_id}")
async def get_product(product_id: str):
    """
    Get a single product by ID.
    """
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

# ==================== ADMIN PRODUCT ROUTES ====================

@router.get("/admin/products", response_model=List[dict])
async def admin_get_all_products(
    request: Request,
    category: Optional[str] = None,
    include_inactive: bool = True
):
    """
    Admin: Get all products including inactive ones.
    """
    await get_prescription_manager(request)
    
    query = {}
    if category:
        query["category"] = category
    if not include_inactive:
        query["is_active"] = True
    
    products = await db.products.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return products

@router.post("/admin/products")
async def admin_create_product(request: Request, product: ProductCreate):
    """
    Admin: Create a new product.
    """
    manager = await get_prescription_manager(request)
    
    # Calculate discount percent if not provided
    discount_percent = product.discount_percent
    if discount_percent is None and product.mrp > 0:
        discount_percent = round(((product.mrp - product.selling_price) / product.mrp) * 100, 1)
    
    new_product = Product(
        id=str(uuid.uuid4()),
        name=product.name,
        description=product.description,
        mrp=product.mrp,
        selling_price=product.selling_price,
        discount_percent=discount_percent,
        category=product.category,
        subcategory=product.subcategory,
        image_url=product.image_url,
        is_active=product.is_active,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    
    product_dict = new_product.dict()
    # Convert datetime to ISO string for MongoDB
    product_dict["created_at"] = new_product.created_at.isoformat()
    product_dict["updated_at"] = new_product.updated_at.isoformat()
    
    await db.products.insert_one(product_dict)
    
    # Remove _id before returning
    product_dict.pop("_id", None)
    
    logger.info(f"[Product] Created product: {new_product.name} by {manager.get('email')}")
    return product_dict

@router.put("/admin/products/{product_id}")
async def admin_update_product(request: Request, product_id: str, product: ProductUpdate):
    """
    Admin: Update an existing product.
    """
    manager = await get_prescription_manager(request)
    
    # Check if product exists
    existing = await db.products.find_one({"id": product_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Build update dict with only provided fields
    update_data = {k: v for k, v in product.dict().items() if v is not None}
    
    # Recalculate discount if prices changed
    if "mrp" in update_data or "selling_price" in update_data:
        mrp = update_data.get("mrp", existing.get("mrp", 0))
        selling_price = update_data.get("selling_price", existing.get("selling_price", 0))
        if mrp > 0:
            update_data["discount_percent"] = round(((mrp - selling_price) / mrp) * 100, 1)
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.products.update_one(
        {"id": product_id},
        {"$set": update_data}
    )
    
    # Get and return updated product
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    
    logger.info(f"[Product] Updated product: {product_id} by {manager.get('email')}")
    return updated

@router.delete("/admin/products/{product_id}")
async def admin_delete_product(request: Request, product_id: str):
    """
    Admin: Delete a product (soft delete by setting is_active=False, or hard delete).
    """
    manager = await get_prescription_manager(request)
    
    # Check if product exists
    existing = await db.products.find_one({"id": product_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Hard delete
    await db.products.delete_one({"id": product_id})
    
    # Also remove from all carts
    await db.carts.update_many(
        {},
        {"$pull": {"items": {"product_id": product_id}}}
    )
    
    logger.info(f"[Product] Deleted product: {product_id} by {manager.get('email')}")
    return {"message": "Product deleted successfully"}

@router.post("/admin/products/bulk-upload")
async def admin_bulk_upload_products(request: Request, file: UploadFile = File(...)):
    """
    Admin: Bulk upload products from Excel file.
    Expected columns: name, description, mrp, selling_price, discount_percent, category, subcategory, image_url
    """
    manager = await get_prescription_manager(request)
    
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl library not installed for Excel processing")
    
    # Read Excel file
    contents = await file.read()
    
    try:
        workbook = openpyxl.load_workbook(io.BytesIO(contents))
        sheet = workbook.active
        
        # Get headers from first row
        headers = [cell.value.lower().strip() if cell.value else "" for cell in sheet[1]]
        
        # Expected columns
        required_columns = ["name", "mrp", "selling_price", "category"]
        for col in required_columns:
            if col not in headers:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Missing required column: {col}. Required columns: {required_columns}"
                )
        
        # Process rows
        products_created = 0
        products_updated = 0
        errors = []
        
        for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            if not any(row):  # Skip empty rows
                continue
            
            # Create dict from row
            row_dict = {}
            for idx, value in enumerate(row):
                if idx < len(headers) and headers[idx]:
                    row_dict[headers[idx]] = value
            
            # Skip if name is empty
            if not row_dict.get("name"):
                continue
            
            try:
                # Parse values
                name = str(row_dict.get("name", "")).strip()
                description = str(row_dict.get("description", "")).strip() if row_dict.get("description") else None
                mrp = float(row_dict.get("mrp", 0))
                selling_price = float(row_dict.get("selling_price", 0))
                category = str(row_dict.get("category", "")).strip().lower().replace(" ", "_")
                subcategory = str(row_dict.get("subcategory", "")).strip() if row_dict.get("subcategory") else None
                image_url = str(row_dict.get("image_url", "")).strip() if row_dict.get("image_url") else None
                
                # Calculate discount
                discount_percent = row_dict.get("discount_percent")
                if discount_percent is None and mrp > 0:
                    discount_percent = round(((mrp - selling_price) / mrp) * 100, 1)
                else:
                    discount_percent = float(discount_percent) if discount_percent else 0
                
                # Validate category
                if category not in ["medical_equipment", "personal_care"]:
                    errors.append(f"Row {row_idx}: Invalid category '{category}'. Must be 'medical_equipment' or 'personal_care'")
                    continue
                
                # Check if product with same name exists
                existing = await db.products.find_one({"name": name, "category": category})
                
                if existing:
                    # Update existing product
                    update_data = {
                        "description": description,
                        "mrp": mrp,
                        "selling_price": selling_price,
                        "discount_percent": discount_percent,
                        "subcategory": subcategory,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                    if image_url:
                        update_data["image_url"] = image_url
                    
                    await db.products.update_one({"id": existing["id"]}, {"$set": update_data})
                    products_updated += 1
                else:
                    # Create new product
                    new_product = {
                        "id": str(uuid.uuid4()),
                        "name": name,
                        "description": description,
                        "mrp": mrp,
                        "selling_price": selling_price,
                        "discount_percent": discount_percent,
                        "category": category,
                        "subcategory": subcategory,
                        "image_url": image_url,
                        "is_active": True,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.products.insert_one(new_product)
                    products_created += 1
                    
            except Exception as e:
                errors.append(f"Row {row_idx}: {str(e)}")
        
        logger.info(f"[Product] Bulk upload: {products_created} created, {products_updated} updated by {manager.get('email')}")
        
        return {
            "success": True,
            "products_created": products_created,
            "products_updated": products_updated,
            "errors": errors[:20] if errors else []  # Return first 20 errors
        }
        
    except Exception as e:
        logger.error(f"[Product] Bulk upload error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error processing Excel file: {str(e)}")

# ==================== CART ROUTES ====================

@router.get("/cart")
async def get_cart(request: Request):
    """
    Get current user's cart with product details.
    """
    user = await get_current_user(request)
    user_id = user.get("id")
    
    logger.info(f"[Cart] Getting cart for user: {user_id}")
    
    cart = await db.carts.find_one({"user_id": user_id}, {"_id": 0})
    
    logger.info(f"[Cart] Found cart: {cart is not None}, items: {len(cart.get('items', [])) if cart else 0}")
    
    if not cart:
        return {"user_id": user_id, "items": [], "total": 0}
    
    # Populate product details for each cart item
    populated_items = []
    total = 0
    
    for item in cart.get("items", []):
        product = await db.products.find_one({"id": item["product_id"], "is_active": True}, {"_id": 0})
        if product:
            item_total = product["selling_price"] * item["quantity"]
            total += item_total
            populated_items.append({
                "product_id": item["product_id"],
                "quantity": item["quantity"],
                "product": product,
                "item_total": item_total
            })
    
    logger.info(f"[Cart] Returning {len(populated_items)} populated items, total: {total}")
    
    return {
        "user_id": user_id,
        "items": populated_items,
        "total": round(total, 2)
    }

@router.post("/cart/add")
async def add_to_cart(request: Request, item: CartItemAdd):
    """
    Add item to cart or increase quantity if already exists.
    """
    user = await get_current_user(request)
    user_id = user.get("id")
    
    logger.info(f"[Cart] Adding to cart for user: {user_id}, product: {item.product_id}, qty: {item.quantity}")
    
    # Verify product exists and is active
    product = await db.products.find_one({"id": item.product_id, "is_active": True})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or inactive")
    
    # Get or create cart
    cart = await db.carts.find_one({"user_id": user_id})
    
    logger.info(f"[Cart] Existing cart found: {cart is not None}")
    
    if not cart:
        # Create new cart
        new_cart = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "items": [{"product_id": item.product_id, "quantity": item.quantity}],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.carts.insert_one(new_cart)
        logger.info(f"[Cart] Created new cart with id: {new_cart['id']}")
    else:
        # Check if item already in cart
        existing_item = next((i for i in cart.get("items", []) if i["product_id"] == item.product_id), None)
        
        if existing_item:
            # Update quantity
            await db.carts.update_one(
                {"user_id": user_id, "items.product_id": item.product_id},
                {
                    "$inc": {"items.$.quantity": item.quantity},
                    "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
                }
            )
            logger.info("[Cart] Incremented quantity for existing item")
        else:
            # Add new item
            await db.carts.update_one(
                {"user_id": user_id},
                {
                    "$push": {"items": {"product_id": item.product_id, "quantity": item.quantity}},
                    "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
                }
            )
            logger.info("[Cart] Added new item to cart")
    
    # Return updated cart
    return await get_cart(request)
    
    # Return updated cart
    return await get_cart(request)

@router.put("/cart/update")
async def update_cart_item(request: Request, product_id: str, update: CartItemUpdate):
    """
    Update quantity of an item in cart.
    """
    user = await get_current_user(request)
    
    if update.quantity <= 0:
        # Remove item if quantity is 0 or negative
        await db.carts.update_one(
            {"user_id": user["id"]},
            {
                "$pull": {"items": {"product_id": product_id}},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
    else:
        # Update quantity
        await db.carts.update_one(
            {"user_id": user["id"], "items.product_id": product_id},
            {
                "$set": {
                    "items.$.quantity": update.quantity,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    
    return await get_cart(request)

@router.delete("/cart/remove/{product_id}")
async def remove_from_cart(request: Request, product_id: str):
    """
    Remove an item from cart.
    """
    user = await get_current_user(request)
    
    await db.carts.update_one(
        {"user_id": user["id"]},
        {
            "$pull": {"items": {"product_id": product_id}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return await get_cart(request)

@router.delete("/cart/clear")
async def clear_cart(request: Request):
    """
    Clear all items from cart.
    """
    user = await get_current_user(request)
    
    await db.carts.update_one(
        {"user_id": user["id"]},
        {
            "$set": {
                "items": [],
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"user_id": user["id"], "items": [], "total": 0}
