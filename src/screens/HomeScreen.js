import React, { useState, useEffect, useRef } from 'react';
import { useVideo } from '../context/VideoContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, Image, Modal, ActivityIndicator, FlatList, RefreshControl, Alert, Animated, ScrollView, Platform, Dimensions } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFonts, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { StoriesService } from '../services/StoriesService';
import { PostsService } from '../services/PostsService';
import { Video } from 'expo-av';
import { supabase } from '../lib/supabase';
import PostItem from '../components/PostItem';
import PostItemOld from '../components/PostItemold';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Easing } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 380;

const HomeScreen = () => {
  const navigation = useNavigation();
  const { unreadCount: notificationUnreadCount } = useNotifications();
  const { isDarkMode } = useTheme();
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
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userHasStory, setUserHasStory] = useState(false);

  // Animation refs for premium UI
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const headerAnim = useRef(new Animated.Value(1)).current;
  const createPostAnim = useRef(new Animated.Value(1)).current;
  const storiesAnim = useRef(new Animated.Value(1)).current;
  
  // Logo animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const colorAnim = useRef(new Animated.Value(0)).current;
  const particleAnim = useRef(new Animated.Value(0)).current;
  const [particles, setParticles] = useState([]);

  let [fontsLoaded] = useFonts({
    Poppins_700Bold,
  });

  useEffect(() => {
    loadCurrentUser();
    loadStories();
    loadPosts();
    startAnimations();
    startLogoAnimations();

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

  const createParticles = () => {
    // Disabled heavy particle animations for better performance
    // This was creating 15 animated particles each time, causing lag
    return;
  };

  const startLogoAnimations = () => {
    // Simplified animation for better performance
    // Only keep a simple pulse animation
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
        })
      ])
    ).start();

    // Disabled heavy floating and color animations for performance
    /*
    // Floating animation - DISABLED
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease)
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease)
        })
      ])
    ).start();

    // Color transition animation - DISABLED (uses useNativeDriver: false which is slow)
    Animated.loop(
      Animated.sequence([
        Animated.timing(colorAnim, {
          toValue: 1,
          duration: 5000,
          useNativeDriver: false,
        }),
        Animated.timing(colorAnim, {
          toValue: 0,
          duration: 5000,
          useNativeDriver: false,
        })
      ])
    ).start();
    */
  };

  const startAnimations = () => {
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
      }),
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(createPostAnim, {
        toValue: 1,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(storiesAnim, {
        toValue: 1,
        duration: 1000,
        delay: 400,
        useNativeDriver: true,
      })
    ]).start();
  };
  
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

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Get user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setCurrentUser(profile);
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

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
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      const data = await StoriesService.getActiveStories();
      const formattedStories = data.map(group => ({
        ...group.stories[0],
        profiles: group.user,
        groupedStories: group.stories,
        story_group_id: group.stories[0].story_group_id,
        has_unviewed: group.has_unviewed
      }));

      // Check if current user has a story
      const userStory = formattedStories.find(story => story.user_id === currentUserId);
      setUserHasStory(!!userStory);

      // Sort stories: Current user's stories first, then others by newest
      const sortedStories = formattedStories.sort((a, b) => {
        // If current user's stories, put them first
        if (a.user_id === currentUserId && b.user_id !== currentUserId) {
          return -1; // a comes first
        }
        if (b.user_id === currentUserId && a.user_id !== currentUserId) {
          return 1; // b comes first
        }
        // If both are yours or both are not yours, sort by newest
        return new Date(b.created_at) - new Date(a.created_at);
      });

      setStories(sortedStories);
    } catch (error) {
      console.error('Error loading stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleYourStoryPress = () => {
    if (userHasStory) {
      // User has a story - show options
      Alert.alert(
        'Your Story',
        'What would you like to do?',
        [
          { text: 'View Story', onPress: handleViewYourStory },
          { text: 'Add Story', onPress: handleAddStory },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } else {
      // No story - directly add
      handleAddStory();
    }
  };

  const handleViewYourStory = () => {
    if (currentUser) {
      navigation.navigate('Stories', {
        userId: currentUser.id,
        initialStoryIndex: 0
      });
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

  const renderHeader = () => {
    return (
    <>
      <Animated.View style={{ opacity: headerAnim, transform: [{ translateY: slideAnim }] }}>
        <View
          style={[styles.header, !isDarkMode && styles.headerLight]}
        >
          <View style={styles.logoWrapper}>
            {isDarkMode ? (
              <Text style={styles.logoSimple}>INJOY</Text>
            ) : (
              <View style={styles.socialMateLogoContainer}>
                <Text style={styles.socialMateLogo}>
                  <Text style={styles.socialText}>SOCIAL </Text>
                  <Text style={styles.mateText}>MATE</Text>
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('Trending')}
              activeOpacity={0.7}
            >
              <MaterialIcons name="whatshot" size={24} color={isDarkMode ? "rgba(255, 255, 255, 0.9)" : "#333333"} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setShowTermsModal(true)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="duo" size={24} color={isDarkMode ? "rgba(255, 255, 255, 0.9)" : "#333333"} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={24} color={isDarkMode ? "rgba(255, 255, 255, 0.9)" : "#333333"} />
              {notificationUnreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{notificationUnreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={() => navigation.navigate('Search')}
              activeOpacity={0.7}
            >
              <MaterialIcons name="search" size={24} color={isDarkMode ? "rgba(255, 255, 255, 0.9)" : "#333333"} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {isDarkMode && (
        <Animated.View style={{ opacity: createPostAnim, transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity onPress={handleCreatePost} style={styles.createPostDark} activeOpacity={0.8}>
            <Image 
              source={{ uri: currentUser?.avatar_url || 'https://via.placeholder.com/40' }}
              style={styles.createPostAvatarDark}
            />
            <Text style={styles.createPostPlaceholderDark}>What's on your mind?</Text>
            <MaterialIcons name="add-photo-alternate" size={24} color="rgba(255, 255, 255, 0.6)" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {!isDarkMode && (
        <Animated.View style={{ opacity: createPostAnim, transform: [{ scale: scaleAnim }] }}>
          <View
            style={[styles.createPost, styles.createPostLight]}
          >
            <View style={styles.postInputContainer}>
              <View style={styles.avatarContainer}>
                <LinearGradient
                  colors={['#ff00ff', '#ff6b9d', '#c44569']}
                  style={styles.avatarBorder}
                >
                  <Image
                    style={styles.userAvatar}
                    source={{ uri: currentUser?.avatar_url || 'https://via.placeholder.com/40' }}
                  />
                </LinearGradient>
                <View style={styles.avatarGlow} />
              </View>
              
              <TouchableOpacity 
                style={styles.postInputButton}
                onPress={handleCreatePost}
                activeOpacity={0.8}
              >
                <View style={[styles.postInputGradient, styles.postInputLight]}>
                  <Text style={[styles.postInputPlaceholder, styles.postInputPlaceholderLight]}>What's on your head?</Text>
                </View>
              </TouchableOpacity>
            </View>
            
            <View style={styles.postOptionsLight}>
              <TouchableOpacity style={styles.postOptionButtonLight} onPress={handleCreatePost}>
                <MaterialIcons name="image" size={20} color="#1E90FF" />
                <Text style={styles.postOptionTextLight}>Image</Text>
              </TouchableOpacity>
              <View style={styles.postOptionDivider} />
              <TouchableOpacity style={styles.postOptionButtonLight} onPress={handleCreatePost}>
                <MaterialIcons name="videocam" size={20} color="#1E90FF" />
                <Text style={styles.postOptionTextLight}>Videos</Text>
              </TouchableOpacity>
              <View style={styles.postOptionDivider} />
              <TouchableOpacity style={styles.postOptionButtonLight} onPress={handleCreatePost}>
                <MaterialIcons name="attach-file" size={20} color="#1E90FF" />
                <Text style={styles.postOptionTextLight}>Attach</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      <Animated.View style={{ opacity: storiesAnim, transform: [{ translateY: slideAnim }] }}>
        <View
          style={[styles.stories, !isDarkMode && styles.storiesLight]}
        >
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ id: 'your-story' }, ...stories.filter(story => story.user_id !== currentUser?.id)]}
            keyExtractor={(item) => item.id ? item.id.toString() : 'your-story'}
            renderItem={({ item }) => {
              if (item.id === 'your-story') {
                return (
                  <TouchableOpacity style={styles.storyItem} onPress={handleYourStoryPress} disabled={uploading}>
                    {userHasStory ? (
                      // User has story - show avatar with plus icon
                      <View style={styles.userStoryContainer}>
                        <LinearGradient
                          colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.1)']}
                          style={styles.storyRing}
                        >
                          <Image
                            style={styles.storyAvatar}
                            source={{ uri: currentUser?.avatar_url || 'https://via.placeholder.com/60' }}
                          />
                        </LinearGradient>
                        <View style={styles.plusIconContainer}>
                          <View style={styles.plusIcon}>
                            <MaterialIcons name="add" size={12} color="rgba(255, 255, 255, 0.9)" />
                          </View>
                        </View>
                      </View>
                    ) : (
                      // No story - show add button
                      isDarkMode ? (
                        <View style={styles.addStoryButton}>
                          {uploading ? (
                            <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.8)" />
                          ) : (
                            <MaterialIcons name="add" size={24} color="rgba(255, 255, 255, 0.8)" />
                          )}
                        </View>
                      ) : (
                        <View style={[styles.addStoryButton, styles.addStoryButtonLight]}>
                          {uploading ? (
                            <ActivityIndicator size="small" color="#1E90FF" />
                          ) : (
                            <MaterialIcons name="add" size={24} color="#1E90FF" />
                          )}
                        </View>
                      )
                    )}
                    <Text style={[styles.storyText, !isDarkMode && styles.storyTextLight]}>Your story</Text>
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity 
                  style={styles.storyItem} 
                  onPress={() => handleStoryPress(item)}
                >
                  <LinearGradient
                    colors={isDarkMode ? 
                      (item.has_unviewed ? 
                        ['#1E90FF', '#4169E1', '#1E90FF'] : 
                        ['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']) :
                      (item.has_unviewed ? 
                        ['#1E90FF', '#4169E1', '#1E90FF'] : 
                        ['#d0d0d0', '#e0e0e0', '#d0d0d0'])}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 1}}
                    style={styles.storyRing}
                  >
                    <Image
                      style={[styles.storyAvatar, !isDarkMode && styles.storyAvatarLight]}
                      source={{ uri: item.profiles.avatar_url || 'https://via.placeholder.com/60' }}
                    />
                  </LinearGradient>
                    <Text style={[styles.storyText, !isDarkMode && styles.storyTextLight]}>{item.profiles.username}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Animated.View>
    </>
    );
  };

  return (
    <>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: isDarkMode ? '#1a1d2e' : '#f5f7fa' }]} edges={['top', 'left', 'right']}>
        <View
          style={[styles.container, { backgroundColor: isDarkMode ? '#1a1d2e' : '#f5f7fa' }]}
        >
          <ScrollView
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
            contentContainerStyle={styles.scrollViewContent}
          >
            {renderHeader()}
            
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ff00ff" />
              </View>
            ) : posts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No posts available</Text>
              </View>
            ) : (
              posts.map((item) => {
                if (!item || !item.id) {
                  return null;
                }
                
                const PostComponent = isDarkMode ? PostItem : PostItemOld;
                
                return (
                  <PostComponent
                    key={item.id}
                    post={item}
                    onOptionsPress={(action) => {
                      if (action.type === 'delete') {
                        setPosts(posts.filter(post => post.id !== action.postId));
                      }
                    }}
                  />
                );
              })
            )}
          </ScrollView>

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
                        shouldPlay={false}
                        isLooping={false}
                        useNativeControls={true}
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
                      shouldPlay={true}
                      isLooping={true}
                      useNativeControls={false}
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

          {/* Terms and Conditions Modal */}
          <Modal
            visible={showTermsModal}
            transparent={true}
            animationType="slide"
          >
            <View style={styles.termsModalContainer}>
              <LinearGradient
                colors={['#0a0a2a', '#1a1a4a', '#2a1a4a']}
                style={styles.termsModalContent}
              >
                <View style={styles.termsHeader}>
                  <MaterialIcons name="videocam" size={32} color="#ff00ff" />
                  <Text style={styles.termsTitle}>Video Chat Guidelines</Text>
                  <Text style={styles.termsSubtitle}>Please read and accept our terms</Text>
                </View>

                <ScrollView style={styles.termsScrollView} showsVerticalScrollIndicator={false}>
                  <View style={styles.termsSection}>
                    <View style={styles.termsSectionHeader}>
                      <MaterialIcons name="cake" size={24} color="#ff6b9d" />
                      <Text style={styles.termsSectionTitle}>Age Requirement</Text>
                    </View>
                    <Text style={styles.termsText}>
                      • You must be 18 years or older to use video chat features
                    </Text>
                    <Text style={styles.termsText}>
                      • By proceeding, you confirm that you meet this age requirement
                    </Text>
                  </View>

                  <View style={styles.termsSection}>
                    <View style={styles.termsSectionHeader}>
                      <MaterialIcons name="shield" size={24} color="#00ffcc" />
                      <Text style={styles.termsSectionTitle}>Content Guidelines</Text>
                    </View>
                    <Text style={styles.termsText}>
                      • Do NOT share explicit, inappropriate, or offensive content
                    </Text>
                    <Text style={styles.termsText}>
                      • Maintain respectful and appropriate conversations
                    </Text>
                    <Text style={styles.termsText}>
                      • No harassment, bullying, or abusive behavior
                    </Text>
                    <Text style={styles.termsText}>
                      • Report any inappropriate behavior immediately
                    </Text>
                  </View>

                  <View style={styles.termsSection}>
                    <View style={styles.termsSectionHeader}>
                      <MaterialIcons name="favorite" size={24} color="#ffcc00" />
                      <Text style={styles.termsSectionTitle}>Community Standards</Text>
                    </View>
                    <Text style={styles.termsText}>
                      • Be kind and respectful to all users
                    </Text>
                    <Text style={styles.termsText}>
                      • Keep conversations positive and friendly
                    </Text>
                    <Text style={styles.termsText}>
                      • Respect others' privacy and boundaries
                    </Text>
                    <Text style={styles.termsText}>
                      • Help maintain a safe environment for everyone
                    </Text>
                  </View>

                  <View style={styles.warningBox}>
                    <MaterialIcons name="warning" size={24} color="#ff4444" />
                    <Text style={styles.warningText}>
                      Violation of these guidelines may result in account suspension or permanent ban.
                    </Text>
                  </View>
                </ScrollView>

                <View style={styles.termsButtons}>
                  <TouchableOpacity
                    style={styles.declineButton}
                    onPress={() => setShowTermsModal(false)}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#666666', '#444444']}
                      style={styles.buttonGradient}
                    >
                      <Text style={styles.declineButtonText}>Decline</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => {
                      setShowTermsModal(false);
                      navigation.reset({
                        index: 0,
                        routes: [{ name: 'HomePage' }],
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#ff00ff', '#ff6b9d', '#c44569']}
                      style={styles.buttonGradient}
                    >
                      <MaterialIcons name="check" size={20} color="#fff" />
                      <Text style={styles.acceptButtonText}>I Accept & I'm 18+</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1d2e',
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1d2e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'transparent',
    minHeight: 60,
  },
  logoWrapper: {
    position: 'relative',
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'flex-start',
    maxWidth: '60%',
  },
  logoContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'visible',
  },
  logoGradientContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  logoGradient: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  logoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    marginRight: 6,
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  logo: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
    letterSpacing: 1,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    fontWeight: 'bold',
    transform: [{ translateY: 1 }],
  },
  logoGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 0, 255, 0.15)',
    zIndex: -2,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 15,
  },
  logoShine: {
    position: 'absolute',
    top: -30,
    left: -30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    transform: [{ rotate: '45deg' }],
    zIndex: 1,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 100,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 0,
    minWidth: isSmallScreen ? 160 : 180,
    paddingRight: 4,
  },
  iconButton: {
    marginHorizontal: isSmallScreen ? 2 : 6,
    padding: 4,
  },
  iconBackground: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  notificationBadge: {
    position: 'absolute',
    right: -4,
    top: 0,
    backgroundColor: '#FF3B30',
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1a1d2e',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  createPost: {
    margin: 15,
    borderRadius: 20,
    padding: 18,
  },
  createPostDark: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 15,
    marginVertical: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  createPostAvatarDark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  createPostPlaceholderDark: {
    flex: 1,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  postInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarBorder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
    padding: 3,
  },
  avatarGlow: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    zIndex: -1,
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
    borderRadius: 23,
    overflow: 'hidden',
  },
  postInputGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 25,
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
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  createPostText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  stories: {
    padding: 16,
    marginBottom: 8,
    backgroundColor: 'transparent',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  storyRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  // Terms Modal Styles
  termsModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  termsModalContent: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  termsHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 0, 255, 0.3)',
  },
  termsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
    textAlign: 'center',
  },
  termsSubtitle: {
    fontSize: 16,
    color: '#ccc',
    marginTop: 8,
    textAlign: 'center',
  },
  termsScrollView: {
    maxHeight: 400,
    marginBottom: 24,
  },
  termsSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ff00ff',
  },
  termsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  termsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
  },
  termsText: {
    fontSize: 15,
    color: '#ddd',
    lineHeight: 22,
    marginBottom: 8,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
    marginTop: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#ff4444',
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  termsButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  declineButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  acceptButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  declineButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
  userStoryContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusIconContainer: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#0a0a2a',
  },
  plusIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
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
  flatListContent: {
    paddingBottom: 100, // Add padding to prevent bottom navigation overlap
  },
  scrollViewContent: {
    paddingBottom: 100, // Add padding to prevent bottom navigation overlap
  },
  // Light Mode Styles
  headerLight: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  socialMateLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  socialMateLogo: {
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  socialText: {
    color: '#333333',
  },
  mateText: {
    color: '#1E90FF',
  },
  createPostLight: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  postInputLight: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  postInputPlaceholderLight: {
    color: '#999999',
    fontSize: 15,
  },
  postOptionsLight: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  postOptionButtonLight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  postOptionTextLight: {
    color: '#1E90FF',
    fontSize: 14,
    fontWeight: '600',
  },
  postOptionDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#e0e0e0',
  },
  storiesLight: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  createPostGlow: {
    // Placeholder for glow effect
  },
  notificationBadgeLight: {
    backgroundColor: '#FF4444',
  },
  addStoryButtonLight: {
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#1E90FF',
    borderStyle: 'dashed',
  },
  storyTextLight: {
    color: '#333333',
  },
  storyAvatarLight: {
    borderColor: '#ffffff',
  },
  logoSimple: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2,
    fontFamily: 'Poppins_700Bold',
  },
});

export default HomeScreen;