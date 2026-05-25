# Jitsi Meet - Final Setup & Testing Guide

## Overview

Your app now has **Jitsi Meet video calling** with proper camera/microphone permissions. This guide walks you through testing and deploying.

## What's Fixed

✅ **Camera/Microphone Permissions** - Now properly requested at native level
✅ **WebView Configuration** - Properly configured for media capture
✅ **Jitsi Configuration** - Optimized for Omegle-like experience
✅ **Error Handling** - Better error messages and logging
✅ **Still FREE** - No credit card required, no hosting needed

## Quick Start

### 1. Test on Emulator

```bash
# Start emulator
emulator -avd Pixel_6_API_34

# Run app
npm start

# Select 'a' for Android
# Wait for app to load

# Test:
1. Click "Find Random Match"
2. Grant camera permission when prompted
3. Grant microphone permission when prompted
4. Video should start
5. Click settings - should show "permission granted"
```

### 2. Test on Physical Device

```bash
# Connect device via USB
# Enable USB debugging

# Run app
npm start

# Select 'a' for Android
# Select your physical device

# Same test as above
```

### 3. Test with Two Devices

See `TEST_TWO_DEVICES.md` for detailed instructions

## File Structure

```
websitew/
├── src/screens/
│   └── CallPage.js                    ← Updated with permission requests
├── app.json                           ← Updated with Jitsi plugin
├── plugins/
│   └── withJitsiMeet.js              ← New: Expo config plugin
├── android/app/src/main/
│   └── AndroidManifest.xml           ← Has permissions
└── JITSI_PERMISSION_FIX_SUMMARY.md   ← This guide
```

## Key Changes

### CallPage.js

**New imports:**
```javascript
import { PermissionsAndroid, Platform } from 'react-native';
import * as Camera from 'expo-camera';
```

**New function:**
```javascript
const requestPermissions = async () => {
  // Requests CAMERA and RECORD_AUDIO permissions
  // Shows dialogs to user
  // Logs success/failure
};
```

**Updated useEffect:**
```javascript
useEffect(() => {
  requestPermissions();  // ← NEW
  getCurrentUser();
  // ...
}, []);
```

**Updated WebView:**
```javascript
<WebView
  mediaCapturePermissionGrantType="grant"
  onPermissionRequest={(request) => {
    request.grant(request.resources);
  }}
  userAgent="Mozilla/5.0 (Linux; Android 13)..."
/>
```

### app.json

**Added plugin:**
```json
"plugins": [
  "./plugins/withJitsiMeet",
  // ... other plugins
]
```

**Added build config:**
```json
"android": {
  "extraBuildGradle": "allprojects { repositories { maven { url 'https://github.com/jitsi/jitsi-maven-repository/raw/master/releases' } } }"
}
```

## Testing Checklist

### Permissions
- [ ] Camera permission dialog appears
- [ ] Microphone permission dialog appears
- [ ] User can grant permissions
- [ ] Permissions are remembered

### Video Call
- [ ] Jitsi loads after permissions granted
- [ ] Video starts automatically
- [ ] Can see other person's video
- [ ] Video is clear and responsive

### Audio
- [ ] Audio works
- [ ] Can hear other person
- [ ] Microphone works
- [ ] No echo or feedback

### Settings
- [ ] Can click settings in Jitsi
- [ ] Camera shows "granted"
- [ ] Microphone shows "granted"

### Timer & Cleanup
- [ ] 3-minute timer works
- [ ] Alert appears after 3 minutes
- [ ] Call ends automatically
- [ ] Both devices return to home screen
- [ ] Can find new matches

## Debugging

### View Logs

```bash
# All logs
adb logcat

# App logs only
adb logcat | grep "LOG"

# Errors only
adb logcat | grep "ERROR"

# Jitsi logs
adb logcat | grep "Jitsi"
```

### Expected Logs

