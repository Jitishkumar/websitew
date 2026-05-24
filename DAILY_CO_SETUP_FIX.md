# Daily.co Setup - Bundling Error Fix

## Problem
You're getting a bundling error: `Unable to resolve "@daily-co/react-native-daily-js" from "src/screens/CallPage.js"`

## Root Cause
This is a Metro bundler cache issue. The error message is misleading - we're NOT actually importing this package. We're using a WebView with an iframe approach instead, which doesn't require the native SDK.

## Solution

### Step 1: Clear All Caches
Run this command in your project directory:
```bash
rm -rf node_modules/.cache .expo ~/Library/Caches/expo ~/Library/Caches/Expo
watchman watch-del-all 2>/dev/null || true
```

Or use the provided script:
```bash
bash reset-cache.sh
```

### Step 2: Restart Expo
1. Stop the current Expo process (Ctrl+C)
2. Clear the Expo cache by pressing `c` when prompted
3. Restart with: `npm start`
4. Press `a` to run on Android emulator or physical device

### Step 3: Verify the Fix
The app should now bundle successfully without the Daily.co SDK error.

## Current Implementation

### CallPage.js (WebView + Iframe Approach)
- Uses Daily.co's embed URL directly in an iframe
- No native SDK required
- Simpler and more reliable
- Loads Daily.co prebuilt UI from their CDN

### Key Features
✅ 3-minute call limit (automatic end)
✅ Room creation with auto-generated IDs
✅ Database tracking of active calls
✅ Proper cleanup on call end
✅ App state handling (background/foreground)
✅ Error handling and user feedback

## Testing on Physical Device

### Prerequisites
1. USB debugging enabled on your device
2. Device connected via USB
3. Debug APK installed (already done)

### Steps
1. Run `npm start`
2. Press `a` to select Android device
3. Expo will show available devices - select your physical device
4. App will install and run on your device

### Troubleshooting Physical Device
- If Expo defaults to emulator, press `a` and wait for device list
- Make sure USB debugging is enabled: Settings > Developer Options > USB Debugging
- Try: `adb devices` to verify device is connected

## Next Steps
1. Test video call on physical device
2. Verify 3-minute limit works
3. Test call cleanup and database updates
4. Test with two devices simultaneously

## Files Modified
- `src/screens/CallPage.js` - WebView implementation
- `src/screens/HomePage.js` - Room creation logic
- `android/app/src/main/AndroidManifest.xml` - Permissions
- `android/app/src/main/res/xml/network_security_config.xml` - Network config
- `package.json` - Dependencies (Daily.co SDK NOT needed)

## Important Notes
- We're using Daily.co's auto-room feature (no API key needed)
- Room URLs are auto-created: `https://perfectfl.daily.co/UNIQUE_ID`
- The WebView approach is simpler and more reliable than native SDK
- All video/audio handling is done by Daily.co's embed
