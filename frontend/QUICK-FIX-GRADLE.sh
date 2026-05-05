#!/bin/bash

echo "🔧 DiabeXpert - Gradle Sync Quick Fix Script"
echo "============================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this from the frontend directory"
    echo "Usage: cd frontend && bash QUICK-FIX-GRADLE.sh"
    exit 1
fi

echo "Step 1: Cleaning old build files..."
rm -rf android/.gradle
rm -rf android/build
rm -rf android/app/build
rm -rf node_modules/.cache
echo "✅ Clean complete"
echo ""

echo "Step 2: Checking Java version..."
java -version
echo ""

echo "Step 3: Stopping any running Gradle daemons..."
cd android
./gradlew --stop 2>/dev/null || true
cd ..
echo "✅ Gradle stopped"
echo ""

echo "Step 4: Building React app..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies first..."
    yarn install
fi
yarn build
echo "✅ Build complete"
echo ""

echo "Step 5: Syncing Capacitor (this is where the error might occur)..."
npx cap sync android --force
SYNC_STATUS=$?
echo ""

if [ $SYNC_STATUS -eq 0 ]; then
    echo "✅✅✅ SUCCESS! Gradle sync completed without errors!"
    echo ""
    echo "Next steps:"
    echo "1. Open Android Studio: npx cap open android"
    echo "2. Build APK: Build → Build APK(s)"
else
    echo "❌ Sync failed with error code: $SYNC_STATUS"
    echo ""
    echo "🔧 Trying alternative fixes..."
    echo ""
    
    echo "Alternative 1: Updating Gradle wrapper..."
    cd android
    ./gradlew wrapper --gradle-version=8.5
    cd ..
    echo ""
    
    echo "Trying sync again..."
    npx cap sync android
    SYNC_STATUS=$?
    
    if [ $SYNC_STATUS -eq 0 ]; then
        echo "✅ Fixed! Gradle wrapper update worked!"
    else
        echo "❌ Still failing. Please check GRADLE-SYNC-TROUBLESHOOTING.md"
        echo ""
        echo "Quick checks:"
        echo "1. Java version (should be 11 or 17):"
        java -version
        echo ""
        echo "2. Gradle version:"
        cd android && ./gradlew --version && cd ..
        echo ""
        echo "3. Try opening in Android Studio and let it sync"
    fi
fi

echo ""
echo "Script complete!"
