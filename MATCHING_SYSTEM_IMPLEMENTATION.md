# Random Matching System Implementation Guide

## Overview
The random matching system has been successfully implemented in your Expo app (`websitew`). This system allows users to find random matches for video calls using Jitsi Meet.

## What Was Implemented

### 1. **MatchingService** (`src/services/MatchingService.js`)
A comprehensive service that handles all matching operations:

- **addToWaitingQueue()** - Adds user to the waiting queue
- **matchWaitingUsers()** - Automatically matches waiting users in pairs
- **checkForMatch()** - Checks if user has been matched
- **acceptMatch()** - User accepts a match
- **rejectMatch()** - User rejects a match
- **endCall()** - Ends an active call
- **skipUser()** - User skips and leaves queue
- **handleUserDisconnect()** - Cleanup when user disconnects

**Key Fix**: The service removes users from the `waiting_users` table instead of updating them, which prevents the "duplicate key value violates unique constraint" database error.

### 2. **MatchConfirmScreen** (`src/screens/MatchConfirmScreen.js`)
A new screen that shows when two users are matched:

- Displays both users' profiles (username, avatar)
- Shows a 30-second countdown timer
- Accept/Reject buttons
- Automatically rejects if user doesn't respond in 30 seconds
- Polls for other user's response if user accepts
- Shows "Waiting for other user" state

### 3. **Updated HomeScreen** (`src/screens/HomeScreen.js`)
Added matching functionality to the home screen:

- New "Find a Match" button (video camera icon) in the header
- "Find a Match" function that adds user to waiting queue
- Automatic matching check every 2 seconds
- Skip functionality to leave the queue
- Waiting state UI

### 4. **Updated Navigation** (`src/navigation/AppNavigator.js`)
- Added `MatchConfirmScreen` to the navigation stack
- Route name: `MatchConfirm`

### 5. **Updated CallPage** (`src/screens/CallPage.js`)
- Improved cleanup of matching data when call ends
- Proper navigation back to Home screen after call

## How It Works

### User Flow

1. **User clicks "Find a Match"** (video camera icon in header)
   - User is added to `waiting_users` table
   - App starts checking for matches every 2 seconds
   - User sees "Looking for a match..." alert

2. **Matching Occurs**
   - When 2+ users are waiting, the system automatically matches them
   - Both users are removed from `waiting_users` table
   - A record is created in `active_calls` table with status "matched"

3. **Match Confirmation**
   - Both users see the `MatchConfirmScreen`
   - Shows the other user's profile
   - 30-second timer to accept/reject
   - If user doesn't respond, automatically rejects

4. **Both Accept**
   - Call status changes to "active"
   - Both users navigate to `CallPage`
   - Jitsi Meet video call starts

5. **Call Ends**
   - Either user can end the call
   - Both users are disconnected
   - Call record is cleaned up
   - Users return to Home screen

## Database Schema

### waiting_users table
```sql
- user_id (UUID, primary key)
- username (text)
- call_id (text, unique)
- status (text) - 'waiting'
- created_at (timestamp)
```

### active_calls table
```sql
- id (UUID, primary key)
- call_id (text, unique) - Jitsi room name
- user1_id (UUID)
- user1_name (text)
- user1_accepted (boolean)
- user2_id (UUID)
- user2_name (text)
- user2_accepted (boolean)
- status (text) - 'matched', 'active', 'ended', 'rejected'
- room_url (text) - Jitsi Meet URL
- started_at (timestamp)
- ended_at (timestamp)
- created_at (timestamp)
```

## Key Features

✅ **Automatic Matching** - Users are matched automatically when waiting
✅ **Match Confirmation** - Both users must accept before call starts
✅ **30-Second Timer** - Auto-reject if no response
✅ **Skip Functionality** - Users can skip and find another match
✅ **Automatic Cleanup** - Call data is cleaned up when call ends
✅ **Database Constraint Fix** - No more "duplicate key" errors
✅ **Jitsi Integration** - Free video calls with no credit card required
✅ **User Profiles** - Shows username and avatar of matched user

## Testing

### Test Scenario 1: Basic Matching
1. Open app on Device A, click "Find a Match"
2. Open app on Device B, click "Find a Match"
3. Both should see match confirmation screen
4. Both click "Accept"
5. Both should enter video call

### Test Scenario 2: Rejection
1. Open app on Device A, click "Find a Match"
2. Open app on Device B, click "Find a Match"
3. Device A clicks "Reject"
4. Device A returns to Home, Device B returns to Home
5. Both can find new matches

### Test Scenario 3: Timeout
1. Open app on Device A, click "Find a Match"
2. Open app on Device B, click "Find a Match"
3. Wait 30 seconds without responding
4. Both should automatically reject and return to Home

### Test Scenario 4: Skip
1. Open app on Device A, click "Find a Match"
2. Wait for match
3. Click "Skip" button
4. Should return to Home and be removed from queue

## Troubleshooting

### Issue: "Not enough waiting users to match"
- This is normal - need at least 2 users waiting
- Wait for another user to join the queue

### Issue: Match confirmation doesn't appear
- Check internet connection
- Ensure both users are logged in
- Check Supabase connection

### Issue: Call doesn't start after accepting
- Ensure both users accepted
- Check Jitsi Meet URL is correct
- Verify camera/microphone permissions

### Issue: Database constraint error
- This should be fixed now with the new implementation
- If it occurs, check that users are being removed from queue

## Next Steps

1. **Test on physical devices** - Use EAS build to create APK
2. **Monitor database** - Check Supabase for any errors
3. **Gather user feedback** - See if matching works smoothly
4. **Optimize timing** - Adjust 2-second check interval if needed
5. **Add more features** - User ratings, blocking, etc.

## Important Notes

- The system uses Jitsi Meet which is completely free
- No credit card required
- No hosting needed
- Matches are random and automatic
- Users can skip to find another match
- Calls are limited to 3 minutes (can be changed)
- All data is stored in Supabase

## Files Modified/Created

- ✅ Created: `src/services/MatchingService.js`
- ✅ Created: `src/screens/MatchConfirmScreen.js`
- ✅ Modified: `src/screens/HomeScreen.js` (added matching functions and button)
- ✅ Modified: `src/navigation/AppNavigator.js` (added MatchConfirm route)
- ✅ Modified: `src/screens/CallPage.js` (improved cleanup)

## Support

If you encounter any issues:
1. Check the console logs for error messages
2. Verify Supabase connection
3. Ensure database tables exist with correct schema
4. Check that user is logged in
5. Verify camera/microphone permissions are granted
