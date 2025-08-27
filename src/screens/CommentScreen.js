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
import { PostsService } from '../services/PostsService';
import { sendCommentNotification } from '../utils/notificationService';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { processMentions } from '../utils/mentionService';

const { height } = Dimensions.get('window');

const CommentScreen = ({ postId, highlightCommentId: initialHighlightCommentId }) => {
  const navigation = useNavigation();
  const route = useRoute();
  const currentPostId = route.params?.postId || postId;
  const currentHighlightCommentId = route.params?.highlightCommentId || initialHighlightCommentId;

  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);

  const handleClose = () => {
    navigation.goBack();
  };
  
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserUsername, setCurrentUserUsername] = useState(null); // New state for current user's username
  const [isAnonymous, setIsAnonymous] = useState(false);
  
  // Load comments when modal becomes visible
  useEffect(() => {
    if (currentPostId) {
      loadComments();
      getCurrentUser();
    }
  }, [currentPostId, currentUserUsername]); // Added currentUserUsername to dependencies for loadComments

  useEffect(() => {
    if (currentHighlightCommentId && comments.length > 0) {
      const index = comments.findIndex(comment => comment.id === currentHighlightCommentId);
      if (index !== -1 && flatListRef.current) {
        const commentToHighlight = comments[index];
        if (commentToHighlight.parent_comment_id && !expandedComments.has(commentToHighlight.parent_comment_id)) {
          setExpandedComments(prev => new Set(prev).add(commentToHighlight.parent_comment_id));
          setTimeout(() => {
            const newIndex = comments.findIndex(comment => comment.id === currentHighlightCommentId);
            if (newIndex !== -1) {
              flatListRef.current.scrollToIndex({ index: newIndex, animated: true, viewPosition: 0.5 });
            }
          }, 300); // Small delay to allow layout to update
        } else {
          flatListRef.current.scrollToIndex({ index: index, animated: true, viewPosition: 0.5 });
        }
      }
    }
  }, [currentHighlightCommentId, comments]); // Re-run when highlightCommentId or comments change
  
  // Get current user
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
  
  const getProfilePrivacy = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('private_account')
        .eq('user_id', userId)
        .single();
      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        throw error;
      }
      return data?.private_account || false;
    } catch (error) {
      console.error('Error fetching profile privacy:', error);
      return false; // Default to public if error
    }
  };

  const handleMentionPress = async (username) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();

      if (error || !profile) {
        Alert.alert('Error', `User @${username} not found.`);
        return;
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to view profiles.');
        return;
      }

      // If the mentioned user is the current user, navigate to their own profile
      if (currentUser.id === profile.id) {
        navigation.navigate('UserProfileScreen', { userId: currentUser.id });
        return;
      }

      const isPrivate = await getProfilePrivacy(profile.id);

      if (isPrivate) {
        const { data: followData, error: followError } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', currentUser.id)
          .eq('following_id', profile.id)
          .maybeSingle();

        if (followError) {
          console.error('Error checking follow status:', followError);
          throw followError;
        }

        if (!followData) {
          navigation.navigate('PrivateProfileScreen', { userId: profile.id });
          return;
        }
      }

      navigation.navigate('UserProfileScreen', { userId: profile.id });
    } catch (error) {
      console.error('Error navigating to mentioned user profile:', error);
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
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .eq('post_id', currentPostId)
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
        .from('post_comments')
        .insert({
          post_id: currentPostId,
          user_id: user.id, // Always store the user ID
          creator_id: user.id, // Always store the actual creator ID
          content: commentText.trim(),
          is_anonymous: isAnonymous // Use this flag to control comment display
        })
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .single();
      
      if (error) throw error;
      
      // Get post owner to send notification
      const { data: postData } = await supabase
        .from('posts')
        .select('user_id')
        .eq('id', currentPostId)
        .single();
      
      if (postData && data) {
        // Send notification to post owner
        await sendCommentNotification(currentPostId, data.id, user.id, postData.user_id);
        
        // Process mentions in the comment text
        await processMentions(commentText.trim(), user.id, isAnonymous, data.id, 'post_comment');

        // Add new comment to the list
        setComments([...comments, data]);
        setCommentText('');
        setIsAnonymous(false); // Reset anonymous toggle after posting
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
        .from('post_comments')
        .insert({
          post_id: currentPostId,
          user_id: user.id, // Always store the user ID
          creator_id: user.id, // Always store the actual creator ID
          content: commentText.trim(),
          parent_comment_id: replyingTo,
          is_anonymous: isAnonymous // Use this flag to control comment display
        })
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .single();
      
      if (error) throw error;
      
      // Get post owner to send notification
      const { data: postData } = await supabase
        .from('posts')
        .select('user_id')
        .eq('id', currentPostId)
        .single();
      
      if (postData && data) {
        await sendCommentNotification(currentPostId, data.id, user.id, postData.user_id);
        
        // Process mentions in the reply text
        await processMentions(commentText.trim(), user.id, isAnonymous, data.id, 'post_comment');

        setComments([...comments, data]);
        setCommentText('');
        setReplyingTo(null);
        setIsAnonymous(false); // Reset anonymous toggle after posting
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
  
  // Handle deleting a comment
  const handleDeleteComment = async (commentId) => {
    try {
      // Confirm deletion with alert
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
                .from('post_comments')
                .delete()
                .eq('id', commentId);
              
              if (error) throw error;
              
              // Remove the deleted comment and its replies from the state
              const updatedComments = comments.filter(c => 
                c.id !== commentId && c.parent_comment_id !== commentId
              );
              setComments(updatedComments);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error deleting comment:', error);
      Alert.alert('Error', 'Failed to delete comment');
    }
  };
  
  // Navigate to user profile
  const navigateToUserProfile = (userId) => {
    navigation.navigate('UserProfileScreen', { userId });
  };

  const renderComment = ({ item }) => {
    const isExpanded = expandedComments.has(item.id);
    const replies = comments.filter(c => c.parent_comment_id === item.id);
    const hasReplies = replies.length > 0;
    const isCurrentUserComment = currentUser && (
      (item.user_id === currentUser.id) || // For non-anonymous comments
      (item.is_anonymous && item.creator_id === currentUser.id) // For anonymous comments
    );
    
    // Determine if the comment is anonymous
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
          <Text style={styles.timestamp}>
            {formatTimestamp(item.created_at)}
          </Text>
          
          <View style={styles.commentActions}>
            <TouchableOpacity 
              style={styles.replyButton}
              onPress={() => {
                setReplyingTo(item.id);
                setCommentText(`@${isAnonymousComment ? 'Anonymous' : (item.profiles?.username || 'User')} `);
              }}
            >
              <Text style={styles.replyButtonText}>Reply</Text>
            </TouchableOpacity>
            
            {hasReplies && (
              <TouchableOpacity 
                style={styles.toggleRepliesButton}
                onPress={() => toggleExpanded(item.id)}
              >
                <Text style={styles.toggleRepliesText}>
                  {isExpanded ? 'Hide Replies' : `View ${replies.length} ${replies.length === 1 ? 'Reply' : 'Replies'}`}
                </Text>
              </TouchableOpacity>
            )}
            
            {isCurrentUserComment && (
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={() => {
                  Alert.alert(
                    'Delete Comment',
                    'Are you sure you want to delete this comment?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => handleDeleteComment(item.id) }
                    ]
                  );
                }}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {isExpanded && hasReplies && (
            <View style={styles.repliesContainer}>
              {replies.map(reply => renderComment({ item: reply }))}
            </View>
          )}
          {item.is_tagged && (
            <View style={styles.taggedBadge}>
              <Ionicons name="pricetag" size={12} color="#fff" />
              <Text style={styles.taggedText}>Tagged you</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1, paddingBottom: insets.bottom }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <View style={[
        styles.header,
        { paddingTop: Platform.OS === 'ios' ? insets.top : 0 }
      ]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Comments</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#ff00ff" style={styles.loading} />
      ) : (
        <FlatList
          data={comments.filter(c => !c.parent_comment_id)} // Only show top-level comments
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderComment}
          style={styles.commentsList}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No comments yet. Be the first to comment!</Text>
          }
          ref={flatListRef} // Attach ref to FlatList
        />
      )}

      <LinearGradient
        colors={['#1a1a3a', '#0d0d2a']}
        style={[styles.inputContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]} // Adjusted padding
      >
        {replyingTo && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ color: '#00ffff' }}>Replying to {replyingTo.is_anonymous ? 'Anonymous' : replyingTo.profiles?.username}</Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ marginLeft: 10 }}>
              <Ionicons name="close-circle" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.anonymousOption}>
          <Text style={styles.anonymousText}>Post anonymously</Text>
          <Switch
            value={isAnonymous}
            onValueChange={setIsAnonymous}
            trackColor={{ false: '#333', true: '#ff00ff' }}
            thumbColor={isAnonymous ? '#00ffff' : '#f4f3f4'}
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
            color="#fff"
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050520',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: Platform.OS === 'ios' ? insets.top + 10 : 15, // Adjusted to use insets.top
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
  taggedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00ffff',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginLeft: 10,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  taggedText: {
    color: '#0a0a2a',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 3,
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
  }
});

export default CommentScreen;