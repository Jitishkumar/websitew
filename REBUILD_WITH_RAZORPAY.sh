#!/bin/bash

echo "🔧 Rebuilding App with Razorpay Key"
echo "===================================="
echo ""

# Check if Razorpay key is set
if grep -q "YOUR_RAZORPAY_TEST_KEY_HERE" .env; then
    echo "❌ ERROR: Razorpay key not set in .env"
    echo "Please update RAZORPAY_KEY_ID in .env file"
    exit 1
fi

echo "✅ Razorpay key found in .env"
echo ""

echo "Step 1: Cleaning build cache..."
rm -rf android/app/build
rm -rf android/build
rm -rf node_modules/.cache
echo "✅ Cache cleaned"
echo ""

echo "Step 2: Cleaning Gradle..."
cd android
./gradlew clean
cd ..
echo "✅ Gradle cleaned"
echo ""

echo "Step 3: Building release APK..."
cd android
./gradlew assembleRelease
cd ..
echo ""

if [ -f "android/app/build/outputs/apk/release/app-release.apk" ]; then
    echo "✅ Build successful!"
    echo ""
    echo "APK location:"
    echo "android/app/build/outputs/apk/release/app-release.apk"
    echo ""
    echo "To install on device:"
    echo "adb install android/app/build/outputs/apk/release/app-release.apk"
    echo ""
    echo "🎉 Razorpay is now configured!"
    echo "Test with: Card 4111 1111 1111 1111, CVV 123, Expiry 12/25"
else
    echo "❌ Build failed!"
    echo "Check the error messages above"
    exit 1
fi
