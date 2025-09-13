import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  TextInput,
  Animated,
  StatusBar,
  Platform,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { Video } from 'expo-av';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

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

  // Premium Animation Values
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const parallaxAnim = useRef(new Animated.Value(0)).current;
  const tabSlideAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start all premium animations
    startPremiumAnimations();
    fetchTrendingContent();
  }, [activeTab]);

  const startPremiumAnimations = () => {
    // Glow effect for header
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

    // Pulse effect for trending badges
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Shimmer effect for cards
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();

    // Float effect for icons
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Sparkle effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Wave effect for background
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      })
    ).start();

    // Breathe effect for the whole screen
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1.02,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // Tab configuration with premium icons
  const tabs = [
    { 
      id: 'all', 
      label: 'Discover', 
      icon: 'sparkles',
      gradient: ['#FF6B6B', '#4ECDC4']
    },
    { 
      id: 'videos', 
      label: 'Reels', 
      icon: 'videocam',
      gradient: ['#667eea', '#764ba2']
    },
    { 
      id: 'topics', 
      label: 'Topics', 
      icon: 'trending-up',
      gradient: ['#f093fb', '#f5576c']
    }
  ];

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
        p_limit: 20, // Show more posts for premium experience
        p_days: 7    // Extended to 7 days
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
          likes: post.like_count,
          comments: postComments.length,
          isLiked: isLiked,
          trendingScore: Math.floor(Math.random() * 100) + 1, // Add trending score
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
    const hashtagRegex = /#[a-zA-Z0-9_\u00c0-\u024f\u1e00-\u1eff]+/g;
    const matches = text.match(hashtagRegex);
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

      const { data: likesData, error: likesError } = await supabase
        .from('post_likes')
        .select('post_id')
        .in('post_id', postIds)
        .gte('created_at', threeDaysAgo);

      if (likesError) throw likesError;

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
                trending_rank: 0,
                velocity: Math.floor(Math.random() * 50) + 1, // Trending velocity
              });
            }

            const hashtagData = hashtagsMap.get(hashtag);
            hashtagData.post_count += 1;
            hashtagData.engagement_score += engagementScore;
            
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

      const topics = Array.from(hashtagsMap.values())
        .map((hashtag, index) => {
          const engagementWeight = hashtag.engagement_score * 2;
          const postCountWeight = hashtag.post_count * 1.5;
          const trendingScore = Math.max(1, engagementWeight + postCountWeight);
          
          return {
            ...hashtag,
            trending_rank: Math.round(trendingScore),
            display_text: `${hashtag.post_count} post${hashtag.post_count !== 1 ? 's' : ''}`,
            rank_position: index + 1,
          };
        })
        .filter(hashtag => hashtag.post_count >= 1)
        .sort((a, b) => b.trending_rank - a.trending_rank)
        .slice(0, 25);

      setTrendingTopics(topics);
      setFilteredTopics(topics);
    } catch (error) {
      console.error('Error fetching trending hashtags:', error);
      setTrendingTopics([]);
    }
  };

  const handlePrivacyNavigation = async (userId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigation.navigate('Login');
        return;
      }

      if (user.id === userId) {
        navigation.navigate('Profile');
        return;
      }

      const { data: settingsData, error: settingsError } = await supabase
        .rpc('get_user_privacy', { target_user_id: userId })
        .maybeSingle();

      if (settingsError) throw settingsError;

      if (!settingsData) {
        navigation.navigate('UserProfileScreen', { userId });
        return;
      }

      const isPrivate = settingsData.private_account ?? false;

      if (isPrivate) {
        const { data: followData, error: followError } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', user.id)
          .eq('following_id', userId)
          .maybeSingle();

        if (followError) throw followError;

        if (!followData) {
          navigation.navigate('PrivateProfileScreen', { userId });
          return;
        }
      }

      navigation.navigate('UserProfileScreen', { userId });
    } catch (error) {
      console.error('Error checking profile privacy:', error);
      navigation.navigate('UserProfileScreen', { userId });
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    setIsSearching(query.length > 0);
    
    if (query.length === 0) {
      setFilteredPosts(trendingPosts);
      setFilteredTopics(trendingTopics);
      return;
    }

    const lowercaseQuery = query.toLowerCase();

    if (activeTab === 'topics') {
      const filtered = trendingTopics.filter(topic => 
        topic.hashtag.toLowerCase().includes(lowercaseQuery) ||
        topic.recent_posts.some(post => 
          post.caption.toLowerCase().includes(lowercaseQuery) ||
          post.username.toLowerCase().includes(lowercaseQuery)
        )
      );
      setFilteredTopics(filtered);
    } else {
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
    
    // Add satisfying animation during refresh
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    await fetchTrendingContent();
    setRefreshing(false);
  };

  const handleUsernamePress = (userId, username) => {
    // Add haptic feedback
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    handlePrivacyNavigation(userId);
  };

  const handlePostPress = async (post, index) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigation.navigate('Login');
        return;
      }

      // Add premium press animation
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.96,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

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
      handlePrivacyNavigation(post.user_id);
    }
  };

  const handleTopicPress = (topic) => {
    navigation.navigate('Search', {
      initialQuery: topic.hashtag,
      searchType: 'hashtag'
    });
  };

  const handleTabPress = (tabId) => {
    // Animate tab change
    Animated.timing(tabSlideAnim, {
      toValue: tabs.findIndex(tab => tab.id === tabId),
      duration: 300,
      useNativeDriver: false,
    }).start();
    
    setActiveTab(tabId);
  };

  const renderTabButtons = () => (
    <View style={styles.tabContainer}>
      {/* Premium glow effect */}
      <Animated.View
        style={[
          styles.glowEffect,
          {
            opacity: glowAnim,
          }
        ]}
      >
        <LinearGradient
          colors={['#ff00ff', '#ff6b9d', '#00ffff', '#ff00ff']}
          style={styles.glowGradient}
        />
      </Animated.View>

      <LinearGradient
        colors={['rgba(30, 30, 30, 0.8)', 'rgba(40, 40, 40, 0.8)']}
        style={styles.tabBackground}
      >
        <BlurView intensity={80} tint="dark" style={styles.tabBlur}>
          <Animated.View style={[
            styles.tabIndicator,
            {
              transform: [{
                translateX: tabSlideAnim.interpolate({
                  inputRange: [0, 1, 2],
                  outputRange: [0, (width - 52) / 3, ((width - 52) / 3) * 2],
                })
              }]
            }
          ]} />
          {tabs.map((tab, index) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton]}
              onPress={() => handleTabPress(tab.id)}
            >
              <LinearGradient
                colors={activeTab === tab.id ? tab.gradient : ['transparent', 'transparent']}
                style={styles.tabGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Animated.View 
                  style={[
                    styles.tabContent,
                    activeTab === tab.id && { 
                      transform: [{ scale: pulseAnim }, { translateY: floatAnim }] 
                    }
                  ]}
                >
                  <Ionicons
                    name={tab.icon}
                    size={20}
                    color={activeTab === tab.id ? '#ffffff' : '#666666'}
                    style={styles.tabIcon}
                  />
                  <Animated.Text style={[
                    styles.tabText,
                    activeTab === tab.id && styles.activeTabText,
                    {
                      transform: [
                        { translateY: activeTab === tab.id ? floatAnim : 0 },
                        { scale: activeTab === tab.id ? pulseAnim : 1 }
                      ]
                    }
                  ]}>
                    {tab.label}
                  </Animated.Text>
                  {activeTab === tab.id && (
                    <Animated.View 
                      style={[
                        styles.sparkle,
                        { opacity: sparkleAnim, transform: [{ rotate: sparkleAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg']
                        })}] }
                      ]}
                    >
                      <Ionicons name="sparkles" size={12} color="#FFD700" />
                    </Animated.View>
                  )}
                </Animated.View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </BlurView>
      </LinearGradient>
    </View>
  );

  const renderTrendingBadge = (rank) => {
    const getBadgeStyle = (rank) => {
      if (rank >= 80) return { colors: ['#FF6B6B', '#FF8E8E'], icon: 'flame', label: 'HOT' };
      if (rank >= 60) return { colors: ['#4ECDC4', '#45B7A8'], icon: 'trending-up', label: 'RISING' };
      if (rank >= 40) return { colors: ['#FFE66D', '#FFD93D'], icon: 'flash', label: 'BUZZ' };
      return { colors: ['#A8E6CF', '#7FCDCD'], icon: 'pulse', label: 'NEW' };
    };

    const badgeStyle = getBadgeStyle(rank);

    return (
      <Animated.View style={[
        styles.trendingBadgeContainer,
        { transform: [{ scale: pulseAnim }] }
      ]}>
        <LinearGradient
          colors={badgeStyle.colors}
          style={styles.trendingBadge}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name={badgeStyle.icon} size={10} color="#fff" />
          <Text style={styles.trendingBadgeText}>{badgeStyle.label}</Text>
        </LinearGradient>
      </Animated.View>
    );
  };

  const renderPostItem = ({ item, index }) => {
    const animatedStyle = {
      transform: [
        { 
          translateY: shimmerAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -2]
          })
        },
        { scale: scaleAnim }
      ]
    };

    return (
      <Animated.View style={[animatedStyle, { marginBottom: 20 }]}>
        <TouchableOpacity
          style={styles.premiumPostCard}
          onPress={() => handlePostPress(item, index)}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['rgba(30, 30, 30, 0.95)', 'rgba(40, 40, 40, 0.9)']}
            style={styles.postCardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Shimmer overlay */}
            <Animated.View 
              style={[
                styles.shimmerOverlay,
                {
                  opacity: shimmerAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 0.1, 0]
                  })
                }
              ]}
            />

            <View style={styles.postContent}>
              {/* Trending badge */}
              {renderTrendingBadge(item.trendingScore || 50)}

              {/* Media */}
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
                  <Animated.View 
                    style={[
                      styles.playIconOverlay,
                      { transform: [{ scale: pulseAnim }] }
                    ]}
                  >
                    <LinearGradient
                      colors={['rgba(59, 130, 246, 0.8)', 'rgba(147, 51, 234, 0.8)']}
                      style={styles.playButton}
                    >
                      <Ionicons name="play" size={30} color="#ffffff" />
                    </LinearGradient>
                  </Animated.View>
                </View>
              ) : (
                <Image source={{ uri: item.media_url }} style={styles.postImage} />
              )}

              {/* Post Info */}
              <View style={styles.postInfo}>
                <View style={styles.userInfo}>
                  <View style={styles.avatarContainer}>
                    <Image
                      source={{
                        uri: item.avatar_url || 'https://via.placeholder.com/40x40.png?text=User'
                      }}
                      style={styles.userAvatar}
                    />
                    <View style={styles.onlineIndicator} />
                  </View>
                  
                  <TouchableOpacity
                    onPress={() => handleUsernamePress(item.user_id, item.username)}
                    style={styles.usernameContainer}
                  >
                    <Text style={styles.username}>@{item.username}</Text>
                    <Text style={styles.trendingText}>Trending Creator</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>#{index + 1}</Text>
                  </View>
                </View>

                <Text style={styles.postCaption} numberOfLines={2}>
                  {item.caption}
                </Text>

                {/* Enhanced Stats */}
                <View style={styles.postStats}>
                  <Animated.View 
                    style={[
                      styles.statItem,
                      { transform: [{ translateY: floatAnim }] }
                    ]}
                  >
                    <LinearGradient
                      colors={['#FF6B6B', '#FF8E8E']}
                      style={styles.statGradient}
                    >
                      <Ionicons name="heart" size={14} color="#fff" />
                    </LinearGradient>
                    <Text style={styles.statText}>{item.likes_count || 0}</Text>
                  </Animated.View>
                  
                  <Animated.View 
                    style={[
                      styles.statItem,
                      { transform: [{ translateY: floatAnim }] }
                    ]}
                  >
                    <LinearGradient
                      colors={['#4ECDC4', '#45B7A8']}
                      style={styles.statGradient}
                    >
                      <Ionicons name="chatbubble" size={14} color="#fff" />
                    </LinearGradient>
                    <Text style={styles.statText}>{item.comments_count || 0}</Text>
                  </Animated.View>
                  
                  <Animated.View 
                    style={[
                      styles.statItem,
                      { transform: [{ translateY: floatAnim }] }
                    ]}
                  >
                    <LinearGradient
                      colors={['#FFE66D', '#FFD93D']}
                      style={styles.statGradient}
                    >
                      <Ionicons name="share-social" size={14} color="#fff" />
                    </LinearGradient>
                    <Text style={styles.statText}>Share</Text>
                  </Animated.View>

                  <View style={styles.timeContainer}>
                    <Ionicons name="time" size={12} color="#888888" />
                    <Text style={styles.timeText}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderTopicItem = ({ item, index }) => {
    const animatedStyle = {
      transform: [
        { 
          translateY: shimmerAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -3]
          })
        },
        { scale: scaleAnim }
      ]
    };

    return (
      <Animated.View style={[animatedStyle, { marginBottom: 15 }]}>
        <TouchableOpacity
          style={styles.topicCard}
          onPress={() => handleTopicPress(item)}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['rgba(30, 30, 30, 0.9)', 'rgba(40, 40, 40, 0.85)']}
            style={styles.topicCardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.topicContent}>
              <View style={styles.topicHeader}>
                <View style={styles.topicRank}>
                  <LinearGradient
                    colors={index < 3 ? ['#FFD700', '#FFA500'] : ['#667eea', '#764ba2']}
                    style={styles.rankCircle}
                  >
                    <Text style={styles.topicRankText}>#{index + 1}</Text>
                  </LinearGradient>
                </View>
                
                <View style={styles.topicInfo}>
                  <Text style={styles.topicHashtag}>{item.hashtag}</Text>
                  <Text style={styles.topicStats}>
                    {item.display_text} • {item.velocity}% velocity
                  </Text>
                </View>

                <Animated.View style={[
                  styles.trendingIndicator,
                  { transform: [{ scale: pulseAnim }] }
                ]}>
                  <LinearGradient
                    colors={['#FF6B6B', '#FF8E8E']}
                    style={styles.trendingDot}
                  >
                    <Ionicons name="trending-up" size={16} color="#fff" />
                  </LinearGradient>
                </Animated.View>
              </View>

              {/* Recent Posts Preview */}
              {item.recent_posts && item.recent_posts.length > 0 && (
                <View style={styles.recentPosts}>
                  {item.recent_posts.slice(0, 2).map((post, postIndex) => (
                    <View key={post.id} style={styles.recentPostItem}>
                      <Text style={styles.recentPostUsername}>@{post.username}</Text>
                      <Text style={styles.recentPostCaption} numberOfLines={1}>
                        {post.caption}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Topic Metrics */}
              <View style={styles.topicMetrics}>
                <Animated.View 
                  style={[
                    styles.metricItem,
                    { transform: [{ translateY: floatAnim }] }
                  ]}
                >
                  <LinearGradient
                    colors={['#4ECDC4', '#45B7A8']}
                    style={styles.metricGradient}
                  >
                    <Ionicons name="pulse" size={12} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.metricText}>{item.trending_rank} Score</Text>
                </Animated.View>
                
                <Animated.View 
                  style={[
                    styles.metricItem,
                    { transform: [{ translateY: floatAnim }] }
                  ]}
                >
                  <LinearGradient
                    colors={['#FFE66D', '#FFD93D']}
                    style={styles.metricGradient}
                  >
                    <Ionicons name="chatbubbles" size={12} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.metricText}>{item.engagement_score} Engagement</Text>
                </Animated.View>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <Animated.View style={[
        styles.loadingGradient,
        { transform: [{ scale: pulseAnim }] }
      ]}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.loadingGradient}
        >
          <ActivityIndicator size="large" color="#ffffff" />
        </LinearGradient>
      </Animated.View>
      
      <Text style={styles.loadingText}>
        {activeTab === 'topics' ? 'Discovering trending topics...' : 'Loading trending content...'}
      </Text>
      
      <View style={styles.loadingDots}>
        {[0, 1, 2].map(index => (
          <Animated.View
            key={index}
            style={[
              styles.loadingDot,
              {
                opacity: shimmerAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: index === 0 ? [0.3, 1, 0.3] : index === 1 ? [1, 0.3, 1] : [0.3, 1, 0.3]
                })
              }
            ]}
          />
        ))}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Animated.View style={[
        styles.emptyIconContainer,
        { transform: [{ scale: breatheAnim }] }
      ]}>
        <LinearGradient
          colors={['rgba(102, 126, 234, 0.2)', 'rgba(118, 75, 162, 0.2)']}
          style={styles.emptyGradient}
        >
          <Ionicons 
            name={activeTab === 'topics' ? 'trending-down' : 'search'} 
            size={60} 
            color="#667eea" 
          />
        </LinearGradient>
      </Animated.View>
      
      <Text style={styles.emptyTitle}>
        {isSearching ? 'No results found' : 'No trending content'}
      </Text>
      
      <Text style={styles.emptySubtitle}>
        {isSearching 
          ? 'Try adjusting your search terms'
          : activeTab === 'topics'
            ? 'Check back later for trending topics'
            : 'Be the first to create trending content!'
        }
      </Text>
    </View>
  );

  return (
    <Animated.View style={[
      styles.container,
      { transform: [{ scale: breatheAnim }] }
    ]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Animated Background */}
      <LinearGradient
        colors={['#000000', '#1a1a1a', '#000000']}
        style={styles.backgroundGradient}
      />
      
      <Animated.View style={[
        styles.waveBackground,
        {
          transform: [{
            translateX: waveAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-width, width]
            })
          }]
        }
      ]}>
        <LinearGradient
          colors={['rgba(102, 126, 234, 0.05)', 'transparent', 'rgba(118, 75, 162, 0.05)']}
          style={styles.waveGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Header */}
      <Animated.View style={[
        styles.header,
        { 
          paddingTop: insets.top + 20,
          opacity: headerOpacity 
        }
      ]}>
        {/* Header Glow Effect */}
        <Animated.View style={[
          styles.headerGlow,
          {
            opacity: glowAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.1, 0.3]
            })
          }
        ]} />
        
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <LinearGradient
              colors={['rgba(102, 126, 234, 0.8)', 'rgba(118, 75, 162, 0.8)']}
              style={styles.backGradient}
            >
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              <Text style={styles.trendingWord}>Trending</Text>{' '}
              <Text style={styles.nowWord}>Now</Text>
            </Text>
            <Text style={styles.headerSubtitle}>
              Discover what's popular
            </Text>
          </View>

          <Animated.View style={[
            styles.betaTag,
            { transform: [{ scale: pulseAnim }] }
          ]}>
            <LinearGradient
              colors={['#FF6B6B', '#FF8E8E']}
              style={styles.betaGradient}
            >
              <Ionicons name="flame" size={12} color="#ffffff" />
              <Text style={styles.betaText}>BETA</Text>
            </LinearGradient>
          </Animated.View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <LinearGradient
            colors={['rgba(30, 30, 30, 0.8)', 'rgba(40, 40, 40, 0.8)']}
            style={styles.searchGradient}
          >
            <BlurView intensity={80} tint="dark" style={styles.searchBlur}>
              <Ionicons
                name="search"
                size={20}
                color="#667eea"
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder={
                  activeTab === 'topics' 
                    ? "Search trending topics..." 
                    : "Search trending posts..."
                }
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={searchQuery}
                onChangeText={handleSearch}
                returnKeyType="search"
              />
              
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => handleSearch('')}
                >
                  <LinearGradient
                    colors={['rgba(102, 126, 234, 0.6)', 'rgba(118, 75, 162, 0.6)']}
                    style={styles.clearGradient}
                  >
                    <Ionicons name="close" size={16} color="#ffffff" />
                  </LinearGradient>
                </TouchableOpacity>
              )}
              
              {!isSearching && (
                <Animated.View style={[
                  styles.searchSuggestion,
                  { opacity: sparkleAnim }
                ]}>
                  <Ionicons name="sparkles" size={12} color="#667eea" />
                </Animated.View>
              )}
            </BlurView>
          </LinearGradient>
        </View>

        {/* Tab Buttons */}
        {renderTabButtons()}
      </Animated.View>

      {/* Content */}
      <View style={styles.content}>
        {loading ? (
          renderLoadingState()
        ) : (
          <>
            {activeTab === 'topics' ? (
              filteredTopics.length === 0 ? (
                renderEmptyState()
              ) : (
                <FlatList
                  data={filteredTopics}
                  renderItem={renderTopicItem}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.topicsList}
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      colors={['#667eea', '#764ba2']}
                      tintColor="#667eea"
                      progressBackgroundColor="#1a1a1a"
                    />
                  }
                />
              )
            ) : (
              filteredPosts.length === 0 ? (
                renderEmptyState()
              ) : (
                <FlatList
                  data={filteredPosts}
                  renderItem={renderPostItem}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.postsList}
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      colors={['#667eea', '#764ba2']}
                      tintColor="#667eea"
                      progressBackgroundColor="#1a1a1a"
                    />
                  }
                />
              )
            )}
          </>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  waveBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: width * 3,
  },
  waveGradient: {
    flex: 1,
  },
  header: {
    paddingBottom: 20,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderRadius: 30,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    zIndex: 10,
  },
  backButton: {
    marginRight: 20,
    borderRadius: 25,
    overflow: 'hidden',
  },
  backGradient: {
    width: 45,
    height: 45,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  trendingWord: {
    color: '#ffffff',
  },
  nowWord: {
    color: '#667eea',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  betaTag: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  betaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  betaText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  searchContainer: {
    marginBottom: 20,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 10,
  },
  searchGradient: {
    borderRadius: 30,
    overflow: 'hidden',
  },
  searchBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.2)',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearButton: {
    marginLeft: 8,
    borderRadius: 15,
    overflow: 'hidden',
  },
  clearGradient: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchSuggestion: {
    position: 'absolute',
    right: 50,
    top: '50%',
    marginTop: -6,
  },
  tabContainer: {
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  tabBackground: {
    borderRadius: 30,
  },
  tabBlur: {
    flexDirection: 'row',
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.15)',
  },
  tabIndicator: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    height: 44,
    backgroundColor: 'rgba(102, 126, 234, 0.3)',
    borderRadius: 22,
    zIndex: 0,
  },
  tabButton: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    zIndex: 1,
  },
  tabGradient: {
    borderRadius: 22,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    position: 'relative',
  },
  tabIcon: {
    marginRight: 8,
  },
  tabText: {
    color: '#666666',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  sparkle: {
    position: 'absolute',
    top: -2,
    right: -2,
  },
  glowEffect: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    height: 4,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  glowGradient: {
    flex: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#667eea',
  },
  postsList: {
    padding: 20,
  },
  topicsList: {
    padding: 20,
  },
  premiumPostCard: {
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  postCardGradient: {
    borderRadius: 25,
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderRadius: 25,
  },
  postContent: {
    position: 'relative',
  },
  trendingBadgeContainer: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 10,
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  trendingBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  videoContainer: {
    position: 'relative',
  },
  postVideo: {
    width: '100%',
    height: 300,
    backgroundColor: '#1a1a1a',
  },
  postImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#1a1a1a',
  },
  playIconOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -30,
    marginLeft: -30,
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  postInfo: {
    padding: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#667eea',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4ECDC4',
    borderWidth: 2,
    borderColor: '#000',
  },
  usernameContainer: {
    flex: 1,
  },
  username: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  trendingText: {
    color: '#667eea',
    fontSize: 12,
    fontWeight: '500',
  },
  rankBadge: {
    backgroundColor: 'rgba(102, 126, 234, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#667eea',
  },
  rankText: {
    color: '#667eea',
    fontSize: 12,
    fontWeight: '800',
  },
  postCaption: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 15,
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statGradient: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '500',
  },
  topicCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 12,
  },
  topicCardGradient: {
    borderRadius: 20,
  },
  topicContent: {
    padding: 20,
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  topicRank: {
    marginRight: 15,
  },
  rankCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topicRankText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  topicInfo: {
    flex: 1,
  },
  topicHashtag: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  topicStats: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  trendingIndicator: {
    marginLeft: 10,
  },
  trendingDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentPosts: {
    marginBottom: 15,
  },
  recentPostItem: {
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  recentPostUsername: {
    color: '#667eea',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  recentPostCaption: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    lineHeight: 16,
  },
  topicMetrics: {
    flexDirection: 'row',
    gap: 15,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricGradient: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    marginBottom: 20,
  },
  emptyGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(102, 126, 234, 0.3)',
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default TrendingScreen;