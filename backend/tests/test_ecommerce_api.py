"""
E-commerce API Tests for Careable 360+ App
Tests product listing, filtering, subcategories, cart operations, and admin CRUD
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ==== PRODUCT LISTING TESTS (Public) ====

class TestProductListingPublic:
    """Test public product listing endpoints"""
    
    def test_get_all_medical_equipment_products(self):
        """Get all medical equipment products"""
        response = requests.get(f"{BASE_URL}/api/products?category=medical_equipment")
        assert response.status_code == 200
        products = response.json()
        assert isinstance(products, list)
        print(f"Found {len(products)} medical equipment products")
        if len(products) > 0:
            product = products[0]
            # Validate product structure
            assert "id" in product
            assert "name" in product
            assert "mrp" in product
            assert "selling_price" in product
            assert "category" in product
            assert product["category"] == "medical_equipment"
            print(f"First product: {product['name']} - ₹{product['selling_price']}")
    
    def test_get_all_personal_care_products(self):
        """Get all personal care products"""
        response = requests.get(f"{BASE_URL}/api/products?category=personal_care")
        assert response.status_code == 200
        products = response.json()
        assert isinstance(products, list)
        print(f"Found {len(products)} personal care products")
        if len(products) > 0:
            product = products[0]
            assert product["category"] == "personal_care"
            print(f"First product: {product['name']} - ₹{product['selling_price']}")
    
    def test_get_products_without_category(self):
        """Get all active products without category filter"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        products = response.json()
        assert isinstance(products, list)
        print(f"Found {len(products)} total active products")
    
    def test_product_has_required_fields(self):
        """Validate all required fields in product response"""
        response = requests.get(f"{BASE_URL}/api/products?category=medical_equipment")
        assert response.status_code == 200
        products = response.json()
        
        if len(products) > 0:
            product = products[0]
            required_fields = ["id", "name", "mrp", "selling_price", "category", "is_active"]
            for field in required_fields:
                assert field in product, f"Missing required field: {field}"
            print(f"Product has all required fields: {required_fields}")


class TestSubcategoryFilters:
    """Test subcategory filter endpoints"""
    
    def test_get_medical_equipment_subcategories(self):
        """Get subcategories for medical equipment"""
        response = requests.get(f"{BASE_URL}/api/products/subcategories?category=medical_equipment")
        assert response.status_code == 200
        subcategories = response.json()
        assert isinstance(subcategories, list)
        print(f"Medical equipment subcategories: {subcategories}")
    
    def test_get_personal_care_subcategories(self):
        """Get subcategories for personal care"""
        response = requests.get(f"{BASE_URL}/api/products/subcategories?category=personal_care")
        assert response.status_code == 200
        subcategories = response.json()
        assert isinstance(subcategories, list)
        print(f"Personal care subcategories: {subcategories}")
    
    def test_filter_by_subcategory(self):
        """Filter products by subcategory"""
        # First get subcategories
        response = requests.get(f"{BASE_URL}/api/products/subcategories?category=medical_equipment")
        subcategories = response.json()
        
        if len(subcategories) > 0:
            subcategory = subcategories[0]
            response = requests.get(f"{BASE_URL}/api/products?category=medical_equipment&subcategory={subcategory}")
            assert response.status_code == 200
            products = response.json()
            print(f"Found {len(products)} products in subcategory: {subcategory}")
            # All returned products should have this subcategory
            for product in products:
                assert product["subcategory"] == subcategory


class TestProductDetail:
    """Test single product retrieval"""
    
    def test_get_single_product_by_id(self):
        """Get a single product by its ID"""
        # First get a product ID
        response = requests.get(f"{BASE_URL}/api/products?category=medical_equipment")
        products = response.json()
        
        if len(products) > 0:
            product_id = products[0]["id"]
            response = requests.get(f"{BASE_URL}/api/products/{product_id}")
            assert response.status_code == 200
            product = response.json()
            assert product["id"] == product_id
            print(f"Retrieved product: {product['name']}")
    
    def test_get_nonexistent_product(self):
        """Get a product that doesn't exist"""
        response = requests.get(f"{BASE_URL}/api/products/nonexistent-product-id")
        assert response.status_code == 404


class TestCartNoAuth:
    """Test cart endpoints without authentication (should fail)"""
    
    def test_get_cart_without_auth(self):
        """Cart access without auth should fail with 401"""
        response = requests.get(f"{BASE_URL}/api/cart")
        assert response.status_code == 401
        print("Cart access correctly requires authentication")
    
    def test_add_to_cart_without_auth(self):
        """Add to cart without auth should fail with 401"""
        response = requests.post(f"{BASE_URL}/api/cart/add", json={
            "product_id": "test-id",
            "quantity": 1
        })
        assert response.status_code == 401
        print("Add to cart correctly requires authentication")


class TestAdminProductsNoAuth:
    """Test admin product endpoints without authentication (should fail)"""
    
    def test_admin_get_products_without_auth(self):
        """Admin product list without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/admin/products")
        assert response.status_code == 401
        print("Admin product list correctly requires authentication")
    
    def test_admin_create_product_without_auth(self):
        """Admin create product without auth should fail"""
        response = requests.post(f"{BASE_URL}/api/admin/products", json={
            "name": "Test Product",
            "mrp": 100,
            "selling_price": 80,
            "category": "medical_equipment"
        })
        assert response.status_code == 401
        print("Admin create product correctly requires authentication")


class TestSearchFunctionality:
    """Test product search functionality"""
    
    def test_search_products_by_name(self):
        """Search products by name"""
        response = requests.get(f"{BASE_URL}/api/products?search=Blood")
        assert response.status_code == 200
        products = response.json()
        print(f"Found {len(products)} products matching 'Blood'")
        # Products matching search term
        for product in products:
            # Name or description should contain the search term
            name_match = "blood" in product["name"].lower()
            desc_match = product.get("description") and "blood" in product["description"].lower()
            assert name_match or desc_match, f"Product {product['name']} doesn't match search"


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
