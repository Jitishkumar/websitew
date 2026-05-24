# Setup Diagram - Running on Both Devices

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Computer (Mac)                       │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Terminal 1: npm start                    │   │
│  │         (Emulator - Pixel_4a)                         │   │
│  │                                                        │   │
│  │  $ npm start                                          │   │
│  │  › Press ? │ show all commands                        │   │
│  │  Press 'a' → Select emulator                          │   │
│  │  ✓ App loads on emulator                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                   │
│                    Expo Metro Server                          │
│                    (Port 19000)                               │
│                           ↑                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Terminal 2: npm start                    │   │
│  │         (Physical Device via USB)                     │   │
│  │                                                        │   │
│  │  $ npm start                                          │   │
│  │  › Press ? │ show all commands                        │   │
│  │  Press 'a' → Select physical device                   │   │
│  │  ✓ App loads on physical device                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         ↓                                    ↓
    ┌─────────────┐                  ┌──────────────────┐
    │  Emulator   │                  │ Physical Device  │
    │  (Pixel_4a) │                  │  (Your Phone)    │
    │             │                  │                  │
    │ ┌─────────┐ │                  │ ┌──────────────┐ │
    │ │ HomePage│ │                  │ │  HomePage    │ │
    │ │ "Find   │ │                  │ │  "Find       │ │
    │ │ Random  │ │                  │ │  Random      │ │
    │ │ Match"  │ │                  │ │  Match"      │ │
    │ └─────────┘ │                  │ └──────────────┘ │
    │             │                  │                  │
    │ Click ──────┼──────────────────┼─→ Click          │
    │             │                  │                  │
    │ ┌─────────┐ │                  │ ┌──────────────┐ │
    │ │CallPage │ │◄─────────────────┼─│ CallPage     │ │
    │ │ Video   │ │   Match Found    │ │ Video        │ │
    │ │ Call    │ │                  │ │ Call         │ │
    │ └─────────┘ │                  │ └──────────────┘ │
    │             │                  │                  │
    └─────────────┘                  └──────────────────┘
```

## Step-by-Step Setup

### Step 1: Prepare Emulator
```
┌─────────────────────────────────────┐
│  Android Studio                      │
│  ├─ Virtual Device Manager           │
│  ├─ Select: Pixel_4a                 │
│  └─ Click: Play Button               │
│     ↓                                │
│  Emulator starts (2-3 min)           │
│     ↓                                │
│  Ready for app                       │
└─────────────────────────────────────┘
```

### Step 2: Prepare Physical Device
```
┌─────────────────────────────────────┐
│  Physical Device                     │
│  ├─ Settings                         │
│  ├─ Developer Options                │
│  ├─ USB Debugging: ON                │
│  └─ Connect via USB                  │
│     ↓                                │
│  Tap "Allow" on device               │
│     ↓                                │
│  Ready for app                       │
└─────────────────────────────────────┘
```

### Step 3: Terminal 1 - Emulator
```
Terminal 1:
┌─────────────────────────────────────┐
│ $ cd "/Users/jitishkumar/Desktop/   │
│   untitled folder/websitew"         │
│ $ npm start                         │
│                                     │
│ › Metro waiting on exp://...        │
│ › Press ? │ show all commands       │
│                                     │
│ Press 'a'                           │
│ ↓                                   │
│ › Select an Android device          │
│   ❯ emulator-5554 (Pixel_4a)        │
│                                     │
│ Select emulator                     │
│ ↓                                   │
│ › Opening on Android...             │
│ › Opening emulator Pixel_4a         │
│ ✓ Compiled successfully             │
│                                     │
│ App loaded on emulator ✓            │
└─────────────────────────────────────┘
```

### Step 4: Terminal 2 - Physical Device
```
Terminal 2 (NEW WINDOW):
┌─────────────────────────────────────┐
│ $ cd "/Users/jitishkumar/Desktop/   │
│   untitled folder/websitew"         │
│ $ npm start                         │
│                                     │
│ › Metro waiting on exp://...        │
│ › Press ? │ show all commands       │
│                                     │
│ Press 'a'                           │
│ ↓                                   │
│ › Select an Android device          │
│   ❯ emulator-5554 (Pixel_4a)        │
│     192.168.1.100:5555 (Device)     │
│                                     │
│ Select physical device              │
│ ↓                                   │
│ › Opening on Android...             │
│ › Opening com.flexx.app on Device   │
│ ✓ Compiled successfully             │
│                                     │
│ App loaded on device ✓              │
└─────────────────────────────────────┘
```

## Video Call Flow

```
Emulator                          Physical Device
┌──────────────────┐             ┌──────────────────┐
│   HomePage       │             │   HomePage       │
│                  │             │                  │
│ [Find Random]    │             │ [Find Random]    │
│      ↓           │             │      ↓           │
│   Click          │             │   Click          │
└──────────────────┘             └──────────────────┘
        ↓                               ↓
   Added to                        Added to
   waiting_users                   waiting_users
        ↓                               ↓
   Polling for                     Polling for
   matches                         matches
        ↓                               ↓
   ┌────────────────────────────────────┐
   │  Match Found!                      │
   │  Both users matched                │
   │  active_calls record created       │
   │  room_url generated                │
   └────────────────────────────────────┘
        ↓                               ↓
   Navigate to                     Navigate to
   CallPage                        CallPage
        ↓                               ↓
   Load Daily.co                   Load Daily.co
   iframe                          iframe
        ↓                               ↓
   ┌──────────────────┐             ┌──────────────────┐
   │   CallPage       │             │   CallPage       │
   │                  │             │                  │
   │ [Video Stream]   │◄────────────│ [Video Stream]   │
   │ [Audio Stream]   │────────────→│ [Audio Stream]   │
   │                  │             │                  │
   │ 3 min timer      │             │ 3 min timer      │
   └──────────────────┘             └──────────────────┘
        ↓ (3 min)                        ↓ (3 min)
   Call ends                        Call ends
   Database cleaned                 Database cleaned
   Navigate to                      Navigate to
   HomePage                         HomePage
