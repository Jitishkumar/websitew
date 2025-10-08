import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

const MediaGridItem = ({ item, index, onPress, videoRefs }) => {
  React.useEffect(() => {
    videoRefs.current.set(item.id, videoRef);
    return () => {
      videoRefs.current.delete(item.id);
    };
  }, [item.id, videoRefs]);

  const renderMediaItem = ({ item, index }) => (
    <MediaGridItem
      item={item}
      index={index}
      onPress={() => handleMediaPress(index)}
      videoRefs={videoRefs}
    />
  );

  const handleMediaPress = (index) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState('users');
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Video refs for cleanup
  const videoRefs = useRef(new Map());

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const searchBarAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Initialize animations
  useEffect(() => {
    startAnimations();
    startContinuousAnimations();
  }, []);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(searchBarAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const startContinuousAnimations = () => {
    // Pulse animation
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

    // Shimmer animation
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // Search for users or media when query changes
  useEffect(() => {
    if (selectedTab === 'users') {
      if (searchQuery.trim().length > 0) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    } else {
      // For media tab, always load media (with or without search query)
      searchMedia();
    }
  }, [searchQuery, selectedTab]);

  // Cleanup videos when screen loses focus
  useFocusEffect(
    React.useCallback(() => {
      // Screen is focused - videos can be active
      return () => {
        // Screen is unfocused - cleanup all video resources
        cleanupVideos();
      };
    }, [])
  );

  const cleanupVideos = async () => {
    try {
      const promises = [];
      videoRefs.current.forEach((videoRef) => {
        if (videoRef.current) {
          promises.push(videoRef.current.unloadAsync().catch(() => {}));
        }
      });
      await Promise.all(promises);
      videoRefs.current.clear();
    } catch (error) {
      console.warn('Error cleaning up videos:', error);
    }
  };

  const searchUsers = async () => {
    setLoading(true);
    try {
      // Search for users by username
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .ilike('username', `%${searchQuery}%`)
        .order('username')
        .limit(20);

      if (error) throw error;

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setSearchResults([]);
        setLoading(false);
        return;
      }

      // Filter out the current user from the search results
      const filteredData = data.filter(user => user.id !== currentUser.id);

      // Check for blocked status and fetch verification status
      const usersWithStatus = await Promise.all(filteredData.map(async (user) => {
        // Check if the user is blocked
        const { data: isBlocked, error: isBlockedError } = await supabase.rpc('is_blocked', {
          user_id_1: currentUser.id,
          user_id_2: user.id
        });

        if (isBlockedError) {
          console.error('Error checking block status:', isBlockedError);
          return null; // Exclude user on error
        }

        if (isBlocked) {
          return null; // Exclude blocked user
        }

        // Fetch verification status
        const { data: verifiedData } = await supabase
          .from('verified_accounts')
          .select('verified')
          .eq('id', user.id)
          .maybeSingle();
          
        return {
          ...user,
          isVerified: verifiedData?.verified || false
        };
      }));
      
      // Filter out any null values from the results
      setSearchResults(usersWithStatus.filter(Boolean) || []);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchMedia = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (id, username, avatar_url),
          likes:post_likes (count),
          comments:post_comments (count)
        `)
        .neq('type', 'text')  // Only media posts
        .order('created_at', { ascending: false })
        .limit(searchQuery.trim().length > 0 ? 50 : 100); // More results when showing all

      // Add caption search filter if there's a search query
      if (searchQuery.trim().length > 0) {
        query = query.ilike('caption', `%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter out posts from private accounts
      const publicPosts = [];
      for (const post of data) {
        const { data: settingsData } = await supabase
          .from('user_settings')
          .select('private_account')
          .eq('user_id', post.user_id)
          .maybeSingle();

        // Include post if account is not private (default to public)
        if (!settingsData?.private_account) {
          publicPosts.push(post);
        }
      }

      setSearchResults(publicPosts);
    } catch (error) {
      console.error('Error searching media:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserPress = async (userId) => {
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
      // We can't create settings for other users due to RLS policies
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

  const renderUserItem = ({ item, index }) => (
    <Animated.View
      style={[
        {
          opacity: fadeAnim,
          transform: [
            { 
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0]
              })
            },
            { scale: scaleAnim }
          ]
        }
      ]}
    >
      <TouchableOpacity 
        style={styles.userItem}
        onPress={() => handleUserPress(item.id)}
        activeOpacity={0.8}
      >
        {/* User item glow effect */}
        <Animated.View
          style={[
            styles.userItemGlow,
            {
              opacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.3]
              })
            }
          ]}
        />
        
        {/* Avatar with pulse animation */}
        <Animated.View 
          style={[
            styles.avatarContainer,
            { transform: [{ scale: pulseAnim }] }
          ]}
        >
          <LinearGradient
            colors={['#ff00ff', '#ff6b9d', '#00ffff']}
            style={styles.avatarBorder}
          >
            <Image 
              source={{ uri: item.avatar_url || 'https://via.placeholder.com/150' }}
              style={styles.userAvatar}
            />
          </LinearGradient>
          
          {item.isVerified && (
            <Animated.View 
              style={[
                styles.verifiedBadgeContainer,
                { transform: [{ scale: pulseAnim }] }
              ]}
            >
              <LinearGradient
                colors={['#ff00ff', '#00ffff']}
                style={styles.verifiedBadgeGradient}
              >
                <Ionicons name="checkmark" size={12} color="#fff" />
              </LinearGradient>
            </Animated.View>
          )}
        </Animated.View>
        
        <View style={styles.userInfo}>
          <View style={styles.usernameContainer}>
            <Text style={styles.username}>{item.username}</Text>
          </View>
          <Text style={styles.fullName}>{item.full_name || ''}</Text>
        </View>
        
        {/* Shimmer effect */}
        <Animated.View
          style={[
            styles.shimmerOverlay,
            {
              opacity: shimmerAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.3, 0]
              }),
              transform: [{
                translateX: shimmerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-100, 100]
                })
              }]
            }
          ]}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255, 0, 255, 0.4)', 'rgba(0, 255, 255, 0.4)', 'transparent']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={styles.shimmerGradient}
          />
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderMediaItem = ({ item, index }) => {
    const videoRef = useRef(null);

    // Store video ref for cleanup
    React.useEffect(() => {
      videoRefs.current.set(item.id, videoRef);
      return () => {
        videoRefs.current.delete(item.id);
      };
    }, [item.id]);

    return (
      <TouchableOpacity 
        style={styles.mediaGridItem}
        onPress={() => handleMediaPress(index)}
        activeOpacity={0.8}
      >
        {item.type === 'video' ? (
          <View style={styles.mediaContainer}>
            <Video
              ref={videoRef}
              source={{ uri: item.media_url }}
              style={styles.mediaImage}
              resizeMode="cover"
              shouldPlay={false}
              positionMillis={1000} // Show thumbnail at 1 second
              useNativeControls={false}
            />
            <View style={styles.videoOverlay}>
              <Ionicons name="play" size={24} color="#fff" />
            </View>
          </View>
        ) : (
          <Image 
            source={{ uri: item.media_url }}
            style={styles.mediaImage}
            resizeMode="cover"
          />
        )}
        
        <View style={styles.mediaItemOverlay}>
          <View style={styles.mediaItemStats}>
            <Ionicons name="heart" size={14} color="#fff" />
            <Text style={styles.mediaItemStatsText}>{item.likes?.[0]?.count || 0}</Text>
            <Ionicons name="chatbubble" size={14} color="#fff" style={{ marginLeft: 8 }} />
            <Text style={styles.mediaItemStatsText}>{item.comments?.[0]?.count || 0}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const handleMediaPress = (index) => {
    navigation.navigate('PostViewer', {
      posts: searchResults,
      initialIndex: index,
    });
  };

  return (
    <View style={styles.container}>
      {/* Enhanced Header with animations */}
      <Animated.View
        style={[
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f3460']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 50 }]}
        >
          {/* Header glow effect */}
          <Animated.View
            style={[
              styles.headerGlow,
              {
                opacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 0.8]
                })
              }
            ]}
          />
          
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#ff00ff" />
            </TouchableOpacity>
          </Animated.View>
          
          <Text style={styles.headerTitle}>Search</Text>
          
          {/* Header shimmer effect */}
          <Animated.View
            style={[
              styles.headerShimmer,
              {
                opacity: shimmerAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0.4, 0]
                }),
                transform: [{
                  translateX: shimmerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-width, width]
                  })
                }]
              }
            ]}
          >
            <LinearGradient
              colors={['transparent', 'rgba(255, 0, 255, 0.6)', 'rgba(0, 255, 255, 0.6)', 'transparent']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={styles.shimmerGradient}
            />
          </Animated.View>
        </LinearGradient>
      </Animated.View>
      
      {/* Enhanced Search Container */}
      <Animated.View
        style={[
          styles.searchContainer,
          {
            opacity: searchBarAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: slideAnim }
            ]
          }
        ]}
      >
        {/* Search container glow */}
        <Animated.View
          style={[
            styles.searchGlow,
            {
              opacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 0.6]
              })
            }
          ]}
        />
        
        <LinearGradient
          colors={['rgba(26, 26, 46, 0.9)', 'rgba(22, 33, 62, 0.8)']}
          style={styles.searchInputContainer}
        >
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Ionicons name="search" size={20} color="#ff00ff" style={styles.searchIcon} />
          </Animated.View>
          
          <TextInput
            style={styles.searchInput}
            placeholder={`Search for ${selectedTab === 'users' ? 'users' : 'media'}...`}
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          
          {searchQuery.length > 0 && (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#ff00ff" />
              </TouchableOpacity>
            </Animated.View>
          )}
        </LinearGradient>
      </Animated.View>

      {/* Tab Buttons */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, selectedTab === 'users' && styles.activeTab]}
          onPress={() => {
            setSelectedTab('users');
            setSearchResults([]);
          }}
        >
          <Text style={[styles.tabButtonText, selectedTab === 'users' && styles.activeTabText]}>Users</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, selectedTab === 'media' && styles.activeTab]}
          onPress={() => {
            setSelectedTab('media');
            // Load media immediately when switching to media tab
            searchMedia();
          }}
        >
          <Text style={[styles.tabButtonText, selectedTab === 'media' && styles.activeTabText]}>Media</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Animated.View 
          style={[
            styles.loadingContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: pulseAnim }]
            }
          ]}
        >
          <LinearGradient
            colors={['rgba(255, 0, 255, 0.2)', 'rgba(0, 255, 255, 0.1)']}
            style={styles.loadingGradient}
          >
            <ActivityIndicator size="large" color="#ff00ff" />
            <Text style={styles.loadingText}>Searching...</Text>
          </LinearGradient>
        </Animated.View>
      ) : (
        <Animated.View
          style={[
            { flex: 1 },
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <FlatList
            data={searchResults}
            renderItem={selectedTab === 'users' ? renderUserItem : renderMediaItem}
            keyExtractor={(item) => item.id}
            key={selectedTab}  // Force re-render when tab changes
            numColumns={selectedTab === 'media' ? 3 : 1}
            columnWrapperStyle={selectedTab === 'media' ? styles.gridRow : null}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              searchQuery.length > 0 || selectedTab === 'users' ? (
                <Animated.View
                  style={[
                    styles.emptyContainer,
                    {
                      opacity: fadeAnim,
                      transform: [{ scale: scaleAnim }]
                    }
                  ]}
                >
                  <LinearGradient
                    colors={['rgba(255, 0, 255, 0.1)', 'rgba(0, 255, 255, 0.05)']}
                    style={styles.emptyGradient}
                  >
                    <Ionicons name="search" size={60} color="#ff00ff" />
                    <Text style={styles.emptyText}>
                      {selectedTab === 'users' ? 'No users found' : 'No media found'}
                    </Text>
                    <Text style={styles.emptySubtext}>
                      {searchQuery.length > 0 ? 'Try searching with different keywords' : 
                       selectedTab === 'users' ? 'Start typing to search for users' : 
                       'No public media posts available'}
                    </Text>
                  </LinearGradient>
                </Animated.View>
              ) : null
            }
            contentContainerStyle={selectedTab === 'media' ? styles.gridContainer : { paddingBottom: insets.bottom + 20 }}
          />
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
  },
  headerShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 200,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 16,
    textShadowColor: 'rgba(255, 0, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  searchContainer: {
    margin: 16,
    marginTop: 8,
    position: 'relative',
  },
  searchGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 29,
    backgroundColor: 'rgba(255, 0, 255, 0.3)',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 0, 255, 0.3)',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.2)',
    position: 'relative',
    overflow: 'hidden',
  },
  userItemGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    borderRadius: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatarBorder: {
    padding: 3,
    borderRadius: 28,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  verifiedBadgeContainer: {
    position: 'absolute',
    right: -2,
    top: -2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  verifiedBadgeGradient: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'rgba(255, 0, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  fullName: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 2,
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 100,
  },
  shimmerGradient: {
    flex: 1,
    borderRadius: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 20,
  },
  loadingGradient: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 0, 255, 0.3)',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textShadowColor: 'rgba(255, 0, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 50,
  },
  emptyGradient: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 0, 255, 0.2)',
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
    textShadowColor: 'rgba(255, 0, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  emptySubtext: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(26, 26, 46, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.3)',
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: 'rgba(255, 0, 255, 0.2)',
    borderColor: '#ff00ff',
  },
  tabButtonText: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#ff00ff',
  },
  mediaGridItem: {
    flex: 1/3,
    aspectRatio: 1,
    margin: 1,
    position: 'relative',
  },
  mediaContainer: {
    flex: 1,
    position: 'relative',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  mediaItemOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 4,
  },
  mediaItemStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  mediaItemStatsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  gridContainer: {
    padding: 2,
    paddingBottom: 100,
  },
});

export default SearchScreen;