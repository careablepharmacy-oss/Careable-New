#!/usr/bin/env python3
"""
Import insulin IU data from CSV into MongoDB
Run this script to populate the insulin_iu_data collection
"""

import asyncio
import csv
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import uuid

# Load environment variables
load_dotenv()

async def import_insulin_iu():
    """Import insulin IU data from CSV file into MongoDB"""
    
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🔗 Connected to MongoDB")
    
    # Drop existing insulin_iu_data collection (fresh start)
    await db.insulin_iu_data.drop()
    print("🗑️  Dropped existing insulin_iu_data collection")
    
    # Read CSV file
    csv_path = 'insulin_iu_data.csv'
    insulin_data = []
    
    with open(csv_path, 'r', encoding='utf-8') as file:
        csv_reader = csv.DictReader(file)
        
        for row in csv_reader:
            # Extract data from CSV
            medicine_name = row.get('Medicine Name', '').strip()
            ml = row.get('ML', '').strip()
            iu_per_package = row.get('IU/Package', '').strip()
            total_units = row.get('Total Units', '').strip()
            
            if medicine_name and total_units:
                # Create insulin document
                insulin_doc = {
                    'id': str(uuid.uuid4()),
                    'name': medicine_name,
                    'name_lower': medicine_name.lower(),  # For fuzzy search
                    'ml': int(ml) if ml else 0,
                    'iu_per_package': int(iu_per_package) if iu_per_package else 0,
                    'total_units': int(total_units) if total_units else 0
                }
                insulin_data.append(insulin_doc)
    
    # Insert into MongoDB
    if insulin_data:
        result = await db.insulin_iu_data.insert_many(insulin_data)
        print(f"✅ Inserted {len(result.inserted_ids)} insulin products")
    else:
        print("❌ No insulin data found in CSV")
        return
    
    # Create text index for fuzzy search
    await db.insulin_iu_data.create_index([('name_lower', 1)])
    print("📊 Created index on name_lower field")
    
    # Display sample data
    print("\n📋 Sample insulin data imported:")
    sample = await db.insulin_iu_data.find().limit(5).to_list(length=5)
    for insulin in sample:
        print(f"   - {insulin['name']} → {insulin['total_units']} IU (ML: {insulin['ml']}, IU/pkg: {insulin['iu_per_package']})")
    
    print(f"\n✅ Import complete! Total insulin products: {len(insulin_data)}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(import_insulin_iu())
