# Quick Start Guide - Random Matching System

## Prerequisites

✅ Expo app is set up and running
✅ Supabase database is configured
✅ User authentication is working
✅ Camera and microphone permissions are granted

## Database Setup

Make sure these tables exist in your Supabase database:

### 1. waiting_users table
```sql
CREATE TABLE waiting_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  call_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'waiting',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. active_calls table
```sql
CREATE TABLE active_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT UNIQUE NOT NULL,
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user1_name TEXT NOT NULL,
  user1_accepted BOOLEAN DEFAULT FALSE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_name TEXT NOT NULL,
  user2_accepted BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'matched',
  room_url TEXT NOT NULL,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## How to Test

### Single Device Test (Simulator)

1. **Start the app**
   ```bash
   cd /Users/jitishkumar/Desktop/untitled\ folder/websitew
   npm start
   # or
   expo start
   ```

2. **Login with test account**
   - Email: `test@example.com`
   - Password: `password123`

3. **Click the video camera icon** in the header
   - You'll see "Looking for a match..." alert
   - App will wait for another user

4. **Open another simulator/device**
   - Login with a different account
   - Click the video camera icon
   - Both should see match confirmation screen

5. **Accept the match**
   - Both users click "Accept"
   - Both should enter the video call

6. **End the call**
   - Click "End" button
   - Both return to Home screen

### Two Device Test (Recommended)

1. **Build APK for testing**
   ```bash
   cd /Users/jitishkumar/Desktop/untitled\ folder/websitew
   eas build --platform android --profile preview
   ```

2. **Install on two physical devices**
   - Download the APK from EAS
   - Install on both devices

3. **Login on both devices**
   - Use different accounts
   - Or use same account (will work but not ideal)

4. **Click "Find a Match"**
   - Device A: Click video camera icon
   - Device B: Click video camera icon
   - Both should see match confirmation

5. **Accept and test video call**
   - Both click "Accept"
   - Video call should start
   - Test audio/video
   - End call when done

## What to Look For

✅ **Matching Works**
- Users are matched within 2-4 seconds
- Match confirmation screen appears on both devices

✅ **Profiles Display**
- Username of matched user is shown
- Avatar initial is displayed

✅ **Timer Works**
- 30-second countdown is visible
- Auto-rejects if no response

✅ **Video Call Works**
- Jitsi Meet loads in WebView
- Camera and microphone work
- Audio/video is transmitted
- Both users can see each other

✅ **Call Ends Properly**
- Clicking "End" disconnects both users
- Both return to Home screen
- Can find new matches

## Common Issues & Fixes

### Issue: "Not enough waiting users to match"
**Solution**: This is normal. You need at least 2 users waiting. Make sure both devices have clicked "Find a Match".

### Issue: Match confirmation doesn't appear
**Solution**: 
- Check internet connection on both devices
- Verify both users are logged in
- Check Supabase connection
- Look at console logs for errors

### Issue: Video call doesn't start
**Solution**:
- Ensure both users clicked "Accept"
- Check camera/microphone permissions
- Verify Jitsi Meet URL is correct
- Try refreshing the app

### Issue: Can't see other user's video
**Solution**:
- Check camera permission is granted
- Ensure good internet connection
- Try ending call and starting new one
- Check Jitsi Meet status

### Issue: Database error about duplicate key
**Solution**: This should be fixed now. If it occurs:
- Check that users are being removed from `waiting_users` table
- Verify the MatchingService is using DELETE instead of UPDATE
- Clear the `waiting_users` table manually if needed

## Testing Checklist

- [ ] App starts without errors
- [ ] Can login successfully
- [ ] Video camera icon is visible in header
- [ ] Clicking video camera icon adds user to queue
- [ ] "Looking for a match..." alert appears
- [ ] Match confirmation screen appears when 2 users waiting
- [ ] Both users' profiles are displayed
- [ ] 30-second timer is visible
- [ ] Accept button works
- [ ] Reject button works
- [ ] Video call starts after both accept
- [ ] Can see other user's video
- [ ] Can hear other user's audio
- [ ] End call button works
- [ ] Both users return to Home after call ends
- [ ] Can find new matches after call ends

## Performance Tips

1. **Reduce check interval** if matching is too slow
   - Currently: 2 seconds
   - Can reduce to 1 second for faster matching

2. **Increase timeout** if users need more time to respond
   - Currently: 30 seconds
   - Can increase to 60 seconds

3. **Monitor database** for performance
   - Check query times
   - Add indexes if needed

## Next Steps

1. Test on physical devices
2. Gather user feedback
3. Monitor Supabase for errors
4. Optimize based on usage patterns
5. Add additional features (ratings, blocking, etc.)

## Support

If you encounter issues:
1. Check console logs for error messages
2. Verify Supabase tables exist and have correct schema
3. Ensure user is logged in
4. Check internet connection
5. Verify camera/microphone permissions

Good luck! 🎉
