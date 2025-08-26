import React, { useState, useEffect, useRef } from 'react';
//djjdjdjd
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  FlatList, 
  Image, 
  Modal,
  ScrollView,
  Switch,
  ActivityIndicator,
  Platform,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../config/supabase';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';
import ConfessionCommentScreen from './ConfessionCommentScreen'; // Added import for ConfessionCommentScreen

const { width: screenWidth } = Dimensions.get('window');

// New ConfessionsHeader component
const ConfessionsHeader = React.memo(({
  navigation,
  searchQuery,
  setSearchQuery,
  searchTimeoutRef,
  searchLocations,
  searchResults,
  selectLocation,
  searchLoading,
  showMap,
  setShowMap,
  goToUserLocation,
  selectedLocation,
  renderLocationProfile,
  setShowAddPlaceModal,
  searchError,
  loading, // Keep loading for the `noResultsContainer` conditional rendering
  userLocation,
}) => {
  return (
    <View>
      <LinearGradient
        colors={['#0a0a2a', '#1a1a3a']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.header}
      >
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#ff00ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confessions</Text>
      </LinearGradient>

      <LinearGradient
        colors={['#1a1a3a', '#0d0d2a']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.searchContainer}
      >
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a place, institution, company..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            
            if (searchTimeoutRef.current) {
              clearTimeout(searchTimeoutRef.current);
            }
            
            if (text.length < 3) {
              // setSearchResults([]); // Handled by searchLocations when query < 3
              return;
            }
            
            searchTimeoutRef.current = setTimeout(() => {
              searchLocations(text);
            }, 500);
          }}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.mapButton}
          onPress={() => setShowMap(!showMap)}
        >
          <Ionicons name={showMap ? "map" : "map-outline"} size={20} color="#ff00ff" />
        </TouchableOpacity>
      </LinearGradient>

      {searchResults.length > 0 ? (
        <ScrollView style={styles.searchResultsList} nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
          {searchResults.map((item) => (
            <TouchableOpacity 
              key={item.place_id.toString()}
              style={styles.searchResultItem}
              onPress={() => selectLocation(item)}
            >
              <Ionicons name="location" size={20} color="#ff00ff" />
              <Text style={styles.searchResultText}>{item.display_name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        searchQuery.length >= 3 && !searchLoading && (
          <View style={styles.noResultsContainer}>
            <Text style={styles.noResultsText}>No locations found</Text>
            <TouchableOpacity 
              style={styles.addPlaceButton}
              onPress={() => setShowAddPlaceModal(true)}
            >
              <Text style={styles.addPlaceButtonText}>Add New Place</Text>
            </TouchableOpacity>
          </View>
        )
      )}

      {searchError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {searchError.includes('Network request failed') 
              ? 'Network error. Check your connection.' 
              : 'Error searching locations. Try again.'}
          </Text>
        </View>
      )}
      
      {showMap && (
        <View style={styles.mapContainer}>
          <WebView
            style={styles.map}
            source={{ uri: getMapUrl({ mapRegion: { latitude: selectedLocation?.lat || userLocation?.coords.latitude, longitude: selectedLocation?.lon || userLocation?.coords.longitude }, selectedLocation, userLocation }) }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            onError={(e) => console.error('WebView error:', e.nativeEvent)}
            renderLoading={() => (
              <View style={[styles.loadingContainer, StyleSheet.absoluteFill]}>
                <ActivityIndicator size="large" color="#ff00ff" />
              </View>
            )}
            startInLoadingState={true}
          />
          <View style={styles.mapControls}>
            <TouchableOpacity 
              style={styles.closeMapButton}
              onPress={() => setShowMap(false)}
            >
              <Ionicons name="close-circle" size={30} color="#ff00ff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.locationButton}
              onPress={goToUserLocation}
            >
              <Ionicons name="locate" size={24} color="#ff00ff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {selectedLocation && renderLocationProfile()}

      {searchLoading && ( // Display search-specific loading indicator
        <View style={styles.searchOverlayLoading}>
          <ActivityIndicator size="small" color="#ff00ff" />
          <Text style={styles.searchOverlayLoadingText}>Searching...</Text>
        </View>
      )}
    </View>
  );
});

const ConfessionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute(); // Import useRoute hook
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [confessions, setConfessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNewConfessionModal, setShowNewConfessionModal] = useState(false);
  const [newConfession, setNewConfession] = useState('');
  const [media, setMedia] = useState([]);
  const [remainAnonymous, setRemainAnonymous] = useState(true);
  const [mapRegion, setMapRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
  });
  const [userLocation, setUserLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [locationProfile, setLocationProfile] = useState(null);
  const [showLocationProfileModal, setShowLocationProfileModal] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [profileBio, setProfileBio] = useState('');
  const [showReactionModal, setShowReactionModal] = useState(false);
  const [selectedConfessionForReaction, setSelectedConfessionForReaction] = useState(null);
  const [confessionReactions, setConfessionReactions] = useState({});
  const [confessionVerifications, setConfessionVerifications] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserUsername, setCurrentUserUsername] = useState(null); // New state for current user's username
  const [confessionLikes, setConfessionLikes] = useState({});
  const [confessionComments, setConfessionComments] = useState({});
  const [showCommentModal, setShowCommentModal] = useState(false); // Added state for CommentScreen modal
  const [searchTimeout, setSearchTimeout] = useState(null);
  const searchTimeoutRef = useRef(null); // Added
  const confessionsListRef = useRef(null); // Ref for FlatList to scroll to a specific confession
  const [showAddPlaceModal, setShowAddPlaceModal] = useState(false);
  const [newPlace, setNewPlace] = useState({
    type: 'institute',
    name: '',
    city: '',
    district: '',
    state: '',
    country: ''
  });
  const [searchLoading, setSearchLoading] = useState(false); // New state for search loading

  // Emoji options for reactions
  const emojiOptions = ['😂', '❤️', '😮', '😢', '😡', '👍', '👎', '🔥', '💯', '🤔'];

  // Request location permission and get current location (runs once on mount)
  useEffect(() => {
    const setupInitialData = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation(location);
        setMapRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();
        if (!error && profile) {
          setCurrentUserUsername(profile.username);
        }
      }
    };
    
    setupInitialData();

    if (route.params?.selectedConfessionId && !selectedLocation) {
      // If navigated from a comment notification, load the specific confession
      const { selectedConfessionId } = route.params;
      const fetchAndSetConfession = async () => {
        try {
          setLoading(true);
          const { data: confessionData, error } = await supabase
            .from('confessions')
            .select(`
              id,
              user_id,
              creator_id,
              location_id,
              location_name,
              content,
              media,
              is_anonymous,
              likes_count,
              comments_count,
              created_at,
              username,
              confession_likes!left(user_id),
              confession_comments(content)
            `)
            .eq('id', selectedConfessionId)
            .single();
          
          if (error) throw error;
          
          if (confessionData) {
            // We need to fetch the location details to set selectedLocation properly
            // This is crucial for the header and other components that rely on selectedLocation
            let locationDetails = null;
            if (confessionData.location_id) {
              const { data: placeData, error: placeError } = await supabase
                .from('places')
                .select('*')
                .eq('id', confessionData.location_id)
                .single();
              
              if (placeError && placeError.code !== 'PGRST116') {
                console.error('Error fetching place details for confession:', placeError);
              } else if (placeData) {
                locationDetails = {
                  place_id: placeData.id,
                  display_name: `${placeData.name}, ${placeData.city}${placeData.district ? ', ' + placeData.district : ''}, ${placeData.state}, ${placeData.country}`,
                  lat: placeData.latitude ? placeData.latitude.toString() : '0',
                  lon: placeData.longitude ? placeData.longitude.toString() : '0',
                  is_custom: true // Assuming custom places for now, can be refined if needed
                };
              }
            }
            
            // If location details are still null, use location_name from confession
            if (!locationDetails && confessionData.location_name) {
              locationDetails = {
                place_id: confessionData.location_name, // Using name as ID if actual ID not found
                display_name: confessionData.location_name,
                lat: userLocation?.coords.latitude.toString() || '0',
                lon: userLocation?.coords.longitude.toString() || '0',
                is_custom: false,
              };
            }
            
            if (locationDetails) {
              setSelectedLocation(locationDetails);
              // Load all confessions for this location (including the selected one)
              loadConfessions(locationDetails.display_name, true);
            } else {
              Alert.alert('Error', 'Could not retrieve location for the confession.');
            }
          }
        } catch (error) {
          console.error('Error fetching specific confession:', error);
          Alert.alert('Error', 'Failed to load specific confession.');
        } finally {
          setLoading(false);
        }
      };
      fetchAndSetConfession();
    }

    // Cleanup function for search timeout (runs on unmount)
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [route.params?.selectedConfessionId, selectedLocation, userLocation, setSearchResults, setSearchLoading, setSearchError, setLoading, setConfessions, loadReactionsAndVerifications, currentUser, currentUserUsername]); // Empty dependency array ensures this runs only once on mount

  const getProfilePrivacy = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('private_account')
        .eq('user_id', userId)
        .single();
      console.log('getProfilePrivacy data:', data, 'error:', error); // Added debug log
      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        throw error;
      }
      return data?.private_account || false;
    } catch (error) {
      console.error('Error fetching profile privacy:', error);
      return false; // Default to public if error
    }
  };

  const handleMentionPress = async (username) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();

      if (error || !profile) {
        Alert.alert('Error', `User @${username} not found.`);
        return;
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to view profiles.');
        return;
      }

      // If the mentioned user is the current user, navigate to their own profile
      if (currentUser.id === profile.id) {
        navigation.navigate('UserProfileScreen', { userId: currentUser.id });
        return;
      }

      const isPrivate = await getProfilePrivacy(profile.id);

      if (isPrivate) {
        const { data: followData, error: followError } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', currentUser.id)
          .eq('following_id', profile.id)
          .maybeSingle();

        if (followError) {
          console.error('Error checking follow status:', followError);
          throw followError;
        }

        if (!followData) {
          navigation.navigate('PrivateProfileScreen', { userId: profile.id });
          return;
        }
      }

      navigation.navigate('UserProfileScreen', { userId: profile.id });
    } catch (error) {
      console.error('Error navigating to mentioned user profile:', error);
      Alert.alert('Error', 'Could not open user profile.');
    }
  };

  const renderConfessionContentWithMentions = (content) => {
    if (!content) return null;

    const parts = [];
    let lastIndex = 0;
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;

    content.replace(mentionRegex, (match, username, offset) => {
      if (offset > lastIndex) {
        parts.push(<Text key={`text-${lastIndex}`} style={styles.confessionContent}>{content.substring(lastIndex, offset)}</Text>);
      }
      parts.push(
        <TouchableOpacity key={`mention-${offset}`} onPress={() => handleMentionPress(username)}>
          <Text style={styles.mentionText}>@{username}</Text>
        </TouchableOpacity>
      );
      lastIndex = offset + match.length;
      return match;
    });

    if (lastIndex < content.length) {
      parts.push(<Text key={`text-${lastIndex}`} style={styles.confessionContent}>{content.substring(lastIndex)}</Text>);
    }
    return <Text style={styles.confessionContent}>{parts}</Text>;
  };

  const getMapUrl = React.useCallback(({ mapRegion, selectedLocation, userLocation }) => {
    const lat = mapRegion.latitude;
    const lon = mapRegion.longitude;
    let url = `https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.05},${lat-0.05},${lon+0.05},${lat+0.05}&layer=mapnik`;
    
    if (selectedLocation) {
      url += `&marker=${selectedLocation.lat},${selectedLocation.lon}`;
    }
    if (userLocation) {
      url += `&marker=${userLocation.coords.latitude},${userLocation.coords.longitude}`;
    }
    return url;
  }, [mapRegion, selectedLocation, userLocation]); // Dependencies for useCallback

  const searchLocations = React.useCallback(async (query) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    
    setSearchLoading(true);
    setSearchError(null);
    try {
      let combinedResults = [];
      
      // Search OpenStreetMap API
      let searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10`;
      
      if (userLocation) {
        searchUrl += `&viewbox=${userLocation.coords.longitude-0.1},${userLocation.coords.latitude-0.1},${userLocation.coords.longitude+0.1},${userLocation.coords.latitude+0.1}`;
      }
      
      const response = await fetch(searchUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FlexxApp/1.0',
          'Accept-Language': 'en' // Request English language results
        }
      });
      
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      
      const osmData = await response.json();
      combinedResults = [...osmData];
      
      // Search custom places from Supabase
      const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length >= 2);
      let filterConditions = [];
      
      filterConditions.push(`name.ilike.%${query}%`);
      filterConditions.push(`city.ilike.%${query}%`);
      
      queryWords.forEach(word => {
        filterConditions.push(`name.ilike.%${word}%`);
        filterConditions.push(`city.ilike.%${word}%`);
        filterConditions.push(`district.ilike.%${word}%`);
        filterConditions.push(`state.ilike.%${word}%`);
        filterConditions.push(`country.ilike.%${word}%`);
      });
      
      const { data: placesData, error: placesError } = await supabase
        .from('places')
        .select('*')
        .or(filterConditions.join(','))
        .limit(20);
      
      if (placesError) {
        console.error('Error searching custom places:', placesError);
      } else if (placesData && placesData.length > 0) {
        const formattedPlaces = placesData.map(place => {
          const displayName = `${place.name}, ${place.city}${place.district ? ', ' + place.district : ''}, ${place.state}, ${place.country} (Custom)`;
          
          return {
            place_id: `custom_${place.id}`,
            display_name: displayName,
            lat: place.latitude ? place.latitude.toString() : '0',
            lon: place.longitude ? place.longitude.toString() : '0',
            is_custom: true
          };
        });
        
        combinedResults = [...combinedResults, ...formattedPlaces];
      }
      
      setSearchResults(combinedResults);
    } catch (error) {
      console.error('Error searching locations:', error);
      setSearchError(error.message);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [userLocation, setSearchResults, setSearchLoading, setSearchError]); // Dependencies for useCallback

  const handleAddPlace = async () => {
    if (!newPlace.name || !newPlace.city || !newPlace.state || !newPlace.country) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to add a place');
        return;
      }
      
      let latitude = null;
      let longitude = null;
      
      if (userLocation) {
        latitude = userLocation.coords.latitude;
        longitude = userLocation.coords.longitude;
      }
      
      const placeData = {
        type: newPlace.type,
        name: newPlace.name,
        city: newPlace.city,
        district: newPlace.district || null,
        state: newPlace.state,
        country: newPlace.country,
        latitude: latitude,
        longitude: longitude,
        created_at: new Date().toISOString(),
        created_by: user.id
      };
      
      const { data, error } = await supabase
        .from('places')
        .insert([placeData])
        .select()
        .single();

      if (error) throw error;

      setShowAddPlaceModal(false);
      setNewPlace({
        type: 'institute',
        name: '',
        city: '',
        state: '',
        country: ''
      });

      const newPlaceResult = {
        place_id: `custom_${data.id}`,
        display_name: `${data.name}, ${data.city}${data.district ? ', ' + data.district : ''}, ${data.state}, ${data.country} (Custom)`,
        lat: data.latitude ? data.latitude.toString() : (latitude ? latitude.toString() : '0'),
        lon: data.longitude ? data.longitude.toString() : (longitude ? longitude.toString() : '0'),
        is_custom: true
      };
      
      setSearchResults(prevResults => [...prevResults, newPlaceResult]);
      selectLocation(newPlaceResult);
      
      Alert.alert('Success', 'Place added successfully');
    } catch (error) {
      console.error('Error adding place:', error);
      Alert.alert('Error', 'Failed to add place. Please try again.');
    }
  };

  const selectLocation = React.useCallback((location) => {
    if (!location) {
      console.error('Error: Attempted to select undefined location');
      return;
    }
    
    setSelectedLocation(location);
    setSearchResults([]);
    
    if (location.lat && location.lon) {
      setMapRegion({
        latitude: parseFloat(location.lat),
        longitude: parseFloat(location.lon),
      });
    }
    
    if (!location.place_id) {
      console.error('Error: Selected location has no place_id');
      Alert.alert('Error', 'Invalid location data. Please try selecting a different location.');
      return;
    }
    
    let locationId = location.place_id;
    if (location.is_custom && typeof locationId === 'string' && locationId.startsWith('custom_')) {
      locationId = locationId.replace('custom_', '');
    }
    
    loadLocationProfile(locationId);
    loadConfessions(location.display_name, true); // Load confessions using location_name
  }, [setSearchResults, setSelectedLocation, setMapRegion, loadLocationProfile, loadConfessions]); // Dependencies for useCallback

  const loadLocationProfile = React.useCallback(async (locationId) => {
    try {
      const { data, error } = await supabase
        .from('location_profiles')
        .select('*')
        .eq('location_id', locationId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
        throw error;
      }
      
      setLocationProfile(data || null);
    } catch (error) {
      console.error('Error loading location profile:', error);
      setLocationProfile(null);
    }
  }, [setLocationProfile]); // Dependencies for useCallback

  const saveLocationProfile = async () => {
    if (!selectedLocation) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to update the profile');
        return;
      }

      let imageUrl = null;
      if (profileImage) {
        const uploadResult = await uploadToCloudinary(profileImage.uri, 'image');
        imageUrl = uploadResult.url;
      }

      let locationId = selectedLocation.place_id;
      if (selectedLocation.is_custom && typeof locationId === 'string' && locationId.startsWith('custom_')) {
        locationId = locationId.replace('custom_', '');
      }

      const profileData = {
        location_id: locationId,
        location_name: selectedLocation.display_name,
        profile_image: imageUrl || (locationProfile?.profile_image || null),
        bio: profileBio || (locationProfile?.bio || null),
        updated_at: new Date().toISOString(),
        created_by: user.id
      };

      const { error } = await supabase
        .from('location_profiles')
        .upsert([profileData], { onConflict: 'location_id' });

      if (error) throw error;

      loadLocationProfile(locationId);
      setShowLocationProfileModal(false);
      setProfileImage(null);
      setProfileBio('');
      
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error saving location profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  const loadConfessions = React.useCallback(async (locationIdentifier, useNameForConfessions = false) => {
    setLoading(true);
    try {
      if (!locationIdentifier) {
        Alert.alert('Error', 'Invalid location. Please select a location and try again.');
        setLoading(false);
        return;
      }
      
      let query = supabase
        .from('confessions')
        .select(`
          id,
          user_id,
          creator_id,
          location_id,
          location_name,
          content,
          media,
          is_anonymous,
          likes_count,
          comments_count,
          created_at,
          username,
          confession_likes!left(user_id),
          confession_comments(content)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (useNameForConfessions) {
        query = query.eq('location_name', locationIdentifier);
      } else {
        query = query.eq('location_id', locationIdentifier);
      }

      const { data: confessionsData, error: confessionsError } = await query;

      if (confessionsError) {
        console.error('Error fetching confessions:', confessionsError);
        throw confessionsError;
      }

      if (!confessionsData || confessionsData.length === 0) {
        setConfessions([]);
        return;
      }

      const processedConfessions = await Promise.all(confessionsData.map(async confession => {
        let processedMedia = confession.media;

        if (typeof confession.media === 'string') {
          try {
            processedMedia = JSON.parse(confession.media);
          } catch (e) {
            processedMedia = [];
          }
        }

        if (!processedMedia) {
          processedMedia = [];
        }

        const validatedMedia = Array.isArray(processedMedia) ?
          processedMedia.map(item => {
            if (item && typeof item === 'object' && item.url) {
              return item;
            }
            if (typeof item === 'string') {
              return { url: item, type: 'image' };
            }
            return null;
          }).filter(Boolean) : [];

        let userProfile = null;
        if (!confession.is_anonymous && confession.user_id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username, full_name, avatar_url')
            .eq('id', confession.user_id)
            .single();

          if (profileData) {
            userProfile = {
              username: profileData.username || profileData.full_name,
              avatar_url: profileData.avatar_url
            };
          }
        }

        return {
          ...confession,
          media: validatedMedia,
          ...(userProfile && { username: userProfile.username, avatar_url: userProfile.avatar_url }),
          is_liked: !!confession.confession_likes.find(like => like.user_id === currentUser?.id),
          is_tagged_in_content: currentUserUsername && confession.content.includes(`@${currentUserUsername}`),
          is_tagged_in_comment: currentUserUsername && confession.confession_comments.some(comment => comment.content.includes(`@${currentUserUsername}`)),
        };
      }));

      setConfessions(processedConfessions);
      
      // Load reactions and verifications
      await loadReactionsAndVerifications(processedConfessions.map(c => c.id));
      
      // If a specific confession was requested, scroll to it
      if (route.params?.selectedConfessionId) {
        const index = processedConfessions.findIndex(c => c.id === route.params.selectedConfessionId);
        if (index !== -1 && confessionsListRef.current) {
          // Use a timeout to ensure FlatList has rendered its items
          setTimeout(() => {
            confessionsListRef.current.scrollToIndex({ animated: true, index, viewPosition: 0.5 });
            // Clear the param after scrolling to prevent re-scrolling on future renders
            navigation.setParams({ selectedConfessionId: undefined }); 
          }, 500); // Adjust delay as needed
        }
      }
    } catch (error) {
      console.error('Error loading confessions:', error);
      Alert.alert('Error', 'Failed to load confessions. Please try again.');
      setConfessions([]);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setConfessions, loadReactionsAndVerifications, currentUser, currentUserUsername, route.params?.selectedConfessionId, navigation]); // Added currentUserUsername to dependencies

  const loadReactionsAndVerifications = async (confessionIds) => {
    try {
      // Load reactions
      const { data: reactionsData, error: reactionsError } = await supabase
        .from('confession_reactions')
        .select('*')
        .in('confession_id', confessionIds);

      if (reactionsError) throw reactionsError;

      const reactionsMap = {};
      reactionsData?.forEach(reaction => {
        if (!reactionsMap[reaction.confession_id]) {
          reactionsMap[reaction.confession_id] = [];
        }
        reactionsMap[reaction.confession_id].push(reaction);
      });
      setConfessionReactions(reactionsMap);

      // Load verifications
      const { data: verificationsData, error: verificationsError } = await supabase
        .from('confession_verifications')
        .select('*')
        .in('confession_id', confessionIds);

      if (verificationsError) throw verificationsError;

      const verificationsMap = {};
      verificationsData?.forEach(verification => {
        if (!verificationsMap[verification.confession_id]) {
          verificationsMap[verification.confession_id] = { correct: 0, incorrect: 0, userVote: null };
        }
        if (verification.is_correct) {
          verificationsMap[verification.confession_id].correct++;
        } else {
          verificationsMap[verification.confession_id].incorrect++;
        }
        if (verification.user_id === currentUser?.id) {
          verificationsMap[verification.confession_id].userVote = verification.is_correct;
        }
      });
      setConfessionVerifications(verificationsMap);
    } catch (error) {
      console.error('Error loading reactions and verifications:', error);
    }
  };

  const handleReaction = async (confessionId, emoji) => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to react');
      return;
    }

    try {
      const { error } = await supabase
        .from('confession_reactions')
        .upsert([{
          confession_id: confessionId,
          user_id: currentUser.id,
          emoji: emoji
        }], { onConflict: 'confession_id,user_id' });

      if (error) throw error;

      // Reload reactions
      await loadReactionsAndVerifications([confessionId]);
      setShowReactionModal(false);
      setSelectedConfessionForReaction(null);
    } catch (error) {
      console.error('Error adding reaction:', error);
      Alert.alert('Error', 'Failed to add reaction. Please try again.');
    }
  };

  const handleVerification = async (confessionId, isCorrect) => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to verify');
      return;
    }

    try {
      const { error } = await supabase
        .from('confession_verifications')
        .upsert([{
          confession_id: confessionId,
          user_id: currentUser.id,
          is_correct: isCorrect
        }], { onConflict: 'confession_id,user_id' });

      if (error) throw error;

      // Directly update local state for immediate UI feedback
      setConfessionVerifications(prevVerifications => {
        const currentVerifications = prevVerifications[confessionId] || { correct: 0, incorrect: 0, userVote: null };
        let newCorrect = currentVerifications.correct;
        let newIncorrect = currentVerifications.incorrect;

        // Adjust counts based on previous vote
        if (currentVerifications.userVote === true) {
          newCorrect--;
        } else if (currentVerifications.userVote === false) {
          newIncorrect--;
        }

        // Adjust counts based on new vote
        if (isCorrect) {
          newCorrect++;
        } else {
          newIncorrect++;
        }

        return {
          ...prevVerifications,
          [confessionId]: {
            correct: newCorrect,
            incorrect: newIncorrect,
            userVote: isCorrect,
          },
        };
      });

      // Removed: await loadReactionsAndVerifications([confessionId]); (no longer needed for immediate update)
    } catch (error) {
      console.error('Error adding verification:', error);
      Alert.alert('Error', 'Failed to add verification. Please try again.');
    }
  };

  const handleLike = async (confessionId) => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to like a confession');
      return;
    }

    try {
      // Check if already liked
      const { data: existingLike, error: fetchError } = await supabase
        .from('confession_likes')
        .select('id')
        .eq('confession_id', confessionId)
        .eq('user_id', currentUser.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError; // Rethrow if it's an actual error, not just no rows found
      }

      if (existingLike) {
        // Unlike
        const { error: deleteError } = await supabase
          .from('confession_likes')
          .delete()
          .eq('id', existingLike.id);

        if (deleteError) throw deleteError;

        // Update local state
        setConfessions(prevConfessions => prevConfessions.map(conf => 
          conf.id === confessionId 
            ? { ...conf, is_liked: false, likes_count: (conf.likes_count || 0) - 1 } 
            : conf
        ));
      } else {
        // Like
        const { error: insertError } = await supabase
          .from('confession_likes')
          .insert([{
            confession_id: confessionId,
            user_id: currentUser.id,
          }]);

        if (insertError) throw insertError;

        // Update local state
        setConfessions(prevConfessions => prevConfessions.map(conf => 
          conf.id === confessionId 
            ? { ...conf, is_liked: true, likes_count: (conf.likes_count || 0) + 1 } 
            : conf
        ));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like. Please try again.');
    }
  };

  const handleCommentPress = (confessionId) => {
    setSelectedConfessionForReaction(confessionId); // Set the confession ID for the comment modal
    setShowCommentModal(true); // Show the comment modal
  };

  const pickImage = async (isProfile = false) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        
        if (isProfile) {
          setProfileImage({ 
            uri: asset.uri,
            type: 'image/jpeg',
            name: `profile_${Math.random().toString(36).substring(2)}.jpg`
          });
        } else {
          setMedia([...media, { 
            uri: asset.uri,
            type: 'image',
            name: `${Math.random().toString(36).substring(2)}.jpg`
          }]);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const postConfession = async () => {
    if (!newConfession.trim() && media.length === 0) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to post a confession');
        return;
      }
      
      const mediaUrls = [];
      for (const item of media) {
        if (item.uri) {
          try {
            const uploadResult = await uploadToCloudinary(item.uri, 'image');
            
            if (!uploadResult || !uploadResult.url) {
              throw new Error('Failed to upload media');
            }
            
            mediaUrls.push({
              url: uploadResult.url,
              type: 'image',
              publicId: uploadResult.publicId
            });
          } catch (mediaError) {
            console.error('Media upload error:', mediaError);
            throw new Error('Failed to upload media: ' + (mediaError.message || 'Unknown error'));
          }
        }
      }
      
      const confessionData = {
        user_id: remainAnonymous ? null : user.id,
        creator_id: user.id,
        location_id: selectedLocation.place_id,
        location_name: selectedLocation.display_name,
        content: newConfession.trim(),
        media: mediaUrls,
        is_anonymous: remainAnonymous,
        created_at: new Date().toISOString()
      };

      const { error: confessionError } = await supabase
        .from('confessions')
        .insert([confessionData]);
        
      if (confessionError) throw confessionError;
      
      setNewConfession('');
      setMedia([]);
      setShowNewConfessionModal(false);
      // After posting, reload confessions for the selected location by its display name
      if (selectedLocation?.display_name) {
        loadConfessions(selectedLocation.display_name, true);
      } else if (selectedLocation?.place_id) {
        // Fallback to place_id if display_name is not available (though it should be for selectedLocation)
        loadConfessions(selectedLocation.place_id);
      }
      
    } catch (error) {
      console.error('Error posting confession:', error);
      Alert.alert('Error', error.message || 'Failed to post confession. Please try again.');
    }
  };

  const deleteConfession = async (confessionId) => {
    try {
      const { data: confessionData, error: fetchError } = await supabase
        .from('confessions')
        .select('media')
        .eq('id', confessionId)
        .single();
      
      if (fetchError) throw fetchError;
      
      if (confessionData?.media && Array.isArray(confessionData.media)) {
        for (const mediaItem of confessionData.media) {
          if (mediaItem.publicId) {
            try {
              await deleteFromCloudinary(mediaItem.publicId, 'image');
            } catch (mediaError) {
              console.error('Error deleting media from Cloudinary:', mediaError);
            }
          }
        }
      }
      
      const { error } = await supabase
        .from('confessions')
        .delete()
        .eq('id', confessionId);

      if (error) throw error;
      
      // Use display_name for reloading confessions after deletion
      if (selectedLocation?.display_name) {
        loadConfessions(selectedLocation.display_name, true);
      } else if (selectedLocation?.place_id) {
        loadConfessions(selectedLocation.place_id); // Fallback to ID if display_name is not available
      }
    } catch (error) {
      console.error('Error deleting confession:', error);
      Alert.alert('Error', 'Failed to delete confession. Please try again.');
    }
  };

  const refreshConfessions = () => {
    if (selectedLocation) {
      if (selectedLocation.display_name) {
        loadConfessions(selectedLocation.display_name, true); // Refresh by name
      } else if (selectedLocation.place_id) {
        loadConfessions(selectedLocation.place_id); // Fallback to ID
      }
    }
  };

  // Memoized renderLocationProfile function
  const renderLocationProfile = React.useCallback(() => {
    if (!selectedLocation) return null;

    return (
      <View style={styles.locationProfileContainer}>
        <View style={styles.locationProfileHeader}>
          <TouchableOpacity onPress={() => setShowLocationProfileModal(true)}>
            <Image 
              source={{ 
                uri: locationProfile?.profile_image || 'https://via.placeholder.com/80x80?text=Add+Photo'
              }}
              style={styles.locationProfileImage}
            />
          </TouchableOpacity>
          <View style={styles.locationProfileInfo}>
            <Text style={styles.locationProfileName} numberOfLines={2}>
              {selectedLocation.display_name}
            </Text>
            <Text style={styles.locationProfileBio} numberOfLines={3}>
              {locationProfile?.bio || 'No description yet. Tap to add one!'}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.editProfileButton}
            onPress={() => {
              setProfileBio(locationProfile?.bio || '');
              setShowLocationProfileModal(true);
            }}
          >
            <Ionicons name="create-outline" size={20} color="#ff00ff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [selectedLocation, locationProfile, setProfileBio, setShowLocationProfileModal]); // Dependencies for useCallback

  const renderConfessionItem = ({ item }) => {
    const isCurrentUserConfession = currentUser && (
      (item.user_id === currentUser.id) || 
      (item.is_anonymous && item.creator_id === currentUser.id)
    );
    
    const formattedDate = item.created_at 
      ? new Date(item.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) + ' at ' + new Date(item.created_at).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        })
      : '';

    const reactions = confessionReactions[item.id] || [];
    const verifications = confessionVerifications[item.id] || { correct: 0, incorrect: 0, userVote: null };
    
    return (
      <TouchableOpacity 
        style={styles.confessionCard}
        onLongPress={() => {
          setSelectedConfessionForReaction(item.id);
          setShowReactionModal(true);
        }}
        delayLongPress={500}
      >
        <View style={styles.confessionHeader}>
          <Image 
            source={{ uri: item.is_anonymous 
              ? 'https://via.placeholder.com/40x40?text=Anon' 
              : (item.avatar_url || 'https://via.placeholder.com/40x40?text=User') 
            }}
            style={styles.avatar}
          />
          <View style={styles.userInfoContainer}>
            <TouchableOpacity 
              onPress={() => {
                if (!item.is_anonymous && item.user_id) {
                  navigation.navigate('UserProfileScreen', { userId: item.user_id });
                }
              }}
            >
              <Text style={[styles.username, { color: '#ff00ff' }]}>
                {item.is_anonymous ? 'Anonymous' : (item.username || 'User')}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.dateAndTagContainer}>
            <Text style={styles.dateText}>{formattedDate}</Text>
            {item.is_tagged_in_content && (
              <View style={styles.taggedBadge}>
                <Ionicons name="pricetag" size={12} color="#fff" />
                <Text style={styles.taggedText}>Tagged you</Text>
              </View>
            )}
          </View>
          {isCurrentUserConfession && (
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => {
                Alert.alert(
                  'Confession Options',
                  'What would you like to do?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Delete', 
                      onPress: () => {
                        Alert.alert(
                          'Delete Confession',
                          'Are you sure you want to delete this confession?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { 
                              text: 'Delete', 
                              onPress: () => deleteConfession(item.id),
                              style: 'destructive' 
                            }
                          ]
                        );
                      },
                      style: 'destructive'
                    }
                  ]
                );
              }}
            >
              <Ionicons name="ellipsis-vertical" size={20} color="#ff00ff" />
            </TouchableOpacity>
          )}
        </View>
        
        <Text style={styles.confessionContent}>{renderConfessionContentWithMentions(item.content)}</Text>
        
        {item.media && item.media.length > 0 && (
          <ScrollView horizontal style={styles.mediaContainer} showsHorizontalScrollIndicator={false}>
            {item.media.map((mediaItem, index) => (
              <View key={index} style={styles.mediaItemContainer}>
                <Image 
                  source={{ uri: mediaItem.url }}
                  style={styles.mediaItem}
                  resizeMode="cover"
                />
                {mediaItem.type === 'video' && (
                  <TouchableOpacity style={styles.playButton}>
                    <LinearGradient
                      colors={['#FF00FF', '#8A2387']}
                      style={styles.gradientButton}
                    >
                      <Ionicons name="play-circle" size={40} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                )}
                {mediaItem.type === 'video' ? (
                  <View style={[styles.mediaBadge, styles.videoBadge]}>
                    <Ionicons name="videocam" size={16} color="#fff" />
                    <Text style={styles.mediaBadgeText}>Video</Text>
                  </View>
                ) : (
                  <View style={[styles.mediaBadge, styles.imageBadge]}>
                    <Ionicons name="image" size={16} color="#fff" />
                    <Text style={styles.mediaBadgeText}>Image</Text>
                  </View>
                )}
                {mediaItem.loading && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.loadingText}>Loading...</Text>
                  </View>
                )}
              </View>
            ))}          
          </ScrollView>
        )}

        {/* Reactions Display */}
        {reactions.length > 0 && (
          <View style={styles.reactionsDisplay}>
            {reactions.slice(0, 5).map((reaction, index) => (
              <View key={index} style={styles.reactionItem}>
                <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              </View>
            ))}
            {reactions.length > 5 && (
              <Text style={styles.moreReactions}>+{reactions.length - 5}</Text>
            )}
          </View>
        )}
        
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item.id)}>
            <LinearGradient colors={item.is_liked ? ['#ff00ff', '#9900ff'] : ['transparent', 'transparent']} style={item.is_liked ? styles.likedIconBackground : {}}>
              <Ionicons name={item.is_liked ? 'heart' : 'heart-outline'} size={24} color={item.is_liked ? '#fff' : '#ff00ff'} />
            </LinearGradient>
            <Text style={[styles.actionText, item.is_liked && styles.likedText]}>{item.likes_count || 0}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleCommentPress(item.id)}
          >
            <Ionicons name="chatbubble-outline" size={24} color="#e0e0ff" />
            <Text style={styles.actionText}>
              {item.comments_count}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share-social-outline" size={24} color="#e0e0ff" />
          </TouchableOpacity>

          {/* Verification Buttons */}
          <View style={styles.verificationContainer}>
            <TouchableOpacity 
              style={[
                styles.verificationButton, 
                verifications.userVote === true && styles.verificationButtonActive
              ]}
              onPress={() => handleVerification(item.id, true)}
            >
              <Ionicons 
                name="checkmark-circle" 
                size={20} 
                color={verifications.userVote === true ? "#fff" : "#00ff00"} 
              />
              <Text style={[
                styles.verificationText,
                verifications.userVote === true && styles.verificationTextActive
              ]}>
                {verifications.correct}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.verificationButton, 
                verifications.userVote === false && styles.verificationButtonActive
              ]}
              onPress={() => handleVerification(item.id, false)}
            >
              <Ionicons 
                name="close-circle" 
                size={20} 
                color={verifications.userVote === false ? "#fff" : "#ff0000"} 
              />
              <Text style={[
                styles.verificationText,
                verifications.userVote === false && styles.verificationTextActive
              ]}>
                {verifications.incorrect}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {item.is_tagged_in_comment && (
          <View style={styles.taggedInCommentContainer}>
            <Ionicons name="at" size={14} color="#ff9900" />
            <Text style={styles.taggedInCommentTextBelow}>Tagged you in comment</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }; // Dependencies for useCallback

  const goToUserLocation = React.useCallback(() => {
    if (userLocation) {
      setMapRegion({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
      });
    }
  }, [userLocation, setMapRegion]); // Dependencies for useCallback

  const setShowMapCallback = React.useCallback((value) => {
    setShowMap(value);
  }, [setShowMap]); // Dependencies for useCallback

  const setShowAddPlaceModalCallback = React.useCallback((value) => {
    setShowAddPlaceModal(value);
  }, [setShowAddPlaceModal]); // Dependencies for useCallback

  return (
    <View style={styles.container}>
      <FlatList
        data={confessions}
        keyExtractor={(item) => item.id.toString()}
        ref={confessionsListRef} // Attach ref to FlatList
        renderItem={renderConfessionItem}
        ListHeaderComponent={
          <ConfessionsHeader
            navigation={navigation}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchTimeoutRef={searchTimeoutRef}
            searchLocations={searchLocations}
            searchResults={searchResults}
            selectLocation={selectLocation}
            searchLoading={searchLoading}
            showMap={showMap}
            setShowMap={setShowMapCallback}
            goToUserLocation={goToUserLocation}
            selectedLocation={selectedLocation}
            renderLocationProfile={renderLocationProfile}
            setShowAddPlaceModal={setShowAddPlaceModalCallback}
            searchError={searchError}
            loading={loading}
            userLocation={userLocation}
          />
        }
        contentContainerStyle={styles.confessionsList}
        refreshing={loading} // Use 'loading' for confessions loading
        onRefresh={refreshConfessions}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          !selectedLocation ? (
            <View style={styles.instructionContainer}>
              <Ionicons name="search" size={60} color="#ff00ff" />
              <Text style={styles.instructionText}>
                Search for a place/Person or select a location on the map to see confessions
              </Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={60} color="#ff00ff" />
              <Text style={styles.emptyText}>No confessions yet. Be the first to share!</Text>
            </View>
          )
        )}
      />
      
      {selectedLocation && (
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowNewConfessionModal(true)}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Add Place Modal */}
      <Modal
        visible={showAddPlaceModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddPlaceModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingContainer} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Place</Text>
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollViewContent}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Type</Text>
                <View style={styles.typeSelector}>
                  {['institute', 'office', 'place', 'building'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typeButton, newPlace.type === type && styles.selectedType]}
                      onPress={() => setNewPlace(prev => ({ ...prev, type }))}
                    >
                      <Text style={[styles.typeText, newPlace.type === type && styles.selectedTypeText]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={newPlace.name}
                  onChangeText={(text) => setNewPlace(prev => ({ ...prev, name: text }))}
                  placeholder="Enter place name"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  style={styles.input}
                  value={newPlace.city}
                  onChangeText={(text) => setNewPlace(prev => ({ ...prev, city: text }))}
                  placeholder="Enter city"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>District</Text>
                <TextInput
                  style={styles.input}
                  value={newPlace.district}
                  onChangeText={(text) => setNewPlace(prev => ({ ...prev, district: text }))}
                  placeholder="Enter district"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>State</Text>
                <TextInput
                  style={styles.input}
                  value={newPlace.state}
                  onChangeText={(text) => setNewPlace(prev => ({ ...prev, state: text }))}
                  placeholder="Enter state"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Country</Text>
                <TextInput
                  style={styles.input}
                  value={newPlace.country}
                  onChangeText={(text) => setNewPlace(prev => ({ ...prev, country: text }))}
                  placeholder="Enter country"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowAddPlaceModal(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.submitButton]}
                  onPress={handleAddPlace}
                >
                  <Text style={styles.buttonText}>Add Place</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Location Profile Modal */}
      <Modal
        visible={showLocationProfileModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLocationProfileModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Location Profile</Text>
              <TouchableOpacity onPress={() => setShowLocationProfileModal(false)}>
                <Ionicons name="close" size={24} color="#ff00ff" />
              </TouchableOpacity>
            </View>

            <View style={styles.profileImageSection}>
              <TouchableOpacity 
                style={styles.profileImageContainer}
                onPress={() => pickImage(true)}
              >
                <Image 
                  source={{ 
                    uri: profileImage?.uri || locationProfile?.profile_image || 'https://via.placeholder.com/120x120?text=Add+Photo'
                  }}
                  style={styles.profileImagePreview}
                />
                <View style={styles.profileImageOverlay}>
                  <Ionicons name="camera" size={30} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Bio/Description</Text>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={profileBio}
                onChangeText={setProfileBio}
                placeholder="Tell others about this place..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
              />
            </View>

            <TouchableOpacity 
              style={styles.saveProfileButton}
              onPress={saveLocationProfile}
            >
              <Text style={styles.saveProfileButtonText}>Save Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* New Confession Modal */}
      <Modal
        visible={showNewConfessionModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNewConfessionModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Confession</Text>
              <TouchableOpacity onPress={() => setShowNewConfessionModal(false)}>
                <Ionicons name="close" size={24} color="#ff00ff" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.confessionInput}
              placeholder="What's your confession about this place?"
              placeholderTextColor="#999"
              multiline
              value={newConfession}
              onChangeText={setNewConfession}
            />
            
            {media.length > 0 && (
              <ScrollView horizontal style={styles.selectedMediaContainer} showsHorizontalScrollIndicator={false}>
                {media.map((item, index) => (
                  <View key={index} style={styles.selectedMediaItem}>
                    <Image source={{ uri: item.uri }} style={styles.selectedMediaPreview} />
                    <TouchableOpacity 
                      style={styles.removeMediaButton}
                      onPress={() => setMedia(media.filter((_, i) => i !== index))}
                    >
                      <Ionicons name="close-circle" size={20} color="#ff00ff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            
            <View style={styles.mediaButtons}>
              <TouchableOpacity style={styles.mediaButton} onPress={() => pickImage(false)}>
                <Ionicons name="image" size={24} color="#ff00ff" />
                <Text style={styles.mediaButtonText}>Add Image</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.anonymousOption}>
              <Text style={styles.anonymousText}>Remain anonymous</Text>
              <Switch
                value={remainAnonymous}
                onValueChange={setRemainAnonymous}
                trackColor={{ false: "#767577", true: "#ff00ff" }}
                thumbColor={remainAnonymous ? "#f4f3f4" : "#f4f3f4"}
              />
            </View>
            
            <TouchableOpacity 
              style={styles.postButton}
              onPress={postConfession}
            >
              <Text style={styles.postButtonText}>Post Confession</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reaction Modal */}
      <Modal
        visible={showReactionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReactionModal(false)}
      >
        <TouchableOpacity 
          style={styles.reactionModalContainer}
          activeOpacity={1}
          onPress={() => setShowReactionModal(false)}
        >
          <View style={styles.reactionModalContent}>
            <Text style={styles.reactionModalTitle}>Choose a reaction</Text>
            <View style={styles.emojiContainer}>
              {emojiOptions.map((emoji, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.emojiButton}
                  onPress={() => handleReaction(selectedConfessionForReaction, emoji)}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
      <Modal
        visible={showCommentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCommentModal(false)}
      >
        <ConfessionCommentScreen
          visible={showCommentModal}
          onClose={() => setShowCommentModal(false)}
          confessionId={selectedConfessionForReaction}
          onCommentPosted={refreshConfessions} // Refresh confessions when a comment is posted
        />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a2a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 15,
    paddingBottom: 15,
    backgroundColor: '#0a0a2a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 0, 255, 0.2)',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 15,
    textShadowColor: 'rgba(255, 0, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#1a1a3a',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 255, 255, 0.2)',
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 25,
    paddingHorizontal: 18,
    paddingVertical: 12,
    color: '#fff',
    marginRight: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  mapButton: {
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
  },
  searchResultsList: {
    backgroundColor: '#1a1a3a',
    maxHeight: 200,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0, 255, 255, 0.1)',
    backgroundColor: '#2a0a3a',
  },
  searchResultText: {
    color: '#e0e0ff',
    marginLeft: 10,
    flex: 1,
    fontSize: 15,
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#1a1a3a',
    borderRadius: 15,
    marginHorizontal: 15,
    marginTop: 10,
  },
  noResultsText: {
    color: '#e0e0ff',
    marginBottom: 15,
    fontSize: 16,
    textAlign: 'center',
  },
  addPlaceButton: {
    backgroundColor: '#00ffff',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
  },
  addPlaceButtonText: {
    color: '#0a0a2a',
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorContainer: {
    padding: 15,
    backgroundColor: '#ff3333',
    borderRadius: 10,
    marginHorizontal: 15,
    marginTop: 10,
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  mapContainer: {
    height: 300,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    gap: 10,
  },
  closeMapButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 5,
  },
  locationButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  locationProfileContainer: {
    backgroundColor: '#1a1a3a',
    padding: 20,
    margin: 15,
    borderRadius: 15,
    shadowColor: "#9900ff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.3)',
  },
  locationProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationProfileImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginRight: 15,
    borderWidth: 3,
    borderColor: '#ff00ff',
  },
  locationProfileInfo: {
    flex: 1,
    marginRight: 10,
  },
  locationProfileName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    textShadowColor: 'rgba(255, 0, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  locationProfileBio: {
    color: '#e0e0ff',
    fontSize: 14,
    lineHeight: 20,
  },
  editProfileButton: {
    padding: 10,
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    borderRadius: 25,
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confessionsList: {
    padding: 10,
  },
  confessionCard: {
    backgroundColor: '#330022',
    borderRadius: 15,
    padding: 18,
    marginBottom: 18,
    shadowColor: "#9900ff",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.4)',
  },
  confessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  userInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  username: {
    color: '#ff00ff',
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 2,
    textShadowColor: 'rgba(255, 0, 255, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  dateAndTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    color: '#b0b0ff',
    fontSize: 11,
    marginRight: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 3,
  },
  taggedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00ffff',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginLeft: 10,
  },
  taggedText: {
    color: '#0a0a2a',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  menuButton: {
    padding: 8,
    borderRadius: 15,
  },
  confessionContent: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
    lineHeight: 22,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
  mediaContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  mediaItemContainer: {
    position: 'relative',
    width: 150,
    height: 150,
    borderRadius: 10,
    marginRight: 10,
    overflow: 'hidden',
  },
  mediaItem: {
    width: '100%',
    height: '100%',
  },
  playButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
  },
  gradientButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF00FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
  },
  reactionsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  reactionItem: {
    marginRight: 5,
  },
  reactionEmoji: {
    fontSize: 18,
  },
  moreReactions: {
    color: '#999',
    fontSize: 12,
    marginLeft: 5,
  },
  actionBar: {
    flexDirection: 'row',
    flexWrap: 'wrap', // Allow items to wrap to the next line
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 0, 255, 0.4)',
    paddingTop: 15,
    paddingHorizontal: 5,
    justifyContent: 'space-around', // Distribute items evenly
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    // Removed marginRight to allow flexbox to handle spacing
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  actionText: {
    color: '#ff00ff',
    marginLeft: 5,
  },
  taggedInCommentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff9900',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginLeft: 10,
  },
  taggedInCommentText: {
    color: '#0a0a2a',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  taggedInCommentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 5,
  },
  taggedInCommentTextBelow: {
    color: '#ff9900',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  likedText: {
    color: '#ff00ff',
  },
  likedIconBackground: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 0, 255, 0.3)',
  },
  verificationContainer: {
    flexDirection: 'row',
    marginLeft: 'auto',
    alignItems: 'center',
  },
  verificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a3a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  verificationButtonActive: {
    backgroundColor: '#00ffff',
    borderColor: '#00ffff',
  },
  verificationText: {
    color: '#ccc',
    marginLeft: 4,
    fontSize: 12,
    fontWeight: 'bold',
  },
  verificationTextActive: {
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#ff00ff',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 16,
  },
  instructionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionText: {
    color: '#ff00ff',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 16,
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#ff00ff',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a001a',
    borderRadius: 20,
    padding: 25,
    width: '95%',
    maxHeight: '85%',
    shadowColor: "#ff00ff",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.6)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 0, 255, 0.3)',
  },
  modalTitle: {
    color: '#00ffff',
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 255, 255, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#e0e0ff',
    fontSize: 18,
    marginBottom: 8,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  input: {
    backgroundColor: '#2a0a3a',
    borderRadius: 12,
    color: '#fff',
    fontSize: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.3)',
    shadowColor: "#9900ff",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  bioInput: {
    height: 120,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    backgroundColor: '#2a0a3a',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
    shadowColor: "#00ffff",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  selectedType: {
    backgroundColor: '#00ffff',
    borderColor: '#00ffff',
    shadowColor: '#00ffff',
  },
  typeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  selectedTypeText: {
    color: '#1a0a2a',
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 30,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  cancelButton: {
    backgroundColor: '#663366',
    borderColor: 'rgba(255, 0, 255, 0.4)',
    borderWidth: 1,
  },
  submitButton: {
    backgroundColor: '#00ffff',
    borderColor: '#00ffff',
    borderWidth: 1,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  profileImageSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileImageContainer: {
    position: 'relative',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: '#ff00ff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 12,
  },
  profileImagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 65,
  },
  profileImageOverlay: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0, 255, 255, 0.8)',
    borderRadius: 25,
    padding: 10,
    borderWidth: 2,
    borderColor: '#fff',
  },
  saveProfileButton: {
    backgroundColor: '#ff00ff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 12,
  },
  saveProfileButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  confessionInput: {
    backgroundColor: '#2a0a3a',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.3)',
    shadowColor: "#9900ff",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  selectedMediaContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    paddingVertical: 5,
  },
  selectedMediaItem: {
    position: 'relative',
    marginRight: 15,
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 255, 0.4)',
    borderRadius: 10,
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 8,
  },
  selectedMediaPreview: {
    width: 90,
    height: 90,
    borderRadius: 8,
  },
  removeMediaButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ff00ff',
    borderRadius: 15,
    padding: 3,
    borderWidth: 2,
    borderColor: '#fff',
  },
  mediaButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 25,
  },
  mediaButton: {
    backgroundColor: '#2a0a3a',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: "#00ffff",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  mediaButtonText: {
    color: '#00ffff',
    marginLeft: 10,
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  anonymousOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
    paddingHorizontal: 5,
  },
  anonymousText: {
    color: '#e0e0ff',
    fontSize: 16,
    fontWeight: '500',
  },
  postButton: {
    backgroundColor: '#ff00ff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 12,
  },
  postButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  reactionModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionModalContent: {
    backgroundColor: '#1a0a2a',
    borderRadius: 25,
    padding: 30,
    alignItems: 'center',
    minWidth: 320,
    shadowColor: "#ff00ff",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 15,
    elevation: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.7)',
  },
  reactionModalTitle: {
    color: '#00ffff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 25,
    textShadowColor: 'rgba(0, 255, 255, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  emojiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
  },
  emojiButton: {
    backgroundColor: '#2a0a3a',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#ff00ff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  emoji: {
    fontSize: 30,
  },
  mediaBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  videoBadge: {
    backgroundColor: 'rgba(255, 0, 255, 0.8)', // Pink/Purple gradient start
  },
  imageBadge: {
    backgroundColor: 'rgba(0, 255, 255, 0.8)', // Teal
  },
  mediaBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    zIndex: 2,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  searchOverlayLoading: {
    position: 'absolute',
    top: 150,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26, 26, 58, 0.8)',
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: 15,
    zIndex: 10,
    shadowColor: "#00ffff",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  searchOverlayLoadingText: {
    color: '#00ffff',
    marginTop: 5,
    fontSize: 14,
    fontWeight: 'bold',
  },
  keyboardAvoidingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollViewContent: {
    padding: 20,
  },
  mentionText: {
    color: '#00ffff',
    fontWeight: 'bold',
  },
});

export default ConfessionScreen;