# How to Get Your Daily.co API Key

## The Problem
You're seeing: **"Something went wrong. Try joining again or contact the meeting host for help"**

This happens because Daily.co requires an API key to create rooms. Without it, the auto-room feature doesn't work.

## Solution: Get a Free Daily.co API Key

### Step 1: Sign Up for Daily.co
1. Go to: https://dashboard.daily.co/signup
2. Sign up with your email (it's free!)
3. Verify your email address

### Step 2: Get Your API Key
1. Log in to: https://dashboard.daily.co/
2. Click on **"Developers"** in the left sidebar
3. You'll see your **API Key** displayed
4. Click **"Copy"** to copy it to clipboard

### Step 3: Add API Key to Your App
1. Open the `.env` file in your project root
2. Find this line:
   ```
   DAILY_API_KEY=YOUR_DAILY_API_KEY_HERE
   ```
3. Replace `YOUR_DAILY_API_KEY_HERE` with your actual API key:
   ```
   DAILY_API_KEY=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
   ```
4. Save the file

### Step 4: Restart Your App
```bash
# Clear caches
bash reset-cache.sh

# Restart Expo
npm start

# Press 'a' for Android
```

## Daily.co Free Tier

✅ **10,000 minutes per month FREE**
✅ No credit card required
✅ Unlimited rooms
✅ Up to 200 participants per room
✅ Recording available

This is perfect for testing and small-scale apps!

## Visual Guide

### 1. Daily.co Dashboard
```
┌─────────────────────────────────────────────────────┐
│  Daily.co Dashboard                                  │
│                                                       │
│  ┌─────────────┐                                     │
│  │ Developers  │ ← Click here                        │
│  └─────────────┘                                     │
│                                                       │
│  Your API Key:                                       │
│  ┌──────────────────────────────────────────────┐   │
│  │ abc123def456ghi789jkl012mno345pqr678stu901  │   │
│  │                                    [Copy]    │   │
│  └──────────────────────────────────────────────┘   │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### 2. Update .env File
```
Before:
DAILY_API_KEY=YOUR_DAILY_API_KEY_HERE

After:
DAILY_API_KEY=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

### 3. Restart App
```bash
$ bash reset-cache.sh
$ npm start
# Press 'a' for Android
```

## What Happens After Adding API Key

### Before (Without API Key)
```
User clicks "Find Random Match"
  ↓
Room URL: https://perfectfl.daily.co/random_id
  ↓
Daily.co: "Something went wrong" ❌
  ↓
Call fails
```

### After (With API Key)
```
User clicks "Find Random Match"
  ↓
API creates room: https://perfectfl.daily.co/random_id
  ↓
Daily.co: Room created successfully ✅
  ↓
Call loads and works!
```

## Troubleshooting

### Issue: Still Getting "Something went wrong"

**Check 1: API Key Copied Correctly**
- Open `.env` file
- Verify API key has no spaces
- Verify it's on one line
- No quotes around the key

**Check 2: App Restarted**
```bash
bash reset-cache.sh
npm start
```

**Check 3: API Key Valid**
- Log in to https://dashboard.daily.co/developers
- Verify the API key matches
- Try regenerating the key if needed

**Check 4: Check Console Logs**
Look for:
```
LOG  Daily.co room created: https://perfectfl.daily.co/...
```

If you see:
```
ERROR Daily.co API error: ...
```
Then the API key is invalid or expired.

### Issue: "Daily.co API key not configured"

This warning means the API key is not set or is still the default value.

**Solution:**
1. Open `.env`
2. Replace `YOUR_DAILY_API_KEY_HERE` with actual key
3. Save file
4. Restart app

### Issue: API Key Not Working

**Solution 1: Regenerate Key**
1. Go to https://dashboard.daily.co/developers
2. Click "Regenerate API Key"
3. Copy new key
4. Update `.env` file
5. Restart app

**Solution 2: Check Account Status**
- Verify email is confirmed
- Check if account is active
- Verify free tier limits not exceeded

## Testing After Setup

### Step 1: Check Logs
After adding API key and restarting, check console for:
```
LOG  Daily.co room created: https://perfectfl.daily.co/mpju864d_igjoica24
```

### Step 2: Test Matching
1. Open app on two devices
2. Click "Find Random Match" on both
3. Should match within seconds
4. Should navigate to CallPage

### Step 3: Verify Video Call
- Daily.co interface should load
- No "Something went wrong" error
- Video/audio should work
- Call should last 3 minutes

## Alternative: Use Daily.co Prebuilt Without API Key

If you don't want to use an API key, you can use Daily.co's public demo domain:

### Update HomePage.js
```javascript
const createDailyRoom = async () => {
  // Use Daily.co's public demo domain
  const roomName = generateCallId();
  return `https://your-team.daily.co/${roomName}`;
};
```

**Note:** Replace `your-team` with any subdomain. Daily.co will auto-create rooms on their demo domain, but this is not recommended for production.

## Security Note

⚠️ **IMPORTANT:** The API key in `.env` will be bundled into your APK. For production apps, you should:

1. Create a backend API endpoint
2. Store API key on backend (not in app)
3. Call your backend to create rooms
4. Backend calls Daily.co API
5. Backend returns room URL to app

For testing and development, storing in `.env` is fine.

## Quick Reference

| Step | Action | Command/Link |
|------|--------|--------------|
| 1 | Sign up | https://dashboard.daily.co/signup |
| 2 | Get API key | https://dashboard.daily.co/developers |
| 3 | Add to .env | `DAILY_API_KEY=your_key_here` |
| 4 | Restart app | `bash reset-cache.sh && npm start` |
| 5 | Test | Click "Find Random Match" |

## Expected Results

### Console Logs (Success)
```
LOG  Daily.co room created: https://perfectfl.daily.co/mpju864d_igjoica24
LOG  Camera and microphone permissions granted
LOG  {"roomUrl": "https://perfectfl.daily.co/mpju864d_igjoica24", ...}
```

### App Behavior (Success)
- ✅ Click "Find Random Match"
- ✅ Match found
- ✅ Navigate to CallPage
- ✅ Daily.co interface loads
- ✅ Video/audio works
- ✅ No errors

### Console Logs (Failure - No API Key)
```
WARN  Daily.co API key not configured, using fallback method
LOG  {"roomUrl": "https://perfectfl.daily.co/mpju864d_igjoica24", ...}
ERROR Something went wrong. Try joining again or contact the meeting host for help
```

### App Behavior (Failure - No API Key)
- ✅ Click "Find Random Match"
- ✅ Match found
- ✅ Navigate to CallPage
- ❌ "Something went wrong" error
- ❌ Video call doesn't load

## Support

If you're still having issues:

1. Check `.env` file has correct API key
2. Verify API key on Daily.co dashboard
3. Clear all caches: `bash reset-cache.sh`
4. Restart Expo: `npm start`
5. Check console logs for errors
6. Try regenerating API key

---

**Status:** Waiting for API key setup
**Last Updated:** May 24, 2026
