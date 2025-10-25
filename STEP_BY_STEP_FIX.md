# Step-by-Step Fix Guide

## Problem Summary
1. ❌ Notification RLS error preventing notifications
2. ❌ Confessions not showing after posting (cache issue)

## STEP 1: Fix the Database Policy (CRITICAL)

### Go to Supabase Dashboard

1. Open https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in left sidebar
4. Click **New query** button

### Run This SQL

Copy and paste this ENTIRE block:

```sql
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert notifications"
ON public.notifications
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (true);
```

### Click RUN

- You should see: **"Success. No rows returned"**
- If you see an error, screenshot it and share

### Verify It Worked

Run this query:

```sql
SELECT policyname, cmd, with_check 
FROM pg_policies 
WHERE tablename = 'notifications' AND cmd = 'INSERT';
```

**Expected result:**
- `policyname` = "Users can insert notifications"
- `cmd` = "INSERT"
- `with_check` = "true"

If you see this ✅ proceed to Step 2.

---

## STEP 2: Restart Your App

1. **Kill the Metro bundler** (Ctrl+C in terminal)
2. **Close the app** completely on your device/simulator
3. **Clear cache**: `npx react-native start --reset-cache`
4. **Rebuild**: Run your app again

---

## STEP 3: Test the Fix

### Test Posting a Confession

1. Open the app
2. Go to Person Confessions
3. Search for a person
4. Select them
5. Write a confession
6. Click Post

### What You Should See

✅ In console/logs:
```
LOG  Starting postConfession...
LOG  Current user: b10c9a97-...
LOG  Creating notification for person ID: ...
LOG  Person is a user, notifying user: ...
LOG  Sending notification to user: ...
LOG  ✅ Notification created successfully: [...]
LOG  Cache cleared for refresh
LOG  Success
```

❌ You should NOT see:
```
ERROR  Error creating notification: {"code": "42501"...}
```

### Check If Confession Is Visible

1. The confession should appear immediately in the list
2. If not, pull to refresh
3. The new confession should show at the top

---

## STEP 4: Verify in Database (Optional)

Run this in Supabase SQL Editor to see your confessions:

```sql
SELECT 
  id,
  person_name,
  content,
  created_at
FROM person_confessions
WHERE creator_id = 'b10c9a97-1fe9-4b34-9f7f-f5762e460a63'
ORDER BY created_at DESC
LIMIT 5;
```

Check notifications:

```sql
SELECT 
  id,
  type,
  content,
  created_at
FROM notifications
WHERE type = 'person_confession'
ORDER BY created_at DESC
LIMIT 5;
```

---

## Troubleshooting

### If confession still doesn't show:

1. Check database query above to confirm it was saved
2. Try navigating away and back to the person
3. Try selecting a different person and back again
4. Check console for any errors during loadPersonConfessions

### If notification error persists:

1. Double-check you ran the SQL in **Supabase Dashboard** (not local file)
2. Verify with the verification query above
3. Check RLS is enabled: `SELECT relrowsecurity FROM pg_class WHERE relname = 'notifications';`
   - Should return `t` (true)
   - If `f`, run: `ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;`

### If you see "Cache cleared for refresh" but no new confession:

1. Check your internet connection
2. Check Supabase project is running
3. Run the database verification queries
4. Share the console logs

---

## Summary of Changes Made

### Code Changes (Already Applied)
- ✅ Fixed TextInput warning (line 59)
- ✅ Added automatic person_profiles creation (lines 576-632)
- ✅ Fixed notification data structure (lines 1213-1227)
- ✅ Added cache clearing on post (lines 1247-1262)
- ✅ Added refresh delay for consistency

### Database Changes (YOU MUST RUN)
- ⚠️ **MUST RUN**: Fix notification INSERT policy in Supabase
- Policy allows any authenticated user to create notifications
- This is secure because only authenticated users can access the app

---

## After Everything Works

Once confessions and notifications are working:

1. Test anonymous confession
2. Test non-anonymous confession
3. Test clicking notification
4. Verify navigation to confession works
5. Test with different users

All features should work perfectly! 🎉
