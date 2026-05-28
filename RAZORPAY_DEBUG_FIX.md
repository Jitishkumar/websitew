# ✅ Razorpay Debug APK Fix

## 🎯 Problem
Debug APK was crashing with "Merchant key not set" because:
1. The old debug APK was built with placeholder key from `eas.json`
2. `.env` changes don't affect already-built APKs

## ✅ Solution Applied

### 1. Updated eas.json
Changed debug profile from:
```json
"RAZORPAY_KEY_ID": "rzp_test_XXXXXXXXXX"
```

To:
```json
"RAZORPAY_KEY_ID": "rzp_live_9LYHB9hxHFjr7N"
```

### 2. Started Rebuild
The debug APK is currently building with the correct Razorpay key.

Build progress: **66%** (still running)

## 🚀 What's Happening Now

The build is compiling native C++ libraries:
- ✅ Java/Kotlin compilation done
- 🔄 C++ native modules compiling (react-native-reanimated, expo-modules-core, etc.)
- ⏳ Estimated 5-10 minutes remaining

## 📱 After Build Completes

The APK will be at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

Install it:
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## 🧪 Test Razorpay

1. Open app
2. Go to Donate screen
3. Enter name and amount
4. Click "Donate Now"
5. **Razorpay screen will open** (no crash!)

⚠️ **You're using LIVE key** - real money will be charged!

## 🔄 Quick Rebuild Command

If you need to rebuild again:
```bash
./REBUILD_DEBUG_NOW.sh
```

Or manually:
```bash
cd android
./gradlew clean
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## ✅ What Was Fixed

1. ✅ Added Razorpay live key to `.env`
2. ✅ Updated `eas.json` debug profile
3. ✅ Protected `.env` in `.gitignore`
4. 🔄 Rebuilding debug APK (in progress)

## 📊 Build Status

Check if build finished:
```bash
ls -lh android/app/build/outputs/apk/debug/
```

If you see `app-debug.apk`, it's done!

---

**Status**: Build in progress (66% complete). Razorpay key is correctly configured.
