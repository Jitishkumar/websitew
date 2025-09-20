import React, { useState, useEffect, useRef } from 'react';
import { useVideo } from '../context/VideoContext';
import { useNotifications } from '../context/NotificationContext';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, Image, Modal, ActivityIndicator, FlatList, RefreshControl, Alert, Animated, ScrollView, Platform } from 'react-native';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Easing } from 'react-native';

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
  const [showTermsModal, setShowTermsModal] = useState(false);

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
    const newParticles = [];
    const colors = ['#ff00ff', '#ff6b9d', '#c44569', '#ffcc00', '#00ffcc'];
    
    for (let i = 0; i < 15; i++) {
      const angle = (i / 15) * Math.PI * 2;
      const distance = 30 + Math.random() * 20;
      const size = 3 + Math.random() * 5;
      const duration = 800 + Math.random() * 1000;
      
      const animX = new Animated.Value(0);
      const animY = new Animated.Value(0);
      const rotate = new Animated.Value(0);
      const scale = new Animated.Value(1);
      const opacity = new Animated.Value(1);
      
      Animated.parallel([
        Animated.timing(animX, {
          toValue: Math.cos(angle) * distance,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(animY, {
          toValue: Math.sin(angle) * distance - 20,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: (Math.random() - 0.5) * 360,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0,
          duration: duration * 0.7,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: duration * 0.7,
          useNativeDriver: true,
        })
      ]).start();
      
      newParticles.push({
        x: 60 + Math.cos(angle) * 10,
        y: 30 + Math.sin(angle) * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        anim: {
          x: animX,
          y: animY,
          rotate: rotate.interpolate({
            inputRange: [0, 360],
            outputRange: ['0deg', '360deg']
          }),
          scale,
          opacity
        }
      });
    }
    
    setParticles(newParticles);
    
    // Remove particles after animation
    setTimeout(() => {
      setParticles([]);
    }, 1000);
  };

  const startLogoAnimations = () => {
    // Pulsing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 1500,
          useNativeDriver: true,
        })
      ])
    ).start();

    // Floating animation
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

    // Color transition animation
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
        <LinearGradient
          colors={['#0a0a2a', '#1a1a4a', '#2a1a4a']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.header}
        >
          <View style={styles.logoWrapper}>
            <TouchableOpacity 
              activeOpacity={0.9}
              onPress={() => {
                // Bounce animation
                Animated.sequence([
                  Animated.spring(scaleAnim, {
                    toValue: 0.9,
                    useNativeDriver: true,
                  }),
                  Animated.spring(scaleAnim, {
                    toValue: 1.1,
                    friction: 3,
                    tension: 40,
                    useNativeDriver: true,
                  }),
                  Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 7,
                    tension: 40,
                    useNativeDriver: true,
                  })
                ]).start();
                
                // Create particles
                createParticles();
                
                // Refresh the feed
                loadPosts();
              }}
            >
              <Animated.View style={[
                styles.logoGradientContainer,
                { 
                  transform: [
                    { scale: Animated.multiply(scaleAnim, pulseAnim) },
                    { translateY: floatAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -5]
                      }) 
                    }
                  ]
                }
              ]}>
                <Animated.View style={[
                  styles.logoGradient,
                  {
                    backgroundColor: colorAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['#ff00ff', '#ff6b9d']
                    })
                  }
                ]}>
                  <View style={styles.logoContent}>
                    <Animated.View style={{
                      transform: [{
                        rotate: colorAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg']
                        })
                      }]
                    }}>
                      <MaterialIcons name="flash-on" size={22} color="#fff" style={styles.logoIcon} />
                    </Animated.View>
                    <Text style={styles.logo}>flexx</Text>
                  </View>
                </Animated.View>
                <Animated.View style={[
                  styles.logoGlow,
                  {
                    opacity: pulseAnim.interpolate({
                      inputRange: [0.9, 1, 1.1],
                      outputRange: [0.6, 1, 0.6]
                    }),
                    transform: [{
                      scale: pulseAnim.interpolate({
                        inputRange: [0.9, 1.1],
                        outputRange: [0.9, 1.1]
                      })
                    }]
                  }
                ]} />
                <Animated.View style={[
                  styles.logoShine,
                  {
                    transform: [{
                      translateX: colorAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-30, 100]
                      })
                    }]
                  }
                ]} />
              </Animated.View>
            </TouchableOpacity>
            
            {/* Particles */}
            {particles.map((particle, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.particle,
                  {
                    left: particle.x,
                    top: particle.y,
                    backgroundColor: particle.color,
                    transform: [
                      { translateX: particle.anim.x },
                      { translateY: particle.anim.y },
                      { rotate: particle.anim.rotate },
                      { scale: particle.anim.scale }
                    ],
                    opacity: particle.anim.opacity
                  }
                ]}
              />
            ))}
          </View>
          
          <View style={styles.headerIcons}>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['rgba(255, 0, 255, 0.2)', 'rgba(255, 0, 255, 0.1)']}
                style={styles.iconBackground}
              >
                <Ionicons name="notifications-outline" size={22} color="#ff00ff" />
                {notificationUnreadCount > 0 && (
                  <LinearGradient
                    colors={['#ff00ff', '#ff6b9d']}
                    style={[styles.notificationBadge, {
                      width: notificationUnreadCount > 99 ? 20 : notificationUnreadCount > 9 ? 18 : 16,
                    }]}
                  >
                    <Text style={[styles.notificationBadgeText, {
                      fontSize: notificationUnreadCount > 99 ? 8 : 10,
                    }]}>
                      {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
                    </Text>
                  </LinearGradient>
                )}
              </LinearGradient>
            </TouchableOpacity>
          
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => navigation.navigate('Trending')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['rgba(255, 107, 157, 0.2)', 'rgba(255, 107, 157, 0.1)']}
                style={styles.iconBackground}
              >
                <MaterialIcons name="trending-up" size={22} color="#ff6b9d" />
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={() => navigation.navigate('Search')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['rgba(196, 69, 105, 0.2)', 'rgba(196, 69, 105, 0.1)']}
                style={styles.iconBackground}
              >
                <MaterialIcons name="search" size={22} color="#c44569" />
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => setShowTermsModal(true)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['rgba(255, 0, 255, 0.2)', 'rgba(255, 0, 255, 0.1)']}
                style={styles.iconBackground}
              >
                <MaterialIcons name="videocam" size={22} color="#ff00ff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.View style={{ opacity: createPostAnim, transform: [{ scale: scaleAnim }] }}>
        <LinearGradient
          colors={['rgba(255, 0, 255, 0.1)', 'rgba(255, 0, 255, 0.05)', 'transparent']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.createPost}
        >
          <View style={styles.postInputContainer}>
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={['#ff00ff', '#ff6b9d', '#c44569']}
                style={styles.avatarBorder}
              >
                <Image
                  style={styles.userAvatar}
                  source={{ uri: 'https://via.placeholder.com/40' }}
                />
              </LinearGradient>
              <View style={styles.avatarGlow} />
            </View>
            
            <TouchableOpacity 
              style={styles.postInputButton}
              onPress={handleCreatePost}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['rgba(255, 0, 255, 0.1)', 'rgba(255, 0, 255, 0.05)']}
                style={styles.postInputGradient}
              >
                <MaterialIcons name="edit" size={20} color="#ff00ff" />
                <Text style={styles.postInputPlaceholder}>What's happening?</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          
          <View style={styles.postOptions}>
            <TouchableOpacity 
              style={styles.postOption}
              onPress={handleCreatePost}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#ff00ff', '#ff6b9d', '#c44569']}
                style={styles.createPostButton}
              >
                <MaterialIcons name="add" size={18} color="#fff" />
                <Text style={styles.createPostText}>Create Post</Text>
              </LinearGradient>
              <View style={styles.createPostGlow} />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.View style={{ opacity: storiesAnim, transform: [{ translateY: slideAnim }] }}>
        <LinearGradient
          colors={['rgba(255, 0, 255, 0.08)', 'rgba(255, 0, 255, 0.04)', 'transparent']}
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
                      colors={['rgba(255, 0, 255, 0.15)', 'rgba(255, 0, 255, 0.1)']}
                      style={styles.addStoryButton}
                    >
                      {uploading ? (
                        <ActivityIndicator size="small" color="#ff00ff" />
                      ) : (
                        <MaterialIcons name="add" size={24} color="#ff00ff" />
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
                    colors={item.has_unviewed ? ['#ff00ff', '#ff6b9d', '#c44569'] : ['#666666', '#888888', '#666666']}
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
      </Animated.View>
    </>
    );
  };

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <LinearGradient
          colors={['#0a0a2a', '#1a1a4a', '#2a1a4a']}
          style={styles.container}
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
                
                return (
                  <PostItem
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
        </LinearGradient>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0a2a',
  },
  container: {
    flex: 1,
    backgroundColor: '#0a0a2a',
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
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 0, 255, 0.1)',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 60,
  },
  logoWrapper: {
    position: 'relative',
    marginLeft: 10,
    height: 60,
    width: 120,
    justifyContent: 'center',
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
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  iconBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  notificationBadge: {
    position: 'absolute',
    top: -3,
    right: -6,
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
  avatarContainer: {
    position: 'relative',
  },
  avatarBorder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.3)',
    borderRadius: 23,
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
});

export default HomeScreen;