```

## Device Selection Menu

```
When you press 'a' in Terminal 2, you'll see:

› Select an Android device or emulator
  ❯ emulator-5554 (Pixel_4a)
    192.168.1.100:5555 (Your Physical Device)

Arrow keys: Navigate
Enter: Select

Choose the physical device (second option)
```

## File Structure

```
Your Project
├── src/
│   ├── screens/
│   │   ├── HomePage.js          ← Matching logic
│   │   ├── CallPage.js          ← Video call UI
│   │   └── ...
│   ├── lib/
│   │   └── supabase.js          ← Database
│   └── ...
├── android/
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   └── res/xml/
│   │   │       └── network_security_config.xml
│   │   └── build.gradle
│   └── ...
├── package.json
├── App.js
├── reset-cache.sh               ← Cache clearing
├── RUN_ON_BOTH_DEVICES.md       ← This guide
└── ...
```

## Network Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    WiFi Network                          │
│                                                           │
│  ┌──────────────┐         ┌──────────────────────────┐  │
│  │   Computer   │         │  Physical Device         │  │
│  │  192.168.1.5 │◄───────→│  192.168.1.100           │  │
│  │              │  USB    │                          │  │
│  │ Expo Server  │  or     │  Expo Go App             │  │
│  │ Port 19000   │  WiFi   │  Connected to Expo       │  │
│  └──────────────┘         └──────────────────────────┘  │
│         ↑                                                 │
│         │                                                 │
│  ┌──────────────┐                                        │
│  │  Emulator    │                                        │
│  │  localhost   │                                        │
│  │              │                                        │
│  │ Expo Go App  │                                        │
│  │ Connected    │                                        │
│  └──────────────┘                                        │
│                                                           │
└─────────────────────────────────────────────────────────┘
         ↓
    ┌─────────────────────────────────────┐
    │      Supabase (Cloud)               │
    │  - Database (active_calls)          │
    │  - Database (waiting_users)         │
    │  - Authentication                   │
    └─────────────────────────────────────┘
         ↓
    ┌─────────────────────────────────────┐
    │      Daily.co (Cloud)               │
    │  - Video/Audio Streaming            │
    │  - Room Management                  │
    └─────────────────────────────────────┘
```

## Troubleshooting Flowchart

```
App not loading?
├─ Check emulator running
│  └─ If not: Open Android Studio → Virtual Device Manager → Play
├─ Check physical device connected
│  └─ If not: Connect USB → Tap Allow → adb devices
├─ Check Expo started
│  └─ If not: npm start
├─ Check device selected
│  └─ If not: Press 'a' → Select device
└─ Check internet
   └─ If not: Connect to WiFi

Matching not working?
├─ Check gender set in profile
├─ Check database in Supabase
├─ Check console logs
└─ Try different accounts

Video not loading?
├─ Check internet connection
├─ Check room URL in logs
├─ Check Daily.co accessible
└─ Check WebView loading

Call ends immediately?
├─ Check logs for reason
├─ Check network connection
├─ Check Supabase connection
└─ Try again
```

## Success Indicators

```
✓ Emulator running
  └─ Android logo visible
  └─ Emulator fully loaded

✓ Physical device connected
  └─ adb devices shows "device"
  └─ Not "unauthorized"

✓ Expo started
  └─ Metro waiting message
  └─ QR code visible

✓ App loaded on emulator
  └─ HomePage visible
  └─ "Find Random Match" button visible

✓ App loaded on physical device
  └─ HomePage visible
  └─ "Find Random Match" button visible

✓ Matching works
  └─ Both show "Looking for matches..."
  └─ Both navigate to CallPage

✓ Video call works
  └─ Daily.co iframe loads
  └─ Video visible from other device
  └─ Audio working
  └─ Call ends after 3 minutes
```

---

**Status:** Ready to test ✅
**Last Updated:** May 24, 2026
