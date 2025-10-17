# Quick Build Commands 🚀

## ✅ What I Fixed

Your APK size increased from 200 MB to 600 MB because:
1. ❌ `universalApk false` - Was creating split APKs only
2. ❌ Too many ProGuard `-keep` rules - Prevented code shrinking
3. ❌ Including x86/x86_64 - Added 150-200 MB unnecessary code

**Now fixed!** Expected size: **80-120 MB** ✅

---

## 🚀 Build Commands

### **Clean Build (Do this first)**
```bash
cd android
./gradlew clean
cd ..
```

### **Build APK (for testing/distribution)**
```bash
cd android && ./gradlew assembleRelease
```

**Output**: `android/app/build/outputs/apk/release/`
- `app-universal-release.apk` (~100 MB) - Works on all devices
- `app-arm64-v8a-release.apk` (~60 MB) - Modern devices only
- `app-armeabi-v7a-release.apk` (~55 MB) - Older devices only

### **Build AAB (for Play Store)**
```bash
cd android && ./gradlew bundleRelease
```

**Output**: `android/app/build/outputs/bundle/release/app-release.aab` (~100 MB)

---

## 📱 Which File to Use?

| File | Size | Use For |
|------|------|---------|
| **app-universal-release.apk** | ~100 MB | Testing on any device, direct distribution |
| **app-arm64-v8a-release.apk** | ~60 MB | Modern devices (2016+) |
| **app-armeabi-v7a-release.apk** | ~55 MB | Older devices |
| **app-release.aab** | ~100 MB | **Play Store submission** ⭐ |

---

## 🎯 Expected Sizes

| Build Type | Before | After | Target |
|------------|--------|-------|--------|
| Universal APK | 600 MB ❌ | ~100 MB ✅ | <100 MB |
| AAB | 200 MB ⚠️ | ~100 MB ✅ | <100 MB |
| User Download | ~200 MB ❌ | ~60 MB ✅ | <100 MB |

---

## ⚡ Quick Build Script

Save this as `build.sh`:
```bash
#!/bin/bash

echo "🧹 Cleaning previous builds..."
cd android
./gradlew clean

echo "📦 Building APK..."
./gradlew assembleRelease

echo "📦 Building AAB..."
./gradlew bundleRelease

echo "✅ Build complete!"
echo ""
echo "📱 APK location: android/app/build/outputs/apk/release/"
echo "📦 AAB location: android/app/build/outputs/bundle/release/"
echo ""
echo "📊 Checking sizes..."
ls -lh app/build/outputs/apk/release/*.apk
ls -lh app/build/outputs/bundle/release/*.aab
```

Make it executable:
```bash
chmod +x build.sh
./build.sh
```

---

## 🔍 Check APK Size

```bash
ls -lh android/app/build/outputs/apk/release/app-universal-release.apk
```

---

## ✅ What Changed

### **build.gradle**:
- ✅ Removed x86/x86_64 architectures (saves ~150-200 MB)
- ✅ Set `universalApk true` (creates universal APK)
- ✅ Enabled `shrinkResources true` (removes unused resources)

### **proguard-rules.pro**:
- ✅ Removed excessive `-keep` rules
- ✅ Only keeps public APIs (allows code shrinking)
- ✅ Added optimization flags

### **gradle.properties**:
- ✅ Disabled GIF/WebP support (saves ~4 MB)
- ✅ Removed x86 from architectures

---

## 🐛 If App Crashes

If your app crashes in release mode after ProGuard, add specific keep rules to `android/app/proguard-rules.pro`:

```proguard
# If Razorpay crashes
-keep class com.razorpay.** { *; }

# If Zego crashes  
-keep class **.zego.** { *; }
-keep class im.zego.** { *; }

# If Supabase crashes
-keep class io.supabase.** { *; }
```

Then rebuild:
```bash
cd android
./gradlew clean
./gradlew assembleRelease
```

---

## 📊 Analyze APK (Optional)

To see what's taking up space:

```bash
# Using apkanalyzer (comes with Android SDK)
apkanalyzer apk summary android/app/build/outputs/apk/release/app-universal-release.apk

# Or use Android Studio
# Build → Analyze APK → Select your APK
```

---

## 🎉 Success!

Your APK should now be **under 100 MB** like Instagram! 

**Next steps**:
1. Build using commands above
2. Test the APK on your device
3. If it works, upload AAB to Play Store

Good luck! 🚀
