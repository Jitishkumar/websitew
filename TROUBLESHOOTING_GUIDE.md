# Daily.co Video Call - Troubleshooting Guide

## Issue 1: Bundling Error - "Unable to resolve @daily-co/react-native-daily-js"

### What's Happening
Metro bundler is showing a cache error about a package we don't actually use. We're using a WebView with iframe approach instead.

### Fix Applied
✅ Added missing `webview` style to CallPage.js StyleSheet
✅ Cleared all Metro bundler caches

### How to Resolve
1. **Clear all caches:**
   ```bash
   rm -rf node_modules/.cache .expo ~/Library/Caches/expo ~/Library/Caches/Expo
   watchman watch-del-all 2>/dev/null || true
   ```

2. **Stop Expo and restart:**
   - Press `Ctrl+C` to stop current process
   - Run: `npm start`
   - When prompted, press `c` to clear cache
   - Press `a` for Android

3. **If still failing:**
   - Delete `.expo` folder: `rm -rf .expo`
   - Delete node_modules cache: `rm -rf node_modules/.cache`
   - Restart Expo

## Issue 2: WebView Not Loading Daily.co

### Symptoms
- Black screen in call
- WebView error in console
- Daily.co iframe not appearing

### Causes & Fixes

**A. Network Issues**
- Check internet connection
- Verify Daily.co domain is accessible: `https://perfectfl.daily.co`
- Check Android network security config is correct

**B. JavaScript Not Enabled**
- Verify `javaScriptEnabled={true}` in WebView props ✅ (already set)
- Verify `domStorageEnabled={true}` ✅ (already set)

**C. Room URL Invalid**
- Check logs for room URL format: `https://perfectfl.daily.co/UNIQUE_ID`
- Verify room URL is being passed correctly from HomePage

### Debug Steps
1. Check console logs for room URL:
   ```
   LOG  {"roomUrl": "https://perfectfl.daily.co/mpju864d_igjoica24"}
   ```

2. Test room URL directly in browser (on computer):
   - Open: `https://perfectfl.daily.co/test-room-name`
   - Should load Daily.co interface

3. Check WebView error logs:
   ```
   LOG  WebView error: ...
   ```

## Issue 3: Call Ends Immediately

### Symptoms
- Call ends with "component_unmount" reason
- Call ends with "error" reason
- Call ends with "webview_error" reason

### Causes & Fixes

**A. Component Unmounting**
- App is navigating away too quickly
- Check if navigation is being triggered prematurely
- Verify `callEnded` state prevents multiple calls

**B. WebView Error**
- Daily.co iframe failed to load
- Check network connectivity
- Verify room URL is valid

**C. App Going to Background**
- User switched apps during call
- This is intentional - call ends when app goes to background
- Check `handleAppStateChange` function

### Debug Steps
1. Check call end reason in logs:
   ```
   LOG  Call ended: {"callID": "...", "reason": "..."}
   ```

2. Reasons:
   - `time_limit` - 3 minutes reached (expected)
   - `user_ended` - User clicked end button (expected)
   - `component_unmount` - Component was unmounted (check navigation)
   - `app_background` - App went to background (expected)
   - `error` - Daily.co error (check network)
   - `webview_error` - WebView failed to load (check network)

## Issue 4: Physical Device Not Showing in Expo

### Symptoms
- Expo only shows emulator
- Physical device not in device list
- "Press a" doesn't show device

### Causes & Fixes

**A. USB Debugging Not Enabled**
1. On device: Settings > Developer Options > USB Debugging
2. Enable USB Debugging
3. Reconnect device

**B. Device Not Recognized**
1. Check connection: `adb devices`
2. Should show device with "device" status
3. If "unauthorized", tap "Allow" on device prompt

**C. Expo Not Detecting Device**
1. Restart Expo: `npm start`
2. Press `a` and wait for device list
3. If still not showing, try: `adb kill-server && adb start-server`

### Steps to Run on Physical Device
1. Enable USB Debugging on device
2. Connect device via USB
3. Run: `npm start`
4. Press `a` to select Android device
5. Wait for device list to appear
6. Select your device
7. Expo will install and run app

## Issue 5: Database Not Updating

### Symptoms
- Call data not saved to database
- Room URL not stored
- Call cleanup not working

### Causes & Fixes

**A. Supabase Connection Failed**
- Check Supabase URL and key in `.env`
- Verify network connectivity
- Check Supabase status

**B. Database Schema Missing**
- Verify `active_calls` table exists
- Verify `waiting_users` table exists
- Check columns: `room_url`, `call_id`, `user1_id`, `user2_id`, etc.

**C. Permissions Issue**
- Check Supabase RLS policies
- Verify user has permission to insert/update/delete

### Debug Steps
1. Check Supabase connection:
   ```
   LOG  Supabase URL: https://...
   LOG  Supabase Key exists: true
   ```

2. Check database operations in logs:
   - Look for "Error updating call session"
   - Look for "Error cleaning up call data"

3. Manually verify database:
   - Open Supabase dashboard
   - Check `active_calls` table
   - Check `waiting_users` table

## Issue 6: 3-Minute Timer Not Working

### Symptoms
- Call doesn't end after 3 minutes
- Timer not visible in UI
- Call continues indefinitely

### Causes & Fixes

**A. Timer Not Started**
- Check `callTimerRef` is set in useEffect
- Verify timeout is 180000ms (3 minutes)

**B. Timer Cleared Prematurely**
- Check cleanup function doesn't clear timer too early
- Verify `callEnded` state prevents multiple calls

**C. Daily.co Keeps Call Open**
- Daily.co might keep connection open
- Our timer should still end the call
- Check if `handleCallEnd` is being called

### Debug Steps
1. Check timer is set:
   ```
   LOG  Call ended: {"callID": "...", "reason": "time_limit"}
   ```

2. Verify 3-minute timer:
   - Start call
   - Wait 3 minutes
   - Should see "Time Up" alert
   - Call should end

## Quick Checklist

Before testing, verify:
- ✅ Caches cleared
- ✅ Expo restarted
- ✅ Network connected
- ✅ USB debugging enabled (physical device)
- ✅ Supabase connection working
- ✅ Database tables exist
- ✅ Room URL format correct
- ✅ WebView style defined
- ✅ JavaScript enabled in WebView

## Testing Workflow

1. **Start Expo:**
   ```bash
   npm start
   ```

2. **Run on device:**
   - Press `a` for Android
   - Select device from list

3. **Test matching:**
   - Open app on two devices
   - Click "Find Random Match" on both
   - Should match and navigate to CallPage

4. **Test video call:**
   - Verify video loads
   - Check audio/video working
   - Wait 3 minutes for timer
   - Verify call ends

5. **Check database:**
   - Open Supabase dashboard
   - Verify `active_calls` record created
   - Verify `waiting_users` cleaned up
   - Verify call marked as ended

## Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| "Unable to resolve @daily-co/react-native-daily-js" | Metro cache | Clear cache, restart Expo |
| "WebView error: Failed to load video call" | Network/URL issue | Check room URL, network |
| "Call ended: component_unmount" | Navigation issue | Check navigation logic |
| "Network request failed" | Supabase offline | Check connection, Supabase status |
| "Error updating call session" | Database error | Check RLS policies, schema |

## Need More Help?

1. Check console logs for specific error messages
2. Verify all prerequisites are met
3. Try clearing all caches and restarting
4. Check Supabase dashboard for data
5. Test room URL in browser on computer
