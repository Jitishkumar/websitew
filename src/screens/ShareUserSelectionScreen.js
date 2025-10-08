import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

const ShareUserSelectionScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const [sharePayload, setSharePayload] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [sending, setSending] = useState(false);

  // Get share payload from navigation params
  useEffect(() => {
    if (route?.params?.sharePayload) {
      setSharePayload(route.params.sharePayload);
    }
  }, [route?.params?.sharePayload]);

  // Get current user and fetch conversations
  useEffect(() => {
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
        await fetchConversations(user.id);
      } catch (error) {
        console.error('Error fetching user:', error);
        setLoading(false);
      }
    };
    
    fetchUserAndConversations();
  }, []);

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
        
        if (!conversationsMap[conversationId]) {
          conversationsMap[conversationId] = {
            id: conversationId,
            otherUserId: otherUserId,
            lastMessage: message.content || (message.media_type ? `📷 ${message.media_type}` : 'Message'),
            timestamp: message.created_at,
            name: null,
            avatar: null
          };
        } else {
          // Update last message if this one is newer
          const currentTimestamp = new Date(conversationsMap[conversationId].timestamp);
          const messageTimestamp = new Date(message.created_at);
          
          if (messageTimestamp > currentTimestamp) {
            conversationsMap[conversationId].lastMessage = message.content || (message.media_type ? `📷 ${message.media_type}` : 'Message');
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
      
    } catch (error) {
      console.error('Error in fetchConversations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle user selection
  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Send message to selected users
  const sendToSelectedUsers = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert('No users selected', 'Please select at least one user to share with.');
      return;
    }

    if (!sharePayload) {
      Alert.alert('Nothing to share', 'No content to share.');
      return;
    }

    setSending(true);

    try {
      const promises = selectedUsers.map(async (recipientId) => {
        // Generate conversation ID using the same logic as MessagesScreen
        const participants = [currentUserId, recipientId].sort();
        const conversationId = `${participants[0]}_${participants[1]}`;

        // Create clean message content
        let messageContent = sharePayload.caption || '';
        
        // Add context about the shared content
        if (sharePayload.author) {
          if (sharePayload.from === 'Confession' || sharePayload.from === 'ConfessionPerson') {
            messageContent = `🤫 Shared confession from @${sharePayload.author.username}:\n\n${messageContent}`;
          } else if (sharePayload.media_url) {
            messageContent = `✨ Shared by @${sharePayload.author.username}:\n\n${messageContent}`;
          } else {
            messageContent = `💎 Shared by @${sharePayload.author.username}:\n\n${messageContent}`;
          }
        }

        const messageData = {
          conversation_id: conversationId,
          sender_id: currentUserId,
          receiver_id: recipientId,
          content: messageContent,
          media_url: sharePayload.media_url || null,
          media_type: sharePayload.media_type || null,
          created_at: new Date().toISOString(),
          read: false
        };

        const { error } = await supabase
          .from('messages')
          .insert([messageData]);

        if (error) {
          console.error('Error sending message to user:', recipientId, error);
          throw error;
        }
      });

      await Promise.all(promises);

      Alert.alert(
        'Shared successfully!', 
        `Your content has been shared with ${selectedUsers.length} user${selectedUsers.length > 1 ? 's' : ''}.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );

    } catch (error) {
      console.error('Error sending messages:', error);
      Alert.alert('Error', 'Failed to share content. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Filter conversations based on search query
  const filteredConversations = searchQuery
    ? conversations.filter(conv => 
        (conv.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;

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
          <Text style={styles.headerTitle}>Share with</Text>
          <TouchableOpacity 
            style={[styles.sendButton, selectedUsers.length === 0 && styles.sendButtonDisabled]}
            onPress={sendToSelectedUsers}
            disabled={selectedUsers.length === 0 || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>

        {sharePayload && (
          <View style={styles.sharePreview}>
            <View style={styles.sharePreviewContent}>
              <Text style={styles.sharePreviewTitle}>Sharing this content:</Text>
              <Text style={styles.sharePreviewText} numberOfLines={2}>
                {sharePayload.caption || 'Media content'}
              </Text>
            </View>
          </View>
        )}

        {/* Share to Your Story Button */}
        <TouchableOpacity
          style={styles.shareToStoryButton}
          onPress={() => navigation.navigate('StoryCreation', { sharePayload })}
        >
          <LinearGradient
            colors={['#6c3fd8', '#8b5cf6', '#a78bfa']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shareToStoryGradient}
          >
            <View style={styles.shareToStoryIcon}>
              <Ionicons name="add-circle" size={24} color="#fff" />
            </View>
            <View style={styles.shareToStoryContent}>
              <Text style={styles.shareToStoryTitle}>Share to Your Story</Text>
              <Text style={styles.shareToStorySubtitle}>Add to your story with custom positioning</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
          </LinearGradient>
        </TouchableOpacity>

        {selectedUsers.length > 0 && (
          <View style={styles.selectedUsersContainer}>
            <Text style={styles.selectedUsersTitle}>
              Selected ({selectedUsers.length})
            </Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.selectedUsersList}
            >
              {selectedUsers.map(userId => {
                const user = conversations.find(conv => conv.otherUserId === userId);
                return (
                  <TouchableOpacity 
                    key={userId}
                    style={styles.selectedUserItem}
                    onPress={() => toggleUserSelection(userId)}
                  >
                    <Image 
                      source={{ uri: user?.avatar || 'https://via.placeholder.com/40' }} 
                      style={styles.selectedUserAvatar}
                    />
                    <Text style={styles.selectedUserName} numberOfLines={1}>
                      {user?.name || 'User'}
                    </Text>
                    <View style={styles.removeButton}>
                      <Ionicons name="close" size={16} color="#fff" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="rgba(255,255,255,0.5)" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView 
          style={styles.usersList}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6c3fd8" />
              <Text style={styles.loadingText}>Loading users...</Text>
            </View>
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((conversation) => {
              const isSelected = selectedUsers.includes(conversation.otherUserId);
              return (
                <TouchableOpacity 
                  key={conversation.id} 
                  style={[styles.userItem, isSelected && styles.userItemSelected]}
                  onPress={() => toggleUserSelection(conversation.otherUserId)}
                >
                  <Image 
                    source={{ uri: conversation.avatar || 'https://via.placeholder.com/50' }} 
                    style={styles.avatar}
                  />
                  <View style={styles.userContent}>
                    <Text style={styles.name}>
                      {conversation.name || 'User'}
                    </Text>
                    <Text style={styles.lastMessage} numberOfLines={1}>
                      {conversation.lastMessage || 'No messages yet'}
                    </Text>
                  </View>
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyText}>No users found</Text>
              <Text style={styles.emptySubtext}>Start a conversation to share content!</Text>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
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
  sendButton: {
    backgroundColor: '#6c3fd8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(108,63,216,0.3)',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sharePreview: {
    backgroundColor: 'rgba(108,63,216,0.15)',
    borderColor: '#6c3fd8',
    borderWidth: 1,
    margin: 20,
    padding: 15,
    borderRadius: 12,
  },
  sharePreviewContent: {
    flex: 1,
  },
  sharePreviewTitle: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 5,
  },
  sharePreviewText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  shareToStoryButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#6c3fd8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  shareToStoryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 15,
  },
  shareToStoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareToStoryContent: {
    flex: 1,
  },
  shareToStoryTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 3,
    letterSpacing: 0.3,
  },
  shareToStorySubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  selectedUsersContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  selectedUsersTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  selectedUsersList: {
    flexDirection: 'row',
  },
  selectedUserItem: {
    alignItems: 'center',
    marginRight: 15,
    position: 'relative',
  },
  selectedUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 5,
  },
  selectedUserName: {
    color: '#fff',
    fontSize: 12,
    maxWidth: 60,
    textAlign: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 15,
    marginHorizontal: 20,
    marginBottom: 15,
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
  usersList: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginHorizontal: 10,
    marginVertical: 2,
    borderRadius: 12,
    alignItems: 'center',
  },
  userItemSelected: {
    backgroundColor: 'rgba(108,63,216,0.2)',
    borderColor: '#6c3fd8',
    borderWidth: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  userContent: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#6c3fd8',
    borderColor: '#6c3fd8',
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
  shareToStoryButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#6c3fd8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  shareToStoryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 15,
  },
  shareToStoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareToStoryContent: {
    flex: 1,
  },
  shareToStoryTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  shareToStorySubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
});

export default ShareUserSelectionScreen;
