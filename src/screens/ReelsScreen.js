import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, 
  FlatList, 
  Dimensions, 
  StyleSheet, 
  TouchableOpacity, 
  Text, 
  ActivityIndicator, 
  Alert, 
  Share, 
  Animated,
  RefreshControl,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideo } from '../context/VideoContext';
import { supabase } from '../lib/supabase';
import { PostsService } from '../services/PostsService';

const { width, height } = Dimensions.get('window');

const ReelsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);
  const videoRefs = useRef({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const controlsTimeout = useRef(null);
  const touchTimer = useRef(null);
  const isTouchHolding = useRef(false);
  const pauseIconTimeout = useRef(null);
  const { setFullscreen } = useVideo();
  
  const REELS_PER_PAGE = 10;
  
  // Set fullscreen mode when component mounts and focused
  useFocusEffect(
    useCallback(() => {
      setFullscreen(true);
      
      // Resume current video when screen is focused
      if (videoRefs.current[currentIndex] && isPlaying) {
        videoRefs.current[currentIndex].playAsync();
      }
      
      return () => {
        setFullscreen(false);
        // Pause all videos when screen is unfocused
        Object.values(videoRefs.current).forEach(video => {
          if (video) video.pauseAsync();
        });
      };
    }, [currentIndex, isPlaying])
  );
  
  // Load initial reels and current user
  useEffect(() => {
    getCurrentUser();
    loadReels(true);
  }, []);

  // Get current user
  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };
// Load reels with public account filtering
const loadReels = async (isInitialLoad = false) => {
  try {
    if (isInitialLoad) {
      setLoading(true);
      setPage(0);
    } else {
      setLoadingMore(true);
    }

    const currentPage = isInitialLoad ? 0 : page;
    const offset = currentPage * REELS_PER_PAGE;

    // Use the new RPC function to get public reels in random order
    const { data, error } = await supabase.rpc('get_public_reels', {
      p_limit: REELS_PER_PAGE,
      p_offset: offset
    });

    if (error) {
      console.error('Error fetching public reels:', error);
      throw error;
    }

    if (data && data.length > 0) {
      // Process the reels data to include like and follow status
      const processedReels = data.map(reel => {
        const isLiked = currentUser ? 
          reel.user_likes?.some(like => like.user_id === currentUser.id) || false : false;
        const isFollowing = currentUser ? 
          reel.profiles?.followers?.some(follow => follow.follower_id === currentUser.id) || false : false;
        
        return {
          ...reel,
          is_following: isFollowing,
          is_liked: isLiked,
          is_own_post: currentUser ? reel.user_id === currentUser.id : false,
          likes: reel.likes || [{ count: 0 }],
          comments: reel.comments || [{ count: 0 }],
          profiles: reel.profiles || { id: reel.user_id, username: 'unknown', avatar_url: null }
        };
      });

      if (isInitialLoad) {
        setReels(processedReels);
        setPage(1);
      } else {
        setReels(prevReels => {
          // Filter out any duplicates that might occur due to random ordering
          const existingIds = new Set(prevReels.map(r => r.id));
          const newReels = processedReels.filter(reel => !existingIds.has(reel.id));
          return [...prevReels, ...newReels];
        });
        setPage(currentPage + 1);
      }

      setHasMore(data.length === REELS_PER_PAGE);
    } else if (isInitialLoad) {
      // No reels found
      setReels([]);
      setHasMore(false);
    }
  } catch (error) {
    console.error('Error loading reels:', error);
    Alert.alert('Error', 'Failed to load reels');
  } finally {
    setLoading(false);
    setLoadingMore(false);
    setRefreshing(false);
  }
};




  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadReels(true);
  };

  // Handle load more
  const onLoadMore = () => {
    if (!loadingMore && hasMore && reels.length > 0) {
      loadReels(false);
    }
  };

  // Format time in mm:ss format
  const formatTime = (timeMillis) => {
    const totalSeconds = Math.floor(timeMillis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Handle video press - toggle play/pause on single click
  const handleVideoPress = () => {
    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);
    
    showVideoControls();
    
    const currentVideoRef = videoRefs.current[currentIndex];
    if (currentVideoRef) {
      if (newPlayingState) {
        currentVideoRef.playAsync();
      } else {
        setShowPauseIcon(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }).start();
        
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
  
  // Touch handlers for press-to-pause functionality
  const handleTouchStart = () => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
    }
    
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
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
    
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
    
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    
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
      
      if (status.didJustFinish) {
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
      
      // Play new video
      if (videoRefs.current[newIndex]) {
        videoRefs.current[newIndex].playAsync();
        setIsPlaying(true);
      }
      
      setCurrentIndex(newIndex);
    }
  }).current;

  // Handle like functionality
  const handleLike = async (postId) => {
    try {
      if (!currentUser) {
        Alert.alert('Login Required', 'Please log in to like posts');
        return;
      }

      const currentPost = reels.find(reel => reel.id === postId);
      if (!currentPost) return;
      
      // Optimistically update UI
      const updatedReels = reels.map(reel => {
        if (reel.id === postId) {
          return {
            ...reel,
            is_liked: !reel.is_liked,
            likes: reel.likes ? [
              { count: reel.is_liked ? Math.max(0, reel.likes[0]?.count - 1) : (reel.likes[0]?.count || 0) + 1 }
            ] : [{ count: 1 }]
          };
        }
        return reel;
      });
      setReels(updatedReels);
      
      // Call API to update like status
      const { isLiked, likesCount } = await PostsService.toggleLike(postId);
      
      // Update state with actual response from server
      const finalReels = reels.map(reel => {
        if (reel.id === postId) {
          return {
            ...reel,
            is_liked: isLiked,
            likes: [{ count: likesCount }]
          };
        }
        return reel;
      });
      setReels(finalReels);
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  // Handle follow functionality
  const handleFollow = async (userIdToFollow) => {
    try {
      if (!currentUser) {
        Alert.alert('Login Required', 'Please log in to follow users');
        return;
      }

      // Don't allow following yourself
      if (currentUser.id === userIdToFollow) return;

      const currentReel = reels.find(reel => reel.user_id === userIdToFollow);
      if (!currentReel) return;

      // Fetch the target user's private_account setting
      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('private_account')
        .eq('user_id', userIdToFollow)
        .maybeSingle();
      
      if (settingsError) throw settingsError;

      const hasPrivateAccount = settingsData?.private_account ?? false;

      // Optimistically update UI
      const updatedReels = reels.map(reel => {
        if (reel.user_id === userIdToFollow) {
          return { ...reel, is_following: !reel.is_following };
        }
        return reel;
      });
      setReels(updatedReels);

      const isCurrentlyFollowing = currentReel.is_following;

      if (isCurrentlyFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', userIdToFollow);

        if (error) throw error;

      } else { // Not currently following
        if (hasPrivateAccount) {
          // Send follow request for private accounts
          const { data: existingRequest, error: requestCheckError } = await supabase
            .from('follow_requests')
            .select('*')
            .eq('sender_id', currentUser.id)
            .eq('recipient_id', userIdToFollow)
            .maybeSingle();

          if (requestCheckError) throw requestCheckError;

          if (!existingRequest) {
            const { error: requestInsertError } = await supabase
              .from('follow_requests')
              .insert({
                sender_id: currentUser.id,
                recipient_id: userIdToFollow,
                status: 'pending'
              });

            if (requestInsertError) throw requestInsertError;
            Alert.alert('Follow Request Sent', 'Your follow request has been sent.');
          } else if (existingRequest.status === 'declined') {
            // If declined, update to pending
            const { error: requestUpdateError } = await supabase
              .from('follow_requests')
              .update({ status: 'pending' })
              .eq('id', existingRequest.id);
            if (requestUpdateError) throw requestUpdateError;
            Alert.alert('Follow Request Re-sent', 'Your follow request has been re-sent.');
          } else if (existingRequest.status === 'pending') {
            Alert.alert('Follow Request Pending', 'You already have a pending follow request to this user.');
          }

        } else {
          // Directly follow for public accounts
          const { error: followError } = await supabase
            .from('follows')
            .insert({
              follower_id: currentUser.id,
              following_id: userIdToFollow
            });

          if (followError) throw followError;

          // Create a notification for the followed user
          const { data: notificationData, error: notificationError } = await supabase
            .rpc('create_notification', {
              p_recipient_id: userIdToFollow,
              p_sender_id: currentUser.id,
              p_type: 'follow',
              p_content: 'started following you',
              p_reference_id: null
            });

          if (notificationError) {
            console.error('Error creating follow notification:', notificationError.message, notificationError.details);
          } else {
            console.log('Follow notification created successfully');
          }
        }
      }

    } catch (error) {
      console.error('Error toggling follow:', error);
      Alert.alert('Error', 'Failed to update follow status');

      // Revert optimistic update on error
      const revertedReels = reels.map(reel => {
        if (reel.user_id === userIdToFollow) {
          return { ...reel, is_following: !reel.is_following };
        }
        return reel;
      });
      setReels(revertedReels);
    }
  };

  // Handle comment functionality
  const handleComment = (postId) => {
    navigation.navigate('ShortsComment', { postId });
  };

  // Handle share functionality
  const handleShare = async (reel) => {
    try {
      const result = await Share.share({
        message: `Check out this reel from ${reel.profiles?.username || 'a user'}!\n\n${reel.caption || ''}\n\nOpen the app to watch.`,
        url: reel.media_url,
        title: 'Share this reel'
      });
      
      if (result.action === Share.sharedAction) {
        console.log('Shared successfully');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not share this reel');
      console.error('Error sharing:', error);
    }
  };

  // Navigate to user profile
  const handleUserProfile = (userId) => {
    if (currentUser?.id === userId) {
      navigation.navigate('Profile');
    } else {
      navigation.navigate('UserProfile', { userId });
    }
  };

  // Render each reel item
  const renderItem = ({ item, index }) => {
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
            shouldPlay={isPlaying && index === currentIndex && !isTouchHolding.current}
            isLooping={true}
            onPlaybackStatusUpdate={index === currentIndex ? onPlaybackStatusUpdate : undefined}
            useNativeControls={false}
            rate={1.0}
          />
          
          {/* User info overlay */}
          <LinearGradient 
            colors={['transparent', 'rgba(0,0,0,0.7)']} 
            style={[styles.userInfoOverlay, { paddingBottom: insets.bottom + 20 }]}
          >
            <View style={styles.userInfo}>
              <TouchableOpacity 
                style={styles.userInfoHeader}
                onPress={() => handleUserProfile(item.user_id)}
              >
                <Image 
                  source={{ 
                    uri: item.profiles?.avatar_url || 'https://via.placeholder.com/40x40?text=U' 
                  }}
                  style={styles.avatar}
                />
                <View style={styles.userNameContainer}>
                  <Text style={styles.username}>{item.profiles?.username || 'User'}</Text>
                  <Text style={styles.userHandle}>@{item.profiles?.username || 'user'}</Text>
                </View>
                {!item.is_own_post && (
                  <TouchableOpacity 
                    style={[styles.followButton, item.is_following && styles.followingButton]}
                    onPress={() => handleFollow(item.user_id)}
                  >
                    <Text style={[styles.followButtonText, item.is_following && styles.followingButtonText]}>
                      {item.is_following ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              
              {item.caption && (
                <Text style={styles.caption} numberOfLines={3}>
                  {item.caption}
                </Text>
              )}
            </View>
          </LinearGradient>

          {/* Social interaction buttons */}
          <View style={styles.socialButtons}>
            <TouchableOpacity 
              style={styles.socialButton} 
              onPress={() => handleLike(item.id)}
            >
              <LinearGradient 
                colors={item.is_liked ? ['#ff1744', '#d50000'] : ['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.5)']}
                style={styles.socialButtonGradient}
              >
                <Ionicons 
                  name={item.is_liked ? 'heart' : 'heart-outline'} 
                  size={26} 
                  color="#fff" 
                />
              </LinearGradient>
              <Text style={styles.socialButtonText}>{likeCount > 0 ? likeCount : ''}</Text>
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
              <Text style={styles.socialButtonText}>{commentCount > 0 ? commentCount : ''}</Text>
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

          {/* Video controls */}
          {showControls && index === currentIndex && (
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
                <Text style={styles.reelsTitle}>Reels</Text>
                <View style={styles.placeholder} />
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
                  <TouchableOpacity 
                    style={styles.seekbarTouchArea}
                    onPressIn={(event) => {
                      const { locationX } = event.nativeEvent;
                      const seekPosition = locationX / width;
                      handleSeek(Math.max(0, Math.min(1, seekPosition)));
                    }}
                  >
                    <View style={[styles.seekKnob, { left: `${progress * 100}%` }]} />
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          )}
          
          {/* Pause icon */}
          {showPauseIcon && index === currentIndex && (
            <Animated.View style={[styles.pauseIconContainer, { opacity: fadeAnim }]}>
              <LinearGradient 
                colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.3)']}
                style={styles.pauseIconBackground}
              >
                <Ionicons name="pause" size={50} color="#fff" />
              </LinearGradient>
            </Animated.View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // Render loading footer
  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="large" color="#ff1744" />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#ff1744" />
        <Text style={styles.loadingText}>Loading Reels...</Text>
      </View>
    );
  }

  if (reels.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="videocam-outline" size={64} color="#666" />
        <Text style={styles.emptyText}>No reels available</Text>
        <Text style={styles.emptySubtext}>Be the first to create a reel!</Text>
        <TouchableOpacity 
          style={styles.createButton}
          onPress={() => navigation.navigate('CreatePost')}
        >
          <Text style={styles.createButtonText}>Create Reel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={reels}
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
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#ff1744']}
            tintColor="#ff1744"
          />
        }
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
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  emptySubtext: {
    color: '#999',
    fontSize: 14,
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#ff1744',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  createButtonText: {
    color: '#fff',
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
  userInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#333',
  },
  userNameContainer: {
    flex: 1,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userHandle: {
    color: '#999',
    fontSize: 13,
  },
  followButton: {
    backgroundColor: '#ff1744',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  followingButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: '#fff',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  followingButtonText: {
    color: '#fff',
  },
  caption: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  socialButtons: {
    position: 'absolute',
    right: 15,
    bottom: 100,
    alignItems: 'center',
  },
  socialButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  socialButtonGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  socialButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
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
    alignItems: 'center',
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
  reelsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
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
    fontWeight: '500',
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
    backgroundColor: '#ff1744',
    borderRadius: 1.5,
  },
  seekbarTouchArea: {
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
    backgroundColor: '#ff1744',
    transform: [{ translateX: -7.5 }],
    top: -6,
  },
  pauseIconContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseIconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingFooter: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});

export default ReelsScreen;