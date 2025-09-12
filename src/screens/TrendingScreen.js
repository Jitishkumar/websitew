import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
  Dimensions,
  Animated,
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { Video } from 'expo-av';

const { width } = Dimensions.get('window');

const TrendingScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // State management
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' or 'hashtags'
  const [posts, setPosts] = useState([]);
  const [hashtags, setHashtags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const searchFocusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchCurrentUser();
    fetchTrendingPosts();
    fetchTrendingHashtags();
    startInitialAnimations();
  }, []);

  const startInitialAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();
  };

  const animateTabSwitch = (tabIndex) => {
    Animated.spring(tabIndicatorAnim, {
      toValue: tabIndex,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const animateSearchFocus = (focused) => {
    Animated.timing(searchFocusAnim, {
      toValue: focused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const fetchTrendingPosts = async () => {
    try {
      setLoading(true);

      // Fetch trending posts using the new RPC function
      const { data: posts, error: postsError } = await supabase.rpc('get_trending_posts', {
        p_limit: 8, // Show top 8 posts
        p_days: 4    // From the last 4 days
      });

      if (postsError) {
        console.error('Error fetching trending posts:', postsError);
        throw postsError;
      }

      if (!posts || posts.length === 0) {
        setPosts([]);
        return;
      }

      const postIds = posts.map(p => p.id);

      // Get comments count for each post
      const { data: commentsData, error: commentsError } = await supabase
        .from('post_comments')
        .select('post_id, user_id')
        .in('post_id', postIds);

      if (commentsError) throw commentsError;

      // Check which posts the current user has liked
      const { data: userLikes, error: userLikesError } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', currentUser.id)
        .in('post_id', postIds);

      if (userLikesError) throw userLikesError;

      // Process and combine data
      const processedPosts = posts.map(post => {
        const postComments = commentsData.filter(comment => comment.post_id === post.id);
        const isLiked = userLikes.some(like => like.post_id === post.id);

        return {
          ...post,
          username: post.profiles?.username || 'Unknown',
          avatar_url: post.profiles?.avatar_url,
          likes: post.like_count, // Use like_count from the RPC function
          comments: postComments.length,
          isLiked: isLiked,
        };
      });

      setPosts(processedPosts);
    } catch (error) {
      console.error('Error fetching trending posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendingHashtags = async () => {
    try {
      setLoading(true);

      // Get private account user IDs
      const { data: privateUsers, error: privateError } = await supabase
        .from('user_settings')
        .select('user_id')
        .eq('private_account', true);

      if (privateError) throw privateError;

      const privateUserIds = privateUsers?.map(u => u.user_id) || [];

      // Get posts from the last 7 days with captions
      let postsQuery = supabase
        .from('posts')
        .select(`
          id,
          caption,
          created_at,
          user_id,
          profiles!inner(username)
        `)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .not('caption', 'is', null)
        .neq('caption', '');

      // Add filter for private accounts if there are any
      if (privateUserIds.length > 0) {
        postsQuery = postsQuery.not('user_id', 'in', `(${privateUserIds.join(',')})`);
      }

      const { data: posts, error: postsError } = await postsQuery;

      if (postsError) throw postsError;

      if (!posts) {
        setHashtags([]);
        return;
      }

      const postIds = posts.map(p => p.id);
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

      // Get likes for these posts from last 3 days
      const { data: likesData, error: likesError } = await supabase
        .from('post_likes')
        .select('post_id')
        .in('post_id', postIds)
        .gte('created_at', threeDaysAgo);

      if (likesError) throw likesError;

      // Get comments for these posts from last 3 days
      const { data: commentsData, error: commentsError } = await supabase
        .from('post_comments')
        .select('post_id')
        .in('post_id', postIds)
        .gte('created_at', threeDaysAgo);

      if (commentsError) throw commentsError;

      // Extract and process hashtags
      const hashtagsMap = new Map();

      posts.forEach(post => {
        const hashtags = extractHashtags(post.caption);
        const likesCount = likesData.filter(like => like.post_id === post.id).length;
        const commentsCount = commentsData.filter(comment => comment.post_id === post.id).length;
        const engagementScore = likesCount + commentsCount;

        // Process hashtags from all posts (remove engagement requirement for testing)
        if (hashtags.length > 0) {
          hashtags.forEach(hashtag => {
            if (!hashtagsMap.has(hashtag)) {
              hashtagsMap.set(hashtag, {
                id: `hashtag_${hashtag.replace('#', '')}`,
                hashtag: hashtag,
                topic_name: hashtag,
                post_count: 0,
                engagement_score: 0,
                recent_posts: [],
                trending_rank: 0
              });
            }

            const hashtagData = hashtagsMap.get(hashtag);
            hashtagData.post_count += 1;
            hashtagData.engagement_score += engagementScore;
            
            // Store recent posts for preview (max 3)
            if (hashtagData.recent_posts.length < 3) {
              hashtagData.recent_posts.push({
                id: post.id,
                caption: post.caption.length > 100 ? post.caption.substring(0, 97) + '...' : post.caption,
                username: post.profiles?.username || 'Unknown',
                engagement: engagementScore
              });
            }
          });
        }
      });

      // Calculate trending score (engagement + recency + post count)
      const now = Date.now();
      const trendingHashtags = Array.from(hashtagsMap.values())
        .map(hashtag => {
          // Calculate trending score based on multiple factors
          const engagementWeight = hashtag.engagement_score * 2;
          const postCountWeight = hashtag.post_count * 1.5;
          const trendingScore = Math.max(1, engagementWeight + postCountWeight); // Ensure minimum score of 1
          
          return {
            ...hashtag,
            trending_rank: Math.round(trendingScore),
            display_text: `${hashtag.post_count} post${hashtag.post_count !== 1 ? 's' : ''}`
          };
        })
        .filter(hashtag => hashtag.post_count >= 1) // Show hashtags with at least 1 post
        .sort((a, b) => b.trending_rank - a.trending_rank)
        .slice(0, 20); // Show top 20 hashtags

      console.log('Final hashtags for trending:', trendingHashtags);
      setHashtags(trendingHashtags);
    } catch (error) {
      console.error('Error fetching trending hashtags:', error);
      setHashtags([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const handleTabPress = (tab) => {
    setActiveTab(tab);
    animateTabSwitch(tab === 'posts' ? 0 : 1);
  };

  // Helper function to extract hashtags from text
  const extractHashtags = (text) => {
    const hashtagRegex = /#[\w]+/g;
    return text.match(hashtagRegex) || [];
  };

  // Filter data based on search query
  const filteredPosts = posts.filter(post => {
    if (!searchQuery) return true;
    const lowercaseQuery = searchQuery.toLowerCase();
    const captionMatch = post.caption?.toLowerCase().includes(lowercaseQuery);
    const usernameMatch = post.username?.toLowerCase().includes(lowercaseQuery);
    const hashtagMatch = extractHashtags(post.caption || '').some(hashtag => 
      hashtag.toLowerCase().includes(lowercaseQuery)
    );
    return captionMatch || usernameMatch || hashtagMatch;
  });

  const filteredHashtags = hashtags.filter(hashtag => {
    if (!searchQuery) return true;
    const lowercaseQuery = searchQuery.toLowerCase();
    return hashtag.hashtag.toLowerCase().includes(lowercaseQuery) ||
      hashtag.recent_posts.some(post => 
        post.caption.toLowerCase().includes(lowercaseQuery) ||
        post.username.toLowerCase().includes(lowercaseQuery)
      );
  });

  const onRefresh = async () => {
    setRefreshing(true);
    setSearchQuery('');
    await fetchTrendingPosts();
    await fetchTrendingHashtags();
    setRefreshing(false);
  };

  const handleUsernamePress = (userId, username) => {
    // Since we only show public accounts in trending, we can navigate directly
    // But still use privacy check for consistency
    handlePrivacyNavigation(userId);
  };

  const handlePostPress = async (post, index) => {
    // Since we only show posts from public accounts in trending,
    // we can navigate directly to view the post without additional privacy checks
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigation.navigate('Login');
        return;
      }

      // Don't check privacy for own posts
      if (user.id === post.user_id) {
        if (post.type === 'video') {
          const videoData = posts.filter(p => p.type === 'video');
          const videoIndex = videoData.findIndex(p => p.id === post.id);
          navigation.navigate('Shorts', {
            posts: videoData,
            initialIndex: videoIndex
          });
        } else {
          navigation.navigate('PostViewer', {
            post,
            posts: posts.filter(p => p.type !== 'video'),
            initialIndex: posts.findIndex(p => p.id === post.id)
          });
        }
        return;
      }

      // Since all posts in trending are from public accounts, navigate directly
      if (post.type === 'video') {
        const videoData = posts.filter(p => p.type === 'video');
        const videoIndex = videoData.findIndex(p => p.id === post.id);
        navigation.navigate('Shorts', {
          posts: videoData,
          initialIndex: videoIndex
        });
      } else {
        navigation.navigate('PostViewer', {
          post,
          posts: posts.filter(p => p.type !== 'video'),
          initialIndex: posts.findIndex(p => p.id === post.id)
        });
      }
    } catch (error) {
      console.error('Error viewing post:', error);
      // Fallback to profile navigation
      handlePrivacyNavigation(post.user_id);
    }
  };

  const handleTopicPress = (topic) => {
    // Navigate to search screen with hashtag query
    navigation.navigate('Search', {
      initialQuery: topic.hashtag,
      searchType: 'hashtag'
    });
  };

  const handlePrivacyNavigation = async (userId) => {
    try {
      // Get the current user's ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('Privacy check: User not authenticated, navigating to Login');
        navigation.navigate('Login');
        return;
      }

      // Don't check privacy for own profile
      if (user.id === userId) {
        console.log('Privacy check: Viewing own profile, navigating to Profile');
        navigation.navigate('Profile');
        return;
      }

      console.log(`Privacy check: Checking if user ${userId} has a private account`);
      // Use the RLS-bypassing function to check if the profile is private
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
        console.log(`Privacy check: Account is private, checking if user ${user.id} follows ${userId}`);
        const { data: followData, error: followError } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', user.id)
          .eq('following_id', userId)
          .maybeSingle();

        if (followError) {
          console.log('Privacy check: Error checking follow status:', followError);
          throw followError;
        }

        console.log('Privacy check: Follow data:', followData);
        // If the user is not an approved follower, navigate to PrivateProfile
        if (!followData) {
          console.log(`Privacy check: User ${user.id} is not following private account ${userId}, navigating to PrivateProfileScreen`);
          navigation.navigate('PrivateProfileScreen', { userId });
          return;
        }
        console.log(`Privacy check: User ${user.id} is following private account ${userId}, can view profile`);
      }

      // If account is not private or user is an approved follower, navigate to UserProfile
      console.log(`Privacy check: Navigating to UserProfileScreen for user ${userId}`);
      navigation.navigate('UserProfileScreen', { userId });
    } catch (error) {
      console.error('Error checking profile privacy:', error);
      console.log(`Privacy check: Error occurred, defaulting to UserProfileScreen for user ${userId}`);
      // Default to UserProfileScreen in case of error, consistent with our approach for missing data
      navigation.navigate('UserProfileScreen', { userId });
    }
  };

  const renderPostItem = ({ item, index }) => (
    <TouchableOpacity
      style={styles.postCard}
      onPress={() => handlePostPress(item, index)}
    >
      <View style={styles.postContent}>
        {item.type === 'video' ? (
          <View style={styles.videoContainer}>
            <Video
              source={{ uri: item.media_url }}
              style={styles.postVideo}
              resizeMode="cover"
              shouldPlay={false}
              isLooping={false}
              isMuted={true}
              useNativeControls={false}
            />
            <View style={styles.playIconOverlay}>
              <Ionicons name="play" size={40} color="rgba(255, 255, 255, 0.9)" />
            </View>
          </View>
        ) : (
          <Image source={{ uri: item.media_url }} style={styles.postImage} />
        )}

        <View style={styles.postInfo}>
          <View style={styles.userInfo}>
            <Image
              source={{
                uri: item.avatar_url || 'https://via.placeholder.com/40x40.png?text=User'
              }}
              style={styles.userAvatar}
            />
            <TouchableOpacity
              onPress={() => handleUsernamePress(item.user_id, item.username)}
              style={styles.usernameContainer}
            >
              <Text style={styles.username}>@{item.username}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.postCaption} numberOfLines={2}>
            {item.caption}
          </Text>

          <View style={styles.postStats}>
            <View style={styles.statItem}>
              <Ionicons name="heart" size={16} color="#ef4444" />
              <Text style={styles.statText}>{item.likes_count || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="chatbubble" size={16} color="#3b82f6" />
              <Text style={styles.statText}>{item.comments_count || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="time" size={16} color="#888888" />
              <Text style={styles.statText}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderHashtagItem = ({ item, index }) => {
    // Determine gradient colors based on trending rank - premium dark theme
    const getGradientColors = (rank) => {
      if (rank >= 50) return ['rgba(59, 130, 246, 0.8)', 'rgba(147, 51, 234, 0.8)']; // High trending - blue to purple
      if (rank >= 20) return ['rgba(168, 85, 247, 0.8)', 'rgba(239, 68, 68, 0.8)']; // Medium trending - purple to red
      return ['rgba(34, 197, 94, 0.8)', 'rgba(59, 130, 246, 0.8)']; // Low trending - green to blue
    };

    const getRankIcon = (rank) => {
      if (rank >= 50) return 'flame';
      if (rank >= 20) return 'trending-up';
      return 'pulse';
    };

    return (
      <TouchableOpacity
        style={[styles.topicCard, { marginBottom: 12 }]}
        onPress={() => handleTopicPress(item)}
      >
        <LinearGradient
          colors={getGradientColors(item.trending_rank)}
          style={styles.topicGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.topicHeader}>
            <View style={styles.topicRank}>
              <Text style={styles.rankNumber}>{index + 1}</Text>
            </View>
            <View style={styles.topicInfo}>
              <View style={styles.hashtagRow}>
                <Ionicons name={getRankIcon(item.trending_rank)} size={18} color="#fff" />
                <Text style={styles.hashtagText}>{item.hashtag}</Text>
              </View>
              <Text style={styles.topicStats}>
                {item.display_text} • {item.engagement_score} interactions
              </Text>
            </View>
            <View style={styles.trendingBadge}>
              <Text style={styles.trendingScore}>{item.trending_rank}</Text>
            </View>
          </View>
          
          {/* Preview of recent posts */}
          {item.recent_posts && item.recent_posts.length > 0 && (
            <View style={styles.previewContainer}>
              <Text style={styles.previewLabel}>Recent posts:</Text>
              {item.recent_posts.slice(0, 2).map((recentPost, idx) => (
                <View key={idx} style={styles.previewPost}>
                  <Text style={styles.previewUsername}>@{recentPost.username}</Text>
                  <Text style={styles.previewCaption} numberOfLines={1}>
                    {recentPost.caption.replace(/#\w+/g, '').trim()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0a0a2a', '#1a1a4a', '#2a1a4a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Animated.View 
          style={[
            styles.headerContent,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }]
            }
          ]}
        >
          <View style={styles.titleContainer}>
            <LinearGradient
              colors={['#ff00ff', '#ff6b9d', '#c44569']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={styles.titleGradient}
            >
              <MaterialIcons name="trending-up" size={28} color="#fff" />
              <Text style={styles.headerTitle}>Trending</Text>
            </LinearGradient>
          </View>
          
          <Animated.View 
            style={[
              styles.searchContainer,
              {
                borderColor: searchFocusAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['rgba(255, 0, 255, 0.3)', 'rgba(255, 0, 255, 0.8)']
                }),
                shadowOpacity: searchFocusAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.2, 0.6]
                })
              }
            ]}
          >
            <LinearGradient
              colors={['rgba(255, 0, 255, 0.1)', 'rgba(255, 0, 255, 0.05)']}
              style={styles.searchGradient}
            >
              <MaterialIcons name="search" size={22} color="#ff00ff" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search trending content..."
                placeholderTextColor="#888"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => animateSearchFocus(true)}
                onBlur={() => animateSearchFocus(false)}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity 
                  onPress={() => setSearchQuery('')}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={20} color="#ff00ff" />
                </TouchableOpacity>
              )}
            </LinearGradient>
          </Animated.View>
          
          <View style={styles.tabContainer}>
            <View style={styles.tabBackground}>
              <Animated.View 
                style={[
                  styles.tabIndicator,
                  {
                    transform: [{
                      translateX: tabIndicatorAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, width * 0.4]
                      })
                    }]
                  }
                ]}
              />
              
              <TouchableOpacity
                style={styles.tab}
                onPress={() => handleTabPress('posts')}
                activeOpacity={0.7}
              >
                <View style={styles.tabContent}>
                  <MaterialIcons 
                    name="article" 
                    size={20} 
                    color={activeTab === 'posts' ? '#fff' : '#888'} 
                  />
                  <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>
                    Posts
                  </Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.tab}
                onPress={() => handleTabPress('hashtags')}
                activeOpacity={0.7}
              >
                <View style={styles.tabContent}>
                  <MaterialIcons 
                    name="tag" 
                    size={20} 
                    color={activeTab === 'hashtags' ? '#fff' : '#888'} 
                  />
                  <Text style={[styles.tabText, activeTab === 'hashtags' && styles.activeTabText]}>
                    Hashtags
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </LinearGradient>

      <Animated.View 
        style={[
          styles.contentContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {activeTab === 'posts' ? (
          <FlatList
            data={filteredPosts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderPostItem}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#ff00ff"
                colors={['#ff00ff', '#ff6b9d']}
              />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={() => (
              loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#ff00ff" />
                  <Text style={styles.loadingText}>Loading trending posts...</Text>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <LinearGradient
                    colors={['rgba(255, 0, 255, 0.1)', 'rgba(255, 0, 255, 0.05)']}
                    style={styles.emptyIconContainer}
                  >
                    <MaterialIcons name="trending-up" size={60} color="#ff00ff" />
                  </LinearGradient>
                  <Text style={styles.emptyText}>No trending posts found</Text>
                  <Text style={styles.emptySubtext}>Be the first to create trending content!</Text>
                </View>
              )
            )}
          />
        ) : (
          <FlatList
            data={filteredHashtags}
            keyExtractor={(item) => item.hashtag}
            renderItem={renderHashtagItem}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#ff00ff"
                colors={['#ff00ff', '#ff6b9d']}
              />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={() => (
              loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#ff00ff" />
                  <Text style={styles.loadingText}>Loading trending hashtags...</Text>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <LinearGradient
                    colors={['rgba(255, 0, 255, 0.1)', 'rgba(255, 0, 255, 0.05)']}
                    style={styles.emptyIconContainer}
                  >
                    <MaterialIcons name="tag" size={60} color="#ff00ff" />
                  </LinearGradient>
                  <Text style={styles.emptyText}>No trending hashtags found</Text>
                  <Text style={styles.emptySubtext}>Start using hashtags to see trends!</Text>
                </View>
              )
            )}
          />
        )}
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    paddingBottom: 20,
    paddingTop: 10,
  },
  headerContent: {
    paddingHorizontal: 20,
  },
  titleContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  titleGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 30,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginLeft: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 6,
  },
  searchContainer: {
    marginBottom: 20,
    borderRadius: 20,
    borderWidth: 2,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 8,
  },
  searchGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  clearButton: {
    padding: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
  },
  tabContainer: {
    marginBottom: 10,
  },
  tabBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 25,
    padding: 4,
    flexDirection: 'row',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.2)',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    width: width * 0.4,
    backgroundColor: '#ff00ff',
    borderRadius: 21,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 21,
    zIndex: 1,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  contentContainer: {
    flex: 1,
  },
  listContainer: {
    paddingBottom: 20,
  },
  postCard: {
    backgroundColor: '#1a1a4a',
    borderRadius: 18,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.2)',
    overflow: 'hidden',
  },
  postContent: {
    padding: 18,
  },
  videoContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 18,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 0, 255, 0.4)',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    color: '#ff00ff',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(255, 0, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  postTime: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  postCaption: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
    fontWeight: '400',
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 0, 255, 0.1)',
    paddingTop: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statText: {
    color: '#888',
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '500',
  },
  hashtagCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  hashtagContent: {
    padding: 20,
  },
  hashtagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  hashtagInfo: {
    flex: 1,
  },
  hashtagName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 6,
  },
  hashtagStats: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  trendingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  recentPosts: {
    marginTop: 10,
  },
  recentPostsTitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  recentPostItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  recentPostAvatar: {
    width: 32,
    height: 32,
    borderRadius: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.3)',
  },
  recentPostInfo: {
    flex: 1,
  },
  recentPostUser: {
    color: '#ff00ff',
    fontSize: 13,
    fontWeight: '600',
  },
  recentPostText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  loadingContainer: {
    padding: 50,
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 15,
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 50,
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    color: '#ff00ff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default TrendingScreen;