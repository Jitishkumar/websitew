# Run App on Both Emulator and Physical Device

## Goal
Test video call between emulator and physical device simultaneously.

## Prerequisites

### For Physical Device
1. **Enable USB Debugging:**
   - Go to Settings > Developer Options > USB Debugging
   - Toggle it ON
   - If Developer Options not visible: Settings > About > Build Number (tap 7 times)

2. **Connect via USB:**
   - Connect device to computer with USB cable
   - Tap "Allow" on device when prompted
   - Verify connection: `adb devices`
   - Should show: `device_name    device`

### For Emulator
1. **Start Android Emulator:**
   - Open Android Studio
   - Click "Virtual Device Manager"
   - Select a device (e.g., Pixel 4a)
   - Click play button to start
   - Wait for emulator to fully load

## Method 1: Two Terminal Windows (Recommended)

### Terminal 1: Run on Emulator
```bash
cd "/Users/jitishkumar/Desktop/untitled folder/websitew"
npm start
```

When you see the menu:
```
› Press ? │ show all commands
```

Press `a` to select Android device:
```
› Opening on Android...
› Opening emulator Pixel_4a
```

Wait for app to load on emulator.

### Terminal 2: Run on Physical Device
Open a **new terminal window** and run:

```bash
cd "/Users/jitishkumar/Desktop/untitled folder/websitew"
npm start
```

When you see the menu, press `a`:
```
› Press ? │ show all commands
```

You should see a list of devices:
```
› Select an Android device or emulator
  ❯ emulator-5554 (Pixel_4a)
    192.168.1.100:5555 (Your Physical Device)
```

**Select your physical device** (the one with IP address or device name).

Wait for app to load on physical device.

---

## Method 2: Using ADB Reverse (Alternative)

If Method 1 doesn't work, try this:

### Step 1: Start Emulator
```bash
# In Terminal 1
cd "/Users/jitishkumar/Desktop/untitled folder/websitew"
npm start
# Press 'a' to run on emulator
```

### Step 2: Connect Physical Device via ADB
```bash
# In Terminal 2
adb connect 192.168.1.100:5555
# Replace 192.168.1.100 with your device's IP
```

To find your device's IP:
- On device: Settings > About > IP Address

### Step 3: Run on Physical Device
```bash
# In Terminal 2
npm start
# Press 'a' to select physical device
```

---

## Method 3: Using Expo Go App (Easiest)

### Step 1: Install Expo Go
- On physical device: Download "Expo Go" from Play Store
- On emulator: Already installed

### Step 2: Start Expo
```bash
npm start
```

You'll see a QR code in terminal:
```
› Metro waiting on exp://192.168.1.100:19000
```

### Step 3: Scan QR Code
- **On Physical Device:** Open Expo Go app > Scan QR code
- **On Emulator:** Press `e` in terminal to open in Expo Go

Both will connect to the same Expo server and load the app.

---

## Verification Steps

### Check Devices Connected
```bash
adb devices
```

Should show:
```
List of attached devices
emulator-5554          device
192.168.1.100:5555     device
```

### Check Expo is Running
Look for output like:
```
› Metro waiting on exp://192.168.1.100:19000
› Tunnel ready
› Expo Go ready at exp://...
```

### Verify Both Apps Loaded
- Check emulator screen - app should be running
- Check physical device screen - app should be running
- Both should show the HomePage with "Find Random Match" button

---

## Testing Video Call

### Step 1: Login on Both Devices
1. On emulator: Login with test account
2. On physical device: Login with different account (or same)

### Step 2: Start Matching
1. On emulator: Click "Find Random Match"
2. On physical device: Click "Find Random Match"

### Step 3: Wait for Match
- Emulator should show "Looking for available matches..."
- Physical device should show "Looking for available matches..."
- They should match within a few seconds

### Step 4: Verify Video Call
- Both should navigate to CallPage
- Daily.co iframe should load on both
- Should see video from the other device
- Should hear audio from the other device
- Call should end after 3 minutes

---

## Troubleshooting

### Issue: Physical Device Not Showing in Device List

**Solution 1: Check USB Connection**
```bash
adb devices
```

If device shows `unauthorized`:
- Disconnect USB cable
- Tap "Allow" on device when reconnecting
- Try again

**Solution 2: Restart ADB**
```bash
adb kill-server
adb start-server
adb devices
```

