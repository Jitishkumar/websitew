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
  Animated,
  ScrollView
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
  const [currentUserId, setCurrentUserId] = useState(null);
  const [storyInfoVisible, setStoryInfoVisible] = useState(false);
  const [storyViewers, setStoryViewers] = useState([]);
  const [viewerSize, setViewerSize] = useState({ width, height: height * 0.8 });
  const [mentionVisible, setMentionVisible] = useState(false);
  const mentionTimer = useRef(null);
  
  const videoRef = useRef(null);
  const progressInterval = useRef(null);
  const storyTimeout = useRef(null);
  const touchTimer = useRef(null);
  const isTouchHolding = useRef(false);

  // Simplified animation refs (removed sliding animations)
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  
  // Load stories when component mounts
  useEffect(() => {
    loadStories();
    getCurrentUser();
    initializeAnimations();
    
    // Cleanup on unmount
    return () => {
      clearInterval(progressInterval.current);
      clearTimeout(storyTimeout.current);
      if (mentionTimer.current) clearTimeout(mentionTimer.current);
    };
  }, []);

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id);
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };

  const initializeAnimations = () => {
    // Simplified animations (removed sliding)
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Subtle glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
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

  // Handle menu visibility changes - pause/resume progress
  useEffect(() => {
    if (menuVisible || storyInfoVisible) {
      // Menu or story info opened - clear intervals to stop progress immediately
      clearInterval(progressInterval.current);
      clearTimeout(storyTimeout.current);
      // Pause video if playing
      if (videoRef.current && currentStory?.type === 'video') {
        videoRef.current.pauseAsync();
      }
    } else if (stories.length > 0 && !loading) {
      // Menu closed - restart progress from current position
      startProgressFromCurrent();
      // Resume video if it was paused and not manually paused
      if (videoRef.current && currentStory?.type === 'video' && !paused) {
        videoRef.current.playAsync();
      }
    }
  }, [menuVisible, storyInfoVisible]);
  
  const loadStories = async () => {
    try {
      setLoading(true);
      
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      // Get stories for the specific user/group
      const data = await StoriesService.getUserStories(userId);
      
      if (data && data.length > 0) {
        // Sort stories: Your stories first, then by newest
        const sortedStories = data.sort((a, b) => {
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
      } else {
        setStories([]);
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
        console.log('Marking story as viewed:', stories[currentIndex].id);
        await StoriesService.markStoryAsViewed(stories[currentIndex].id);
        console.log('Story marked as viewed successfully');
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
      if (!paused && !menuVisible && !isTouchHolding.current) {
        setProgress(prev => {
          const newProgress = prev + incrementValue;
          return newProgress >= 1 ? 1 : newProgress;
        });
      }
    }, updateInterval);
    
    // Set timeout to move to next story
    storyTimeout.current = setTimeout(() => {
      if (!paused && !menuVisible && !isTouchHolding.current) {
        goToNextStory();
      }
    }, storyDuration);
  };

  const startProgressFromCurrent = () => {
    // Duration for each story (5 seconds)
    const storyDuration = 5000;
    const updateInterval = 50; // Update progress every 50ms
    const incrementValue = updateInterval / storyDuration;
    
    // Calculate remaining time based on current progress
    const remainingProgress = 1 - progress;
    const remainingTime = remainingProgress * storyDuration;
    
    // Start progress interval from current position
    progressInterval.current = setInterval(() => {
      if (!paused && !menuVisible && !isTouchHolding.current) {
        setProgress(prev => {
          const newProgress = prev + incrementValue;
          return newProgress >= 1 ? 1 : newProgress;
        });
      }
    }, updateInterval);
    
    // Set timeout for remaining time
    if (remainingTime > 0) {
      storyTimeout.current = setTimeout(() => {
        if (!paused && !menuVisible && !isTouchHolding.current) {
          goToNextStory();
        }
      }, remainingTime);
    }
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

    // Edge taps still navigate
    if (locationX < width / 6) {
      goToPreviousStory();
      return;
    }
    if (locationX > (width * 5) / 6) {
      goToNextStory();
      return;
    }

    // If story has a shared mention, show the bubble like Instagram
    if (currentStory?.shared_from_username) {
      setMentionVisible(true);
      setPaused(true);
      if (mentionTimer.current) clearTimeout(mentionTimer.current);
      mentionTimer.current = setTimeout(() => {
        setMentionVisible(false);
        setPaused(false);
      }, 2000);
      return;
    }

    // Otherwise toggle pause/play
    setPaused(!paused);
    if (videoRef.current) {
      if (paused) {
        videoRef.current.playAsync();
      } else {
        videoRef.current.pauseAsync();
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

  const handleReportStory = async () => {
    try {
      setMenuVisible(false);
      setPaused(true);
      
      Alert.alert(
        'Report Story',
        'Why are you reporting this story?',
        [
          {
            text: 'Cancel',
            onPress: () => setPaused(false),
            style: 'cancel',
          },
          {
            text: 'Inappropriate Content',
            onPress: () => submitReport('inappropriate'),
          },
          {
            text: 'Spam',
            onPress: () => submitReport('spam'),
          },
          {
            text: 'Harassment',
            onPress: () => submitReport('harassment'),
          },
        ],
        { cancelable: true }
      );
    } catch (error) {
      console.error('Error handling report:', error);
      setPaused(false);
    }
  };

  const submitReport = async (reason) => {
    try {
      // Submit report to Supabase
      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: currentUserId,
          reported_user_id: currentStory.user_id,
          content_type: 'story',
          content_id: currentStory.id,
          reason: reason,
          status: 'pending'
        });

      if (error) throw error;

      Alert.alert('Report Submitted', 'Thank you for your report. We will review it shortly.');
      setPaused(false);
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
      setPaused(false);
    }
  };

  const fetchStoryViewers = async () => {
    try {
      // Only allow story owner to fetch viewers
      if (currentStory.user_id !== currentUserId) {
        console.log('Access denied: Only story owner can view story viewers');
        setStoryViewers([]);
        return;
      }

      console.log('Fetching story viewers for story:', currentStory.id);

      // First get the story views
      const { data: viewsData, error: viewsError } = await supabase
        .from('story_views')
        .select('user_id, created_at')
        .eq('story_id', currentStory.id)
        .order('created_at', { ascending: false });

      console.log('Story views data:', viewsData, 'Error:', viewsError);

      if (viewsError) throw viewsError;

      if (!viewsData || viewsData.length === 0) {
        console.log('No story views found');
        setStoryViewers([]);
        return;
      }

      // Get user IDs
      const userIds = viewsData.map(view => view.user_id);
      console.log('User IDs to fetch profiles for:', userIds);

      // Then get the profiles for those users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', userIds);

      console.log('Profiles data:', profilesData, 'Error:', profilesError);

      if (profilesError) throw profilesError;

      // Process avatar URLs like in ProfileVisitsModal
      const processedProfiles = profilesData?.map(profile => {
        let avatarUrl = null;
        if (profile.avatar_url) {
          let avatarPath = profile.avatar_url;
          if (avatarPath.includes('media/media/')) {
            const parts = avatarPath.split('media/');
            avatarPath = parts[parts.length - 1];
          } else if (avatarPath.includes('media/')) {
            avatarPath = avatarPath.split('media/').pop();
          }
          avatarUrl = `https://lckhaysswueoyinhfzyz.supabase.co/storage/v1/object/public/media/${avatarPath}`;
        }
        return { ...profile, avatar_url: avatarUrl };
      }) || [];

      // Combine the data
      const viewersWithProfiles = viewsData.map(view => {
        const profile = processedProfiles.find(p => p.id === view.user_id);
        return {
          user_id: view.user_id,
          created_at: view.created_at,
          profiles: profile || { username: 'Unknown User', full_name: 'Unknown User', avatar_url: null }
        };
      });

      console.log('Final viewers with profiles:', viewersWithProfiles);
      setStoryViewers(viewersWithProfiles);
    } catch (error) {
      console.error('Error fetching story viewers:', error);
      setStoryViewers([]);
    }
  };

  const handleViewStory = async () => {
    setPaused(true);
    setStoryInfoVisible(true);
    await fetchStoryViewers();
  };
  
  if (loading) {
    return (
      <LinearGradient colors={['#000000', '#1a0033', '#000000']} style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#ff00ff" />
        </View>
      </LinearGradient>
    );
  }
  
  if (stories.length === 0) {
    return null; // This should not happen as we navigate back if no stories
  }
  
  const currentStory = stories[currentIndex];
  // Precompute shared card geometry (center-based)
  const isShared = !!(currentStory?.shared_from_username || typeof currentStory?.position_x === 'number');
  const CARD_W = 250;
  const CARD_H = 350;
  const cardScale = Number(currentStory?.scale) > 0 ? Number(currentStory.scale) : 1;
  const centerX = (currentStory?.position_x ?? 0.5) * viewerSize.width;
  const centerY = (currentStory?.position_y ?? 0.5) * viewerSize.height;
  const leftPos = centerX - (CARD_W * cardScale) / 2;
  const topPos = centerY - (CARD_H * cardScale) / 2;
  
  return (
    <LinearGradient colors={['#000000', '#1a0033', '#000000']} style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      {/* Story Content */}
      <View style={styles.storyWrapper}>
        <TouchableOpacity 
          activeOpacity={1} 
          style={styles.storyContainer}
          onPress={handlePress}
          onPressIn={handleTouchStart}
          onPressOut={handleTouchEnd}
        >
          {/* Progress Bar */}
          <View style={[styles.progressContainer, { paddingTop: insets.top }]}>
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
          </View>
          
          {/* User Info */}
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <LinearGradient colors={['rgba(255, 0, 255, 0.1)', 'rgba(0, 255, 255, 0.1)', 'transparent']} style={styles.headerGradient}>
              <View style={styles.userInfo}>
                <View style={styles.avatarContainer}>
                  <LinearGradient colors={['#ff00ff', '#ff6b9d', '#00ffff']} style={styles.avatarBorder}>
                    <Image 
                      source={{ uri: userInfo?.avatar_url || 'https://via.placeholder.com/40' }} 
                      style={styles.avatar} 
                    />
                  </LinearGradient>
                </View>
                <View style={styles.userTextContainer}>
                  <Text style={styles.username}>{userInfo?.username}</Text>
                  <Text style={styles.timestamp}>
                    {new Date(currentStory?.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
              
              {/* Menu Button (show for all stories) */}
              <TouchableOpacity 
                style={styles.menuButton}
                onPress={() => {
                  setPaused(true);
                  setMenuVisible(true);
                  // Pause video if it's playing
                  if (videoRef.current && currentStory.type === 'video') {
                    videoRef.current.pauseAsync();
                  }
                }}
              >
                <LinearGradient colors={['rgba(255, 0, 255, 0.3)', 'rgba(0, 255, 255, 0.3)']} style={styles.menuButtonGradient}>
                  <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
          
          {/* Story Media */}
          <View style={styles.mediaContainer} onLayout={(e)=>{
            const { width: w, height: h } = e.nativeEvent.layout;
            if (w && h) setViewerSize({ width: w, height: h });
          }}>
            {/* If this is a shared story, render as a positioned small card (center-based) */}
            {isShared ? (
              <View
                style={[
                  styles.sharedCardContainer,
                  {
                    width: CARD_W * cardScale,
                    height: CARD_H * cardScale,
                    left: leftPos,
                    top: topPos,
                  },
                ]}
              >
                {currentStory.type === 'video' ? (
                  <Video
                    ref={videoRef}
                    source={{ uri: currentStory.media_url }}
                    style={styles.sharedMediaSmall}
                    resizeMode="cover"
                    play={!paused && !isTouchHolding.current && !menuVisible}
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
                    style={styles.sharedMediaSmall}
                    resizeMode="cover"
                  />
                )}
              </View>
            ) : (
              // Fallback: regular story full screen
              <>
                {currentStory.type === 'video' ? (
                  <Video
                    ref={videoRef}
                    source={{ uri: currentStory.media_url }}
                    style={styles.media}
                    resizeMode="contain"
                    play={!paused && !isTouchHolding.current && !menuVisible}
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
              </>
            )}

            {/* Username overlay for shared stories (clickable) */}
            {currentStory.shared_from_username && (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigation.navigate('UserProfileScreen', { userId: currentStory.shared_from_user_id })}
                style={styles.sharedStoryOverlay}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.8)']}
                  style={styles.sharedUsernameGradient}
                >
                  <Text style={styles.sharedUsernameText}>
                    @{currentStory.shared_from_username}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Mention bubble shown when tapping anywhere */}
            {currentStory.shared_from_username && mentionVisible && (
              <TouchableOpacity
                style={styles.mentionBubble}
                activeOpacity={0.95}
                onPress={() => navigation.navigate('UserProfileScreen', { userId: currentStory.shared_from_user_id })}
              >
                <Text style={styles.mentionText}>@{currentStory.shared_from_username}</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>

        {/* View Story Button - Bottom (Only for story owner) */}
        {currentStory.user_id === currentUserId && (
          <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity 
              style={styles.viewStoryButton}
              onPress={handleViewStory}
            >
              <LinearGradient colors={['rgba(255, 0, 255, 0.2)', 'rgba(0, 255, 255, 0.2)']} style={styles.viewStoryGradient}>
                <Ionicons name="eye-outline" size={20} color="#fff" />
                <Text style={styles.viewStoryText}>View Story</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
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
            {/* Show different options based on story ownership */}
            {currentStory.user_id === currentUserId ? (
              <TouchableOpacity style={styles.menuItem} onPress={handleDeleteStory}>
                <Ionicons name="trash-outline" size={24} color="#ff3b30" />
                <Text style={[styles.menuItemText, { color: '#ff3b30' }]}>Delete Story</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.menuItem} onPress={handleReportStory}>
                <Ionicons name="flag-outline" size={24} color="#ff9500" />
                <Text style={[styles.menuItemText, { color: '#ff9500' }]}>Report Story</Text>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Modal>

      {/* Story Info Modal */}
      <Modal
        visible={storyInfoVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setStoryInfoVisible(false);
          setPaused(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setStoryInfoVisible(false);
              setPaused(false);
            }}
          />
          <View style={styles.storyInfoContainer}>
            <LinearGradient colors={['#1a1a1a', '#2a0a3a', '#1a1a1a']} style={[styles.storyInfoGradient, { paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.storyInfoHeader}>
                <Text style={styles.storyInfoTitle}>Story Views</Text>
                <Text style={styles.storyInfoCount}>{storyViewers.length} views</Text>
              </View>
              
              <ScrollView style={styles.viewersList} showsVerticalScrollIndicator={false}>
              {storyViewers.length > 0 ? (
                storyViewers.map((viewer, index) => (
                    <View key={index} style={styles.viewerItem}>
                      <Image 
                        source={{ uri: viewer.profiles?.avatar_url || 'https://via.placeholder.com/150' }} 
                        style={styles.viewerAvatar} 
                      />
                      <View style={styles.viewerInfo}>
                        <Text style={styles.viewerName}>{viewer.profiles?.full_name || viewer.profiles?.username || 'Unknown User'}</Text>
                        <Text style={styles.viewerUsername}>@{viewer.profiles?.username || 'unknown'}</Text>
                      </View>
                      <View style={styles.viewTime}>
                        <Text style={styles.viewTimeText}>
                          {new Date(viewer.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                ))
              ) : (
                <View style={styles.noViewersContainer}>
                  <Ionicons name="eye-off-outline" size={48} color="rgba(255, 255, 255, 0.3)" />
                  <Text style={styles.noViewersText}>No views yet</Text>
                </View>
              )}
              </ScrollView>
            </LinearGradient>
          </View>
        </View>
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
  },
  sharedCardContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 250,
    height: 350,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  sharedMediaSmall: {
    width: '100%',
    height: '100%',
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
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  viewStoryButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  viewStoryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  viewStoryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    textShadowColor: 'rgba(255, 0, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modalBackdrop: {
    flex: 1,
  },
  storyInfoContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 20,
  },
  storyInfoGradient: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    minHeight: 300,
  },
  storyInfoHeader: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  storyInfoTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(255, 0, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  storyInfoCount: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  viewersList: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 15,
    minHeight: 200,
  },
  viewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
  },
  viewerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#ff00ff',
    marginRight: 15,
  },
  viewerInfo: {
    flex: 1,
  },
  viewerName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'rgba(255, 0, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  viewerUsername: {
    color: '#ff00ff',
    fontSize: 14,
    marginTop: 2,
  },
  viewTime: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 255, 0.2)',
    padding: 8,
    borderRadius: 15,
  },
  viewTimeText: {
    color: '#ff00ff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sharedStoryOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  sharedUsernameGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  sharedUsernameText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 0.5,
  },
  mentionBubble: {
    position: 'absolute',
    bottom: 110,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  mentionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  noViewersContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noViewersText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
});

export default StoriesScreen;