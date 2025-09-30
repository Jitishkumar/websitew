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
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { processMentions } from '../utils/mentionService';
import { Audio } from 'expo-av';
import { uploadToCloudinary } from '../config/cloudinary';

const { height } = Dimensions.get('window');

// Audio Player Component
const AudioPlayer = ({ audioUrl, duration }) => {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const playPauseAudio = async () => {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis / 1000);
      setAudioDuration(status.durationMillis / 1000);
      
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.audioPlayerContainer}>
      <TouchableOpacity onPress={playPauseAudio} style={styles.audioPlayButton}>
        <Ionicons 
          name={isPlaying ? 'pause' : 'play'} 
          size={20} 
          color="#ff00ff" 
        />
      </TouchableOpacity>
      <View style={styles.audioWaveform}>
        <View style={[styles.audioProgress, { width: `${(position / audioDuration) * 100}%` }]} />
      </View>
      <Text style={styles.audioDuration}>
        {formatTime(position)} / {formatTime(audioDuration)}
      </Text>
    </View>
  );
};

const ShortsCommentScreen = ({ route }) => {
  const { postId } = route.params;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
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
  const [isAnonymous, setIsAnonymous] = useState(false);
  
  // Audio recording states
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState(null);
  const [audioSound, setAudioSound] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef(null);
  
  // Load comments when screen mounts
  useEffect(() => {
    if (postId) {
      loadComments();
      getCurrentUser();
    }
  }, [postId]);

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
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
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .eq('post_id', postId)
        .is('parent_comment_id', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Also fetch replies
      const { data: replies, error: repliesError } = await supabase
        .from('post_comments')
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .eq('post_id', postId)
        .not('parent_comment_id', 'is', null)
        .order('created_at', { ascending: true });
      
      if (repliesError) throw repliesError;
      
      // Combine comments and replies
      setComments([...data, ...replies]);
    } catch (error) {
      console.error('Error loading comments:', error);
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant microphone permission to record audio');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;

      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setAudioUri(uri);
      setRecording(null);

    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const playPreview = async () => {
    try {
      if (!audioUri) return;

      if (isPlayingPreview && audioSound) {
        await audioSound.pauseAsync();
        setIsPlayingPreview(false);
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );

      setAudioSound(sound);
      setIsPlayingPreview(true);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlayingPreview(false);
        }
      });

    } catch (error) {
      console.error('Failed to play audio:', error);
      Alert.alert('Error', 'Failed to play audio');
    }
  };

  const deleteAudioRecording = () => {
    setAudioUri(null);
    setRecordingDuration(0);
    if (audioSound) {
      audioSound.unloadAsync();
      setAudioSound(null);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAddComment = async () => {
    if (!commentText.trim() && !audioUri) return;
    
    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please login to comment');
        return;
      }
      
      let audioUrl = null;
      let audioPublicId = null;

      // Upload audio if exists
      if (audioUri) {
        try {
          const audioUpload = await uploadToCloudinary(audioUri, 'video');
          audioUrl = audioUpload.url;
          audioPublicId = audioUpload.publicId;
        } catch (uploadError) {
          console.error('Error uploading audio:', uploadError);
          Alert.alert('Error', 'Failed to upload audio recording');
          setSubmitting(false);
          return;
        }
      }
      
      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: user.id, // Always store the user ID
          creator_id: user.id, // Always store the actual creator ID
          content: commentText.trim() || (audioUrl ? '🎤 Audio message' : ''),
          is_anonymous: isAnonymous, // Use this flag to control comment display
          audio_url: audioUrl,
          audio_public_id: audioPublicId,
          audio_duration: recordingDuration
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
        .eq('id', postId)
        .single();
      
      if (postData && data) {
        // Send notification to post owner
        await sendCommentNotification(postId, data.id, user.id, postData.user_id);
        // Add new comment to the list
        setComments([data, ...comments]);
        setCommentText('');
        setIsAnonymous(false); // Reset anonymous toggle after posting
        deleteAudioRecording(); // Clear audio recording
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async () => {
    if (!commentText.trim() || !replyingTo) return;
    
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
          post_id: postId,
          user_id: user.id,
          creator_id: user.id,
          content: commentText.trim(),
          parent_comment_id: replyingTo.id,
          is_anonymous: isAnonymous
        })
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .single();
      
      if (error) throw error;
      
      // Get comment owner to send notification
      const parentComment = comments.find(c => c.id === replyingTo.id);
      if (parentComment && data) {
        // Send notification to comment owner (if not the same user)
        if (parentComment.user_id !== user.id) {
          await sendCommentNotification(postId, data.id, user.id, parentComment.user_id, true);
        }
        
        // Add new reply to the list
        setComments([...comments, data]);
        setCommentText('');
        setReplyingTo(null);
        setIsAnonymous(false); // Reset anonymous toggle after posting
        
        // Ensure the parent comment is expanded to show the reply
        setExpandedComments(prev => {
          const newSet = new Set(prev);
          newSet.add(replyingTo.id);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Error adding reply:', error);
      Alert.alert('Error', 'Failed to add reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      // Check if there are replies to this comment
      const hasReplies = comments.some(c => c.parent_comment_id === commentId);
      
      if (hasReplies) {
        // If there are replies, just update the content to indicate it was deleted
        const { error } = await supabase
          .from('post_comments')
          .update({ content: '[Comment deleted]', is_deleted: true })
          .eq('id', commentId);
        
        if (error) throw error;
      } else {
        // If no replies, delete the comment completely
        const { error } = await supabase
          .from('post_comments')
          .delete()
          .eq('id', commentId);
        
        if (error) throw error;
      }
      
      // Update local state
      setComments(comments.filter(c => {
        if (c.id === commentId) {
          return hasReplies ? { ...c, content: '[Comment deleted]', is_deleted: true } : false;
        }
        return true;
      }));
      
    } catch (error) {
      console.error('Error deleting comment:', error);
      Alert.alert('Error', 'Failed to delete comment');
    } finally {

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

  const handleReplyToComment = (comment) => {
    setReplyingTo(comment);
    // Focus the text input
  };

  const cancelReply = () => {
    setReplyingTo(null);
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
          
          {/* Audio Player */}
          {item.audio_url && (
            <AudioPlayer 
              audioUrl={item.audio_url} 
              duration={item.audio_duration || 0}
            />
          )}
          
          <Text style={styles.timestamp}>
            {formatTimestamp(item.created_at)}
          </Text>
          
          <View style={styles.commentActions}>
            <TouchableOpacity 
              style={styles.replyButton}
              onPress={() => handleReplyToComment(item)}
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
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingBottom: insets.bottom }]} // Changed to styles.container for full screen
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
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
        />
      )}

      <LinearGradient
        colors={['#1a1a3a', '#0d0d2a']}
        style={[styles.inputContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]} // Adjusted padding
      >
        {replyingTo && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ color: '#00ffff' }}>Replying to {replyingTo.is_anonymous ? 'Anonymous' : replyingTo.profiles?.username}</Text>
            <TouchableOpacity onPress={cancelReply} style={{ marginLeft: 10 }}>
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
        
        {/* Audio Recording Preview */}
        {audioUri && !isRecording && (
          <View style={styles.audioPreviewContainer}>
            <TouchableOpacity onPress={playPreview} style={styles.audioPreviewButton}>
              <Ionicons 
                name={isPlayingPreview ? 'pause-circle' : 'play-circle'} 
                size={32} 
                color="#ff00ff" 
              />
            </TouchableOpacity>
            <View style={styles.audioPreviewInfo}>
              <Text style={styles.audioPreviewText}>Audio recorded</Text>
              <Text style={styles.audioPreviewDuration}>{formatDuration(recordingDuration)}</Text>
            </View>
            <TouchableOpacity onPress={deleteAudioRecording} style={styles.audioDeleteButton}>
              <Ionicons name="trash-outline" size={20} color="#ff4444" />
            </TouchableOpacity>
          </View>
        )}
        
        {/* Recording Indicator */}
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Recording... {formatDuration(recordingDuration)}</Text>
          </View>
        )}
        
        <View style={styles.inputRow}>
          {/* Audio Record Button */}
          <TouchableOpacity
            onPress={isRecording ? stopRecording : startRecording}
            style={styles.audioButton}
            disabled={submitting}
          >
            <Ionicons 
              name={isRecording ? 'stop' : 'mic'} 
              size={24} 
              color={isRecording ? '#ff4444' : '#ff00ff'} 
            />
          </TouchableOpacity>
          
          <TextInput
            style={styles.input}
            placeholder="Add a comment..."
            placeholderTextColor="#666"
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={500}
            color="#fff"
            editable={!isRecording}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!commentText.trim() && !audioUri) && styles.disabledButton]}
            onPress={replyingTo ? handleReply : handleAddComment}
            disabled={(!commentText.trim() && !audioUri) || submitting || isRecording}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: Platform.OS === 'ios' ? 20 : 15,
    position: 'relative',
    zIndex: 2,
  },
  backButton: {
    padding: 5,
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
  // Audio recording styles
  audioButton: {
    marginRight: 10,
    padding: 5,
  },
  audioPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    borderRadius: 15,
    padding: 10,
    marginBottom: 10,
  },
  audioPreviewButton: {
    marginRight: 10,
  },
  audioPreviewInfo: {
    flex: 1,
  },
  audioPreviewText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  audioPreviewDuration: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  audioDeleteButton: {
    padding: 5,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 15,
    padding: 10,
    marginBottom: 10,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4444',
    marginRight: 10,
  },
  recordingText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Audio player styles
  audioPlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 255, 0.05)',
    borderRadius: 12,
    padding: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  audioPlayButton: {
    marginRight: 10,
  },
  audioWaveform: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 10,
  },
  audioProgress: {
    height: '100%',
    backgroundColor: '#ff00ff',
    borderRadius: 2,
  },
  audioDuration: {
    color: '#999',
    fontSize: 11,
    minWidth: 60,
    textAlign: 'right',
  },
});

export default ShortsCommentScreen;