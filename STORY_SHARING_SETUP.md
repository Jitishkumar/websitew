# Story Sharing Feature Setup Guide

## Overview
Instagram-style story sharing feature that allows users to reshare content to their story with resizable positioning and username attribution.

## Features Implemented

### 1. **Share to Your Story Button**
- Added prominent button in `ShareUserSelectionScreen`
- Beautiful gradient design with icon
- Navigates to story creation screen

### 2. **Story Creation Screen**
- **Resizable Content**: Pinch-to-zoom with +/- buttons (30% to 150% scale)
- **Draggable Positioning**: Touch and drag to reposition shared content
- **Username Attribution**: Original creator's username displayed on shared content
- **Real-time Preview**: See exactly how your story will look
- **Smooth Animations**: Professional spring animations for scaling

### 3. **Database Integration**
- Tracks original content creator
- Stores position and scale preferences
- Links shared stories to original posts

## Database Setup

### Step 1: Run SQL Migration
Execute in Supabase SQL Editor:

```bash
# File: supabase/add_story_sharing_columns.sql
```

This adds the following columns to `stories` table:
- `shared_from_user_id` - UUID of original creator
- `shared_from_username` - Username for display
- `position_x` - X coordinate of shared content
- `position_y` - Y coordinate of shared content
- `scale` - Zoom level (0.3 to 1.5)
- `caption` - Optional story caption

### Step 2: Verify Columns
Check that all columns exist:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'stories';
```

## Files Created/Modified

### New Files:
1. **`src/screens/StoryCreationScreen.js`**
   - Main story creation interface
   - Drag and resize functionality
   - Publish to story logic

2. **`supabase/add_story_sharing_columns.sql`**
   - Database migration for new columns

3. **`STORY_SHARING_SETUP.md`**
   - This documentation file

### Modified Files:
1. **`src/screens/ShareUserSelectionScreen.js`**
   - Added "Share to Your Story" button
   - Navigation to story creation

2. **`src/services/StoriesService.js`**
   - Added `createStory()` method
   - Handles shared story creation

3. **`src/navigation/AppNavigator.js`**
   - Added StoryCreation route
   - Imported StoryCreationScreen

## User Flow

### Sharing Flow:
1. User taps share icon on any post/reel
2. ShareUserSelectionScreen opens
3. User sees "Share to Your Story" button at top
4. Taps button → navigates to StoryCreationScreen
5. User can:
   - Drag content to reposition
   - Tap +/- to resize (30%-150%)
   - See real-time preview
6. Tap "Share to Story" → publishes to their story
7. Success alert → returns to Home

### Viewing Flow:
1. Shared stories appear in story circles
2. Username of original creator shown on content
3. Content positioned and scaled as user configured
4. 24-hour expiration (standard story behavior)

## Technical Details

### Positioning System:
- **X/Y Coordinates**: Absolute positioning in pixels
- **Scale**: Float value (0.3 = 30%, 1.5 = 150%)
- **Default**: Center of screen at 60% scale

### Animation System:
- **Pan Responder**: Native touch handling for dragging
- **Animated.Value**: Smooth spring animations
- **Real-time Updates**: Immediate visual feedback

### Story Grouping:
- Shared stories added to user's existing 24h story group
- If no active stories, creates new group
- Maintains chronological order

## Testing Checklist

### Test Case 1: Share Post to Story
- [ ] Open any post
- [ ] Tap share icon
- [ ] Tap "Share to Your Story"
- [ ] Drag content around screen
- [ ] Resize with +/- buttons
- [ ] Verify username shows at bottom
- [ ] Tap "Share to Story"
- [ ] Verify success message
- [ ] Check story appears in story circles

### Test Case 2: Share Reel to Story
- [ ] Open any reel
- [ ] Tap share icon
- [ ] Tap "Share to Your Story"
- [ ] Verify video thumbnail shows
- [ ] Position and resize
- [ ] Publish to story
- [ ] Verify video plays in story viewer

### Test Case 3: Multiple Shares
- [ ] Share multiple posts to story
- [ ] Verify all added to same 24h group
- [ ] Check chronological order
- [ ] Verify each has correct attribution

### Test Case 4: Story Viewing
- [ ] View own shared story
- [ ] Verify content positioned correctly
- [ ] Verify scale applied correctly
- [ ] Verify username visible
- [ ] Check 24h expiration

## Customization Options

### Adjust Scale Limits:
```javascript
// In StoryCreationScreen.js
const handleScaleIncrease = () => {
  const newScale = Math.min(scale + 0.1, 2.0); // Change 1.5 to 2.0 for 200%
  // ...
};
```

### Change Default Position:
```javascript
// In StoryCreationScreen.js
const [position, setPosition] = useState({ 
  x: width / 2 - 100,  // Adjust X
  y: height / 3        // Adjust Y (change from height/2)
});
```

### Modify Button Colors:
```javascript
// In ShareUserSelectionScreen.js styles
shareToStoryButton: {
  shadowColor: '#ff00ff', // Change glow color
  // ...
}
```

## Troubleshooting

### Issue: "Column does not exist"
**Solution**: Run the SQL migration in Supabase dashboard

### Issue: Navigation error
**Solution**: Restart Metro bundler with cache clear:
```bash
npx react-native start --reset-cache
```

### Issue: Content not draggable
**Solution**: Check PanResponder is enabled and not blocked by parent ScrollView

### Issue: Username not showing
**Solution**: Verify `sharePayload.author.username` exists in share data

## Future Enhancements

### Potential Features:
- [ ] Add text/stickers to story
- [ ] Multiple items per story
- [ ] Story templates
- [ ] Background color picker
- [ ] Music/audio integration
- [ ] Polls and questions
- [ ] Story highlights (permanent stories)
- [ ] Story analytics (views, replies)

## API Reference

### StoriesService.createStory()
```javascript
const result = await StoriesService.createStory({
  media_url: string,           // Required: URL of shared content
  media_type: 'image'|'video', // Required: Content type
  caption: string,             // Optional: Story caption
  shared_from_user_id: uuid,   // Optional: Original creator ID
  shared_from_username: string,// Optional: Original creator username
  position_x: number,          // Optional: X coordinate
  position_y: number,          // Optional: Y coordinate
  scale: number,               // Optional: Scale (0.3-1.5)
});

// Returns: { success: boolean, data?: object, error?: string }
```

## Support

For issues or questions:
1. Check this documentation
2. Review console logs for errors
3. Verify database migration ran successfully
4. Test with simple content first
5. Check navigation routes are registered

## Version History

- **v1.0** (2025-10-08): Initial release
  - Basic share to story functionality
  - Drag and resize
  - Username attribution
  - Database integration
