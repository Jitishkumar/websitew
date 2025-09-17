import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OfflineP2PService from '../services/OfflineP2PService';

const OfflineChatModal = ({ visible, onClose }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectedPeerName, setConnectedPeerName] = useState('');
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [userName, setUserName] = useState('');
  const [currentView, setCurrentView] = useState('main'); // 'main', 'chat'
  const flatListRef = useRef(null);

  useEffect(() => {
    if (visible) {
      loadUserName();
      initializeService();
    } else {
      cleanup();
    }
  }, [visible]);

  const loadUserName = async () => {
    try {
      let savedName = await AsyncStorage.getItem('offline_username');
      if (!savedName) {
        const randomNames = ['Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Avery', 'Quinn'];
        savedName = randomNames[Math.floor(Math.random() * randomNames.length)];
        await AsyncStorage.setItem('offline_username', savedName);
      }
      setUserName(savedName);
    } catch (error) {
      console.error('Failed to load username:', error);
      setUserName('User');
    }
  };

  const initializeService = async () => {
    try {
      await OfflineP2PService.initialize();
      setupEventHandlers();
    } catch (error) {
      console.error('Failed to initialize service:', error);
    }
  };

  const setupEventHandlers = () => {
    OfflineP2PService.setOnMessageReceived((message) => {
      setMessages(prev => [...prev, message]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    OfflineP2PService.setOnConnectionChanged((connected, peer) => {
      setIsConnected(connected);
      if (connected && peer) {
        // Show actual friend name instead of generic "Host" or "Friend"
        const friendName = peer.name === 'Friend' ? 'Your Friend' : peer.name;
        setConnectedPeerName(friendName);
        setCurrentView('chat');
        setMessages([]);
      } else {
        setConnectedPeerName('');
        setCurrentView('main');
      }
    });
  };

  const startHosting = async () => {
    if (!userName.trim()) {
      return;
    }
    await OfflineP2PService.startHosting(userName);
  };

  const joinHotspot = async () => {
    if (!userName.trim()) {
      return;
    }
    await OfflineP2PService.joinHotspot(userName);
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !isConnected) return;

    const success = await OfflineP2PService.sendMessage(messageText, userName);
    if (success) {
      const message = {
        id: Date.now().toString(),
        text: messageText,
        sender: userName,
        timestamp: new Date().toISOString(),
        isOwn: true,
      };
      setMessages(prev => [...prev, message]);
      setMessageText('');
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const disconnect = async () => {
    await OfflineP2PService.disconnect();
    setCurrentView('main');
  };

  const cleanup = async () => {
    await OfflineP2PService.cleanup();
    setIsConnected(false);
    setMessages([]);
    setCurrentView('main');
  };

  const renderMainView = () => (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Offline Chat</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <Text style={styles.subtitle}>Chat without internet!</Text>
        
        <View style={styles.userSection}>
          <Text style={styles.label}>Your Name:</Text>
          <TextInput
            style={styles.input}
            value={userName}
            onChangeText={setUserName}
            placeholder="Enter your name"
            maxLength={20}
          />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.hostButton]}
            onPress={startHosting}
          >
            <LinearGradient
              colors={['#FF6B9D', '#FF8E9B']}
              style={styles.buttonGradient}
            >
              <Ionicons name="wifi" size={24} color="#fff" />
              <Text style={styles.buttonText}>🔥 Host Hotspot</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.joinButton]}
            onPress={joinHotspot}
          >
            <LinearGradient
              colors={['#4ECDC4', '#44A08D']}
              style={styles.buttonGradient}
            >
              <Ionicons name="phone-portrait" size={24} color="#fff" />
              <Text style={styles.buttonText}>📱 Join Hotspot</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructions}>
            🔥 Host: Turn on mobile hotspot, share with friend{'\n'}
            📱 Join: Connect to friend's hotspot WiFi{'\n'}
            💬 Chat offline without internet!
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );

  const renderChatView = () => (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={disconnect} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.peerName}>{connectedPeerName}</Text>
          <Text style={styles.status}>📶 Connected Offline</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        renderItem={({ item }) => (
          <View style={[
            styles.messageContainer,
            item.isOwn ? styles.ownMessage : styles.otherMessage
          ]}>
            <Text style={styles.messageSender}>
              {item.isOwn ? 'You' : (connectedPeerName || 'Friend')}
            </Text>
            <Text style={styles.messageText}>{item.text}</Text>
            <Text style={styles.messageTime}>
              {new Date(item.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
          </View>
        )}
      />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <TextInput
          style={styles.messageInput}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type a message..."
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={sendMessage}
          disabled={!messageText.trim()}
        >
          <LinearGradient
            colors={messageText.trim() ? ['#FF6B9D', '#FF8E9B'] : ['#666', '#888']}
            style={styles.sendButtonGradient}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.modalContainer}
      >
        {currentView === 'main' ? renderMainView() : renderChatView()}
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    padding: 8,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  headerInfo: {
    alignItems: 'center',
  },
  peerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  status: {
    fontSize: 12,
    color: '#4ECDC4',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 30,
  },
  userSection: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 16,
  },
  buttonContainer: {
    gap: 15,
    marginBottom: 30,
  },
  button: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  instructionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 20,
  },
  instructions: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  messageContainer: {
    marginVertical: 5,
    padding: 12,
    borderRadius: 15,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#FF6B9D',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  messageSender: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 10,
  },
  messageInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#fff',
    maxHeight: 100,
  },
  sendButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  sendButtonGradient: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default OfflineChatModal;
