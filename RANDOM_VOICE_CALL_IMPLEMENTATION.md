# 🎙️ Random Voice Call Implementation Guide (Like Wakie)

## 🎯 Why Voice Calls Are Better Than Video

### Advantages:
1. **Much Lower Bandwidth** - 10x less data usage than video
2. **Works on Slow Networks** - 2G/3G compatible
3. **More Privacy** - Users don't need to show their face
4. **Lower Battery Usage** - No camera processing
5. **Cheaper to Run** - Less server resources needed
6. **More Comfortable** - Users can call while doing other things
7. **Better for Shy Users** - No appearance pressure

### Use Cases (Like Wakie):
- **Wake-up calls** - Random strangers wake you up
- **Practice languages** - Talk with native speakers
- **Make friends** - Voice-only conversations
- **Vent/Talk** - Anonymous emotional support
- **Story time** - Listen to people's stories
- **Debate topics** - Discuss random topics

---

## 🆓 Free Solutions for Voice Calls

### Option 1: Jitsi Meet (Audio-Only Mode) ⭐ RECOMMENDED
**What you're already using!**

✅ **Completely FREE**
✅ **Already implemented in your app**
✅ **Just disable video!**

```javascript
// In your CallPage.js, just add audio-only parameter
const jitsiUrl = `https://meet.jit.si/${roomName}#config.startWithVideoMuted=true&config.startAudioOnly=true`;
```

**Pros:**
- Already working in your app
- Zero additional cost
- No setup needed
- Unlimited calls

**Cons:**
- Opens in browser (but that's fine for voice)
- Slightly heavier than pure audio solutions

---

### Option 2: Agora.io (Voice SDK) ⭐ BEST FOR NATIVE EXPERIENCE

**Free Tier:**
- 10,000 minutes/month FREE
- After that: $0.99 per 1,000 minutes
- Much cheaper than video

**Implementation:**
```bash
npm install react-native-agora
```

```javascript
// VoiceCallScreen.js
import RtcEngine from 'react-native-agora';

const startVoiceCall = async (channelName) => {
  const engine = await RtcEngine.create(AGORA_APP_ID);
  
  // Enable audio only
  await engine.enableAudio();
  await engine.disableVideo();
  
  // Join channel
  await engine.joinChannel(null, channelName, null, 0);
};
```

**Pros:**
- Native in-app experience (no browser)
- Very low latency
- Excellent audio quality
- Works on 2G/3G
- Free tier is generous

**Cons:**
- Requires SDK integration
- Need to create Agora account

---

### Option 3: Daily.co (Audio-Only)

**What you already have!**

You already have Daily.co API key. Just use audio-only mode:

```javascript
// Create audio-only room
const response = await fetch('https://api.daily.co/v1/rooms', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${DAILY_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    properties: {
      enable_video: false,  // Audio only!
      enable_audio: true,
      max_participants: 2
    }
  })
});
```

**Pros:**
- You already have it set up
- Native SDK available
- Good quality

**Cons:**
- Daily API key should be on backend (security issue)
- Limited free tier

---

### Option 4: WebRTC (Pure P2P) ⭐ MOST FREE

**Completely FREE - No third party!**

Use React Native WebRTC for direct peer-to-peer audio:

```bash
npm install react-native-webrtc
```

**How it works:**
1. User A creates offer
2. Send offer to User B via Supabase
3. User B creates answer
4. Send answer back via Supabase
5. Direct P2P audio connection established

**Pros:**
- 100% FREE forever
- No third-party service
- Direct connection (lowest latency)
- Complete control

**Cons:**
- More complex to implement
- Need signaling server (can use Supabase Realtime)
- NAT traversal issues (need STUN/TURN servers)

---

## 🎯 Recommended Implementation: Jitsi Audio-Only

Since you already have Jitsi working, here's how to add voice calls:

### Step 1: Create Voice Call Button

```javascript
// In HomePage.js, add new button
<TouchableOpacity 
  style={styles.voiceCallButton}
  onPress={startRandomVoiceCall}
>
  <Ionicons name="call" size={24} color="#fff" />
  <Text style={styles.buttonText}>Random Voice Call</Text>
</TouchableOpacity>
```

### Step 2: Modify Matching Logic

```javascript
// In MatchingService.js
export const findVoiceMatch = async (userId, userGender) => {
  // Same logic as video matching, but mark as voice call
  const { data, error } = await supabase
    .from('active_calls')
    .insert({
      user1_id: userId,
      user1_gender: userGender,
      call_type: 'voice',  // Add this field
      status: 'waiting',
      created_at: new Date().toISOString()
    });
  
  // ... rest of matching logic
};
```

### Step 3: Open Jitsi in Audio-Only Mode

```javascript
// In CallPage.js
const jitsiUrl = callType === 'voice' 
  ? `https://meet.jit.si/${roomName}#config.startWithVideoMuted=true&config.startAudioOnly=true&config.disableDeepLinking=true`
  : `https://meet.jit.si/${roomName}#config.disableDeepLinking=true`;

