# Testing Checklist - Jitsi Meet Implementation

## Pre-Testing Setup

- [ ] Read `START_HERE.md`
- [ ] Review `JITSI_PERMISSION_FIX_SUMMARY.md`
- [ ] Emulator installed and configured
- [ ] Physical device with USB debugging enabled
- [ ] Both devices on same network (or connected to same computer)
- [ ] App installed on both devices

## Phase 1: Emulator Testing (5 minutes)

### Setup
- [ ] Start emulator: `emulator -avd Pixel_6_API_34`
- [ ] Wait for emulator to fully boot
- [ ] Run app: `npm start` → Select 'a' for Android
- [ ] Wait for app to load

### Permissions
- [ ] Camera permission dialog appears
- [ ] User can click "OK" to grant
- [ ] Microphone permission dialog appears
- [ ] User can click "OK" to grant
- [ ] Permissions are remembered (no dialog on second call)

### Matching
- [ ] Click "Find Random Match"
- [ ] See "Searching for match..." message
- [ ] Wait for match (should be quick on emulator)
- [ ] See "Match found!" message

### Video Call
- [ ] Jitsi loads after match
- [ ] See "Connecting..." message
- [ ] Video starts automatically
- [ ] Can see video feed (even if just black screen on emulator)
- [ ] No errors in console

### Settings
- [ ] Click settings icon in Jitsi
- [ ] Check "Camera" - should show "granted"
- [ ] Check "Microphone" - should show "granted"
- [ ] Close settings

### Timer
- [ ] Note the time when video starts
- [ ] Wait 3 minutes
- [ ] Alert appears: "Time Up - Call duration limit (3 minutes) reached"
- [ ] App returns to home screen

### Cleanup
- [ ] Back on home screen
- [ ] Can click "Find Random Match" again
- [ ] Can find a new match

### Logs
- [ ] Check console for permission logs: `✅ Camera and microphone permissions granted`
- [ ] Check console for Jitsi logs: `🚀 Initializing Jitsi Meet...`
- [ ] No ERROR logs

## Phase 2: Physical Device Testing (5 minutes)

### Setup
- [ ] Connect device via USB
- [ ] Enable USB debugging on device
- [ ] Run app: `npm start` → Select 'a' → Select physical device
- [ ] Wait for app to load

### Permissions
- [ ] Camera permission dialog appears
- [ ] User can click "OK" to grant
- [ ] Microphone permission dialog appears
- [ ] User can click "OK" to grant

### Matching
- [ ] Click "Find Random Match"
- [ ] See "Searching for match..." message
- [ ] Wait for match
- [ ] See "Match found!" message

### Video Call
- [ ] Jitsi loads after match
- [ ] Video starts automatically
- [ ] Can see video feed from device camera
- [ ] Video is clear and responsive

### Audio
- [ ] Can hear audio (if testing with another device)
- [ ] Microphone works
- [ ] No echo or feedback

### Settings
- [ ] Click settings icon in Jitsi
- [ ] Check "Camera" - should show "granted"
- [ ] Check "Microphone" - should show "granted"

### Timer
- [ ] Note the time when video starts
- [ ] Wait 3 minutes
- [ ] Alert appears: "Time Up"
- [ ] App returns to home screen

### Cleanup
- [ ] Back on home screen
- [ ] Can find new matches

## Phase 3: Two Device Testing (15 minutes)

### Setup
- [ ] Terminal 1: Start emulator
- [ ] Terminal 2: `npm start` → 'a' (emulator)
- [ ] Terminal 3: `npm start` → 'a' → Select physical device
- [ ] Both apps loaded

### Create Accounts
- [ ] Emulator: Sign up with `user1@test.com`
- [ ] Physical device: Sign up with `user2@test.com`

### Matching
- [ ] Emulator: Click "Find Random Match"
- [ ] Physical device: Click "Find Random Match"
- [ ] Both should find each other
- [ ] Both show "Match found!"

### Video Call
- [ ] Emulator: Grant permissions
- [ ] Physical device: Grant permissions
- [ ] Emulator: See physical device's video
- [ ] Physical device: See emulator's video
- [ ] Both videos are clear

### Audio
- [ ] Emulator: Can hear physical device
- [ ] Physical device: Can hear emulator
- [ ] Audio is clear
- [ ] No echo or feedback

