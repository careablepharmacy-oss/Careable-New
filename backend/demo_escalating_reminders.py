#!/usr/bin/env python3
"""
Script to demonstrate the escalating reminder system.
Creates sample reminders to show the new notification schedule.
"""
import asyncio
import os
import sys
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timedelta

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def demonstrate_escalating_reminders():
    """Demonstrate the escalating reminder system."""
    try:
        from reminder_service import calculate_medication_reminders
        
        # Connect to MongoDB
        mongo_url = os.environ['MONGO_URL']
        db_name = os.environ['DB_NAME']
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        print("="*80)
        print("🔔 ESCALATING REMINDER SYSTEM DEMONSTRATION")
        print("="*80)
        
        # Create a sample medication
        sample_medication = {
            "id": "test-med-123",
            "user_id": "test-user",
            "name": "Metformin",
            "schedule": {
                "frequency": "daily",
                "times": ["09:00", "21:00"]
            }
        }
        
        # Calculate reminders for tomorrow
        tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime('%Y-%m-%d')
        reminders = calculate_medication_reminders(sample_medication, tomorrow)
        
        print(f"\n📅 Sample Medication: {sample_medication['name']}")
        print(f"   Schedule: {', '.join(sample_medication['schedule']['times'])}")
        print(f"   Date: {tomorrow}")
        print(f"\n📬 Generated {len(reminders)} reminders:\n")
        
        for i, reminder in enumerate(reminders, 1):
            trigger_dt = datetime.fromisoformat(reminder['trigger_time'])
            print(f"   {i}. [{reminder['urgency'].upper()}]")
            print(f"      Time: {trigger_dt.strftime('%H:%M')}")
            print(f"      Message: {reminder['message']}")
            print(f"      Vibration: {reminder['vibration']}")
            print()
        
        print("="*80)
        print("📊 REMINDER SCHEDULE BREAKDOWN:")
        print("="*80)
        
        # Group by scheduled time
        times = sample_medication['schedule']['times']
        for scheduled_time in times:
            print(f"\n⏰ For {scheduled_time} medication:")
            print(f"   1. 🟢 GENTLE   - {calculate_time_offset(scheduled_time, -30)} (30 min before)")
            print(f"   2. 🔵 NORMAL   - {scheduled_time} (at scheduled time)")
            print(f"   3. 🟡 FOLLOWUP - {calculate_time_offset(scheduled_time, 5)} (5 min after)")
            print(f"   4. 🔴 URGENT   - {calculate_time_offset(scheduled_time, 15)} (15 min after)")
        
        print("\n" + "="*80)
        print("✨ FEATURES:")
        print("="*80)
        print("   ✅ requireInteraction: true (stays on screen)")
        print("   ✅ Custom vibration patterns per urgency")
        print("   ✅ Follow-ups skip if medication marked as taken")
        print("   ✅ Progressive urgency levels")
        print("\n" + "="*80)
        
        # Close MongoDB connection
        client.close()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

def calculate_time_offset(time_str, offset_minutes):
    """Calculate time with offset in minutes."""
    try:
        hour, minute = map(int, time_str.split(':'))
        total_minutes = hour * 60 + minute + offset_minutes
        
        # Handle day overflow
        total_minutes = total_minutes % (24 * 60)
        
        new_hour = total_minutes // 60
        new_minute = total_minutes % 60
        
        return f"{new_hour:02d}:{new_minute:02d}"
    except:
        return time_str

if __name__ == "__main__":
    asyncio.run(demonstrate_escalating_reminders())
    print("✅ Demonstration completed!")
