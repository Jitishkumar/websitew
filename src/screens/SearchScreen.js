import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SearchScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Search for users when query changes
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    }, 500); // Debounce search for 500ms

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

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

  const renderUserItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.userItem}
      onPress={() => handleUserPress(item.id)}
    >
      <Image 
        source={{ uri: item.avatar_url || 'https://via.placeholder.com/150' }}
        style={styles.userAvatar}
      />
      <View style={styles.userInfo}>
        <View style={styles.usernameContainer}>
          <Text style={styles.username}>{item.username}</Text>
          {item.isVerified && (
            <Ionicons name="checkmark-circle" size={16} color="#ff0000" style={styles.verifiedBadge} />
          )}
        </View>
        <Text style={styles.fullName}>{item.full_name || ''}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={['#0f0f23', '#1a1a2e', '#16213e']} style={styles.container}>
      <LinearGradient
        colors={['rgba(255, 215, 0, 0.2)', 'rgba(255, 215, 0, 0.1)', 'transparent']}
        style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 50 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <LinearGradient
            colors={['#ffd700', '#ffed4e']}
            style={styles.backButtonGradient}
          >
            <Ionicons name="arrow-back" size={20} color="#000" />
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🔍 Search</Text>
      </LinearGradient>
      <View style={styles.searchInputContainer}>
        <LinearGradient
          colors={['rgba(255, 215, 0, 0.15)', 'rgba(255, 215, 0, 0.08)']}
          style={styles.searchInputGradient}
        >
          <LinearGradient
            colors={['#ffd700', '#ffed4e']}
            style={styles.searchIconContainer}
          >
            <Ionicons name="search" size={16} color="#000" />
          </LinearGradient>
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="rgba(255, 255, 255, 0.7)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </LinearGradient>
      </View>
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery('')}>
          <Ionicons name="close-circle" size={20} color="#666" />
        </TouchableOpacity>
      )}
      {loading ? (
        <ActivityIndicator size="large" color="#ff00ff" style={styles.loader} />
      ) : (
        <FlatList
          data={searchResults}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            searchQuery.trim().length > 0 && !loading ? (
              <View style={styles.emptyContainer}>
                <LinearGradient
                  colors={['#ffd700', '#ffed4e']}
                  style={styles.emptyIconContainer}
                >
                  <Ionicons name="person-outline" size={30} color="#000" />
                </LinearGradient>
                <Text style={styles.emptyText}>No users found</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ffd700" />
              </View>
            ) : null
          }
        />
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ff00ff40',
  },
  backButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 20,
    textShadowColor: 'rgba(255, 215, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  searchInputContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  searchInputGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    textShadowColor: 'rgba(255, 215, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ff00ff20',
    backgroundColor: '#55005580',
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 10,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedBadge: {
    marginLeft: 5,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'rgba(255, 215, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  fullName: {
    color: '#999',
    fontSize: 14,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
  loader: {
    marginTop: 50,
  },
});
export default SearchScreen;