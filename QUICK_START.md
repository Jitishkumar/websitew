# Quick Start - Daily.co Video Call

## The Problem You Had
```
Android Bundling failed 780ms index.js (1626 modules)
Unable to resolve "@daily-co/react-native-daily-js" from "src/screens/CallPage.js"
```

## The Fix (Already Applied ✅)
- Added missing `webview` style to CallPage.js
- Cleared all Metro bundler caches
- Created cache reset script

## How to Run Now

### Step 1: Clear Caches
```bash
bash reset-cache.sh
```

Or manually:
```bash
rm -rf node_modules/.cache .expo ~/Library/Caches/expo ~/Library/Caches/Expo
watchman watch-del-all 2>/dev/null || true
```

### Step 2: Start Expo
```bash
npm start
```

When prompted:
- Press `c` to clear cache
- Press `a` for Android

### Step 3: Select Device
- For emulator: Expo will auto-select
- For physical device: 
  - Enable USB Debugging on device
  - Connect via USB
  - Press `a` and select device from list

## What Should Happen

1. ✅ App bundles successfully (no errors)
2. ✅ App loads on device/emulator
3. ✅ Can navigate to HomePage
4. ✅ Can click "Find Random Match"
5. ✅ Gets matched with another user
6. ✅ Navigates to CallPage
7. ✅ Daily.co video interface loads
8. ✅ Can see video/hear audio
9. ✅ Call ends after 3 minutes

## If It Still Doesn't Work

### Check 1: Caches Cleared?
```bash
bash reset-cache.sh
npm start
```

### Check 2: Network Connected?
- Verify internet connection
- Try accessing `https://perfectfl.daily.co` in browser

### Check 3: Supabase Connected?
- Check `.env` file has correct URL and key
- Verify Supabase is online

### Check 4: Physical Device Issues?
```bash
adb devices
# Should show your device with "device" status
```

If not showing:
1. Enable USB Debugging: Settings > Developer Options > USB Debugging
2. Reconnect USB cable
3. Tap "Allow" on device when prompted

## Testing Video Call

### With Two Devices
1. Open app on Device A
2. Open app on Device B
3. Click "Find Random Match" on both
4. Should match and connect
5. Should see video from other device
6. Call ends after 3 minutes

### With Emulator + Physical Device
1. Start emulator: `npm start` → press `a` → select emulator
2. In another terminal: `npm start` → press `a` → select physical device
3. Both should run simultaneously
4. Test matching between them

## Key Files

| File | Purpose |
|------|---------|
| `src/screens/CallPage.js` | Video call UI (WebView + iframe) |
| `src/screens/HomePage.js` | Matching logic |
| `reset-cache.sh` | Cache clearing script |
| `TROUBLESHOOTING_GUIDE.md` | Detailed troubleshooting |
| `DAILY_CO_SETUP_FIX.md` | Setup guide |

## Important Notes

- ✅ We use WebView + iframe (no native SDK)
- ✅ No API key needed (auto-room creation)
- ✅ 3-minute call limit is automatic
- ✅ Database tracks all calls
- ✅ Proper cleanup on call end

## Common Issues

| Issue | Solution |
|-------|----------|
| Bundling error | Run `bash reset-cache.sh` |
| Black screen in call | Check network, verify room URL |
| Call ends immediately | Check logs for reason |
| Physical device not showing | Enable USB Debugging, reconnect |
| No video/audio | Check permissions, network |

## Next Steps

1. Run `bash reset-cache.sh`
2. Run `npm start`
3. Test on device
4. Check console logs
5. Verify video call works
6. Test with two devices

---

**Status:** Ready to test ✅
**Last Updated:** May 24, 2026
