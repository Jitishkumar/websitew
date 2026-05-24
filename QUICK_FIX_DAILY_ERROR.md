# Quick Fix: "Something went wrong" Error

## The Error You're Seeing
```
Something went wrong
Try joining again or contact the meeting host for help
```

## Why This Happens
Daily.co requires an API key to create rooms. Without it, the room creation fails.

## Quick Fix (5 minutes)

### Step 1: Get API Key (2 minutes)
1. Go to: https://dashboard.daily.co/signup
2. Sign up (free, no credit card)
3. Go to: https://dashboard.daily.co/developers
4. Copy your API key

### Step 2: Add to .env (1 minute)
1. Open `.env` file in project root
2. Find: `DAILY_API_KEY=YOUR_DAILY_API_KEY_HERE`
3. Replace with: `DAILY_API_KEY=your_actual_key_here`
4. Save file

### Step 3: Restart App (2 minutes)
```bash
bash reset-cache.sh
npm start
# Press 'a' for Android
```

## That's It!

Now test:
1. Click "Find Random Match"
2. Should match and load video call
3. No more "Something went wrong" error

## Detailed Guide
See `GET_DAILY_API_KEY.md` for detailed instructions with screenshots.

## Still Not Working?

### Check 1: API Key Format
```
✅ GOOD: DAILY_API_KEY=abc123def456ghi789
❌ BAD:  DAILY_API_KEY="abc123def456ghi789"
❌ BAD:  DAILY_API_KEY = abc123def456ghi789
❌ BAD:  DAILY_API_KEY=YOUR_DAILY_API_KEY_HERE
```

### Check 2: Restart App
```bash
# Kill all processes
# Clear caches
bash reset-cache.sh

# Restart
npm start
```

### Check 3: Console Logs
Look for:
```
✅ LOG  Daily.co room created: https://perfectfl.daily.co/...
❌ WARN Daily.co API key not configured
```

## Free Tier Limits
- ✅ 10,000 minutes/month FREE
- ✅ No credit card required
- ✅ Perfect for testing

---

**Time to fix:** 5 minutes
**Difficulty:** Easy
**Cost:** Free
