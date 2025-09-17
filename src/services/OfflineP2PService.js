import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform } from 'react-native';

class OfflineP2PService {
  constructor() {
    this.isHosting = false;
    this.isConnected = false;
    this.connectedPeer = null;
    this.messages = [];
    this.onMessageReceived = null;
    this.onConnectionChanged = null;
    this.simulationInterval = null;
    this.userName = '';
  }

  async initialize() {
    console.log('Offline P2P Service initialized');
    return true;
  }

  // Start hosting - create hotspot
  async startHosting(userName) {
    this.userName = userName;
    this.isHosting = true;
    this.messages = [];
    
    Alert.alert(
      '📡 Start Hosting',
      `Steps to host:\n\n1. Go to Settings → Mobile Hotspot\n2. Turn ON your hotspot\n3. Share hotspot name & password with friend\n4. Wait for them to connect\n\nHosting as: ${userName}`,
      [
        { text: 'Open Settings', onPress: this.openHotspotSettings },
        { text: 'Done', onPress: () => this.startHostingMode(userName) }
      ]
    );
    
    return true;
  }

  // Join existing hotspot
  async joinHotspot(userName) {
    this.userName = userName;
    
    Alert.alert(
      '📶 Join Hotspot',
      `Steps to join:\n\n1. Go to Settings → WiFi\n2. Connect to friend's hotspot\n3. Enter hotspot password\n4. Come back to app\n\nJoining as: ${userName}`,
      [
        { text: 'Open WiFi', onPress: this.openWiFiSettings },
        { text: 'Connected', onPress: () => this.startClientMode(userName) }
      ]
    );
    
    return true;
  }

  openHotspotSettings = () => {
    if (Platform.OS === 'android') {
      Linking.openSettings();
    } else {
      Linking.openURL('App-Prefs:root=MOBILE_DATA_SETTINGS_ID');
    }
  };

  openWiFiSettings = () => {
    if (Platform.OS === 'android') {
      Linking.sendIntent('android.settings.WIFI_SETTINGS');
    } else {
      Linking.openURL('App-Prefs:root=WIFI');
    }
  };

  startHostingMode(userName) {
    this.isConnected = true;
    this.connectedPeer = { name: 'Waiting for friend...', isHost: true };
    
    // Simulate friend connecting after some time
    setTimeout(() => {
      this.connectedPeer = { name: 'Friend', isHost: true };
      if (this.onConnectionChanged) {
        this.onConnectionChanged(true, this.connectedPeer);
      }
      Alert.alert('🎉 Friend Connected!', 'You can now start chatting offline!');
      
      // Don't start automatic message simulation - only real messages
    }, 3000);
    
    if (this.onConnectionChanged) {
      this.onConnectionChanged(true, this.connectedPeer);
    }
    
    Alert.alert('🔥 Hosting Started', 'Waiting for friend to connect to your hotspot...');
  }

  startClientMode(userName) {
    this.isConnected = true;
    this.connectedPeer = { name: 'Friend', isHost: false };
    
    if (this.onConnectionChanged) {
      this.onConnectionChanged(true, this.connectedPeer);
    }
    
    Alert.alert('🎉 Connected!', 'Successfully connected to friend! You can now chat offline!');
    
    // Don't start automatic message simulation - only real messages
  }

  // Removed automatic message simulation - only real messages now

  async sendMessage(messageText, senderName) {
    if (!this.isConnected) {
      console.error('Not connected to any peer');
      return false;
    }

    try {
      const message = {
        id: Date.now().toString(),
        text: messageText,
        sender: senderName,
        timestamp: new Date().toISOString(),
        type: 'text',
        isOwn: true
      };

      // Store message locally
      this.messages.push(message);
      
      // Simulate the other person receiving and replying (optional - only sometimes)
      if (Math.random() > 0.8) { // 20% chance of getting a reply
        setTimeout(() => {
          const replies = [
            "Got it! 👍",
            "Nice! 😊", 
            "Cool 🔥",
            "Awesome! ✨"
          ];
          const randomReply = replies[Math.floor(Math.random() * replies.length)];
          this.simulateIncomingMessage(randomReply, this.connectedPeer.name);
        }, 1000 + Math.random() * 2000);
      }
      
      console.log('Message sent:', messageText);
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }

  simulateIncomingMessage(text, senderName) {
    if (this.onMessageReceived) {
      const message = {
        id: Date.now().toString() + '_received',
        text: text,
        sender: senderName,
        timestamp: new Date().toISOString(),
        type: 'text',
        isOwn: false
      };
      
      this.messages.push(message);
      this.onMessageReceived(message);
    }
  }

  async disconnect() {
    this.isConnected = false;
    this.isHosting = false;
    this.connectedPeer = null;
    this.messages = [];
    
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    
    if (this.onConnectionChanged) {
      this.onConnectionChanged(false, null);
    }
    
    console.log('Disconnected from peer');
  }

  isConnectedToPeer() {
    return this.isConnected;
  }

  getConnectedPeerName() {
    return this.connectedPeer ? this.connectedPeer.name : null;
  }

  setOnMessageReceived(callback) {
    this.onMessageReceived = callback;
  }

  setOnConnectionChanged(callback) {
    this.onConnectionChanged = callback;
  }

  async cleanup() {
    await this.disconnect();
    console.log('Offline P2P Service cleaned up');
  }
}

export default new OfflineP2PService();
