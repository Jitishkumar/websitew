import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessages } from '../context/MessageContext';

const MessageScreen = () => {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const navigation = useNavigation();
  const route = useRoute();
  const { recipientId, recipientName = "Chat", recipientAvatar } = route.params;
  const flatListRef = useRef(null);
  const { markConversationAsRead, fetchUnreadCount } = useMessages();
  
  // Use refs to prevent multiple calls
  const isMarkingAsRead = useRef(false);
  const hasMarkedOnFocus = useRef(false);
  
  // Get current user and set up conversation
  useEffect(() => {
    const setupConversation = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('User not authenticated');
          navigation.navigate('Login');
          return;
        }
        
        setUserId(user.id);
        
        const participants = [user.id, recipientId].sort();
        const convId = `${participants[0]}_${participants[1]}`;
        setConversationId(convId);
        
        await loadMessages(convId);
      } catch (error) {
        console.error('Error setting up conversation:', error);
      }
    };
    
    setupConversation();
  }, [recipientId]);

  // Set up focus listener ONCE - don't include changing dependencies
  useEffect(() => {
    if (!conversationId || !userId) return;
    
    const unsubscribe = navigation.addListener('focus', () => {
      // Only mark as read if we haven't already done so for this focus event
      if (!hasMarkedOnFocus.current && !isMarkingAsRead.current) {
        console.log('Screen focused, marking messages as read');
        markMessagesAsReadOnce(userId, conversationId);
      }
    });
    
    // Mark messages as read when component first mounts
    if (!hasMarkedOnFocus.current && !isMarkingAsRead.current) {
      markMessagesAsReadOnce(userId, conversationId);
    }
    
    return unsubscribe;
  }, [navigation, conversationId, userId]); // Remove isMarkedAsRead from dependencies

  // Reset the focus flag when leaving the screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      hasMarkedOnFocus.current = false;
    });
    
    return unsubscribe;
  }, [navigation]);

  // Set up real-time subscription
  useEffect(() => {
    if (!conversationId) return;
    
    const subscription = supabase
      .channel(`messages_${conversationId}_${Date.now()}`) // Unique channel name
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        handleRealTimeUpdate(payload);
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [conversationId, userId]);

  // Improved mark as read function
  const markMessagesAsReadOnce = async (currentUserId, convId) => {
    // Prevent multiple simultaneous calls
    if (isMarkingAsRead.current) {
      console.log('Already marking messages as read, skipping...');
      return;
    }
    
    try {
      isMarkingAsRead.current = true;
      hasMarkedOnFocus.current = true;
      
      console.log('Marking messages as read for user:', currentUserId, 'in conversation:', convId);
      
      // Use the MessageContext to mark conversation as read
      await markConversationAsRead(convId);
      
      // Update database
      const { data, error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('conversation_id', convId)
        .eq('receiver_id', currentUserId)
        .eq('read', false)
        .select();
        
      if (error) {
        console.error('Error marking messages as read:', error);
      } else {
        console.log('Messages marked as read:', data?.length || 0, 'messages updated');
        
        // Update local state
        if (data && data.length > 0) {
          setMessages(prevMessages => 
            prevMessages.map(msg => {
              const updatedMsg = data.find(m => m.id === msg.id);
              if (updatedMsg) {
                return { ...msg, read: true };
              }
              return msg;
            })
          );
        }
        
        // Update unread count
        await fetchUnreadCount();
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    } finally {
      // Always reset the flag after a delay to prevent race conditions
      setTimeout(() => {
        isMarkingAsRead.current = false;
      }, 1000);
    }
  };
  
  // Improved real-time update handler
  const handleRealTimeUpdate = (payload) => {
    if (payload.eventType === 'INSERT') {
      const newMessage = payload.new;
      
      const formattedMessage = {
        id: newMessage.id,
        text: newMessage.content,
        sender: newMessage.sender_id === userId ? 'me' : 'them',
        timestamp: new Date(newMessage.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        sender_id: newMessage.sender_id,
        read: newMessage.read || false
      };
      
      // Add message to state (avoid duplicates)
      setMessages(prevMessages => {
        const messageExists = prevMessages.some(msg => msg.id === formattedMessage.id);
        if (messageExists) {
          return prevMessages;
        }
        return [...prevMessages, formattedMessage];
      });
      
      // If it's a message for the current user and screen is focused, mark as read
      // But don't reset the hasMarkedOnFocus flag - let it stay true until screen blurs
      if (newMessage.receiver_id === userId && !newMessage.read && hasMarkedOnFocus.current) {
        // Use a timeout to avoid immediate re-triggering
        setTimeout(() => {
          if (!isMarkingAsRead.current) {
            markMessagesAsReadOnce(userId, conversationId);
          }
        }, 500);
      }
      
    } else if (payload.eventType === 'UPDATE') {
      const updatedMessage = payload.new;
      
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === updatedMessage.id ? 
          {
            ...msg,
            read: updatedMessage.read
          } : msg
        )
      );
    } else if (payload.eventType === 'DELETE') {
      setMessages(prevMessages => 
        prevMessages.filter(msg => msg.id !== payload.old.id)
      );
    }
  };

  // Load messages function (unchanged)
  const loadMessages = async (convId) => {
    try {
      setLoading(true);
      
      let currentUserId = userId;
      if (!currentUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          currentUserId = user.id;
          setUserId(currentUserId);
        } else {
          console.error('User not authenticated');
          navigation.navigate('Login');
          return;
        }
      }
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });
        
      if (error) {
        console.error('Error fetching messages:', error);
        const storedMessages = await AsyncStorage.getItem(`conversation_${convId}`);
        if (storedMessages) {
          const parsedMessages = JSON.parse(storedMessages);
          const updatedMessages = parsedMessages.map(msg => ({
            ...msg,
            sender: msg.sender_id === currentUserId ? 'me' : 'them'
          }));
          setMessages(updatedMessages);
        }
      } else {
        const formattedMessages = data.map(msg => ({
          id: msg.id,
          text: msg.content,
          sender: msg.sender_id === currentUserId ? 'me' : 'them',
          timestamp: new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          sender_id: msg.sender_id,
          read: msg.read || false
        }));
        
        setMessages(formattedMessages);
        await AsyncStorage.setItem(`conversation_${convId}`, JSON.stringify(formattedMessages));
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Rest of your component methods remain the same...
  const sendMessage = async () => {
    if (!inputText.trim()) return;
    
    try {
      if (!userId || !conversationId) {
        console.error('Missing user ID or conversation ID');
        return;
      }
      
      const newMessage = { 
        id: Date.now().toString(), 
        text: inputText,
        sender: 'me',
        sender_id: userId,
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      };
      
      const updatedMessages = [...messages, newMessage];
      setMessages(updatedMessages);
      setInputText('');
      
      await AsyncStorage.setItem(`conversation_${conversationId}`, JSON.stringify(updatedMessages));
      
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          receiver_id: recipientId,
          content: inputText,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        console.error('Error sending message:', error);
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== newMessage.id));
      } else {
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === newMessage.id ? { ...msg, id: data.id } : msg
          )
        );
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      const messageToDelete = messages.find(msg => msg.id === messageId);
      if (!messageToDelete || messageToDelete.sender_id !== userId) {
        console.error('Cannot delete message: not authorized');
        return;
      }

      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', userId);

      if (error) {
        console.error('Error deleting message:', error);
        return;
      }

      setMessages(prevMessages => 
        prevMessages.filter(msg => msg.id !== messageId)
      );

      const updatedMessages = messages.filter(msg => msg.id !== messageId);
      await AsyncStorage.setItem(`conversation_${conversationId}`, JSON.stringify(updatedMessages));
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const renderMessage = ({ item }) => (
    <TouchableOpacity
      onLongPress={() => {
        if (item.sender_id === userId) {
          Alert.alert(
            'Delete Message',
            'Are you sure you want to delete this message?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteMessage(item.id) }
            ],
            { cancelable: true }
          );
        }
      }}
      delayLongPress={500}
    >
      <View style={[
        styles.messageBubble,
        item.sender === 'me' ? styles.myMessage : styles.theirMessage
      ]}>
        <Text style={styles.messageText}>{item.text}</Text>
        <View style={styles.messageFooter}>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
          {item.sender === 'me' && (
            <View style={styles.readStatus}>
              <Ionicons 
                name={item.read ? "checkmark-done" : "checkmark"} 
                size={14} 
                color={item.read ? "#34aadc" : "rgba(255, 255, 255, 0.5)"} 
              />
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const getDisplayName = () => {
    if (recipientName && recipientName !== "User") {
      return recipientName;
    }
    return "Chat";
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.container}>
        <StatusBar style="light" />
        
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.profileInfo}>
            <Image 
              source={{ uri: recipientAvatar || 'https://via.placeholder.com/40' }} 
              style={styles.avatar} 
            />
            <Text style={styles.headerTitle}>{getDisplayName()}</Text>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="call-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="videocam-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No messages yet</Text>
                <Text style={styles.emptySubtext}>Start a conversation!</Text>
              </View>
            ) : (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#3399ff" />
                <Text style={styles.loadingText}>Loading messages...</Text>
              </View>
            )
          }
        />

        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={styles.inputWrapper}>
            <TouchableOpacity style={styles.mediaButton}>
              <Ionicons name="camera-outline" size={24} color="#ff00ff" />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              placeholderTextColor="#8e8e8e"
              multiline
            />
            {!inputText.trim() ? (
              <TouchableOpacity style={styles.mediaButton}>
                <Ionicons name="mic-outline" size={24} color="#8e8e8e" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.sendButton, styles.sendButtonActive]}
                onPress={sendMessage}
              >
                <Ionicons name="send" size={18} color="white" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

// Your existing styles remain the same...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  backButton: {
    padding: 5,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    borderWidth: 0.5,
    borderColor: '#333',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageListContent: {
    paddingTop: 20,
    paddingBottom: 10,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 20,
    maxWidth: '70%',
    marginVertical: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  myMessage: {
    backgroundColor: '#0066ff',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    backgroundColor: '#ff00ff',
    alignSelf: 'flex-start',
    borderTopLeftRadius: 4,
  },
  messageText: {
    color: 'white',
    fontSize: 15,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    marginRight: 4,
  },
  readStatus: {
    marginLeft: 2,
  },
  inputContainer: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: '#000',
    borderTopWidth: 0.5,
    borderTopColor: '#222',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
    borderRadius: 24,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    color: 'white',
    paddingVertical: 10,
    paddingHorizontal: 5,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    padding: 8,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#0095f6',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(51, 51, 51, 0.5)',
  },
  mediaButton: {
    padding: 8,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptySubtext: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    marginTop: 10,
  }
});

export default MessageScreen;