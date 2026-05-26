# 🔧 Fix User Count - Quick Guide

## Problem
- Shows "8 users online" but only 2 users are actually there
- Old/stuck records in database

## Solution

### Step 1: Clean Database NOW
Run this in Supabase SQL Editor:

```sql
DELETE FROM public.waiting_users;
DELETE FROM public.active_calls;
```

### Step 2: Test
1. Open app on 2 devices
2. Both click "Find Random Match"
3. Should show: **"2 users online"** ✅

### Step 3: Verify Auto-Cleanup
1. Accept match → Go to browser
2. Wait 30 seconds
3. Records automatically deleted ✅
4. User count updates to 0 ✅

## How It Works Now

### Auto-Cleanup (30 seconds):
```
User goes to browser
    ↓
30-second timer starts
    ↓
Records deleted automatically
    ↓
User count updated
```

### User Count:
```
Only counts records from last 2 minutes
= Accurate count of real users online
```

## Quick Test

```bash
# Before cleanup:
👥 Users online: 8 (wrong!)

# After running SQL:
👥 Users online: 0 (correct!)

# With 2 users searching:
👥 Users online: 2 (correct!)
```

## Files Changed
- ✅ CallPage.js - Auto-cleanup after 30s
- ✅ HomePage.js - Count only recent records (2 min)

## SQL to Run
File: `CLEAN_NOW.sql`

```sql
DELETE FROM public.waiting_users;
DELETE FROM public.active_calls;
```

🎉 **That's it! User count will be accurate now.**
