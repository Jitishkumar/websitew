import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../context/NotificationContext';

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { markAsRead: markNotificationAsRead } = useNotifications();

  // Sample notifications data
  const sampleNotifications = [
    {
      id: '1',
      type: 'like',
      content: 'liked your post',
      sender: {
        username: 'johndoe',
        avatar_url: 'https://via.placeholder.com/50',
      },
      created_at: '2023-05-15T10:30:00Z',
      is_read: false,
    },
    {
      id: '2',
      type: 'comment',
      content: 'commented on your post: "Great content!"',
      sender: {
        username: 'janedoe',
        avatar_url: 'https://via.placeholder.com/50',
      },
      created_at: '2023-05-14T15:45:00Z',
      is_read: true,
    },
    {
      id: '3',
      type: 'follow',
      content: 'started following you',
      sender: {
        username: 'marksmith',
        avatar_url: 'https://via.placeholder.com/50',
      },
      created_at: '2023-05-13T09:20:00Z',
      is_read: false,
    },
    {
      id: '4',
      type: 'mention',
      content: 'mentioned you in a comment: "@username check this out"',
      sender: {
        username: 'sarahconnor',
        avatar_url: 'https://via.placeholder.com/50',
      },
      created_at: '2023-05-12T18:10:00Z',
      is_read: true,
    },
    {
      id: '5',
      type: 'like',
      content: 'liked your comment',
      sender: {
        username: 'alexjones',
        avatar_url: 'https://via.placeholder.com/50',
      },
      created_at: '2023-05-11T14:30:00Z',
      is_read: true,
    },
  ];

  useEffect(() => {
    // Fetch real notifications from the database
    fetchNotifications();
    
    // Set up real-time subscription for new notifications
    const notificationsSubscription = supabase
      .channel('public:notifications')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'notifications' }, 
        (payload) => {
          // When a new notification is created, refresh the notifications
          fetchNotifications();
      })
      .subscribe();
      
    // Clean up subscription when component unmounts
    return () => {
      supabase.removeChannel(notificationsSubscription);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // First fetch notifications
        const { data: notificationsData, error: notificationsError } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_id', user.id)
          .order('created_at', { ascending: false });
          
        if (notificationsError) throw notificationsError;
        
        // Then fetch sender profiles for each notification
        const notificationsWithSenders = await Promise.all(
          (notificationsData || []).map(async (notification) => {
            // Get sender profile
            const { data: senderData, error: senderError } = await supabase
              .from('profiles')
              .select('id, username, avatar_url')
              .eq('id', notification.sender_id)
              .single();
              
            if (senderError) {
              console.error('Error fetching sender profile:', senderError);
              return {
                ...notification,
                sender: {
                  username: 'unknown',
                  avatar_url: null
                }
              };
            }
            
            return {
              ...notification,
              sender: senderData
            };
          })
        );
        
        // We don't need to fetch follow requests separately as they're already in the notifications table
        // This was causing duplicate notifications
        
        // Just use the notifications we already fetched
        setNotifications(notificationsWithSenders);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      // Use the context function to mark as read
      const success = await markNotificationAsRead(notificationId);
      
      if (success) {
        // Update local state
        setNotifications(prevNotifications =>
          prevNotifications.map(notification => 
            notification.id === notificationId 
              ? { ...notification, is_read: true } 
              : notification
          )
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }
    
    return date.toLocaleDateString();
  };

  const handleNotificationPress = async (notification) => {
    await markAsRead(notification.id);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigation.navigate('Login');
        return;
      }

      // Handle navigation based on notification type
      switch (notification.type) {
        case 'like':
        case 'comment':
        case 'mention': {
          if (!notification.reference_id) {
            Alert.alert('Error', 'Reference ID not found for this notification.');
            return;
          }

          // Determine if it's a post comment or a confession comment
          const { data: postComment, error: postCommentError } = await supabase
            .from('post_comments')
            .select('post_id')
            .eq('id', notification.reference_id)
            .maybeSingle();
          
          if (postCommentError && postCommentError.code !== 'PGRST116') throw postCommentError;

          if (postComment) {
            navigation.navigate('Comment', { 
              postId: postComment.post_id, 
              highlightCommentId: notification.reference_id 
            });
            return;
          }

          const { data: confessionComment, error: confessionCommentError } = await supabase
            .from('confession_comments')
            .select('confession_id')
            .eq('id', notification.reference_id)
            .maybeSingle();

          if (confessionCommentError && confessionCommentError.code !== 'PGRST116') throw confessionCommentError;

          if (confessionComment) {
            navigation.navigate('ConfessionComment', { 
              confessionId: confessionComment.confession_id, 
              highlightCommentId: notification.reference_id 
            });
            return;
          }

          Alert.alert('Error', 'Could not find referenced post or confession for this comment/mention.');
          break;
        }
        case 'follow':
        case 'follow_request':
        case 'follow_accepted': {
          // Existing logic for profile navigation
          // Check if the profile is private and if the current user is following them
          const { data: settingsData, error: settingsError } = await supabase
            .from('user_settings')
            .select('private_account')
            .eq('user_id', notification.sender_id)
            .maybeSingle();

          if (settingsError) throw settingsError;

          const isPrivate = settingsData?.private_account ?? false;

          if (isPrivate) {
            const { data: followData, error: followError } = await supabase
              .from('follows')
              .select('*')
              .eq('follower_id', user.id)
              .eq('following_id', notification.sender_id)
              .eq('status', 'accepted')
              .maybeSingle();

            if (followError) throw followError;

            if (!followData) {
              navigation.navigate('PrivateProfileScreen', { userId: notification.sender_id });
              return;
            }
          }
          navigation.navigate('UserProfileScreen', { userId: notification.sender_id });
          break;
        }
        default:
          Alert.alert('Info', 'This notification type does not have a specific navigation target.');
      }

    } catch (error) {
      console.error('Error handling notification press:', error);
      Alert.alert('Error', 'Failed to navigate. Please try again.');
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like':
        return <Ionicons name="heart" size={20} color="#ff00ff" />;
      case 'comment':
        return <Ionicons name="chatbubble" size={20} color="#0084ff" />;
      case 'follow':
        return <Ionicons name="person-add" size={20} color="#00cc99" />;
      case 'follow_request':
        return <Ionicons name="person-add-outline" size={20} color="#ff9900" />;
      case 'follow_accepted':
        return <Ionicons name="checkmark-circle" size={20} color="#00cc99" />;
      case 'mention':
        return <Ionicons name="at" size={20} color="#ffcc00" />;
      default:
        return <Ionicons name="notifications" size={20} color="#999" />;
    }
  };

  const handleAcceptFollowRequest = async (senderId, notificationId) => {
    try {
      let requestId;
      
      // Get the notification to find the reference_id (which should be the follow request ID)
      const { data: notificationData, error: notificationError } = await supabase
        .from('notifications')
        .select('reference_id')
        .eq('id', notificationId)
        .single();
        
      if (notificationError || !notificationData?.reference_id) {
        // Fallback: get the follow request ID from the database
        const { data: requestData, error: requestError } = await supabase
          .from('follow_requests')
          .select('id')
          .eq('sender_id', senderId)
          .eq('recipient_id', (await supabase.auth.getUser()).data.user.id)
          .eq('status', 'pending')
          .single();
          
        if (requestError) {
          console.error('Error finding follow request:', requestError);
          return;
        }
        
        requestId = requestData.id;
      } else {
        requestId = notificationData.reference_id;
      }
      
      // Call the accept_follow_request function
      const { error } = await supabase
        .rpc('accept_follow_request', {
          request_id: requestId
        });
        
      if (error) {
        console.error('Error accepting follow request:', error);
        Alert.alert('Error', 'Could not accept follow request. Please try again.');
      } else {
        // Remove this notification from the list
        setNotifications(prevNotifications => 
          prevNotifications.filter(notification => notification.id !== notificationId)
        );
        
        // Show success message and navigate to the user's profile
        Alert.alert(
          'Success', 
          'Follow request accepted', 
          [
            { 
              text: 'View Profile', 
              onPress: async () => {
                try {
                  // Get the current user's ID
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) {
                    navigation.navigate('Login');
                    return;
                  }

                  // Since the follow request was just accepted, we can navigate directly to UserProfile
                  navigation.navigate('UserProfileScreen', { userId: senderId });
                } catch (error) {
                  console.error('Error navigating to profile:', error);
                  navigation.navigate('UserProfileScreen', { userId: senderId });
                }
              }
            },
            { text: 'OK' }
          ]
        );
      }
    } catch (error) {
      console.error('Error accepting follow request:', error);
    }
  };
  
  const handleDeclineFollowRequest = async (senderId, notificationId) => {
    try {
      let requestId;
      
      // Get the notification to find the reference_id (which should be the follow request ID)
      const { data: notificationData, error: notificationError } = await supabase
        .from('notifications')
        .select('reference_id')
        .eq('id', notificationId)
        .single();
        
      if (notificationError || !notificationData.reference_id) {
        // Fallback: update based on sender and recipient IDs
        const { data: requestData, error: requestError } = await supabase
          .from('follow_requests')
          .select('id')
          .eq('sender_id', senderId)
          .eq('recipient_id', (await supabase.auth.getUser()).data.user.id)
          .eq('status', 'pending')
          .single();
          
        if (requestError) {
          console.error('Error finding follow request:', requestError);
          return;
        }
        
        requestId = requestData.id;
      } else {
        requestId = notificationData.reference_id;
      }
      
      // Call the decline_follow_request function
      const { data, error } = await supabase
        .rpc('decline_follow_request', {
          request_id: requestId
        });
        
      if (error) {
        console.error('Error declining follow request:', error);
        Alert.alert('Error', 'Could not decline follow request. Please try again.');
        return;
      }
      
      // Remove this notification from the list
      setNotifications(prevNotifications => 
        prevNotifications.filter(notification => notification.id !== notificationId)
      );
      
      // Show success message
      Alert.alert('Success', 'Follow request declined');
    } catch (error) {
      console.error('Error declining follow request:', error);
    }
  };

  const renderNotificationItem = ({ item }) => {
    // Check if this is a follow request notification
    const isFollowRequest = item.type === 'follow_request';
    
    return (
      <View style={[styles.notificationItem, !item.is_read && styles.unreadItem]}>
        <TouchableOpacity 
          style={styles.avatarContainer}
          onPress={() => handleNotificationPress(item)} // Use the new handler here
        >
          <Image 
            source={{ uri: item.sender.avatar_url }}
            style={styles.avatar}
          />
          <View style={styles.iconOverlay}>
            {getNotificationIcon(item.type)}
          </View>
        </TouchableOpacity>
        
        <View style={styles.contentContainer}>
          <TouchableOpacity 
            onPress={() => handleNotificationPress(item)} // Use the new handler here
          >
            <Text style={styles.username}>@{item.sender.username}</Text>
          </TouchableOpacity>
          <Text style={styles.content}>{item.content}</Text>
          <Text style={styles.timestamp}>{formatTimeAgo(item.created_at)}</Text>
          
          {isFollowRequest && (
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity 
                style={styles.acceptButton}
                onPress={() => handleAcceptFollowRequest(item.sender_id, item.id)}
              >
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.declineButton}
                onPress={() => handleDeclineFollowRequest(item.sender_id, item.id)}
              >
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {!item.is_read && <View style={styles.unreadDot} />}
        {!isFollowRequest && (
          <Ionicons name="chevron-forward" size={20} color="#666" style={styles.chevronIcon} />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#050505', '#050505']}
        style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 50 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ff00ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </LinearGradient>

      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom }]}
        refreshing={loading}
        onRefresh={fetchNotifications}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={60} color="#666" />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
        ListFooterComponent={
          notifications.length > 0 ? (
            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>
                <Ionicons name="time-outline" size={14} color="#999" /> Notifications are automatically deleted after one week
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000033',
  },
  header: {
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  backButton: {
    marginBottom: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  listContent: {
    padding: 15,
  },
  footerContainer: {
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  footerText: {
    color: '#999',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a2a',
    borderRadius: 12,
    marginBottom: 10,
    padding: 15,
    position: 'relative',
  },
  unreadItem: {
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#ff00ff',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#1a1a3a',
  },
  iconOverlay: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: '#0a0a2a',
    borderRadius: 12,
    padding: 3,
    borderWidth: 2,
    borderColor: '#1a1a3a',
  },
  contentContainer: {
    flex: 1,
  },
  username: {
    color: '#ff00ff',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
    textDecorationLine: 'underline',
  },
  content: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  timestamp: {
    color: '#999',
    fontSize: 12,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  acceptButton: {
    backgroundColor: '#00cc99',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginRight: 10,
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  declineButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  declineButtonText: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 12,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff00ff',
    position: 'absolute',
    top: 15,
    right: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 10,
  },
  chevronIcon: {
    position: 'absolute',
    right: 15,
    alignSelf: 'center',
  },
});

export default NotificationsScreen;