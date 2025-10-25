# Person Confession Notification System

## Overview
When a user posts a confession about a person, the person (or their profile creator) receives a notification. Clicking the notification takes them to the ConfessionPersonScreen and highlights the specific confession.

## Implementation Details

### 1. Notification Creation (ConfessionPersonScreen.js)

**When**: After successfully posting a person confession (lines 1122-1201)

**Logic**:
1. Check if the person being confessed about is an actual user (ID exists in `profiles` table)
   - If YES → Notify that user
   - If NO → Check if there's a `person_profiles` entry with a creator, notify the creator

2. Create notification with:
   - `type`: `'person_confession'`
   - `content`: Dynamic message showing who posted and confession preview
   - `reference_id`: The confession ID (bigint)
   - `post_id`: The person ID (as string) for navigation
   - `sender_id`: The confessor's ID (null if anonymous)
   - `recipient_id`: The person or creator who should be notified

**Example Notification Content**:
- For users: "john_doe posted a confession about you: 'You are amazing...'"
- For non-users: "john_doe posted a confession about Jane Smith: 'You are amazing...'"
- Anonymous: "Someone posted a confession about you: 'You are amazing...'"

### 2. Notification Display (NotificationsScreen.js)

**Icon**: Person icon with red color (`#ff6b6b`) - Added at line 418-419

**Notification Item**: Shows:
- Sender's avatar (or anonymous placeholder if sender_id is null)
- Notification content
- Person icon overlay
- Time ago

### 3. Notification Click Handler (NotificationsScreen.js)

**When**: User clicks on a `person_confession` notification (lines 278-293)

**Navigation Flow**:
1. Extract `reference_id` (confession ID) and `post_id` (person ID)
2. Parse person ID from string to integer
3. Navigate to `ConfessionPerson` screen with params:
   - `selectedConfessionId`: The specific confession to show
   - `personId`: The person being confessed about

### 4. Confession Display (ConfessionPersonScreen.js)

**When**: Screen receives `selectedConfessionId` param (lines 216-314)

**Flow**:
1. Fetch the specific confession by ID
2. Load the person's profile
3. Set the selected person
4. Load all confessions for that person
5. Scroll to the specific confession (optional, currently commented out)

## Database Schema

### Notifications Table
```sql
{
  recipient_id: uuid,          -- Who receives the notification
  sender_id: uuid (nullable),  -- Who sent it (null if anonymous)
  type: 'person_confession',   -- Notification type
  content: text,               -- Display message
  reference_id: uuid,          -- Person ID (who was confessed about)
  post_id: text,               -- Confession ID as "confession_123" format
  is_read: boolean,            -- Read status
  created_at: timestamp        -- When created
}
```

### Person Confessions Table
```sql
{
  id: bigint,                  -- Auto-incrementing ID
  user_id: uuid (nullable),    -- Visible user (null if anonymous)
  creator_id: uuid,            -- Actual creator (always set)
  person_id: uuid,             -- Person being confessed about
  person_name: text,           -- Person's name
  content: text,               -- Confession content
  media: jsonb,                -- Media attachments
  is_anonymous: boolean,       -- Anonymous flag
  created_at: timestamp        -- When created
}
```

### Person Profiles Table
```sql
{
  id: uuid,                    -- Profile ID
  name: text,                  -- Person's name
  profile_image: text,         -- Avatar URL
  bio: text,                   -- Description
  created_by: uuid,            -- Who created this profile
  created_at: timestamp        -- When created
}
```

## User Experience Flow

### Scenario 1: Confession about an actual user
1. Alice posts a confession about Bob (who is a user)
2. Bob receives notification: "Alice posted a confession about you: '...'"
3. Bob clicks notification
4. Navigates to ConfessionPersonScreen showing the confession about him
5. Bob can see the confession content and attached media

### Scenario 2: Confession about a non-user person profile
1. Alice posts a confession about "Jane Smith" (a person_profile created by Bob)
2. Bob (the creator) receives notification: "Alice posted a confession about Jane Smith: '...'"
3. Bob clicks notification
4. Navigates to ConfessionPersonScreen showing the confession about Jane Smith
5. Bob can see the confession content

### Scenario 3: Anonymous confession
1. Anonymous user posts a confession about Bob
2. Bob receives notification: "Someone posted a confession about you: '...'"
3. Bob clicks notification
4. Navigates to ConfessionPersonScreen showing the anonymous confession
5. Bob can see the confession but not who posted it

## Key Features

✅ **Smart Recipient Detection**: Automatically determines who should receive the notification (the person themselves or the profile creator)

✅ **Anonymous Support**: Respects anonymity settings while still delivering notifications

✅ **Deep Linking**: Clicking notification navigates directly to the specific confession

✅ **Context Preservation**: Shows the confession within the person's profile context

✅ **Real-time Updates**: Uses Supabase real-time subscriptions for instant notification delivery

✅ **Auto-cleanup**: Notifications are automatically deleted after 7 days

## Testing Checklist

- [ ] Post a confession about a user → User receives notification
- [ ] Post a confession about a non-user person → Creator receives notification
- [ ] Post anonymous confession → Recipient receives notification with "Someone"
- [ ] Click notification → Navigates to correct confession
- [ ] Verify notification icon shows correctly
- [ ] Verify notification content is properly formatted
- [ ] Test with multiple confessions to ensure correct one is shown
- [ ] Verify notifications are marked as read when clicked
- [ ] Check that old notifications are deleted after 7 days

## Files Modified

1. **ConfessionPersonScreen.js**
   - Added `user_id` field to person_profiles query (line 1131)
   - Updated notification recipient logic (lines 1125-1153)
   - Fixed notification content message (line 1172)

2. **NotificationsScreen.js**
   - Added `person_confession` icon (lines 418-419)
   - Navigation handler already existed (lines 278-293)

## Notes

- The confession ID is stored as `bigint` (not UUID as the old comment suggested)
- Person ID is stored as string in `post_id` field and parsed to integer for navigation
- The system gracefully handles cases where person profiles don't exist or creators are not found
- Notifications respect the user's anonymity preference
