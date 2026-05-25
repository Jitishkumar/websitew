# Random Matching System - Architecture & Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         EXPO APP (websitew)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    HomeScreen                             │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  Header with "Find a Match" Button (Video Icon)   │  │   │
│  │  │  - Calls handleFindMatch()                        │  │   │
│  │  │  - Adds user to waiting queue                     │  │   │
│  │  │  - Starts polling for matches                     │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  Posts Feed                                        │  │   │
│  │  │  - Shows social posts                             │  │   │
│  │  │  - Stories                                         │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              MatchConfirmScreen                           │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  User 1 Profile  │  VS  │  User 2 Profile         │  │   │
│  │  │  - Username      │      │  - Username             │  │   │
│  │  │  - Avatar        │      │  - Avatar               │  │   │
│  │  │  - Email         │      │  - (Matched User)       │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  30-Second Timer                                   │  │   │
│  │  │  [████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]│  │   │
│  │  │  Responding in: 15s                                │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  [Reject Button]  [Accept Button]                 │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              CallPage (Jitsi WebView)                    │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  [Video Call Interface]                            │  │   │
│  │  │  - User 1 Video                                    │  │   │
│  │  │  - User 2 Video                                    │  │   │
│  │  │  - Controls (Mic, Camera, End Call)               │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Services                                    │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  MatchingService                                   │  │   │
│  │  │  - addToWaitingQueue()                             │  │   │
│  │  │  - matchWaitingUsers()                             │  │   │
│  │  │  - checkForMatch()                                 │  │   │
│  │  │  - acceptMatch()                                   │  │   │
│  │  │  - rejectMatch()                                   │  │   │
│  │  │  - endCall()                                       │  │   │
│  │  │  - skipUser()                                      │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ (Supabase Client)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE DATABASE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  waiting_users Table                                     │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ user_id  │ username │ call_id │ status │ created_at│  │   │
│  │  ├──────────┼──────────┼─────────┼────────┼───────────┤  │   │
│  │  │ uuid-1   │ user1    │ call-1  │waiting │ timestamp │  │   │
│  │  │ uuid-2   │ user2    │ call-2  │waiting │ timestamp │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  active_calls Table                                      │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ id │ call_id │ user1_id │ user1_name │ user1_acc  │  │   │
│  │  │ user2_id │ user2_name │ user2_acc │ status │ url │  │   │
│  │  ├────┼─────────┼──────────┼────────────┼────────┤  │   │
│  │  │ id │ room-1  │ uuid-1   │ user1      │ true   │  │   │
│  │  │ uuid-2   │ user2      │ true   │ active │ url  │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  profiles Table (existing)                               │   │
│  │  - username                                              │   │
│  │  - avatar_url                                            │   │
│  │  - email                                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ (Jitsi External API)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      JITSI MEET                                  │
├─────────────────────────────────────────────────────────────────┤
│  - Video Conference                                              │
│  - Audio/Video Streaming                                         │
│  - Room Management                                               │
│  - Free & Open Source                                            │
└─────────────────────────────────────────────────────────────────┘
```

## User Flow Diagram

```
START
  │
  ├─► User Opens App
  │     │
  │     ├─► Login
  │     │
  │     └─► Home Screen
  │           │
  │           ├─► Click "Find a Match" Button
  │           │     │
  │           │     ├─► Get User Profile
  │           │     │
  │           │     ├─► Add to waiting_users Table
  │           │     │
  │           │     ├─► Show "Looking for a match..." Alert
  │           │     │
  │           │     └─► Start Polling (Every 2 seconds)
  │           │           │
  │           │           ├─► Call matchWaitingUsers()
  │           │           │     │
  │           │           │     ├─► Get all waiting users
  │           │           │     │
  │           │           │     ├─► Match in pairs
  │           │           │     │
  │           │           │     ├─► Create active_calls record
  │           │           │     │
  │           │           │     └─► Remove from waiting_users
  │           │           │
  │           │           ├─► Call checkForMatch()
  │           │           │     │
  │           │           │     ├─► Query active_calls table
  │           │           │     │
  │           │           │     └─► If matched → Navigate to MatchConfirm
  │           │           │
  │           │           └─► Repeat every 2 seconds
  │           │
  │           └─► Or Click "Skip"
  │                 │
  │                 ├─► Remove from waiting_users
  │                 │
  │                 └─► Return to Home
  │
  ├─► MatchConfirmScreen
  │     │
  │     ├─► Show Both Users' Profiles
  │     │
  │     ├─► Start 30-Second Timer
  │     │
  │     ├─► User Clicks "Accept"
  │     │     │
  │     │     ├─► Update active_calls (user1_accepted = true)
  │     │     │
  │     │     ├─► Check if both accepted
  │     │     │     │
  │     │     │     ├─► If both accepted → Update status to "active"
  │     │     │     │     │
  │     │     │     │     └─► Navigate to CallPage
  │     │     │     │
  │     │     │     └─► If not both → Poll for other user
  │     │     │           │
  │     │     │           ├─► Every 2 seconds check status
  │     │     │           │
  │     │     │           ├─► If other accepted → Navigate to CallPage
  │     │     │           │
  │     │     │           └─► If timeout → Return to Home
  │     │     │
  │     │     └─► Navigate to CallPage
  │     │
  │     ├─► User Clicks "Reject"
  │     │     │
  │     │     ├─► Update active_calls (status = "rejected")
  │     │     │
  │     │     ├─► Remove from waiting_users
  │     │     │
  │     │     └─► Return to Home
  │     │
  │     └─► Timer Expires (30 seconds)
  │           │
  │           ├─► Auto-reject
  │           │
  │           └─► Return to Home
  │
  ├─► CallPage (Jitsi WebView)
  │     │
  │     ├─► Load Jitsi Meet
  │     │
  │     ├─► Request Camera/Microphone Permissions
  │     │
  │     ├─► Join Video Conference
  │     │
  │     ├─► Both Users Can See/Hear Each Other
  │     │
  │     ├─► 3-Minute Call Limit
  │     │
  │     ├─► User Clicks "End Call"
  │     │     │
  │     │     ├─► Update active_calls (status = "ended")
  │     │     │
  │     │     ├─► Remove from waiting_users
  │     │     │
  │     │     ├─► Clean up call data
  │     │     │
  │     │     └─► Navigate to Home
  │     │
  │     └─► Or Call Ends Automatically (3 minutes)
  │           │
  │           └─► Same cleanup as above
  │
  └─► Back to Home Screen
        │
        └─► User Can Find Another Match
              │
              └─► Repeat Process
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                              │
│  Click "Find a Match" Button                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  HomeScreen.handleFindMatch()                    │
│  1. Get current user                                             │
│  2. Get user profile                                             │
│  3. Call MatchingService.addToWaitingQueue()                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              MatchingService.addToWaitingQueue()                 │
│  1. Remove any existing entries for user                         │
│  2. Generate unique call_id                                      │
│  3. Insert into waiting_users table                              │
│  4. Return success/error                                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                             │
│  INSERT INTO waiting_users (user_id, username, call_id, status) │
│  VALUES (uuid, 'username', 'call_xxx', 'waiting')               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              HomeScreen.checkForMatch() (Every 2s)              │
│  1. Call MatchingService.matchWaitingUsers()                    │
│  2. Call MatchingService.checkForMatch()                        │
│  3. If matched → Navigate to MatchConfirm                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│           MatchingService.matchWaitingUsers()                    │
│  1. Get all waiting users (status = 'waiting')                  │
│  2. Match in pairs (user1, user2)                               │
│  3. Generate room name (Jitsi room)                             │
│  4. Create active_calls record                                  │
│  5. Delete both users from waiting_users                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                             │
│  INSERT INTO active_calls (...)                                 │
│  DELETE FROM waiting_users WHERE user_id IN (uuid1, uuid2)      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│            MatchingService.checkForMatch()                       │
│  1. Query active_calls for current user                         │
│  2. If found → Return match data                                │
│  3. Navigate to MatchConfirm with match data                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  MatchConfirmScreen                              │
│  1. Display both users' profiles                                │
│  2. Start 30-second timer                                       │
│  3. Wait for user action (Accept/Reject)                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    ACCEPT           REJECT            TIMEOUT
        │                │                │
        ▼                ▼                ▼
  Update DB         Update DB          Update DB
  (accepted)        (rejected)          (rejected)
        │                │                │
        ▼                ▼                ▼
  Check if both    Return to Home    Return to Home
  accepted
        │
        ├─► Both accepted
        │     │
        │     ▼
        │   Navigate to CallPage
        │
        └─► Waiting for other
              │
              ▼
            Poll every 2s
              │
              ├─► Other accepted → CallPage
              │
              └─► Timeout → Home
