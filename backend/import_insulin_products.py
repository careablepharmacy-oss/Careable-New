#!/usr/bin/env python3
"""
Import insulin products from CSV to MongoDB
Replaces the old insulin_iu_data collection with new comprehensive data
"""
import asyncio
import csv
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def import_insulin_products():
    """Import insulin products from CSV file"""
    
    # MongoDB connection
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    csv_path = ROOT_DIR / 'insulin_products.csv'
    
    print(f"[Import] Reading CSV file: {csv_path}")
    
    insulin_products = []
    
    with open(csv_path, 'r', encoding='utf-8') as file:
        csv_reader = csv.DictReader(file)
        
        for row in csv_reader:
            medicine_name = row.get('Medicine Name', '').strip()
            ml = row.get('ML', '').strip()
            iu_per_package = row.get('IU/Package', '').strip()
            total_units = row.get('Total Units', '').strip()
            
            if medicine_name and ml and iu_per_package and total_units:
                product_doc = {
                    'id': str(uuid.uuid4()),
                    'name': medicine_name,
                    'name_lower': medicine_name.lower(),
                    'ml': float(ml),
                    'iu_per_package': int(iu_per_package),
                    'total_units': int(total_units)
                }
                insulin_products.append(product_doc)
    
    if not insulin_products:
        print("[Import] ERROR: No insulin products found in CSV")
        return
    
    print(f"[Import] Parsed {len(insulin_products)} insulin products from CSV")
    
    # Check if collection exists and drop it
    existing_count = await db.insulin_iu_data.count_documents({})
    if existing_count > 0:
        print(f"[Import] Found {existing_count} existing products, dropping collection...")
        await db.insulin_iu_data.drop()
    
    # Insert new products
    result = await db.insulin_iu_data.insert_many(insulin_products)
    print(f"[Import] ✅ Inserted {len(result.inserted_ids)} insulin products")
    
    # Create index on name_lower for faster searches
    await db.insulin_iu_data.create_index([('name_lower', 1)])
    print("[Import] ✅ Created index on name_lower")
    
    # Show sample products
    print("\n[Import] Sample products:")
    sample = insulin_products[:5]
    for prod in sample:
        print(f"  - {prod['name']}: {prod['ml']}ml, {prod['iu_per_package']} IU/pkg, Total: {prod['total_units']} IU")
    
    print(f"\n[Import] ✅ Import complete! Total products: {len(insulin_products)}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(import_insulin_products())
