# Testing Video Call on Emulator + Physical Device

## Goal
Test Jitsi Meet video call with two devices simultaneously to verify:
- ✅ Matching works
- ✅ Video/audio works
- ✅ Both devices can see each other
- ✅ 3-minute timer works
- ✅ Call cleanup works

## Setup

### Prerequisites
- Android emulator installed and configured
- Physical device with USB debugging enabled
- Both devices on same network (or connected to same computer)
- App installed on both devices

## Step 1: Start Emulator

```bash
# List available emulators
emulator -list-avds

# Start emulator (replace with your device name)
emulator -avd Pixel_6_API_34

# Wait for emulator to fully boot (2-3 minutes)
# You'll see Android home screen
```

## Step 2: Connect Physical Device

```bash
# Connect device via USB cable
# Enable USB debugging on device:
# Settings → Developer Options → USB Debugging → ON

# Verify connection
adb devices

# Output should show:
# emulator-5554    device
# <device_id>      device
```

## Step 3: Start App on Emulator

```bash
# Terminal 1
npm start

# When prompted:
# ? Which platform would you like to open? (Use arrow keys)
# ❯ Android
# 
# Select 'a' for Android

# Wait for app to load on emulator (1-2 minutes)
# You should see Flexx app home screen
```

## Step 4: Start App on Physical Device

```bash
# Terminal 2 (new terminal window)
npm start

# When prompted:
# ? Which platform would you like to open? (Use arrow keys)
# ❯ Android
# 
# Select 'a' for Android

# When asked to select device:
# ? Select a device to open:
# ❯ emulator-5554 (Pixel 6 API 34)
#   <device_id> (Physical Device)
#
# Select your physical device

# Wait for app to load on physical device (1-2 minutes)
```

## Step 5: Create Accounts (if needed)

### On Emulator:
1. Click "Sign Up"
2. Enter email: `user1@test.com`
3. Enter password: `Test123!`
4. Enter username: `emulator_user`
5. Select gender
6. Click "Sign Up"

### On Physical Device:
1. Click "Sign Up"
2. Enter email: `user2@test.com`
3. Enter password: `Test123!`
4. Enter username: `phone_user`
5. Select gender
6. Click "Sign Up"

## Step 6: Test Matching

### On Emulator:
1. Click "Find Random Match"
2. Wait for "Searching for match..." message
3. Should show "Match found!" after a few seconds

### On Physical Device:
1. Click "Find Random Match"
2. Wait for "Searching for match..." message
3. Should show "Match found!" after a few seconds

**Expected:** Both devices should match with each other

## Step 7: Test Video Call

### When both devices show "Match found!":

**On Emulator:**
1. Permission dialog appears → Click "OK"
2. Another permission dialog → Click "OK"
3. Jitsi Meet loads
4. Should see physical device's video
5. Should hear audio from physical device

**On Physical Device:**
1. Permission dialog appears → Click "OK"
2. Another permission dialog → Click "OK"
3. Jitsi Meet loads
4. Should see emulator's video
5. Should hear audio from emulator

## Step 8: Test Settings

### On Emulator:
1. Click settings icon in Jitsi
2. Check "Camera" - should show "granted"
3. Check "Microphone" - should show "granted"
4. Close settings

### On Physical Device:
1. Click settings icon in Jitsi
2. Check "Camera" - should show "granted"
3. Check "Microphone" - should show "granted"
4. Close settings

## Step 9: Test 3-Minute Timer

1. Note the time when video starts
2. Wait 3 minutes
3. Alert should appear: "Time Up - Call duration limit (3 minutes) reached"
4. Both devices should return to home screen
5. Call should be cleaned up from database

## Step 10: Test Call Cleanup

### After call ends:

**Check Emulator:**
1. Should be back on home screen
2. Can click "Find Random Match" again
3. Should find a new match

**Check Physical Device:**
1. Should be back on home screen
2. Can click "Find Random Match" again
3. Should find a new match

## Debugging

### View Logs

```bash
# Terminal 3 - View all logs
adb logcat

# Filter for app logs
adb logcat | grep "LOG"

# Filter for errors
adb logcat | grep "ERROR"

# Filter for Jitsi
adb logcat | grep "Jitsi"
```

### Common Issues

**Issue: Devices don't match**
- Check both are on same network
- Check Supabase connection
- Check database has waiting_users entries

**Issue: Video doesn't show**
- Check permissions are granted
- Check camera works in device settings
- Check Jitsi loads (should see "Connecting..." then video)

**Issue: Audio doesn't work**
- Check microphone permission granted
- Check device volume is not muted
- Check audio settings in Jitsi

**Issue: App crashes**
- Check logs: `adb logcat | grep ERROR`
- Check Supabase connection
- Check permissions are requested

## Expected Console Logs

### On CallPage Mount:
```
LOG  ✅ Camera and microphone permissions granted (Android)
LOG  {"data": "emulator_user", "id": "...", "matchedUser": "phone_user", "roomUrl": "https://meet.jit.si/..."}
```

### When Jitsi Loads:
```
LOG  🚀 Initializing Jitsi Meet...
LOG  📍 Room: <room_name>
LOG  👤 User: emulator_user
LOG  ✅ Got media stream: MediaStream {...}
LOG  ✅ Joined conference: {...}
```

### When Call Ends:
```
LOG  👋 Left conference: {...}
LOG  Call ended: { callID: "...", reason: "left-meeting" }
```

## Success Criteria

✅ **Matching:**
- Both devices find each other
- Room URL is same on both devices

✅ **Video:**
- Both devices see each other's video
- Video is clear and responsive

✅ **Audio:**
- Both devices hear each other
- Audio is clear

✅ **Settings:**
- Camera shows "granted"
- Microphone shows "granted"

✅ **Timer:**
- Call ends after 3 minutes
- Alert appears on both devices

✅ **Cleanup:**
- Both devices return to home screen
- Can find new matches

## Tips

1. **Use different accounts** - Makes it easier to identify which device is which
2. **Keep devices close** - Easier to hear audio during testing
3. **Check logs frequently** - Helps identify issues early
4. **Test multiple times** - Ensure consistency
5. **Test on different networks** - Verify it works on WiFi and cellular

## Next Steps

After successful testing:
1. Build APK for production
2. Test on multiple device pairs
3. Monitor for edge cases
4. Deploy to users

---

**Last Updated:** May 24, 2026
**Status:** Ready to test
