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
  // Removed Modal as this will be a full screen
  // Modal,
  Dimensions,
  Switch,
  // Removed PanResponder, Animated as this will be a full screen
  // PanResponder,
  // Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { processMentions } from '../utils/mentionService'; 
import { useNavigation, useRoute } from '@react-navigation/native'; // Added useRoute
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height } = Dimensions.get('window');

const ConfessionPersonCommentScreen = ({ onCommentPosted }) => { // Removed visible, onClose
  const navigation = useNavigation();
  const route = useRoute(); // Use useRoute to get params
  const { confessionId, highlightCommentId } = route.params; // Get confessionId and highlightCommentId from route params
  const insets = useSafeAreaInsets();
  // Removed pan and modalHeight
  // const pan = useRef(new Animated.ValueXY()).current;
  // const [modalHeight, setModalHeight] = useState(height * 0.8);

  const handleClose = () => {
    // Removed onClose check
    navigation.goBack();
  };
  
  // Removed panResponder
  // const panResponder = useRef(
  //   PanResponder.create({
  //     onStartShouldSetPanResponder: () => true,
  //     onPanResponderMove: (_, gesture) => {
  //       if (gesture.dy > 0) {
  //         pan.y.setValue(gesture.dy);
  //       }
  //     },
  //     onPanResponderRelease: (_, gesture) => {
  //       if (gesture.dy > height * 0.2) {
  //         if (typeof onClose === 'function') {
  //           onClose();
  //         } else {
  //           navigation.goBack();
  //         }
  //       } else {
  //         Animated.spring(pan.y, {
  //           toValue: 0,
  //           useNativeDriver: true,
  //         }).start();
  //       }
  //     },
  //   })
  // ).current;

  const flatListRef = useRef(null); // Ref for FlatList to scroll to comment

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [currentUser, setCurrentUser] = useState(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  
  useEffect(() => {
    if (confessionId) { // Check only for confessionId, not visible
      loadComments();
      getCurrentUser();
    }
  }, [confessionId]); // Dependency array for useEffect

  useEffect(() => {
    if (highlightCommentId && comments.length > 0 && flatListRef.current) {
      const commentIndex = comments.findIndex(c => c.id === highlightCommentId);
      if (commentIndex !== -1) {
        // Need to ensure the parent comment is visible if it's a reply
        const parentComment = comments.find(c => c.id === comments[commentIndex].parent_comment_id);
        if (parentComment && !expandedComments.has(parentComment.id)) {
          setExpandedComments(prev => new Set(prev).add(parentComment.id));
        }
        setTimeout(() => {
          flatListRef.current.scrollToIndex({ index: commentIndex, animated: true, viewPosition: 0.5 });
        }, 500); // Give time for layout to update
      }
    }
  }, [highlightCommentId, comments, expandedComments]);
  
  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };
  
  const loadComments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('person_confession_comments') // Changed to person_confession_comments
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .eq('confession_id', confessionId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setComments(data || []);
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
        .from('person_confession_comments') // Changed to person_confession_comments
        .insert({
          confession_id: confessionId,
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
      
      // Get confession owner to send notification (if applicable)
      const { data: confessionData } = await supabase
        .from('person_confessions') // Changed to person_confessions
        .select('user_id')
        .eq('id', confessionId)
        .single();
      
      if (confessionData && data) {
        // Assuming a similar notification service is desired, update it to handle confession comments
        // await sendCommentNotification(confessionId, data.id, user.id, confessionData.user_id);
        await processMentions(commentText.trim(), user.id, isAnonymous, data.id, 'person_confession_comment', 'person');
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
        .from('person_confession_comments') // Changed to person_confession_comments
        .insert({
          confession_id: confessionId,
          user_id: user.id,
          creator_id: user.id,
          content: commentText.trim(),
          parent_comment_id: replyingTo,
          is_anonymous: isAnonymous
        })
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .single();
      
      if (error) throw error;
      
      const { data: confessionData } = await supabase
        .from('person_confessions') // Changed to person_confessions
        .select('user_id')
        .eq('id', confessionId)
        .single();
      
      if (confessionData && data) {
        // await sendCommentNotification(confessionId, data.id, user.id, confessionData.user_id);
        await processMentions(commentText.trim(), user.id, isAnonymous, data.id, 'person_confession_comment', 'person');
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
                .from('person_confession_comments') // Changed to person_confession_comments
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
  
  const navigateToUserProfile = (userId) => {
    navigation.navigate('UserProfileScreen', { userId });
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
          <Text style={styles.commentText}>{item.content}</Text>
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
    // Removed Modal and Animated.View
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container} // Changed to styles.container for full screen
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0} // Adjusted offset
    >
      <LinearGradient
        colors={['#0a0a2a', '#1a1a3a']}
        style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : (Platform.OS === 'ios' ? 20 : 15) }]}
      >
        {/* Removed dragHandle */}
        <TouchableOpacity onPress={handleClose}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Person Comments</Text> {/* Changed title */}
        <View style={{ width: 24 }} /> {/* Spacer for symmetry */}
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color="#ff00ff" style={styles.loading} />
      ) : (
        <FlatList
          ref={flatListRef} // Attach ref
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
  // Removed dragIndicator
  // dragIndicator: {
  //   width: 40,
  //   height: 5,
  //   backgroundColor: '#ffffff',
  //   borderRadius: 3,
  //   alignSelf: 'center',
  //   marginVertical: 10,
  //   zIndex: 2,
  // },
  container: { // Added for full screen
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
  // Removed dragHandle
  // dragHandle: {
  //   width: '100%',
  //   alignItems: 'center',
  //   padding: 10,
  //   position: 'absolute',
  //   top: 0,
  //   left: 0,
  //   right: 0,
  //   zIndex: 3,
  //   ...Platform.select({
  //     ios: {
  //       paddingTop: 10,
  //     },
  //   }),
  // },
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
  }
});

export default ConfessionPersonCommentScreen;
