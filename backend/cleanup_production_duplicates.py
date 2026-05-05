"""
Production-safe script to clean duplicate users.
This script can be run directly on the deployed server.

Usage:
1. SSH into your production server
2. Navigate to backend directory
3. Run: python cleanup_production_duplicates.py
"""
import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os

# Production database connection
# Will use environment variables from deployed environment
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

async def cleanup_duplicates():
    """Remove duplicate users safely"""
    
    print("\n" + "=" * 70)
    print("🔧 PRODUCTION DATABASE CLEANUP - DUPLICATE USERS")
    print("=" * 70)
    print(f"\nConnecting to: {MONGO_URL}")
    print(f"Database: {DB_NAME}")
    
    # Ask for confirmation
    print("\n⚠️  WARNING: This will modify production data!")
    print("Make sure you have a backup before proceeding.")
    
    # In production, skip confirmation (assuming backup is done)
    # For safety, you can uncomment the lines below for manual confirmation
    # response = input("\nType 'YES' to continue: ")
    # if response != 'YES':
    #     print("Cancelled.")
    #     return
    
    try:
        client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]
        
        # Test connection
        await db.command('ping')
        print("✅ Connected to database successfully")
        
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return
    
    try:
        # Step 1: Find all users
        print("\n📊 Step 1: Analyzing users...")
        all_users = await db.users.find().to_list(length=None)
        print(f"   Found {len(all_users)} total users")
        
        # Group by email
        from collections import defaultdict
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
            
            print(f"   ✓ Keeping: {keep_user['id']} (created: {keep_user.get('created_at', 'unknown')})")
            
            # Check if keep_user has more data
            has_phone = bool(keep_user.get('phone'))
            has_meds = await db.medications.count_documents({"user_id": keep_user['id']})
            print(f"      Has phone: {has_phone}, Has medications: {has_meds}")
            
            for user in delete_users:
                # Check if this duplicate has medications
                user_meds = await db.medications.count_documents({"user_id": user['id']})
                
                if user_meds > 0:
                    print(f"   ⚠️  Duplicate has {user_meds} medications!")
                    print(f"      Transferring medications from {user['id']} to {keep_user['id']}")
                    
                    # Transfer medications to the kept user
                    await db.medications.update_many(
                        {"user_id": user['id']},
                        {"$set": {"user_id": keep_user['id']}}
                    )
                    print(f"      ✓ Transferred {user_meds} medications")
                
                # Delete the duplicate user
                result = await db.users.delete_one({"id": user['id']})
                if result.deleted_count > 0:
                    print(f"   ✓ Deleted: {user['id']}")
                    deleted_count += 1
                else:
                    print(f"   ✗ Failed to delete: {user['id']}")
        
        print(f"\n✅ Cleanup complete! Deleted {deleted_count} duplicate users")
        
        # Step 3: Add unique index
        print("\n🔒 Step 3: Adding unique index on email...")
        try:
            # Check if index exists
            indexes = await db.users.list_indexes().to_list(length=None)
            email_index_exists = any(
                idx.get('key', {}).get('email') == 1 and idx.get('unique', False) 
                for idx in indexes
            )
            
            if email_index_exists:
                print("   ✓ Unique index already exists")
            else:
                await db.users.create_index("email", unique=True)
                print("   ✓ Created unique index on email field")
        except Exception as e:
            print(f"   ⚠️  Could not create index: {e}")
        
        # Step 4: Final verification
        print("\n📊 Step 4: Verification...")
        final_users = await db.users.count_documents({})
        unique_emails = len(await db.users.distinct("email"))
        
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
    print("1. Test the prescription manager dashboard")
    print("2. Verify all 'Manage Medications' buttons work")
    print("3. Check for any errors in application")
    print("\n")

if __name__ == "__main__":
    asyncio.run(cleanup_duplicates())
