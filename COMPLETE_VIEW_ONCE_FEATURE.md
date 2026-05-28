# Complete View Once Feature - Instagram/Snapchat Style

## Overview
Implemented complete Instagram/Snapchat-style "View Once" feature where media messages completely disappear after being viewed once by the recipient.

## How It Works

### 1. **Sending View Once Media**
- User selects photo/video from gallery or camera
- Preview modal appears with "View once" toggle
- When enabled, media is sent with `view_once: true` flag
- Media uploads to Cloudinary normally

### 2. **Receiving View Once Media**
- Recipient sees **blurred media** with "View once" overlay
- Shows eye-off icon with "Tap to view" text
- Media is completely blurred (50px blur radius)

### 3. **Viewing Process**
1. **Recipient taps** blurred media
2. **Media unblurs** and shows full image/video
3. **"Deleting..." badge** appears
4. **After 3 seconds**: 
   - Media deleted from Cloudinary
   - Message deleted from database
   - Message removed from both sender and receiver chats
5. **"This photo was deleted" placeholder** shows briefly
6. **Message completely disappears** from chat

### 4. **Sender Experience**
- Sender always sees full media (never blurred)
- After recipient views, message disappears from sender's chat too
- No "opened" notifications (message just vanishes)

## Database Schema

Your existing schema already has the required columns:
```sql
view_once BOOLEAN DEFAULT FALSE
viewed_by TEXT[] DEFAULT '{}'
```

## Key Features Implemented

### ✅ **Complete Deletion**
- Message deleted from database
- Media deleted from Cloudinary
- Removed from both sender and receiver chats
- Cache updated on both devices

### ✅ **Blur Effect**
- 50px blur radius on images
- Dark gradient overlay
- Eye-off icon with "View once" text
- "Tap to view" instruction

### ✅ **Viewing Experience**
- 3-second viewing window
- "Deleting..." badge during countdown
- Smooth transition to deletion
- "This photo was deleted" placeholder

### ✅ **Security**
- Media completely removed from server
- No way to recover after viewing
- Sender can't see media after recipient views

## User Flow

### Sending:
```
Select Media → Preview → Toggle "View Once" → Send
```

### Receiving:
```
See Blurred → Tap to View → View for 3s → Message Deleted
```

### Visual States:

**1. Blurred (Before Viewing):**
```
┌─────────────────┐
│   [Blurred]     │
│                 │
│   👁️ View once  │
│   Tap to view   │
└─────────────────┘
```

**2. Viewing (3 seconds):**
```
┌─────────────────┐
│  [Full Image]   │ ← "Deleting..." badge
│                 │
│                 │
└─────────────────┘
```

**3. Deleted:**
```
┌─────────────────┐
│       👁️        │
│ This photo was  │
│    deleted      │
└─────────────────┘
```

**4. Completely Gone:**
```
(Message removed from chat)
```

## Code Implementation

### Key Functions:

**`handleViewOnceMessage(messageId)`**
- Shows media for 3 seconds
- Deletes from Cloudinary
- Deletes from database
- Removes from local state
- Updates cache

**`sendMediaMessage()`**
- Uploads with view_once flag
- Sends to database with metadata

**Media Rendering Logic:**
- Checks `isViewOnce` and `hasBeenViewed`
- Shows blur overlay for unviewed messages
- Shows deletion placeholder for deleted messages
- Handles sender vs receiver permissions

## Security & Privacy

### ✅ **Implemented:**
- Complete server-side deletion
- Media removed from Cloudinary
- Database record deleted
- Local cache cleared
- No recovery possible

### ⚠️ **Platform Limitations:**
- Can't prevent screenshots (iOS/Android limitation)
- Can't prevent screen recording
- User could airplane mode before deletion (rare edge case)

## Testing Checklist

### Sending:
- [x] Select photo → Preview shows
- [x] Toggle "View once" ON → UI updates
- [x] Send → Message appears in chat
- [x] Sender sees full image (no blur)

### Receiving:
- [x] Recipient sees blurred image
- [x] Shows "View once" overlay
- [x] Tap to view → Unblurs
- [x] Shows "Deleting..." badge
- [x] After 3 seconds → Message deleted
- [x] Shows "This photo was deleted" briefly
- [x] Message completely disappears

### Database:
- [x] Message deleted from `messages` table
- [x] Media deleted from Cloudinary
- [x] Both sender and receiver lose access

## Performance

- **Blur Effect**: Uses native `blurRadius` prop (hardware accelerated)
- **Deletion**: Async operations don't block UI
- **Cache**: Updated immediately for smooth UX
- **Memory**: Deleted messages removed from state

## Error Handling

- **Cloudinary deletion fails**: Message still deleted from database
- **Database deletion fails**: User sees error, message remains
- **Network issues**: Deletion retried on next app launch
- **Cache corruption**: Rebuilt from database on next load

## Comparison with Instagram/Snapchat

| Feature | Instagram | Snapchat | Our Implementation |
|---------|-----------|----------|-------------------|
| Blur before viewing | ✅ | ✅ | ✅ |
| Complete deletion | ✅ | ✅ | ✅ |
| Server-side removal | ✅ | ✅ | ✅ |
| Screenshot detection | ✅ | ✅ | ❌ (Platform limitation) |
| Viewing time limit | ❌ | ✅ | ✅ (3 seconds) |
| Sender notification | ❌ | ✅ | ❌ (Privacy focused) |

## Future Enhancements (Optional)

1. **Screenshot Detection** (iOS only)
2. **Replay Once** option
3. **Custom viewing duration**
4. **Sender notifications**
5. **View once for text messages**

## Date
May 27, 2026

---

**Status: ✅ COMPLETE**
The View Once feature is now fully implemented with true disappearing messages that delete completely after viewing, just like Instagram and Snapchat.