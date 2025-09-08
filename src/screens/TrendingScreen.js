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
  TextInput
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

  // Tab configuration
  const tabs = [
    { id: 'all', label: 'All', icon: 'apps' },
    { id: 'videos', label: 'Videos', icon: 'play-circle' },
    { id: 'topics', label: 'hashtags', icon: 'trending-up' }
  ];

  useEffect(() => {
    fetchTrendingContent();
  }, [activeTab]);

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
    <View style={styles.tabContainer}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[
            styles.tabButton,
            activeTab === tab.id && styles.activeTabButton
          ]}
          onPress={() => setActiveTab(tab.id)}
        >
          <Ionicons
            name={tab.icon}
            size={20}
            color={activeTab === tab.id ? '#fff' : '#999'}
            style={styles.tabIcon}
          />
          <Text style={[
            styles.tabText,
            activeTab === tab.id && styles.activeTabText
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

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
              <Ionicons name="heart" size={16} color="#ff00ff" />
              <Text style={styles.statText}>{item.likes_count || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="chatbubble" size={16} color="#ff66ff" />
              <Text style={styles.statText}>{item.comments_count || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="time" size={16} color="#999" />
              <Text style={styles.statText}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderTopicItem = ({ item, index }) => {
    // Determine gradient colors based on trending rank
    const getGradientColors = (rank) => {
      if (rank >= 50) return ['#667eea', '#764ba2']; // High trending - blue to purple
      if (rank >= 20) return ['#f093fb', '#f5576c']; // Medium trending - pink to red
      return ['#4facfe', '#00f2fe']; // Low trending - blue to cyan
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

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff66ff" />
          <Text style={styles.loadingText}>Loading trending content...</Text>
        </View>
      );
    }

    if (activeTab === 'topics') {
      return (
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
              colors={['#ff66ff']}
              tintColor="#ff66ff"
            />
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name={isSearching ? 'search' : 'trending-up'} size={60} color="#666" />
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
            </View>
          )}
        />
      );
    }

    return (
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
            colors={['#ff66ff']}
            tintColor="#ff66ff"
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons
              name={isSearching ? 'search' : (activeTab === 'videos' ? 'videocam' : 'document-text')}
              size={60}
              color="#666"
            />
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
          </View>
        )}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#330033', '#440044']}
        style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 50 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ff66ff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trending</Text>
          <View style={styles.betaTag}>
            <Text style={styles.betaText}>BETA</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={activeTab === 'topics' ? 'Search hashtags...' : 'Search posts, captions...'}
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              onPress={() => handleSearch('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

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
    backgroundColor: '#220022',
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
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  betaTag: {
    backgroundColor: '#ff66ff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  betaText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#440044',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#330033',
    borderRadius: 25,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 20,
  },
  activeTabButton: {
    backgroundColor: '#ff00ff',
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#999',
    marginTop: 15,
    fontSize: 16,
  },
  postsList: {
    padding: 10,
  },
  topicsList: {
    padding: 15,
  },
  postCard: {
    backgroundColor: '#330033',
    borderRadius: 15,
    margin: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#440044',
    flex: 1,
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
    backgroundColor: '#440044',
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    backgroundColor: '#440044',
    marginBottom: 10,
  },
  playIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  postInfo: {
    gap: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  usernameContainer: {
    flex: 1,
  },
  username: {
    color: '#ff66ff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  postCaption: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
  },
  postStats: {
    flexDirection: 'row',
    gap: 15,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#999',
    fontSize: 12,
  },
  topicCard: {
    marginBottom: 15,
    borderRadius: 15,
    overflow: 'hidden',
  },
  topicGradient: {
    padding: 20,
  },
  topicContent: {
    alignItems: 'center',
  },
  topicTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'center',
  },
  topicEngagement: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    marginTop: 15,
  },
  emptySubText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  // Search and hashtag-specific styles
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  topicRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    color: '#fff',
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
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  topicStats: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
  },
  trendingBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  trendingScore: {
    color: '#fff',
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
});

export default TrendingScreen;