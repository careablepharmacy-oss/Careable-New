"""
Verify the current state of the database - check for duplicates
"""
import sys
import os
from collections import defaultdict

try:
    from pymongo import MongoClient
except ImportError:
    print("❌ Error: pymongo not installed")
    sys.exit(1)

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

def verify_database():
    """Check current database state"""
    
    print("\n" + "=" * 70)
    print("📊 DATABASE STATE VERIFICATION")
    print("=" * 70)
    print(f"\nMongoDB URL: {MONGO_URL}")
    print(f"Database: {DB_NAME}")
    
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
            print(f"Email: {email}")
            for user in users:
                print(f"  - ID: {user['id']}")
                print(f"    Name: {user.get('name', 'N/A')}")
                print(f"    Phone: {user.get('phone', 'N/A')}")
                print(f"    Role: {user.get('role', 'user')}")
                print(f"    Created: {user.get('created_at', 'N/A')}")
                
                # Check medications
                med_count = db.medications.count_documents({"user_id": user['id']})
                if med_count > 0:
                    print(f"    Medications: {med_count}")
            print()
    else:
        print("\n✅ NO DUPLICATES FOUND - Database is clean!")
    
    # Check for unique index
    print("\n" + "=" * 70)
    print("INDEX CHECK")
    print("=" * 70)
    
    indexes = list(db.users.list_indexes())
    has_unique_email = False
    
    for idx in indexes:
        if idx.get('key', {}).get('email') == 1:
            is_unique = idx.get('unique', False)
            print(f"Email index found: unique={is_unique}")
            has_unique_email = is_unique
    
    if not has_unique_email:
        print("⚠️  No unique index on email field!")
    else:
        print("✅ Unique index on email exists")
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total users: {len(all_users)}")
    print(f"Unique emails: {len(email_groups)}")
    print(f"Duplicate emails: {len(duplicates)}")
    print(f"Unique email index: {'Yes' if has_unique_email else 'No'}")
    
    if duplicates:
        print(f"\n❌ Database still has duplicates - cleanup needed!")
    else:
        print(f"\n✅ Database is clean - no duplicates!")
    
    print("\n" + "=" * 70 + "\n")
    
    client.close()

if __name__ == "__main__":
    verify_database()
