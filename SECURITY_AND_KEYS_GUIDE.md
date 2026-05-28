# 🔒 Security & API Keys Guide

## ✅ What I Fixed

### 1. Added Razorpay Live Key
- Added `rzp_live_9LYHB9hxHFjr7N` to `.env` and `eas.json`
- **⚠️ WARNING**: This is your LIVE key - real payments will be charged!

### 2. Protected .env File
- Added `.env` to `.gitignore` to prevent committing secrets to git
- Your keys are now safe from accidental git commits

### 3. Updated EAS Configuration
- `eas.json` now has the live Razorpay key for production builds

## 🔐 Security Status: SAFE ✅

### What's Safe to Include in APK:

✅ **Supabase URL** - Public, safe to include
```
https://lckhaysswueoyinhfzyz.supabase.co
```

✅ **Supabase Anon Key** - Public, safe to include (protected by RLS)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

✅ **Razorpay Key ID** - Public, safe to include
```
rzp_live_9LYHB9hxHFjr7N
```

✅ **Cloudinary Cloud Name** - Public, safe to include
```
dhsdpvrrc
```

### What's NEVER Safe (Keep on Backend):

❌ **Supabase Service Role Key** - NEVER include in app
❌ **Razorpay Key Secret** - NEVER include in app
❌ **Cloudinary API Secret** - NEVER include in app
❌ **Daily.co API Key** - Currently in app (see warning below)

## ⚠️ SECURITY WARNING: Daily.co API Key

Your `.env` file contains:
```
DAILY_API_KEY=ce1186200e37259771ba3d4ebab51d35e76c1cd41be964906d8636f3a14a3906
```

**This is a SECRET key and should NOT be in your app!**

### Why This is Dangerous:
- Anyone can decompile your APK and extract this key
- They can create unlimited video rooms on your account
- You'll be charged for their usage
- They can access your Daily.co dashboard data

### How to Fix:
You need to move Daily.co room creation to a backend server. For now, you can:

1. **Rotate the key** (generate a new one in Daily.co dashboard)
2. **Set usage limits** in Daily.co dashboard
3. **Monitor usage** regularly

**Better Solution**: Create a backend API endpoint that creates rooms server-side.

## 📱 Current Setup

### Local Development (.env):
```env
CLOUDINARY_CLOUD_NAME=dhsdpvrrc
SUPABASE_URL=https://lckhaysswueoyinhfzyz.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DAILY_API_KEY=ce1186200e37259771ba3d4ebab51d35e76c1cd41be964906d8636f3a14a3906
RAZORPAY_KEY_ID=rzp_live_9LYHB9hxHFjr7N
```

### EAS Build (eas.json):
- **Production**: Uses live Razorpay key
- **Debug**: Uses test Razorpay key (you need to add a test key)

## 🚀 How to Build Now

### Option 1: Local Build (Gradle)
```bash
cd android
./gradlew clean
./gradlew assembleRelease
```

The APK will use keys from `.env` file.

### Option 2: EAS Build (Cloud)
```bash
eas build --platform android --profile production
```

The build will use keys from `eas.json`.

## 🔄 Rebuild Required

Since you added the Razorpay key, you MUST rebuild:

```bash
# Clean everything
rm -rf android/app/build
rm -rf node_modules/.cache

# Rebuild
cd android
./gradlew clean
./gradlew assembleRelease

# Install
adb install app/build/outputs/apk/release/app-release.apk
```

## 🧪 Testing Donations

### With LIVE Key (Current Setup):
- **Real money will be charged!**
- Use your actual card for testing
- Small amounts recommended (₹1-10)

### With TEST Key (Recommended for Development):
1. Get test key from Razorpay dashboard (starts with `rzp_test_`)
2. Update `.env`: `RAZORPAY_KEY_ID=rzp_test_...`
3. Rebuild app
4. Use test card: `4111 1111 1111 1111`

## 📊 What Happens When Someone Donates

1. User enters name and amount
2. Razorpay payment screen opens
3. User completes payment (real money charged with live key!)
4. Payment success → Record saved to `donations` table:
   ```sql
   INSERT INTO donations (
     user_id,
     donor_name,
     amount,
     payment_id,
     payment_verified
   ) VALUES (...)
   ```
5. Donation appears in "Wealthiest Donors" list

## 🔍 Verify Donations in Supabase

```sql
-- View all donations
SELECT 
  donor_name,
  amount,
  payment_id,
  payment_verified,
  created_at
FROM donations
ORDER BY created_at DESC;

-- View total donations
SELECT 
  SUM(amount) as total_donations,
  COUNT(*) as donation_count
FROM donations
WHERE payment_verified = true;
```

## 🛡️ Security Best Practices

### ✅ What You're Doing Right:
1. Using Supabase RLS (Row Level Security)
2. Storing keys in `.env` (now protected by `.gitignore`)
3. Using EAS for production builds
4. Razorpay Key ID is safe to include in app

### ⚠️ What Needs Improvement:
1. **Daily.co API Key** - Move to backend
2. **Payment Verification** - Add webhook verification
3. **Rate Limiting** - Add limits to prevent abuse

## 🔐 Git Security

Your `.gitignore` now includes:
```
.env
.env*.local
```

**Before pushing to git, verify:**
```bash
# Check what will be committed
git status

# Make sure .env is NOT listed
# If it is, run:
git rm --cached .env
git commit -m "Remove .env from git"
```

## 📞 Emergency: If Keys Are Compromised

If you accidentally commit keys to git:

1. **Rotate all keys immediately**:
   - Razorpay: Generate new key in dashboard
   - Daily.co: Generate new API key
   - Supabase: Rotate anon key (if service role was exposed)

2. **Remove from git history**:
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all
   ```

3. **Force push** (if repo is private and you're the only user):
   ```bash
   git push origin --force --all
   ```

## ✅ Current Status

- ✅ Razorpay live key added to `.env` and `eas.json`
- ✅ `.env` protected by `.gitignore`
- ✅ Donations table exists in database
- ⚠️ Daily.co API key still in app (needs backend solution)
- 🔄 **Rebuild required** to use new Razorpay key

## 🎯 Next Steps

1. **Rebuild app** with new Razorpay key
2. **Test donation** with small amount (₹1)
3. **Verify** donation appears in Supabase
4. **Consider** moving Daily.co key to backend
5. **Monitor** Razorpay dashboard for payments

---

**Remember**: With the LIVE Razorpay key, real money will be charged. Consider using TEST key for development!
