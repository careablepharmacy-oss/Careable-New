"""
Test Suite for Product Sorting API
Tests the GET /api/products endpoint returns required fields for frontend sorting
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestProductSortingAPI:
    """Tests for product API endpoints used by sorting feature"""

    def test_medical_equipment_products_returns_sorting_fields(self):
        """GET /api/products?category=medical_equipment returns products with sorting fields"""
        response = requests.get(f"{BASE_URL}/api/products?category=medical_equipment")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        products = response.json()
        assert len(products) > 0, "Expected at least one product"
        
        # Check first product has required sorting fields
        product = products[0]
        assert "name" in product, "Product should have 'name' field"
        assert "selling_price" in product, "Product should have 'selling_price' field"
        assert "discount_percent" in product or product.get("discount_percent") is not None, "Product should have 'discount_percent' field"
        
        print(f"✓ Medical equipment: {len(products)} products returned with sorting fields")

    def test_personal_care_products_returns_sorting_fields(self):
        """GET /api/products?category=personal_care returns products with sorting fields"""
        response = requests.get(f"{BASE_URL}/api/products?category=personal_care")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        products = response.json()
        assert len(products) > 0, "Expected at least one product"
        
        # Check all products have required sorting fields
        for product in products:
            assert "name" in product, f"Product missing 'name': {product}"
            assert "selling_price" in product, f"Product missing 'selling_price': {product}"
            assert "discount_percent" in product or product.get("discount_percent") is not None, f"Product missing 'discount_percent': {product}"
        
        print(f"✓ Personal care: {len(products)} products returned with sorting fields")

    def test_products_sorted_alphabetically_by_backend(self):
        """Backend returns products sorted alphabetically by name (default)"""
        response = requests.get(f"{BASE_URL}/api/products?category=medical_equipment")
        assert response.status_code == 200
        
        products = response.json()
        names = [p["name"] for p in products]
        sorted_names = sorted(names)
        
        assert names == sorted_names, f"Products should be sorted alphabetically by backend. Got: {names}"
        print(f"✓ Products returned in alphabetical order: {names}")

    def test_medical_equipment_product_data_values(self):
        """Verify specific medical equipment product data for sort verification"""
        response = requests.get(f"{BASE_URL}/api/products?category=medical_equipment")
        assert response.status_code == 200
        
        products = response.json()
        products_by_name = {p["name"]: p for p in products}
        
        # Expected products based on problem statement
        expected_products = [
            ("Digital Thermometer", 249, 37.6),
            ("Dr. Morepen", 899, 30.8),
            ("Omron", 1899, 24.0),
            ("Pulse Oximeter", 599, 40.0),
            ("VICTORY Cotton", 299, 62.6),
        ]
        
        for name_prefix, expected_price, expected_discount in expected_products:
            matching = [p for p in products if name_prefix in p["name"]]
            assert len(matching) == 1, f"Expected to find product containing '{name_prefix}'"
            product = matching[0]
            assert product["selling_price"] == expected_price, f"{name_prefix}: Expected price {expected_price}, got {product['selling_price']}"
            assert abs(product["discount_percent"] - expected_discount) < 0.5, f"{name_prefix}: Expected discount ~{expected_discount}, got {product['discount_percent']}"
        
        print("✓ All medical equipment product data verified for sorting")

    def test_sort_order_price_low_to_high(self):
        """Verify expected price low to high order: Thermometer(249) < VICTORY(299) < Oximeter(599) < Morepen(899) < Omron(1899)"""
        response = requests.get(f"{BASE_URL}/api/products?category=medical_equipment")
        assert response.status_code == 200
        
        products = response.json()
        # Sort by price low to high
        sorted_products = sorted(products, key=lambda p: p["selling_price"])
        prices = [p["selling_price"] for p in sorted_products]
        
        expected_order = [249, 299, 599, 899, 1899]
        assert prices == expected_order, f"Price low-high order should be {expected_order}, got {prices}"
        print(f"✓ Price low-high order verified: {[p['name'][:15] for p in sorted_products]}")

    def test_sort_order_price_high_to_low(self):
        """Verify expected price high to low order"""
        response = requests.get(f"{BASE_URL}/api/products?category=medical_equipment")
        assert response.status_code == 200
        
        products = response.json()
        # Sort by price high to low
        sorted_products = sorted(products, key=lambda p: p["selling_price"], reverse=True)
        prices = [p["selling_price"] for p in sorted_products]
        
        expected_order = [1899, 899, 599, 299, 249]
        assert prices == expected_order, f"Price high-low order should be {expected_order}, got {prices}"
        print(f"✓ Price high-low order verified: {[p['name'][:15] for p in sorted_products]}")

    def test_sort_order_discount_highest_first(self):
        """Verify expected discount order: VICTORY(62.6) > Oximeter(40) > Thermometer(37.6) > Morepen(30.8) > Omron(24)"""
        response = requests.get(f"{BASE_URL}/api/products?category=medical_equipment")
        assert response.status_code == 200
        
        products = response.json()
        # Sort by discount highest first
        sorted_products = sorted(products, key=lambda p: p.get("discount_percent", 0), reverse=True)
        discounts = [p.get("discount_percent", 0) for p in sorted_products]
        
        expected_order = [62.6, 40.0, 37.6, 30.8, 24.0]
        assert discounts == expected_order, f"Discount order should be {expected_order}, got {discounts}"
        print(f"✓ Discount highest-first order verified: {[p['name'][:15] for p in sorted_products]}")

    def test_personal_care_sorting_data(self):
        """Verify personal care products have sorting data"""
        response = requests.get(f"{BASE_URL}/api/products?category=personal_care")
        assert response.status_code == 200
        
        products = response.json()
        
        # Verify alphabetical order by name
        names = [p["name"] for p in products]
        assert names == sorted(names), f"Products should be alphabetically sorted"
        
        # Verify price data exists
        for p in products:
            assert p["selling_price"] > 0, f"Product {p['name']} should have positive selling_price"
            assert p.get("discount_percent", 0) >= 0, f"Product {p['name']} should have valid discount_percent"
        
        print(f"✓ Personal care products: {names}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
