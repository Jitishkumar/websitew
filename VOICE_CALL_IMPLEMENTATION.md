# Voice Call Implementation Summary

## Overview
Successfully implemented a random voice call feature similar to the existing video call functionality, allowing users to connect via audio-only calls.

## Changes Made

### 1. HomeScreen.js
- **Replaced first video icon with phone icon** for voice calls
- Phone icon navigates to `HomePage` with `callType: 'voice'`
- Video call icon (duo) navigates to `HomePage` with `callType: 'video'`

### 2. HomePage.js
- **Added `callType` parameter** support ('voice' or 'video')
- **Dynamic permissions**: 
  - Voice calls: Only microphone permission required
  - Video calls: Both camera and microphone permissions required
- **Dynamic UI elements**:
  - Header title: "Random Voice Call" or "Random Video Call"
  - Button text: "FIND VOICE MATCH" or "FIND VIDEO MATCH"
  - Permission alerts adapt based on call type
- **Passes `callType` to MatchConfirm** screen in callData

### 3. CallPage.js
- **Added `callType` parameter** support
- **Jitsi configuration adapts** based on call type:
  - Voice: Lower resolution (360p), video starts muted, lower bandwidth
  - Video: High resolution (720p), video enabled, higher bandwidth
- **Dynamic UI**:
  - Icon: Phone for voice, videocam for video
  - Title: "Voice Call" or "Video Call"
  - Features list adapts to call type
  - Voice features: Crystal clear audio, noise suppression, low bandwidth
  - Video features: HD video, background blur, screen sharing

### 4. MatchConfirmScreen.js
- **Passes `callType` to CallPage** when both users accept
- **Dynamic UI**:
  - Subtitle shows correct call type
  - Accept button icon changes (phone for voice, videocam for video)

## User Flow

### Voice Call Flow:
1. User clicks **phone icon** on HomeScreen
2. Navigates to HomePage with `callType: 'voice'`
3. Requests **microphone permission only**
4. User clicks "FIND VOICE MATCH"
5. System matches with another user
6. MatchConfirm screen shows "Accept to start voice call"
7. Both users accept → CallPage opens with audio-only Jitsi call
8. Jitsi opens in browser with video muted, optimized for voice

### Video Call Flow:
1. User clicks **duo icon** on HomeScreen (accepts terms)
2. Navigates to HomePage with `callType: 'video'`
3. Requests **camera and microphone permissions**
4. User clicks "FIND VIDEO MATCH"
5. System matches with another user
6. MatchConfirm screen shows "Accept to start video call"
7. Both users accept → CallPage opens with video Jitsi call
8. Jitsi opens in browser with video enabled, HD quality

## Technical Details

### Jitsi Configuration Differences

**Voice Call:**
```javascript
'config.resolution': '360'
'config.startWithVideoMuted': 'true'
'config.videoQuality.maxBitrateForTileView': '500000'
```

**Video Call:**
```javascript
'config.resolution': '720'
'config.startWithVideoMuted': 'false'
'config.videoQuality.maxBitrateForTileView': '2500000'
```

### Database
- Uses the same `active_calls` and `waiting_users` tables
- `callType` is passed through the navigation params, not stored in database
- Both voice and video calls use the same matching logic

## Benefits

1. **Separate user pools**: Voice and video calls are independent
2. **Lower bandwidth for voice**: Optimized for audio-only connections
3. **Better user experience**: Users can choose their preferred communication method
4. **Same infrastructure**: Reuses existing matching and call management system
5. **Free service**: Uses Jitsi Meet's free public server

## Testing

To test the voice call feature:
1. Open the app
2. Click the **phone icon** (first icon in header)
3. Grant microphone permission
4. Click "FIND VOICE MATCH"
5. Wait for a match or test with another device
6. Accept the match
7. Call opens in browser with audio-only mode

## Future Enhancements

Potential improvements:
- Add voice call statistics/analytics
- Implement voice call quality indicators
- Add voice effects or filters
- Create separate waiting queues for voice vs video
- Add user preference to default to voice or video calls
- Implement call recording for voice calls (with consent)
