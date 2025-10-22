import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, ScrollView, Image, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProfileVisitsModal from './ProfileVisitsModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { donate } from '../lib/donate';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';



const Sidebar = ({ isVisible, onClose }) => {
  const navigation = useNavigation();
  const [showVisitsModal, setShowVisitsModal] = useState(false);
  const [showConfessionInfoModal, setShowConfessionInfoModal] = useState(false);
  const [showSuggestedFriendsModal, setShowSuggestedFriendsModal] = useState(false);
  const [suggestedFriends, setSuggestedFriends] = useState([]);
  const [isFemaleProfle, setIsFemaleProfle] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (isVisible) {
      checkUserGender();
      prefetchNearbyPeople(); // Prefetch in background
      fetchSuggestedFriends(); // Also fetch suggested friends
    }
  }, [isVisible]);
  
  const fetchSuggestedFriends = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Fetch suggested friends from profiles table
      // This is a simple implementation - you might want to customize the query
      // based on your specific requirements (mutual interests, location, etc.)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, full_name')
        .neq('id', user.id)
        .limit(10);
        
      if (error) throw error;
      setSuggestedFriends(data || []);
    } catch (error) {
      console.error('Error fetching suggested friends:', error);
    }
  };

  const checkUserGender = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('gender')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setIsFemaleProfle(data?.gender === 'female');
    } catch (error) {
      console.error('Error checking user gender:', error);
    }
  };

  const prefetchNearbyPeople = async () => {
    try {
      // Check if cache exists and is fresh
      const CACHE_KEY = 'nearby_people';
      const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
      
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          console.log('✅ Nearby people cache is fresh, skipping prefetch');
          return; // Cache is fresh, no need to prefetch
        }
      }

      console.log('🔄 Prefetching nearby people in background...');
      
      // Check location permission silently
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission not granted, skipping prefetch');
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update user's location in background
      supabase
        .from('profiles')
        .update({
          current_latitude: latitude,
          current_longitude: longitude,
          location_updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .then(() => {});

      // Fetch nearby users (70km radius)
      const latDelta = 0.63;
      const lngDelta = 0.63;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, current_latitude, current_longitude, location_updated_at')
        .neq('id', user.id)
        .not('current_latitude', 'is', null)
        .not('current_longitude', 'is', null)
        .gte('current_latitude', latitude - latDelta)
        .lte('current_latitude', latitude + latDelta)
        .gte('current_longitude', longitude - lngDelta)
        .lte('current_longitude', longitude + lngDelta)
        .gte('location_updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(100);

      if (error) {
        console.error('Prefetch error:', error);
        return;
      }

      // Calculate distances and sort
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

      const usersWithDistance = data
        .map(person => ({
          ...person,
          distance: calculateDistance(latitude, longitude, person.current_latitude, person.current_longitude)
        }))
        .filter(person => person.distance <= 70000)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 50);

      // Cache the results
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        users: usersWithDistance,
        timestamp: Date.now()
      }));
      
      console.log('✅ Prefetched and cached nearby people');
    } catch (error) {
      console.error('Prefetch nearby people error:', error);
      // Silently fail - don't alert user during prefetch
    }
  };

  const handleLogout = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Error', 'No user session found');
        return;
      }

      // Store the email before signing out
      const userEmail = user.email;

      // Sign out from Supabase first
      const { error } = await supabase.auth.signOut();
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      // Clear all saved accounts from AsyncStorage
      try {
        await AsyncStorage.removeItem('savedAccounts');
        await AsyncStorage.removeItem('accountsLastUpdated');
      } catch (storageError) {
        console.error('Storage error:', storageError);
      }
      
      onClose();
      navigation.replace('Login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout');
    }
  };

  const handleAddAccount = () => {
    onClose();
    navigation.navigate('Signup');
  };

  return (
    <>
      <Modal
        visible={isVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={onClose}
      >
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f3460']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.sidebar,
            { 
              paddingTop: insets.top > 0 ? insets.top : 20,
              paddingLeft: insets.left + 20,
              paddingRight: 20,
              paddingBottom: insets.bottom > 0 ? insets.bottom : 20
            }
          ]}
        >
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <View style={styles.closeButtonContainer}>
              <Ionicons name="close" size={24} color="#ffd700" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => {
              setShowConfessionInfoModal(true);
            }}
          >
            <LinearGradient
              colors={['rgba(255, 215, 0, 0.1)', 'rgba(255, 215, 0, 0.05)']}
              style={styles.menuItemGradient}
            >
              <Ionicons name="heart" size={24} color="#ffd700" />
              <Text style={styles.menuText}>Confessions</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255, 215, 0, 0.6)" />
            </LinearGradient>
          </TouchableOpacity>

          {isFemaleProfle && (
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => setShowVisitsModal(true)}
            >
              <LinearGradient
                colors={['rgba(156, 136, 255, 0.1)', 'rgba(156, 136, 255, 0.05)']}
                style={styles.menuItemGradient}
              >
                <Ionicons name="eye" size={24} color="#9c88ff" />
                <Text style={styles.menuText}>Profile Visits</Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(156, 136, 255, 0.6)" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {
              onClose();
              navigation.navigate('Settings');
            }}
          >
            <LinearGradient
              colors={['rgba(102, 126, 234, 0.1)', 'rgba(102, 126, 234, 0.05)']}
              style={styles.menuItemGradient}
            >
              <Ionicons name="settings" size={24} color="#667eea" />
              <Text style={styles.menuText}>Settings</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(102, 126, 234, 0.6)" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleAddAccount}>
            <LinearGradient
              colors={['rgba(255, 107, 107, 0.1)', 'rgba(255, 107, 107, 0.05)']}
              style={styles.menuItemGradient}
            >
              <Ionicons name="person-add" size={24} color="#ff6b6b" />
              <Text style={styles.menuText}>Add Account</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255, 107, 107, 0.6)" />
            </LinearGradient>
          </TouchableOpacity>

           {/* Donate to Founder */}
           <TouchableOpacity
             style={styles.menuItem}
             onPress={() => {
               onClose();
               navigation.navigate('Donate');
             }}
           >
             <LinearGradient
               colors={['rgba(255, 215, 0, 0.15)', 'rgba(255, 215, 0, 0.08)']}
               style={styles.menuItemGradient}
             >
               <Ionicons name="diamond" size={24} color="#ffd700" />
               <Text style={styles.menuText}>Donate to Founder</Text>
               <Ionicons name="chevron-forward" size={16} color="rgba(255, 215, 0, 0.6)" />
             </LinearGradient>
           </TouchableOpacity>

           {/* Wealthiest Donors */}
           <TouchableOpacity
             style={styles.menuItem}
             onPress={() => {
               onClose();
               navigation.navigate('WealthiestDonors');
             }}
           >
             <LinearGradient
               colors={['rgba(255, 193, 7, 0.15)', 'rgba(255, 193, 7, 0.08)']}
               style={styles.menuItemGradient}
             >
               <Ionicons name="trophy" size={24} color="#ffc107" />
               <Text style={styles.menuText}>Wealthiest Donors</Text>
               <Ionicons name="chevron-forward" size={16} color="rgba(255, 193, 7, 0.6)" />
             </LinearGradient>
           </TouchableOpacity>

 
          {/* Nearby People */}
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('NearbyPeople')}
          >
            <LinearGradient
              colors={['rgba(76, 175, 80, 0.1)', 'rgba(76, 175, 80, 0.05)']}
              style={styles.menuItemGradient}
            >
              <Ionicons name="location" size={24} color="#4CAF50" />
              <Text style={styles.menuText}>Nearby People</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(76, 175, 80, 0.6)" />
            </LinearGradient>
          </TouchableOpacity>
          
          {/* Suggested Friends */}
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => setShowSuggestedFriendsModal(true)}
          >
            <LinearGradient
              colors={['rgba(33, 150, 243, 0.1)', 'rgba(33, 150, 243, 0.05)']}
              style={styles.menuItemGradient}
            >
              <Ionicons name="people" size={24} color="#2196F3" />
              <Text style={styles.menuText}>Suggested Friends</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(33, 150, 243, 0.6)" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Logout */}
           <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <LinearGradient
              colors={['rgba(255, 82, 82, 0.1)', 'rgba(255, 82, 82, 0.05)']}
              style={styles.menuItemGradient}
            >
              <Ionicons name="log-out" size={24} color="#ff5252" />
              <Text style={styles.menuText}>Logout</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255, 82, 82, 0.6)" />
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
      
      <ProfileVisitsModal
        visible={showVisitsModal}
        onClose={() => setShowVisitsModal(false)}
      />
      
      {/* Suggested Friends Modal */}
      <Modal
        visible={showSuggestedFriendsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuggestedFriendsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f3460']}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Suggested Friends</Text>
            
            {suggestedFriends.length > 0 ? (
              <FlatList
                data={suggestedFriends}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.friendItem}
                    onPress={() => {
                      setShowSuggestedFriendsModal(false);
                      onClose();
                      navigation.navigate('Profile', { userId: item.id });
                    }}
                  >
                    <Image 
                      source={item.avatar_url ? { uri: item.avatar_url } : require('../../assets/defaultavatar.png')} 
                      style={styles.avatar} 
                    />
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{item.full_name || item.username}</Text>
                      <Text style={styles.friendUsername}>@{item.username}</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.followButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        // Implement follow functionality here
                        Alert.alert('Success', `You are now following ${item.username}`);
                      }}
                    >
                      <LinearGradient
                        colors={['#2196F3', '#1976D2']}
                        style={styles.followButtonGradient}
                      >
                        <Text style={styles.followButtonText}>Follow</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
                style={styles.friendsList}
              />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#2196F3" />
                <Text style={styles.emptyStateText}>No suggestions available</Text>
                <Text style={styles.emptyStateSubtext}>We'll show you people you might want to follow here</Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]} 
              onPress={() => setShowSuggestedFriendsModal(false)}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                style={styles.buttonGradient}
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
      
      {/* Confession Info Modal */}
      <Modal
        visible={showConfessionInfoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfessionInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f3460']}
            style={styles.modalContent}
          >
            <ScrollView>
              <Text style={styles.modalTitle}>How to Use Confessions</Text>
              <Text style={styles.modalText}>
                In the Confession feature, you can write about any person, office, building, or place by their name.
              </Text>
              <Text style={styles.modalText}>
                • Search for a person, place, or building by typing their name
              </Text>
              <Text style={styles.modalText}>
                • Select from the suggestions that appear
              </Text>
              <Text style={styles.modalText}>
                • If what you're looking for isn't in the suggestions, you can create a new entry
              </Text>
              <Text style={styles.modalText}>
                • Write your confession and optionally add media
              </Text>
              <Text style={styles.modalText}>
                • Choose whether to remain anonymous
              </Text>
              <Text style={styles.modalText}>
                Share your thoughts, experiences, or feelings about places and people.
                
              </Text>
            </ScrollView>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity 
                style={styles.modalButton} 
                onPress={() => {
                  setShowConfessionInfoModal(false);
                  onClose();
                  navigation.navigate('ConfessionButton');
                }}
              >
                <LinearGradient
                  colors={['#ffd700', '#ffb300']}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.modalButtonText}>Continue to Confessions</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setShowConfessionInfoModal(false)}
              >
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.modalButtonText}>Close</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>

    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  sidebar: {
    width: '75%',
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  closeButton: {
    marginBottom: 20,
    alignSelf: 'flex-end',
  },
  closeButtonContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  menuItem: {
    marginVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItemGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 15,
  },
  modalTitle: {
    color: '#ffd700',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  modalText: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 12,
    lineHeight: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modalButtonContainer: {
    marginTop: 24,
  },
  modalButton: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonGradient: {
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  cancelButton: {
    // No background needed as gradient handles it
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  menuText: {
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 16,
    flex: 1,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Suggested Friends styles
  friendsList: {
    marginBottom: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  friendUsername: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  followButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  followButtonGradient: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  followButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyStateText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
});

export default Sidebar;