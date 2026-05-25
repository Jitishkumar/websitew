# Quick Reference - Jitsi Meet Setup

## Problem → Solution

| Problem | Solution |
|---------|----------|
| "permission not granted" in settings | Added native permission requests in CallPage.js |
| WebView can't access camera | Added `mediaCapturePermissionGrantType="grant"` |
| WebView can't access microphone | Added `onPermissionRequest` handler |
| Video doesn't start | Improved Jitsi configuration |
| Audio doesn't work | Added audio config with echo cancellation |

## Quick Test

```bash
# Emulator
npm start → 'a' → Find Match → Grant permissions → Video starts ✅

# Physical Device
npm start → 'a' → Select device → Find Match → Grant permissions → Video starts ✅

# Two Devices
Terminal 1: npm start → 'a' (emulator)
Terminal 2: npm start → 'a' (physical device)
Both: Find Match → Grant permissions → Video starts ✅
```

## Key Files Changed

| File | Change |
|------|--------|
| `src/screens/CallPage.js` | Added permission requests, improved Jitsi config |
| `app.json` | Added Jitsi plugin |
| `plugins/withJitsiMeet.js` | Created (new file) |

## Permission Flow

```
1. User navigates to CallPage
   ↓
2. requestPermissions() called
   ↓
3. Android permission dialogs shown
   ↓
4. User grants permissions
   ↓
5. WebView loads Jitsi
   ↓
6. Jitsi requests camera/microphone
   ↓
7. WebView grants permissions (already approved)
   ↓
8. Video/audio starts ✅
```

## Testing Commands

```bash
# View logs
adb logcat | grep "LOG"

# View errors
adb logcat | grep "ERROR"

# View Jitsi logs
adb logcat | grep "Jitsi"

# Clear app data
adb shell pm clear com.flexx.app

# List devices
adb devices

# Install APK
adb install app.apk
```

## Expected Behavior

### Before Fix
```
❌ WebView loads
❌ Click settings → "permission not granted"
❌ No video/audio
```

### After Fix
```
✅ Permissions requested
✅ User grants permissions
✅ WebView loads
✅ Click settings → "permission granted"
✅ Video/audio works
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "permission not granted" | Check Android manifest, clear app data |
| Video doesn't start | Check permissions granted, check camera works |
| Audio doesn't work | Check microphone permission, check volume |
| App crashes | Check logs, check Supabase connection |
| Devices don't match | Check network, check database |

## Build & Deploy

```bash
# Development build
eas build --profile development --platform android

# Production build
eas build --profile production --platform android

# Install APK
adb install app.apk
```

## Important Notes

- ✅ Still FREE (Jitsi Meet)
- ✅ Still WebView (no native module issues)
- ✅ Permissions now properly handled
- ✅ Video/audio should work
- ✅ Omegle-like experience maintained

## Next Steps

1. Test on emulator
2. Test on physical device
3. Test with two devices
4. Build APK
5. Deploy to users

---

**Last Updated:** May 24, 2026
