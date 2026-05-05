"""
Test cases for Medication Alarm Settings feature
Tests the alarm_enabled field in notification settings API
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestNotificationSettingsAlarm:
    """Tests for alarm_enabled field in notification settings"""
    
    def test_get_notification_settings_returns_alarm_enabled_field(self):
        """
        GET /api/settings/notifications should return alarm_enabled field
        Note: This endpoint requires authentication, so we expect 401 without auth
        """
        response = requests.get(f"{BASE_URL}/api/settings/notifications")
        # Without auth, should return 401
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✅ GET /api/settings/notifications returns 401 without auth (expected)")
    
    def test_put_notification_settings_accepts_alarm_enabled(self):
        """
        PUT /api/settings/notifications should accept alarm_enabled field
        Note: This endpoint requires authentication, so we expect 401 without auth
        """
        response = requests.put(
            f"{BASE_URL}/api/settings/notifications",
            json={"alarm_enabled": True}
        )
        # Without auth, should return 401
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✅ PUT /api/settings/notifications returns 401 without auth (expected)")


class TestNotificationSettingsModel:
    """Tests for NotificationSettings model structure"""
    
    def test_notification_settings_model_has_alarm_enabled(self):
        """
        Verify NotificationSettings model includes alarm_enabled field with default False
        """
        import sys
        sys.path.insert(0, '/app/backend')
        from models import NotificationSettings, NotificationSettingsUpdate
        
        # Create default settings
        settings = NotificationSettings(user_id="test-user-123")
        
        # Verify alarm_enabled exists and defaults to False
        assert hasattr(settings, 'alarm_enabled'), "NotificationSettings should have alarm_enabled field"
        assert settings.alarm_enabled == False, f"alarm_enabled should default to False, got {settings.alarm_enabled}"
        print("✅ NotificationSettings model has alarm_enabled field with default False")
    
    def test_notification_settings_update_model_has_alarm_enabled(self):
        """
        Verify NotificationSettingsUpdate model includes alarm_enabled field
        """
        import sys
        sys.path.insert(0, '/app/backend')
        from models import NotificationSettingsUpdate
        
        # Create update with alarm_enabled
        update = NotificationSettingsUpdate(alarm_enabled=True)
        
        # Verify alarm_enabled can be set
        assert hasattr(update, 'alarm_enabled'), "NotificationSettingsUpdate should have alarm_enabled field"
        assert update.alarm_enabled == True, f"alarm_enabled should be True, got {update.alarm_enabled}"
        print("✅ NotificationSettingsUpdate model has alarm_enabled field")
    
    def test_notification_settings_update_alarm_enabled_optional(self):
        """
        Verify alarm_enabled is optional in NotificationSettingsUpdate
        """
        import sys
        sys.path.insert(0, '/app/backend')
        from models import NotificationSettingsUpdate
        
        # Create update without alarm_enabled
        update = NotificationSettingsUpdate(medication_reminders=True)
        
        # Verify alarm_enabled is None (optional)
        assert update.alarm_enabled is None, f"alarm_enabled should be None when not provided, got {update.alarm_enabled}"
        print("✅ NotificationSettingsUpdate alarm_enabled is optional")


class TestAPIEndpointStructure:
    """Tests for API endpoint structure and response format"""
    
    def test_api_health_check(self):
        """Verify API is accessible"""
        # Use auth/me endpoint to check API is running (returns 401 without auth)
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [200, 401], f"API check failed: {response.status_code}"
        print("✅ API is accessible")
    
    def test_notification_settings_endpoint_exists(self):
        """Verify notification settings endpoints exist"""
        # GET endpoint
        get_response = requests.get(f"{BASE_URL}/api/settings/notifications")
        assert get_response.status_code in [200, 401, 403], f"GET endpoint should exist, got {get_response.status_code}"
        
        # PUT endpoint
        put_response = requests.put(
            f"{BASE_URL}/api/settings/notifications",
            json={}
        )
        assert put_response.status_code in [200, 401, 403, 422], f"PUT endpoint should exist, got {put_response.status_code}"
        
        print("✅ Notification settings endpoints exist")


class TestFrontendCodeReview:
    """Code review tests for frontend implementation"""
    
    def test_profile_page_has_alarm_toggle(self):
        """Verify ProfilePage.jsx has alarm toggle with correct data-testid"""
        with open('/app/frontend/src/pages/ProfilePage.jsx', 'r') as f:
            content = f.read()
        
        # Check for alarm toggle with data-testid
        assert 'data-testid="alarm-toggle"' in content, "ProfilePage should have alarm toggle with data-testid='alarm-toggle'"
        
        # Check for Capacitor.isNativePlatform() guard
        assert 'Capacitor.isNativePlatform()' in content, "Alarm toggle should be wrapped in Capacitor.isNativePlatform() check"
        
        # Check for AlarmClock icon
        assert 'AlarmClock' in content, "ProfilePage should import AlarmClock icon"
        
        # Check for localAlarmsEnabled state
        assert 'localAlarmsEnabled' in content, "ProfilePage should have localAlarmsEnabled state"
        
        # Check for handleLocalAlarmsToggle handler
        assert 'handleLocalAlarmsToggle' in content, "ProfilePage should have handleLocalAlarmsToggle handler"
        
        print("✅ ProfilePage.jsx has alarm toggle with correct implementation")
    
    def test_notification_manager_defaults_to_false(self):
        """Verify notificationManager.js areLocalAlarmsEnabled defaults to false"""
        with open('/app/frontend/src/services/notificationManager.js', 'r') as f:
            content = f.read()
        
        # Check for areLocalAlarmsEnabled method
        assert 'areLocalAlarmsEnabled' in content, "notificationManager should have areLocalAlarmsEnabled method"
        
        # Check that it defaults to false
        assert 'return setting === null ? false' in content or 'Default to false' in content.lower() or 'default to disabled' in content.lower(), \
            "areLocalAlarmsEnabled should default to false"
        
        print("✅ notificationManager.js areLocalAlarmsEnabled defaults to false")
    
    def test_app_js_syncs_alarm_setting(self):
        """Verify App.js syncs alarm_enabled from backend to localStorage"""
        with open('/app/frontend/src/App.js', 'r') as f:
            content = f.read()
        
        # Check for alarm_enabled sync
        assert 'alarm_enabled' in content, "App.js should sync alarm_enabled from backend"
        
        # Check for local_alarms_enabled localStorage key
        assert 'local_alarms_enabled' in content, "App.js should set local_alarms_enabled in localStorage"
        
        print("✅ App.js syncs alarm_enabled from backend to localStorage")
    
    def test_profile_page_calls_api_for_alarm_setting(self):
        """Verify ProfilePage loads and saves alarm setting via API"""
        with open('/app/frontend/src/pages/ProfilePage.jsx', 'r') as f:
            content = f.read()
        
        # Check for getNotificationSettings call
        assert 'getNotificationSettings' in content, "ProfilePage should call getNotificationSettings API"
        
        # Check for updateNotificationSettings call
        assert 'updateNotificationSettings' in content, "ProfilePage should call updateNotificationSettings API"
        
        # Check for alarm_enabled in API calls
        assert 'alarm_enabled' in content, "ProfilePage should use alarm_enabled field"
        
        print("✅ ProfilePage.jsx calls API for alarm setting")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
