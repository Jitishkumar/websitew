# Jitsi Meet Video Call - Setup Guide

## Why Jitsi Meet?

✅ **Completely FREE** - No credit card, no API key, no limits!
✅ **Open Source** - Trusted by millions
✅ **No Account Required** - Works out of the box
✅ **Unlimited Calls** - No time limits, no participant limits
✅ **Works with Expo** - No native modules needed

## What Changed

We switched from Daily.co to Jitsi Meet because:
- Daily.co requires credit card after trial
- Jitsi Meet is 100% free forever
- Jitsi Meet works perfectly with Expo EAS build
- No API keys or configuration needed

## How It Works

### Room Creation
```javascript
// Simple and free!
const roomUrl = `https://meet.jit.si/${uniqueRoomId}`;
```

### Features
- ✅ Video and audio calls
- ✅ Screen sharing
- ✅ Chat
- ✅ Participant management
- ✅ Mobile optimized
- ✅ No installation required

## Testing

### Step 1: Clear Caches
```bash
bash reset-cache.sh
```

### Step 2: Restart App
```bash
npm start -- --clear
```

### Step 3: Test Video Call
1. Open app on two devices
2. Click "Find Random Match" on both
3. Should match and navigate to CallPage
4. Jitsi Meet interface should load
5. Video/audio should work perfectly!

## What You Should See

### Console Logs (Success)
```
LOG  Initializing Jitsi Meet...
LOG  Room: mpjv8uh6_bybp8wujl
LOG  User: kimm
LOG  Joined conference
```

### App Behavior (Success)
- ✅ Click "Find Random Match"
- ✅ Match found
- ✅ Navigate to CallPage
- ✅ Jitsi Meet interface loads
- ✅ Video visible from other device
- ✅ Audio working
- ✅ Can chat, share screen, etc.

## Advantages Over Daily.co

| Feature | Jitsi Meet | Daily.co |
|---------|------------|----------|
| Cost | FREE forever | Requires credit card |
| API Key | Not needed | Required |
| Setup Time | 0 minutes | 5-10 minutes |
| Limits | None | 10,000 min/month |
| Open Source | Yes | No |
| Expo Compatible | Yes | Yes |

## Customization

You can customize Jitsi Meet by modifying the `configOverwrite` and `interfaceConfigOverwrite` options in CallPage.js:

```javascript
configOverwrite: {
  startWithAudioMuted: false,
  startWithVideoMuted: false,
  enableWelcomePage: false,
  prejoinPageEnabled: false,
  // Add more options...
},
interfaceConfigOverwrite: {
  SHOW_JITSI_WATERMARK: false,
  SHOW_BRAND_WATERMARK: false,
  // Add more options...
}
```

## Self-Hosting (Optional)

If you want even more control, you can self-host Jitsi Meet:
- Full control over server
- Custom branding
- No external dependencies
- See: https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-quickstart

For now, using the public `meet.jit.si` server is perfect!

## Files Modified

| File | Change |
|------|--------|
| `src/screens/HomePage.js` | Changed from Daily.co to Jitsi Meet |
| `src/screens/CallPage.js` | Updated to use Jitsi Meet API |
| `.env` | No longer needs DAILY_API_KEY |

## Troubleshooting

### Issue: Video not loading

**Solution:**
1. Check internet connection
2. Clear caches: `bash reset-cache.sh`
3. Restart app: `npm start -- --clear`
4. Check console logs for errors

### Issue: Audio/video not working

**Solution:**
1. Check camera/microphone permissions
2. Verify permissions granted in app
3. Test on different device
4. Check device settings

### Issue: Call ends immediately

**Solution:**
1. Check console logs for reason
2. Verify room URL is correct
3. Check network connection
4. Try different room name

## Next Steps

1. ✅ Clear caches
2. ✅ Restart app
3. ✅ Test on two devices
4. ✅ Verify video call works
5. ✅ Enjoy free unlimited video calls!

---

**Status:** Ready to test ✅
**Cost:** FREE forever
**Setup Time:** 0 minutes
**Last Updated:** May 24, 2026
