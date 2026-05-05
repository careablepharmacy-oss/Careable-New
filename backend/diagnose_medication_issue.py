"""
Diagnose medication edit issue for duplicate users
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from collections import defaultdict

load_dotenv()

async def diagnose_issue():
    """Check for duplicate users and their medications"""
    
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("=" * 60)
    print("DIAGNOSING MEDICATION EDIT ISSUE")
    print("=" * 60)
    
    # Step 1: Find duplicate users
    print("\nStep 1: Checking for duplicate users...")
    all_users = await db.users.find().to_list(length=None)
    
    email_groups = defaultdict(list)
    for user in all_users:
        email_groups[user['email']].append(user)
    
    duplicates = {email: users for email, users in email_groups.items() if len(users) > 1}
    
    if duplicates:
        print(f"\n⚠️  Found {len(duplicates)} emails with duplicates:")
        for email, users in duplicates.items():
            print(f"\n  Email: {email} ({len(users)} entries)")
            for user in users:
                print(f"    - ID: {user['id']}")
                print(f"      Name: {user.get('name')}")
                print(f"      Phone: {user.get('phone', 'N/A')}")
                print(f"      Has details: {'Yes' if user.get('phone') else 'No'}")
                print(f"      Created: {user.get('created_at')}")
                
                # Check medications for this user
                meds = await db.medications.find({"user_id": user['id']}).to_list(length=None)
                print(f"      Medications: {len(meds)}")
                if meds:
                    for med in meds:
                        print(f"        • {med.get('name')} - {med.get('dosage')}")
    else:
        print("\n✓ No duplicate users found")
    
    # Step 2: Check users with medications
    print("\n" + "=" * 60)
    print("USERS WITH MEDICATIONS")
    print("=" * 60)
    
    users_with_meds = []
    for user in all_users:
        meds = await db.medications.find({"user_id": user['id']}).to_list(length=None)
        if meds:
            users_with_meds.append({
                'user': user,
                'meds_count': len(meds),
                'meds': meds
            })
    
    if users_with_meds:
        print(f"\nFound {len(users_with_meds)} users with medications:")
        for item in users_with_meds:
            user = item['user']
            print(f"\n  User: {user.get('name')} ({user.get('email')})")
            print(f"    ID: {user['id']}")
            print(f"    Phone: {user.get('phone', 'N/A')}")
            print(f"    Medications: {item['meds_count']}")
            for med in item['meds']:
                print(f"      • {med.get('name')} ({med.get('id')})")
    else:
        print("\n✓ No users with medications found")
    
    # Step 3: Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total users: {len(all_users)}")
    print(f"Unique emails: {len(email_groups)}")
    print(f"Duplicate emails: {len(duplicates)}")
    print(f"Users with medications: {len(users_with_meds)}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(diagnose_issue())
