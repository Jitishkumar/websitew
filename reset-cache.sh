#!/bin/bash
echo "Clearing all caches..."
rm -rf node_modules/.cache
rm -rf .expo
rm -rf .expo/cache
rm -rf ~/Library/Caches/expo
rm -rf ~/Library/Caches/Expo
watchman watch-del-all 2>/dev/null || true
echo "Caches cleared!"
