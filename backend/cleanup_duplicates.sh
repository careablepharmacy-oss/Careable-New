#!/bin/bash
# MongoDB Shell script to clean duplicate users
# This works if mongosh or mongo CLI is available

echo "======================================================================="
echo "🔧 PRODUCTION DATABASE CLEANUP - DUPLICATE USERS"
echo "======================================================================="
echo ""

# Get environment variables
MONGO_URL="${MONGO_URL:-mongodb://localhost:27017}"
DB_NAME="${DB_NAME:-test_database}"

echo "Connecting to: $MONGO_URL"
echo "Database: $DB_NAME"
echo ""

# Check if mongosh is available
if command -v mongosh &> /dev/null; then
    MONGO_CMD="mongosh"
elif command -v mongo &> /dev/null; then
    MONGO_CMD="mongo"
else
    echo "❌ Error: Neither mongosh nor mongo command found"
    echo "Please install MongoDB Shell or use Python script"
    exit 1
fi

echo "Using: $MONGO_CMD"
echo ""

# Create JavaScript cleanup script
cat > /tmp/cleanup_duplicates.js << 'EOJS'
// Find and remove duplicate users
print("📊 Step 1: Finding duplicate users...");

const users = db.users.find().toArray();
print("   Found " + users.length + " total users");

// Group by email
const emailGroups = {};
users.forEach(user => {
    if (!emailGroups[user.email]) {
        emailGroups[user.email] = [];
    }
    emailGroups[user.email].push(user);
});

// Find duplicates
const duplicates = {};
let duplicateCount = 0;
Object.keys(emailGroups).forEach(email => {
    if (emailGroups[email].length > 1) {
        duplicates[email] = emailGroups[email];
        duplicateCount++;
    }
});

if (duplicateCount === 0) {
    print("\n✅ No duplicate users found!");
    print("   Database is clean. No action needed.");
    quit(0);
}

print("\n⚠️  Found " + duplicateCount + " emails with duplicates");

// Process each duplicate
print("\n🔧 Step 2: Removing duplicates...");
let deletedCount = 0;

Object.keys(duplicates).forEach(email => {
    const userList = duplicates[email];
    print("\n   Processing: " + email + " (" + userList.length + " entries)");
    
    // Sort by created_at (keep most recent)
    userList.sort((a, b) => {
        const dateA = a.created_at || '1970-01-01T00:00:00';
        const dateB = b.created_at || '1970-01-01T00:00:00';
        return dateB.localeCompare(dateA);
    });
    
    const keepUser = userList[0];
    const deleteUsers = userList.slice(1);
    
    print("   ✓ Keeping: " + keepUser.id + " (created: " + (keepUser.created_at || 'unknown') + ")");
    
    deleteUsers.forEach(user => {
        // Check for medications
        const medsCount = db.medications.countDocuments({ user_id: user.id });
        
        if (medsCount > 0) {
            print("   ⚠️  Duplicate has " + medsCount + " medications!");
            print("      Transferring to " + keepUser.id);
            
            // Transfer medications
            const result = db.medications.updateMany(
                { user_id: user.id },
                { $set: { user_id: keepUser.id } }
            );
            print("      ✓ Transferred " + result.modifiedCount + " medications");
        }
        
        // Delete duplicate user
        const delResult = db.users.deleteOne({ id: user.id });
        if (delResult.deletedCount > 0) {
            print("   ✓ Deleted: " + user.id);
            deletedCount++;
        }
    });
});

print("\n✅ Cleanup complete! Deleted " + deletedCount + " duplicate users");

// Add unique index
print("\n🔒 Step 3: Adding unique index on email...");
try {
    db.users.createIndex({ email: 1 }, { unique: true });
    print("   ✓ Created unique index on email field");
} catch (e) {
    if (e.code === 85) {
        print("   ✓ Unique index already exists");
    } else {
        print("   ⚠️  Error creating index: " + e.message);
    }
}

// Final verification
print("\n📊 Step 4: Verification...");
const finalCount = db.users.countDocuments({});
const uniqueEmails = db.users.distinct("email").length;

print("   Total users: " + finalCount);
print("   Unique emails: " + uniqueEmails);

if (finalCount === uniqueEmails) {
    print("\n✅ SUCCESS! No duplicates remaining.");
} else {
    print("\n⚠️  Warning: " + (finalCount - uniqueEmails) + " potential duplicates still exist");
}

print("\n=======================================================================");
print("🎉 CLEANUP COMPLETED!");
print("=======================================================================\n");
EOJS

# Run the cleanup script
$MONGO_CMD "$MONGO_URL/$DB_NAME" /tmp/cleanup_duplicates.js

# Clean up temp file
rm -f /tmp/cleanup_duplicates.js

echo ""
echo "Next steps:"
echo "1. Test the prescription manager dashboard"
echo "2. Verify all 'Manage Medications' buttons work"
echo "3. Check for any errors in application"
echo ""
