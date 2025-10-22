# Fix Delete Conversation - Complete Guide 🔧

## ⚠️ Problem
When deleting a conversation, messages were still visible because:
1. **RLS Policy** - Supabase Row Level Security was blocking delete operations
2. **Cache** - AsyncStorage was keeping old messages cached
3. **Both Sides** - Messages weren't being deleted from the other user's view

---

## ✅ Solution Applied

### 1. **Fixed Delete Query**
- Deletes messages where you are the sender
- Deletes messages where you are the receiver
- Ensures both sides of conversation are deleted

### 2. **Clear Cache**
- Clears conversation cache: `conversation_${conversationId}`
- Clears conversations list cache: `conversations_cache`
- Ensures no old messages show up

### 3. **RLS Policy (MUST RUN IN SUPABASE)**
You need to run this SQL in Supabase to allow deletions:

---

## 🚀 STEP 1: Run This SQL in Supabase

Go to **Supabase Dashboard → SQL Editor** and run:

```sql
-- Enable Row Level Security on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete messages in their conversations" ON messages;

-- Create a policy that allows users to delete messages where they are either sender or receiver
CREATE POLICY "Users can delete messages in their conversations"
ON messages
FOR DELETE
USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);
```

---

## 🧪 STEP 2: Test the Feature

### Test Flow:
1. **Send messages** to someone
2. **Long press** the conversation in Messages screen
3. Tap **"Delete Conversation"**
4. Confirm deletion
5. ✅ **Check your screen** - conversation should disappear
6. ✅ **Check their screen** - conversation should disappear
7. ✅ **Check database** - messages should be deleted

### What Should Happen:
- ❌ Conversation disappears from **your** Messages screen
- ❌ Conversation disappears from **their** Messages screen
- ❌ Messages deleted from **database**
- ❌ Cache cleared
- ✅ If you message them again, starts fresh

---

## 🔍 How It Works Now

### When You Delete:
```javascript
1. Delete messages where sender_id = you AND receiver_id = them
2. Delete messages where sender_id = them AND receiver_id = you
3. Clear AsyncStorage cache for conversation
4. Clear AsyncStorage cache for conversations list
5. Refresh conversations list
6. Show success message
```

### Database Operations:
```sql
-- Delete messages you sent
DELETE FROM messages 
WHERE sender_id = 'your_id' 
  AND receiver_id = 'their_id';

-- Delete messages they sent
DELETE FROM messages 
WHERE sender_id = 'their_id' 
  AND receiver_id = 'your_id';
```

---

## ⚡ Why It Works Now

### Before:
- ❌ Complex OR query didn't work
- ❌ RLS policy blocked deletions
- ❌ Cache kept showing old messages
- ❌ Only deleted from one side

### After:
- ✅ Two simple delete queries
- ✅ RLS policy allows deletions
- ✅ Cache is cleared
- ✅ Deletes from both sides

---

## 📝 Important Notes

1. **Must run the SQL** in Supabase first
2. **Both users** will lose all messages
3. **Cannot be undone** - messages are permanently deleted
4. **Cache is cleared** - no old messages will show
5. **Fresh start** - can message again with clean slate

---

## 🎯 Summary

**What to do:**
1. Run the SQL in Supabase (see STEP 1)
2. Test deleting a conversation
3. Verify messages are gone from both sides
4. Verify messages are deleted from database

**What happens:**
- Messages deleted from database ✅
- Cache cleared ✅
- Conversation removed from both users ✅
- Can start fresh conversation ✅

---

## 🐛 Troubleshooting

### If messages still show:
1. Check if SQL was run in Supabase
2. Check console logs for errors
3. Try force closing and reopening app
4. Check Supabase dashboard to verify messages are deleted

### If delete fails:
1. Check RLS policy is created
2. Check user is authenticated
3. Check network connection
4. Check console for error messages
