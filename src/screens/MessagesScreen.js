import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Image, TouchableOpacity, ActivityIndicator, Animated, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useNotifications } from '../context/NotificationContext';
import { useMessages } from '../context/MessageContext';
import { useAccount } from '../context/AccountContext';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MessagesScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { fetchUnreadCount, markConversationAsRead } = useMessages();
  const route = useRoute();
  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false); // Changed to false since we'll load cache first
  const [currentUserId, setCurrentUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewMessageButton, setShowNewMessageButton] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState({});
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' or 'communities'
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  
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
        await fetchGroups(user.id);
        // Delay fetchAllUsers to ensure currentUserId is set
        setTimeout(() => fetchAllUsers(), 100);
        
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
      
      // Fetch blocked users
      const { data: blockedUsers, error: blockedError } = await supabase
        .from('blocked_users')
        .select('*')
        .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
      
      if (blockedError) {
        console.error('Error fetching blocked users:', blockedError);
      }
      
      // Create a set of blocked user IDs for quick lookup
      const blockedUserIds = new Set();
      if (blockedUsers && blockedUsers.length > 0) {
        blockedUsers.forEach(block => {
          if (block.blocker_id === userId) {
            blockedUserIds.add(block.blocked_id);
          } else if (block.blocked_id === userId) {
            blockedUserIds.add(block.blocker_id);
          }
        });
      }
      
      // Group messages by conversation
      const conversationsMap = {};
      
      for (const message of messagesData) {
        // Determine the other user in the conversation
        const otherUserId = message.sender_id === userId ? message.receiver_id : message.sender_id;
        
        // Skip messages from blocked users
        if (blockedUserIds.has(otherUserId)) {
          continue;
        }
        
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
  
  // Fetch groups function - using RPC to completely bypass RLS
  const fetchGroups = async (userId) => {
    try {
      if (!userId) {
        console.log('No user ID provided to fetchGroups');
        setGroups([]);
        return;
      }
      
      // Use RPC function to get all user groups (bypasses RLS completely)
      const { data: allGroups, error } = await supabase
        .rpc('get_all_user_groups', { user_id_param: userId });
      
      if (error) {
        console.error('Error fetching groups:', error);
        setGroups([]);
        return;
      }
      
      // Get member counts and latest messages for each group
      const groupsWithDetails = await Promise.all(
        (allGroups || []).map(async (group) => {
          // Get member count
          const { count: memberCount } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);
          
          // Get latest message
          const { data: latestMessage } = await supabase
            .from('group_messages')
            .select('content, created_at, media_type')
            .eq('group_id', group.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          return {
            ...group,
            memberCount: memberCount || 0,
            lastMessage: latestMessage?.content || (latestMessage?.media_type ? `📷 ${latestMessage.media_type}` : 'No messages yet'),
            timestamp: latestMessage?.created_at || group.created_at
          };
        })
      );
      
      setGroups(groupsWithDetails);
    } catch (error) {
      console.error('Error in fetchGroups:', error);
    }
  };
  
  // Fetch all users for group creation
  const fetchAllUsers = async () => {
    try {
      if (!currentUserId) {
        console.log('No current user ID available');
        return;
      }
      
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .neq('id', currentUserId)
        .limit(100);
      
      if (error) {
        console.error('Error fetching users:', error);
        return;
      }
      
      setAllUsers(users || []);
    } catch (error) {
      console.error('Error in fetchAllUsers:', error);
    }
  };
  
  // Create group function
  const createGroup = async () => {
    console.log('Create group called');
    console.log('Group name:', groupName);
    console.log('Selected members:', selectedMembers);
    console.log('Current user ID:', currentUserId);
    
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name.');
      return;
    }
    
    if (selectedMembers.length === 0) {
      Alert.alert('Error', 'Please select at least one member.');
      return;
    }
    
    if (!currentUserId) {
      Alert.alert('Error', 'User not authenticated. Please try again.');
      return;
    }
    
    try {
      console.log('Creating group with data:', {
        name: groupName.trim(),
        description: groupDescription.trim(),
        created_by: currentUserId
      });
      
      // Create the group
      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: groupName.trim(),
          description: groupDescription.trim(),
          created_by: currentUserId
        })
        .select()
        .single();
      
      console.log('Group creation result:', { newGroup, groupError });
      
      if (groupError) {
        console.error('Error creating group:', groupError);
        Alert.alert('Error', `Failed to create group: ${groupError.message}`);
        return;
      }
      
      // Add selected members to the group
      const memberInserts = selectedMembers.map(memberId => ({
        group_id: newGroup.id,
        user_id: memberId,
        role: 'member'
      }));
      
      const { error: membersError } = await supabase
        .from('group_members')
        .insert(memberInserts);
      
      if (membersError) {
        console.error('Error adding members:', membersError);
        Alert.alert('Error', 'Group created but failed to add some members.');
      }
      
      // Reset form and close modal
      setGroupName('');
      setGroupDescription('');
      setSelectedMembers([]);
      setShowCreateGroupModal(false);
      
      // Refresh groups
      await fetchGroups(currentUserId);
      
      Alert.alert('Success', 'Group created successfully!');
    } catch (error) {
      console.error('Error in createGroup:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    }
  };
  
  // Filter conversations based on search query
  const filteredConversations = searchQuery
    ? conversations.filter(conv => 
        (conv.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (conv.lastMessage || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;
  
  // Filter groups based on search query
  const filteredGroups = searchQuery
    ? groups.filter(group => 
        (group.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (group.description || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : groups;

  // Manual refresh function
  const handleRefresh = () => {
    console.log('Manual refresh triggered');
    if (currentUserId) {
      fetchConversations();
      fetchGroups(currentUserId);
    }
  };

  // Refresh groups when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (currentUserId) {
        console.log('Screen focused, refreshing groups');
        fetchGroups(currentUserId);
      }
    }, [currentUserId])
  );

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['rgba(102, 126, 234, 0.3)', 'rgba(156, 136, 255, 0.2)', 'transparent']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <LinearGradient
            colors={['rgba(102, 126, 234, 0.8)', 'rgba(156, 136, 255, 0.6)']}
            style={styles.backButtonGradient}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>💬 Messages</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <LinearGradient
            colors={['rgba(255, 107, 107, 0.8)', 'rgba(255, 82, 82, 0.6)']}
            style={styles.headerIconGradient}
          >
            <Ionicons 
              name={refreshing ? "refresh" : "refresh-outline"} 
              size={20} 
              color="#fff" 
              style={refreshing ? { transform: [{ rotate: '180deg' }] } : {}}
            />
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>

        <LinearGradient
          colors={['rgba(102, 126, 234, 0.1)', 'rgba(156, 136, 255, 0.05)']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.searchContainer}
        >
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.04)']}
            style={styles.searchInputContainer}
          >
            <Ionicons name="search" size={20} color="rgba(255,255,255,0.6)" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="🔍 Search conversations..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchLoading && (
              <ActivityIndicator size="small" color="#667eea" style={styles.searchLoader} />
            )}
          </LinearGradient>
        </LinearGradient>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'inbox' && styles.activeTab]}
            onPress={() => setActiveTab('inbox')}
          >
            <LinearGradient
              colors={activeTab === 'inbox' ? 
                ['rgba(102, 126, 234, 0.3)', 'rgba(156, 136, 255, 0.2)'] : 
                ['transparent', 'transparent']}
              style={styles.tabGradient}
            >
              <Text style={[styles.tabText, activeTab === 'inbox' && styles.activeTabText]}>Inbox</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'communities' && styles.activeTab]}
            onPress={() => setActiveTab('communities')}
          >
            <LinearGradient
              colors={activeTab === 'communities' ? 
                ['rgba(102, 126, 234, 0.3)', 'rgba(156, 136, 255, 0.2)'] : 
                ['transparent', 'transparent']}
              style={styles.tabGradient}
            >
              <Text style={[styles.tabText, activeTab === 'communities' && styles.activeTabText]}>Communities</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.messagesList}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#667eea" />
              <Text style={styles.loadingText}>Loading conversations...</Text>
            </View>
          ) : activeTab === 'inbox' ? (
            filteredConversations.length > 0 ? (
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
                <LinearGradient
                  colors={conversation.unread > 0 ? 
                    ['rgba(102, 126, 234, 0.2)', 'rgba(156, 136, 255, 0.1)'] : 
                    ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']}
                  style={styles.messageItemGradient}
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
                  <LinearGradient
                    colors={['rgba(255, 107, 107, 0.9)', 'rgba(255, 82, 82, 0.8)']}
                    style={styles.unreadBadge}
                  >
                    <Text style={styles.unreadText}>
                      {conversation.unread > 99 ? '99+' : conversation.unread}
                    </Text>
                  </LinearGradient>
                )}
                </LinearGradient>
              </TouchableOpacity>
            ))
            ) : (
              <LinearGradient
                colors={['rgba(102, 126, 234, 0.1)', 'rgba(156, 136, 255, 0.05)']}  
                style={styles.emptyContainer}
              >
                <LinearGradient
                  colors={['rgba(102, 126, 234, 0.3)', 'rgba(156, 136, 255, 0.2)']}  
                  style={styles.emptyIconContainer}
                >
                  <Ionicons name="chatbubbles-outline" size={32} color="#fff" />
                </LinearGradient>
                <Text style={styles.emptyText}>No conversations yet</Text>
                <Text style={styles.emptySubtext}>Start connecting with people!</Text>
              </LinearGradient>
            )
          ) : (
            // Communities tab content
            filteredGroups.length > 0 ? (
              filteredGroups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  onPress={() => navigation.navigate('GroupChatScreen', { 
                    groupId: group.id, 
                    groupName: group.name 
                  })}
                  onLongPress={() => {
                    console.log('Group info pressed for group:', group.id);
                    try {
                      navigation.navigate('GroupInfoScreen', { 
                        groupId: group.id 
                      });
                    } catch (error) {
                      console.error('Navigation error:', error);
                    }
                  }}
                  delayLongPress={500}
                >
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.04)']}
                    style={styles.messageItemGradient}
                  >
                    <View style={styles.avatarContainer}>
                      {group.avatar_url ? (
                        <Image 
                          source={{ uri: group.avatar_url }} 
                          style={styles.groupAvatarImage}
                        />
                      ) : (
                        <LinearGradient
                          colors={['rgba(102, 126, 234, 0.8)', 'rgba(156, 136, 255, 0.8)']}
                          style={styles.groupAvatar}
                        >
                          <Text style={styles.groupAvatarText}>
                            {group.name ? group.name.charAt(0).toUpperCase() : 'G'}
                          </Text>
                        </LinearGradient>
                      )}
                    </View>
                    <View style={styles.messageContent}>
                      <View style={styles.messageHeader}>
                        <Text style={styles.groupName}>
                          {group.name}
                        </Text>
                        <Text style={styles.time}>{formatRelativeTime(group.timestamp)}</Text>
                      </View>
                      <View style={styles.lastMessageContainer}>
                        <Text style={styles.memberCount}>
                          {group.memberCount} members
                        </Text>
                        <Text 
                          style={styles.messageText} 
                          numberOfLines={1}
                        >
                          {group.lastMessage}
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))
            ) : (
              <LinearGradient
                colors={['rgba(102, 126, 234, 0.1)', 'rgba(156, 136, 255, 0.05)']}  
                style={styles.emptyContainer}
              >
                <LinearGradient
                  colors={['rgba(255, 107, 107, 0.3)', 'rgba(255, 82, 82, 0.2)']}  
                  style={styles.emptyIconContainer}
                >
                  <Ionicons name="people-outline" size={32} color="#fff" />
                </LinearGradient>
                <Text style={styles.emptyText}>No groups yet</Text>
                <Text style={styles.emptySubtext}>Create or join a group to get started!</Text>
              </LinearGradient>
            )
          )}
        </ScrollView>
      
      {showNewMessageButton && (
        <TouchableOpacity 
          style={[styles.newMessageFloatingButton, { bottom: insets.bottom + 80 }]}
          onPress={() => {
            if (activeTab === 'inbox') {
              // Navigate to create new message
              console.log('Navigate to create new message');
            } else {
              // Navigate to create group screen
              navigation.navigate('CreateGroupScreen');
            }
          }}
        >
          <LinearGradient
            colors={activeTab === 'communities' ? 
              ['rgba(255, 107, 107, 0.9)', 'rgba(255, 82, 82, 0.8)'] :
              ['rgba(102, 126, 234, 0.9)', 'rgba(156, 136, 255, 0.8)']}
            style={styles.gradientButton}
          >
            <Ionicons name={activeTab === 'communities' ? 'add' : 'create'} size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Create Group Modal */}
      <Modal
        visible={showCreateGroupModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateGroupModal(false)}
      >
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f3460']}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Group</Text>
              <TouchableOpacity onPress={() => setShowCreateGroupModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Group Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter group name"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={groupName}
                  onChangeText={(text) => {
                    console.log('Group name changed:', text);
                    setGroupName(text);
                  }}
                  maxLength={50}
                  autoFocus={true}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Description (Optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Enter group description"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={groupDescription}
                  onChangeText={setGroupDescription}
                  multiline
                  numberOfLines={3}
                  maxLength={200}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Add Members * ({allUsers.length} users available)</Text>
                {allUsers.length === 0 ? (
                  <Text style={styles.noUsersText}>Loading users...</Text>
                ) : (
                  <ScrollView style={styles.membersList} nestedScrollEnabled>
                    {allUsers.map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      style={[
                        styles.memberItem,
                        selectedMembers.includes(user.id) && styles.selectedMemberItem
                      ]}
                      onPress={() => {
                        console.log('Member selected:', user.id, user.username);
                        if (selectedMembers.includes(user.id)) {
                          const newSelected = selectedMembers.filter(id => id !== user.id);
                          console.log('Removing member, new list:', newSelected);
                          setSelectedMembers(newSelected);
                        } else {
                          const newSelected = [...selectedMembers, user.id];
                          console.log('Adding member, new list:', newSelected);
                          setSelectedMembers(newSelected);
                        }
                      }}
                    >
                      <Image
                        source={{ uri: user.avatar_url || 'https://via.placeholder.com/40' }}
                        style={styles.memberAvatar}
                      />
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>
                          {user.username || user.full_name || 'User'}
                        </Text>
                      </View>
                      {selectedMembers.includes(user.id) && (
                        <Ionicons name="checkmark-circle" size={20} color="#00ff88" />
                      )}
                    </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCreateGroupModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createButton}
                onPress={createGroup}
              >
                <LinearGradient
                  colors={['rgba(255, 107, 107, 0.9)', 'rgba(255, 82, 82, 0.8)']}
                  style={styles.createButtonGradient}
                >
                  <Text style={styles.createButtonText}>Create Group</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    borderBottomColor: 'rgba(102, 126, 234, 0.3)',
  },
  backButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  headerIconGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff6b6b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
    flex: 1,
  },
  refreshButton: {
    padding: 5,
  },
  searchContainer: {
    marginHorizontal: 20,
    marginVertical: 15,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    height: 45,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.3)',
    borderRadius: 15,
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
    marginHorizontal: 10,
    marginVertical: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  messageItemGradient: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: '#00ff88',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 3,
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
    color: '#9c88ff',
    fontWeight: '700',
    textShadowColor: 'rgba(156, 136, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginLeft: 8,
    alignSelf: 'center',
    shadowColor: '#ff6b6b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
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
    shadowColor: '#667eea',
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
    paddingHorizontal: 40,
    paddingVertical: 60,
    marginHorizontal: 20,
    marginVertical: 40,
    borderRadius: 20,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  emptyText: {
    fontSize: 20,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
    marginTop: 20,
    textShadowColor: 'rgba(102, 126, 234, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  emptySubtext: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: '#ff6b6b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
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
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tab: {
    flex: 1,
  },
  tabGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  activeTab: {
    // Additional styling handled by gradient
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  activeTabText: {
    color: '#fff',
    textShadowColor: 'rgba(102, 126, 234, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Group styles
  groupAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    backgroundColor: 'rgba(102, 126, 234, 0.8)'
  },
  groupAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.1)'
  },
  groupAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '95%',
    height: '85%',
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalBody: {
    flex: 1,
    paddingBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 18,
    color: '#fff',
    fontSize: 17,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.3)',
    minHeight: 55,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  membersList: {
    maxHeight: 250,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 10,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 5,
  },
  selectedMemberItem: {
    backgroundColor: 'rgba(102, 126, 234, 0.2)',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingHorizontal: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'transparent',
  },
  cancelButton: {
    flex: 1,
    marginRight: 10,
    padding: 15,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    marginLeft: 10,
  },
  createButtonGradient: {
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noUsersText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
});

export default MessagesScreen;