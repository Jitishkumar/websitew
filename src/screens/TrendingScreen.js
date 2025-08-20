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

      let query = supabase
        .from('posts')
        .select(`
          id,
          user_id,
          caption,
          media_url,
          type,
          created_at,
          profiles:user_id(username, avatar_url)
        `)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .order('created_at', { ascending: false });

      // Filter by type if needed
      if (activeTab === 'videos') {
        query = query.eq('type', 'video');
      }

      const { data: posts, error: postsError } = await query.limit(50);

      if (postsError) throw postsError;

      // Get likes count for each post in the last 3 days
      const postIds = posts.map(p => p.id);
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: likesData, error: likesError } = await supabase
        .from('post_likes')
        .select('post_id, user_id')
        .in('post_id', postIds)
        .gte('created_at', threeDaysAgo);

      if (likesError) throw likesError;

      // Get comments count for each post in the last 3 days
      const { data: commentsData, error: commentsError } = await supabase
        .from('post_comments')
        .select('post_id, user_id')
        .in('post_id', postIds)
        .gte('created_at', threeDaysAgo);

      if (commentsError) throw commentsError;

      // Get user's likes
      const { data: userLikes, error: userLikesError } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', postIds);

      if (userLikesError) throw userLikesError;

      // Process and combine data
      const processedPosts = posts.map(post => {
        const postLikes = likesData.filter(like => like.post_id === post.id);
        const postComments = commentsData.filter(comment => comment.post_id === post.id);
        const isLiked = userLikes.some(like => like.post_id === post.id);

        return {
          ...post,
          username: post.profiles?.username || 'Unknown',
          avatar_url: post.profiles?.avatar_url,
          likes_count: postLikes.length,
          comments_count: postComments.length,
          is_liked: isLiked
        };
      });

      // Filter posts with at least 1 like and sort by likes
      const trendingPosts = processedPosts
        .filter(post => post.likes_count > 0)
        .sort((a, b) => {
          if (b.likes_count === a.likes_count) {
            return new Date(b.created_at) - new Date(a.created_at);
          }
          return b.likes_count - a.likes_count;
        })
        .slice(0, 20); // Top 20 trending posts

      setTrendingPosts(trendingPosts);
    } catch (error) {
      console.error('Error fetching trending posts:', error);
      setTrendingPosts([]);
    }
  };

  const fetchTrendingTopics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get posts from the last 7 days with captions
      const { data: posts, error: postsError } = await supabase
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

      if (postsError) throw postsError;

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

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTrendingContent();
    setRefreshing(false);
  };

  const handleUsernamePress = (userId, username) => {
    // Navigate to UserProfileScreen when username is clicked
    navigation.navigate('UserProfileScreen', { 
      userId,
      username 
    });
  };

  const handlePostPress = (post, index) => {
    if (post.type === 'video') {
      // Navigate to Shorts screen for videos
      const videoData = trendingPosts.filter(p => p.type === 'video');
      const videoIndex = videoData.findIndex(p => p.id === post.id);
      navigation.navigate('Shorts', { 
        posts: videoData,
        initialIndex: videoIndex 
      });
    } else {
      // Navigate to full screen post view for other posts
      navigation.navigate('PostViewer', { 
        post,
        posts: trendingPosts.filter(p => p.type !== 'video'),
        initialIndex: trendingPosts.findIndex(p => p.id === post.id)
      });
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