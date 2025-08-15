import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Image, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { useNavigation } from '@react-navigation/native';
import { useMessages } from '../context/MessageContext';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MessagesScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { fetchUnreadCount, markConversationAsRead } = useMessages();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false); // Changed to false since we'll load cache first
  const [currentUserId, setCurrentUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewMessageButton, setShowNewMessageButton] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState({});
  
  // Cache keys
  const CONVERSATIONS_CACHE_KEY = 'conversations_cache';
  const CONVERSATIONS_METADATA_KEY = 'conversations_metadata';
  
  // Function to mark a conversation as read
  const handleMarkAsRead = async (conversation) => {
    if (!conversation || !currentUserId) return;
    
    try {
      // Only proceed if there are unread messages
      if (conversation.unread > 0) {
        // Use the MessageContext to mark conversation as read
        await markConversationAsRead(conversation.id);
        
        // Update the local state to reflect read status (show 0 unread)
        const updatedConversations = conversations.map(conv => 
          conv.id === conversation.id 
            ? { ...conv, unread: 0 } 
            : conv
        );
        
        setConversations(updatedConversations);
        
        // Update cache immediately
        await saveCachedConversations(updatedConversations);
        
        console.log(`Marked conversation as read: ${conversation.id}`);
      }
    } catch (error) {
      console.error('Error in handleMarkAsRead:', error);
    }
  };
  
  // Cache management functions
  const saveCachedConversations = async (conversationsData) => {
    try {
      const cacheData = {
        conversations: conversationsData,
        lastUpdated: new Date().toISOString(),
        userId: currentUserId
      };
      
      await AsyncStorage.setItem(CONVERSATIONS_CACHE_KEY, JSON.stringify(cacheData));
      
      // Also save metadata for quick access
      const metadata = {
        count: conversationsData.length,
        lastUpdated: new Date().toISOString(),
        userId: currentUserId
      };
      
      await AsyncStorage.setItem(CONVERSATIONS_METADATA_KEY, JSON.stringify(metadata));
      
      console.log(`Cached ${conversationsData.length} conversations`);
    } catch (error) {
      console.error('Error saving conversations cache:', error);
    }
  };
  
  const loadCachedConversations = async (userId) => {
    try {
      const cachedData = await AsyncStorage.getItem(CONVERSATIONS_CACHE_KEY);
      
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        
        // Check if cache is for the current user
        if (parsed.userId === userId) {
          console.log(`Loaded ${parsed.conversations.length} conversations from cache`);
          return parsed.conversations;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error loading conversations cache:', error);
      return null;
    }
  };
  
  const clearOldCache = async (userId) => {
    try {
      // Clear cache if it's for a different user
      const metadata = await AsyncStorage.getItem(CONVERSATIONS_METADATA_KEY);
      if (metadata) {
        const parsed = JSON.parse(metadata);
        if (parsed.userId !== userId) {
          await AsyncStorage.removeItem(CONVERSATIONS_CACHE_KEY);
          await AsyncStorage.removeItem(CONVERSATIONS_METADATA_KEY);
          console.log('Cleared old cache for different user');
        }
      }
    } catch (error) {
      console.error('Error clearing old cache:', error);
    }
  };
  
  const getCacheAge = async () => {
    try {
      const metadata = await AsyncStorage.getItem(CONVERSATIONS_METADATA_KEY);
      if (metadata) {
        const parsed = JSON.parse(metadata);
        const cacheTime = new Date(parsed.lastUpdated);
        const now = new Date();
        const ageInMinutes = (now - cacheTime) / (1000 * 60);
        return ageInMinutes;
      }
      return Infinity; // If no cache, return infinity (very old)
    } catch (error) {
      console.error('Error getting cache age:', error);
      return Infinity;
    }
  };
  
  // Get current user and set up subscriptions
  useEffect(() => {
    let subscription = null;
    let readStatusSubscription = null;
    let settingsSubscription = null;
    
    const fetchUserAndSetupConversations = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('User not authenticated');
          navigation.navigate('Login');
          return;
        }
        
        setCurrentUserId(user.id);
        
        // Clear old cache for different users
        await clearOldCache(user.id);
        
        // Load cached conversations first for immediate display
        const cachedConversations = await loadCachedConversations(user.id);
        if (cachedConversations && cachedConversations.length > 0) {
          setConversations(cachedConversations);
          console.log('Displaying cached conversations');
        }
        
        // Check cache age to decide if we need to refresh
        const cacheAge = await getCacheAge();
        const shouldRefreshCache = cacheAge > 5; // Refresh if cache is older than 5 minutes
        
        // Always fetch fresh data, but don't show loading if we have recent cache
        if (shouldRefreshCache || !cachedConversations) {
          setRefreshing(true);
        }
        
        await fetchConversations(user.id, !cachedConversations);
        
        // Set up real-time subscription for new messages
        subscription = supabase
          .channel('messages_' + user.id + '_' + Date.now())
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${user.id}`
          }, (payload) => {
            console.log('New message received:', payload.eventType);
            // Refresh conversations when new message arrives
            fetchConversations(user.id, false);
          })
          .subscribe();
          
        // Listen for user settings changes
        settingsSubscription = supabase
          .channel('public:user_message_settings')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'user_message_settings' },
            (payload) => {
              console.log('Settings change received!', payload);
              const { new: newSettings } = payload;
              if (newSettings) {
                setOnlineStatus(prevStatus => ({
                  ...prevStatus,
                  [newSettings.user_id]: {
                    ...prevStatus[newSettings.user_id],
                    is_online: newSettings.show_online_status && (new Date() - new Date(newSettings.last_active)) < 300000,
                    last_active: newSettings.last_active
                  }
                }));
              }
            }
          )
          .subscribe();

        // Listen for updates to read status with a different channel name
        readStatusSubscription = supabase
          .channel('read_status_' + user.id + '_' + Date.now())
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages'
          }, (payload) => {
            console.log('Message update detected:', payload.new.id, 'Read:', payload.new.read);
            // Refresh conversations when messages are marked as read
            fetchConversations(user.id, false);
          })
          .subscribe();
          
      } catch (error) {
        console.error('Error fetching user:', error);
        setLoading(false);
        setRefreshing(false);
      }
    };
    
    fetchUserAndSetupConversations();
    
    // Clean up subscriptions when component unmounts
    return () => {
      if (subscription) supabase.removeChannel(subscription);
      if (readStatusSubscription) supabase.removeChannel(readStatusSubscription);
      if (settingsSubscription) supabase.removeChannel(settingsSubscription);
    };
  }, []);
  
  // Refresh conversations when the screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (currentUserId) {
        console.log('Screen focused, checking for conversation updates');
        // Don't show loading, just refresh in background
        fetchConversations(currentUserId, false);
      }
    });
    
    return unsubscribe;
  }, [navigation, currentUserId]);
  
  // Enhanced fetch conversations function with better caching
  const fetchConversations = async (userId, showLoadingIndicator = true) => {
    try {
      if (showLoadingIndicator) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      
      // Get all messages where current user is sender or receiver
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });
      
      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        
        // If server request fails, try to use cached data as fallback
        if (!conversations || conversations.length === 0) {
          const cachedConversations = await loadCachedConversations(userId);
          if (cachedConversations) {
            setConversations(cachedConversations);
            console.log('Using cached conversations as fallback');
          }
        }
        
        setLoading(false);
        setRefreshing(false);
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
            lastMessage: message.content || (message.media_type ? `📷 ${message.media_type}` : 'Message'),
            timestamp: message.created_at,
            unread: isUnread ? 1 : 0,
            name: null,
            avatar: null,
            hasMedia: !!message.media_url
          };
        } else {
          // Count all unread messages for this conversation
          if (isUnread) {
            conversationsMap[conversationId].unread += 1;
          }
          
          // Update last message if this one is newer
          const currentTimestamp = new Date(conversationsMap[conversationId].timestamp);
          const messageTimestamp = new Date(message.created_at);
          
          if (messageTimestamp > currentTimestamp) {
            conversationsMap[conversationId].lastMessage = message.content || (message.media_type ? `📷 ${message.media_type}` : 'Message');
            conversationsMap[conversationId].timestamp = message.created_at;
            conversationsMap[conversationId].hasMedia = !!message.media_url;
          }
        }
      }
      
      // Fetch user profiles and online status for all conversations
      const userIds = Object.values(conversationsMap).map(conv => conv.otherUserId);

      if (userIds.length > 0) {
        // Fetch online status for each user individually
        const statusMap = {};
        
        for (const userId of userIds) {
          try {
            const { data, error } = await supabase.rpc('get_user_online_status', { p_user_id: userId });
            
            if (error) {
              console.error(`Error fetching online status for user ${userId}:`, error);
            } else if (data && data.length > 0) {
              statusMap[userId] = {
                user_id: userId,
                is_online: data[0].is_online,
                last_active: data[0].last_active_time
              };
            }
          } catch (err) {
            console.error(`Exception fetching online status for user ${userId}:`, err);
          }
        }
        
        setOnlineStatus(statusMap)
      }
      
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
      
      // Only update state if the data is different
      const currentDataString = JSON.stringify(conversations);
      const newDataString = JSON.stringify(conversationsArray);
      
      if (currentDataString !== newDataString) {
        setConversations(conversationsArray);
        
        // Save to cache
        await saveCachedConversations(conversationsArray);
        
        console.log(`Fetched and cached ${conversationsArray.length} conversations`);
      } else {
        console.log('Conversations data unchanged, skipping update');
      }
      
      // Update the unread count in the MessageContext
      fetchUnreadCount();
      
    } catch (error) {
      console.error('Error in fetchConversations:', error);
      
      // On error, try to load cached data if we don't have any
      if (!conversations || conversations.length === 0) {
        const cachedConversations = await loadCachedConversations(userId);
        if (cachedConversations) {
          setConversations(cachedConversations);
          console.log('Loaded cached conversations after error');
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
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
        (conv.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (conv.lastMessage || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;

  // Manual refresh function
  const handleRefresh = async () => {
    if (currentUserId) {
      console.log('Manual refresh triggered');
      setRefreshing(true);
      await fetchConversations(currentUserId, false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#1a0f2e', '#2a1f3e']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Messages</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <Ionicons 
              name={refreshing ? "refresh" : "refresh-outline"} 
              size={24} 
              color="#fff" 
              style={refreshing ? { transform: [{ rotate: '180deg' }] } : {}}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="rgba(255,255,255,0.5)" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {refreshing && (
            <ActivityIndicator size="small" color="#6c3fd8" style={styles.searchLoader} />
          )}
        </View>

        <ScrollView 
          style={styles.messagesList}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6c3fd8" />
              <Text style={styles.loadingText}>Loading conversations...</Text>
            </View>
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((conversation) => (
              <TouchableOpacity 
                key={conversation.id} 
                style={styles.messageItem}
                onPress={() => {
                  handleMarkAsRead(conversation);
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
                    style={styles.avatar}
                  />
                  {onlineStatus[conversation.otherUserId]?.is_online && (
                    <View style={styles.onlineIndicator} />
                  )}
                </View>
                <View style={styles.messageContent}>
                  <View style={styles.messageHeader}>
                    <Text style={[styles.name, conversation.unread > 0 && styles.unreadName]}>
                      {conversation.name || 'User'}
                    </Text>
                    <Text style={styles.time}>{formatRelativeTime(conversation.timestamp)}</Text>
                  </View>
                  <View style={styles.lastMessageContainer}>
                    {conversation.hasMedia && (
                      <Ionicons name="image" size={16} color="rgba(255,255,255,0.5)" style={styles.mediaIcon} />
                    )}
                    <Text 
                      style={[styles.messageText, conversation.unread > 0 && styles.unreadMessageText]} 
                      numberOfLines={1}
                    >
                      {conversation.lastMessage || 'No message'}
                    </Text>
                  </View>
                </View>
                {conversation.unread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>
                      {conversation.unread > 99 ? '99+' : conversation.unread}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySubtext}>Start connecting with people!</Text>
              {!loading && !refreshing && (
                <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
                  <Text style={styles.retryButtonText}>Refresh</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </LinearGradient>
      
      {showNewMessageButton && (
        <TouchableOpacity 
          style={styles.newMessageFloatingButton}
          onPress={() => {
            // You can implement navigation to a new message screen here
            console.log('New message button pressed');
          }}
        >
          <LinearGradient
            colors={['#8a5cf5', '#6c3fd8']}
            style={styles.gradientButton}
          >
            <Ionicons name="create" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a0f2e',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(26,15,46,0.98)',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    letterSpacing: 1,
  },
  refreshButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 15,
    marginHorizontal: 20,
    marginVertical: 15,
    paddingHorizontal: 15,
    height: 45,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 45,
    color: '#fff',
    fontSize: 16,
  },
  searchLoader: {
    marginLeft: 10,
  },
  messagesList: {
    flex: 1,
  },
  messageItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginHorizontal: 10,
    marginVertical: 2,
    borderRadius: 12,
  },
  avatarContainer: {
    marginRight: 15,
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 15,
    width: 15,
    height: 15,
    borderRadius: 10,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#fff',
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
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
    flex: 1,
  },
  unreadName: {
    color: '#8a5cf5',
    fontWeight: '700',
  },
  time: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginLeft: 10,
  },
  lastMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mediaIcon: {
    marginRight: 6,
  },
  messageText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
    flex: 1,
  },
  unreadMessageText: {
    color: '#fff',
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: '#6c3fd8',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginLeft: 8,
    alignSelf: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  newMessageFloatingButton: {
    position: 'absolute',
    bottom: 25,
    right: 25,
    elevation: 8,
    shadowColor: '#6c3fd8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  gradientButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    backgroundColor: 'rgba(255,255,255,0.02)',
    margin: 20,
    borderRadius: 20,
    paddingVertical: 40,
    minHeight: 300,
  },
  emptyText: {
    fontSize: 20,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#6c3fd8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
    minHeight: 300,
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 15,
    fontWeight: '500',
  },
});

export default MessagesScreen;