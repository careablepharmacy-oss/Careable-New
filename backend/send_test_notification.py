#!/usr/bin/env python3
"""
Script to send a test push notification to all subscribers.
"""
import asyncio
import os
import sys
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import json

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def send_test_notification():
    """Send test notification to all subscribers."""
    try:
        from pywebpush import webpush, WebPushException
        
        # Connect to MongoDB
        mongo_url = os.environ['MONGO_URL']
        db_name = os.environ['DB_NAME']
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        print("📡 Fetching push subscriptions...")
        
        # Get all push subscriptions
        subscriptions = await db.push_subscriptions.find({}).to_list(1000)
        
        if not subscriptions:
            print("❌ No push subscriptions found in database.")
            print("   Users need to enable notifications in the app first.")
            return
        
        print(f"✅ Found {len(subscriptions)} subscription(s)")
        
        # Get VAPID keys
        vapid_private_key = os.environ.get('VAPID_PRIVATE_KEY')
        if not vapid_private_key:
            print("❌ VAPID_PRIVATE_KEY not found in environment variables")
            return
        
        vapid_claims = {
            "sub": "mailto:support@diabexpert.com"
        }
        
        # Notification data
        notification_data = {
            "title": "DiabeXpert Notification",
            "body": "Our push message system is working fine.",
            "icon": "/logo192.png",
            "badge": "/logo192.png",
            "data": {
                "type": "test",
                "timestamp": str(asyncio.get_event_loop().time())
            }
        }
        
        print("\n📤 Sending test notification...")
        print(f"   Title: {notification_data['title']}")
        print(f"   Message: {notification_data['body']}")
        
        success_count = 0
        failed_count = 0
        expired_subscriptions = []
        
        for subscription in subscriptions:
            try:
                webpush(
                    subscription_info={
                        "endpoint": subscription['endpoint'],
                        "keys": subscription['keys']
                    },
                    data=json.dumps(notification_data),
                    vapid_private_key=vapid_private_key,
                    vapid_claims=vapid_claims
                )
                success_count += 1
                print(f"   ✅ Sent to subscription: {subscription['endpoint'][:50]}...")
            except WebPushException as e:
                failed_count += 1
                print(f"   ❌ Failed for subscription: {subscription['endpoint'][:50]}...")
                print(f"      Error: {str(e)}")
                
                # Mark expired subscriptions for cleanup
                if e.response and e.response.status_code == 410:
                    expired_subscriptions.append(subscription['id'])
            except Exception as e:
                failed_count += 1
                print(f"   ❌ Unexpected error: {str(e)}")
        
        # Clean up expired subscriptions
        if expired_subscriptions:
            print(f"\n🧹 Cleaning up {len(expired_subscriptions)} expired subscription(s)...")
            for sub_id in expired_subscriptions:
                await db.push_subscriptions.delete_one({"id": sub_id})
        
        print(f"\n{'='*60}")
        print(f"📊 SUMMARY:")
        print(f"   Total subscriptions: {len(subscriptions)}")
        print(f"   ✅ Successfully sent: {success_count}")
        print(f"   ❌ Failed: {failed_count}")
        print(f"   🧹 Expired/Removed: {len(expired_subscriptions)}")
        print(f"{'='*60}")
        
        # Close MongoDB connection
        client.close()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("="*60)
    print("🔔 DiabeXpert Test Notification Sender")
    print("="*60)
    asyncio.run(send_test_notification())
    print("\n✅ Script completed!")
