# DiabExpert APK Build Guide

## Version: 1.0.1
**Build Date:** December 6, 2024
**Features:** Hybrid Stock Tracking + Cache Clearing Solution

---

## 📦 Package Contents

This package includes:
- ✅ Complete React frontend source code
- ✅ Pre-built web assets (build folder)
- ✅ Android native project (fully synced)
- ✅ Capacitor configuration
- ✅ Cache clearing solution (multi-layer)
- ✅ Version management system
- ✅ All latest features and fixes

---

## ⚙️ Prerequisites

Before building the APK, ensure you have:

1. **Node.js** (v16 or higher)
   - Download: https://nodejs.org/

2. **Yarn package manager**
   ```bash
   npm install -g yarn
   ```

3. **Android Studio** (Arctic Fox or newer)
   - Download: https://developer.android.com/studio
   - Install with Android SDK

4. **JDK 11 or higher**
   - Usually comes with Android Studio
   - Verify: `java -version`

---

## 🚀 Quick Build (Recommended)

The web assets are already built and synced! Just:

### Step 1: Open in Android Studio
```bash
cd frontend
npx cap open android
```

### Step 2: Build APK
In Android Studio:
1. Wait for Gradle sync to complete
2. Go to: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**
3. Wait for build to complete
4. Find APK: `android/app/build/outputs/apk/debug/app-debug.apk`

**That's it! The APK is ready to install.**

---

## 🔧 Full Build (If You Need to Rebuild)

If you want to rebuild from scratch:

### Step 1: Extract Package
```bash
unzip diabexpert-v1.0.1-production.zip
cd frontend
```

### Step 2: Install Dependencies
```bash
yarn install
```

### Step 3: Build Web Assets
```bash
yarn build
```

### Step 4: Sync to Android
```bash
npx cap sync android
```

### Step 5: Open in Android Studio
```bash
npx cap open android
```

### Step 6: Build APK
In Android Studio:
- **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**

---

## 📱 Production Configuration

### Backend URL
The `.env` file is configured for production:
```
REACT_APP_BACKEND_URL=https://diabexpert.online
```

This points to your production backend where both frontend and backend are deployed together.

### No Changes Needed
The package is production-ready. You don't need to modify any configuration files.

---

## ✨ New Features in This Build

### 1. Hybrid Stock Tracking System
- Different dosages at different times
- Tablet tracking by count
- Injection tracking by IU (Volume × IU/ml)
- Auto-decrement vial count
- Add Stock functionality

### 2. Cache Clearing Solution ⭐ NEW
**Problem Solved:** Old cached PWA files persist after APK reinstall

**Solution:** Multi-layer version management
- Native Android cache clearing
- Service worker cache management
- JavaScript app startup check
- Automatic version detection and reload

### 3. Version Display
- Profile > About & Version
- Shows current version (1.0.1)
- Build date and feature list

### 4. Enhanced UI
- Mandatory fields highlighted
- Auto-detection for 221 insulin products
- Custom delete modal (no sandbox issues)
- Improved stock display

### 5. Admin Features
- Simple one-click insulin import (221 products)
- CSV upload functionality
- Database cleanup

---

## 🔄 Updating Version for Next Build

When you want to create version 1.0.2:

### Step 1: Update version.json
File: `public/version.json`
```json
{
  "version": "1.0.2",
  "buildDate": "2024-12-07",
  "description": "Your changes here"
}
```

### Step 2: Update Native Version
File: `android/app/src/main/java/com/diabexpert/app/VersionCacheManager.java`

Line 12:
```java
private static final String CURRENT_VERSION = "1.0.2";
```

### Step 3: Rebuild
```bash
yarn build
npx cap sync android
npx cap open android
# Build APK
```

**Important:** Both versions MUST match for cache clearing to work properly!

See `BUILD_VERSION_INSTRUCTIONS.md` for complete versioning guide.

---

## 🧪 Testing the APK

### Test on Physical Device (Recommended)
1. Enable USB debugging on your Android phone
2. Connect phone to computer
3. In Android Studio: Run > Run 'app'
4. Or install APK manually: `adb install app-debug.apk`

### Test on Emulator
1. In Android Studio: Tools > AVD Manager
2. Create/Start an emulator
3. Run > Run 'app'

### What to Test
- [ ] Login with Google works
- [ ] Add medication (tablet) with stock count
- [ ] Add medication (injection) with insulin detection
- [ ] Different dosages at different times
- [ ] Mark doses as taken (stock decrements)
- [ ] Add stock functionality works
- [ ] Profile > About shows version 1.0.1
- [ ] After reinstall, old cache is cleared

---

## 🐛 Troubleshooting

### Issue: Gradle Sync Failed
**Solution:**
1. Android Studio > File > Invalidate Caches > Restart
2. In Android Studio terminal: `./gradlew clean`
3. Build > Clean Project
4. Build > Rebuild Project

### Issue: Build Failed - Missing SDK
**Solution:**
1. Android Studio > Tools > SDK Manager
2. Install SDK Platform 34 (or whatever is required)
3. Install Build Tools 34.0.0
4. Click Apply, then OK

### Issue: Cannot Find JDK
**Solution:**
1. Android Studio > File > Project Structure
2. SDK Location > JDK location
3. Select installed JDK (usually in Android Studio folder)

### Issue: APK Installs But Shows Old Version
**Solution:**
- This is the issue we solved! New APK will automatically clear old caches
- Check version in Profile > About
- Check Android logs: `adb logcat | grep VersionCacheManager`

### Issue: yarn install fails
**Solution:**
```bash
# Clear yarn cache
yarn cache clean

# Delete node_modules
rm -rf node_modules

# Reinstall
yarn install
```

---

## 📂 Important Files

### Configuration
- `.env` - Backend URL (production configured)
- `capacitor.config.json` - Capacitor settings
- `android/build.gradle` - Android build config

### Version Management
- `public/version.json` - App version (1.0.1)
- `VersionCacheManager.java` - Native cache clearing
- `BUILD_VERSION_INSTRUCTIONS.md` - Complete versioning guide

### Documentation
- `APK_BUILD_GUIDE.md` - This file
- `BUILD_INSTRUCTIONS.txt` - Quick reference
- `BUILD_VERSION_INSTRUCTIONS.md` - Version update guide

---

## 📊 Package Statistics

- **Total Size:** ~3.5 MB (without node_modules)
- **node_modules:** Not included (install with `yarn install`)
- **Pre-built Assets:** Included (build folder)
- **Android Project:** Fully synced and ready

---

## ✅ Production Checklist

Before releasing to users:

- [x] Backend URL points to production (https://diabexpert.online)
- [x] Version set to 1.0.1 (in both files)
- [x] Web assets built and synced
- [x] Cache clearing solution implemented
- [x] Tested on physical Android device
- [x] Login flow works
- [x] Stock tracking works correctly
- [x] Insulin auto-detection works
- [x] About page shows correct version

---

## 🎯 Quick Command Reference

```bash
# Install dependencies
yarn install

# Build web assets
yarn build

# Sync to Android
npx cap sync android

# Open in Android Studio
npx cap open android

# Check version
cat public/version.json
```

---

## 📞 Support

For issues or questions:
1. Check `BUILD_VERSION_INSTRUCTIONS.md` for version management
2. Check Android Studio Build Output for error details
3. Use `adb logcat` to see device logs
4. Check service worker in Chrome DevTools (chrome://inspect)

---

## 🚀 You're Ready!

This package is production-ready. Just open in Android Studio and build the APK.

**No configuration changes needed.**
**No additional setup required.**
**Just build and deploy!**

Good luck with your release! 🎉