**Solution 3: Use WiFi Connection**
```bash
# On computer, find device IP
adb devices

# Connect via WiFi
adb connect 192.168.1.100:5555
# Replace with your device's IP

# Verify
adb devices
```

### Issue: Emulator Not Starting

**Solution:**
1. Open Android Studio
2. Click "Virtual Device Manager"
3. Select device and click play button
4. Wait for emulator to fully load (2-3 minutes)
5. Then run `npm start`

### Issue: App Not Loading on One Device

**Solution:**
1. Check internet connection on both devices
2. Verify Supabase is online
3. Check console logs for errors
4. Try clearing cache: `bash reset-cache.sh`
5. Restart Expo: `npm start`

### Issue: Matching Not Working

**Solution:**
1. Verify both users have gender set in profile
2. Check database in Supabase dashboard
3. Verify `waiting_users` table has entries
4. Check console logs for matching errors
5. Try with different accounts

### Issue: Video Not Loading

**Solution:**
1. Check internet connection on both devices
2. Verify room URL is correct in logs
3. Check Daily.co domain is accessible
4. Verify WebView is loading (check console)
5. Try refreshing the call

---

## Quick Commands Reference

```bash
# Clear caches
bash reset-cache.sh

# Start Expo
npm start

# Check connected devices
adb devices

# Connect device via WiFi
adb connect 192.168.1.100:5555

# Disconnect device
adb disconnect 192.168.1.100:5555

# Restart ADB
adb kill-server && adb start-server

# View logs from physical device
adb logcat | grep "ReactNativeJS"

# View logs from emulator
adb -e logcat | grep "ReactNativeJS"
```

---

## Step-by-Step Walkthrough

### Terminal 1: Emulator
```bash
cd "/Users/jitishkumar/Desktop/untitled folder/websitew"
npm start
# Wait for Metro to start
# Press 'a'
# Select emulator from list
# Wait for app to load
```

### Terminal 2: Physical Device
```bash
cd "/Users/jitishkumar/Desktop/untitled folder/websitew"
npm start
# Wait for Metro to start
# Press 'a'
# Select physical device from list
# Wait for app to load
```

### Both Devices Ready
- Emulator: HomePage visible
- Physical Device: HomePage visible
- Both connected to same Expo server

### Test Video Call
1. Emulator: Click "Find Random Match"
2. Physical Device: Click "Find Random Match"
3. Wait for match (5-10 seconds)
4. Both navigate to CallPage
5. Video loads on both
6. Test audio/video
7. Wait 3 minutes for auto-end

---

## Expected Output

### Terminal 1 (Emulator)
```
› Metro waiting on exp://192.168.1.100:19000
› Tunnel ready
› Expo Go ready at exp://...
› Opening on Android...
› Opening emulator Pixel_4a
✓ Compiled successfully
```

### Terminal 2 (Physical Device)
```
› Metro waiting on exp://192.168.1.100:19000
› Tunnel ready
› Expo Go ready at exp://...
› Opening on Android...
› Opening com.flexx.app/.MainActivity on 192.168.1.100:5555
✓ Compiled successfully
```

### Both Devices
- App loads
- HomePage visible
- Can click buttons
- Can navigate

---

## Tips for Success

1. **Start emulator first** - Takes longer to load
2. **Use same WiFi network** - For better connectivity
3. **Keep both devices plugged in** - Prevents sleep/disconnect
4. **Monitor console logs** - Check for errors
5. **Test with different accounts** - Ensures proper matching
6. **Check database** - Verify data is being saved
7. **Be patient** - First load takes time

---

## Common Issues & Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| Device not showing | `adb kill-server && adb start-server` |
| App not loading | Clear cache: `bash reset-cache.sh` |
| Matching not working | Check gender in profile |
| Video not loading | Check internet connection |
| Call ends immediately | Check logs for reason |
| Emulator too slow | Close other apps, increase RAM |

---

## Success Checklist

- [ ] Emulator running
- [ ] Physical device connected via USB
- [ ] Both devices showing in `adb devices`
- [ ] Expo started with `npm start`
- [ ] App loaded on emulator
- [ ] App loaded on physical device
- [ ] Both showing HomePage
- [ ] Can click "Find Random Match" on both
- [ ] Devices match within 10 seconds
- [ ] Both navigate to CallPage
- [ ] Daily.co iframe loads on both
- [ ] Can see video from other device
- [ ] Can hear audio from other device
- [ ] Call ends after 3 minutes

---

**Status:** Ready to test ✅
**Last Updated:** May 24, 2026
