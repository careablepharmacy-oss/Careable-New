"""
Script to fix duplicate users and add unique index on email field.
This will:
1. Find and remove duplicate users (keeping the most recent one)
2. Add a unique index on email field to prevent future duplicates
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from collections import defaultdict

load_dotenv()

async def fix_duplicate_users():
    """Remove duplicate users and add unique index"""
    
    print("=" * 60)
    print("FIXING DUPLICATE USERS")
    print("=" * 60)
    
    # Connect to database
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    # Step 1: Find all users
    print("\nStep 1: Finding duplicate users...")
    all_users = await db.users.find().to_list(length=None)
    
    # Group by email
    email_groups = defaultdict(list)
    for user in all_users:
        email_groups[user['email']].append(user)
    
    # Find duplicates
    duplicates_found = False
    users_to_delete = []
    
    for email, users in email_groups.items():
        if len(users) > 1:
            duplicates_found = True
            print(f"\n  Found {len(users)} entries for: {email}")
            
            # Sort by created_at (keep the most recent)
            users_sorted = sorted(users, key=lambda x: x.get('created_at', ''), reverse=True)
            
            # Keep the first one (most recent), mark others for deletion
            keep_user = users_sorted[0]
            delete_users = users_sorted[1:]
            
            print(f"  ✓ Keeping: ID {keep_user['id']} (created: {keep_user.get('created_at', 'unknown')})")
            
            for user in delete_users:
                print(f"  ✗ Deleting: ID {user['id']} (created: {user.get('created_at', 'unknown')})")
                users_to_delete.append(user['id'])
    
    if not duplicates_found:
        print("\n✓ No duplicate users found!")
    else:
        # Step 2: Delete duplicate users
        print(f"\nStep 2: Deleting {len(users_to_delete)} duplicate users...")
        for user_id in users_to_delete:
            result = await db.users.delete_one({"id": user_id})
            if result.deleted_count > 0:
                print(f"  ✓ Deleted user ID: {user_id}")
        
        print(f"\n✓ Deleted {len(users_to_delete)} duplicate users")
    
    # Step 3: Add unique index on email
    print("\nStep 3: Adding unique index on email field...")
    try:
        # Check if index already exists
        indexes = await db.users.list_indexes().to_list(length=None)
        email_index_exists = any(
            idx.get('key', {}).get('email') == 1 and idx.get('unique', False) 
            for idx in indexes
        )
        
        if email_index_exists:
            print("  ✓ Unique index on email already exists")
        else:
            await db.users.create_index("email", unique=True)
            print("  ✓ Created unique index on email field")
    except Exception as e:
        print(f"  ⚠ Error creating index: {e}")
    
    # Step 4: Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    final_count = await db.users.count_documents({})
    unique_emails = len(await db.users.distinct("email"))
    
    print(f"Total users in database: {final_count}")
    print(f"Unique email addresses: {unique_emails}")
    
    if final_count == unique_emails:
        print("✓ No duplicates remaining!")
    else:
        print(f"⚠ Warning: {final_count - unique_emails} potential duplicates still exist")
    
    client.close()
    print("\n" + "=" * 60)

if __name__ == "__main__":
    asyncio.run(fix_duplicate_users())
