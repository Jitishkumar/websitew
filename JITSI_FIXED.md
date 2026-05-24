# Jitsi Meet - Fixed for Omegle-like Experience

## What Was Wrong

- Jitsi was showing a pre-join screen
- Asking for permissions inside the WebView
- Not auto-starting video/audio

## What I Fixed

### 1. Skip Pre-Join Screen
Added URL parameters to bypass the pre-join page:
```javascript
#config.prejoinPageEnabled=false
&config.startWithAudioMuted=false
&config.startWithVideoMuted=false
```

### 2. Auto-Grant WebView Permissions
```javascript
mediaCapturePermissionGrantType="grant"
onPermissionRequest={(request) => {
  request.grant(request.resources);
}}
```

### 3. Simplified Iframe Approach
Using direct iframe with config parameters instead of External API for better compatibility.

## How to Test

```bash
# Clear caches
bash reset-cache.sh

# Restart app
npm start -- --clear

# Test on two devices
```

## What Should Happen Now

1. Click "Find Random Match"
2. Match found
3. Navigate to CallPage
4. **Video starts immediately** (no pre-join screen!)
5. See other person's video right away
6. Omegle-like instant video experience!

## If Still Showing Pre-Join

The issue might be that Jitsi's URL config parameters don't work on mobile. In that case, we need to use a different approach - self-hosted Jitsi or a different video solution.

## Alternative: Use 8x8.vc (Jitsi's Official Instance)

If meet.jit.si still shows pre-join, we can use 8x8.vc which has better mobile support:

```javascript
const jitsiUrl = 'https://8x8.vc/' + roomName;
```

---

**Test now and let me know if the pre-join screen is gone!**
