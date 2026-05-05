"""
Caregiver API Tests - Careable 360+ Medication Reminder App

Tests for caregiver invitation flow, acceptance, dashboard, and notification preferences.
Database collection: caregiver_links

Endpoints tested:
- POST /api/caregiver/invite - Patient creates invite for caregiver
- GET /api/caregiver/invite/{token} - Get invite details (public)
- POST /api/caregiver/accept/{token} - Caregiver accepts invite (authenticated)
- GET /api/caregiver/my-caregiver - Patient views linked caregiver
- GET /api/caregiver/my-patient - Caregiver views linked patient
- GET /api/caregiver/patient/{id}/medications - Get patient's medications
- GET /api/caregiver/patient/{id}/adherence - Get patient's adherence logs
- PUT /api/caregiver/preferences - Update notification preferences
- DELETE /api/caregiver/unlink - Unlink caregiver relationship
"""

import pytest
import requests
import os
import secrets
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://careable-preview.preview.emergentagent.com').rstrip('/')


class TestCaregiverPublicEndpoints:
    """Tests for public caregiver endpoints (no authentication required)"""
    
    def test_get_invite_invalid_token_returns_404(self):
        """GET /api/caregiver/invite/{token} - Returns 404 for invalid token"""
        response = requests.get(f"{BASE_URL}/api/caregiver/invite/invalid_token_abc123")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower() or "expired" in data["detail"].lower()
        print("✅ GET /api/caregiver/invite/{invalid_token} returns 404 correctly")

    def test_get_invite_random_token_returns_404(self):
        """GET /api/caregiver/invite/{token} - Returns 404 for random token"""
        random_token = secrets.token_urlsafe(32)
        response = requests.get(f"{BASE_URL}/api/caregiver/invite/{random_token}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ GET /api/caregiver/invite/{random_token} returns 404 correctly")


