import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, FlatList, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { Video } from 'expo-av';

const { width } = Dimensions.get('window');

const TrendingScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [trendingVideos, setTrendingVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const videoRefs = useRef({});

  // Mock data for trending topics
  const trendingTopics = [
    { id: '1', name: 'NFL Draft' },
    { id: '2', name: 'Celtics' },
    { id: '3', name: 'Horror Novels' },
    { id: '4', name: 'Luka and LeBron' },
    { id: '5', name: 'Capitol Protest' },
  ];

  // Fetch random shorts from public accounts
  useEffect(() => {
    fetchRandomPublicShorts();
  }, [refreshing]);

  const fetchRandomPublicShorts = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Fetch video posts from public accounts
      // The RLS policy will automatically filter out private accounts
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          media_url,
          caption,
          type,
          created_at,
          profiles:user_id(*),
          likes:post_likes(count),
          comments:post_comments(count),
          user_likes:post_likes(user_id)
        `)
        .eq('type', 'video')
        .not('user_id', 'eq', user.id) // Exclude current user's videos
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Process the data to include like status
      const processedData = data.map(post => ({
        ...post,
        is_liked: post.user_likes?.some(like => like.user_id === user.id) || false,
        likes_count: post.likes?.[0]?.count || 0,
        comments_count: post.comments?.[0]?.count || 0
      }));
      
      // Shuffle the array to get random videos
      const shuffled = [...processedData].sort(() => 0.5 - Math.random());
      
      // Take only 4 videos for display, but keep all for scrolling in ShortsScreen
      const randomFourVideos = shuffled.slice(0, 4);
      
      setTrendingVideos(shuffled); // Store all videos for ShortsScreen
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching random public shorts:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const onRefresh = () => {
    setRefreshing(true);
    fetchRandomPublicShorts();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#0a0a2a', '#1a1a3a']}
        style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 50 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#00ffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <Text style={styles.searchPlaceholder}>Search for posts, users or feeds</Text>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
      >
        {/* Trending Section */}
        <View style={styles.trendingSection}>
          <View style={styles.trendingHeader}>
            <Ionicons name="trending-up" size={24} color="#0084ff" style={styles.trendingIcon} />
            <Text style={styles.trendingTitle}>Trending</Text>
            <View style={styles.betaTag}>
              <Text style={styles.betaText}>BETA</Text>
            </View>
            <TouchableOpacity style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.trendingSubtitle}>What people are posting about.</Text>

          {/* Trending Topics */}
          <View style={styles.topicsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {trendingTopics.map((topic) => (
                <TouchableOpacity key={topic.id} style={styles.topicPill}>
                  <Text style={styles.topicText}>{topic.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Trending Videos Section */}
        <View style={styles.trendingVideosSection}>
          <View style={styles.trendingHeader}>
            <LinearGradient
              colors={['#ff00ff', '#9900ff']}
              style={styles.iconBackground}
            >
              <Ionicons name="trending-up" size={24} color="#fff" style={styles.trendingIcon} />
            </LinearGradient>
            <Text style={styles.trendingTitle}>Trending Videos</Text>
            <View style={styles.betaTag}>
              <Text style={styles.betaText}>BETA</Text>
            </View>
          </View>
          <Text style={styles.trendingSubtitle}>Popular videos in your network.</Text>

          {/* Video Grid */}
          {loading ? (
            <ActivityIndicator size="large" color="#00ffff" style={styles.loader} />
          ) : trendingVideos.length > 0 ? (
            <FlatList
              data={trendingVideos.slice(0, 4)} // Only display 4 videos in the grid
              numColumns={2}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              renderItem={({ item, index }) => (
                <TouchableOpacity 
                  style={styles.videoCard}
                  onPress={() => navigation.navigate('Shorts', { 
                    posts: trendingVideos, // Pass all videos for scrolling
                    initialIndex: index // Start from the tapped video
                  })}
                >
                  <Video
                    ref={ref => { videoRefs.current[index] = ref }}
                    source={{ uri: item.media_url }}
                    style={styles.videoThumbnail}
                    resizeMode="cover"
                    shouldPlay={false}
                    isMuted={true}
                    isLooping={false}
                    useNativeControls={false}
                    posterSource={{ uri: item.media_url }}
                    usePoster={true}
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.videoOverlay}
                  >
                    <Text style={styles.username}>{item.profiles?.username || 'User'}</Text>
                    <View style={styles.likesContainer}>
                      <Ionicons name="heart" size={16} color="#ff00ff" />
                      <Text style={styles.likesCount}>{item.likes_count || 0}</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            />
          ) : (
            <Text style={styles.noVideosText}>No trending videos available</Text>
          )}
        </View>

        {/* Recommended Section */}
        <View style={styles.recommendedSection}>
          <View style={styles.recommendedHeader}>
            <LinearGradient
              colors={['#00ffff', '#0099ff']}
              style={styles.iconBackground}
            >
              <Ionicons name="bookmark-outline" size={24} color="#fff" />
            </LinearGradient>
            <Text style={styles.recommendedTitle}>Recommended</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000033',
  },
  header: {
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  backButton: {
    marginBottom: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  iconBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchPlaceholder: {
    color: '#666',
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  trendingSection: {
    padding: 15,
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  trendingIcon: {
    marginRight: 10,
  },
  trendingTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  betaTag: {
    backgroundColor: '#0084ff',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 10,
  },
  betaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  closeButton: {
    marginLeft: 'auto',
  },
  trendingSubtitle: {
    color: '#aaa',
    fontSize: 16,
    marginBottom: 15,
  },
  topicsContainer: {
    marginBottom: 20,
  },
  topicPill: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
  },
  topicText: {
    color: '#fff',
    fontSize: 14,
  },
  trendingVideosSection: {
    padding: 15,
  },
  videoCard: {
    flex: 1,
    margin: 5,
    borderRadius: 15,
    overflow: 'hidden',
    position: 'relative',
    height: 220,
    backgroundColor: '#1a1a3a',
    elevation: 5,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
    backgroundColor: '#1a1a3a',
  },
  videoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  username: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  likesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 15,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.3)',
  },
  likesCount: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 5,
    fontWeight: 'bold',
  },
  recommendedSection: {
    padding: 15,
  },
  recommendedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendedTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  loader: {
    marginVertical: 40,
    height: 220,
  },
  noVideosText: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 20,
    borderRadius: 10,
    overflow: 'hidden',
  },
});

export default TrendingScreen;