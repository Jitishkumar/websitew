import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { useNavigation } from '@react-navigation/native';
import { useMessages } from '../context/MessageContext';

const MessagesScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { fetchUnreadCount, markConversationAsRead } = useMessages();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewMessageButton, setShowNewMessageButton] = useState(true);
  
  // Function to mark a conversation as read
  const handleMarkAsRead = async (conversation) => {
    if (!conversation || !currentUserId) return;
    
    try {
      // Only proceed if there are unread messages
      if (conversation.unread > 0) {
        // Use the MessageContext to mark conversation as read
        await markConversationAsRead(conversation.id);
        
        // Update the local state to reflect read status (show 0 unread)
        setConversations(prevConversations => 
          prevConversations.map(conv => 
            conv.id === conversation.id 
              ? { ...conv, unread: 0 } 
              : conv
          )
        );
        
        console.log(`Marked conversation as read: ${conversation.id}`);
      }
    } catch (error) {
      console.error('Error in handleMarkAsRead:', error);
    }
  };
  
  // Get current user and fetch conversations
  useEffect(() => {
    let subscription = null;
    let readStatusSubscription = null;
    
    const fetchUserAndConversations = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('User not authenticated');
          navigation.navigate('Login');
          return;
        }
        
        setCurrentUserId(user.id);
        fetchConversations(user.id);
        
        // Set up real-time subscription for new messages
        // Use a unique channel name to avoid conflicts
        subscription = supabase
          .channel('messages_' + user.id)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${user.id}`
          }, (payload) => {
            console.log('New message received:', payload.eventType);
            // Refresh conversations when new message arrives
            fetchConversations(user.id);
          })
          .subscribe();
          
        // Listen for updates to read status with a different channel name
        readStatusSubscription = supabase
          .channel('read_status_' + user.id)
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages'
          }, (payload) => {
            console.log('Message update detected:', payload.new.id, 'Read:', payload.new.read);
            // Refresh conversations when messages are marked as read
            fetchConversations(user.id);
          })
          .subscribe();
      } catch (error) {
        console.error('Error fetching user:', error);
        setLoading(false);
      }
    };
    
    fetchUserAndConversations();
    
    // Clean up subscriptions when component unmounts
    return () => {
      if (subscription) supabase.removeChannel(subscription);
      if (readStatusSubscription) supabase.removeChannel(readStatusSubscription);
    };
  }, []);
  
  // Refresh conversations when the screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (currentUserId) {
        console.log('Screen focused, refreshing conversations');
        fetchConversations(currentUserId);
      }
    });
    
    return unsubscribe;
  }, [navigation, currentUserId]);
  
  // Fetch user conversations
  const fetchConversations = async (userId) => {
    try {
      setLoading(true);
      
      // Get all messages where current user is sender or receiver
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });
      
      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        setLoading(false);
        return;
      }
      
      // Group messages by conversation
      const conversationsMap = {};
      
      for (const message of messagesData) {
        // Determine the other user in the conversation
        const otherUserId = message.sender_id === userId ? message.receiver_id : message.sender_id;
        
        // Create a unique conversation ID
        const participants = [userId, otherUserId].sort();
        const conversationId = `${participants[0]}_${participants[1]}`;
        
        // Only count unread messages that were sent to the current user (not sent by them)
        const isUnread = message.receiver_id === userId && !message.read;
        
        if (!conversationsMap[conversationId]) {
          conversationsMap[conversationId] = {
            id: conversationId,
            otherUserId: otherUserId,
            lastMessage: message.content,
            timestamp: message.created_at,
            unread: isUnread ? 1 : 0,
            name: null,
            avatar: null
          };
        } else {
          // For unread count: if ANY message is unread, show 1, otherwise 0
          if (isUnread && conversationsMap[conversationId].unread === 0) {
            conversationsMap[conversationId].unread = 1;
          }
          
          // Update last message if this one is newer
          const currentTimestamp = new Date(conversationsMap[conversationId].timestamp);
          const messageTimestamp = new Date(message.created_at);
          
          if (messageTimestamp > currentTimestamp) {
            conversationsMap[conversationId].lastMessage = message.content;
            conversationsMap[conversationId].timestamp = message.created_at;
          }
        }
      }
      
      // Fetch user profiles for all conversations
      const userIds = Object.values(conversationsMap).map(conv => conv.otherUserId);
      
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', userIds);
        
        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        } else {
          // Add profile info to conversations
          profiles.forEach(profile => {
            Object.values(conversationsMap).forEach(conv => {
              if (conv.otherUserId === profile.id) {
                conv.name = profile.username || profile.full_name || 'User';
                conv.avatar = profile.avatar_url;
              }
            });
          });
        }
      }
      
      // Convert map to array and sort by timestamp
      const conversationsArray = Object.values(conversationsMap)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      setConversations(conversationsArray);
      
      // Update the unread count in the MessageContext
      fetchUnreadCount();
    } catch (error) {
      console.error('Error in fetchConversations:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Format timestamp to relative time
  const formatRelativeTime = (timestamp) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - messageTime) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} min`;
    } else if (diffInMinutes < 24 * 60) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h`;
    } else {
      const days = Math.floor(diffInMinutes / (60 * 24));
      return `${days}d`;
    }
  };
  
  // Filter conversations based on search query
  const filteredConversations = searchQuery
    ? conversations.filter(conv => 
        conv.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: '#330033' }]}>
      <View style={[styles.header, { borderBottomColor: '#440044' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: 'white' }]}>Flexx</Text>
        <TouchableOpacity onPress={() => {}} style={styles.newMessageButton}>
          <Ionicons name="create-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: '#440044' }]}>
        <TextInput
          style={[styles.searchInput, { color: 'white' }]}
          placeholder="Search"
          placeholderTextColor="#999999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Ionicons name="search" size={18} color="#999999" style={styles.searchIcon} />
      </View>

      <ScrollView 
        style={styles.messagesList}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ff00ff" />
            <Text style={[styles.loadingText, { color: '#999999' }]}>Loading conversations...</Text>
          </View>
        ) : filteredConversations.length > 0 ? (
          filteredConversations.map((conversation) => (
            <TouchableOpacity 
              key={conversation.id} 
              style={[styles.messageItem, { borderBottomColor: '#550055' }]}
              onPress={() => {
                // Mark conversation as read before navigating
                handleMarkAsRead(conversation);
                
                // Navigate to the message screen
                navigation.navigate('MessageScreen', { 
                  recipientId: conversation.otherUserId,
                  recipientName: conversation.name,
                  recipientAvatar: conversation.avatar,
                });
              }}
            >
              <View style={styles.avatarContainer}>
                <Image 
                  source={{ uri: conversation.avatar || 'https://via.placeholder.com/50' }} 
                  style={[styles.avatar, { borderColor: '#440044' }]} 
                />
              </View>
              <View style={styles.messageContent}>
                <View style={styles.messageHeader}>
                  <Text style={[styles.name, { color: 'white' }, conversation.unread > 0 && [styles.unreadName, { color: 'white' }]]}>{conversation.name}</Text>
                  <View style={styles.timeContainer}>
                    <Text style={[styles.time, { color: '#999999' }]}>{formatRelativeTime(conversation.timestamp)}</Text>
                    {conversation.unread > 0 && (
                      <View style={[styles.cameraDot, { backgroundColor: '#ff00ff' }]} />
                    )}
                  </View>
                </View>
                <View style={styles.messageFooter}>
                  <Text 
                    style={[styles.messageText, { color: '#999999' }, conversation.unread > 0 && [styles.unreadMessageText, { color: 'white' }]]} 
                    numberOfLines={1}
                  >
                    {conversation.lastMessage}
                  </Text>
                  {conversation.unread > 0 && (
                    <View style={[styles.unreadBadge, { backgroundColor: '#ff00ff' }]}>
                      <Text style={[styles.unreadText, { color: 'white' }]}>●</Text>
                    </View>
                  )}
                </View>
              </View>
             
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: '#999999' }]}>No conversations yet</Text>
            <Text style={[styles.emptySubtext, { color: '#999999' }]}>Start chatting with someone!</Text>
          </View>
        )}
      </ScrollView>
      
      {showNewMessageButton && (
        <TouchableOpacity style={[styles.newMessageFloatingButton, { backgroundColor: '#ff00ff' }]} onPress={() => {}/* Handle new message */}>
          <Ionicons name="create" size={24} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Dynamic background color from ThemeContext
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    // Dynamic border color from ThemeContext
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    // Dynamic text color from ThemeContext
    flex: 1,
    textAlign: 'center',
  },
  newMessageButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // Dynamic background color from ThemeContext
    borderRadius: 10,
    marginHorizontal: 15,
    marginVertical: 10,
    paddingHorizontal: 10,
    height: 36,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 36,
    // Dynamic text color from ThemeContext
    fontSize: 14,
    paddingHorizontal: 5,
  },
  messagesList: {
    flex: 1,
  },
  messageItem: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    // Dynamic border color from ThemeContext
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 0.5,
    // Dynamic border color from ThemeContext
  },
  onlineIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50', // Keep this color as it represents online status
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    // Dynamic border color from ThemeContext
  },
  messageContent: {
    flex: 1,
    justifyContent: 'center',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    // Dynamic text color from ThemeContext
  },
  unreadName: {
    fontWeight: 'bold',
    // Dynamic text color from ThemeContext
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    fontSize: 12,
    // Dynamic text color from ThemeContext
    marginRight: 4,
  },
  cameraDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    // Dynamic background color from ThemeContext
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messageText: {
    fontSize: 14,
    // Dynamic text color from ThemeContext
    flex: 1,
  },
  unreadMessageText: {
    // Dynamic text color from ThemeContext
    fontWeight: 'bold',
  },
  unreadBadge: {
    // Dynamic background color from ThemeContext
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 5,
  },
  unreadText: {
    // Dynamic text color from ThemeContext
    fontSize: 12,
    fontWeight: 'bold',
  },
  cameraButton: {
    padding: 10,
    marginLeft: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  emptyText: {
    fontSize: 16,
    // Dynamic text color from ThemeContext
    textAlign: 'center',
    marginBottom: 20,
  },
  emptySubtext: {
    // Dynamic text color from ThemeContext
    fontSize: 14,
    marginTop: 8,
  },
  newMessageFloatingButton: {
    // Dynamic background color from ThemeContext
    width: 56,
    height: 56,
    borderRadius: 28,
    position: 'absolute',
    bottom: 20,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    // Dynamic text color from ThemeContext
    fontSize: 16,
    marginTop: 10,
  },
});

export default MessagesScreen;