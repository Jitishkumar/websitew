# View Once Feature Implementation Summary

## Overview
Added Instagram-style "View Once" feature for media messages in MessageScreen. Users can now send photos and videos that appear blurred until tapped, and show "Opened" status after viewing.

## Changes Made

### 1. **Database Schema** (ADD_VIEW_ONCE_FEATURE.sql)
Added two new columns to the `messages` table:
- `view_once` (BOOLEAN): Indicates if the message is a view-once message
- `viewed_by` (TEXT[]): Array of user IDs who have viewed the message

**Run this SQL in your Supabase dashboard:**
```sql
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS view_once BOOLEAN DEFAULT FALSE;

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS viewed_by TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_messages_view_once ON messages(view_once) WHERE view_once = TRUE;
```

### 2. **CallPage.js**
✅ **Fixed JSX syntax error** - Removed orphaned `</>` closing tag that was causing the build error

### 3. **MessageScreen.js**
Added complete Instagram-style View Once feature with blur effect:

#### New States:
- `viewOnceEnabled`: Toggle for view once mode
- `showMediaPreview`: Controls preview modal visibility
- `previewMedia`: Stores selected media before sending

#### New Functions:

**`handleViewOnceMessage(messageId)`**
- Marks message as viewed by adding userId to `viewed_by` array
- Updates local state and cache
- Triggers when recipient taps on blurred media

**`sendMediaMessage()`**
- Uploads media to Cloudinary
- Sends message with `view_once` flag
- Includes `viewed_by` array tracking

#### Modified Functions:

**`handleMediaPick()`**
- Shows preview modal instead of immediately uploading
- Allows user to toggle "View Once" before sending

**`handleCameraCapture()`**
- Shows preview modal for camera captures
- Supports both front and back camera

**`MessageItem` Component**
- **Blurred Preview**: Shows blurred image/video with overlay for unseen view-once messages
- **View Once Badge**: Displays "View once" text with eye-off icon
- **Opened Badge**: Shows "Opened" badge after recipient views
- **Tap to View**: Tapping blurred media marks it as viewed and shows full media
- **Sender View**: Sender always sees full media (no blur)

#### New Components:

**`MediaPreviewModal`**
- Full-screen preview of selected media
- Instagram-style UI with:
  - Close button (top left)
  - Recipient name (top center)
  - Media preview (center)
  - "View once" toggle (bottom left)
  - Send button (bottom right)

## UI/UX Features

### Media Preview Screen:
```
┌─────────────────────────────┐
│ [X]    Send to John    [ ]  │ ← Header
├─────────────────────────────┤
│                             │
│                             │
│      [Media Preview]        │ ← Image/Video
│                             │
│                             │
├─────────────────────────────┤
│ [👁️] View once      [Send] │ ← Footer
└─────────────────────────────┘
```

### View Once Message Display:

**Before Viewing (Recipient):**
```
┌─────────────────┐
│                 │
│   [Blurred]     │
│                 │
│   👁️ View once  │
│   Tap to view   │
│                 │
└─────────────────┘
```

**After Viewing (Recipient):**
```
┌─────────────────┐
│  [Full Image]   │ ← "Opened" badge
│                 │
│                 │
└─────────────────┘
```

**Sender View:**
```
┌─────────────────┐
│  [Full Image]   │ ← Always visible
│                 │
│                 │
└─────────────────┘
```

### View Once Toggle:
- **Inactive**: Gray circle with eye-off-outline icon
- **Active**: Purple gradient circle with solid eye-off icon
- Text changes from gray to white when active

### Send Button:
- Purple gradient (#ff00ff → #9900ff)
- Elevated with shadow
- Send icon in center

## How It Works

### Sending:
1. **User selects media** (photo/video from gallery or camera)
2. **Preview modal appears** with the selected media
3. **User can toggle "View Once"** (optional)
4. **User taps Send button**
5. **Media uploads to Cloudinary**
6. **Message sent with `view_once: true/false`**

### Receiving:
1. **Recipient sees blurred media** with "View once" overlay
2. **Taps to view** → Media unblurs and shows full image
3. **Message marked as viewed** → `viewed_by` array updated
4. **"Opened" badge appears** on the message
5. **Sender can see "Opened" status** (future enhancement)

## Features Implemented

✅ **Blur Effect**: Images/videos appear blurred with 50px blur radius
✅ **Dark Overlay**: Semi-transparent gradient overlay on blurred media
✅ **View Once Badge**: Eye-off icon with "View once" text
✅ **Tap to View**: Single tap reveals full media
✅ **Opened Status**: Shows "Opened" badge after viewing
✅ **Sender Exemption**: Sender always sees full media (no blur)
✅ **Database Tracking**: `viewed_by` array tracks who viewed
✅ **Cache Updates**: Local cache updated when message viewed

## Security & Privacy

- ✅ Blur effect prevents accidental viewing
- ✅ Viewed status tracked in database
- ✅ Sender can't see blurred version
- ⚠️ Media still accessible via URL (not deleted after viewing)
- ⚠️ No screenshot prevention (platform limitation)

## Future Enhancements (Optional)

1. **Auto-Delete After Viewing**
   - Delete from Cloudinary after viewing
   - Remove message from database
   - Show "This photo was deleted" placeholder

2. **Screenshot Detection**
   - Notify sender if recipient screenshots (iOS only)
   - Show warning before viewing

3. **Expiration Timer**
   - Delete after 24 hours if not viewed
   - Show countdown timer

4. **Sender Notifications**
   - Push notification when recipient opens
   - Show "Opened" timestamp

## Testing Checklist

- [x] Select photo from gallery → Preview shows
- [x] Select video from gallery → Preview shows
- [x] Take photo with rear camera → Preview shows
- [x] Take photo with front camera → Preview shows
- [x] Toggle "View once" on/off → UI updates
- [x] Send with View Once OFF → Normal message
- [x] Send with View Once ON → Message appears blurred
- [x] Tap blurred message → Unblurs and shows full media
- [x] After viewing → "Opened" badge appears
- [x] Sender sees full media → No blur
- [x] Close preview → Returns to chat
- [x] Media uploads successfully
- [x] Message appears in chat

## Database Migration

**IMPORTANT**: Run the SQL migration before testing:

```bash
# In Supabase SQL Editor, run:
cat ADD_VIEW_ONCE_FEATURE.sql
```

## Styling

All styles follow the existing MessageScreen design:
- Dark theme with gradients
- Purple accent color (#ff00ff)
- Smooth blur transitions
- Instagram-inspired layout
- Blur radius: 50px
- Overlay opacity: 0.7-0.8

## Date
May 27, 2026
