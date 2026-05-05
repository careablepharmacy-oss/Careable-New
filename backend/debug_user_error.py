"""Debug why specific user is causing 500 error"""
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from server import db
import traceback

async def debug_user():
    """Check what's wrong with this specific user"""
    
    user_id = "25a15aef-8b0a-4e09-b420-2ceae5029ed3"
    
    print("=" * 60)
    print(f"Debugging user: {user_id}")
    print("=" * 60)
    
    try:
        # Check if user exists
        user = await db.users.find_one({"id": user_id})
        if user:
            print(f"\n✅ User found:")
            print(f"   Email: {user.get('email')}")
            print(f"   Name: {user.get('name')}")
            print(f"   Role: {user.get('role')}")
        else:
            print(f"\n❌ User not found in database")
            return
        
        # Try to get medications (simulating the API call)
        print(f"\n📊 Fetching medications...")
        medications_cursor = db.medications.find({"user_id": user_id}).sort("created_at", -1)
        medications = await medications_cursor.to_list(length=None)
        
        print(f"   Found {len(medications)} medications")
        
        if medications:
            for med in medications:
                print(f"\n   Medication:")
                print(f"     ID: {med.get('id')}")
                print(f"     Name: {med.get('name')}")
                print(f"     Dosage: {med.get('dosage')}")
                print(f"     Form: {med.get('form')}")
                
                # Check if any field might cause serialization issues
                for key, value in med.items():
                    if value is None:
                        print(f"     ⚠️  {key} is None")
                    elif isinstance(value, dict):
                        print(f"     ✓ {key} is dict: {list(value.keys())}")
                    elif isinstance(value, list):
                        print(f"     ✓ {key} is list: length {len(value)}")
        
        print(f"\n✅ No obvious errors found")
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        print(traceback.format_exc())
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    asyncio.run(debug_user())
