"""
This script uses the same database connection as the running FastAPI app
to show what database it's actually connected to
"""
import sys
import os

# Add parent directory to path to import from server
sys.path.insert(0, os.path.dirname(__file__))

# Import database connection from server.py
try:
    from server import db, client
    print("✅ Imported database connection from running server")
except Exception as e:
    print(f"❌ Could not import from server: {e}")
    print("\nTrying alternative method...")
    
    # Try loading environment like FastAPI does
    from dotenv import load_dotenv
    load_dotenv()
    
    from motor.motor_asyncio import AsyncIOMotorClient
    
    MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    DB_NAME = os.environ.get('DB_NAME', 'test_database')
    
    print(f"MONGO_URL from env: {MONGO_URL}")
    print(f"DB_NAME from env: {DB_NAME}")
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

import asyncio

async def check_live_db():
    """Check the actual live database"""
    
    print("\n" + "=" * 70)
    print("🔍 CHECKING LIVE PRODUCTION DATABASE")
    print("=" * 70)
    
    try:
        # Get database info
        server_info = await client.server_info()
        print(f"\n✅ Connected to MongoDB version: {server_info.get('version')}")
        
        # Count users
        user_count = await db.users.count_documents({})
        print(f"\n📊 Total users in THIS database: {user_count}")
        
        # Get unique emails
        unique_emails = await db.users.distinct("email")
        print(f"📧 Unique email addresses: {len(unique_emails)}")
        
        # Check for duplicates
        all_users = await db.users.find().to_list(length=None)
        from collections import defaultdict
        email_groups = defaultdict(list)
        for user in all_users:
            email_groups[user['email']].append(user)
        
        duplicates = {email: users for email, users in email_groups.items() if len(users) > 1}
        
        if duplicates:
            print(f"\n⚠️  DUPLICATES FOUND: {len(duplicates)} emails")
            for email, users in list(duplicates.items())[:5]:  # Show first 5
                print(f"   - {email}: {len(users)} entries")
        else:
            print("\n✅ No duplicates")
        
        # Try to get connection string (carefully)
        try:
            conn_str = str(client.address)
            print(f"\n🔗 Connected to: {conn_str}")
        except:
            print("\n🔗 Connection details not available")
        
        print("\n" + "=" * 70)
        print(f"SUMMARY: This database has {user_count} users")
        if user_count == 26:
            print("⚠️  THIS IS THE PRODUCTION DATABASE (matches dashboard)")
        elif user_count == 15:
            print("⚠️  This is the LOCAL database (doesn't match dashboard)")
        print("=" * 70 + "\n")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_live_db())
