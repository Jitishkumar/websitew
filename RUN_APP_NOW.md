# How to Run the App Now

## ✅ App is Fixed and Ready!

The plugin error has been fixed. Your app is now ready to run.

## 🚀 Quick Start

### Option 1: Run on Simulator (Easiest)

**Terminal 1 - Start the Metro Bundler:**
```bash
cd /Users/jitishkumar/Desktop/untitled\ folder/websitew
npm start
```

You should see:
```
Starting Metro Bundler
Waiting on http://localhost:8081
```

**Terminal 2 - Run on Android Emulator:**
```bash
cd /Users/jitishkumar/Desktop/untitled\ folder/websitew
npm run android
```

Or **Run on iOS Simulator:**
```bash
cd /Users/jitishkumar/Desktop/untitled\ folder/websitew
npm run ios
```

### Option 2: Run on Physical Device

**Terminal 1 - Start the Metro Bundler:**
```bash
npm start
```

**Terminal 2 - Build and run on device:**
```bash
npm run android
# or
npm run ios
```

## 📱 Testing the Matching System

Once the app is running:

1. **Login** with test credentials:
   - Email: `test@example.com`
   - Password: `password123`

2. **Click the video camera icon** in the header
   - You'll see "Looking for a match..." alert

3. **Open another simulator/device** and repeat steps 1-2

4. **Both should see match confirmation screen**
   - Shows both users' profiles
   - 30-second countdown timer
   - Accept/Reject buttons

5. **Both click "Accept"**
   - Video call should start
   - Jitsi Meet will load

6. **Test video call**
   - Can you see the other user?
   - Can you hear the other user?
   - Can you end the call?

## 🔧 Troubleshooting

### App won't start
- Make sure you're in the correct directory
- Try: `npm install` first
- Check that Node.js is installed: `node --version`

### Metro Bundler won't start
- Kill any existing processes: `lsof -i :8081` then `kill -9 <PID>`
- Try again: `npm start`

### Can't connect to device
- Make sure device is connected via USB
- Enable USB debugging on Android
- Try: `adb devices` to see connected devices

### Video call doesn't work
- Check camera/microphone permissions
- Make sure both users are logged in
- Check internet connection
- Try refreshing the app

## 📋 What to Check

- [ ] App starts without errors
- [ ] Can login successfully
- [ ] Video camera icon visible in header
- [ ] Clicking icon shows "Looking for a match..." alert
- [ ] Can find matches with another device
- [ ] Match confirmation screen appears
- [ ] Both users' profiles are displayed
- [ ] 30-second timer is visible
- [ ] Accept/Reject buttons work
- [ ] Video call starts after both accept
- [ ] Can see other user's video
- [ ] Can hear other user's audio
- [ ] End call button works
- [ ] Both users return to Home after call

## 🎉 You're Ready!

The app is now fixed and ready to test. Follow the steps above to run it and test the matching system.

Good luck! 🚀
