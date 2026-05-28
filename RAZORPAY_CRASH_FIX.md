# 🚨 RAZORPAY CRASH FIX - "Merchant key not set"

## ❌ Error You're Getting

```
java.lang.RuntimeException: Merchant key not set
```

## ✅ Quick Fix (3 Steps)

### Step 1: Get Razorpay Test Key (2 minutes)

1. Go to: https://dashboard.razorpay.com/
2. Login (or create free account)
3. Switch to **"Test Mode"** (toggle at top)
4. Go to: **Settings** → **API Keys**
5. Copy the **Key ID** (starts with `rzp_test_...`)

### Step 2: Add Key to .env File

Open `.env` file and replace this line:

```env
# Change this:
RAZORPAY_KEY_ID=YOUR_RAZORPAY_TEST_KEY_HERE

# To this (use your actual key):
RAZORPAY_KEY_ID=rzp_test_1A2B3C4D5E6F7G
```

### Step 3: Rebuild App

```bash
cd android
./gradlew clean
./gradlew assembleRelease
```

Or install the new APK:
```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

## 🗄️ Database Setup (Required!)

You also need to create the `donations` table in Supabase:

1. Go to: https://supabase.com/dashboard
2. Open your project
3. Go to **SQL Editor**
4. Run the SQL from: `SETUP_DONATIONS_TABLE.sql`

## 🧪 Test the Fix

After rebuilding:

1. Open app
2. Go to Donate screen
3. Enter name: "Test User"
4. Enter amount: "10"
5. Click "Donate Now"
6. Razorpay screen should open (no crash!)
7. Use test card:
   - **Card**: `4111 1111 1111 1111`
   - **CVV**: `123`
   - **Expiry**: `12/25`

## 📋 Complete Checklist

- [ ] Get Razorpay test key from dashboard
- [ ] Add key to `.env` file
- [ ] Run `SETUP_DONATIONS_TABLE.sql` in Supabase
- [ ] Rebuild app (`./gradlew clean && ./gradlew assembleRelease`)
- [ ] Test donation with test card

## 🔍 Why This Happened

The Razorpay library needs the API key to initialize. Without it in `.env`, the key is `undefined`, causing the crash when you try to open the payment screen.

## 📚 Full Documentation

- **Razorpay Setup**: See `RAZORPAY_SETUP_GUIDE.md`
- **Database Setup**: See `SETUP_DONATIONS_TABLE.sql`

## 💡 Important Notes

1. **Test Mode is FREE** - No real money charged
2. **Key ID is safe** - It's public, like a username
3. **Never share Key Secret** - Keep it on backend only
4. **Must rebuild** - .env changes require rebuild

---

**Status**: `.env` updated with placeholder. Add your actual Razorpay test key and rebuild!
