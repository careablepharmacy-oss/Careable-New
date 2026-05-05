# Build Version Management Instructions

## Overview
This app uses a multi-layered version management system to ensure old cached PWA files are properly cleared when users install a new APK build.

## Version Update Process

### When Creating a New APK Build:

**Step 1: Update version.json**
Location: `public/version.json`
```json
{
  "version": "1.0.2",  // INCREMENT THIS
  "buildDate": "2024-12-07",  // UPDATE THIS
  "description": "Bug fixes and improvements"  // UPDATE THIS
}
```

**Step 2: Update Native Android Version**
Location: `android/app/src/main/java/com/diabexpert/app/VersionCacheManager.java`

Find this line:
```java
private static final String CURRENT_VERSION = "1.0.1"; // Update this with each build
```

Change to match version.json:
```java
private static final String CURRENT_VERSION = "1.0.2"; // Update this with each build
```

**Step 3: Build the App**
```bash
# 1. Install dependencies (if needed)
yarn install

# 2. Build web assets
yarn build

# 3. Sync to Android
npx cap sync android

# 4. Open in Android Studio
npx cap open android

# 5. In Android Studio:
#    - Build > Build Bundle(s) / APK(s) > Build APK(s)
#    - Find APK: android/app/build/outputs/apk/debug/app-debug.apk
```

## Version Numbering Convention

Use semantic versioning: `MAJOR.MINOR.PATCH`

**Examples:**
- `1.0.0` - Initial release
- `1.0.1` - Bug fixes
- `1.0.2` - More bug fixes
- `1.1.0` - New features
- `2.0.0` - Major changes

## How It Works

### Layer 1: Service Worker (JavaScript)
- On activation, checks version.json
- If version changed, clears all caches
- Notifies app to reload

### Layer 2: App Startup (JavaScript)
- In App.js, checks stored version vs current version
- If different:
  - Unregisters all service workers
  - Clears all caches
  - Clears localStorage (except auth data)
  - Reloads app with fresh files

### Layer 3: Native Android (Java)
- In MainActivity.onCreate(), runs FIRST
- Checks stored version vs VersionCacheManager.CURRENT_VERSION
- If different:
  - Clears WebView cache
  - Clears app cache directory
  - Clears WebView cache directory
  - Saves new version

## Testing the Version System

### Test on Development:
1. Note current version (e.g., 1.0.1)
2. Change version to 1.0.2 (both files)
3. Build and deploy
4. Open app - should see version change message
5. Check About page - should show 1.0.2

### Test on Android:
1. Install APK version 1.0.1
2. Open app, use it normally
3. Build new APK with version 1.0.2
4. Install new APK (don't uninstall old one)
5. Open app - should clear caches automatically
6. Check About page - should show 1.0.2
7. Old cached content should be gone

## Troubleshooting

### Issue: Old app still loads after new APK install
**Solution:**
- Verify both version.json AND VersionCacheManager.java were updated
- Check Android logs: `adb logcat | grep VersionCacheManager`
- Look for: "Version changed! Clearing WebView cache..."

### Issue: Version not updating in About page
**Solution:**
- Clear browser cache manually
- Force stop app and restart
- Check version.json is in /public/ folder (not /src/)

### Issue: Service worker not updating
**Solution:**
- The native code should handle this
- Check Chrome DevTools > Application > Service Workers
- Click "Unregister" if needed

## Quick Checklist for New Build

- [ ] Update `public/version.json` → version field
- [ ] Update `public/version.json` → buildDate field
- [ ] Update `public/version.json` → description field
- [ ] Update `VersionCacheManager.java` → CURRENT_VERSION
- [ ] Run `yarn build`
- [ ] Run `npx cap sync android`
- [ ] Build APK in Android Studio
- [ ] Test on a device

## Version Display Locations

1. **About Page** (`/about`)
   - Shows version, build date, description
   - Accessible from Profile > About & Version

2. **Android Logs**
   - MainActivity logs current version on startup
   - VersionCacheManager logs version checks

3. **Browser DevTools**
   - Console logs from service worker
   - Console logs from App.js version check

## Important Notes

- **Always update both files** (version.json AND VersionCacheManager.java)
- **Version must match exactly** in both files
- **Test thoroughly** before releasing to users
- **Native cache clearing** ensures even stubborn caches are cleared
- **Keep a changelog** of what changed in each version

## Files to Update for Each Build

1. `/public/version.json`
2. `/android/app/src/main/java/com/diabexpert/app/VersionCacheManager.java`

That's it! Just these two files need version updates.
