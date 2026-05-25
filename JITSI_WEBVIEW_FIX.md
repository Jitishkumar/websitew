# Jitsi Meet WebView - Camera/Microphone Permission Fix

## Problem
WebView was showing "permission not granted" when clicking settings in Jitsi Meet because:
1. WebView doesn't have direct access to device camera/microphone
2. Permissions were not being requested at the native level before loading Jitsi
3. WebView needs explicit permission grants from the app

## Solution Implemented

### 1. **Native Permission Requests (CallPage.js)**
Added `requestPermissions()` function that:
- Requests CAMERA permission on Android
- Requests RECORD_AUDIO permission on Android
- Shows permission dialogs to user
- Logs success/failure

```javascript
const requestPermissions = async () => {
  if (Platform.OS === 'android') {
    const cameraPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      { title: 'Camera Permission', ... }
    );
    const audioPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      { title: 'Microphone Permission', ... }
    );
  }
};
```

### 2. **WebView Configuration**
Updated WebView props:
- `mediaCapturePermissionGrantType="grant"` - Auto-grant media permissions
- `onPermissionRequest` - Automatically grant all requested permissions
- `userAgent` - Set proper user agent for better compatibility
- `mediaPlaybackRequiresUserAction={false}` - Allow auto-play

### 3. **Jitsi Configuration**
Enhanced Jitsi options:
- `startWithAudioMuted: false` - Start with audio ON
- `startWithVideoMuted: false` - Start with video ON
- Audio config with echo cancellation and noise suppression
- Video config with proper resolution

### 4. **Better Error Handling**
- Added permission-error message type
- Logs with emojis for better debugging
- Shows user-friendly error messages

## Files Modified

| File | Changes |
|------|---------|
| `src/screens/CallPage.js` | Added permission requests, improved Jitsi config, better error handling |
| `app.json` | Added Jitsi plugin configuration |
| `plugins/withJitsiMeet.js` | Created Expo config plugin for native setup |

## How It Works Now

1. **User clicks "Find Random Match"**
2. **Match found → Navigate to CallPage**
3. **CallPage mounts:**
   - Requests CAMERA permission (dialog shown)
   - Requests RECORD_AUDIO permission (dialog shown)
   - User grants permissions
4. **WebView loads Jitsi:**
   - Jitsi requests camera/microphone via `getUserMedia()`
   - WebView grants permissions (already approved at native level)
   - Video/audio starts automatically
5. **User can click Settings:**
   - Camera/Microphone should now show as "granted"
   - Video/audio should work

## Testing Steps

### On Emulator:
```bash
# Start emulator
emulator -avd <device_name>

# Run app
npm start
# Select 'a' for Android

# Test:
1. Click "Find Random Match"
2. Wait for match
3. Grant camera/microphone permissions when prompted
4. Video should start
5. Click settings - should show permissions granted
```

### On Physical Device:
```bash
# Connect device via USB
# Enable USB debugging

# Run app
npm start
# Select 'a' for Android
# Select your device

# Test same as above
```

### Testing with Two Devices:
```bash
# Terminal 1 - Emulator
emulator -avd <device_name>
npm start
# Select 'a'

# Terminal 2 - Physical Device
npm start
# Select 'a'
# Select your physical device

# Both should connect and show video
```

## Expected Behavior

✅ **Before Fix:**
- WebView loads Jitsi
- Click settings → "permission not granted"
- No video/audio

✅ **After Fix:**
- App requests permissions on CallPage mount
- User grants permissions
- WebView loads Jitsi
- Click settings → "permission granted"
- Video/audio works
- Omegle-like experience!

## Troubleshooting

### Issue: Still showing "permission not granted"

**Solution 1:** Check Android manifest has permissions:
```xml
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
```

**Solution 2:** Clear app data and reinstall:
```bash
adb shell pm clear com.flexx.app
npm start
```

**Solution 3:** Check device settings:
- Settings → Apps → Flexx → Permissions
- Enable Camera and Microphone

### Issue: Permissions dialog not showing

**Solution:** Make sure `requestPermissions()` is called in useEffect:
```javascript
useEffect(() => {
  requestPermissions();  // ← Must be here
  getCurrentUser();
  // ...
}, []);
```

### Issue: Video starts but no audio

**Solution:** Check audio config in Jitsi options:
```javascript
audio: {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
}
```

## Next Steps

1. **Test on emulator** - Verify permissions work
2. **Test on physical device** - Verify video/audio
3. **Test with two devices** - Verify matching and video call
4. **Monitor logs** - Check console for any errors

## Build & Deploy

When ready to build:

```bash
# Build for Android
eas build --profile development --platform android

# Or for production
eas build --profile production --platform android
```

The build will include:
- ✅ Proper Android permissions
- ✅ Jitsi Meet configuration
- ✅ WebView media capture setup
- ✅ Permission request logic

---

**Status:** ✅ Ready to test
**Last Updated:** May 24, 2026
**Cost:** FREE (Jitsi Meet is free)
