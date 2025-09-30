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
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { PostsService } from '../services/PostsService';
import { sendCommentNotification } from '../utils/notificationService';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
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

const CommentScreen = ({ postId, highlightCommentId: initialHighlightCommentId }) => {
  const navigation = useNavigation();
  const route = useRoute();
  const currentPostId = route.params?.postId || postId;
  const currentHighlightCommentId = route.params?.highlightCommentId || initialHighlightCommentId;

  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);
  
  // Ultra-premium animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const headerGlowAnim = useRef(new Animated.Value(0)).current;

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
  
  // Audio recording states
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState(null);
  const [audioSound, setAudioSound] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef(null);
  
  // Load comments when modal becomes visible
  useEffect(() => {
    if (currentPostId) {
      loadComments();
      getCurrentUser();
      startAnimations();
    }
  }, [currentPostId, currentUserUsername]); // Added currentUserUsername to dependencies for loadComments
  
  const startAnimations = () => {
    Animated.parallel([
      // Entrance animations
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 120,
        friction: 7,
        useNativeDriver: true,
      }),
      // Continuous shimmer effect
      Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      ),
      // Pulse effect
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ),
      // Header glow effect
      Animated.loop(
        Animated.sequence([
          Animated.timing(headerGlowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(headerGlowAnim, {
            toValue: 0.3,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ),
    ]).start();
  };

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
          const audioUpload = await uploadToCloudinary(audioUri, 'video'); // Cloudinary uses 'video' for audio
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
          post_id: currentPostId,
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
        .eq('id', currentPostId)
        .single();
      
      if (postData && data) {
        // Send notification to post owner
        await sendCommentNotification(currentPostId, data.id, user.id, postData.user_id);
        
        // Process mentions in the comment text (only if there's text)
        if (commentText.trim()) {
          await processMentions(commentText.trim(), user.id, isAnonymous, data.id, 'post_comment');
        }

        // Add new comment to the list
        setComments([...comments, data]);
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

      // Start timer
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
  
  // Navigate to user profile (copied logic from ConfessionPersonCommentScreen)
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

      // Use the same privacy check logic as SearchScreen
      const { data: settingsData, error: settingsError } = await supabase
        .rpc('get_user_privacy', { target_user_id: userId })
        .maybeSingle();

      if (settingsError) {
        // On error, default to public profile
        navigation.navigate('UserProfileScreen', { userId });
        return;
      }

      // If no settings data is found, assume the account is not private
      if (!settingsData) {
        navigation.navigate('UserProfileScreen', { userId });
        return;
      }

      const isPrivate = settingsData.private_account ?? false;

      // If account is private, check if the current user is an approved follower
      if (isPrivate) {
        const { data: followData, error: followError } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', currentUser.id)
          .eq('following_id', userId)
          .maybeSingle();

        if (followError) {
          navigation.navigate('UserProfileScreen', { userId });
          return;
        }

        // If the user is not an approved follower, navigate to PrivateProfile
        if (!followData) {
          navigation.navigate('PrivateProfileScreen', { userId });
          return;
        }
      }

      // If account is not private or user is an approved follower, navigate to UserProfile
      navigation.navigate('UserProfileScreen', { userId });
    } catch (error) {
      // Default to UserProfileScreen in case of error
      navigation.navigate('UserProfileScreen', { userId });
    }
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
              {replies.map(reply => (
                <View key={reply.id}>
                  {renderComment({ item: reply })}
                </View>
              ))}
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
      <Animated.View 
        style={[
          styles.header,
          { 
            paddingTop: Platform.OS === 'ios' ? insets.top : 0,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }]
          }
        ]}
      >
        <LinearGradient
          colors={['rgba(26, 26, 46, 0.95)', 'rgba(22, 33, 62, 0.9)', 'rgba(15, 52, 96, 0.85)']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.headerGradient}
        >
          {/* Shimmer overlay effect */}
          <Animated.View 
            style={[
              styles.shimmerOverlay,
              {
                opacity: shimmerAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0.3, 0]
                }),
                transform: [{
                  translateX: shimmerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-400, 400]
                  })
                }]
              }
            ]}
          />
          
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <LinearGradient
              colors={['rgba(255, 0, 255, 0.2)', 'rgba(255, 0, 255, 0.1)']}
              style={styles.backButtonGradient}
            >
              <Ionicons name="chevron-back" size={24} color="#ff00ff" />
            </LinearGradient>
          </TouchableOpacity>
          
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <LinearGradient
              colors={['#ff00ff', '#ff6b9d', '#c44569']}
              style={styles.titleContainer}
            >
              <Animated.View 
                style={[
                  styles.titleGlow,
                  {
                    opacity: headerGlowAnim,
                    transform: [{
                      scale: headerGlowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.1]
                      })
                    }]
                  }
                ]}
              />
              <Text style={styles.headerTitle}>Comments</Text>
            </LinearGradient>
          </Animated.View>
          
          <View style={{ width: 24 }} />
        </LinearGradient>
      </Animated.View>

      {loading ? (
        <ActivityIndicator size="large" color="#ff00ff" style={styles.loading} />
      ) : (
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
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
        </Animated.View>
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
      
      <Animated.View 
        style={[
          styles.inputRow,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: pulseAnim }]
          }
        ]}
      >
        {/* Audio Record Button */}
        <TouchableOpacity
          onPress={isRecording ? stopRecording : startRecording}
          style={styles.audioButton}
          disabled={submitting}
        >
          <LinearGradient
            colors={isRecording ? ['#ff4444', '#ff6b6b'] : ['rgba(255, 0, 255, 0.2)', 'rgba(255, 0, 255, 0.1)']}
            style={styles.audioButtonGradient}
          >
            <Ionicons 
              name={isRecording ? 'stop' : 'mic'} 
              size={20} 
              color={isRecording ? '#fff' : '#ff00ff'} 
            />
          </LinearGradient>
        </TouchableOpacity>
        
        <LinearGradient
          colors={['rgba(255, 0, 255, 0.1)', 'rgba(255, 107, 157, 0.05)']}
          style={styles.textInputContainer}
        >
          <TextInput
            style={styles.textInput}
            placeholder={replyingTo ? `Reply to ${replyingTo.is_anonymous ? 'Anonymous' : replyingTo.profiles?.username}...` : "Add a comment..."}
            placeholderTextColor="#888"
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={500}
            editable={!isRecording}
          />
        </LinearGradient>
        
        <TouchableOpacity
          style={[styles.sendButton, { opacity: (commentText.trim() || audioUri) ? 1 : 0.5 }]}
          onPress={handleAddComment}
          disabled={(!commentText.trim() && !audioUri) || submitting || isRecording}
        >
          <LinearGradient
            colors={(commentText.trim() || audioUri) ? ['#ff00ff', '#ff6b9d'] : ['#666', '#444']}
            style={styles.sendButtonGradient}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View 
        style={[
          styles.anonymousToggle,
          { 
            opacity: fadeAnim,
            transform: [{ scale: pulseAnim }]
          }
        ]}
      >
        <LinearGradient
          colors={['rgba(255, 0, 255, 0.1)', 'rgba(0, 255, 255, 0.05)']}
          style={styles.toggleContainer}
        >
          <Text style={styles.anonymousLabel}>Post anonymously</Text>
          <Switch
            value={isAnonymous}
            onValueChange={setIsAnonymous}
            trackColor={{ false: '#767577', true: '#ff00ff' }}
            thumbColor={isAnonymous ? '#fff' : '#f4f3f4'}
          />
        </LinearGradient>
      </Animated.View>
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
  },
  headerGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 15,
    margin: 8,
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    width: 100,
    transform: [{ skewX: '-20deg' }],
  },
  backButtonGradient: {
    padding: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  titleGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    backgroundColor: 'rgba(255, 0, 255, 0.3)',
    borderRadius: 25,
  },
  textInputContainer: {
    flex: 1,
    borderRadius: 20,
    marginRight: 10,
    overflow: 'hidden',
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 15,
    marginTop: 10,
  },
  // Audio recording styles
  audioButton: {
    marginRight: 10,
  },
  audioButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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

export default CommentScreen;