import React, { useState, useEffect, useRef } from 'react';
import { useVideo } from '../context/VideoContext';
import { useNotifications } from '../context/NotificationContext';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, Image, Modal, ActivityIndicator, FlatList, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { StoriesService } from '../services/StoriesService';
import { PostsService } from '../services/PostsService';
import { Video } from 'expo-av';
import PostItem from '../components/PostItem';
import { SafeAreaView } from 'react-native-safe-area-context';

const HomeScreen = () => {
  const navigation = useNavigation();
  const { unreadCount: notificationUnreadCount } = useNotifications();
  const [stories, setStories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [postText, setPostText] = useState('');
  const [showPostInput, setShowPostInput] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);

  let [fontsLoaded] = useFonts({
    Poppins_700Bold,
  });

  useEffect(() => {
    loadStories();
    loadPosts();

    // Add a test post for debugging
    addTestPost();

    const unsubscribe = navigation.addListener('focus', () => {
      const params = navigation.getState().routes.find(route => route.name === 'Home')?.params;
      if (params?.refresh) {
        if (params.updatedPosts) {
          setPosts(params.updatedPosts);
        } else {
          loadPosts();
        }
        navigation.setParams({ refresh: undefined, updatedPosts: undefined });
      }
    });

    return unsubscribe;
  }, [navigation]);
  
  // Function to add a test post for debugging
  const addTestPost = () => {
    const testPost = {
      id: 'test-post-' + Date.now(),
      user_id: 'test-user',
      type: 'image',
      media_url: 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
      caption: 'This is a test post to verify rendering',
      created_at: new Date().toISOString(),
      profiles: {
        id: 'test-user',
        username: 'testuser',
        avatar_url: 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg'
      },
      likes: [{ count: 5 }],
      comments: [{ count: 2 }],
      is_liked: false
    };
    
    setPosts(prevPosts => [testPost, ...prevPosts]);
  };
  
  // Set up video context for auto-playing videos
  const { setActiveVideo, clearActiveVideo } = useVideo();
  const visibleVideoRef = useRef(null);
  
  // Add a function to handle viewable items changed with debounce to prevent rapid changes
  const lastViewabilityUpdate = useRef(Date.now());
  const debounceTimeMs = 500; // Minimum time between viewability updates
  
  const onViewableItemsChanged = ({ viewableItems, changed }) => {
    // Debounce viewability changes to prevent rapid updates
    const now = Date.now();
    if (now - lastViewabilityUpdate.current < debounceTimeMs) {
      return; // Skip this update if it's too soon after the last one
    }
    lastViewabilityUpdate.current = now;
    
    if (viewableItems && viewableItems.length > 0) {
      // Track all visible video posts
      const visibleVideoPosts = viewableItems.filter(item => 
        item.item && (item.item.type === 'video' || item.item.mediaType === 'video')
      );
      
      // Find the first video post that's visible with at least 50% visibility
      const primaryVideoPost = visibleVideoPosts.find(item => item.percentVisible >= 50);
      
      if (primaryVideoPost) {
        // Only update if this is a different video than the current active one
        if (visibleVideoRef.current !== primaryVideoPost.item.id) {
          setActiveVideo(primaryVideoPost.item.id);
          visibleVideoRef.current = primaryVideoPost.item.id;
        }
      } else if (visibleVideoPosts.length > 0) {
        // If no video has 50% visibility but there are visible videos,
        // use the one with the highest visibility
        const mostVisibleVideo = visibleVideoPosts.reduce((prev, current) => 
          (prev.percentVisible > current.percentVisible) ? prev : current
        );
        
        // Only update if this is a different video than the current active one
        if (visibleVideoRef.current !== mostVisibleVideo.item.id) {
          setActiveVideo(mostVisibleVideo.item.id);
          visibleVideoRef.current = mostVisibleVideo.item.id;
        }
      } else if (visibleVideoRef.current) {
        // If no video posts are visible and we have an active video, clear it
        clearActiveVideo();
        visibleVideoRef.current = null;
      }
    } else if (visibleVideoRef.current) {
      // If no items are viewable at all and we have an active video, clear it
      clearActiveVideo();
      visibleVideoRef.current = null;
    }
  };
  
  
  // Create a ref for the viewability configuration
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 40, // Consider an item visible when 40% is visible
    minimumViewTime: 500, // Wait 500ms before considering an item as viewable
    waitForInteraction: false // Don't require user interaction before considering items viewable
  });
  
  // Create a ref for the viewability changed callback
  const viewabilityConfigCallbackPairs = useRef([
    { viewabilityConfig: viewabilityConfig.current, onViewableItemsChanged }
  ]);

  const loadPosts = async () => {
    try {
      const data = await PostsService.getAllPosts();
      
      // Debug: Log the first post to see its structure
      if (data && data.length > 0) {
        console.log('First post structure:', JSON.stringify(data[0], null, 2));
      } else {
        console.log('No posts returned from Supabase');
      }
      
      // Filter out any null or invalid posts
      const validPosts = data.filter(post => post && post.id);
      
      if (validPosts.length !== data.length) {
        console.warn(`Filtered out ${data.length - validPosts.length} invalid posts`);
      }
      
      // Ensure all posts have the required fields
      const normalizedPosts = validPosts.map(post => ({
        ...post,
        type: post.type || 'text',
        media_url: post.media_url || '',
        caption: post.caption || '',
        profiles: post.profiles || { username: 'Unknown', avatar_url: '' },
        likes: post.likes || [{ count: 0 }],
        comments: post.comments || [{ count: 0 }],
        is_liked: post.is_liked || false
      }));
      
      setPosts(normalizedPosts);
      setRefreshing(false);
      
      // Store video posts separately for the ShortsScreen
      const videoPosts = normalizedPosts.filter(post => post.type === 'video');
      // Make this data available to the navigation context
      navigation.setParams({
        videoPosts: videoPosts
      });
    } catch (error) {
      console.error('Error loading posts:', error);
      Alert.alert('Error', 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const loadStories = async () => {
    try {
      const data = await StoriesService.getActiveStories();
      const formattedStories = data.map(group => ({
        ...group.stories[0],
        profiles: group.user,
        groupedStories: group.stories,
        story_group_id: group.stories[0].story_group_id,
        has_unviewed: group.has_unviewed
      }));
      setStories(formattedStories);
    } catch (error) {
      console.error('Error loading stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStory = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        const uri = result.assets[0].uri;
        const type = uri.endsWith('.mp4') ? 'video' : 'image';
        
        await StoriesService.uploadStory(uri, type);
        await loadStories();
        Alert.alert('Success', 'Story uploaded successfully');
      }
    } catch (error) {
      console.error('Error adding story:', error);
      Alert.alert('Error', 'Failed to upload story');
    } finally {
      setUploading(false);
    }
  };

  const handleStoryPress = (story) => {
    navigation.navigate('Stories', {
      storyGroupId: story.story_group_id,
      userId: story.user_id,
      initialStoryIndex: 0
    });
  };

  const handleCreatePost = () => {
    navigation.navigate('CreatePost');
  };

  if (!fontsLoaded) {
    return null;
  }

  const renderHeader = () => (
    <>
      <LinearGradient
        colors={['#0f0f23', '#1a1a2e', '#16213e']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.header}
      >
        <LinearGradient
          colors={['#ffd700', '#ffed4e']}
          style={styles.logoGradient}
        >
          <Text style={styles.logo}>Flexx</Text>
        </LinearGradient>
        <View style={styles.headerIcons}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <LinearGradient
              colors={['#ffd700', '#ffed4e']}
              style={styles.iconBackground}
            >
              <Ionicons name="notifications-outline" size={22} color="#000" />
              {notificationUnreadCount > 0 && (
                <View style={[styles.notificationBadge, {
                  width: notificationUnreadCount > 99 ? 20 : notificationUnreadCount > 9 ? 18 : 16,
                }]}>
                  <Text style={[styles.notificationBadgeText, {
                    fontSize: notificationUnreadCount > 99 ? 8 : 10,
                  }]}>
                    {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
                  </Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => navigation.navigate('Trending')}
          >
            <LinearGradient
              colors={['#ffd700', '#ffed4e']}
              style={styles.iconBackground}
            >
              <Ionicons name="trending-up" size={22} color="#000" />
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => navigation.navigate('Search')}
          >
            <LinearGradient
              colors={['#ffd700', '#ffed4e']}
              style={styles.iconBackground}
            >
              <Ionicons name="search-outline" size={22} color="#000" />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}
             onPress={() => {
               // Reset navigation state and then navigate to HomePage
               // This ensures we can always reach HomePage regardless of current navigation state
               navigation.reset({
                 index: 0,
                 routes: [{ name: 'HomePage' }],
               });
             }}
            >
            <LinearGradient
              colors={['#ffd700', '#ffed4e']}
              style={styles.iconBackground}
            >
              <Ionicons name="videocam-outline" size={22} color="#000" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <LinearGradient
        colors={['rgba(255, 215, 0, 0.1)', 'rgba(255, 215, 0, 0.05)', 'transparent']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.createPost}
      >
        <View style={styles.postInputContainer}>
          <LinearGradient
            colors={['#ffd700', '#ffed4e']}
            style={styles.avatarBorder}
          >
            <Image
              style={styles.userAvatar}
              source={{ uri: 'https://via.placeholder.com/40' }}
            />
          </LinearGradient>
          <TouchableOpacity 
            style={styles.postInputButton}
            onPress={handleCreatePost}
          >
            <Text style={styles.postInputPlaceholder}>What's happening?</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.postOptions}>
          <TouchableOpacity 
            style={styles.postOption}
            onPress={handleCreatePost}
          >
            <LinearGradient
              colors={['#ffd700', '#ffed4e']}
              style={styles.createPostButton}
            >
              <Ionicons name="create" size={18} color="#000" />
              <Text style={[styles.createPostText, { color: '#000' }]}>Create Post</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <LinearGradient
        colors={['rgba(255, 215, 0, 0.08)', 'rgba(255, 215, 0, 0.04)', 'transparent']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.stories}
      >
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: 'add-story' }, ...stories]}
          keyExtractor={(item) => item.id ? item.id.toString() : 'add-story'}
          renderItem={({ item }) => {
            if (item.id === 'add-story') {
              return (
                <TouchableOpacity style={styles.storyItem} onPress={handleAddStory} disabled={uploading}>
                  <LinearGradient
                    colors={['rgba(255, 215, 0, 0.15)', 'rgba(255, 215, 0, 0.1)']}
                    style={styles.addStoryButton}
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color="#ffd700" />
                    ) : (
                      <Ionicons name="add" size={24} color="#ffd700" />
                    )}
                  </LinearGradient>
                  <Text style={styles.storyText}>Your story</Text>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity 
                style={styles.storyItem} 
                onPress={() => handleStoryPress(item)}
              >
                <LinearGradient
                  colors={item.has_unviewed ? ['#ffd700', '#ffed4e', '#ffd700'] : ['#666666', '#888888', '#666666']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}
                  style={styles.storyRing}
                >
                  <Image
                    style={styles.storyAvatar}
                    source={{ uri: item.profiles.avatar_url || 'https://via.placeholder.com/60' }}
                  />
                </LinearGradient>
                <Text style={styles.storyText}>{item.profiles.username}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </LinearGradient>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ff00ff" />
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item?.id?.toString() || Math.random().toString()}
            renderItem={({ item }) => {
              // Skip rendering if item is null or invalid
              if (!item || !item.id) {
                console.warn('Skipping invalid post item in FlatList');
                return null;
              }
              
              return (
                <PostItem
                  post={item}
                  onOptionsPress={(action) => {
                    if (action.type === 'delete') {
                      setPosts(posts.filter(post => post.id !== action.postId));
                    }
                  }}
                />
              );
            }}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No posts available</Text>
              </View>
            )}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadPosts();
                }}
                colors={['#ff00ff']}
                tintColor="#ff00ff"
              />
            }
            viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
          />
        )}

        {/* Post Input Modal */}
        <Modal
          visible={showPostInput}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity 
                  onPress={() => {
                    setShowPostInput(false);
                    setSelectedMedia(null);
                    setPostText('');
                  }}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.postButton, (!selectedMedia && !postText.trim()) && styles.disabledButton]}
                  onPress={handleCreatePost}
                  disabled={!selectedMedia && !postText.trim()}
                >
                  <Text style={styles.postButtonText}>Post</Text>
                </TouchableOpacity>
              </View>

              {selectedMedia && (
                <View style={styles.mediaPreview}>
                  {selectedMedia.type === 'video' ? (
                    <Video
                      source={{ uri: selectedMedia.uri }}
                      style={styles.previewMedia}
                      resizeMode="cover"
                      play={false}
                      shouldPlay={false}
                      isLooping={false}
                      useNativeControls={true}
                      rate={1.0}
                    />
                  ) : (
                    <Image
                      source={{ uri: selectedMedia.uri }}
                      style={styles.previewMedia}
                      resizeMode="cover"
                    />
                  )}
                </View>
              )}

              <TextInput
                style={[styles.postInput, selectedMedia && styles.postInputWithMedia]}
                placeholder="Write a caption..."
                placeholderTextColor="#888"
                multiline
                value={postText}
                onChangeText={setPostText}
                color="#ffffff"
                autoFocus={selectedMedia ? true : false}
              />
            </View>
          </View>
        </Modal>

        {/* Story Viewer Modal */}
        <Modal
          visible={viewerVisible}
          transparent={false}
          animationType="slide"
        >
          <View style={styles.viewerContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setViewerVisible(false);
                setSelectedStory(null);
              }}
            >
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>

            {selectedStory && (
              <View style={styles.storyContent}>
                {selectedStory.type === 'video' ? (
                  <Video
                    source={{ uri: selectedStory.media_url }}
                    style={styles.storyMedia}
                    resizeMode="contain"
                    play
                    shouldPlay={true}
                    isLooping={true}
                    loop={true}
                    useNativeControls={false}
                    rate={1.0}
                  />
                ) : (
                  <Image
                    source={{ uri: selectedStory.media_url }}
                    style={styles.storyMedia}
                    resizeMode="contain"
                  />
                )}
              </View>
            )}
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingTop: 12,
    paddingLeft: 20,
    paddingRight: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 0, 255, 0.2)',
  },
  logoGradient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 20,
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  logo: {
    fontSize: 28,
    fontFamily: 'Poppins_700Bold',
    color: '#000',
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  iconBackground: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  notificationBadge: {
    position: 'absolute',
    top: -3,
    right: -6,
    backgroundColor: '#ffd700',
    borderRadius: 10,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  notificationBadgeText: {
    color: 'white',
    fontWeight: 'bold',
  },
  createPost: {
    margin: 15,
    borderRadius: 16,
    padding: 15,
    shadowColor: 'rgba(255, 215, 0, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  postInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBorder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: '#0d0d2a',
  },
  postInputButton: {
    flex: 1,
    height: 46,
    padding: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderRadius: 23,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  postInputPlaceholder: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 15,
  },
  postOptions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 15,
  },
  postOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  createPostText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  stories: {
    padding: 14,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 0, 255, 0.2)',
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 16,
  },
  addStoryButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffd700',
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  storyRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  storyAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#0d0d2a',
  },
  storyText: {
    marginTop: 8,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    maxWidth: 70,
    fontWeight: '500',
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
  },
  storyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyMedia: {
    width: '100%',
    height: '100%',
  },
  postInput: {
    color: '#ffffff',
    fontSize: 16,
    padding: 15,
    textAlignVertical: 'top',
    minHeight: 100,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    marginTop: 15,
    flex: 1,
    borderWidth: 1,
    borderColor: '#333333',
  },
  postInputWithMedia: {
    minHeight: 80,
    marginTop: 10,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#ff00ff',
    padding: 15,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 200,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  postButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  disabledButton: {
    backgroundColor: '#666',
  },
  mediaPreview: {
    width: '100%',
    height: 300,
    marginBottom: 15,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  previewMedia: {
    width: '100%',
    height: '100%',
  },
  postButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default HomeScreen;