**When CallPage mounts:**
```
LOG  ✅ Camera and microphone permissions granted (Android)
```

**When Jitsi loads:**
```
LOG  🚀 Initializing Jitsi Meet...
LOG  📍 Room: <room_name>
LOG  👤 User: <username>
LOG  ✅ Got media stream: MediaStream {...}
LOG  ✅ Joined conference: {...}
```

**When call ends:**
```
LOG  👋 Left conference: {...}
LOG  Call ended: { callID: "...", reason: "left-meeting" }
```

### Common Issues

**Issue: "permission not granted" in settings**
- Solution: Check Android manifest has permissions
- Solution: Clear app data: `adb shell pm clear com.flexx.app`
- Solution: Check device settings: Settings → Apps → Flexx → Permissions

**Issue: Video doesn't start**
- Solution: Check permissions are granted
- Solution: Check camera works in device settings
- Solution: Check Jitsi loads (should see "Connecting...")

**Issue: Audio doesn't work**
- Solution: Check microphone permission granted
- Solution: Check device volume is not muted
- Solution: Check audio settings in Jitsi

**Issue: App crashes**
- Solution: Check logs: `adb logcat | grep ERROR`
- Solution: Check Supabase connection
- Solution: Check permissions are requested

## Building for Production

### Step 1: Test Thoroughly
- Test on emulator
- Test on physical device
- Test with two devices
- Test all features

### Step 2: Build APK

```bash
# Development build
eas build --profile development --platform android

# Production build
eas build --profile production --platform android
```

### Step 3: Download & Install

1. Go to https://expo.dev/builds
2. Find your build
3. Download APK
4. Install on device: `adb install app.apk`

### Step 4: Test APK

- Test all features
- Test on multiple devices
- Monitor for crashes

## Performance Tips

1. **Use WiFi** - Better for video quality
2. **Close other apps** - More resources for video
3. **Keep devices close** - Better audio
4. **Use good lighting** - Better video quality
5. **Test on different networks** - Ensure reliability

## Deployment Checklist

- [ ] Tested on emulator
- [ ] Tested on physical device
- [ ] Tested with two devices
- [ ] All permissions working
- [ ] Video/audio working
- [ ] Timer working
- [ ] Cleanup working
- [ ] Built APK
- [ ] Tested APK
- [ ] Ready to deploy

## Important Notes

### Still FREE
- ✅ Using Jitsi Meet (free, no credit card)
- ✅ No hosting required
- ✅ No backend infrastructure needed
- ✅ Completely free forever

### Still WebView
- ✅ No native module build issues
- ✅ Easier to maintain
- ✅ Works on all Android versions
- ✅ Permissions now properly handled

### Omegle-like Experience
- ✅ Instant video calls
- ✅ Random matching
- ✅ 3-minute limit
- ✅ Auto-cleanup
- ✅ Simple UI

## Next Steps

1. **Test on emulator** - Verify everything works
2. **Test on physical device** - Verify video/audio
3. **Test with two devices** - Verify matching
4. **Build APK** - When ready
5. **Deploy to users** - Launch!

## Support

If you encounter issues:

1. **Check logs** - `adb logcat | grep ERROR`
2. **Check permissions** - Device settings
3. **Check network** - WiFi connection
4. **Check Supabase** - Database connection
5. **Check device** - Camera/microphone work

## Files to Review

- `src/screens/CallPage.js` - Main video call implementation
- `src/screens/HomePage.js` - Matching logic
- `app.json` - Expo configuration
- `android/app/src/main/AndroidManifest.xml` - Android permissions
- `JITSI_PERMISSION_FIX_SUMMARY.md` - Detailed changes
- `TEST_TWO_DEVICES.md` - Testing guide

---

**Status:** ✅ Ready to test and deploy
**Last Updated:** May 24, 2026
**Cost:** FREE forever
**Build Time:** 10-15 minutes (EAS build)
**Deployment:** Ready when you are!
