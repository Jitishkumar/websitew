# PerfectFL - Social Media Platform

<div align="center">
  <img src="./icon.png" alt="PerfectFL Logo" width="120" height="120">
  
  ### A Feature-Rich Social Media Application
  
  Built with React Native & Expo | Powered by Supabase
  
  [![React Native](https://img.shields.io/badge/React%20Native-0.79.3-blue.svg)](https://reactnative.dev/)
  [![Expo](https://img.shields.io/badge/Expo-~53.0.10-000020.svg)](https://expo.dev/)
  [![Supabase](https://img.shields.io/badge/Supabase-2.49.10-3ECF8E.svg)](https://supabase.com/)
</div>

---

## 📱 About The Project

**PerfectFL** is a comprehensive social media platform that brings people together through posts, stories, reels, real-time messaging, video calls, and unique features like anonymous confessions and location-based connections. This is a **solo-developed project** built from scratch, showcasing modern mobile development practices and full-stack capabilities.

### ✨ Key Features

#### 🎯 Core Social Features
- **Posts & Feed** - Share photos, videos, and thoughts with your network
- **Stories** - 24-hour ephemeral content with views tracking
- **Reels/Shorts** - Short-form vertical video content
- **Comments & Interactions** - Like, comment, and engage with content
- **User Profiles** - Customizable profiles with follower/following system

#### 💬 Communication
- **Real-time Messaging** - One-on-one chat with text, images, and media
- **Group Chats** - Create and manage group conversations
- **Video Calls** - High-quality video calling powered by Zego Cloud
- **Push Notifications** - Stay updated with real-time notifications

#### 🎭 Unique Features
- **Anonymous Confessions** - Share thoughts anonymously or publicly
- **Nearby People** - Discover users based on geolocation
- **Account Verification** - Blue tick verification system
- **Donation System** - Support creators with integrated Razorpay payments
- **Wealthiest Donors** - Leaderboard for top contributors
- **Dark/Light Theme** - Customizable UI themes

#### 🔒 Privacy & Security
- **Blocked Users Management** - Control who can interact with you
- **Private Profiles** - Restrict content visibility
- **Secure Authentication** - OTP-based phone verification
- **Encrypted Storage** - Sensitive data protection

---

## 🛠️ Technology Stack

### Frontend
- **React Native** (0.79.3) - Cross-platform mobile framework
- **Expo** (~53.0.10) - Development and build platform
- **React Navigation** - Navigation and routing
- **React Native Reanimated** - Smooth animations
- **React Native Gesture Handler** - Touch gesture handling

### Backend & Database
- **Supabase** - Backend-as-a-Service (PostgreSQL database, Authentication, Real-time subscriptions, Storage)
- **RESTful API Architecture** - Supabase REST APIs for data operations

### Media & Storage
- **Cloudinary** - Image and video hosting
- **Expo File System** - Local file management
- **Expo Image Picker** - Camera and gallery access
- **Expo AV** - Audio/Video playback

### Communication
- **Zego Cloud UIKit** - Video calling infrastructure
- **Expo Notifications** - Push notification system
- **Real-time Subscriptions** - Live data updates via Supabase

### Payment Integration
- **Razorpay** - Payment gateway for donations

### Additional Libraries
- **Expo Location** - Geolocation services
- **React Native NetInfo** - Network connectivity detection
- **Crypto-js** - Encryption utilities
- **AsyncStorage** - Local data persistence

---

## 🚀 Getting Started

### Prerequisites

Before running this project, ensure you have:

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Expo CLI** (`npm install -g expo-cli`)
- **iOS Simulator** (Mac only) or **Android Emulator**
- **Expo Go App** (for testing on physical devices)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repository-url>
   cd websitew
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory with:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   RAZORPAY_KEY_ID=your_razorpay_key_id
   ZEGO_APP_ID=your_zego_app_id
   ZEGO_APP_SIGN=your_zego_app_sign
   ```

4. **Set up Supabase Database**
   
   Run the SQL scripts in the `supabase/` directory to create necessary tables and functions.

### Running the App

```bash
# Start Expo development server
npm start
# or
expo start
```

**Platform-specific commands:**
```bash
# iOS (Mac only)
npm run ios

# Android
npm run android

# Web
npm run web
```

**Using Expo Go:**
1. Install Expo Go on your iOS/Android device
2. Scan the QR code from the terminal
3. App will load on your device

---

## 📂 Project Structure

```
websitew/
├── App.js                      # Main application entry point
├── src/
│   ├── components/             # Reusable UI components
│   ├── config/                 # Configuration files
│   ├── context/                # React Context providers
│   │   ├── AccountContext.js   # User account state
│   │   ├── MessageContext.js   # Messaging state
│   │   ├── NotificationContext.js
│   │   ├── ThemeContext.js     # Theme management
│   │   └── VideoContext.js     # Video call state
│   ├── lib/                    # External library configs
│   │   └── supabase.js         # Supabase client
│   ├── navigation/             # Navigation configuration
│   │   └── AppNavigator.js     # Main navigation stack
│   ├── screens/                # All app screens
│   │   ├── HomeScreen.js       # Main feed
│   │   ├── ProfileScreen.js    # User profile
│   │   ├── MessagesScreen.js   # Chat list
│   │   ├── ReelsScreen.js      # Short videos
│   │   ├── StoriesScreen.js    # Stories viewer
│   │   ├── ConfessionScreen.js # Anonymous confessions
│   │   ├── NearbyPeople.js     # Location-based discovery
│   │   ├── CallPage.js         # Video calling
│   │   └── ... (40+ screens)
│   ├── services/               # Business logic & API calls
│   │   ├── NotificationService.js
│   │   └── ...
│   └── utils/                  # Helper functions
├── supabase/                   # Database schemas & migrations
├── database/                   # Local database utilities
├── assets/                     # Images, fonts, icons
├── android/                    # Android native code
├── ios/                        # iOS native code
├── app.json                    # Expo configuration
├── package.json                # Dependencies
└── eas.json                    # Expo Application Services config
```

---

## 🔑 Key Features Implementation

### Authentication Flow
- Phone number-based authentication
- OTP verification via Supabase Auth
- Secure session management
- Multi-account support

### Real-time Features
- Live message updates using Supabase real-time subscriptions
- Instant notification delivery
- Online/offline status tracking
- Typing indicators

### Media Handling
- Image compression and optimization
- Video upload with progress tracking
- Cloudinary CDN for fast media delivery
- Local caching for better performance

### Geolocation
- Find nearby users within configurable radius
- Privacy-focused location sharing
- Background location updates

---

## 🎨 Design Philosophy

- **User-Centric**: Intuitive UI/UX with smooth animations
- **Performance**: Optimized rendering and lazy loading
- **Accessibility**: Support for different screen sizes and devices
- **Scalability**: Modular architecture for easy feature additions

---

## 📊 Database Architecture

The app uses **Supabase (PostgreSQL)** with the following main tables:

- `users` - User profiles and authentication
- `posts` - User posts with media
- `stories` - 24-hour ephemeral content
- `shorts` - Short-form videos
- `comments` - Comments on posts/shorts
- `messages` - Direct messages
- `group_chats` - Group conversations
- `confessions` - Anonymous posts
- `donations` - Payment transactions
- `notifications` - Push notification logs
- `blocked_users` - User blocking relationships

---

## 🔐 Security Features

- **Row Level Security (RLS)** on all Supabase tables
- **Encrypted local storage** for sensitive data
- **Secure API key management** via environment variables
- **Input validation** and sanitization
- **Rate limiting** on critical operations

---

## 🚧 Development Status

This project is **actively developed** and maintained. Current focus areas:

- ✅ Core social media features (Complete)
- ✅ Real-time messaging (Complete)
- ✅ Video calling (Complete)
- ✅ Payment integration (Complete)
- 🔄 Performance optimizations (Ongoing)
- 📋 Additional features (Planned)

---

## 🤝 Seeking Investment

This is a **solo-developed, bootstrapped project** built entirely from scratch. I'm currently seeking funding to:

- Scale infrastructure for more users
- Implement advanced AI/ML features
- Expand marketing and user acquisition
- Add more payment methods and monetization features
- Hire additional developers for faster growth

**If you're interested in investing or partnering, please reach out!**

---

## 📱 Screenshots

_Coming soon - Add screenshots of your app here_

---

## 📄 License

This project is licensed under the **0BSD License** - see the LICENSE file for details.

---

## 👨‍💻 Developer

**Developed entirely by me** - A passionate solo developer committed to building innovative social platforms.

---

## 📞 Contact & Support

For inquiries, investment opportunities, or support:
- **Email**: [Your Email]
- **LinkedIn**: [Your LinkedIn]
- **GitHub**: [Your GitHub]

---

## 🙏 Acknowledgments

- **Supabase** - For the amazing backend infrastructure
- **Expo** - For simplifying React Native development
- **Zego Cloud** - For video calling capabilities
- **React Native Community** - For excellent libraries and support

---

<div align="center">
  <strong>⭐ If you find this project interesting, please consider starring it! ⭐</strong>
</div>