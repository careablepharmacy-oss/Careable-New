#!/usr/bin/env python3
"""
Import medicines from CSV into MongoDB
Run this script to populate the medicines collection
"""

import asyncio
import csv
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import uuid

# Load environment variables
load_dotenv()

async def import_medicines():
    """Import medicines from CSV file into MongoDB"""
    
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🔗 Connected to MongoDB")
    
    # Drop existing medicines collection (fresh start)
    await db.medicines.drop()
    print("🗑️  Dropped existing medicines collection")
    
    # Read CSV file
    csv_path = 'medicines.csv'
    medicines = []
    
    with open(csv_path, 'r', encoding='utf-8') as file:
        csv_reader = csv.DictReader(file)
        
        for row in csv_reader:
            # Extract medicine name from "Brand Name" column
            medicine_name = row.get('Brand Name', '').strip()
            
            if medicine_name:
                # Create medicine document
                medicine_doc = {
                    'id': str(uuid.uuid4()),
                    'name': medicine_name,
                    'name_lower': medicine_name.lower()  # For case-insensitive search
                }
                medicines.append(medicine_doc)
    
    # Insert into MongoDB
    if medicines:
        result = await db.medicines.insert_many(medicines)
        print(f"✅ Inserted {len(result.inserted_ids)} medicines")
    else:
        print("❌ No medicines found in CSV")
        return
    
    # Create text index for autocomplete search
    # Index on name_lower for prefix matching
    await db.medicines.create_index([('name_lower', 1)])
    print("📊 Created index on name_lower field")
    
    # Display sample medicines
    print("\n📋 Sample medicines imported:")
    sample = await db.medicines.find().limit(10).to_list(length=10)
    for med in sample:
        print(f"   - {med['name']}")
    
    print(f"\n✅ Import complete! Total medicines: {len(medicines)}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(import_medicines())
