#!/bin/bash

echo "🔧 Rebuilding DEBUG APK with Razorpay Key"
echo "=========================================="
echo ""

# Check if Razorpay key is set
if ! grep -q "rzp_live_9LYHB9hxHFjr7N" .env; then
    echo "❌ ERROR: Razorpay key not found in .env"
    echo "Current .env content:"
    cat .env | grep RAZORPAY
    exit 1
fi

echo "✅ Razorpay key found in .env"
echo ""

echo "Step 1: Stopping any running Metro bundler..."
pkill -f "react-native" || true
pkill -f "metro" || true
echo "✅ Metro stopped"
echo ""

echo "Step 2: Cleaning cache..."
rm -rf android/app/build
rm -rf android/build
rm -rf node_modules/.cache
rm -rf /tmp/metro-*
rm -rf /tmp/haste-*
echo "✅ Cache cleaned"
echo ""

echo "Step 3: Cleaning Gradle..."
cd android
./gradlew clean
cd ..
echo "✅ Gradle cleaned"
echo ""

echo "Step 4: Building DEBUG APK..."
cd android
./gradlew assembleDebug
cd ..
echo ""

if [ -f "android/app/build/outputs/apk/debug/app-debug.apk" ]; then
    echo "✅ Build successful!"
    echo ""
    echo "APK location:"
    echo "android/app/build/outputs/apk/debug/app-debug.apk"
    echo ""
    echo "Installing on device..."
    adb install -r android/app/build/outputs/apk/debug/app-debug.apk
    echo ""
    echo "🎉 Debug APK installed with Razorpay key!"
    echo ""
    echo "⚠️  IMPORTANT: You're using LIVE Razorpay key"
    echo "Real money will be charged for donations!"
    echo ""
    echo "Test with small amount (₹1) first"
else
    echo "❌ Build failed!"
    echo "Check the error messages above"
    exit 1
fi