```

## Component Interaction Diagram

```
HomeScreen
    │
    ├─► handleFindMatch()
    │     │
    │     └─► MatchingService.addToWaitingQueue()
    │           │
    │           └─► Supabase (waiting_users)
    │
    ├─► checkForMatch()
    │     │
    │     ├─► MatchingService.matchWaitingUsers()
    │     │     │
    │     │     └─► Supabase (active_calls, waiting_users)
    │     │
    │     └─► MatchingService.checkForMatch()
    │           │
    │           └─► Supabase (active_calls)
    │
    └─► handleSkip()
          │
          └─► MatchingService.skipUser()
                │
                └─► Supabase (waiting_users)

MatchConfirmScreen
    │
    ├─► handleAccept()
    │     │
    │     └─► MatchingService.acceptMatch()
    │           │
    │           └─► Supabase (active_calls)
    │
    ├─► handleReject()
    │     │
    │     └─► MatchingService.rejectMatch()
    │           │
    │           └─► Supabase (active_calls, waiting_users)
    │
    └─► Poll for other user's response
          │
          └─► Supabase (active_calls)

CallPage
    │
    ├─► Jitsi WebView
    │     │
    │     └─► Jitsi Meet (Video Conference)
    │
    └─► handleCallEnd()
          │
          └─► MatchingService.endCall()
                │
                └─► Supabase (active_calls, waiting_users)
