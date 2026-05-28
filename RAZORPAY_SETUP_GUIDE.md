# 🔧 Razorpay Setup Guide - Fix "Merchant key not set" Error

## ❌ Current Error

```
java.lang.RuntimeException: Merchant key not set
```

**Cause**: `RAZORPAY_KEY_ID` is missing from your `.env` file.

## ✅ Solution: Add Razorpay Test Key

### Step 1: Get Your Razorpay Test Key

1. **Go to Razorpay Dashboard**:
   - Visit: https://dashboard.razorpay.com/
   - Login or create a free account

2. **Switch to TEST Mode**:
   - Look for the toggle at the top of the dashboard
   - Make sure it says **"Test Mode"** (NOT Live Mode)
   - Test mode is FREE and doesn't require business verification

3. **Get API Keys**:
   - Go to: **Settings** → **API Keys** (or visit https://dashboard.razorpay.com/app/website-app-settings/api-keys)
   - Click **"Generate Test Key"** if you don't have one
   - You'll see two keys:
     - **Key ID** (starts with `rzp_test_...`) ← You need this one
     - **Key Secret** (keep this secret, don't put in .env)

4. **Copy the Key ID**:
   - Copy the **Key ID** (looks like: `rzp_test_aBcDeFgHiJkLmN`)

### Step 2: Add Key to .env File

Open `.env` file and replace `YOUR_RAZORPAY_TEST_KEY_HERE` with your actual key:

```env
RAZORPAY_KEY_ID=rzp_test_aBcDeFgHiJkLmN
```

**Example**:
```env
# Before (won't work)
RAZORPAY_KEY_ID=YOUR_RAZORPAY_TEST_KEY_HERE

# After (will work)
RAZORPAY_KEY_ID=rzp_test_1A2B3C4D5E6F7G
```

### Step 3: Rebuild the App

After adding the key, you MUST rebuild the app:

```bash
# Clear cache
rm -rf android/app/build
rm -rf node_modules/.cache

# Rebuild
cd android
./gradlew clean
./gradlew assembleRelease
```

Or use Expo:
```bash
npx expo run:android
```

## 🔒 Security Notes

### ✅ Safe to Include (Client-Side):
- **Key ID** (`rzp_test_...`) - This is public and safe to include in your APK
- It's like a username - identifies your account but can't do anything harmful

### ❌ NEVER Include (Server-Side Only):
- **Key Secret** - This is like a password
- Keep it on your backend server only
- Never put it in `.env` or client code

## 🧪 Testing Razorpay

### Test Card Details (Use in Test Mode):

**Card Number**: `4111 1111 1111 1111`  
**CVV**: Any 3 digits (e.g., `123`)  
**Expiry**: Any future date (e.g., `12/25`)  
**Name**: Any name

### Test UPI:
**UPI ID**: `success@razorpay`

### Test Netbanking:
Select any bank and use:
- **Username**: Any username
- **Password**: Any password

All test payments will succeed without charging real money!

## 📱 How Donations Work in Your App

1. User enters name and amount
2. Clicks "Donate Now"
3. Razorpay payment screen opens
4. User completes payment (test mode = fake payment)
5. Payment success → Record saved to `donations` table
6. User appears in "Wealthiest Donors" list

## 🐛 Troubleshooting

### Error: "Merchant key not set"
**Solution**: Add `RAZORPAY_KEY_ID` to `.env` and rebuild app

### Error: "Invalid key"
**Solution**: Make sure you're using the **Test Key** (starts with `rzp_test_`)

### Payment screen doesn't open
**Solution**: 
1. Check if key is in `.env`
2. Rebuild the app (cache issue)
3. Check console for errors

### Donations not saving to database
**Solution**: Check Supabase `donations` table exists:
```sql
CREATE TABLE IF NOT EXISTS donations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  donor_name TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_id TEXT NOT NULL,
  payment_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 📊 Database Schema

Your app saves donations to Supabase:

```sql
-- Donations table
CREATE TABLE donations (
  id UUID PRIMARY KEY,
  user_id UUID,           -- Who donated
  donor_name TEXT,        -- Donor's name
  amount DECIMAL,         -- Amount in ₹
  payment_id TEXT,        -- Razorpay payment ID
  payment_verified BOOL,  -- Manual verification flag
  created_at TIMESTAMP
);
```

## 🎯 Quick Fix Checklist

- [ ] Go to https://dashboard.razorpay.com/
- [ ] Switch to **Test Mode**
- [ ] Get **Key ID** from API Keys section
- [ ] Add to `.env`: `RAZORPAY_KEY_ID=rzp_test_...`
- [ ] Rebuild app: `cd android && ./gradlew clean && ./gradlew assembleRelease`
- [ ] Test donation with test card: `4111 1111 1111 1111`

## 🚀 After Setup

Once you add the key and rebuild:
1. Open app
2. Go to Donate screen
3. Enter name and amount
4. Click "Donate Now"
5. Razorpay screen should open (no crash!)
6. Use test card to complete payment
7. Check "Wealthiest Donors" to see your donation

## 💡 Pro Tips

1. **Always use Test Mode** during development
2. **Never commit** `.env` file to git (it's in `.gitignore`)
3. **Test payments are free** - use them as much as you want
4. **Live Mode** requires business verification and bank account

## 📞 Need Help?

If you still get errors:
1. Check `.env` file has the key
2. Make sure key starts with `rzp_test_`
3. Rebuild the app completely
4. Check Razorpay dashboard for any issues

---

**Current Status**: `.env` file updated with placeholder. Replace `YOUR_RAZORPAY_TEST_KEY_HERE` with your actual test key from Razorpay dashboard.
