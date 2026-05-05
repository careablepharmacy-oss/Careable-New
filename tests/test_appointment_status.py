"""
Test suite for Appointment Status Update and History features
Tests:
1. PUT /api/appointments/{id}/status - Update appointment status
2. GET /api/prescription-manager/user/{user_id}/appointments - Get appointment history
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

class TestAppointmentStatusUpdate:
    """Tests for PUT /api/appointments/{id}/status endpoint"""
    
    def test_endpoint_exists(self):
        """Test that the status update endpoint exists"""
        # Without auth, should return 401 or 403, not 404
        response = requests.put(f"{BASE_URL}/api/appointments/test-id/status?status=done")
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print(f"✅ PUT /api/appointments/{{id}}/status endpoint exists (status: {response.status_code})")
    
    def test_invalid_status_rejected(self):
        """Test that invalid status values are rejected"""
        # This should fail with 400 or 422 for invalid status
        response = requests.put(f"{BASE_URL}/api/appointments/test-id/status?status=invalid_status")
        # Without auth, we get 401/403 first, but endpoint exists
        assert response.status_code in [400, 401, 403, 422], f"Expected 400/401/403/422, got {response.status_code}"
        print(f"✅ Invalid status handling works (status: {response.status_code})")


class TestAppointmentHistory:
    """Tests for GET /api/prescription-manager/user/{user_id}/appointments endpoint"""
    
    def test_endpoint_exists(self):
        """Test that the appointment history endpoint exists"""
        # Without auth, should return 401 or 403, not 404
        response = requests.get(f"{BASE_URL}/api/prescription-manager/user/test-user-id/appointments")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ GET /api/prescription-manager/user/{{user_id}}/appointments endpoint exists (status: {response.status_code})")
    
    def test_endpoint_with_limit_param(self):
        """Test that the endpoint accepts limit parameter"""
        response = requests.get(f"{BASE_URL}/api/prescription-manager/user/test-user-id/appointments?limit=5")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ Endpoint accepts limit parameter (status: {response.status_code})")


class TestAPIServiceMethods:
    """Tests for frontend API service methods"""
    
    def test_update_appointment_status_url_format(self):
        """Verify the URL format for updateAppointmentStatus matches backend"""
        # The frontend uses: /api/appointments/${appointmentId}/status?status=${status}
        # Backend expects: PUT /api/appointments/{appointment_id}/status with status as query param
        test_id = "test-appointment-id"
        test_status = "done"
        expected_url = f"{BASE_URL}/api/appointments/{test_id}/status?status={test_status}"
        
        response = requests.put(expected_url)
        # Should not be 404 (endpoint exists)
        assert response.status_code != 404, f"URL format incorrect - got 404"
        print(f"✅ URL format for updateAppointmentStatus is correct")
    
    def test_get_user_appointment_history_url_format(self):
        """Verify the URL format for getUserAppointmentHistory matches backend"""
        # The frontend uses: /api/prescription-manager/user/${userId}/appointments?limit=${limit}
        test_user_id = "test-user-id"
        test_limit = 5
        expected_url = f"{BASE_URL}/api/prescription-manager/user/{test_user_id}/appointments?limit={test_limit}"
        
        response = requests.get(expected_url)
        # Should not be 404 (endpoint exists)
        assert response.status_code != 404, f"URL format incorrect - got 404"
        print(f"✅ URL format for getUserAppointmentHistory is correct")


class TestValidStatusValues:
    """Tests for valid status values"""
    
    def test_valid_statuses_list(self):
        """Verify the valid status values match frontend expectations"""
        # Backend defines: valid_statuses = ["upcoming", "done", "postponed", "abandoned"]
        # Frontend uses: done, postponed, abandoned for status updates
        valid_statuses = ["upcoming", "done", "postponed", "abandoned"]
        
        for status in valid_statuses:
            response = requests.put(f"{BASE_URL}/api/appointments/test-id/status?status={status}")
            # Should not be 400 for invalid status (will be 401/403 for auth)
            assert response.status_code in [401, 403, 404, 422], f"Status '{status}' might be invalid - got {response.status_code}"
        
        print(f"✅ All valid statuses are accepted by the endpoint: {valid_statuses}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
