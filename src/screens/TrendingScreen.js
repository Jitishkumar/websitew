import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  TextInput,
  Animated,
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { Video } from 'expo-av';

const { width } = Dimensions.get('window');

const TrendingScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // State management
  const [activeTab, setActiveTab] = useState('all');
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [filteredTopics, setFilteredTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const videoRefs = useRef({});

  // Animation refs for ultra-premium effects
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const tabSlideAnim = useRef(new Animated.Value(0)).current;
  const searchFocusAnim = useRef(new Animated.Value(0)).current;

  // Tab configuration
  const tabs = [
    { id: 'all', label: 'All', icon: 'apps' },
    { id: 'videos', label: 'Videos', icon: 'play-circle' },
    { id: 'topics', label: 'Hashtags', icon: 'trending-up' }
  ];

  useEffect(() => {
    fetchTrendingContent();
    initializeAnimations();
  }, [activeTab]);

  const initializeAnimations = () => {
    // Reset animations for tab changes
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    scaleAnim.setValue(0.8);

    // Main entrance animations
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
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Continuous glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Continuous shimmer animation
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: true,
      })
    ).start();
  };

  const animateTabChange = (tabId) => {
    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    Animated.spring(tabSlideAnim, {
      toValue: tabIndex,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const animateSearchFocus = (focused) => {
    Animated.timing(searchFocusAnim, {
      toValue: focused ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const fetchTrendingContent = async () => {
    try {
      setLoading(true);

      if (activeTab === 'topics') {
        await fetchTrendingTopics();
      } else {
        await fetchTrendingPosts();
      }
    } catch (error) {
      console.error('Error fetching trending content:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendingPosts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
        setTrendingPosts([]);
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
        .eq('user_id', user.id)
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

      // Filter by active tab (videos or all)
      const finalPosts = activeTab === 'videos'
        ? processedPosts.filter(p => p.type === 'video')
        : processedPosts;

      setTrendingPosts(finalPosts);
      setFilteredPosts(finalPosts);
    } catch (error) {
      console.error('Error fetching trending posts:', error);
    }
  };

  // Helper function to extract hashtags from text
  const extractHashtags = (text) => {
    if (!text) return [];
    // More permissive regex to catch hashtags like #can, #power, etc.
    const hashtagRegex = /#[a-zA-Z0-9_\u00c0-\u024f\u1e00-\u1eff]+/g;
    const matches = text.match(hashtagRegex);
    console.log('Extracting hashtags from:', text);
    console.log('Found hashtags:', matches);
    return matches ? matches.map(tag => tag.toLowerCase()) : [];
  };

  const fetchTrendingTopics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
        setTrendingTopics([]);
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
      const topics = Array.from(hashtagsMap.values())
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

      console.log('Final hashtags for trending:', topics);
      setTrendingTopics(topics);
      setFilteredTopics(topics);
    } catch (error) {
      console.error('Error fetching trending hashtags:', error);
      setTrendingTopics([]);
    }
  };

  // Privacy check function similar to SearchScreen
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

  // Search functionality
  const handleSearch = (query) => {
    setSearchQuery(query);
    setIsSearching(query.length > 0);
    
    if (query.length === 0) {
      // Reset to original data when search is cleared
      setFilteredPosts(trendingPosts);
      setFilteredTopics(trendingTopics);
      return;
    }

    const lowercaseQuery = query.toLowerCase();

    if (activeTab === 'topics') {
      // Filter hashtags
      const filtered = trendingTopics.filter(topic => 
        topic.hashtag.toLowerCase().includes(lowercaseQuery) ||
        topic.recent_posts.some(post => 
          post.caption.toLowerCase().includes(lowercaseQuery) ||
          post.username.toLowerCase().includes(lowercaseQuery)
        )
      );
      setFilteredTopics(filtered);
    } else {
      // Filter posts by caption, username, or hashtags
      const filtered = trendingPosts.filter(post => {
        const captionMatch = post.caption?.toLowerCase().includes(lowercaseQuery);
        const usernameMatch = post.username?.toLowerCase().includes(lowercaseQuery);
        const hashtagMatch = extractHashtags(post.caption || '').some(hashtag => 
          hashtag.toLowerCase().includes(lowercaseQuery)
        );
        return captionMatch || usernameMatch || hashtagMatch;
      });
      setFilteredPosts(filtered);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setSearchQuery('');
    setIsSearching(false);
    await fetchTrendingContent();
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
          const videoData = trendingPosts.filter(p => p.type === 'video');
          const videoIndex = videoData.findIndex(p => p.id === post.id);
          navigation.navigate('Shorts', {
            posts: videoData,
            initialIndex: videoIndex
          });
        } else {
          navigation.navigate('PostViewer', {
            post,
            posts: trendingPosts.filter(p => p.type !== 'video'),
            initialIndex: trendingPosts.findIndex(p => p.id === post.id)
          });
        }
        return;
      }

      // Since all posts in trending are from public accounts, navigate directly
      if (post.type === 'video') {
        const videoData = trendingPosts.filter(p => p.type === 'video');
        const videoIndex = videoData.findIndex(p => p.id === post.id);
        navigation.navigate('Shorts', {
          posts: videoData,
          initialIndex: videoIndex
        });
      } else {
        navigation.navigate('PostViewer', {
          post,
          posts: trendingPosts.filter(p => p.type !== 'video'),
          initialIndex: trendingPosts.findIndex(p => p.id === post.id)
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

  const renderTabButtons = () => (
    <Animated.View style={[styles.tabContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Animated.View style={[styles.tabIndicator, {
        transform: [{
          translateX: tabSlideAnim.interpolate({
            inputRange: [0, 1, 2],
            outputRange: [0, (width - 30) / 3, ((width - 30) / 3) * 2]
          })
        }]
      }]} />
      <Animated.View style={[styles.tabGlow, { opacity: glowAnim }]} />
      {tabs.map((tab, index) => (
        <Animated.View key={tab.id} style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === tab.id && styles.activeTabButton
            ]}
            onPress={() => {
              setActiveTab(tab.id);
              animateTabChange(tab.id);
            }}
          >
            <LinearGradient
              colors={activeTab === tab.id ? ['rgba(59, 130, 246, 0.8)', 'rgba(147, 51, 234, 0.8)'] : ['transparent', 'transparent']}
              style={styles.tabButtonGradient}
            >
              <Ionicons
                name={tab.icon}
                size={20}
                color={activeTab === tab.id ? '#ffffff' : '#888888'}
                style={styles.tabIcon}
              />
              <Text style={[
                styles.tabText,
                activeTab === tab.id && styles.activeTabText
              ]}>
                {tab.label}
              </Text>
            </LinearGradient>
            {activeTab === tab.id && (
              <Animated.View style={[styles.tabButtonGlow, { opacity: glowAnim }]} />
            )}
          </TouchableOpacity>
        </Animated.View>
      ))}
    </Animated.View>
  );

  const renderPostItem = ({ item, index }) => (
    <Animated.View style={[
      styles.postWrapper,
      {
        opacity: fadeAnim,
        transform: [
          { translateY: slideAnim },
          { scale: scaleAnim }
        ]
      }
    ]}>
      <TouchableOpacity
        style={styles.postCard}
        onPress={() => handlePostPress(item, index)}
      >
        <LinearGradient
          colors={['rgba(25, 25, 25, 0.9)', 'rgba(35, 35, 35, 0.9)']}
          style={styles.postCardGradient}
        >
          <Animated.View style={[styles.postGlow, { opacity: glowAnim }]} />
          
          <View style={styles.postContent}>
            {item.type === 'video' ? (
              <Animated.View style={[styles.videoContainer, { transform: [{ scale: pulseAnim }] }]}>
                <Video
                  source={{ uri: item.media_url }}
                  style={styles.postVideo}
                  resizeMode="cover"
                  shouldPlay={false}
                  isLooping={false}
                  isMuted={true}
                  useNativeControls={false}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0, 0, 0, 0.3)']}
                  style={styles.playIconOverlay}
                >
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <LinearGradient
                      colors={['rgba(59, 130, 246, 0.8)', 'rgba(147, 51, 234, 0.8)']}
                      style={styles.playButton}
                    >
                      <Ionicons name="play" size={24} color="white" />
                    </LinearGradient>
                  </Animated.View>
                </LinearGradient>
                <Animated.View style={[styles.videoGlow, { opacity: glowAnim }]} />
              </Animated.View>
            ) : (
              <Animated.View style={[styles.imageContainer, { transform: [{ scale: scaleAnim }] }]}>
                <Image source={{ uri: item.media_url }} style={styles.postImage} />
                <Animated.View style={[styles.imageGlow, { opacity: glowAnim }]} />
              </Animated.View>
            )}
            
            <Animated.View style={[styles.shimmerOverlay, { 
              opacity: shimmerAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.3, 0] }),
              transform: [{ translateX: shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-width, width] }) }]
            }]}>
              <LinearGradient 
                colors={['transparent', 'rgba(59, 130, 246, 0.4)', 'rgba(147, 51, 234, 0.4)', 'transparent']} 
                start={{x: 0, y: 0}} 
                end={{x: 1, y: 0}} 
                style={styles.shimmerGradient} 
              />
            </Animated.View>

            <View style={styles.postInfo}>
              <View style={styles.userInfo}>
                <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
                  <LinearGradient
                    colors={['rgba(59, 130, 246, 0.8)', 'rgba(147, 51, 234, 0.8)']}
                    style={styles.avatarBorder}
                  >
                    <Image
                      source={{
                        uri: item.avatar_url || 'https://via.placeholder.com/40x40.png?text=User'
                      }}
                      style={styles.userAvatar}
                    />
                  </LinearGradient>
                  <Animated.View style={[styles.avatarGlow, { opacity: glowAnim }]} />
                </Animated.View>
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
                <Animated.View style={[styles.statItem, { transform: [{ scale: pulseAnim }] }]}>
                  <LinearGradient
                    colors={['rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0.1)']}
                    style={styles.statBackground}
                  >
                    <Ionicons name="heart" size={16} color="#ef4444" />
                    <Text style={styles.statText}>{item.likes_count || 0}</Text>
                  </LinearGradient>
                </Animated.View>
                <Animated.View style={[styles.statItem, { transform: [{ scale: pulseAnim }] }]}>
                  <LinearGradient
                    colors={['rgba(59, 130, 246, 0.2)', 'rgba(59, 130, 246, 0.1)']}
                    style={styles.statBackground}
                  >
                    <Ionicons name="chatbubble" size={16} color="#3b82f6" />
                    <Text style={styles.statText}>{item.comments_count || 0}</Text>
                  </LinearGradient>
                </Animated.View>
                <Animated.View style={[styles.statItem, { transform: [{ scale: pulseAnim }] }]}>
                  <LinearGradient
                    colors={['rgba(136, 136, 136, 0.2)', 'rgba(136, 136, 136, 0.1)']}
                    style={styles.statBackground}
                  >
                    <Ionicons name="eye" size={16} color="#888888" />
                    <Text style={styles.statText}>{item.views_count || 0}</Text>
                  </LinearGradient>
                </Animated.View>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderTopicItem = ({ item, index }) => {
    // Determine gradient colors based on trending rank - premium dark theme
    const getGradientColors = (rank) => {
      if (rank >= 50) return ['rgba(59, 130, 246, 0.8)', 'rgba(147, 51, 234, 0.8)']; // High trending - blue to purple
      if (rank >= 20) return ['rgba(168, 85, 247, 0.8)', 'rgba(239, 68, 68, 0.8)']; // Medium trending - purple to red
      return ['rgba(34, 197, 94, 0.8)', 'rgba(59, 130, 246, 0.8)']; // Low trending - green to blue
    };

    return (
      <Animated.View style={[
        styles.topicWrapper,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim }
          ]
        }
      ]}>
        <TouchableOpacity
          style={styles.topicCard}
          onPress={() => handleTopicPress(item)}
        >
          <LinearGradient
            colors={getGradientColors(item.trending_rank)}
            style={styles.topicGradient}
          >
            <Animated.View style={[styles.topicGlow, { opacity: glowAnim }]} />
            
            <View style={styles.topicHeader}>
              <Animated.View style={[styles.topicRank, { transform: [{ scale: pulseAnim }] }]}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.1)']}
                  style={styles.rankContainer}
                >
                  <Text style={styles.rankNumber}>#{index + 1}</Text>
                </LinearGradient>
              </Animated.View>
              
              <View style={styles.topicInfo}>
                <View style={styles.hashtagRow}>
                  <Ionicons name="trending-up" size={20} color="#ffffff" />
                  <Text style={styles.hashtagText}>{item.hashtag}</Text>
                </View>
                <Text style={styles.topicStats}>
                  {item.post_count} posts • {item.engagement_score} engagement
                </Text>
              </View>
              
              <Animated.View style={[styles.trendingBadge, { transform: [{ scale: pulseAnim }] }]}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.1)']}
                  style={styles.badgeGradient}
                >
                  <Text style={styles.trendingScore}>
                    {Math.round(item.trending_rank)}
                  </Text>
                </LinearGradient>
              </Animated.View>
            </View>

            <Animated.View style={[styles.shimmerOverlay, { 
              opacity: shimmerAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.3, 0] }),
              transform: [{ translateX: shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-width, width] }) }]
            }]}>
              <LinearGradient 
                colors={['transparent', 'rgba(255, 255, 255, 0.3)', 'transparent']} 
                start={{x: 0, y: 0}} 
                end={{x: 1, y: 0}} 
                style={styles.shimmerGradient} 
              />
            </Animated.View>

            {item.recent_posts && item.recent_posts.length > 0 && (
              <View style={styles.previewContainer}>
                <Text style={styles.previewLabel}>Recent posts:</Text>
                {item.recent_posts.slice(0, 2).map((post, postIndex) => (
                  <Animated.View key={postIndex} style={[styles.previewPost, { transform: [{ scale: pulseAnim }] }]}>
                    <Text style={styles.previewUsername}>@{post.username}</Text>
                    <Text style={styles.previewCaption} numberOfLines={1}>
                      {post.caption}
                    </Text>
                  </Animated.View>
                ))}
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };


  const renderContent = () => {
    if (loading) {
      return (
        <LinearGradient colors={['#0a0a0a', '#1a1a2a', '#0a0a0a']} style={styles.loadingContainer}>
          <Animated.View style={[styles.loadingContent, { opacity: fadeAnim, transform: [{ scale: pulseAnim }] }]}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading trending content...</Text>
            <Animated.View style={[styles.loadingGlow, { opacity: glowAnim }]} />
          </Animated.View>
        </LinearGradient>
      );
    }

    if (activeTab === 'topics') {
      return (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <FlatList
            data={filteredTopics}
            renderItem={renderTopicItem}
            keyExtractor={(item) => item.id}
            numColumns={1}
            contentContainerStyle={styles.topicsList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#3b82f6']}
                tintColor="#3b82f6"
              />
            }
            ListEmptyComponent={() => (
              <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <LinearGradient
                    colors={['rgba(59, 130, 246, 0.2)', 'rgba(147, 51, 234, 0.2)']}
                    style={styles.emptyIconContainer}
                  >
                    <Ionicons name={isSearching ? 'search' : 'trending-up'} size={60} color="#3b82f6" />
                  </LinearGradient>
                </Animated.View>
                <Text style={styles.emptyText}>
                  {isSearching 
                    ? `No hashtags found for "${searchQuery}"` 
                    : 'No trending hashtags found'
                  }
                </Text>
                <Text style={styles.emptySubText}>
                  {isSearching 
                    ? 'Try different keywords or clear the search'
                    : 'Hashtags from posts in the last 7 days will appear here'
                  }
                </Text>
                <Animated.View style={[styles.emptyGlow, { opacity: glowAnim }]} />
              </Animated.View>
            )}
          />
        </Animated.View>
      );
    }

    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <FlatList
          data={filteredPosts}
          renderItem={renderPostItem}
          keyExtractor={(item) => item.id}
          numColumns={activeTab === 'videos' ? 2 : 1}
          key={activeTab} // Force re-render when switching tabs
          contentContainerStyle={styles.postsList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3b82f6']}
              tintColor="#3b82f6"
            />
          }
          ListEmptyComponent={() => (
            <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <LinearGradient
                  colors={['rgba(59, 130, 246, 0.2)', 'rgba(147, 51, 234, 0.2)']}
                  style={styles.emptyIconContainer}
                >
                  <Ionicons
                    name={isSearching ? 'search' : (activeTab === 'videos' ? 'videocam' : 'document-text')}
                    size={60}
                    color="#3b82f6"
                  />
                </LinearGradient>
              </Animated.View>
              <Text style={styles.emptyText}>
                {isSearching 
                  ? `No results found for "${searchQuery}"` 
                  : `No trending ${activeTab === 'videos' ? 'videos' : 'posts'} found`
                }
              </Text>
              {isSearching && (
                <Text style={styles.emptySubText}>
                  Try different keywords or clear the search
                </Text>
              )}
              <Animated.View style={[styles.emptyGlow, { opacity: glowAnim }]} />
            </Animated.View>
          )}
        />
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['rgba(15, 15, 15, 0.95)', 'rgba(25, 25, 25, 0.9)']}
        style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 50 }]}
      >
        <Animated.View style={[styles.headerRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <LinearGradient
                colors={['rgba(59, 130, 246, 0.3)', 'rgba(147, 51, 234, 0.3)']}
                style={styles.backButtonGradient}
              >
                <Ionicons name="arrow-back" size={24} color="#3b82f6" />
              </LinearGradient>
              <Animated.View style={[styles.backButtonGlow, { opacity: glowAnim }]} />
            </TouchableOpacity>
          </Animated.View>
          <Text style={styles.headerTitle}>Trending</Text>
          <Animated.View style={[styles.betaTag, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient
              colors={['rgba(59, 130, 246, 0.8)', 'rgba(147, 51, 234, 0.8)']}
              style={styles.betaGradient}
            >
              <Text style={styles.betaText}>BETA</Text>
            </LinearGradient>
            <Animated.View style={[styles.betaGlow, { opacity: glowAnim }]} />
          </Animated.View>
        </Animated.View>

        {/* Search Bar */}
        <Animated.View style={[
          styles.searchContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            borderColor: searchFocusAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['rgba(59, 130, 246, 0.2)', 'rgba(59, 130, 246, 0.8)']
            }),
            shadowOpacity: searchFocusAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.2, 0.6]
            })
          }
        ]}>
          <LinearGradient
            colors={['rgba(30, 30, 30, 0.8)', 'rgba(40, 40, 40, 0.8)']}
            style={styles.searchGradient}
          >
            <Ionicons name="search" size={20} color="#3b82f6" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={activeTab === 'topics' ? 'Search hashtags...' : 'Search posts, captions...'}
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={handleSearch}
              onFocus={() => animateSearchFocus(true)}
              onBlur={() => animateSearchFocus(false)}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity 
                  onPress={() => handleSearch('')}
                  style={styles.clearButton}
                >
                  <LinearGradient
                    colors={['rgba(59, 130, 246, 0.3)', 'rgba(147, 51, 234, 0.3)']}
                    style={styles.clearButtonGradient}
                  >
                    <Ionicons name="close-circle" size={20} color="#3b82f6" />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}
          </LinearGradient>
          <Animated.View style={[styles.searchGlow, { opacity: glowAnim }]} />
        </Animated.View>

        {/* Tab Buttons */}
        {renderTabButtons()}
      </LinearGradient>

      {/* Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  backButton: {
    marginRight: 15,
    position: 'relative',
  },
  backButtonGradient: {
    padding: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 10,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textShadowColor: 'rgba(59, 130, 246, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  betaTag: {
    position: 'relative',
  },
  betaGradient: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  betaText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  betaGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  searchContainer: {
    borderRadius: 25,
    marginBottom: 15,
    borderWidth: 1,
    position: 'relative',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 8,
  },
  searchGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 24,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    paddingVertical: 0,
  },
  clearButton: {
    position: 'relative',
  },
  clearButtonGradient: {
    padding: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 27,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(20, 20, 20, 0.8)',
    borderRadius: 25,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
    position: 'relative',
    marginHorizontal: 10,
    height: 52,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabIndicator: {
    position: 'absolute',
    top: 6,
    left: 6,
    bottom: 6,
    width: (width - 40) / 3,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  tabGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 27,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 15,
  },
  tabButton: {
    flex: 1,
    borderRadius: 20,
    zIndex: 1,
    marginHorizontal: 2,
  },
  tabButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 20,
    minHeight: 40,
  },
  tabButtonGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 22,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  activeTabButton: {
    position: 'relative',
  },
  tabIcon: {
    marginRight: 4,
  },
  tabText: {
    color: '#888888',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#ffffff',
    fontWeight: 'bold',
    textShadowColor: 'rgba(59, 130, 246, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#888888',
    marginTop: 15,
    fontSize: 16,
    textShadowColor: 'rgba(59, 130, 246, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  loadingGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
  },
  postsList: {
    padding: 10,
  },
  topicsList: {
    padding: 15,
  },
  postWrapper: {
    margin: 5,
  },
  postCard: {
    borderRadius: 15,
    overflow: 'hidden',
    flex: 1,
  },
  postCardGradient: {
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 15,
    position: 'relative',
  },
  postGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 17,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  postContent: {
    padding: 12,
  },
  videoContainer: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  postVideo: {
    width: '100%',
    height: 180,
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
  },
  playIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  videoGlow: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 15,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 15,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  postImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
  },
  imageGlow: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 15,
    backgroundColor: 'rgba(147, 51, 234, 0.1)',
    shadowColor: '#9333ea',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 15,
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 10,
  },
  shimmerGradient: {
    flex: 1,
    borderRadius: 10,
  },
  postInfo: {
    gap: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 8,
  },
  avatarBorder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  avatarGlow: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 12,
  },
  usernameContainer: {
    flex: 1,
  },
  username: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: 'bold',
    textShadowColor: 'rgba(59, 130, 246, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  postCaption: {
    color: '#e5e5e5',
    fontSize: 14,
    lineHeight: 20,
  },
  postStats: {
    flexDirection: 'row',
    gap: 15,
  },
  statItem: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  statBackground: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statText: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '600',
  },
  topicWrapper: {
    marginBottom: 15,
  },
  topicCard: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  topicGradient: {
    padding: 20,
    position: 'relative',
  },
  topicGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 15,
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  topicRank: {
    marginRight: 12,
  },
  rankContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankNumber: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  topicInfo: {
    flex: 1,
  },
  hashtagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  hashtagText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  topicStats: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
  },
  trendingBadge: {
    position: 'relative',
  },
  badgeGradient: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  trendingScore: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  previewContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  previewLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '600',
  },
  previewPost: {
    marginBottom: 4,
  },
  previewUsername: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: 'bold',
  },
  previewCaption: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    position: 'relative',
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  emptyText: {
    color: '#888888',
    fontSize: 16,
    marginTop: 15,
    textAlign: 'center',
    textShadowColor: 'rgba(59, 130, 246, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  emptySubText: {
    color: '#666666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emptyGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
});

export default TrendingScreen;