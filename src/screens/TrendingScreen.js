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
  RefreshControl
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
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const videoRefs = useRef({});

  // Tab configuration
  const tabs = [
    { id: 'all', label: 'All', icon: 'apps' },
    { id: 'videos', label: 'Videos', icon: 'play-circle' },
    { id: 'topics', label: 'Topics', icon: 'trending-up' }
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
    } catch (error) {
      console.error('Error fetching trending posts:', error);
    }
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
          user_id
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

      // Process topics
      const topicsMap = new Map();

      posts.forEach(post => {
        const likesCount = likesData.filter(like => like.post_id === post.id).length;
        const commentsCount = commentsData.filter(comment => comment.post_id === post.id).length;

        if (likesCount > 0) {
          const caption = post.caption.length > 50
            ? post.caption.substring(0, 47) + '...'
            : post.caption;

          if (!topicsMap.has(caption)) {
            topicsMap.set(caption, {
              id: `topic_${post.id}`,
              topic_name: caption,
              engagement_score: 0
            });
          }

          const topic = topicsMap.get(caption);
          topic.engagement_score += likesCount + commentsCount;
        }
      });

      // Convert to array and sort by engagement
      const topics = Array.from(topicsMap.values())
        .sort((a, b) => b.engagement_score - a.engagement_score)
        .slice(0, 15);

      setTrendingTopics(topics);
    } catch (error) {
      console.error('Error fetching trending topics:', error);
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

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTrendingPosts();
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
    navigation.navigate('TopicPosts', {
      topic: topic.topic_name,
      topicId: topic.id
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

  const renderTopicItem = ({ item, index }) => (
    <TouchableOpacity
      style={styles.topicCard}
      onPress={() => handleTopicPress(item)}
    >
      <LinearGradient
        colors={['#ff00ff', '#cc00cc']}
        style={styles.topicGradient}
      >
        <View style={styles.topicContent}>
          <Ionicons name="trending-up" size={24} color="#fff" />
          <Text style={styles.topicTitle}>{item.topic_name}</Text>
          <Text style={styles.topicEngagement}>
            {item.engagement_score} interactions
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

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
          data={trendingTopics}
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
              <Ionicons name="trending-up" size={60} color="#666" />
              <Text style={styles.emptyText}>No trending topics found</Text>
            </View>
          )}
        />
      );
    }

    return (
      <FlatList
        data={trendingPosts}
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
              name={activeTab === 'videos' ? 'videocam' : 'document-text'}
              size={60}
              color="#666"
            />
            <Text style={styles.emptyText}>
              No trending {activeTab === 'videos' ? 'videos' : 'posts'} found
            </Text>
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
        <TouchableOpacity
          style={styles.searchContainer}
          onPress={() => navigation.navigate('Search')}
        >
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <Text style={styles.searchPlaceholder}>Search for posts, users or feeds</Text>
        </TouchableOpacity>

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
  searchPlaceholder: {
    color: '#999999',
    fontSize: 16,
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
});

export default TrendingScreen;