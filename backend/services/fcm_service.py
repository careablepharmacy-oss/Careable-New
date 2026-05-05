"""
Firebase Cloud Messaging Service
Handles sending push notifications to users
"""

import firebase_admin
from firebase_admin import credentials, messaging
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)

class FCMService:
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FCMService, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not FCMService._initialized:
            try:
                cred = credentials.Certificate('/app/backend/firebase-service-account.json')
                firebase_admin.initialize_app(cred)
                FCMService._initialized = True
                logger.info("✅ Firebase Admin SDK initialized successfully")
            except Exception as e:
                logger.error(f"❌ Failed to initialize Firebase: {e}")
                raise
    
    async def send_medication_reminder(
        self, 
        fcm_token: str, 
        medication_name: str, 
        dosage: str,
        scheduled_time: str,
        attempt_number: int
    ) -> Optional[str]:
        """
        Send push notification for missed medication
        
        Args:
            fcm_token: User's FCM device token
            medication_name: Name of medication
            dosage: Dosage information
            scheduled_time: Original scheduled time
            attempt_number: Which reminder attempt (1-4)
        
        Returns:
            Message ID if successful, None if failed
        """
        try:
            # Create notification message
            message = messaging.Message(
                notification=messaging.Notification(
                    title=f'⏰ Medication Reminder ({attempt_number}/4)',
                    body=f'Time to take {medication_name} - {dosage}'
                ),
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        sound='default',
                        channel_id='medication_reminders',
                        priority='high',
                        default_vibrate_timings=True,
                        color='#0D9488'
                    )
                ),
                data={
                    'type': 'medication_reminder',
                    'medication_name': medication_name,
                    'scheduled_time': scheduled_time,
                    'attempt': str(attempt_number),
                    'click_action': 'FLUTTER_NOTIFICATION_CLICK'
                },
                token=fcm_token
            )
            
            # Send message
            response = messaging.send(message)
            logger.info(f"✅ Sent reminder #{attempt_number} for {medication_name}: {response}")
            return response
            
        except Exception as e:
            logger.error(f"❌ Failed to send FCM notification: {e}")
            return None
    
    async def send_test_notification(
        self, 
        fcm_token: str
    ) -> Optional[str]:
        """
        Send test notification to verify FCM is working
        """
        try:
            message = messaging.Message(
                notification=messaging.Notification(
                    title='🔔 Test Notification',
                    body='FCM is working correctly!'
                ),
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        sound='default',
                        channel_id='medication_reminders'
                    )
                ),
                token=fcm_token
            )
            
            response = messaging.send(message)
            logger.info(f"✅ Test notification sent: {response}")
            return response
            
        except Exception as e:
            logger.error(f"❌ Failed to send test notification: {e}")
            return None

# Singleton instance
fcm_service = FCMService()
