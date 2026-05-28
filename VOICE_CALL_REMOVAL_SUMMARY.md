# Voice Call Feature Removal Summary

## Overview
Removed all voice call specific code since users can simply turn off their camera in video calls to achieve the same functionality.

## Files Modified

### 1. **HomeScreen.js**
- ✅ Removed voice call button (phone icon) from header
- The "duo" icon button still navigates to video call (HomePage)

### 2. **HomePage.js**
- ✅ Removed `callType` parameter from route params
- ✅ Simplified permissions to always request camera + microphone
- ✅ Removed conditional logic for voice vs video permissions
- ✅ Updated header title to always show "Random Video Call"
- ✅ Updated button text to always show "FIND VIDEO MATCH"
- ✅ Removed `callType` from navigation params when navigating to MatchConfirm

### 3. **CallPage.js**
- ✅ Removed `callType` parameter
- ✅ Removed conditional video quality settings
- ✅ Always uses 720p video quality settings
- ✅ Updated header to always show "Video Call"
- ✅ Updated UI text to always show video call features
- ✅ Removed voice-specific features list

### 4. **MatchConfirmScreen.js**
- ✅ Changed icon from conditional (call/videocam) to always show videocam icon

## What Users Can Do Instead

Users who want audio-only calls can:
1. Navigate to the video call screen
2. Click "Find Match"
3. Once in the call, simply **turn off their camera**
4. The call continues as audio-only

## Benefits

1. **Simpler codebase** - Less conditional logic
2. **Easier maintenance** - One call type to manage
3. **Better UX** - Users have flexibility to toggle camera on/off during calls
4. **Same functionality** - Audio-only is still possible, just user-controlled

## Database Impact

No database changes needed. The `waiting_users` and `active_calls` tables don't have a `call_type` column, so they're unaffected.

## Navigation Flow (After Changes)

```
HomeScreen (Main Feed)
  └─> Click "duo" icon
      └─> HomePage (Video Call Screen)
          └─> Click "FIND VIDEO MATCH"
              └─> MatchConfirmScreen
                  └─> Accept
                      └─> CallPage (Video Call)
```

## Testing Checklist

- [ ] Video call matching works
- [ ] Permissions request works (camera + microphone)
- [ ] Match confirmation shows videocam icon
- [ ] Call page shows video call UI
- [ ] Users can turn off camera in Jitsi for audio-only
- [ ] No console errors related to callType

## Date
May 27, 2026
