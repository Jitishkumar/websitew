import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, ActivityIndicator, Animated, Alert, Image } from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideo } from '../context/VideoContext';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const ReelsScreen = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(false);
  
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const videoRefs = useRef([]);
  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const controlsTimeout = useRef(null);
  const isTouchHolding = useRef(false);
  const { activeVideoId, setActiveVideo, clearActiveVideo } = useVideo();

  const memoizedPosts = useMemo(() => posts, [posts]);

  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (seekPosition) => {
    const currentVideo = videoRefs.current[currentIndex];
    if (currentVideo && duration > 0) {
      const seekTime = seekPosition * duration * 1000;
      currentVideo.setPositionAsync(seekTime);
    }
  };

  const handleVideoPress = () => {
    if (isTouchHolding.current) return;
    
    const currentVideo = videoRefs.current[currentIndex];
    if (currentVideo) {
      if (isPlaying) {
        currentVideo.pauseAsync();
        setIsPlaying(false);
        setShowPauseIcon(true);
        
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.delay(800),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => setShowPauseIcon(false));
      } else {
        currentVideo.playAsync();
        setIsPlaying(true);
      }
    }
    
    setShowControls(true);
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    controlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  const handleTouchStart = () => {
    isTouchHolding.current = true;
  };

  const handleTouchEnd = () => {
    setTimeout(() => {
      isTouchHolding.current = false;
    }, 100);
  };

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setProgress(status.positionMillis / status.durationMillis || 0);
      setCurrentTime(status.positionMillis / 1000 || 0);
      setDuration(status.durationMillis / 1000 || 0);
      
      if (status.didJustFinish) {
        setProgress(0);
        setCurrentTime(0);
      }
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      setCurrentIndex(newIndex);
      
      videoRefs.current.forEach((video, index) => {
        if (video) {
          if (index === newIndex) {
            video.playAsync();
            setActiveVideo(`reel_${posts[index]?.id}`);
          } else {
            video.pauseAsync();
          }
        }
      });
      
      setIsPlaying(true);
    }
  }).current;

  const handleLike = async (postId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const postIndex = posts.findIndex(p => p.id === postId);
      if (postIndex === -1) return;

      const post = posts[postIndex];
      const isLiked = post.is_liked;

      if (isLiked) {
        await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('likes')
          .insert([{ post_id: postId, user_id: user.id }]);
      }

      const updatedPosts = [...posts];
      updatedPosts[postIndex] = {
        ...post,
        is_liked: !isLiked,
        likes: [{ count: (post.likes?.[0]?.count || 0) + (isLiked ? -1 : 1) }]
      };
      setPosts(updatedPosts);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleFollow = async (userId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const postIndex = posts.findIndex(p => p.user_id === userId);
      if (postIndex === -1) return;

      const post = posts[postIndex];
      const isFollowing = post.is_following;

      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);
      } else {
        await supabase
          .from('follows')
          .insert([{ follower_id: user.id, following_id: userId }]);
      }

      const updatedPosts = [...posts];
      updatedPosts[postIndex] = {
        ...post,
        is_following: !isFollowing
      };
      setPosts(updatedPosts);
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  const handleComment = (postId) => {
    navigation.navigate('Comments', { postId });
  };

  const handleShare = (post) => {
    navigation.navigate('ShareUserSelection', {
      sharePayload: {
        id: post.id,
        caption: post.caption,
        media_url: post.media_url,
        author: post.profiles,
        from: 'Reels'
      }
    });
  };

  const loadPosts = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (username, avatar_url),
          likes (count),
          comments (count)
        `)
        .eq('type', 'video')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      if (user && data) {
        const postsWithUserData = await Promise.all(
          data.map(async (post) => {
            const [likesResult, followsResult] = await Promise.all([
              supabase
                .from('likes')
                .select('id')
                .eq('post_id', post.id)
                .eq('user_id', user.id)
                .single(),
              supabase
                .from('follows')
                .select('id')
                .eq('follower_id', user.id)
                .eq('following_id', post.user_id)
                .single()
            ]);

            return {
              ...post,
              is_liked: !likesResult.error,
              is_following: !followsResult.error,
              is_own_post: post.user_id === user.id
            };
          })
        );

        setPosts(postsWithUserData);
      } else {
        setPosts(data || []);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      Alert.alert('Error', 'Failed to load reels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (posts.length > 0) {
        const currentVideo = videoRefs.current[currentIndex];
        if (currentVideo) {
          currentVideo.playAsync();
          setActiveVideo(`reel_${posts[currentIndex]?.id}`);
          setIsPlaying(true);
        }
      }

      return () => {
        clearActiveVideo();
        videoRefs.current.forEach(video => {
          if (video) {
            video.pauseAsync();
          }
        });
      };
    }, [currentIndex, posts, setActiveVideo, clearActiveVideo])
  );

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
            resizeMode="cover"
            shouldPlay={isPlaying && index === currentIndex && !isTouchHolding.current}
            isLooping={true}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            useNativeControls={false}
          />
          
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.7)']}
            style={styles.overlay}
          >
            {/* Top controls */}
            <View style={[styles.topControls, { paddingTop: insets.top }]}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <LinearGradient
                  colors={['rgba(102, 126, 234, 0.8)', 'rgba(156, 136, 255, 0.6)']}
                  style={styles.backButtonGradient}
                >
                  <Ionicons name="arrow-back" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>🎬 Reels</Text>
            </View>
            
            {/* User info */}
            <View style={styles.userInfo}>
              <TouchableOpacity 
                style={styles.userInfoContent}
                onPress={() => navigation.navigate('UserProfile', { userId: item.user_id })}
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
                colors={['rgba(102, 126, 234, 0.8)', 'rgba(156, 136, 255, 0.6)']}
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
                colors={['rgba(255, 107, 107, 0.8)', 'rgba(255, 82, 82, 0.6)']}
                style={styles.socialButtonGradient}
              >
                <Ionicons name="share-outline" size={24} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Bottom controls */}
          {showControls && (
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={styles.bottomControls}
            >
              <View style={styles.timeContainer}>
                <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>
              
              <View style={styles.seekbarContainer}>
                <View style={styles.progressBackground} />
                <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
                <TouchableOpacity 
                  style={styles.seekbarTouchable}
                  onPress={(event) => {
                    const { locationX } = event.nativeEvent;
                    const seekPosition = locationX / width;
                    handleSeek(Math.max(0, Math.min(1, seekPosition)));
                  }}
                >
                  <View style={[styles.seekKnob, { left: `${progress * 100}%` }]} />
                </TouchableOpacity>
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

  if (loading) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading reels...</Text>
      </LinearGradient>
    );
  }

  if (posts.length === 0) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>No reels available</Text>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={memoizedPosts.filter(post => post.type === 'video')}
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
        vertical
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    width,
    height,
  },
  videoWrapper: {
    flex: 1,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: {
    marginRight: 16,
  },
  backButtonGradient: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  userInfo: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 80,
  },
  userInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#667eea',
  },
  userNameContainer: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  userHandle: {
    fontSize: 14,
    color: '#ccc',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  followButton: {
    backgroundColor: 'rgba(102, 126, 234, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#667eea',
  },
  followingButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderColor: '#666',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  followingButtonText: {
    color: '#ccc',
  },
  caption: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  socialButtons: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    alignItems: 'center',
  },
  socialButton: {
    alignItems: 'center',
    marginVertical: 8,
  },
  socialButtonGradient: {
    padding: 12,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  seekbarContainer: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    position: 'relative',
  },
  progressBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 2,
  },
  seekbarTouchable: {
    position: 'absolute',
    top: -10,
    left: 0,
    right: 0,
    bottom: -10,
  },
  seekKnob: {
    position: 'absolute',
    top: -2,
    width: 8,
    height: 8,
    backgroundColor: '#fff',
    borderRadius: 4,
    marginLeft: -4,
  },
  pauseIconContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -25,
    marginLeft: -25,
  },
  pauseIconBackground: {
    padding: 20,
    borderRadius: 25,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ReelsScreen;
