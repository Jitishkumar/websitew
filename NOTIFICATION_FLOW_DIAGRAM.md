# Person Confession Notification Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER POSTS CONFESSION                         │
│                  (ConfessionPersonScreen.js)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │ Check if person is user? │
              │ (Search in profiles)     │
              └────────┬─────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼ YES                     ▼ NO
    ┌──────────┐           ┌────────────────┐
    │ Notify   │           │ Check for      │
    │ that     │           │ person_profile │
    │ user     │           │ creator        │
    └────┬─────┘           └────────┬───────┘
         │                          │
         │                          ▼
         │                   ┌──────────────┐
         │                   │ Notify       │
         │                   │ creator      │
         │                   └──────┬───────┘
         │                          │
         └──────────┬───────────────┘
                    ▼
        ┌────────────────────────┐
        │ Create Notification    │
        │ type: person_confession│
        │ reference_id: confID   │
        │ post_id: personID      │
        └──────────┬─────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │ Real-time Notification Sent  │
    │   (Supabase Subscription)    │
    └──────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│              USER SEES NOTIFICATION                               │
│            (NotificationsScreen.js)                               │
│                                                                   │
│  ┌────────┐                                                      │
│  │ 👤     │  @alice posted a confession about you: "You are...   │
│  │        │  2m ago                                               │
│  └────────┘                                                      │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼ (User Clicks)
            ┌────────────────────────┐
            │ Extract reference_id   │
            │ Extract post_id        │
            │ Mark as read           │
            └──────────┬─────────────┘
                       │
                       ▼
              ┌────────────────┐
              │ Navigate to    │
              │ ConfessionPerson│
              │ with params    │
              └────────┬───────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│           CONFESSION DISPLAYED WITH CONTEXT                       │
│           (ConfessionPersonScreen.js)                             │
│                                                                   │
│  ┌────────────────────────────────────────┐                      │
│  │ Person Profile: John Doe               │                      │
│  │ ┌──────────────────────────────────┐  │                      │
│  │ │ @alice                            │  │                      │
│  │ │ You are amazing and talented!     │  │ ← Target Confession  │
│  │ │ ❤️ 5  💬 2                        │  │                      │
│  │ └──────────────────────────────────┘  │                      │
│  │                                        │                      │
│  │ ┌──────────────────────────────────┐  │                      │
│  │ │ @anonymous                        │  │                      │
│  │ │ Another confession...             │  │                      │
│  │ └──────────────────────────────────┘  │                      │
│  └────────────────────────────────────────┘                      │
└──────────────────────────────────────────────────────────────────┘
```

## Notification Content Examples

### Regular User Confession
```
@john_doe posted a confession about you: "You are so creative and..."
```

### Anonymous Confession
```
Someone posted a confession about you: "I've always admired your..."
```

### Non-User Person Profile
```
@john_doe posted a confession about Jane Smith: "She is incredible..."
```

## Icon Legend

- 👤 **Person Confession** - Red person icon (`#ff6b6b`)
- ❤️ **Like** - Pink heart icon
- 💬 **Comment** - Blue chat bubble icon
- 👥 **Follow** - Green person-add icon
- @ **Mention** - Yellow at icon

## Navigation Parameters

When navigating from notification to ConfessionPersonScreen:

```javascript
navigation.navigate('ConfessionPerson', {
  selectedConfessionId: notification.reference_id,  // bigint confession ID
  personId: parseInt(notification.post_id)          // uuid person ID
});
```

## Database Flow

```
┌─────────────────┐       ┌──────────────────┐       ┌────────────────┐
│ person_profiles │◄──────┤person_confessions│──────►│ notifications  │
│                 │       │                  │       │                │
│ - id (uuid)     │       │ - id (bigint)    │       │ - type         │
│ - name          │       │ - person_id      │       │ - reference_id │
│ - created_by    │       │ - creator_id     │       │ - post_id      │
│                 │       │ - content        │       │ - recipient_id │
└─────────────────┘       │ - is_anonymous   │       │ - sender_id    │
                          └──────────────────┘       └────────────────┘
                                   │
                                   │ triggers
                                   ▼
                          ┌──────────────────┐
                          │ Notification     │
                          │ Creation Logic   │
                          └──────────────────┘
```
