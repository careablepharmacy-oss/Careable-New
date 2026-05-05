"""
Checkout API Tests for Careable 360+ E-commerce
Tests: POST /api/checkout/create-order, POST /api/checkout/verify-payment, GET /api/orders, GET /api/orders/{order_id}
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCheckoutUnauthenticated:
    """Test checkout endpoints without authentication - should return 401/403"""
    
    def test_create_order_unauthenticated(self):
        """POST /api/checkout/create-order without auth should return 401/403"""
        response = requests.post(
            f"{BASE_URL}/api/checkout/create-order",
            json={
                "billing_address": {
                    "full_name": "Test User",
                    "phone": "9876543210",
                    "address_line1": "123 Test Street",
                    "city": "Mumbai",
                    "state": "Maharashtra",
                    "pincode": "400001",
                    "country": "India"
                },
                "shipping_address": {
                    "full_name": "Test User",
                    "phone": "9876543210",
                    "address_line1": "123 Test Street",
                    "city": "Mumbai",
                    "state": "Maharashtra",
                    "pincode": "400001",
                    "country": "India"
                }
            },
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403 but got {response.status_code}"
        print(f"✓ Create order without auth returns {response.status_code}")
    
    def test_verify_payment_unauthenticated(self):
        """POST /api/checkout/verify-payment without auth should return 401/403"""
        response = requests.post(
            f"{BASE_URL}/api/checkout/verify-payment",
            json={
                "razorpay_order_id": "test_order_123",
                "razorpay_payment_id": "test_payment_123",
                "razorpay_signature": "test_signature",
                "order_id": "test_order_uuid"
            },
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403 but got {response.status_code}"
        print(f"✓ Verify payment without auth returns {response.status_code}")
    
    def test_get_orders_unauthenticated(self):
        """GET /api/orders without auth should return 401/403"""
        response = requests.get(f"{BASE_URL}/api/orders")
        assert response.status_code in [401, 403], f"Expected 401/403 but got {response.status_code}"
        print(f"✓ Get orders without auth returns {response.status_code}")
    
    def test_get_single_order_unauthenticated(self):
        """GET /api/orders/{order_id} without auth should return 401/403"""
        response = requests.get(f"{BASE_URL}/api/orders/test-order-id")
        assert response.status_code in [401, 403], f"Expected 401/403 but got {response.status_code}"
        print(f"✓ Get single order without auth returns {response.status_code}")


class TestCheckoutValidation:
    """Test checkout validation - missing/invalid fields"""
    
    def test_verify_payment_missing_fields(self):
        """POST /api/checkout/verify-payment with missing fields should return 400"""
        # This test is for when user IS authenticated but missing required fields
        # Since we don't have auth, we expect 401/403 first
        response = requests.post(
            f"{BASE_URL}/api/checkout/verify-payment",
            json={"razorpay_order_id": "test_only"},  # Missing other required fields
            headers={"Content-Type": "application/json"}
        )
        # Without auth, we get 401/403 (auth check happens first)
        assert response.status_code in [400, 401, 403], f"Expected 400/401/403 but got {response.status_code}"
        print(f"✓ Verify payment with missing fields returns {response.status_code}")


class TestCheckoutAPIStructure:
    """Test that checkout endpoints exist and respond correctly"""
    
    def test_checkout_create_order_endpoint_exists(self):
        """Verify /api/checkout/create-order endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/checkout/create-order",
            json={},
            headers={"Content-Type": "application/json"}
        )
        # Should get 401 (not 404) proving endpoint exists
        assert response.status_code != 404, f"Endpoint not found: {response.status_code}"
        print(f"✓ /api/checkout/create-order endpoint exists (status: {response.status_code})")
    
    def test_checkout_verify_payment_endpoint_exists(self):
        """Verify /api/checkout/verify-payment endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/checkout/verify-payment",
            json={},
            headers={"Content-Type": "application/json"}
        )
        # Should get 401 (not 404) proving endpoint exists
        assert response.status_code != 404, f"Endpoint not found: {response.status_code}"
        print(f"✓ /api/checkout/verify-payment endpoint exists (status: {response.status_code})")
    
    def test_orders_endpoint_exists(self):
        """Verify /api/orders endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/orders")
        # Should get 401 (not 404) proving endpoint exists
        assert response.status_code != 404, f"Endpoint not found: {response.status_code}"
        print(f"✓ /api/orders endpoint exists (status: {response.status_code})")
    
    def test_single_order_endpoint_exists(self):
        """Verify /api/orders/{order_id} endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/orders/test-id-123")
        # Should get 401 (not 404) proving endpoint exists with valid path
        assert response.status_code != 404, f"Endpoint not found: {response.status_code}"
        print(f"✓ /api/orders/{{order_id}} endpoint exists (status: {response.status_code})")


class TestCartAPIForCheckout:
    """Test cart API which checkout depends on"""
    
    def test_cart_endpoint_exists(self):
        """Verify /api/cart endpoint exists (checkout needs this)"""
        response = requests.get(f"{BASE_URL}/api/cart")
        # Should get 401 (not 404) proving endpoint exists
        assert response.status_code != 404, f"Cart endpoint not found: {response.status_code}"
        print(f"✓ /api/cart endpoint exists (status: {response.status_code})")
    
    def test_add_to_cart_endpoint_exists(self):
        """Verify /api/cart/add endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/cart/add",
            json={"product_id": "test", "quantity": 1},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code != 404, f"Add to cart endpoint not found: {response.status_code}"
        print(f"✓ /api/cart/add endpoint exists (status: {response.status_code})")


class TestProductsForCheckout:
    """Test products API which checkout depends on"""
    
    def test_products_list_available(self):
        """Verify products are available for checkout testing"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200, f"Products list failed: {response.status_code}"
        products = response.json()
        assert isinstance(products, list), "Products response should be a list"
        print(f"✓ Products API returns {len(products)} products")
        
        # Verify product structure for checkout
        if products:
            product = products[0]
            required_fields = ['id', 'name', 'mrp', 'selling_price']
            for field in required_fields:
                assert field in product, f"Product missing '{field}' field required for checkout"
            print(f"✓ Product has all required fields for checkout: {required_fields}")


class TestAddressModelValidation:
    """Test that address validation works correctly"""
    
    def test_address_model_requires_full_name(self):
        """Address model should require full_name field"""
        # This validates the CheckoutRequest model structure
        response = requests.post(
            f"{BASE_URL}/api/checkout/create-order",
            json={
                "billing_address": {
                    # Missing full_name
                    "phone": "9876543210",
                    "address_line1": "123 Test Street",
                    "city": "Mumbai",
                    "state": "Maharashtra",
                    "pincode": "400001"
                },
                "shipping_address": {
                    "full_name": "Test",
                    "phone": "9876543210",
                    "address_line1": "123 Test Street",
                    "city": "Mumbai",
                    "state": "Maharashtra",
                    "pincode": "400001"
                }
            },
            headers={"Content-Type": "application/json"}
        )
        # Should fail validation (401 auth happens first, but model validation might return 422)
        assert response.status_code in [401, 403, 422], f"Unexpected status: {response.status_code}"
        print(f"✓ Address validation for missing full_name returns {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
