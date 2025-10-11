import React, { useState, useRef, useEffect } from 'react';
import { View, FlatList, Dimensions, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Alert, Share, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideo } from '../context/VideoContext';
import { supabase } from '../lib/supabase';
import { PostsService } from '../services/PostsService';
import { videoCache } from '../utils/VideoCache';

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
  
  // Video preloading and caching states
  const [videoLoadStates, setVideoLoadStates] = useState({});
  const [preloadedVideos, setPreloadedVideos] = useState(new Set());
  const [viewedVideos, setViewedVideos] = useState(new Set());
  const videoCache = useRef(new Map());
  const [thumbnailStates, setThumbnailStates] = useState({});
  
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

  // Preload videos when posts change or current index changes
  useEffect(() => {
    if (posts.length > 0) {
      preloadAdjacentVideos();
    }
  }, [posts, currentIndex]);

  // Preload adjacent videos (Instagram/YouTube strategy)
  const preloadAdjacentVideos = () => {
    if (!videoCache || typeof videoCache.preloadAdjacentVideos !== 'function') {
      console.warn('VideoCache not available, using fallback preloading');
      // Fallback preloading logic
      const preloadIndices = [];
      for (let i = Math.max(0, currentIndex - 1); i <= Math.min(posts.length - 1, currentIndex + 2); i++) {
        preloadIndices.push(i);
      }
      
      preloadIndices.forEach(index => {
        const post = posts[index];
        if (post && !preloadedVideos.has(post.id)) {
          preloadVideo(post, index);
        }
      });
      return;
    }

    // Use the video cache utility for smart preloading
    videoCache.preloadAdjacentVideos(posts, currentIndex, 2)
      .then(results => {
        console.log('Preload results:', results);
        // Update preloaded videos state
        const newPreloaded = new Set(preloadedVideos);
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const videoIndex = currentIndex + index - 1; // Adjust for range
            if (posts[videoIndex]) {
              newPreloaded.add(posts[videoIndex].id);
            }
          }
        });
        setPreloadedVideos(newPreloaded);
      })
      .catch(error => {
        console.error('Preload error:', error);
      });
  };

  // Preload video function
  const preloadVideo = async (post, index) => {
    try {
      setVideoLoadStates(prev => ({
        ...prev,
        [post.id]: 'loading'
      }));

      // Create a hidden video element to preload
      const videoRef = videoRefs.current[index];
      if (videoRef) {
        // Set up the video source
        await videoRef.loadAsync({ uri: post.media_url }, {}, false);
        
        setPreloadedVideos(prev => new Set([...prev, post.id]));
        setVideoLoadStates(prev => ({
          ...prev,
          [post.id]: 'loaded'
        }));
        
        console.log(`Preloaded video ${index}:`, post.media_url);
      }
    } catch (error) {
      console.error(`Failed to preload video ${index}:`, error);
      setVideoLoadStates(prev => ({
        ...prev,
        [post.id]: 'error'
      }));
    }
  };

  // Generate thumbnail URL from video URL (Cloudinary)
  const getThumbnailUrl = (videoUrl) => {
    if (videoUrl.includes('cloudinary.com')) {
      // Convert video URL to thumbnail URL
      return videoUrl.replace('/video/upload/', '/image/upload/c_fill,w_400,h_600,q_auto:low/').replace(/\.(mp4|mov|avi)$/, '.jpg');
    }
    return null;
  };

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

  // Handle video press - do nothing (removed controls)
  const handleVideoPress = () => {
    // Single tap does nothing
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
          try {
            currentVideoRef.pauseAsync();
          } catch (error) {
            console.warn('Error pausing video on touch hold in ShortsScreen:', error);
          }
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
      const currentPost = posts.filter(post => post.type === 'video')[newIndex];
      
      // Pause previous video
      if (videoRefs.current[currentIndex] && currentIndex !== newIndex) {
        videoRefs.current[currentIndex].pauseAsync();
      }
      
      // Play new video - always auto-play when a new video becomes visible
      if (videoRefs.current[newIndex]) {
        videoRefs.current[newIndex].playAsync();
        setIsPlaying(true);
      }
      
      // Track view when scrolling to a new video
      if (currentPost && !viewedVideos.has(currentPost.id)) {
        console.log('Incrementing views for scrolled video:', currentPost.id);
        incrementViews(currentPost.id);
        setViewedVideos(prev => new Set([...prev, currentPost.id]));
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
    // Don't pause video when navigating to comments
    navigation.navigate('ShortsComment', { postId });
  };

  // Increment views count
  const incrementViews = async (postId) => {
    try {
      const { error } = await supabase.rpc('increment_post_views', {
        post_id: postId
      });

      if (error) {
        console.error('Error incrementing views:', error);
      } else {
        // Update local state optimistically
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === postId 
              ? { ...post, views: (post.views || 0) + 1 }
              : post
          )
        );
      }
    } catch (error) {
      console.error('Error incrementing views:', error);
    }
  };

  // Handle share functionality
  const handleShare = async (post) => {
    try {
      const sharePayload = {
        type: 'reel',
        postId: post.id,
        media_url: post.media_url,
        caption: post.caption || '',
        from: 'ShortsScreen',
      };
      const parentNav = navigation.getParent?.();
      if (parentNav) {
        parentNav.navigate('ShareUserSelection', { sharePayload });
      } else {
        navigation.navigate('ShareUserSelection', { sharePayload });
      }
    } catch (error) {
      Alert.alert('Error', 'Could not open share sheet');
      console.error('Error sharing:', error);
    }
  };

  // Handle navigation to user profile
  const handleUserPress = (userId) => {
    navigation.navigate('UserProfileScreen', { userId });
  };

  // Render each short video item
  const renderItem = ({ item, index }) => {
    // Only render video posts
    if (item.type !== 'video') return null;
    
    // Get like count
    const likeCount = item.likes?.[0]?.count || 0;
    const commentCount = item.comments?.[0]?.count || 0;
    const user = item.profiles || {};
    
    return (
      <View style={styles.videoContainer}>
        <TouchableOpacity 
          activeOpacity={1} 
          style={styles.videoWrapper} 
          onPress={handleVideoPress}
          onPressIn={handleTouchStart}
          onPressOut={handleTouchEnd}
        >
          {/* Thumbnail Layer - Shows immediately */}
          {getThumbnailUrl(item.media_url) && videoLoadStates[item.id] !== 'loaded' && (
            <Image
              source={{ uri: getThumbnailUrl(item.media_url) }}
              style={[styles.video, styles.thumbnail]}
              resizeMode="cover"
            />
          )}
          
          {/* Loading indicator */}
          {videoLoadStates[item.id] === 'loading' && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
          
          {/* Video Layer */}
          <Video
            ref={ref => { videoRefs.current[index] = ref }}
            source={{ uri: item.media_url }}
            style={[styles.video, { opacity: videoLoadStates[item.id] === 'loaded' ? 1 : 0 }]}
            resizeMode="contain"
            play={isPlaying && index === currentIndex && !isTouchHolding.current}
            shouldPlay={isPlaying && index === currentIndex && !isTouchHolding.current}
            isLooping={true}
            loop={true}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            useNativeControls={false}
            rate={1.0}
            onError={(error) => {
              console.error('Video error in ShortsScreen:', error);
              setVideoLoadStates(prev => ({
                ...prev,
                [item.id]: 'error'
              }));
            }}
            onLoadStart={() => {
              console.log('Video loading started in ShortsScreen:', item.media_url);
              setVideoLoadStates(prev => ({
                ...prev,
                [item.id]: 'loading'
              }));
            }}
            onLoad={async (status) => {
              console.log('Video loaded successfully in ShortsScreen:', status);
              setVideoLoadStates(prev => ({
                ...prev,
                [item.id]: 'loaded'
              }));
              setPreloadedVideos(prev => new Set([...prev, item.id]));
              
              // Auto-play immediately when video loads and is current
              if (index === currentIndex && isPlaying && videoRefs.current[index]) {
                try {
                  await videoRefs.current[index].playAsync();
                } catch (error) {
                  console.warn('Error auto-playing video:', error);
                }
              }
              
              // Track view when video starts playing
              if (index === currentIndex && !viewedVideos.has(item.id)) {
                console.log('Incrementing views for video:', item.id);
                incrementViews(item.id);
                setViewedVideos(prev => new Set([...prev, item.id]));
              }
            }}
            progressUpdateIntervalMillis={100}
            positionMillis={0}
          />
          
          {/* User info overlay */}
          <LinearGradient 
            colors={['transparent', 'rgba(0,0,0,0.8)']} 
            style={[styles.userInfoOverlay, { paddingBottom: insets.bottom + 20 }]}
          >
            <View style={styles.userInfo}>
              <TouchableOpacity 
                style={styles.userHeader}
                onPress={() => handleUserPress(user.id)}
                activeOpacity={0.7}
              >
                <Image 
                  source={{ uri: user.avatar_url || 'https://via.placeholder.com/100' }} 
                  style={styles.avatar} 
                />
                <Text style={styles.username}>@{user.username || 'user'}</Text>
              </TouchableOpacity>
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

              <View style={styles.socialButton}>
                <LinearGradient 
                  colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.5)']}
                  style={styles.socialButtonGradient}
                >
                  <Ionicons name="eye-outline" size={24} color="#fff" />
                </LinearGradient>
                <Text style={styles.socialButtonText}>{item.views || 0}</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Progress bar - always visible at top */}
          <View style={styles.progressBarContainer} pointerEvents="none">
            <View style={styles.progressBackground} />
            <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
          </View>

          {/* Back button - always visible */}
          <View style={[styles.topHeader, { paddingTop: insets.top }]} pointerEvents="box-none">
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          
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
    backgroundColor: '#0a0a0a',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#e5e5e5',
    fontSize: 18,
    marginBottom: 20,
    fontWeight: '500',
  },
  backButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  videoContainer: {
    width,
    height,
    backgroundColor: '#0a0a0a',
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
  thumbnail: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  userInfoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 80,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.8)',
  },
  userInfo: {
    marginBottom: 20,
  },
  socialButtons: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    alignItems: 'center',
  },
  socialButton: {
    alignItems: 'center',
    marginBottom: 15,
  },
  socialButtonGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  socialButtonText: {
    color: '#e5e5e5',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  username: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  caption: {
    color: '#e5e5e5',
    fontSize: 15,
    lineHeight: 20,
    marginLeft: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  topHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 20,
    zIndex: 10,
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
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
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
    padding: 16,
    paddingBottom: 20,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  timeText: {
    color: '#e5e5e5',
    fontSize: 12,
    marginHorizontal: 10,
    fontVariant: ['tabular-nums'],
    opacity: 0.8,
  },
  progressBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 1,
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 1.5,
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    height: 3,
    backgroundColor: '#3b82f6',
    borderRadius: 1.5,
  },
  seekbarTouchable: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 20,
  },
  seekKnob: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
    position: 'absolute',
    top: -4.5,
    marginLeft: -6,
    zIndex: 2,
    borderWidth: 2,
    borderColor: '#ffffff',
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