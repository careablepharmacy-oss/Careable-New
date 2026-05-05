"""
Invoice Management & Delivery Tracking System - Backend API Tests
Tests for: Invoice CRUD, Coupons, Seller Settings, Analytics, Payments (MOCKED), Monitors, Orders
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "test_inv_be5f4d593598"

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session with auth cookie"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    session.cookies.set("session_token", SESSION_TOKEN)
    return session


class TestInvoiceAnalytics:
    """Test analytics dashboard endpoint"""
    
    def test_dashboard_analytics(self, api_client):
        """GET /api/inv/analytics/dashboard - should return dashboard stats"""
        response = api_client.get(f"{BASE_URL}/api/inv/analytics/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify required fields exist
        assert "total_invoices" in data
        assert "total_products" in data
        assert "total_coupons" in data
        assert "total_revenue" in data
        assert "paid_revenue" in data
        assert "unpaid_revenue" in data
        assert "payment_methods" in data
        assert "recent_invoices" in data
        assert "monthly_data" in data
        print(f"✅ Dashboard: {data['total_invoices']} invoices, Rs.{data['total_revenue']} revenue")


class TestProductSearch:
    """Test medicine/product search endpoints"""
    
    def test_search_products(self, api_client):
        """GET /api/inv/products?search= - should search medicines"""
        response = api_client.get(f"{BASE_URL}/api/inv/products", params={"search": "para", "limit": 5})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "products" in data
        assert "total" in data
        assert isinstance(data["products"], list)
        print(f"✅ Product search: found {data['total']} products matching 'para'")
    
    def test_list_products_paginated(self, api_client):
        """GET /api/inv/products - should return paginated products"""
        response = api_client.get(f"{BASE_URL}/api/inv/products", params={"page": 1, "limit": 10})
        assert response.status_code == 200
        
        data = response.json()
        assert "products" in data
        assert "page" in data
        assert "pages" in data
        print(f"✅ Products list: page {data['page']} of {data['pages']}")


class TestSellerSettings:
    """Test seller settings CRUD"""
    
    def test_get_seller_settings(self, api_client):
        """GET /api/inv/settings/seller - should return seller settings"""
        response = api_client.get(f"{BASE_URL}/api/inv/settings/seller")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✅ Seller settings retrieved")
    
    def test_update_seller_settings(self, api_client):
        """PUT /api/inv/settings/seller - should update seller settings"""
        test_settings = {
            "business_name": "TEST_Careable 360+ Pharmacy",
            "address": "123 Test Street",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400001",
            "phone": "+91 9876543210",
            "email": "test@encare.com",
            "gst_number": "27AABCU9603R1ZM",
            "tax_id": "ABCDE1234F",
            "bank_name": "Test Bank",
            "bank_account_number": "1234567890",
            "bank_ifsc": "TEST0001234",
            "bank_branch": "Test Branch"
        }
        response = api_client.put(f"{BASE_URL}/api/inv/settings/seller", json=test_settings)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["business_name"] == test_settings["business_name"]
        assert data["gst_number"] == test_settings["gst_number"]
        print(f"✅ Seller settings updated: {data['business_name']}")
    
    def test_get_seller_settings_public(self, api_client):
        """GET /api/inv/settings/seller/public - should return public seller info"""
        response = api_client.get(f"{BASE_URL}/api/inv/settings/seller/public")
        assert response.status_code == 200
        print(f"✅ Public seller settings accessible")


class TestCouponManagement:
    """Test coupon CRUD operations"""
    
    @pytest.fixture(scope="class")
    def test_coupon_code(self):
        return f"TEST{uuid.uuid4().hex[:6].upper()}"
    
    def test_create_coupon(self, api_client, test_coupon_code):
        """POST /api/inv/coupons - should create a new coupon"""
        coupon_data = {
            "code": test_coupon_code,
            "discount_type": "percentage",
            "discount_value": 10,
            "min_order_value": 100,
            "max_discount": 50,
            "max_usage": 100
        }
        response = api_client.post(f"{BASE_URL}/api/inv/coupons", json=coupon_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["code"] == test_coupon_code
        assert data["discount_value"] == 10
        assert data["is_active"] == True
        assert "coupon_id" in data
        print(f"✅ Coupon created: {data['code']} ({data['discount_value']}% off)")
        return data["coupon_id"]
    
    def test_list_coupons(self, api_client):
        """GET /api/inv/coupons - should list all coupons"""
        response = api_client.get(f"{BASE_URL}/api/inv/coupons")
        assert response.status_code == 200
        
        data = response.json()
        assert "coupons" in data
        assert isinstance(data["coupons"], list)
        print(f"✅ Coupons list: {len(data['coupons'])} coupons")
    
    def test_toggle_coupon_status(self, api_client, test_coupon_code):
        """PUT /api/inv/coupons/{id} - should toggle coupon active status"""
        # First get the coupon
        list_response = api_client.get(f"{BASE_URL}/api/inv/coupons")
        coupons = list_response.json()["coupons"]
        test_coupon = next((c for c in coupons if c["code"] == test_coupon_code), None)
        
        if test_coupon:
            coupon_id = test_coupon["coupon_id"]
            response = api_client.put(f"{BASE_URL}/api/inv/coupons/{coupon_id}", json={"is_active": False})
            assert response.status_code == 200
            
            data = response.json()
            assert data["is_active"] == False
            print(f"✅ Coupon toggled to inactive: {test_coupon_code}")
        else:
            pytest.skip("Test coupon not found")
    
    def test_validate_coupon(self, api_client, test_coupon_code):
        """POST /api/inv/coupons/validate - should validate coupon"""
        # First reactivate the coupon
        list_response = api_client.get(f"{BASE_URL}/api/inv/coupons")
        coupons = list_response.json()["coupons"]
        test_coupon = next((c for c in coupons if c["code"] == test_coupon_code), None)
        
        if test_coupon:
            # Reactivate
            api_client.put(f"{BASE_URL}/api/inv/coupons/{test_coupon['coupon_id']}", json={"is_active": True})
            
            # Validate
            response = api_client.post(f"{BASE_URL}/api/inv/coupons/validate", json={
                "code": test_coupon_code,
                "order_total": 500
            })
            assert response.status_code == 200
            
            data = response.json()
            assert data["valid"] == True
            assert "discount_amount" in data
            print(f"✅ Coupon validated: discount Rs.{data['discount_amount']}")
        else:
            pytest.skip("Test coupon not found")


class TestInvoiceCRUD:
    """Test invoice create, read, list, delete operations"""
    
    @pytest.fixture(scope="class")
    def created_invoice_id(self, api_client):
        """Create a test invoice and return its ID"""
        invoice_data = {
            "invoice_type": "tax_invoice",
            "invoice_prefix": "TEST",
            "customer_details": {
                "name": "TEST_Customer",
                "email": "test@example.com",
                "phone": "+91 9876543210",
                "address": "123 Test Street, Mumbai"
            },
            "line_items": [
                {
                    "name": "Test Medicine A",
                    "quantity": 2,
                    "unit_price": 100,
                    "gst_rate": 5,
                    "gst_inclusive": False,
                    "discount_type": "percentage",
                    "discount_value": 0
                },
                {
                    "name": "Test Medicine B",
                    "quantity": 1,
                    "unit_price": 250,
                    "gst_rate": 12,
                    "gst_inclusive": False,
                    "discount_type": "fixed",
                    "discount_value": 10
                }
            ],
            "global_discount_type": "percentage",
            "global_discount_value": 5,
            "coupon_codes": [],
            "notes": "Test invoice for automated testing"
        }
        response = api_client.post(f"{BASE_URL}/api/inv/invoices", json=invoice_data)
        assert response.status_code == 200, f"Failed to create invoice: {response.text}"
        
        data = response.json()
        print(f"✅ Test invoice created: {data['invoice_number']} (ID: {data['invoice_id']})")
        return data["invoice_id"]
    
    def test_create_invoice(self, api_client, created_invoice_id):
        """POST /api/inv/invoices - verify invoice was created correctly"""
        # Get the created invoice to verify
        response = api_client.get(f"{BASE_URL}/api/inv/invoices/{created_invoice_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["invoice_id"] == created_invoice_id
        assert data["customer_details"]["name"] == "TEST_Customer"
        assert len(data["line_items"]) == 2
        assert data["payment_status"] == "unpaid"
        assert "public_token" in data
        assert data["grand_total"] > 0
        print(f"✅ Invoice verified: {data['invoice_number']}, Total: Rs.{data['grand_total']}")
    
    def test_list_invoices(self, api_client):
        """GET /api/inv/invoices - should list invoices with pagination"""
        response = api_client.get(f"{BASE_URL}/api/inv/invoices", params={"page": 1, "limit": 10})
        assert response.status_code == 200
        
        data = response.json()
        assert "invoices" in data
        assert "total" in data
        assert "page" in data
        assert "pages" in data
        print(f"✅ Invoice list: {data['total']} total, page {data['page']} of {data['pages']}")
    
    def test_list_invoices_with_search(self, api_client):
        """GET /api/inv/invoices?search= - should filter invoices"""
        response = api_client.get(f"{BASE_URL}/api/inv/invoices", params={"search": "TEST"})
        assert response.status_code == 200
        
        data = response.json()
        assert "invoices" in data
        print(f"✅ Invoice search: found {len(data['invoices'])} matching 'TEST'")
    
    def test_list_invoices_by_status(self, api_client):
        """GET /api/inv/invoices?status= - should filter by payment status"""
        response = api_client.get(f"{BASE_URL}/api/inv/invoices", params={"status": "unpaid"})
        assert response.status_code == 200
        
        data = response.json()
        for inv in data["invoices"]:
            assert inv["payment_status"] == "unpaid"
        print(f"✅ Invoice filter by status: {len(data['invoices'])} unpaid invoices")
    
    def test_get_invoice_by_id(self, api_client, created_invoice_id):
        """GET /api/inv/invoices/{id} - should return invoice details"""
        response = api_client.get(f"{BASE_URL}/api/inv/invoices/{created_invoice_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["invoice_id"] == created_invoice_id
        assert "line_items" in data
        assert "customer_details" in data
        assert "seller_details" in data
        print(f"✅ Invoice retrieved: {data['invoice_number']}")
    
    def test_get_public_invoice(self, api_client, created_invoice_id):
        """GET /api/inv/invoices/public/{id}/{token} - should return public invoice"""
        # First get the invoice to get the public token
        inv_response = api_client.get(f"{BASE_URL}/api/inv/invoices/{created_invoice_id}")
        invoice = inv_response.json()
        public_token = invoice.get("public_token")
        
        if public_token:
            response = api_client.get(f"{BASE_URL}/api/inv/invoices/public/{created_invoice_id}/{public_token}")
            assert response.status_code == 200
            
            data = response.json()
            assert data["invoice_id"] == created_invoice_id
            print(f"✅ Public invoice accessible: {data['invoice_number']}")
        else:
            pytest.skip("No public token found")


class TestPaymentFlow:
    """Test payment flow (MOCKED - no real payment gateway)"""
    
    @pytest.fixture(scope="class")
    def unpaid_invoice_id(self, api_client):
        """Create an unpaid invoice for payment testing"""
        invoice_data = {
            "invoice_type": "tax_invoice",
            "invoice_prefix": "PAY",
            "customer_details": {
                "name": "TEST_PaymentCustomer",
                "email": "payment@test.com",
                "phone": "+91 9999999999"
            },
            "line_items": [
                {"name": "Payment Test Item", "quantity": 1, "unit_price": 500, "gst_rate": 5}
            ]
        }
        response = api_client.post(f"{BASE_URL}/api/inv/invoices", json=invoice_data)
        assert response.status_code == 200
        return response.json()["invoice_id"]
    
    def test_create_payment_order(self, api_client, unpaid_invoice_id):
        """POST /api/inv/payments/create-order - should create payment order (MOCKED)"""
        response = api_client.post(f"{BASE_URL}/api/inv/payments/create-order", json={
            "invoice_id": unpaid_invoice_id
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "order_id" in data
        assert "payment_id" in data
        assert "amount" in data
        print(f"✅ Payment order created (MOCKED): {data['order_id']}")
        return data["payment_id"]
    
    def test_verify_online_payment(self, api_client, unpaid_invoice_id):
        """POST /api/inv/payments/verify - should verify online payment (MOCKED)"""
        # Create order first
        order_response = api_client.post(f"{BASE_URL}/api/inv/payments/create-order", json={
            "invoice_id": unpaid_invoice_id
        })
        payment_id = order_response.json()["payment_id"]
        
        # Verify payment
        response = api_client.post(f"{BASE_URL}/api/inv/payments/verify", json={
            "payment_id": payment_id,
            "invoice_id": unpaid_invoice_id,
            "payment_method": "online"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "success"
        
        # Verify invoice is now paid
        inv_response = api_client.get(f"{BASE_URL}/api/inv/invoices/{unpaid_invoice_id}")
        invoice = inv_response.json()
        assert invoice["payment_status"] == "paid"
        assert invoice["payment_method"] == "online"
        print(f"✅ Online payment verified (MOCKED): Invoice now paid")


class TestDeliveryTracking:
    """Test delivery status tracking"""
    
    @pytest.fixture(scope="class")
    def tracking_invoice_id(self, api_client):
        """Create an invoice for tracking tests"""
        invoice_data = {
            "invoice_type": "tax_invoice",
            "invoice_prefix": "TRK",
            "customer_details": {"name": "TEST_TrackingCustomer", "email": "track@test.com"},
            "line_items": [{"name": "Tracking Test Item", "quantity": 1, "unit_price": 200, "gst_rate": 5}]
        }
        response = api_client.post(f"{BASE_URL}/api/inv/invoices", json=invoice_data)
        return response.json()["invoice_id"]
    
    def test_update_delivery_status(self, api_client, tracking_invoice_id):
        """PUT /api/inv/invoices/{id}/tracking - should update delivery status"""
        response = api_client.put(f"{BASE_URL}/api/inv/invoices/{tracking_invoice_id}/tracking", json={
            "delivery_status": "dispatched"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["delivery_status"] == "dispatched"
        print(f"✅ Delivery status updated to: dispatched")
    
    def test_update_tracking_status(self, api_client, tracking_invoice_id):
        """PUT /api/inv/invoices/{id}/tracking - should update tracking status"""
        response = api_client.put(f"{BASE_URL}/api/inv/invoices/{tracking_invoice_id}/tracking", json={
            "tracking_status": "payment_pending"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["tracking_status"] == "payment_pending"
        print(f"✅ Tracking status updated to: payment_pending")


class TestMonitors:
    """Test COD and Online payment monitors"""
    
    def test_cod_monitor(self, api_client):
        """GET /api/inv/monitor/cod - should return COD orders stats"""
        response = api_client.get(f"{BASE_URL}/api/inv/monitor/cod")
        assert response.status_code == 200
        
        data = response.json()
        assert "invoices" in data
        assert "total" in data
        assert "total_amount" in data
        assert "tracking_stats" in data
        assert "delivery_stats" in data
        print(f"✅ COD Monitor: {data['total']} orders, Rs.{data['total_amount']}")
    
    def test_online_monitor(self, api_client):
        """GET /api/inv/monitor/online - should return online payment stats"""
        response = api_client.get(f"{BASE_URL}/api/inv/monitor/online")
        assert response.status_code == 200
        
        data = response.json()
        assert "invoices" in data
        assert "total" in data
        assert "total_amount" in data
        assert "tracking_stats" in data
        assert "delivery_stats" in data
        print(f"✅ Online Monitor: {data['total']} orders, Rs.{data['total_amount']}")


class TestOrderManagement:
    """Test order management endpoints"""
    
    def test_get_admin_orders(self, api_client):
        """GET /api/inv/admin/orders - should return all orders"""
        response = api_client.get(f"{BASE_URL}/api/inv/admin/orders")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Admin orders: {len(data)} orders")


class TestCustomerSearch:
    """Test customer search endpoints"""
    
    def test_search_customers(self, api_client):
        """GET /api/inv/customers?search= - should search customers"""
        response = api_client.get(f"{BASE_URL}/api/inv/customers", params={"search": "test"})
        assert response.status_code == 200
        
        data = response.json()
        assert "customers" in data
        print(f"✅ Customer search: found {len(data['customers'])} customers")


class TestCSVExport:
    """Test CSV export functionality"""
    
    def test_export_invoices_csv(self, api_client):
        """GET /api/inv/export/invoices - should return CSV file"""
        response = api_client.get(f"{BASE_URL}/api/inv/export/invoices")
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")
        
        # Verify CSV has content
        content = response.text
        assert "Invoice Number" in content or "invoice_number" in content.lower()
        print(f"✅ CSV export: {len(content)} bytes")


class TestCleanup:
    """Cleanup test data"""
    
    def test_delete_test_invoices(self, api_client):
        """Delete test invoices created during testing"""
        # Get all invoices
        response = api_client.get(f"{BASE_URL}/api/inv/invoices", params={"limit": 100})
        invoices = response.json().get("invoices", [])
        
        deleted = 0
        for inv in invoices:
            # Delete invoices with TEST prefix or TEST_ in customer name
            if (inv.get("invoice_number", "").startswith("TEST-") or 
                inv.get("invoice_number", "").startswith("PAY-") or
                inv.get("invoice_number", "").startswith("TRK-") or
                "TEST_" in inv.get("customer_details", {}).get("name", "")):
                try:
                    del_response = api_client.delete(f"{BASE_URL}/api/inv/invoices/{inv['invoice_id']}")
                    if del_response.status_code in [200, 204]:
                        deleted += 1
                except:
                    pass
        
        print(f"✅ Cleanup: deleted {deleted} test invoices")
    
    def test_delete_test_coupons(self, api_client):
        """Delete test coupons created during testing"""
        response = api_client.get(f"{BASE_URL}/api/inv/coupons")
        coupons = response.json().get("coupons", [])
        
        deleted = 0
        for cp in coupons:
            if cp.get("code", "").startswith("TEST"):
                try:
                    del_response = api_client.delete(f"{BASE_URL}/api/inv/coupons/{cp['coupon_id']}")
                    if del_response.status_code in [200, 204]:
                        deleted += 1
                except:
                    pass
        
        print(f"✅ Cleanup: deleted {deleted} test coupons")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
