import React, { useState, useRef, useEffect } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Dimensions,
  ActivityIndicator,
  Modal,
  PanResponder,
  ScrollView,
  Linking,
  TextInput,
  Vibration
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useVideo } from '../context/VideoContext';
import { PostsService } from '../services/PostsService';
import { supabase } from '../lib/supabase';
import { Alert } from 'react-native';
import CommentScreen from '../screens/CommentScreen';

const { width } = Dimensions.get('window');

// Helper function to format timestamp
const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  
  const now = new Date();
  const postDate = new Date(timestamp);
  const diffInSeconds = Math.floor((now - postDate) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  } else {
    return postDate.toLocaleDateString();
  }
};

const PostItem = ({ post, onOptionsPress }) => {
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes?.[0]?.count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments?.[0]?.count || 0);
  const navigation = useNavigation();
  const touchTimer = useRef(null);
  const isTouchHolding = useRef(false);

  // Animations disabled for better performance

  // Add this function to safely get the avatar URL
  const getAvatarUrl = () => {
    if (!post?.profiles?.avatar_url) return 'https://via.placeholder.com/150';
    
    let avatarPath = post.profiles.avatar_url;
    if (avatarPath.includes('media/media/') || avatarPath.includes('storage/v1/object/public/media/')) {
      const match = avatarPath.match(/([a-f0-9-]+\/avatar_[0-9]+\.jpg)/);
      if (match && match[1]) {
        avatarPath = match[1];
      } else {
        avatarPath = avatarPath.split('media/').pop();
      }
    }
    return `https://lckhaysswueoyinhfzyz.supabase.co/storage/v1/object/public/media/${avatarPath}`;
  };
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [lastTap, setLastTap] = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const videoRef = useRef(null);
  const controlsTimeout = useRef(null);
  const pauseIconTimeout = useRef(null);
  const likeTimeout = useRef(null);
  const [isLiking, setIsLiking] = useState(false);
  const [viewedVideos, setViewedVideos] = useState(new Set());
  
  // Get video context
  const { activeVideoId, setActiveVideo, clearActiveVideo, isFullscreenMode, setFullscreen: setContextFullscreen } = useVideo();

  // Animations disabled for better performance

  // Helper function to safely pause video
  const safePauseVideo = async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.pauseAsync();
      } catch (error) {
        console.warn('Error pausing video:', error);
      }
    }
  };

  const handleProfilePress = () => {
    navigation.navigate('UserProfileScreen', { userId: post?.user_id || post?.user?.id });
  };

  const handleVideoPress = () => {
    const now = Date.now();
    if (lastTap && (now - lastTap) < 300) {
      // Double tap - go to shorts screen for vertical scrolling
      // Pause the feed video first to prevent double audio
      safePauseVideo();
      setPlaying(false);
      clearActiveVideo();
      
      // Get all video posts from the HomeScreen navigation params
      const homeRoute = navigation.getState().routes.find(route => route.name === 'Home');
      const videoPosts = homeRoute?.params?.videoPosts || [post]; // If no video posts available, just use current post
      
      // Find the index of the current post
      const currentIndex = videoPosts.findIndex(p => p.id === post.id);
      
      // Navigate to ShortsScreen with all video posts and current index
      navigation.navigate('Shorts', {
        posts: videoPosts,
        initialIndex: currentIndex >= 0 ? currentIndex : 0
      });
    } else {
      // Single tap - toggle play/pause and show controls
      const newPlayingState = !playing;
      setPlaying(newPlayingState);
      showVideoControls();
      
      if (newPlayingState) {
        // If we're starting to play this video, set it as the active video
        setActiveVideo(post.id);
        if (videoRef.current) {
          videoRef.current.playAsync();
        }
      } else if (activeVideoId === post.id) {
        clearActiveVideo();
        if (videoRef.current) {
          videoRef.current.pauseAsync();
        }
        
        // Show pause icon briefly
        setShowPauseIcon(true);
        
        // Hide after 800ms
        if (pauseIconTimeout.current) {
          clearTimeout(pauseIconTimeout.current);
        }
        pauseIconTimeout.current = setTimeout(() => {
          setShowPauseIcon(false);
        }, 800);
      }
    }
    setLastTap(now);
  };
  
  // Add touch handlers for press-to-pause functionality
  const handleTouchStart = () => {
    if (post.type === 'video') {
      // Clear any existing touch timer
      if (touchTimer.current) {
        clearTimeout(touchTimer.current);
      }
      
      // Set a timer to detect long press (300ms)
      touchTimer.current = setTimeout(() => {
        if (playing) {
          isTouchHolding.current = true;
          setPlaying(false);
          if (videoRef.current) {
            videoRef.current.pauseAsync();
          }
        }
      }, 300);
    }
  };

  const handleTouchEnd = () => {
    // Clear the touch timer
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
    
    // If we were holding and paused the video, resume playback
    if (isTouchHolding.current) {
      isTouchHolding.current = false;
      setPlaying(true);
      if (videoRef.current) {
        videoRef.current.playAsync();
      }
      setActiveVideo(post.id);
    }
  };

  const handleFullscreenClose = () => {
    // First stop playback in fullscreen
    setPlaying(false);
    
    // Wait a moment to ensure video playback is stopped before closing modal
    setTimeout(() => {
      setFullscreen(false);
      setContextFullscreen(false);
      clearActiveVideo();
    }, 100);
  };

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      // Only update progress if not currently seeking
      if (!seeking) {
        setProgress(status.positionMillis / status.durationMillis);
        setCurrentTime(status.positionMillis);
      }
      setDuration(status.durationMillis);
      
      // When video finishes, replay it instead of stopping
      if (status.didJustFinish) {
        if (videoRef.current) {
          try {
            videoRef.current.replayAsync();
          } catch (error) {
            console.warn('Error replaying video:', error);
          }
        }
      }
    }
  };
  
  // Format time in mm:ss format
  const formatTime = (timeMillis) => {
    const totalSeconds = Math.floor(timeMillis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  // Create a PanResponder for the seekbar
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setSeeking(true);
        // Add haptic feedback
        Vibration.vibrate(50);
        // Pause video while seeking
        if (videoRef.current && playing) {
          try {
            videoRef.current.pauseAsync();
          } catch (error) {
            console.warn('Error pausing video for seeking:', error);
          }
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        // Calculate new progress based on touch position relative to seekbar
        const seekbarWidth = width - 40; // Adjust for padding
        const touchX = evt.nativeEvent.locationX;
        const newProgress = Math.max(0, Math.min(1, touchX / seekbarWidth));
        setProgress(newProgress);
        
        // Update current time display while dragging (but don't seek yet)
        if (duration > 0) {
          const newPosition = newProgress * duration;
          setCurrentTime(newPosition);
        }
      },
      onPanResponderRelease: async (evt, gestureState) => {
        // Calculate final progress and seek to that position
        const seekbarWidth = width - 40; // Adjust for padding
        const touchX = evt.nativeEvent.locationX;
        const newProgress = Math.max(0, Math.min(1, touchX / seekbarWidth));
        
        // Seek to the new position
        await handleSeek(newProgress);
        
        // Resume playback from the new position if it was playing before
        if (videoRef.current && playing) {
          try {
            await videoRef.current.playAsync();
          } catch (error) {
            console.warn('Error resuming video after seeking:', error);
          }
        }
        
        setSeeking(false);
      },
    })
  ).current;
  
  // Handle seeking
  const handleSeek = async (value) => {
    if (videoRef.current && duration > 0) {
      try {
        const newPosition = value * duration;
        await videoRef.current.setPositionAsync(newPosition);
        setCurrentTime(newPosition);
        setProgress(value);
      } catch (error) {
        console.warn('Error seeking video:', error);
      }
    }
  };
  
  // Show controls when video is tapped
  const showVideoControls = () => {
    setShowControls(true);
    
    // Clear existing timeout
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    
    // Hide controls after 3 seconds
    controlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };
  
  // Effect to handle when another video becomes active
  useEffect(() => {
    if (activeVideoId && activeVideoId !== post.id && playing) {
      // If another video is now active and this one is playing, pause this one
      setPlaying(false);
      safePauseVideo();
    }
  }, [activeVideoId, post.id, playing]);
  
  // Auto-play video when it becomes visible in the viewport
  useEffect(() => {
    let isMounted = true;
    const handleVideoStateChange = async () => {
      if (videoRef.current) {
        if (activeVideoId === post.id) {
          try {
            setPlaying(true);
            await videoRef.current.playAsync();
          } catch (error) {
            console.error('Error playing video:', error);
          }
        } else {
          await safePauseVideo();
          if (isMounted) setPlaying(false);
        }
      }
    };
    handleVideoStateChange();
    return () => {
      isMounted = false;
      safePauseVideo();
    };
  }, [post.id, activeVideoId, isFullscreenMode]);
  
  // Effect to handle fullscreen mode changes
  useEffect(() => {
    if (isFullscreenMode && !fullscreen && playing) {
      // If we're in fullscreen mode but this video isn't the fullscreen one and it's playing, pause it
      setPlaying(false);
      safePauseVideo();
    }
  }, [isFullscreenMode, fullscreen, playing]);
  
  // Effect to pass posts data to navigation state for ShortsScreen
  useEffect(() => {
    if (navigation) {
      const currentRoute = navigation.getState().routes.find(route => route.name === 'Home');
      if (currentRoute) {
        navigation.setParams({
          ...currentRoute.params,
          data: currentRoute.params?.data || [post]
        });
      }
    }
  }, [navigation, post]);
  
  // Effect to ensure only one video instance is playing at a time
  useEffect(() => {
    // When component unmounts or when fullscreen state changes, ensure video is paused
    return () => {
      if (videoRef.current) {
        videoRef.current.pauseAsync();
      }
      // Clean up like timeout
      if (likeTimeout.current) {
        clearTimeout(likeTimeout.current);
      }
    };
  }, [fullscreen]);

  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedCaption, setEditedCaption] = useState(post.caption || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [likesList, setLikesList] = useState([]);
  const [editCaption, setEditCaption] = useState(post.caption || '');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  // Increment views count
  const incrementViews = async (postId) => {
    try {
      const { error } = await supabase.rpc('increment_post_views', {
        post_id: postId
      });

      if (error) {
        console.error('Error incrementing views:', error);
      }
    } catch (error) {
      console.error('Error incrementing views:', error);
    }
  };

  // Realtime like updates for this post
  useEffect(() => {
    if (!post?.id) return;

    const channel = supabase
      .channel(`post_likes_${post.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_likes', filter: `post_id=eq.${post.id}` },
        async () => {
          const { error, count } = await supabase
            .from('post_likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);
          if (!error) setLikesCount(count || 0);

          if (currentUser) {
            const { data } = await supabase
              .from('post_likes')
              .select('user_id')
              .eq('post_id', post.id)
              .eq('user_id', currentUser.id)
              .maybeSingle();
            setIsLiked(!!data);
          }
        }
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [post?.id, currentUser]);

  const handleLike = async () => {
    // Prevent double submits
    if (isLiking || !currentUser) return;

    // Simple haptic feedback
    Vibration.vibrate(30);

    // Optimistic UI - instant update
    const previousLiked = isLiked;
    const previousCount = likesCount;
    const optimisticLiked = !previousLiked;
    const optimisticCount = Math.max(0, previousCount + (optimisticLiked ? 1 : -1));
    setIsLiked(optimisticLiked);
    setLikesCount(optimisticCount);

    setIsLiking(true);
    if (likeTimeout.current) clearTimeout(likeTimeout.current);

    try {
      const { isLiked: serverLiked, likesCount: serverCount } = await PostsService.toggleLike(post.id);
      setIsLiked(serverLiked);
      setLikesCount(serverCount);
    } catch (error) {
      // Revert on failure
      setIsLiked(previousLiked);
      setLikesCount(previousCount);
      console.error('Error toggling like:', error);
      if (error?.code !== '23505') {
        Alert.alert('Error', 'Failed to update like');
      }
    } finally {
      likeTimeout.current = setTimeout(() => setIsLiking(false), 300);
    }
  };

  const handleShowLikes = async () => {
    try {
      setLoadingLikes(true);
      const { data, error } = await supabase
        .from('post_likes')
        .select(`
          user_id,
          profiles:user_id (username, avatar_url)
        `)
        .eq('post_id', post.id);

      if (error) throw error;
      setLikesList(data);
      setShowLikesModal(true);
    } catch (error) {
      console.error('Error fetching likes:', error);
      Alert.alert('Error', 'Failed to load likes');
    } finally {
      setLoadingLikes(false);
    }
  };

  const handleComment = () => {
    navigation.navigate('Comment', { postId: post.id }); // Navigate to CommentScreen as a full screen
  };

  const handleShare = () => {
    try {
      const sharePayload = {
        type: post.type || (post.media_url ? 'media' : 'text'),
        postId: post.id,
        media_url: post.media_url || null,
        caption: post.caption || '',
        from: 'PostItem',
        postType: post.type, // Add explicit post type for better detection
        author: {
          user_id: post?.user_id,
          username: post?.profiles?.username || 'Anonymous User',
          avatar_url: getAvatarUrl(),
        },
      };
      const parentNav = navigation.getParent?.();
      if (parentNav) {
        parentNav.navigate('ShareUserSelection', { sharePayload });
      } else {
        navigation.navigate('ShareUserSelection', { sharePayload });
      }
    } catch (error) {
      Alert.alert('Error', 'Could not open share sheet');
      console.error('Error sharing post:', error);
    }
  };

  const handleEdit = async () => {
    try {
      await PostsService.editPost(post.id, editCaption);
      post.caption = editCaption;
      setShowEditModal(false);
      Alert.alert('Success', 'Post updated successfully');
    } catch (error) {
      console.error('Error updating post:', error);
      Alert.alert('Error', 'Failed to update post');
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await PostsService.deletePost(post.id);
              // Trigger parent component update
              if (onOptionsPress) {
                onOptionsPress({ type: 'delete', postId: post.id });
              }
              // Close any open modals
              setShowLikesModal(false);
              setShowEditModal(false);
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post');
            }
          }
        }
      ]
    );
  };
  
  return (
    <View style={styles.container}>
        {/* Post Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleProfilePress} style={styles.profileContainer}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarBorder}>
                <Image 
                  source={{ uri: getAvatarUrl() }}
                  style={styles.avatar}
                />
              </View>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.username}>{post?.profiles?.username || 'Unknown'}</Text>
              <Text style={styles.timestamp}>{formatTimestamp(post?.created_at)}</Text>
            </View>
          </TouchableOpacity>
          {currentUser && currentUser.id === post?.user_id && (
            <TouchableOpacity 
              style={styles.optionsButton} 
              onPress={() => {
                Alert.alert(
                  'Post Options',
                  'What would you like to do?',
                  [
                    { text: 'Edit Caption', onPress: () => setShowEditModal(true) },
                    { text: 'Delete Post', onPress: handleDelete, style: 'destructive' },
                    { text: 'Cancel', style: 'cancel' }
                  ]
                );
              }}
            >
              <View style={styles.optionsButtonGradient}>
                <MaterialIcons name="more-vert" size={20} color="rgba(255, 255, 255, 0.7)" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Post Caption */}
        {post.caption && (
          <View style={styles.captionContainer}>
            <Text style={styles.caption}>
              {post.caption.split(/(https?:\/\/[^\s]+|#[\w\u00c0-\u024f\u1e00-\u1eff]+)/g).map((part, index) => {
                if (part.match(/^https?:\/\//)) {
                  return (
                    <TouchableOpacity key={index} onPress={() => Linking.openURL(part)}>
                      <Text style={styles.link}>{part}</Text>
                    </TouchableOpacity>
                  );
                } else if (part.match(/^#[\w\u00c0-\u024f\u1e00-\u1eff]+/)) {
                  return (
                    <TouchableOpacity 
                      key={index} 
                      onPress={() => navigation.navigate('Search', { 
                        initialQuery: part, 
                        searchType: 'hashtag' 
                      })}
                    >
                      <Text style={styles.hashtag}>{part}</Text>
                    </TouchableOpacity>
                  );
                }
                return part;
              })}
            </Text>
          </View>
        )}


        {/* Post Media */}
        {post.media_url && (
          <View style={styles.mediaContainer}>
            {post.type === 'video' ? (
              <TouchableWithoutFeedback 
                onPress={handleVideoPress}
                onPressIn={handleTouchStart}
                onPressOut={handleTouchEnd}
              >
                <View style={styles.videoContainer}>
                  {loading && (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#ff00ff" />
                      <Text style={styles.loadingText}>Loading video...</Text>
                    </View>
                  )}

                  <Video
                    ref={videoRef}
                    source={{ uri: post.media_url }}
                    style={styles.media}
                    resizeMode="cover"
                    shouldPlay={playing && activeVideoId === post.id && !isTouchHolding.current}
                    isLooping={true}
                    useNativeControls={false}
                    rate={1.0}
                    onLoadStart={() => setLoading(true)}
                    onLoad={async () => {
                      setLoading(false);
                      // Track view when video loads and starts playing
                      if (activeVideoId === post.id && !viewedVideos.has(post.id)) {
                        incrementViews(post.id);
                        setViewedVideos(prev => new Set([...prev, post.id]));
                      }
                      // Only auto-play if this is the active video and not being held
                      if (activeVideoId === post.id && !isTouchHolding.current) {
                        try {
                          await videoRef.current?.playAsync();
                          setPlaying(true);
                        } catch (error) {
                          console.warn('Error auto-playing video:', error);
                        }
                      }
                    }}
                    onPlaybackStatusUpdate={(status) => {
                      if (status.isLoaded) {
                        // Only update progress if not currently seeking
                        if (!seeking) {
                          setProgress(status.positionMillis / status.durationMillis);
                          setCurrentTime(status.positionMillis);
                        }
                        setDuration(status.durationMillis);
                        
                        // When video finishes, replay it instead of stopping
                        if (status.didJustFinish) {
                          if (videoRef.current) {
                            videoRef.current.replayAsync();
                          }
                        }
                      }
                    }}
                    onError={() => {
                      setLoading(false);
                      setVideoError(true);
                    }}
                  />
                  
                  {showPauseIcon && (
                    <View style={styles.videoOverlay}>
                      <Ionicons name="pause" size={60} color="#ffffff" />
                    </View>
                  )}

                  {showControls && (
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.7)']}
                      style={styles.videoControls}
                    >
                      {/* Video seekbar with PanResponder */}
                      <View style={styles.seekbarContainer}>
                        <View style={styles.progressBackground} />
                        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
                        <TouchableWithoutFeedback
                          onPress={(evt) => {
                            if (!seeking && duration > 0) {
                              const seekbarWidth = width - 40;
                              const touchX = evt.nativeEvent.locationX;
                              const newProgress = Math.max(0, Math.min(1, touchX / seekbarWidth));
                              handleSeek(newProgress);
                            }
                          }}
                        >
                          <View style={styles.seekbarTouchArea}>
                            <View {...panResponder.panHandlers} style={styles.seekbarTouchable}>
                              <View style={[styles.seekKnob, { left: `${progress * 100}%` }]} />
                            </View>
                          </View>
                        </TouchableWithoutFeedback>
                      </View>
                    </LinearGradient>
                  )}

                  {videoError && (
                    <View style={styles.errorContainer}>
                      <Ionicons name="alert-circle" size={30} color="#ff00ff" />
                      <Text style={styles.errorText}>Video unavailable</Text>
                      <Text style={styles.errorSubText}>Tap to retry</Text>
                    </View>
                  )}
                </View>
              </TouchableWithoutFeedback>
            ) : (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: post.media_url }}
                  style={styles.media}
                  resizeMode="contain"
                  onLoadStart={() => setImageLoaded(false)}
                  onLoad={() => setImageLoaded(true)}
                />
                {!imageLoaded && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#ff00ff" />
                    <Text style={styles.loadingText}>Loading image...</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Post Actions */}
        <View style={styles.actions}>
          <TouchableOpacity 
              style={[styles.actionButton, isLiked && styles.likedButton]} 
              onPress={handleLike}
              disabled={isLiking}
            >
              <View
                style={[
                  styles.actionButtonGradient,
                  isLiked && styles.likedButtonGradient
                ]}
              >
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={26} 
                  color={isLiked ? "#ff0050" : "#fff"} 
                  style={isLiked && styles.likedIcon}
                />
              </View>
              {likesCount > 0 && <Text style={[styles.actionText, isLiked && styles.likedActionText]}>{likesCount}</Text>}
            </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleComment}>
            <View style={styles.actionButtonGradient}>
              <Ionicons name="chatbubble-outline" size={26} color="#fff" />
            </View>
            {commentsCount > 0 && <Text style={styles.actionText}>{commentsCount}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <View style={styles.actionButtonGradient}>
              <Ionicons name="paper-plane-outline" size={24} color="#fff" />
            </View>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />
          {post.type === 'video' && (
            <View style={styles.actionButton}>
              <View style={styles.actionButtonGradient}>
                <Ionicons name="bookmark-outline" size={24} color="#fff" />
              </View>
            </View>
          )}
        </View>

        {/* Post Stats - Removed for cleaner look */}

        {/* Likes Modal */}
        <Modal
          visible={showLikesModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowLikesModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Likes</Text>
                <TouchableOpacity onPress={() => setShowLikesModal(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              
              {loadingLikes ? (
                <ActivityIndicator size="large" color="#ff00ff" style={styles.loadingIndicator} />
              ) : (
                <ScrollView style={styles.likesList}>
                  {likesList.map((like, index) => (
                    <TouchableOpacity 
                      key={index}
                      style={styles.likeItem}
                      onPress={() => {
                        setShowLikesModal(false);
                        navigation.navigate('UserProfileScreen', { userId: like.user_id });
                      }}
                    >
                      <Image 
                        source={{ uri: like.profiles.avatar_url || 'https://via.placeholder.com/150' }}
                        style={styles.likeAvatar}
                      />
                      <Text style={styles.likeUsername}>{like.profiles.username}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* Edit Caption Modal */}
        <Modal
          visible={showEditModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowEditModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Caption</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={styles.editInput}
                value={editCaption}
                onChangeText={setEditCaption}
                multiline
                placeholder="Write a caption..."
                placeholderTextColor="#666"
              />
              
              <TouchableOpacity 
                style={styles.editButton}
                onPress={handleEdit}
              >
                <Text style={styles.editButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    marginHorizontal: 15,
    marginBottom: 15,
    paddingBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatarGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 0, 255, 0.2)',
    zIndex: -1,
  },
  avatarBorder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  timestamp: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
  optionsButton: {
    padding: 8,
  },
  optionsButtonGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captionContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  caption: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
  },
  link: {
    color: '#ff6b9d',
    textDecorationLine: 'underline',
  },
  hashtag: {
    color: '#ff00ff',
    fontWeight: '600',
  },
  mediaContainer: {
    marginBottom: 0,
  },
  videoContainer: {
    position: 'relative',
    width: '92%',
    minHeight: 300,
    maxHeight: 500,
    backgroundColor: '#2a2d3a',
    overflow: 'hidden',
    borderRadius: 20,
    marginHorizontal: '4%',
    marginBottom: 12,
  },
  imageContainer: {
    position: 'relative',
    width: '92%',
    aspectRatio: 1,
    backgroundColor: '#2a2d3a',
    overflow: 'hidden',
    borderRadius: 20,
    marginHorizontal: '4%',
    marginBottom: 12,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  loadingText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 14,
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  videoControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  seekbarContainer: {
    height: 20,
    justifyContent: 'center',
    marginBottom: 8,
  },
  progressBackground: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1.5,
  },
  progressBar: {
    position: 'absolute',
    height: 3,
    backgroundColor: '#ff00ff',
    borderRadius: 1.5,
  },
  seekbarTouchArea: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    left: 0,
    right: 0,
  },
  seekbarTouchable: {
    flex: 1,
    height: 20,
  },
  seekKnob: {
    position: 'absolute',
    top: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff00ff',
    marginLeft: -6,
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  errorSubText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionButton: {
    marginRight: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonGradient: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingIndicator: {
    marginVertical: 20,
  },
  likesList: {
    maxHeight: 300,
  },
  likeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  likeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  likeUsername: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  editInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  editButton: {
    backgroundColor: '#ff00ff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stats: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingBottom: 15,
    gap: 10,
  },
  statGradient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 10,
    shadowColor: 'rgba(102, 126, 234, 0.2)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  likesText: {
    color: '#ff6b6b',
    fontSize: 12,
    fontWeight: '600',
  },
  commentsText: {
    color: '#667eea',
    fontSize: 12,
    fontWeight: '600',
  },
  // Ultra-premium effect styles
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ skewX: '-20deg' }],
    width: 100,
  },
  avatarGlowSecondary: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    zIndex: -2,
  },
  particleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  heartParticle: {
    position: 'absolute',
  },
  likedButtonGradient: {
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  likedIcon: {
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  likedActionText: {
    color: '#ff00ff',
    fontWeight: 'bold',
    textShadowColor: 'rgba(255, 0, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default PostItem;