```

## State Management Flow

```
HomeScreen State:
  - isWaiting: boolean (user is waiting for match)
  - waitingCheckInterval: interval ID (polling)
  - currentUserProfile: object (user's profile)
  - loading: boolean (loading state)

MatchConfirmScreen State:
  - loading: boolean (loading state)
  - currentUser: object (current user data)
  - timeLeft: number (countdown timer)
  - waitingForOther: boolean (waiting for other user)

CallPage State:
  - callEnded: boolean (call has ended)
  - currentUser: object (current user data)
  - callTimerRef: ref (3-minute timer)
  - appStateRef: ref (app state listener)
```

## Error Handling Flow

```
Error Occurs
    │
    ├─► Database Error
    │     │
    │     ├─► Constraint Violation
    │     │     │
    │     │     └─► Show Alert: "Failed to join queue"
    │     │
    │     ├─► Connection Error
    │     │     │
    │     │     └─► Show Alert: "Connection failed"
    │     │
    │     └─► Query Error
    │           │
    │           └─► Log error, retry
    │
    ├─► Permission Error
    │     │
    │     ├─► Camera Permission
    │     │     │
    │     │     └─► Request permission
    │     │
    │     └─► Microphone Permission
    │           │
    │           └─► Request permission
    │
    ├─► Network Error
    │     │
    │     └─► Show Alert: "Check internet connection"
    │
    └─► Jitsi Error
          │
          └─► Show Alert: "Video call failed"
```

This architecture ensures:
- ✅ Scalable matching system
- ✅ Real-time user matching
- ✅ Reliable video calls
- ✅ Proper error handling
- ✅ Clean data management
- ✅ Good user experience
