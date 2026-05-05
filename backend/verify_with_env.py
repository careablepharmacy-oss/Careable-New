"""
Verify database state - loads .env file first
"""
import sys
import os
from pathlib import Path
from collections import defaultdict

# Load .env file manually
env_file = Path(__file__).parent / '.env'
if env_file.exists():
    print(f"Loading environment from: {env_file}")
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                value = value.strip('"').strip("'")
                os.environ[key] = value
                if key in ['MONGO_URL', 'DB_NAME']:
                    print(f"  {key} = {value}")
else:
    print(f"Warning: .env file not found at {env_file}")

try:
    from pymongo import MongoClient
except ImportError:
    print("❌ Error: pymongo not installed")
    sys.exit(1)

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')

if not MONGO_URL or not DB_NAME:
    print("❌ Error: MONGO_URL or DB_NAME not set")
    sys.exit(1)

def verify_database():
    """Check current database state"""
    
    print("\n" + "=" * 70)
    print("📊 DATABASE STATE VERIFICATION")
    print("=" * 70)
    
    try:
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]
        db.command('ping')
        print("✅ Connected successfully\n")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return
    
    # Get all users
    all_users = list(db.users.find())
    print(f"Total users in database: {len(all_users)}")
    
    # Group by email
    email_groups = defaultdict(list)
    for user in all_users:
        email_groups[user['email']].append(user)
    
    print(f"Unique email addresses: {len(email_groups)}")
    
    # Find duplicates
    duplicates = {email: users for email, users in email_groups.items() if len(users) > 1}
    
    if duplicates:
        print(f"\n⚠️  DUPLICATES FOUND: {len(duplicates)} emails have multiple entries\n")
        
        for email, users in duplicates.items():
            print(f"📧 {email} ({len(users)} entries)")
            for i, user in enumerate(users, 1):
                print(f"  Entry {i}:")
                print(f"    ID: {user['id'][:12]}...")
                print(f"    Name: {user.get('name', 'N/A')}")
                print(f"    Phone: {user.get('phone', 'N/A')}")
                print(f"    Created: {user.get('created_at', 'N/A')}")
                med_count = db.medications.count_documents({"user_id": user['id']})
                if med_count > 0:
                    print(f"    ⚠️ Has {med_count} medications")
            print()
    else:
        print("\n✅ NO DUPLICATES FOUND - Database is clean!")
    
    # Check unique index
    print("\n" + "=" * 70)
    print("INDEX STATUS")
    print("=" * 70)
    
    indexes = list(db.users.list_indexes())
    has_unique_email = any(
        idx.get('key', {}).get('email') == 1 and idx.get('unique', False)
        for idx in indexes
    )
    
    if has_unique_email:
        print("✅ Unique index on email field EXISTS")
    else:
        print("⚠️  No unique index on email field")
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total users: {len(all_users)}")
    print(f"Unique emails: {len(email_groups)}")
    print(f"Duplicate emails: {len(duplicates)}")
    
    if duplicates:
        print(f"\n❌ Action needed: Database has {len(duplicates)} duplicate emails")
        print("   Run: python cleanup_with_env.py")
    else:
        print(f"\n✅ Database is clean!")
    
    print("\n" + "=" * 70 + "\n")
    client.close()

if __name__ == "__main__":
    verify_database()