Linking.openURL(jitsiUrl);
```

### Step 4: Update Database Schema

```sql
-- Add call_type column to active_calls table
ALTER TABLE active_calls 
ADD COLUMN call_type TEXT DEFAULT 'video' CHECK (call_type IN ('video', 'voice'));

-- Add index for faster queries
CREATE INDEX idx_active_calls_type ON active_calls(call_type);
```

---

## 🎨 UI/UX for Voice Calls

### Voice Call Screen Design:

```javascript
// VoiceCallScreen.js
<View style={styles.voiceCallContainer}>
  {/* Animated audio waves */}
  <LottieView 
    source={require('./animations/audio-wave.json')}
    autoPlay
    loop
  />
  
  {/* User avatar (since no video) */}
  <Image 
    source={{ uri: otherUser.avatar_url }}
    style={styles.avatar}
  />
  
  {/* Call duration */}
  <Text style={styles.duration}>{formatDuration(callDuration)}</Text>
  
  {/* Controls */}
  <View style={styles.controls}>
    <TouchableOpacity onPress={toggleMute}>
      <Ionicons name={isMuted ? "mic-off" : "mic"} size={40} />
    </TouchableOpacity>
    
    <TouchableOpacity onPress={endCall}>
      <Ionicons name="call" size={40} color="red" />
    </TouchableOpacity>
    
    <TouchableOpacity onPress={toggleSpeaker}>
      <Ionicons name={isSpeaker ? "volume-high" : "volume-low"} size={40} />
    </TouchableOpacity>
  </View>
</View>
```

---

## 💡 Feature Ideas (Like Wakie)

### 1. **Wake-up Call Service**
```javascript
// User sets alarm time
// System matches them with someone at that time
// Random person calls to wake them up

const scheduleWakeUpCall = async (userId, wakeUpTime) => {
  await supabase.from('wake_up_requests').insert({
    user_id: userId,
    wake_up_time: wakeUpTime,
    status: 'pending'
  });
};
```

### 2. **Topic-Based Matching**
```javascript
// Match users who want to talk about same topic
const topics = [
  'Practice English',
  'Make Friends',
  'Vent/Talk',
  'Debate',
  'Story Time',
  'Language Exchange'
];

// Match based on selected topic
const findTopicMatch = async (userId, topic) => {
  // Find someone waiting with same topic
};
```

### 3. **Anonymous Voice Chat**
- Don't show names, just "Stranger"
- No profile photos during call
- Option to reveal identity after call

### 4. **Voice Messages**
- Leave voice messages for random people
- Like voice-based social media
- People can reply with voice

### 5. **Timed Calls**
- 5-minute quick chats
- 15-minute deep conversations
- 30-minute language practice

---

## 📊 Cost Comparison

### Video Calls (Current):
- Bandwidth: ~2-3 Mbps per user
- Server cost: Higher
- Battery drain: High
- Data usage: ~150 MB per hour

### Voice Calls:
- Bandwidth: ~50-100 Kbps per user
- Server cost: Much lower
- Battery drain: Low
- Data usage: ~5-10 MB per hour

**Voice is 15-30x cheaper!**

---

## 🚀 Quick Implementation Plan

### Phase 1: Basic Voice Calls (1-2 days)
1. Add "Voice Call" button to HomePage
2. Modify matching logic to support voice calls
3. Open Jitsi in audio-only mode
4. Test with 2 users

### Phase 2: Better UX (2-3 days)
1. Create dedicated VoiceCallScreen
2. Add audio wave animations
3. Show user avatars
4. Add mute/speaker controls

### Phase 3: Advanced Features (1 week)
1. Topic-based matching
2. Wake-up call scheduling
3. Voice messages
4. Call history

---

## 🎯 Recommended Approach

**For your app, I recommend:**

1. **Start with Jitsi Audio-Only** (easiest, already working)
   - Add voice call button
   - Modify matching to support voice
   - Open Jitsi with audio-only config

2. **Later, migrate to Agora Voice SDK** (better experience)
   - Native in-app experience
   - Better audio quality
   - More control
   - Still very cheap

3. **Add Wakie-style features**
   - Wake-up calls
   - Topic matching
   - Anonymous mode

---

## 💰 Monetization Ideas

1. **Premium Voice Features**
   - Longer call duration
   - Choose topics
   - Skip to next person
   - Voice filters/effects

2. **Wake-up Call Service**
   - Charge ₹10/month for wake-up calls
   - Guaranteed wake-up by real person

3. **Language Practice**
   - Match with native speakers
   - Charge ₹50/month for language practice

---

## 🔧 Want Me to Implement It?

I can add voice calls to your app right now! Just tell me:

1. **Which solution?**
   - Jitsi audio-only (easiest, 30 minutes)
   - Agora Voice SDK (better, 2-3 hours)
   - WebRTC P2P (most complex, 1 day)

2. **Which features?**
   - Basic random voice calls
   - Topic-based matching
   - Wake-up calls
   - All of the above

Let me know and I'll implement it! 🚀
