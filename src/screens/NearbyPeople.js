import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Image,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import * as Location from 'expo-location';

const NearbyPeople = ({ navigation }) => {
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    findNearbyPeople();
  }, []);

  const getBlockedUserIds = async (userId) => {
    const { data, error } = await supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', userId);

    if (error) {
      console.error('Error fetching blocked users:', error);
      return [];
    }
    return data.map(item => item.blocked_id);
  };

  const findNearbyPeople = async (useCache = true) => {
    try {
      setLoading(true);
      
      // Try cache first
      if (useCache) {
        const CACHE_KEY = 'nearby_people';
        const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
        
        try {
          const cached = await AsyncStorage.getItem(CACHE_KEY);
          if (cached) {
            const { users, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_EXPIRY) {
              setNearbyUsers(users);
              setLoading(false);
              console.log('✅ Loaded nearby people from cache');
              // Refresh in background
              setTimeout(() => findNearbyPeople(false), 100);
              return;
            }
          }
        } catch (cacheError) {
          console.error('Cache error:', cacheError);
        }
      }
      
      // Get location permission
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Please enable location to find nearby people');
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;

      // Update user's location in database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({
            current_latitude: latitude,
            current_longitude: longitude,
            location_updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
      }

      // Find nearby users (70km radius)
      const latDelta = 0.63; // ~70km
      const lngDelta = 0.63;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, current_latitude, current_longitude, location_updated_at')
        .neq('id', user?.id || '')
        .not('current_latitude', 'is', null)
        .not('current_longitude', 'is', null)
        .gte('current_latitude', latitude - latDelta)
        .lte('current_latitude', latitude + latDelta)
        .gte('current_longitude', longitude - lngDelta)
        .lte('current_longitude', longitude + lngDelta)
        .gte('location_updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(100); // Get more initially to filter out blocked/private

      if (error) throw error;

      // OPTIMIZED: Batch fetch blocked users and settings
      const blockedUserIds = await getBlockedUserIds(user.id);
      
      // Calculate distances for all users
      const usersWithDistance = data.map(person => ({
        ...person,
        distance: calculateDistance(
          latitude, longitude,
          person.current_latitude, person.current_longitude
        )
      }));

      // Filter out blocked users and users beyond 70km
      const nearbyFiltered = usersWithDistance
        .filter(person => !blockedUserIds.includes(person.id))
        .filter(person => person.distance <= 70000) // 70km in meters
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 100); // Get top 100

      // Batch fetch privacy settings for remaining users
      const userIds = nearbyFiltered.map(p => p.id);
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('user_id, private_account')
        .in('user_id', userIds);

      const privateUserIds = new Set(
        (settingsData || []).filter(s => s.private_account).map(s => s.user_id)
      );

      // Batch fetch follow status for private accounts
      const { data: followsData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .in('following_id', Array.from(privateUserIds));

      const followingIds = new Set((followsData || []).map(f => f.following_id));

      // Final filter: exclude private accounts user doesn't follow
      const nearbyWithDistance = nearbyFiltered
        .filter(person => {
          if (privateUserIds.has(person.id)) {
            return followingIds.has(person.id);
          }
          return true;
        })
        .slice(0, 50); // Limit final results

      setNearbyUsers(nearbyWithDistance);
      
      // Cache the results
      try {
        const CACHE_KEY = 'nearby_people';
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
          users: nearbyWithDistance,
          timestamp: Date.now()
        }));
        console.log('Cached nearby people');
      } catch (cacheError) {
        console.error('Error caching nearby people:', cacheError);
      }
      
    } catch (error) {
      console.error('Nearby search error:', error);
      Alert.alert('Error', 'Failed to find nearby people');
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const formatDistance = (distance) => {
    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    }
    return `${(distance / 1000).toFixed(1)}km`;
  };

  const handleUserPress = async (userId) => {
    try {
      // Get the current user's ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigation.navigate('Login');
        return;
      }

      // Don't check privacy for own profile
      if (user.id === userId) {
        navigation.navigate('Profile');
        return;
      }

      // Check if the profile is private
      const { data: settingsData, error: settingsError } = await supabase
        .rpc('get_user_privacy', { target_user_id: userId })
        .maybeSingle();

      if (settingsError) {
        console.error('Error fetching user settings:', settingsError);
        // Navigate to public profile on error
        navigation.navigate('UserProfileScreen', { userId });
        return;
      }

      // If no settings data, assume public account
      if (!settingsData) {
        navigation.navigate('UserProfileScreen', { userId });
        return;
      }

      const isPrivate = settingsData.private_account ?? false;

      // If account is private, check if current user follows them
      if (isPrivate) {
        const { data: followData, error: followError } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', user.id)
          .eq('following_id', userId)
          .maybeSingle();

        if (followError) {
          console.error('Error checking follow status:', followError);
          navigation.navigate('PrivateProfileScreen', { userId });
          return;
        }

        // If not following, show private profile screen
        if (!followData) {
          navigation.navigate('PrivateProfileScreen', { userId });
          return;
        }
      }

      // Navigate to public profile
      navigation.navigate('UserProfileScreen', { userId });
      
    } catch (error) {
      console.error('Error handling user press:', error);
      navigation.navigate('UserProfileScreen', { userId });
    }
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => handleUserPress(item.id)}
    >
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
        style={styles.userCardGradient}
      >
        <Image
          source={{ uri: item.avatar_url || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.username}>{item.username || 'Anonymous'}</Text>
          <View style={styles.locationInfo}>
            <Ionicons name="location" size={14} color="#4CAF50" />
            <Text style={styles.distance}>{formatDistance(item.distance)} away</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.4)" />
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.background}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nearby People</Text>
          <TouchableOpacity onPress={findNearbyPeople}>
            <Ionicons name="refresh" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <Text style={styles.statNumber}>{nearbyUsers.length}</Text>
          <Text style={styles.statLabel}>People within 1km</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="white" />
            <Text style={styles.loadingText}>Finding nearby people...</Text>
          </View>
        ) : (
          <FlatList
            data={nearbyUsers}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  findNearbyPeople(false).finally(() => setRefreshing(false)); // Force refresh, skip cache
                }}
                tintColor="white"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={60} color="rgba(255, 255, 255, 0.5)" />
                <Text style={styles.emptyTitle}>No one nearby</Text>
                <Text style={styles.emptyText}>No Flex users found within 70km</Text>
              </View>
            }
          />
        )}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  background: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  statsContainer: { alignItems: 'center', marginBottom: 20 },
  statNumber: { fontSize: 32, fontWeight: 'bold', color: 'white' },
  statLabel: { fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' },
  listContainer: { paddingHorizontal: 20 },
  userCard: { marginBottom: 12, borderRadius: 12, overflow: 'hidden' },
  userCardGradient: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  userInfo: { flex: 1 },
  username: { fontSize: 16, fontWeight: '600', color: 'white', marginBottom: 4 },
  locationInfo: { flexDirection: 'row', alignItems: 'center' },
  distance: { fontSize: 12, color: '#4CAF50', marginLeft: 4 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: 'white', marginTop: 12, fontSize: 16 },
  emptyContainer: { alignItems: 'center', paddingTop: 100 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: 'white', marginTop: 16 },
  emptyText: { fontSize: 14, color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center', marginTop: 8 }
});

export default NearbyPeople;
