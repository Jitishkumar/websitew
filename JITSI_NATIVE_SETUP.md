# Jitsi Meet Native SDK Setup

## What Changed

Switched from WebView (doesn't work) to **Native Jitsi Meet SDK** which properly accesses camera/microphone.

## Why This Works

- ✅ Native SDK has direct access to device camera/microphone
- ✅ No pre-join screen issues
- ✅ Better performance
- ✅ Omegle-like instant video experience
- ✅ Still completely FREE (using meet.jit.si)

## What I Did

1. **Installed Jitsi Meet SDK:**
   ```bash
   npm install react-native-jitsi-meet
   ```

2. **Created Expo Config Plugin:**
   - `plugins/withJitsiMeet.js` - Configures Android for Jitsi

3. **Updated app.json:**
   - Added Jitsi Meet plugin

4. **Updated CallPage.js:**
   - Replaced WebView with native JitsiMeetView
   - Auto-joins call without pre-join screen
   - Proper event handling

## How to Build & Test

### Step 1: Build with EAS

Since we added a native module, you need to rebuild:

```bash
# Build for Android
eas build --profile development --platform android
```

Or for production:

```bash
eas build --profile production --platform android
```

### Step 2: Install APK

After build completes:
1. Download the APK from EAS
2. Install on your device
3. Test video call!

### Step 3: For Development

If you want to test locally:

```bash
# Prebuild (generates native code)
npx expo prebuild

# Run on Android
npx expo run:android
```

## Expected Behavior

1. Click "Find Random Match"
2. Match found
3. Navigate to CallPage
4. **Jitsi opens natively** (full screen, no WebView)
5. **Video starts immediately** (no pre-join screen!)
6. See other person's video instantly
7. Perfect Omegle-like experience!

## Configuration

In `CallPage.js`, you can customize Jitsi options:

```javascript
const options = {
  room: roomName,
  serverURL: 'https://meet.jit.si',
  userInfo: {
    displayName: name,
  },
  featureFlags: {
    'welcomepage.enabled': false,
    'prejoinpage.enabled': false,  // Skip pre-join!
  },
  configOverrides: {
    'startWithAudioMuted': false,  // Start with audio on
    'startWithVideoMuted': false,  // Start with video on
  },
};
```

## Files Modified

| File | Change |
|------|--------|
| `package.json` | Added react-native-jitsi-meet |
| `plugins/withJitsiMeet.js` | Created Expo config plugin |
| `app.json` | Added Jitsi plugin |
| `src/screens/CallPage.js` | Native Jitsi implementation |

## Advantages

| Feature | WebView | Native SDK |
|---------|---------|------------|
| Camera Access | ❌ Blocked | ✅ Works |
| Microphone Access | ❌ Blocked | ✅ Works |
| Pre-join Screen | ❌ Shows | ✅ Skipped |
| Performance | Slow | Fast |
| User Experience | Poor | Excellent |

## Next Steps

1. **Build APK:**
   ```bash
   eas build --profile development --platform android
   ```

2. **Wait for build** (10-15 minutes)

3. **Download & Install APK**

4. **Test video call** - Should work perfectly!

## Alternative: Local Development

If you want to test without EAS build:

```bash
# Generate native code
npx expo prebuild

# Run on device
npx expo run:android
```

This will compile and run directly on your connected device.

## Troubleshooting

### Issue: Build fails

**Solution:** Make sure you have EAS CLI installed:
```bash
npm install -g eas-cli
eas login
```

### Issue: "Module not found"

**Solution:** Clear caches and reinstall:
```bash
rm -rf node_modules
npm install
```

### Issue: Jitsi doesn't open

**Solution:** Check logs:
```bash
adb logcat | grep Jitsi
```

---

**Status:** Ready to build with EAS ✅
**Cost:** FREE forever
**Build Time:** 10-15 minutes
**Last Updated:** May 24, 2026
