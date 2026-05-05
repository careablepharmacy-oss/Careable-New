"""
Check user role for a specific email
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

async def check_user_role():
    """Check role for diabexpertonline@gmail.com"""
    
    # Connect to database
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    # Check the exact email
    emails_to_check = [
        "diabexpertonline@gmail.com",
        "diabexteronline@gmail.com",  # User might have typo
    ]
    
    print("=" * 60)
    print("CHECKING USER ROLES")
    print("=" * 60)
    
    for email in emails_to_check:
        user = await db.users.find_one({"email": email})
        
        if user:
            print(f"\n✓ Found user: {email}")
            print(f"  Name: {user.get('name')}")
            print(f"  Role: {user.get('role', 'NOT SET')}")
            print(f"  ID: {user.get('id')}")
            print(f"  Created: {user.get('created_at')}")
        else:
            print(f"\n✗ User not found: {email}")
    
    # Also list all prescription managers
    print("\n" + "=" * 60)
    print("ALL PRESCRIPTION MANAGERS IN DATABASE")
    print("=" * 60)
    
    managers = await db.users.find({"role": "prescription_manager"}).to_list(length=None)
    
    if managers:
        for mgr in managers:
            print(f"\n✓ {mgr.get('email')}")
            print(f"  Name: {mgr.get('name')}")
            print(f"  ID: {mgr.get('id')}")
    else:
        print("\n✗ No prescription managers found in database")
    
    client.close()
    print("\n" + "=" * 60)

if __name__ == "__main__":
    asyncio.run(check_user_role())
