#!/usr/bin/env python3
"""
Database Cleanup Script for DiabeXpert
Removes all user data except the prescription manager admin account
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

ADMIN_EMAIL = "diabexpertonline@gmail.com"

async def cleanup_database():
    """Clean database keeping only admin account"""
    
    print("=" * 60)
    print("DATABASE CLEANUP SCRIPT")
    print("=" * 60)
    print()
    print(f"⚠️  WARNING: This will delete ALL data except {ADMIN_EMAIL}")
    print()
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("📊 Current Database Stats:")
    print("-" * 60)
    
    # Get current counts
    users_count = await db.users.count_documents({})
    medications_count = await db.medications.count_documents({})
    adherence_logs_count = await db.adherence_logs.count_documents({})
    adherence_records_count = await db.adherence_records.count_documents({})
    glucose_count = await db.blood_glucose.count_documents({})
    bp_count = await db.blood_pressure.count_documents({})
    metrics_count = await db.body_metrics.count_documents({})
    appointments_count = await db.appointments.count_documents({})
    sessions_count = await db.sessions.count_documents({})
    
    print(f"Users: {users_count}")
    print(f"Medications: {medications_count}")
    print(f"Adherence Logs: {adherence_logs_count}")
    print(f"Adherence Records: {adherence_records_count}")
    print(f"Blood Glucose: {glucose_count}")
    print(f"Blood Pressure: {bp_count}")
    print(f"Body Metrics: {metrics_count}")
    print(f"Appointments: {appointments_count}")
    print(f"Sessions: {sessions_count}")
    print()
    
    # Find admin user
    admin = await db.users.find_one({"email": ADMIN_EMAIL})
    
    if not admin:
        print(f"❌ Admin user {ADMIN_EMAIL} not found!")
        print("   Creating admin user is required before cleanup.")
        client.close()
        return
    
    admin_id = admin['id']
    print(f"✅ Found admin user: {admin['name']} ({ADMIN_EMAIL})")
    print(f"   User ID: {admin_id}")
    print()
    
    # Confirmation
    print("=" * 60)
    print("⚠️  FINAL WARNING")
    print("=" * 60)
    print()
    print("This will DELETE:")
    print(f"  - All users except {ADMIN_EMAIL}")
    print("  - All medications")
    print("  - All adherence logs (webhooks)")
    print("  - All health records")
    print("  - All appointments")
    print("  - All sessions (except admin)")
    print()
    print("This CANNOT be undone!")
    print()
    
    confirm = input("Type 'DELETE ALL' to proceed: ")
    
    if confirm != "DELETE ALL":
        print("❌ Cleanup cancelled.")
        client.close()
        return
    
    print()
    print("🗑️  Starting cleanup...")
    print("-" * 60)
    
    # Delete all data for non-admin users
    
    # 1. Get all non-admin user IDs
    non_admin_users = await db.users.find({
        "email": {"$ne": ADMIN_EMAIL}
    }).to_list(length=None)
    
    non_admin_ids = [u['id'] for u in non_admin_users]
    
    if non_admin_ids:
        print(f"Found {len(non_admin_ids)} non-admin users to delete")
        
        # Delete associated data for non-admin users
        med_result = await db.medications.delete_many({"user_id": {"$in": non_admin_ids}})
        print(f"✓ Deleted {med_result.deleted_count} medications")
        
        log_result = await db.adherence_logs.delete_many({"user_id": {"$in": non_admin_ids}})
        print(f"✓ Deleted {log_result.deleted_count} adherence logs")
        
        rec_result = await db.adherence_records.delete_many({"user_id": {"$in": non_admin_ids}})
        print(f"✓ Deleted {rec_result.deleted_count} adherence records")
        
        glucose_result = await db.blood_glucose.delete_many({"user_id": {"$in": non_admin_ids}})
        print(f"✓ Deleted {glucose_result.deleted_count} blood glucose records")
        
        bp_result = await db.blood_pressure.delete_many({"user_id": {"$in": non_admin_ids}})
        print(f"✓ Deleted {bp_result.deleted_count} blood pressure records")
        
        metrics_result = await db.body_metrics.delete_many({"user_id": {"$in": non_admin_ids}})
        print(f"✓ Deleted {metrics_result.deleted_count} body metrics")
        
        appt_result = await db.appointments.delete_many({"user_id": {"$in": non_admin_ids}})
        print(f"✓ Deleted {appt_result.deleted_count} appointments")
        
        session_result = await db.sessions.delete_many({"user_id": {"$in": non_admin_ids}})
        print(f"✓ Deleted {session_result.deleted_count} sessions")
        
        # Delete non-admin users
        user_result = await db.users.delete_many({"email": {"$ne": ADMIN_EMAIL}})
        print(f"✓ Deleted {user_result.deleted_count} users")
    else:
        print("No non-admin users found")
    
    # Also delete any admin user's medications/data (keep only the user account)
    print()
    print("Cleaning admin user's data (keeping account)...")
    
    admin_med_result = await db.medications.delete_many({"user_id": admin_id})
    print(f"✓ Deleted {admin_med_result.deleted_count} admin medications")
    
    admin_log_result = await db.adherence_logs.delete_many({"user_id": admin_id})
    print(f"✓ Deleted {admin_log_result.deleted_count} admin adherence logs")
    
    admin_rec_result = await db.adherence_records.delete_many({"user_id": admin_id})
    print(f"✓ Deleted {admin_rec_result.deleted_count} admin adherence records")
    
    admin_glucose_result = await db.blood_glucose.delete_many({"user_id": admin_id})
    print(f"✓ Deleted {admin_glucose_result.deleted_count} admin blood glucose")
    
    admin_bp_result = await db.blood_pressure.delete_many({"user_id": admin_id})
    print(f"✓ Deleted {admin_bp_result.deleted_count} admin blood pressure")
    
    admin_metrics_result = await db.body_metrics.delete_many({"user_id": admin_id})
    print(f"✓ Deleted {admin_metrics_result.deleted_count} admin body metrics")
    
    admin_appt_result = await db.appointments.delete_many({"user_id": admin_id})
    print(f"✓ Deleted {admin_appt_result.deleted_count} admin appointments")
    
    print()
    print("=" * 60)
    print("✅ CLEANUP COMPLETE")
    print("=" * 60)
    print()
    
    # Show final stats
    final_users = await db.users.count_documents({})
    final_meds = await db.medications.count_documents({})
    final_logs = await db.adherence_logs.count_documents({})
    
    print("📊 Final Database Stats:")
    print("-" * 60)
    print(f"Users: {final_users} (should be 1 - admin only)")
    print(f"Medications: {final_meds} (should be 0)")
    print(f"Adherence Logs: {final_logs} (should be 0)")
    print()
    
    if final_users == 1 and final_meds == 0 and final_logs == 0:
        print("✅ Database successfully cleaned!")
        print(f"✅ Admin account {ADMIN_EMAIL} preserved")
        print("✅ Ready for fresh start")
    else:
        print("⚠️  Warning: Some data may remain")
    
    print()
    
    client.close()

if __name__ == "__main__":
    print()
    asyncio.run(cleanup_database())
    print()