### Settings
- [ ] Emulator: Click settings → Camera/Microphone show "granted"
- [ ] Physical device: Click settings → Camera/Microphone show "granted"

### Timer
- [ ] Both devices: Wait 3 minutes
- [ ] Both: Alert appears "Time Up"
- [ ] Both: Return to home screen

### Cleanup
- [ ] Emulator: Can find new matches
- [ ] Physical device: Can find new matches
- [ ] Both: Can repeat the test

### Logs
- [ ] Check both devices for permission logs
- [ ] Check both devices for Jitsi logs
- [ ] No ERROR logs on either device

## Phase 4: Edge Cases (Optional)

### Background/Foreground
- [ ] During call: Press home button
- [ ] App goes to background
- [ ] Call should end
- [ ] Return to home screen

### Network Issues
- [ ] During call: Turn off WiFi
- [ ] Should see error message
- [ ] Can return to home screen

### Multiple Calls
- [ ] End first call
- [ ] Find new match
- [ ] Second call should work
- [ ] Repeat 3+ times

### Different Devices
- [ ] Test with different device pairs
- [ ] Test with different networks
- [ ] Test with different user accounts

## Phase 5: Performance Testing (Optional)

### Video Quality
- [ ] Video is clear
- [ ] No lag or stuttering
- [ ] Responsive to movements

### Audio Quality
- [ ] Audio is clear
- [ ] No distortion
- [ ] No echo

### Battery Usage
- [ ] Monitor battery drain during call
- [ ] Should be reasonable (not excessive)

### Data Usage
- [ ] Monitor data usage during call
- [ ] Should be reasonable for video call

## Phase 6: Build & Deploy

### Build APK
- [ ] Run: `eas build --profile development --platform android`
- [ ] Wait for build to complete (10-15 minutes)
- [ ] Download APK from https://expo.dev/builds

### Install APK
- [ ] Install on device: `adb install app.apk`
- [ ] App launches successfully

### Test APK
- [ ] Repeat Phase 1-3 tests with APK
- [ ] All tests pass

### Production Build
- [ ] Run: `eas build --profile production --platform android`
- [ ] Wait for build to complete
- [ ] Download APK

### Final Testing
- [ ] Install production APK
- [ ] Repeat all tests
- [ ] All tests pass

## Success Criteria

### ✅ All Phases Pass
- [ ] Phase 1: Emulator testing - PASS
- [ ] Phase 2: Physical device testing - PASS
- [ ] Phase 3: Two device testing - PASS
- [ ] Phase 4: Edge cases - PASS (if tested)
- [ ] Phase 5: Performance - PASS (if tested)
- [ ] Phase 6: Build & deploy - PASS

### ✅ No Critical Issues
- [ ] No crashes
- [ ] No permission errors
- [ ] No video/audio issues
- [ ] No database errors
- [ ] No network errors

### ✅ Ready to Deploy
- [ ] All tests pass
- [ ] No critical issues
- [ ] APK built successfully
- [ ] Ready for user testing

## Troubleshooting During Testing

### Issue: "permission not granted"
- [ ] Check Android manifest has permissions
- [ ] Clear app data: `adb shell pm clear com.flexx.app`
- [ ] Check device settings: Settings → Apps → Flexx → Permissions

### Issue: Video doesn't start
- [ ] Check permissions are granted
- [ ] Check camera works in device settings
- [ ] Check Jitsi loads (should see "Connecting...")

### Issue: Audio doesn't work
- [ ] Check microphone permission granted
- [ ] Check device volume is not muted
- [ ] Check audio settings in Jitsi

### Issue: App crashes
- [ ] Check logs: `adb logcat | grep ERROR`
- [ ] Check Supabase connection
- [ ] Check permissions are requested

### Issue: Devices don't match
- [ ] Check both are on same network
- [ ] Check Supabase connection
- [ ] Check database has waiting_users entries

## Notes

- **Test Duration:** ~30 minutes for all phases
- **Devices Needed:** 1 emulator + 1 physical device (or 2 physical devices)
- **Network:** Both devices should be on same network
- **Accounts:** Create test accounts for testing
- **Logs:** Check logs frequently for debugging

## Sign-Off

- [ ] All tests completed
- [ ] All tests passed
- [ ] No critical issues
- [ ] Ready to deploy
- [ ] Date: ___________
- [ ] Tester: ___________

---

**Last Updated:** May 24, 2026
**Status:** Ready to test
