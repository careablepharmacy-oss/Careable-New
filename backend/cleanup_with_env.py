"""
Cleanup script that loads .env file first
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
                # Remove quotes
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
    print(f"MONGO_URL: {MONGO_URL}")
    print(f"DB_NAME: {DB_NAME}")
    sys.exit(1)

def cleanup_duplicates():
    """Remove duplicate users safely"""
    
    print("\n" + "=" * 70)
    print("🔧 PRODUCTION DATABASE CLEANUP - DUPLICATE USERS")
    print("=" * 70)
    print(f"\nConnecting to: {MONGO_URL}")
    print(f"Database: {DB_NAME}")
    
    try:
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]
        db.command('ping')
        print("✅ Connected to database successfully")
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return
    
    try:
        # Step 1: Find all users
        print("\n📊 Step 1: Analyzing users...")
        all_users = list(db.users.find())
        print(f"   Found {len(all_users)} total users")
        
        # Group by email
        email_groups = defaultdict(list)
        for user in all_users:
            email_groups[user['email']].append(user)
        
        # Find duplicates
        duplicates = {email: users for email, users in email_groups.items() if len(users) > 1}
        
        if not duplicates:
            print("\n✅ No duplicate users found!")
            print("   Database is clean. No action needed.")
            client.close()
            return
        
        print(f"\n⚠️  Found {len(duplicates)} emails with duplicate entries:")
        total_to_delete = sum(len(users) - 1 for users in duplicates.values())
        print(f"   Total duplicate entries to remove: {total_to_delete}")
        
        # Step 2: Process each duplicate
        print("\n🔧 Step 2: Removing duplicates...")
        deleted_count = 0
        
        for email, users in duplicates.items():
            print(f"\n   Processing: {email} ({len(users)} entries)")
            
            # Sort by created_at (keep most recent)
            users_sorted = sorted(
                users, 
                key=lambda x: x.get('created_at', '1970-01-01T00:00:00'), 
                reverse=True
            )
            
            keep_user = users_sorted[0]
            delete_users = users_sorted[1:]
            
            print(f"   ✓ Keeping: {keep_user['id'][:8]}... (created: {keep_user.get('created_at', 'unknown')})")
            
            # Check if keep_user has more data
            has_phone = bool(keep_user.get('phone'))
            has_meds = db.medications.count_documents({"user_id": keep_user['id']})
            print(f"      Has phone: {has_phone}, Has medications: {has_meds}")
            
            for user in delete_users:
                # Check if this duplicate has medications
                user_meds = db.medications.count_documents({"user_id": user['id']})
                
                if user_meds > 0:
                    print(f"   ⚠️  Duplicate has {user_meds} medications!")
                    print(f"      Transferring to {keep_user['id'][:8]}...")
                    
                    # Transfer medications
                    result = db.medications.update_many(
                        {"user_id": user['id']},
                        {"$set": {"user_id": keep_user['id']}}
                    )
                    print(f"      ✓ Transferred {result.modified_count} medications")
                
                # Delete duplicate user
                result = db.users.delete_one({"id": user['id']})
                if result.deleted_count > 0:
                    print(f"   ✓ Deleted: {user['id'][:8]}...")
                    deleted_count += 1
                else:
                    print(f"   ✗ Failed to delete: {user['id'][:8]}...")
        
        print(f"\n✅ Cleanup complete! Deleted {deleted_count} duplicate users")
        
        # Step 3: Add unique index
        print("\n🔒 Step 3: Adding unique index on email...")
        try:
            indexes = list(db.users.list_indexes())
            email_index_exists = any(
                idx.get('key', {}).get('email') == 1 and idx.get('unique', False) 
                for idx in indexes
            )
            
            if email_index_exists:
                print("   ✓ Unique index already exists")
            else:
                db.users.create_index("email", unique=True)
                print("   ✓ Created unique index on email field")
        except Exception as e:
            print(f"   ⚠️  Could not create index: {e}")
        
        # Step 4: Final verification
        print("\n📊 Step 4: Verification...")
        final_users = db.users.count_documents({})
        unique_emails = len(db.users.distinct("email"))
        
        print(f"   Total users: {final_users}")
        print(f"   Unique emails: {unique_emails}")
        
        if final_users == unique_emails:
            print("\n✅ SUCCESS! No duplicates remaining.")
        else:
            print(f"\n⚠️  Warning: {final_users - unique_emails} potential duplicates still exist")
        
        client.close()
        
    except Exception as e:
        print(f"\n❌ Error during cleanup: {e}")
        import traceback
        traceback.print_exc()
        client.close()
        sys.exit(1)
    
    print("\n" + "=" * 70)
    print("🎉 CLEANUP COMPLETED!")
    print("=" * 70)
    print("\nNext steps:")
    print("1. Restart backend: sudo supervisorctl restart backend")
    print("2. Clear browser cache completely")
    print("3. Test prescription manager dashboard")
    print("\n")

if __name__ == "__main__":
    cleanup_duplicates()
