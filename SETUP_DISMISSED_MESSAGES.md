# Setup: Dismissed Messages Feature

## Overview
This feature allows users to clear message notifications locally without sending read receipts to the sender. The notification count persists across app refreshes.

## Database Setup

### Step 1: Run the SQL Migration
Execute the SQL file in your Supabase dashboard:

```bash
# File: supabase/add_dismissed_column.sql
```

Go to Supabase Dashboard → SQL Editor → Run the migration

### Step 2: Verify Column Added
Check that the `dismissed_by` column exists in the `messages` table:
- Type: `jsonb`
- Default: `'[]'::jsonb`
- Index: `idx_messages_dismissed_by` (GIN index)

## How It Works

### 1. **Read Receipts ON** (Default)
- Long-press chat → "Mark as Read"
- ✅ Clears notification count
- ✅ Marks messages as `read = true` in database
- ✅ Sender sees blue tick
- ✅ Persists across refresh

### 2. **Read Receipts OFF**
- Long-press chat → "Mark as Read"
- ✅ Clears notification count
- ✅ Adds user ID to `dismissed_by` array
- ❌ Does NOT mark as `read = true`
- ❌ Sender does NOT see blue tick
- ✅ Persists across refresh

## Code Changes Made

### 1. MessageContext.js
- `fetchUnreadCount()` - Filters out dismissed messages
- `clearLocalUnreadCount()` - Adds user to `dismissed_by` array
- `markConversationAsRead()` - Checks read receipt settings

### 2. MessagesScreen.js
- Updated unread count logic to exclude dismissed messages
- Filters `dismissed_by` when counting unread

### 3. MessageScreen.js
- Blue tick only shows when `currentUserReadReceipts` is true

## Testing

### Test Case 1: Read Receipts OFF
1. Turn off "Show that you read the message" in MessageSettings
2. Receive a message
3. Long-press conversation → "Mark as Read"
4. Verify notification count = 0
5. Refresh app
6. ✅ Notification count should still be 0
7. ✅ Sender should NOT see blue tick

### Test Case 2: Read Receipts ON
1. Turn on "Show that you read the message" in MessageSettings
2. Receive a message
3. Long-press conversation → "Mark as Read"
4. Verify notification count = 0
5. Refresh app
6. ✅ Notification count should still be 0
7. ✅ Sender should see blue tick

## Database Query Examples

### Check dismissed messages for a user
```sql
SELECT * FROM messages 
WHERE dismissed_by ? 'user-id-here'
AND read = false;
```

### Count undismissed unread messages
```sql
SELECT COUNT(*) FROM messages 
WHERE receiver_id = 'user-id-here'
AND read = false
AND NOT (dismissed_by ? 'user-id-here');
```

### Clear dismissed status (for testing)
```sql
UPDATE messages 
SET dismissed_by = '[]'::jsonb 
WHERE receiver_id = 'user-id-here';
```

## Privacy & Security

- ✅ Dismissed status is per-user (stored in array)
- ✅ Sender never knows if receiver dismissed notification
- ✅ Read receipts remain optional and user-controlled
- ✅ No data leakage between users
- ✅ Works with existing RLS policies

## Performance

- GIN index on `dismissed_by` for fast lookups
- Minimal overhead (single JSONB column)
- Efficient filtering in queries
