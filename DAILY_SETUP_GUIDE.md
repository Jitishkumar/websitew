# Daily.co Setup Guide

## Overview
I've implemented Daily.co video calling to replace ZegoCloud. Daily.co offers 10,000 free minutes per month, which is much better than ZegoCloud's paid model.

## What's Been Done

### 1. Removed ZegoCloud
- Uninstalled all ZegoCloud packages
- Removed ZegoCloud imports and code

### 2. Added Daily.co
- Installed `@daily-co/react-native-daily-js`
- Created two implementation options:

#### Option A: Native Daily.co SDK (CallPage.js)
- Uses Daily.co's React Native SDK directly
- Custom UI with manual video/audio handling
- More control but more complex

#### Option B: Daily.co Prebuilt (CallPagePrebuilt.js) - RECOMMENDED
- Uses Daily.co's Prebuilt solution via WebView
- Fully featured UI out of the box
- Easier to implement and maintain
- Better user experience

### 3. Updated Database Schema
- Added `room_url` column to `waiting_users` table
- Added `room_url` column to `active_calls` table

## Setup Steps

### 1. Run Database Migration
Execute this SQL in your Supabase dashboard:

```sql
-- Add room_url column to waiting_users table
ALTER TABLE waiting_users ADD COLUMN room_url TEXT;

-- Add room_url column to active_calls table  
ALTER TABLE active_calls ADD COLUMN room_url TEXT;
```

### 2. Choose Implementation
I recommend using the **Prebuilt version** (CallPagePrebuilt.js) because:
- ✅ Full-featured video calling UI
- ✅ Built-in controls (mute, camera, leave)
- ✅ Better user experience
- ✅ Less code to maintain
- ✅ Automatic handling of edge cases

To use the Prebuilt version:

1. Rename `CallPagePrebuilt.js` to `CallPage.js`
2. Or update your navigation to use `CallPagePrebuilt`

### 3. Daily.co Account (Optional)
The current implementation uses Daily.co's auto-room creation, which works without an API key.

For production, you may want to:
1. Sign up at https://dashboard.daily.co/
2. Get your API key
3. Use the API to create rooms with custom settings

### 4. Test the Implementation
1. Run the app: `npm start`
2. Try the video calling feature
3. Test with two devices/emulators

## How It Works

### Room Creation
- Each call gets a unique Daily.co room URL
- Format: `https://perfectfl.daily.co/UNIQUE_ID`
- Daily.co automatically creates rooms when accessed

### Matching Process
1. User A starts searching → creates room URL
2. User B joins → uses same room URL
3. Both users connect to the same Daily.co room

### Call Features
- ✅ Video calling
- ✅ Audio controls (mute/unmute)
- ✅ Camera controls (on/off)
- ✅ 3-minute call limit
- ✅ Automatic cleanup
- ✅ Background/foreground handling

## Benefits Over ZegoCloud

1. **Cost**: 10,000 free minutes/month vs paid model
2. **Reliability**: Established WebRTC infrastructure
3. **Features**: Full-featured Prebuilt UI
4. **Support**: Better documentation and community
5. **Flexibility**: Can customize or use prebuilt

## Troubleshooting

### If video doesn't work:
1. Check camera/microphone permissions
2. Test on physical device (emulator may have issues)
3. Check network connectivity
4. Verify room URL format

### If calls don't connect:
1. Check Supabase database updates
2. Verify room URL is being passed correctly
3. Check browser console for errors (in Prebuilt version)

## Next Steps

1. Test thoroughly on physical devices
2. Consider adding Daily.co API key for production
3. Customize the Prebuilt theme if needed
4. Monitor usage against the 10,000 minute limit

The implementation is now ready to use with Daily.co's free tier!