class TestCaregiverAuthenticatedEndpoints:
    """Tests for authenticated caregiver endpoints"""
    
    def test_invite_without_auth_returns_401(self):
        """POST /api/caregiver/invite - Returns 401 without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/caregiver/invite",
            json={"caregiver_phone": "9876543210"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ POST /api/caregiver/invite returns 401 without auth")

    def test_my_caregiver_without_auth_returns_401(self):
        """GET /api/caregiver/my-caregiver - Returns 401 without authentication"""
        response = requests.get(f"{BASE_URL}/api/caregiver/my-caregiver")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ GET /api/caregiver/my-caregiver returns 401 without auth")

    def test_my_patient_without_auth_returns_401(self):
        """GET /api/caregiver/my-patient - Returns 401 without authentication"""
        response = requests.get(f"{BASE_URL}/api/caregiver/my-patient")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ GET /api/caregiver/my-patient returns 401 without auth")

    def test_accept_invite_without_auth_returns_401(self):
        """POST /api/caregiver/accept/{token} - Returns 401 without authentication"""
        response = requests.post(f"{BASE_URL}/api/caregiver/accept/some_token")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ POST /api/caregiver/accept/{token} returns 401 without auth")

    def test_unlink_without_auth_returns_401(self):
        """DELETE /api/caregiver/unlink - Returns 401 without authentication"""
        response = requests.delete(f"{BASE_URL}/api/caregiver/unlink")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ DELETE /api/caregiver/unlink returns 401 without auth")

    def test_preferences_without_auth_returns_401(self):
        """PUT /api/caregiver/preferences - Returns 401 without authentication"""
        response = requests.put(
            f"{BASE_URL}/api/caregiver/preferences",
            json={"notify_on_taken": True, "notify_on_missed": True},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ PUT /api/caregiver/preferences returns 401 without auth")

    def test_patient_medications_without_auth_returns_401(self):
        """GET /api/caregiver/patient/{id}/medications - Returns 401 without authentication"""
        response = requests.get(f"{BASE_URL}/api/caregiver/patient/some_patient_id/medications")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ GET /api/caregiver/patient/{id}/medications returns 401 without auth")

    def test_patient_adherence_without_auth_returns_401(self):
        """GET /api/caregiver/patient/{id}/adherence - Returns 401 without authentication"""
        response = requests.get(f"{BASE_URL}/api/caregiver/patient/some_patient_id/adherence")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ GET /api/caregiver/patient/{id}/adherence returns 401 without auth")


class TestCaregiverEndpointExists:
    """Verify all caregiver endpoints are registered and respond"""
    
    def test_invite_endpoint_exists(self):
        """POST /api/caregiver/invite - Endpoint exists (401 or 422 proves route exists)"""
        response = requests.post(
            f"{BASE_URL}/api/caregiver/invite",
            json={"caregiver_phone": "9876543210"}
        )
        # 401 Unauthorized proves endpoint exists, 422 validation error also valid
        assert response.status_code in [401, 422], f"Unexpected status: {response.status_code}"
        print("✅ POST /api/caregiver/invite endpoint exists")

    def test_my_caregiver_endpoint_exists(self):
        """GET /api/caregiver/my-caregiver - Endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/caregiver/my-caregiver")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ GET /api/caregiver/my-caregiver endpoint exists")

    def test_my_patient_endpoint_exists(self):
        """GET /api/caregiver/my-patient - Endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/caregiver/my-patient")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ GET /api/caregiver/my-patient endpoint exists")

    def test_accept_endpoint_exists(self):
        """POST /api/caregiver/accept/{token} - Endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/caregiver/accept/test_token")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ POST /api/caregiver/accept/{token} endpoint exists")

    def test_preferences_endpoint_exists(self):
        """PUT /api/caregiver/preferences - Endpoint exists"""
        response = requests.put(
            f"{BASE_URL}/api/caregiver/preferences",
            json={"notify_on_taken": True}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ PUT /api/caregiver/preferences endpoint exists")

    def test_unlink_endpoint_exists(self):
        """DELETE /api/caregiver/unlink - Endpoint exists"""
        response = requests.delete(f"{BASE_URL}/api/caregiver/unlink")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ DELETE /api/caregiver/unlink endpoint exists")

    def test_patient_medications_endpoint_exists(self):
        """GET /api/caregiver/patient/{id}/medications - Endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/caregiver/patient/test_id/medications")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ GET /api/caregiver/patient/{id}/medications endpoint exists")

    def test_patient_adherence_endpoint_exists(self):
        """GET /api/caregiver/patient/{id}/adherence - Endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/caregiver/patient/test_id/adherence")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ GET /api/caregiver/patient/{id}/adherence endpoint exists")


class TestCaregiverAPIResponseFormat:
    """Test response format and error handling"""
    
    def test_invite_invalid_token_response_format(self):
        """Verify 404 response format for invalid invite token"""
        response = requests.get(f"{BASE_URL}/api/caregiver/invite/invalid_12345")
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data, "Response should have 'detail' field"
        assert isinstance(data["detail"], str), "Detail should be a string"
        print("✅ 404 response has correct format with 'detail' field")

    def test_auth_error_response_format(self):
        """Verify 401 response format"""
        response = requests.get(f"{BASE_URL}/api/caregiver/my-caregiver")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data, "401 response should have 'detail' field"
        print("✅ 401 response has correct format")


class TestCaregiverRouterRegistration:
    """Verify caregiver router is properly registered in server.py"""
    
    def test_all_routes_respond(self):
        """Test that all caregiver routes are accessible (not 404 Method Not Allowed or Not Found for wrong route)"""
        routes_to_test = [
            ("GET", "/api/caregiver/my-caregiver", 401),
            ("GET", "/api/caregiver/my-patient", 401),
            ("DELETE", "/api/caregiver/unlink", 401),
            ("PUT", "/api/caregiver/preferences", 401),
        ]
        
        for method, path, expected_status in routes_to_test:
            if method == "GET":
                response = requests.get(f"{BASE_URL}{path}")
            elif method == "DELETE":
                response = requests.delete(f"{BASE_URL}{path}")
            elif method == "PUT":
                response = requests.put(f"{BASE_URL}{path}", json={})
            
            assert response.status_code == expected_status, \
                f"{method} {path}: Expected {expected_status}, got {response.status_code}"
            print(f"✅ {method} {path} returns {expected_status}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
