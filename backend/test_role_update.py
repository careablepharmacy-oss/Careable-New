"""
Test script to verify role assignment and update logic.
Run this to test the determine_user_role function.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from auth import determine_user_role

load_dotenv()

async def test_role_assignment():
    """Test the role assignment logic"""
    
    print("=" * 60)
    print("TESTING ROLE ASSIGNMENT LOGIC")
    print("=" * 60)
    
    # Test cases
    test_emails = [
        "diabexpertonline@gmail.com",
        "admin@diabexpert.com",
        "regularuser@example.com",
        "anotheruser@gmail.com"
    ]
    
    for email in test_emails:
        role = determine_user_role(email)
        print(f"Email: {email:40} → Role: {role}")
    
    print("\n" + "=" * 60)
    print("CHECKING EXISTING USER IN DATABASE")
    print("=" * 60)
    
    # Connect to database
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    # Check diabexpertonline@gmail.com in database
    user = await db.users.find_one({"email": "diabexpertonline@gmail.com"})
    
    if user:
        print(f"\nFound user in database:")
        print(f"  Email: {user.get('email')}")
        print(f"  Name: {user.get('name')}")
        print(f"  Current Role: {user.get('role', 'NOT SET')}")
        print(f"  Expected Role: {determine_user_role(user.get('email'))}")
        
        current_role = user.get('role', 'user')
        expected_role = determine_user_role(user.get('email'))
        
        if current_role != expected_role:
            print(f"\n⚠️  ROLE MISMATCH DETECTED!")
            print(f"  The role will be automatically updated on next login.")
            print(f"  {current_role} → {expected_role}")
        else:
            print(f"\n✅ Role is correct!")
    else:
        print("\n❌ User not found in database")
        print("   User will be created with correct role on first login")
    
    client.close()
    print("\n" + "=" * 60)

if __name__ == "__main__":
    asyncio.run(test_role_assignment())
