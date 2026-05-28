#!/bin/bash

echo "🔧 Fixing Android Build - SDK Version Issues"
echo "=============================================="
echo ""

# Navigate to android directory
cd android

echo "Step 1: Cleaning Gradle cache..."
./gradlew clean

echo ""
echo "Step 2: Deleting build folders..."
rm -rf build
rm -rf app/build
rm -rf .gradle

echo ""
echo "Step 3: Going back to root..."
cd ..

echo ""
echo "Step 4: Cleaning node_modules gradle cache..."
rm -rf node_modules/react-native-reanimated/android/build
rm -rf node_modules/react-native-reanimated/android/.cxx

echo ""
echo "Step 5: Rebuilding the project..."
cd android
./gradlew assembleRelease

echo ""
echo "✅ Build process completed!"
echo ""
echo "If the build succeeded, your APK is at:"
echo "android/app/build/outputs/apk/release/app-release.apk"
