# 🎯 Visual Flow Diagram - Random Matching with Profile Photos

## 📱 User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                         HOME SCREEN                              │
│                                                                  │
│  [🎥 Video Camera Icon] ← Click to find random match            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    handleFindMatch()
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE OPERATIONS                           │
│                                                                  │
│  1. DELETE old records from waiting_users                       │
│  2. DELETE old records from active_calls                        │
│  3. INSERT user into waiting_users                              │
│  4. START polling every 2 seconds                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    MatchingService.matchWaitingUsers()
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    MATCHING ALGORITHM                            │
│                                                                  │
│  1. GET all waiting users                                       │
│  2. MATCH users in pairs                                        │
│  3. CREATE active_calls record:                                 │
│     - status = 'matched'                                        │
│     - user1_accepted = false                                    │
│     - user2_accepted = false                                    │
│  4. DELETE both users from waiting_users                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    checkForMatch() detects match
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              FETCH PROFILE DATA FROM DATABASE                    │
│                                                                  │
│  SELECT avatar_url, username FROM profiles                      │
│  WHERE id = other_user_id                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Navigate to MatchConfirmScreen
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   MATCH CONFIRMATION SCREEN                      │
│                                                                  │
│                    Match Found! 🎉                              │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │   ┌─────────┐                                            │ │
│  │   │  [📷]   │  ← Your profile photo from profiles table  │ │
│  │   └─────────┘                                            │ │
│  │   @your_username                                         │ │
│  │   your@email.com                                         │ │
│  │   You                                                    │ │
│  │                                                           │ │
│  │              VS                                           │ │
│  │                                                           │ │
│  │   ┌─────────┐                                            │ │
│  │   │  [📷]   │  ← Other user's photo from profiles table │ │
│  │   └─────────┘                                            │ │
│  │   @other_username                                        │ │
│  │   Matched User                                           │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Responding in: 28s                                             │
│  [████████████████░░░░░░░░] 93%                                │
│                                                                  │
│  [  Reject  ]              [  Accept  ]                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    User clicks "Accept"
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    UPDATE DATABASE                               │
│                                                                  │
│  UPDATE active_calls                                            │
│  SET user1_accepted = true (or user2_accepted = true)          │
│  WHERE id = call_id                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Check if both accepted
                              ↓
              ┌───────────────┴───────────────┐
              │                               │
         Only ONE                        BOTH ACCEPTED
         accepted                              │
              │                               │
              ↓                               ↓
┌──────────────────────────┐    ┌──────────────────────────┐
│  WAITING STATE           │    │  START CALL              │
│                          │    │                          │
│  "Waiting for other      │    │  UPDATE active_calls:    │
│   user to accept..."     │    │  - status = 'active'     │
│                          │    │  - started_at = now()    │
│  [Cancel]                │    │                          │
│                          │    │  Navigate to CallPage    │
│  Poll every 2 seconds    │    └──────────────────────────┘
│  Timeout after 30s       │                 │
└──────────────────────────┘                 │
              │                               │
              └───────────────┬───────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      VIDEO CALL PAGE                             │
│                                                                  │
│  Opens Jitsi Meet in Chrome Browser                             │
│  - Desktop mode enabled (720p HD)                               │
│  - Both users can see each other                                │
│  - Full video call features                                     │
│                                                                  │
│  [End Call & Return Home]                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    User ends call
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CLEANUP DATABASE                              │
│                                                                  │
│  1. DELETE from active_calls WHERE call_id = ...               │
│  2. DELETE from waiting_users WHERE user_id = user1_id         │
│  3. DELETE from waiting_users WHERE user_id = user2_id         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    WELCOME BACK DIALOG                           │
│                                                                  │
│  "Welcome back! Ready for another match?"                       │
│                                                                  │
│  [Find Another Match]                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Auto-start new match
                              ↓
                    (Loop back to top)
```

## 🗄️ Database Tables Used

### 1. **profiles** (Existing table)
```sql
┌──────────────────────────────────────┐
│           profiles                   │
├──────────────┬───────────────────────┤
│ id           │ uuid (primary key)    │
│ username     │ text                  │
│ avatar_url   │ text ← Profile photo  │
│ email        │ text                  │
│ full_name    │ text                  │
└──────────────┴───────────────────────┘
```

### 2. **waiting_users** (Queue table)
```sql
┌──────────────────────────────────────┐
│         waiting_users                │
├──────────────┬───────────────────────┤
│ id           │ uuid (primary key)    │
│ user_id      │ uuid (foreign key)    │
│ username     │ text                  │
│ call_id      │ text (unique)         │
│ status       │ text ('waiting')      │
│ created_at   │ timestamp             │
└──────────────┴───────────────────────┘
```

### 3. **active_calls** (Match table)
```sql
┌──────────────────────────────────────┐
│         active_calls                 │
├──────────────┬───────────────────────┤
│ id           │ uuid (primary key)    │
│ call_id      │ text (unique)         │
│ user1_id     │ uuid                  │
│ user1_name   │ text                  │
│ user2_id     │ uuid                  │
│ user2_name   │ text                  │
│ user1_accepted│ boolean ✨ NEW       │
│ user2_accepted│ boolean ✨ NEW       │
│ started_at   │ timestamp ✨ NEW      │
│ status       │ text                  │
│ room_url     │ text                  │
│ created_at   │ timestamp             │
│ ended_at     │ timestamp             │
└──────────────┴───────────────────────┘
```

## 🎯 Key Features

✅ **Profile Photos**: Fetched from `profiles.avatar_url`
✅ **Accept/Reject**: Both users must accept
✅ **Real-time Polling**: Checks every 2 seconds
✅ **Auto-cleanup**: Deletes old records automatically
✅ **Timeout**: 30-second countdown
✅ **Auto-match**: Starts new search after call ends

## 🚀 Ready to Use!

Just run `RUN_THIS_SQL.sql` in Supabase and test! 🎉
