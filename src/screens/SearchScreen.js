import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator, Dimensions } from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

const SearchScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [mediaResults, setMediaResults] = useState([]);
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'media'
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Animations removed for instant performance

  // Search for users when query changes
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (activeTab === 'users') {
        if (searchQuery.trim().length > 0) {
          searchUsers();
        } else {
          setSearchResults([]);
        }
      } else if (activeTab === 'media') {
        // For media, search even if query is empty to show all public posts
        searchMedia();
      }
    }, 500); // Debounce search for 500ms

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, activeTab]);

  const searchMedia = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('posts')
        .select(`
          id,
          caption,
          type,
          media_url,
          created_at,
          user_id,
          profiles:user_id (
            id,
            username,
            avatar_url,
            user_settings (
              private_account
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(60);

      if (searchQuery.trim().length > 0) {
        query = query.ilike('caption', `%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      const visibleMedia = (data || []).filter(post => {
        const settings = post?.profiles?.user_settings;
        const privateSetting = Array.isArray(settings)
          ? settings[0]?.private_account
          : settings?.private_account;
        return privateSetting !== true;
      });

      setMediaResults(visibleMedia);
    } catch (error) {
      console.error('Error searching media:', error);
    } finally {
      setLoading(false);
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

  const renderMediaItem = ({ item }) => {
    const isVideo = (item?.type || item?.media_type) === 'video';
    return (
      <TouchableOpacity 
        style={styles.mediaItem}
        onPress={() => navigation.navigate('Comment', { postId: item.id })}
        activeOpacity={0.85}
      >
        {isVideo ? (
          <View style={styles.mediaVideoWrapper}>
            <Video
              source={{ uri: item.media_url }}
              style={styles.mediaImage}
              resizeMode="cover"
              shouldPlay={false}
              isLooping={false}
              useNativeControls={false}
            />
            <View style={styles.videoOverlay} />
            <Ionicons name="play-circle" size={28} color="#fff" style={styles.playIcon} />
          </View>
        ) : (
          <Image source={{ uri: item.media_url }} style={styles.mediaImage} />
        )}
      </TouchableOpacity>
    );
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
            placeholder={activeTab === 'users' ? "Search for users..." : "Search for media..."}
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

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'users' && styles.activeTabButton]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'users' && styles.activeTabButtonText]}>Users</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'media' && styles.activeTabButton]}
          onPress={() => setActiveTab('media')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'media' && styles.activeTabButtonText]}>Media</Text>
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
            data={activeTab === 'users' ? searchResults : mediaResults}
            renderItem={activeTab === 'users' ? renderUserItem : renderMediaItem}
            keyExtractor={(item) => item.id}
            numColumns={activeTab === 'media' ? 3 : 1}
            key={activeTab} // Re-renders the list when tab changes
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              searchQuery.length > 0 ? (
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
                    <Text style={styles.emptyText}>{activeTab === 'users' ? 'No users found' : 'No media found'}</Text>
                    <Text style={styles.emptySubtext}>Try searching with different keywords</Text>
                  </LinearGradient>
                </Animated.View>
              ) : null
            }
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
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
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 10,
  },
  tabButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 5,
    backgroundColor: '#1a1a2e',
  },
  activeTabButton: {
    backgroundColor: '#ff00ff',
  },
  tabButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  activeTabButtonText: {
    color: '#fff',
  },
  mediaItem: {
    flex: 1,
    aspectRatio: 1,
    margin: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaVideoWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  playIcon: {
    position: 'absolute',
    top: 5,
    right: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: {width: -1, height: 1},
    textShadowRadius: 10
  },
});

export default SearchScreen;