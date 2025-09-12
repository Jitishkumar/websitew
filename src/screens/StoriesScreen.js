import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  Dimensions, 
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  Animated
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StoriesService } from '../services/StoriesService';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

const StoriesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { storyGroupId, userId, initialStoryIndex = 0 } = route.params || {};
  const insets = useSafeAreaInsets();
  
  const [stories, setStories] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(initialStoryIndex);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  
  const videoRef = useRef(null);
  const progressInterval = useRef(null);
  const storyTimeout = useRef(null);
  const touchTimer = useRef(null);
  const isTouchHolding = useRef(false);

  // Animation refs for ultra-premium effects
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  // Load stories when component mounts
  useEffect(() => {
    loadStories();
    initializeAnimations();
    
    // Cleanup on unmount
    return () => {
      clearInterval(progressInterval.current);
      clearTimeout(storyTimeout.current);
    };
  }, []);

  const initializeAnimations = () => {
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
  
  // Handle story progress and auto-advance
  useEffect(() => {
    if (stories.length > 0 && !loading) {
      // Mark story as viewed
      markStoryAsViewed();
      
      // Reset progress
      setProgress(0);
      
      // Clear previous intervals/timeouts
      clearInterval(progressInterval.current);
      clearTimeout(storyTimeout.current);
      
      // Start progress for current story
      startProgress();
    }
  }, [currentIndex, stories, loading]);
  
  const loadStories = async () => {
    try {
      setLoading(true);
      
      // Get stories for the specific user/group
      const data = await StoriesService.getUserStories(userId);
      // Fetch user's rank to apply special visibility/ordering rules for rank 1
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('rank')
        .eq('id', userId)
        .maybeSingle();
      
      if (data && data.length > 0) {
        // If user is rank 1, make sure the first story is the designated first story
        // (client-side ordering safeguard; actual visibility is handled by RLS)
        const sortedStories = ownerProfile?.rank === 1
          ? [...data].sort((a, b) => {
              if (a.is_first_story === b.is_first_story) return 0;
              return a.is_first_story ? -1 : 1;
            })
          : data;
        setStories(sortedStories);
        setUserInfo(data[0].user);
      } else {
        // No stories found, go back
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading stories:', error);
      Alert.alert('Error', 'Failed to load stories');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };
  
  const markStoryAsViewed = async () => {
    if (stories.length > 0 && currentIndex < stories.length) {
      try {
        await StoriesService.markStoryAsViewed(stories[currentIndex].id);
      } catch (error) {
        console.error('Error marking story as viewed:', error);
      }
    }
  };
  
  const startProgress = () => {
    // Duration for each story (5 seconds)
    const storyDuration = 5000;
    const updateInterval = 50; // Update progress every 50ms
    const incrementValue = updateInterval / storyDuration;
    
    // Start progress interval
    progressInterval.current = setInterval(() => {
      if (!paused) {
        setProgress(prev => {
          const newProgress = prev + incrementValue;
          return newProgress >= 1 ? 1 : newProgress;
        });
      }
    }, updateInterval);
    
    // Set timeout to move to next story
    storyTimeout.current = setTimeout(() => {
      if (!paused) {
        goToNextStory();
      }
    }, storyDuration);
  };
  
  const goToPreviousStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      // If at first story, go back to previous user's stories or exit
      navigation.goBack();
    }
  };
  
  const goToNextStory = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // If at last story, go back to home
      navigation.goBack();
    }
  };
  
  const handlePress = (event) => {
    const { locationX } = event.nativeEvent;
    
    // Determine if press is on left or right side of screen
    if (locationX < width / 3) {
      // Left side - go to previous story
      goToPreviousStory();
    } else if (locationX > (width * 2) / 3) {
      // Right side - go to next story
      goToNextStory();
    } else {
      // Middle - pause/play
      setPaused(!paused);
      
      if (videoRef.current) {
        if (paused) {
          videoRef.current.playAsync();
        } else {
          videoRef.current.pauseAsync();
        }
      }
    }
  };
  
  // Add touch handlers for press-to-pause functionality
  const handleTouchStart = () => {
    // Clear any existing touch timer
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
    }
    
    // Set a timer to detect long press (300ms)
    touchTimer.current = setTimeout(() => {
      if (!paused) {
        isTouchHolding.current = true;
        setPaused(true);
        if (videoRef.current) {
          videoRef.current.pauseAsync();
        }
      }
    }, 300);
  };

  const handleTouchEnd = () => {
    // Clear the touch timer
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
    
    // If we were holding and paused the video, resume playback
    if (isTouchHolding.current) {
      isTouchHolding.current = false;
      setPaused(false);
      if (videoRef.current) {
        videoRef.current.playAsync();
      }
    }
  };
  
  const handleDeleteStory = async () => {
    try {
      setMenuVisible(false);
      setPaused(true);
      
      // Show confirmation dialog
      Alert.alert(
        'Delete Story',
        'Are you sure you want to delete this story?',
        [
          {
            text: 'Cancel',
            onPress: () => setPaused(false),
            style: 'cancel',
          },
          {
            text: 'Delete',
            onPress: async () => {
              try {
                await StoriesService.deleteStory(stories[currentIndex].id);
                
                // If this was the only story, go back
                if (stories.length === 1) {
                  navigation.goBack();
                } else {
                  // Remove the deleted story from the array
                  const updatedStories = [...stories];
                  updatedStories.splice(currentIndex, 1);
                  
                  // Update stories array
                  setStories(updatedStories);
                  
                  // Adjust current index if needed
                  if (currentIndex >= updatedStories.length) {
                    setCurrentIndex(updatedStories.length - 1);
                  }
                }
              } catch (error) {
                console.error('Error deleting story:', error);
                Alert.alert('Error', 'Failed to delete story');
                setPaused(false);
              }
            },
            style: 'destructive',
          },
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('Error handling delete:', error);
      setPaused(false);
    }
  };
  
  if (loading) {
    return (
      <LinearGradient colors={['#000000', '#1a0033', '#000000']} style={styles.loadingContainer}>
        <Animated.View style={[styles.loadingContent, { opacity: fadeAnim, transform: [{ scale: pulseAnim }] }]}>
          <ActivityIndicator size="large" color="#ff00ff" />
          <Animated.View style={[styles.loadingGlow, { opacity: glowAnim }]} />
        </Animated.View>
      </LinearGradient>
    );
  }
  
  if (stories.length === 0) {
    return null; // This should not happen as we navigate back if no stories
  }
  
  const currentStory = stories[currentIndex];
  
  return (
    <LinearGradient colors={['#000000', '#1a0033', '#000000']} style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      {/* Story Content */}
      <Animated.View style={[styles.storyWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }]}>
        <TouchableOpacity 
          activeOpacity={1} 
          style={styles.storyContainer}
          onPress={handlePress}
          onPressIn={handleTouchStart}
          onPressOut={handleTouchEnd}
        >
          {/* Progress Bar */}
          <Animated.View style={[styles.progressContainer, { paddingTop: insets.top, opacity: fadeAnim }]}>
            {stories.map((_, index) => (
              <View key={index} style={styles.progressBarBackground}>
                <LinearGradient
                  colors={['#ff00ff', '#ff6b9d', '#00ffff']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={[styles.progressBar, { 
                    width: index === currentIndex ? `${progress * 100}%` : index < currentIndex ? '100%' : '0%' 
                  }]}
                />
                <Animated.View style={[styles.progressGlow, { opacity: glowAnim }]} />
              </View>
            ))}
          </Animated.View>
          
          {/* User Info */}
          <Animated.View style={[styles.header, { paddingTop: insets.top + 10, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <LinearGradient colors={['rgba(255, 0, 255, 0.1)', 'rgba(0, 255, 255, 0.1)', 'transparent']} style={styles.headerGradient}>
              <View style={styles.userInfo}>
                <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
                  <LinearGradient colors={['#ff00ff', '#ff6b9d', '#00ffff']} style={styles.avatarBorder}>
                    <Image 
                      source={{ uri: userInfo?.avatar_url || 'https://via.placeholder.com/40' }} 
                      style={styles.avatar} 
                    />
                  </LinearGradient>
                  <Animated.View style={[styles.avatarGlow, { opacity: glowAnim }]} />
                </Animated.View>
                <View style={styles.userTextContainer}>
                  <Text style={styles.username}>{userInfo?.username}</Text>
                  <Text style={styles.timestamp}>
                    {new Date(currentStory?.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
              
              {/* Menu Button (only show for user's own stories) */}
              {currentStory.user_id === userId && (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity 
                    style={styles.menuButton}
                    onPress={() => {
                      setPaused(true);
                      setMenuVisible(true);
                    }}
                  >
                    <LinearGradient colors={['rgba(255, 0, 255, 0.3)', 'rgba(0, 255, 255, 0.3)']} style={styles.menuButtonGradient}>
                      <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
                    </LinearGradient>
                    <Animated.View style={[styles.menuButtonGlow, { opacity: glowAnim }]} />
                  </TouchableOpacity>
                </Animated.View>
              )}
            </LinearGradient>
          </Animated.View>
          
          {/* Story Media */}
          <Animated.View style={[styles.mediaContainer, { transform: [{ scale: scaleAnim }] }]}>
            <Animated.View style={[styles.mediaGlow, { opacity: glowAnim }]} />
            {currentStory.type === 'video' ? (
              <Video
                ref={videoRef}
                source={{ uri: currentStory.media_url }}
                style={styles.media}
                resizeMode="contain"
                play={!paused && !isTouchHolding.current}
                loop={false}
                onPlaybackStatusUpdate={(status) => {
                  if (status.didJustFinish) {
                    goToNextStory();
                  }
                }}
              />
            ) : (
              <Image
                source={{ uri: currentStory.media_url }}
                style={styles.media}
                resizeMode="contain"
              />
            )}
            <Animated.View style={[styles.shimmerOverlay, { 
              opacity: shimmerAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.3, 0] }),
              transform: [{ translateX: shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-width, width] }) }]
            }]}>
              <LinearGradient 
                colors={['transparent', 'rgba(255, 0, 255, 0.4)', 'rgba(0, 255, 255, 0.4)', 'transparent']} 
                start={{x: 0, y: 0}} 
                end={{x: 1, y: 0}} 
                style={styles.shimmerGradient} 
              />
            </Animated.View>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
      
      {/* Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setMenuVisible(false);
          setPaused(false);
        }}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setMenuVisible(false);
            setPaused(false);
          }}
        >
          <LinearGradient colors={['#1a1a1a', '#2a0a3a', '#1a1a1a']} style={[styles.menuContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }]}>
            <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity style={styles.menuItem} onPress={handleDeleteStory}>
                <Ionicons name="trash-outline" size={24} color="#ff3b30" />
                <Text style={[styles.menuItemText, { color: '#ff3b30' }]}>Delete Story</Text>
              </TouchableOpacity>
            </Animated.View>
          </LinearGradient>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
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
  loadingGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 0, 255, 0.3)',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 20,
  },
  storyWrapper: {
    flex: 1,
  },
  storyContainer: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  progressBarBackground: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 2,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 0, 255, 0.3)',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarBorder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 0, 255, 0.3)',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 15,
  },
  userTextContainer: {
    marginLeft: 12,
  },
  username: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textShadowColor: 'rgba(255, 0, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  timestamp: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    textShadowColor: 'rgba(0, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  menuButton: {
    position: 'relative',
  },
  menuButtonGradient: {
    padding: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButtonGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 0, 255, 0.2)',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 10,
  },
  mediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  mediaGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 15,
  },
  media: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 10,
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(255, 59, 48, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default StoriesScreen;