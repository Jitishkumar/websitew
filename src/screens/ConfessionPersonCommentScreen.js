import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { sendCommentNotification } from '../utils/notificationService';
import { processMentions } from '../utils/mentionService';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height } = Dimensions.get('window');

const ConfessionPersonCommentScreen = ({ visible, onClose, confessionId: propConfessionId, onCommentPosted, cameFromNotifications }) => {
  const navigation = useNavigation();
  const route = useRoute();

  // Get confessionId from either props or route params
  const confessionId = propConfessionId || route?.params?.confessionId;
  const highlightCommentId = route?.params?.highlightCommentId;

  const insets = useSafeAreaInsets();

  const flatListRef = useRef(null);

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserUsername, setCurrentUserUsername] = useState(null); // New state for current user's username
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    if (confessionId) {
      loadComments();
      getCurrentUser();
    }
  }, [confessionId]);

  useEffect(() => {
    if (highlightCommentId && comments.length > 0 && flatListRef.current) {
      const commentIndex = comments.findIndex(c => c.id === highlightCommentId);
      if (commentIndex !== -1) {
        const parentComment = comments.find(c => c.id === comments[commentIndex].parent_comment_id);
        if (parentComment && !expandedComments.has(parentComment.id)) {
          setExpandedComments(prev => new Set(prev).add(parentComment.id));
        }
        setTimeout(() => {
          flatListRef.current.scrollToIndex({ index: commentIndex, animated: true, viewPosition: 0.5 });
        }, 500);
      }
    }
  }, [highlightCommentId, comments, expandedComments]);

  const handleClose = () => {
    if (typeof onClose === 'function') {
      onClose();
    } else {
      navigation.goBack();
    }
  };

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();
        if (!error && profile) {
          setCurrentUserUsername(profile.username);
        }
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };

  const handleMentionPress = async (username) => {
    try {
      // First, get the profile data for the mentioned user
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();

      if (error || !profile) {
        Alert.alert('Error', `User @${username} not found.`);
        return;
      }

      // Get the current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to view profiles.');
        return;
      }

      // If the mentioned user is the current user, navigate to their own profile
      if (currentUser.id === profile.id) {
        navigation.navigate('Profile');
        return;
      }

      console.log(`Privacy check: Checking if user ${profile.id} has a private account`);
      
      // Use the same privacy check logic as SearchScreen
      const { data: settingsData, error: settingsError } = await supabase
        .rpc('get_user_privacy', { target_user_id: profile.id })
        .maybeSingle();

      if (settingsError) {
        console.log('Privacy check: Error fetching user settings:', settingsError);
        throw settingsError;
      }

      console.log('Privacy check: User settings data:', settingsData);
      
      // If no settings data is found, assume the account is not private
      if (!settingsData) {
        console.log('Privacy check: No user settings found, assuming account is not private');
        console.log('Privacy check: Navigating to UserProfileScreen');
        navigation.navigate('UserProfileScreen', { userId: profile.id });
        return;
      }

      const isPrivate = settingsData.private_account ?? false;
      console.log(`Privacy check: Is account private? ${isPrivate}`);

      // If account is private, check if the current user is an approved follower
      if (isPrivate) {
        console.log(`Privacy check: Account is private, checking if user ${currentUser.id} follows ${profile.id}`);
        const { data: followData, error: followError } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', currentUser.id)
          .eq('following_id', profile.id)
          .maybeSingle();

        if (followError) {
          console.log('Privacy check: Error checking follow status:', followError);
          throw followError;
        }

        console.log('Privacy check: Follow data:', followData);
        
        // If the user is not an approved follower, navigate to PrivateProfile
        if (!followData) {
          console.log(`Privacy check: User ${currentUser.id} is not following private account ${profile.id}, navigating to PrivateProfileScreen`);
          navigation.navigate('PrivateProfileScreen', { userId: profile.id });
          return;
        }
        console.log(`Privacy check: User ${currentUser.id} is following private account ${profile.id}, can view profile`);
      }

      // If account is not private or user is an approved follower, navigate to UserProfile
      console.log(`Privacy check: Navigating to UserProfileScreen for user ${profile.id}`);
      navigation.navigate('UserProfileScreen', { userId: profile.id });
    } catch (error) {
      console.error('Error navigating to mentioned user profile:', error);
      console.log(`Privacy check: Error occurred, defaulting to UserProfileScreen`);
      Alert.alert('Error', 'Could not open user profile.');
    }
  };

  const renderCommentContentWithMentions = (content) => {
    if (!content) return null;

    const parts = [];
    let lastIndex = 0;
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;

    content.replace(mentionRegex, (match, username, offset) => {
      if (offset > lastIndex) {
        parts.push(<Text key={`text-${lastIndex}`}>{content.substring(lastIndex, offset)}</Text>);
      }
      parts.push(
        <TouchableOpacity key={`mention-${offset}`} onPress={() => handleMentionPress(username)}>
          <Text style={styles.mentionText}>@{username}</Text>
        </TouchableOpacity>
      );
      lastIndex = offset + match.length;
      return match;
    });

    if (lastIndex < content.length) {
      parts.push(<Text key={`text-${lastIndex}`}>{content.substring(lastIndex)}</Text>);
    }
    return <Text style={styles.commentText}>{parts}</Text>;
  };

  const loadComments = async () => {
    try {
      setLoading(true);
      
      // Make sure we have a confessionId
      if (!confessionId) {
        console.error('No confessionId provided');
        Alert.alert('Error', 'Confession ID not found');
        return;
      }

      const { data, error } = await supabase
        .from('person_confession_comments')
        .select(
          `
          *,
          profiles:user_id (username, avatar_url)
        `
        )
        .eq('confession_id', confessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const processedComments = (data || []).map(comment => {
        const isTagged = currentUserUsername && comment.content.includes(`@${currentUserUsername}`);
        return { ...comment, is_tagged: isTagged };
      });
      setComments(processedComments);
    } catch (error) {
      console.error('Error loading comments:', error);
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please login to comment');
        return;
      }

      const { data, error } = await supabase
        .from('person_confession_comments')
        .insert({
          confession_id: confessionId,
          user_id: user.id,
          creator_id: user.id,
          content: commentText.trim(),
          is_anonymous: isAnonymous
        })
        .select(
          `
          *,
          profiles:user_id (username, avatar_url)
        `
        )
        .single();

      if (error) throw error;

      // Get confession owner to send notification (if applicable)
      const { data: confessionData } = await supabase
        .from('person_confessions')
        .select('user_id')
        .eq('id', confessionId)
        .single();

      if (confessionData && data) {
        // Assuming a similar notification service is desired, update it to handle confession comments
        // await sendCommentNotification(confessionId, data.id, user.id, confessionData.user_id); // Removed, as sendCommentNotification takes place in processMentions now
        await processMentions(commentText.trim(), user.id, isAnonymous, data.id, 'person_confession_comment', confessionData.user_id); // Use person_confession_comment type and pass confession owner id
        setComments([...comments, data]);
        setCommentText('');
        setIsAnonymous(false);
        if (onCommentPosted) onCommentPosted();
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async () => {
    if (!commentText.trim()) return;

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please login to comment');
        return;
      }

      const { data, error } = await supabase
        .from('person_confession_comments')
        .insert({
          confession_id: confessionId,
          user_id: user.id,
          creator_id: user.id,
          content: commentText.trim(),
          parent_comment_id: replyingTo,
          is_anonymous: isAnonymous
        })
        .select(
          `
          *,
          profiles:user_id (username, avatar_url)
        `
        )
        .single();

      if (error) throw error;

      const { data: confessionData } = await supabase
        .from('person_confessions')
        .select('user_id')
        .eq('id', confessionId)
        .single();

      if (confessionData && data) {
        // await sendCommentNotification(confessionId, data.id, user.id, confessionData.user_id); // Removed
        await processMentions(commentText.trim(), user.id, isAnonymous, data.id, 'person_confession_comment', confessionData.user_id); // Use person_confession_comment type and pass confession owner id
        setComments([...comments, data]);
        setCommentText('');
        setReplyingTo(null);
        setIsAnonymous(false);
        if (onCommentPosted) onCommentPosted();
      }
    } catch (error) {
      console.error('Error adding reply:', error);
      Alert.alert('Error', 'Failed to add reply');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleExpanded = (commentId) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const commentDate = new Date(timestamp);
    const diffInSeconds = Math.floor((now - commentDate) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return commentDate.toLocaleDateString();
  };

  const handleDeleteComment = async (commentId) => {
    try {
      Alert.alert(
        "Delete Comment",
        "Are you sure you want to delete this comment?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              const { error } = await supabase
                .from('person_confession_comments')
                .delete()
                .eq('id', commentId);

              if (error) throw error;

              const updatedComments = comments.filter(c =>
                c.id !== commentId && c.parent_comment_id !== commentId
              );
              setComments(updatedComments);
              if (onCommentPosted) onCommentPosted();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error deleting comment:', error);
      Alert.alert('Error', 'Failed to delete comment');
    }
  };

  const navigateToUserProfile = async (userId) => {
    try {
      // Get the current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to view profiles.');
        return;
      }

      // If it's the current user's profile, navigate to their own profile
      if (currentUser.id === userId) {
        navigation.navigate('Profile');
        return;
      }

      console.log(`Privacy check: Checking if user ${userId} has a private account`);
      
      // Use the same privacy check logic as SearchScreen
      const { data: settingsData, error: settingsError } = await supabase
        .rpc('get_user_privacy', { target_user_id: userId })
        .maybeSingle();

      if (settingsError) {
        console.log('Privacy check: Error fetching user settings:', settingsError);
        throw settingsError;
      }

      console.log('Privacy check: User settings data:', settingsData);
      
      // If no settings data is found, assume the account is not private
      if (!settingsData) {
        console.log('Privacy check: No user settings found, assuming account is not private');
        console.log('Privacy check: Navigating to UserProfileScreen');
        navigation.navigate('UserProfileScreen', { userId });
        return;
      }

      const isPrivate = settingsData.private_account ?? false;
      console.log(`Privacy check: Is account private? ${isPrivate}`);

      // If account is private, check if the current user is an approved follower
      if (isPrivate) {
        console.log(`Privacy check: Account is private, checking if user ${currentUser.id} follows ${userId}`);
        const { data: followData, error: followError } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', currentUser.id)
          .eq('following_id', userId)
          .maybeSingle();

        if (followError) {
          console.log('Privacy check: Error checking follow status:', followError);
          throw followError;
        }

        console.log('Privacy check: Follow data:', followData);
        
        // If the user is not an approved follower, navigate to PrivateProfile
        if (!followData) {
          console.log(`Privacy check: User ${currentUser.id} is not following private account ${userId}, navigating to PrivateProfileScreen`);
          navigation.navigate('PrivateProfileScreen', { userId });
          return;
        }
        console.log(`Privacy check: User ${currentUser.id} is following private account ${userId}, can view profile`);
      }

      // If account is not private or user is an approved follower, navigate to UserProfile
      console.log(`Privacy check: Navigating to UserProfileScreen for user ${userId}`);
      navigation.navigate('UserProfileScreen', { userId });
    } catch (error) {
      console.error('Error checking profile privacy:', error);
      console.log(`Privacy check: Error occurred, defaulting to UserProfileScreen for user ${userId}`);
      // Default to UserProfileScreen in case of error
      navigation.navigate('UserProfileScreen', { userId });
    }
  };

  const renderComment = ({ item }) => {
    const isExpanded = expandedComments.has(item.id);
    const replies = comments.filter(c => c.parent_comment_id === item.id);
    const hasReplies = replies.length > 0;
    const isCurrentUserComment = currentUser && (
      (item.user_id === currentUser.id) ||
      (item.is_anonymous && item.creator_id === currentUser.id)
    );

    const isAnonymousComment = item.is_anonymous;
    const defaultAvatar = 'https://via.placeholder.com/40';

    return (
      <View style={[styles.commentContainer, item.parent_comment_id && styles.replyContainer]}>
        <TouchableOpacity onPress={() => !isAnonymousComment && navigateToUserProfile(item.user_id)}>
          <LinearGradient
            colors={['#ff00ff', '#00ffff']}
            style={styles.avatarBorder}
          >
            <Image
              source={{ uri: isAnonymousComment ? defaultAvatar : (item.profiles?.avatar_url || defaultAvatar) }}
              style={styles.avatar}
            />
          </LinearGradient>
        </TouchableOpacity>
        <View style={styles.commentContent}>
          <TouchableOpacity onPress={() => !isAnonymousComment && navigateToUserProfile(item.user_id)}>
            <Text style={styles.username}>
              {isAnonymousComment ? 'Anonymous' : (item.profiles?.username || 'User')}
            </Text>
          </TouchableOpacity>
          {renderCommentContentWithMentions(item.content)}
          <View style={styles.commentActions}>
            <Text style={styles.timestamp}>{formatTimestamp(item.created_at)}</Text>
            <TouchableOpacity
              onPress={() => {
                setReplyingTo(item.id);
                setCommentText(`@${isAnonymousComment ? 'Anonymous' : (item.profiles?.username || 'User')} `);
              }}
              style={styles.replyButton}
            >
              <Text style={styles.replyButtonText}>Reply</Text>
            </TouchableOpacity>
            {hasReplies && (
              <TouchableOpacity
                onPress={() => toggleExpanded(item.id)}
                style={styles.toggleRepliesButton}
              >
                <Text style={styles.toggleRepliesText}>
                  {isExpanded ? 'Hide Replies' : `Show ${replies.length} ${replies.length === 1 ? 'Reply' : 'Replies'}`}
                </Text>
              </TouchableOpacity>
            )}
            {isCurrentUserComment && (
              <TouchableOpacity
                onPress={() => handleDeleteComment(item.id)}
                style={styles.deleteButton}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
          {isExpanded && hasReplies && (
            <View style={styles.repliesContainer}>
              {replies.map(reply => (
                <React.Fragment key={reply.id}>
                  {renderComment({ item: reply })}
                </React.Fragment>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <LinearGradient
        colors={['#0a0a2a', '#1a1a3a']}
        style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {cameFromNotifications && (
          <TouchableOpacity onPress={() => navigation.navigate('ConfessionPerson', { selectedConfessionId: confessionId })} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Person Comments</Text>
        <TouchableOpacity onPress={handleClose}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        {!cameFromNotifications && <View style={{ width: 24 }} />} {/* Add this to balance spacing if no back button */}
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color="#ff00ff" style={styles.loading} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={comments.filter(comment => !comment.parent_comment_id)}
          renderItem={renderComment}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[styles.commentsList, { paddingBottom: insets.bottom }]}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No comments yet. Be the first to comment!</Text>
          }
        />
      )}

      <LinearGradient
        colors={['#1a1a3a', '#0d0d2a']}
        style={[styles.inputContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}
      >
        <View style={styles.anonymousOption}>
          <Text style={styles.anonymousText}>Anonymous</Text>
          <Switch
            value={isAnonymous}
            onValueChange={setIsAnonymous}
            trackColor={{ false: "#767577", true: "#ff00ff" }}
            thumbColor={isAnonymous ? "#f4f3f4" : "#f4f3f4"}
          />
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment..."
            placeholderTextColor="#666"
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={500}
            color="#ffffff"
            autoFocus={false}
          />
          <TouchableOpacity
            style={[styles.sendButton, !commentText.trim() && styles.disabledButton]}
            onPress={replyingTo ? handleReply : handleAddComment}
            disabled={!commentText.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050520',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#050520',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: height * 0.8,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: Platform.OS === 'ios' ? 20 : 15,
    position: 'relative',
    zIndex: 2,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentsList: {
    padding: 15,
  },
  commentContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  avatarBorder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    padding: 2,
    marginRight: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#050520',
  },
  commentContent: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 10,
    borderRadius: 10,
  },
  username: {
    color: '#ff00ff',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  commentText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  mentionText: {
    color: '#00ffff',
    fontWeight: 'bold',
  },
  timestamp: {
    color: '#666',
    fontSize: 12,
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'column',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 0, 255, 0.2)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    color: '#fff',
  },
  sendButton: {
    backgroundColor: '#ff00ff',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#666',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  replyContainer: {
    marginLeft: 40,
    borderLeftWidth: 1,
    borderLeftColor: '#333',
    paddingLeft: 10,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  replyButton: {
    marginLeft: 10,
  },
  replyButtonText: {
    color: '#00ffff',
    fontSize: 12,
  },
  toggleRepliesButton: {
    marginLeft: 10,
  },
  toggleRepliesText: {
    color: '#ff00ff',
    fontSize: 12,
  },
  deleteButton: {
    marginLeft: 10,
  },
  deleteButtonText: {
    color: '#ff3333',
    fontSize: 12,
  },
  repliesContainer: {
    marginTop: 10,
  },
  anonymousOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 5,
  },
  anonymousText: {
    color: '#fff',
    fontSize: 14,
    marginRight: 10,
  },
  backButton: {
    position: 'absolute',
    left: 10,
    zIndex: 1,
  }
});

export default ConfessionPersonCommentScreen;