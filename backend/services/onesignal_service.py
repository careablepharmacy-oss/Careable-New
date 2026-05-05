"""
OneSignal Push Notification Service

Handles sending push notifications via OneSignal REST API.
Replaces direct FCM integration for more reliable push delivery.
"""

import os
import httpx
import logging
from typing import List, Dict, Optional
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load .env file to ensure credentials are available
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

# OneSignal configuration - loaded after dotenv
ONESIGNAL_APP_ID = os.environ.get('ONESIGNAL_APP_ID', '')
ONESIGNAL_API_KEY = os.environ.get('ONESIGNAL_API_KEY', '')
ONESIGNAL_API_URL = "https://api.onesignal.com"

logger.info(f"[OneSignal] Loaded config - App ID: {ONESIGNAL_APP_ID[:20] if ONESIGNAL_APP_ID else 'NOT SET'}...")


class OneSignalService:
    """Service for sending push notifications via OneSignal"""
    
    def __init__(self):
        self.app_id = ONESIGNAL_APP_ID
        self.api_key = ONESIGNAL_API_KEY
        self.headers = {
            "Authorization": f"Key {self.api_key}",
            "Content-Type": "application/json; charset=utf-8"
        }
    
    def is_configured(self) -> bool:
        """Check if OneSignal is properly configured"""
        return bool(self.app_id and self.api_key)
    
    async def send_to_user(
        self,
        user_id: str,
        title: str,
        body: str,
        data: Optional[Dict] = None,
        image_url: Optional[str] = None,
        android_channel_id: Optional[str] = None,
        url: Optional[str] = None
    ) -> Dict:
        """
        Send push notification to a specific user by external_id
        
        Args:
            user_id: The external user ID (same as used in OneSignal.login())
            title: Notification title
            body: Notification body/message
            data: Additional data payload
            image_url: Optional image URL
            android_channel_id: Android notification channel ID for custom sounds
                - 'medication_reminders': Default medication notifications
                - 'appointment_reminders': Doctor/lab appointment reminders (opening bell sound)
                - 'low_stock_alerts': Medicine refill reminders (opening bell sound)
                - 'alarm_reminders': Alarm-style notifications
            url: Optional URL to open when notification is tapped
        
        Returns:
            Dict with success status and notification_id or error
        """
        if not self.is_configured():
            logger.warning("OneSignal not configured, skipping notification")
            return {"success": False, "error": "OneSignal not configured"}
        
        # Default to medication_reminders channel if not specified
        # When android_channel_id is None, use OS default notification sound
        
        payload = {
            "app_id": self.app_id,
            "include_aliases": {
                "external_id": [user_id]
            },
            "target_channel": "push",
            "contents": {"en": body},
            "headings": {"en": title},
        }
        
        # Only set custom channel when explicitly provided
        if android_channel_id:
            payload["existing_android_channel_id"] = android_channel_id
        
        if data:
            payload["data"] = data
        
        if image_url:
            payload["large_icon"] = image_url
            payload["big_picture"] = image_url
        
        if url:
            payload["url"] = url
        
        try:
            logger.info(f"[OneSignal] Sending to user: {user_id}, Channel: {android_channel_id or 'default'}, App ID: {self.app_id}")
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{ONESIGNAL_API_URL}/notifications",
                    json=payload,
                    headers=self.headers
                )
                
                result = response.json()
                
                if response.status_code >= 400:
                    error_msg = result.get('errors', [result])
                    logger.error(f"[OneSignal] ❌ API Error ({response.status_code}): {error_msg}")
                    return {"success": False, "error": str(error_msg), "status_code": response.status_code}
                
                logger.info(f"[OneSignal] ✅ Notification sent: {result.get('id')}, recipients: {result.get('recipients', 0)}")
                return {
                    "success": True,
                    "notification_id": result.get("id"),
                    "recipients": result.get("recipients", 0)
                }
        except httpx.HTTPError as e:
            logger.error(f"[OneSignal] ❌ HTTP Error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def send_to_users(
        self,
        user_ids: List[str],
        title: str,
        body: str,
        data: Optional[Dict] = None
    ) -> Dict:
        """
        Send push notification to multiple users
        
        Args:
            user_ids: List of external user IDs
            title: Notification title
            body: Notification body
            data: Additional data payload
        
        Returns:
            Dict with success status
        """
        if not self.is_configured():
            return {"success": False, "error": "OneSignal not configured"}
        
        payload = {
            "app_id": self.app_id,
            "include_aliases": {
                "external_id": user_ids
            },
            "target_channel": "push",
            "contents": {"en": body},
            "headings": {"en": title},
        }
        
        if data:
            payload["data"] = data
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{ONESIGNAL_API_URL}/notifications",
                    json=payload,
                    headers=self.headers
                )
                response.raise_for_status()
                
                result = response.json()
                return {
                    "success": True,
                    "notification_id": result.get("id"),
                    "recipients": result.get("recipients", 0)
                }
        except httpx.HTTPError as e:
            logger.error(f"[OneSignal] ❌ Bulk send failed: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def send_to_segment(
        self,
        segment: str,
        title: str,
        body: str,
        data: Optional[Dict] = None
    ) -> Dict:
        """
        Send notification to a user segment
        
        Args:
            segment: OneSignal segment name (e.g., "All", "Active Users")
            title: Notification title
            body: Notification body
            data: Additional data payload
        
        Returns:
            Dict with success status
        """
        if not self.is_configured():
            return {"success": False, "error": "OneSignal not configured"}
        
        payload = {
            "app_id": self.app_id,
            "included_segments": [segment],
            "contents": {"en": body},
            "headings": {"en": title},
        }
        
        if data:
            payload["data"] = data
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{ONESIGNAL_API_URL}/notifications",
                    json=payload,
                    headers=self.headers
                )
                response.raise_for_status()
                
                result = response.json()
                return {
                    "success": True,
                    "notification_id": result.get("id"),
                    "recipients": result.get("recipients", 0)
                }
        except httpx.HTTPError as e:
            logger.error(f"[OneSignal] ❌ Segment send failed: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def send_medication_reminder(
        self,
        user_id: str,
        medication_name: str,
        dosage: str,
        scheduled_time: str
    ) -> Dict:
        """
        Send medication reminder notification
        
        Args:
            user_id: User's external ID
            medication_name: Name of the medication
            dosage: Dosage information
            scheduled_time: Time the medication should be taken
        
        Returns:
            Dict with success status
        """
        title = f"💊 Time for {medication_name}"
        body = f"Take {dosage} now. Scheduled for {scheduled_time}"
        data = {
            "type": "medication_reminder",
            "medication_name": medication_name,
            "targetPage": "medications"
        }
        
        return await self.send_to_user(user_id, title, body, data, android_channel_id="medication_reminders")
    
    async def send_appointment_reminder(
        self,
        user_id: str,
        doctor_name: str,
        appointment_time: str,
        appointment_type: str = "Doctor"
    ) -> Dict:
        """
        Send appointment reminder notification
        
        Args:
            user_id: User's external ID
            doctor_name: Name of doctor or lab
            appointment_time: Appointment time
            appointment_type: Type of appointment (Doctor/Lab)
        
        Returns:
            Dict with success status
        """
        title = f"📅 {appointment_type} Appointment Reminder"
        body = f"Your appointment with {doctor_name} is at {appointment_time}"
        data = {
            "type": "appointment_reminder",
            "targetPage": "home"
        }
        
        # Use appointment_reminders channel with opening_bell.mp3
        return await self.send_to_user(
            user_id, title, body, data,
            android_channel_id="appointment_reminders"
        )
    
    async def send_refill_reminder(
        self,
        user_id: str,
        medication_name: str,
        pills_remaining: int
    ) -> Dict:
        """
        Send medicine refill/low stock reminder notification
        
        Args:
            user_id: User's external ID
            medication_name: Name of the medication
            pills_remaining: Number of pills remaining
        
        Returns:
            Dict with success status
        """
        title = f"💊 Low Stock Alert: {medication_name}"
        body = f"Only {pills_remaining} doses remaining. Time to refill!"
        data = {
            "type": "refill_reminder",
            "medication_name": medication_name,
            "targetPage": "medications"
        }
        
        # Use low_stock_alerts channel for opening bell sound
        return await self.send_to_user(
            user_id, title, body, data,
            android_channel_id="low_stock_alerts"
        )
    
    async def send_test_notification(self, user_id: str) -> Dict:
        """
        Send test notification to verify push is working
        
        Args:
            user_id: User's external ID
        
        Returns:
            Dict with success status
        """
        return await self.send_to_user(
            user_id=user_id,
            title="🔔 Test Notification",
            body="Push notifications are working! You'll receive medication reminders here.",
            data={"type": "test", "timestamp": datetime.utcnow().isoformat()}
        )


# Singleton instance
onesignal_service = OneSignalService()
