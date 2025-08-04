import React, { useState, useRef, useEffect } from 'react';
import { View, FlatList, Dimensions, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Alert, Share, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideo } from '../context/VideoContext';
import { supabase } from '../config/supabase';
import { PostsService } from '../services/PostsService';

const { width, height } = Dimensions.get('window');

const ShortsScreen = ({ route }) => {
  const { posts: routePosts, initialIndex = 0, userId } = route.params;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);
  const videoRefs = useRef({});
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(true); // Default to playing
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [posts, setPosts] = useState(routePosts || []);
  const [loading, setLoading] = useState(!routePosts);
  const [userProfile, setUserProfile] = useState(null);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const controlsTimeout = useRef(null);
  const touchTimer = useRef(null);
  const isTouchHolding = useRef(false);
  const pauseIconTimeout = useRef(null);
  const { setFullscreen } = useVideo();
  const isUserSpecificView = !!userId;
  
  // Set fullscreen mode when component mounts
  useEffect(() => {
    setFullscreen(true);
    return () => setFullscreen(false);
  }, []);
  
  // Load user shorts if userId is provided
  useEffect(() => {
    if (userId && !routePosts) {
      loadUserProfile();
      loadUserShorts();
    }
  }, [userId]);

  // Load user profile
  const loadUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  // Load user shorts
  const loadUserShorts = async () => {
    try {
      setLoading(true);
      // Get video posts for specific user
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id(*),
          likes:post_likes(count),
          comments:post_comments(count),
          user_likes:post_likes(user_id)
        `)
        .eq('user_id', userId)
        .eq('type', 'video')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      // Check if current user has liked each post
      const { data: { user } } = await supabase.auth.getUser();
      const shortsWithLikeStatus = data.map(post => ({
        ...post,
        is_liked: post.user_likes?.some(like => like.user_id === user.id) || false
      }));
      
      setPosts(shortsWithLikeStatus);
    } catch (error) {
      console.error('Error loading user shorts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Scroll to initial index when component mounts
  useEffect(() => {
    if (flatListRef.current && initialIndex > 0) {
      flatListRef.current.scrollToIndex({
        index: initialIndex,
        animated: false,
      });
    }
  }, [initialIndex]);

  // Format time in mm:ss format
  const formatTime = (timeMillis) => {
    const totalSeconds = Math.floor(timeMillis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Handle video press - toggle play/pause on single click
  const handleVideoPress = () => {
    // Toggle play/pause state
    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);
    
    // Show controls briefly
    showVideoControls();
    
    // Play or pause the current video
    const currentVideoRef = videoRefs.current[currentIndex];
    if (currentVideoRef) {
      if (newPlayingState) {
        currentVideoRef.playAsync();
      } else {
        // Show pause icon with animation
        setShowPauseIcon(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }).start();
        
        // Hide pause icon after a short delay
        if (pauseIconTimeout.current) {
          clearTimeout(pauseIconTimeout.current);
        }
        pauseIconTimeout.current = setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true
          }).start(() => setShowPauseIcon(false));
        }, 800);
        
        currentVideoRef.pauseAsync();
      }
    }
  };
  
  // Add touch handlers for press-to-pause functionality
  const handleTouchStart = () => {
    // Clear any existing touch timer
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
    }
    
    // Set a timer to detect long press (300ms)
    touchTimer.current = setTimeout(() => {
      if (isPlaying) {
        isTouchHolding.current = true;
        setIsPlaying(false);
        const currentVideoRef = videoRefs.current[currentIndex];
        if (currentVideoRef) {
          currentVideoRef.pauseAsync();
        }
      }
    }, 300);
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
      setIsPlaying(true);
      const currentVideoRef = videoRefs.current[currentIndex];
      if (currentVideoRef) {
        currentVideoRef.playAsync();
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

  // Handle seeking
  const handleSeek = (value) => {
    const currentVideoRef = videoRefs.current[currentIndex];
    if (currentVideoRef && duration > 0) {
      const newPosition = value * duration;
      currentVideoRef.setPositionAsync(newPosition);
      setCurrentTime(newPosition);
      setProgress(value);
    }
  };

  // Handle playback status update
  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setProgress(status.positionMillis / status.durationMillis);
      setCurrentTime(status.positionMillis);
      setDuration(status.durationMillis);
      
      // When video finishes, replay the same video instead of moving to next
      if (status.didJustFinish) {
        // Replay the current video
        const currentVideoRef = videoRefs.current[currentIndex];
        if (currentVideoRef) {
          currentVideoRef.replayAsync();
        }
      }
    }
  };

  // Handle viewable items changed
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      
      // Pause previous video
      if (videoRefs.current[currentIndex] && currentIndex !== newIndex) {
        videoRefs.current[currentIndex].pauseAsync();
      }
      
      // Play new video - always auto-play when a new video becomes visible
      if (videoRefs.current[newIndex]) {
        videoRefs.current[newIndex].playAsync();
        setIsPlaying(true);
      }
      
      setCurrentIndex(newIndex);
    }
  }).current;

  // Handle scroll to index failed
  const onScrollToIndexFailed = (info) => {
    const wait = new Promise(resolve => setTimeout(resolve, 500));
    wait.then(() => {
      flatListRef.current?.scrollToIndex({
        index: info.index,
        animated: false,
      });
    });
  };

  // Handle like functionality
  const handleLike = async (postId) => {
    try {
      const currentPost = posts.find(post => post.id === postId);
      if (!currentPost) return;
      
      // Optimistically update UI
      const updatedPosts = posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            is_liked: !post.is_liked,
            likes: post.likes ? [
              { count: post.is_liked ? Math.max(0, post.likes[0]?.count - 1) : (post.likes[0]?.count || 0) + 1 }
            ] : [{ count: 1 }]
          };
        }
        return post;
      });
      setPosts(updatedPosts);
      
      // Call API to update like status
      const { isLiked, likesCount } = await PostsService.toggleLike(postId);
      
      // Update state with actual response from server
      const finalPosts = posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            is_liked: isLiked,
            likes: [{ count: likesCount }]
          };
        }
        return post;
      });
      setPosts(finalPosts);
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  // Handle comment functionality
  const handleComment = (postId) => {
    // Pause video before navigating
    if (videoRefs.current[currentIndex]) {
      videoRefs.current[currentIndex].pauseAsync();
      setIsPlaying(false);
    }
    
    navigation.navigate('ShortsComment', { postId });
  };

  // Handle share functionality
  const handleShare = async (post) => {
    try {
      const result = await Share.share({
        message: `Check out this video from ${post.profiles?.username || 'a user'}!\n\n${post.caption || ''}\n\nOpen the app to watch.`,
        url: post.media_url, // This may not work on all platforms
        title: 'Share this video'
      });
      
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // shared with activity type of result.activityType
          console.log('Shared with activity type:', result.activityType);
        } else {
          // shared
          console.log('Shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
        console.log('Share dismissed');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not share this video');
      console.error('Error sharing:', error);
    }
  };

  // Render each short video item
  const renderItem = ({ item, index }) => {
    // Only render video posts
    if (item.type !== 'video') return null;
    
    // Get like count
    const likeCount = item.likes?.[0]?.count || 0;
    const commentCount = item.comments?.[0]?.count || 0;
    
    return (
      <View style={styles.videoContainer}>
        <TouchableOpacity 
          activeOpacity={1} 
          style={styles.videoWrapper} 
          onPress={handleVideoPress}
          onPressIn={handleTouchStart}
          onPressOut={handleTouchEnd}
        >
          <Video
            ref={ref => { videoRefs.current[index] = ref }}
            source={{ uri: item.media_url }}
            style={styles.video}
            resizeMode="contain"
            play={isPlaying && index === currentIndex && !isTouchHolding.current}
            shouldPlay={isPlaying && index === currentIndex && !isTouchHolding.current}
            isLooping={true}
            loop={true}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            useNativeControls={false}
            rate={1.0}
          />
          
          {/* User info overlay */}
          <LinearGradient 
            colors={['transparent', 'rgba(0,0,0,0.7)']} 
            style={[styles.userInfoOverlay, { paddingBottom: insets.bottom + 20 }]}
          >
            <View style={styles.userInfo}>
              <Text style={styles.username}>{item.profiles?.username || 'User'}</Text>
              <Text style={styles.caption}>{item.caption}</Text>
            </View>
            
            {/* Social interaction buttons */}
            <View style={styles.socialButtons}>
              <TouchableOpacity 
                style={styles.socialButton} 
                onPress={() => handleLike(item.id)}
              >
                <LinearGradient 
                  colors={item.is_liked ? ['#ff00ff', '#9900ff'] : ['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.5)']}
                  style={styles.socialButtonGradient}
                >
                  <Ionicons name={item.is_liked ? 'heart' : 'heart-outline'} size={26} color="#fff" />
                </LinearGradient>
                <Text style={styles.socialButtonText}>{likeCount}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.socialButton}
                onPress={() => handleComment(item.id)}
              >
                <LinearGradient 
                  colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.5)']}
                  style={styles.socialButtonGradient}
                >
                  <Ionicons name="chatbubble-outline" size={24} color="#fff" />
                </LinearGradient>
                <Text style={styles.socialButtonText}>{commentCount}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.socialButton}
                onPress={() => handleShare(item)}
              >
                <LinearGradient 
                  colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.5)']}
                  style={styles.socialButtonGradient}
                >
                  <Ionicons name="share-social-outline" size={24} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Video controls */}
          {showControls && (
            <LinearGradient 
              colors={['rgba(0,0,0,0.7)', 'transparent', 'rgba(0,0,0,0.7)']} 
              style={styles.controlsOverlay}
            >
              {/* Top controls */}
              <View style={[styles.topControls, { paddingTop: insets.top }]}>
                <TouchableOpacity 
                  style={styles.backButton} 
                  onPress={() => navigation.goBack()}
                >
                  <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
              
              {/* Bottom controls */}
              <View style={styles.bottomControls}>
                <View style={styles.timeContainer}>
                  <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                  <Text style={styles.timeText}>{formatTime(duration)}</Text>
                </View>
                
                <View style={styles.seekbarContainer}>
                  <View style={styles.progressBackground} />
                  <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
                  <View style={styles.seekbarTouchable}>
                    <TouchableOpacity 
                      style={[styles.seekKnob, { left: `${progress * 100}%` }]}
                    />
                    <View 
                      style={styles.seekbarTouchArea}
                      onTouchStart={(event) => {
                        const { locationX } = event.nativeEvent;
                        const seekPosition = locationX / width;
                        handleSeek(Math.max(0, Math.min(1, seekPosition)));
                      }}
                    />
                  </View>
                </View>
              </View>
            </LinearGradient>
          )}
          
          {/* Pause icon that appears briefly when video is paused */}
          {showPauseIcon && index === currentIndex && (
            <Animated.View style={[styles.pauseIconContainer, { opacity: fadeAnim }]}>
              <Ionicons name="pause" size={50} color="#fff" />
            </Animated.View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#ff00ff" />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>No shorts available</Text>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={posts.filter(post => post.type === 'video')}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        windowSize={3}
        maxToRenderPerBatch={3}
        initialNumToRender={3}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{
          itemVisiblePercentThreshold: 50
        }}
        onScrollToIndexFailed={onScrollToIndexFailed}
        vertical
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
  },
  backButtonText: {
    color: '#ff00ff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  videoContainer: {
    width,
    height,
    backgroundColor: '#000',
  },
  videoWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width,
    height,
  },
  userInfoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  userInfo: {
    marginBottom: 20,
  },
  socialButtons: {
    position: 'absolute',
    right: 10,
    bottom: 80,
    alignItems: 'center',
  },
  socialButton: {
    alignItems: 'center',
    marginBottom: 15,
  },
  socialButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  socialButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  caption: {
    color: '#fff',
    fontSize: 14,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseButton: {
    alignSelf: 'center',
  },
  playButtonGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    padding: 20,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
  },
  seekbarContainer: {
    height: 20,
    justifyContent: 'center',
    position: 'relative',
  },
  progressBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1.5,
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    height: 3,
    backgroundColor: '#ff00ff',
    borderRadius: 1.5,
  },
  seekbarTouchable: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 20,
  },
  seekKnob: {
    position: 'absolute',
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#ff00ff',
    transform: [{ translateX: -7.5 }],
    top: -6,
  },
  seekbarTouchArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 20,
  },
  playIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pauseIconContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    opacity: 0.7,
  },
});

export default ShortsScreen;