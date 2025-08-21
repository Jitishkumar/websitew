import React, { useState, useEffect } from 'react';
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
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../config/supabase';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';

const { width: screenWidth } = Dimensions.get('window');

const ConfessionScreen = () => {
  const navigation = useNavigation();
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

  // Emoji options for reactions
  const emojiOptions = ['😂', '❤️', '😮', '😢', '😡', '👍', '👎', '🔥', '💯', '🤔'];

  // Add a reference to store the search timeout
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [showAddPlaceModal, setShowAddPlaceModal] = useState(false);
  const [newPlace, setNewPlace] = useState({
    type: 'institute',
    name: '',
    city: '',
    district: '',
    state: '',
    country: ''
  });

  // Request location permission and get current location
  useEffect(() => {
    (async () => {
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
    })();
    
    // Get current user
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getCurrentUser();
    
    // Cleanup function
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  const getMapUrl = () => {
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
  };

  const searchLocations = async (query) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    
    setLoading(true);
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
          'User-Agent': 'FlexxApp/1.0'
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
      setLoading(false);
    }
  };

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

  const selectLocation = (location) => {
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
    loadConfessions(locationId);
  };

  const loadLocationProfile = async (locationId) => {
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
  };

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

  const loadConfessions = async (locationId) => {
    setLoading(true);
    try {
      if (!locationId) {
        Alert.alert('Error', 'Invalid location. Please select a location and try again.');
        setLoading(false);
        return;
      }
      
      const cleanLocationId = typeof locationId === 'string' && locationId.startsWith('custom_') ? 
        locationId.replace('custom_', '') : locationId;

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
          username
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      query = query.or(`location_id.eq.${locationId},location_id.eq.${cleanLocationId}`);
      
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
          ...(userProfile && { username: userProfile.username, avatar_url: userProfile.avatar_url })
        };
      }));

      setConfessions(processedConfessions);
      
      // Load reactions and verifications
      await loadReactionsAndVerifications(processedConfessions.map(c => c.id));
    } catch (error) {
      console.error('Error loading confessions:', error);
      Alert.alert('Error', 'Failed to load confessions. Please try again.');
      setConfessions([]);
    } finally {
      setLoading(false);
    }
  };

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

      // Reload verifications
      await loadReactionsAndVerifications([confessionId]);
    } catch (error) {
      console.error('Error adding verification:', error);
      Alert.alert('Error', 'Failed to add verification. Please try again.');
    }
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
            type: 'image/jpeg',
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
      loadConfessions(selectedLocation.place_id);
      
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
      
      loadConfessions(selectedLocation.place_id);
    } catch (error) {
      console.error('Error deleting confession:', error);
      Alert.alert('Error', 'Failed to delete confession. Please try again.');
    }
  };

  const refreshConfessions = () => {
    if (selectedLocation && selectedLocation.place_id) {
      let locationId = selectedLocation.place_id;
      if (selectedLocation.is_custom && typeof locationId === 'string' && locationId.startsWith('custom_')) {
        locationId = locationId.replace('custom_', '');
      }
      loadConfessions(locationId);
    }
  };

  const renderLocationProfile = () => {
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
  };

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
          <Text style={styles.dateText}>{formattedDate}</Text>
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
        
        <Text style={styles.confessionContent}>{item.content}</Text>
        
        {item.media && item.media.length > 0 && (
          <ScrollView horizontal style={styles.mediaContainer} showsHorizontalScrollIndicator={false}>
            {item.media.map((mediaItem, index) => (
              <Image 
                key={index}
                source={{ uri: mediaItem.url }}
                style={styles.mediaItem}
                resizeMode="cover"
              />
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
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="heart-outline" size={24} color="#ff00ff" />
            <Text style={styles.actionText}>{item.likes_count || 0}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={22} color="#ff00ff" />
            <Text style={styles.actionText}>{item.comments_count || 0}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share-social-outline" size={24} color="#ff00ff" />
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
      </TouchableOpacity>
    );
  };

  const goToUserLocation = () => {
    if (userLocation) {
      setMapRegion({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#ff00ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confessions</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a place, institution, company..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            
            if (searchTimeout) {
              clearTimeout(searchTimeout);
            }
            
            if (text.length < 3) {
              setSearchResults([]);
              return;
            }
            
            const timeout = setTimeout(() => {
              searchLocations(text);
            }, 500);
            
            setSearchTimeout(timeout);
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
      </View>

      {searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.place_id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.searchResultItem}
              onPress={() => selectLocation(item)}
            >
              <Ionicons name="location" size={20} color="#ff00ff" />
              <Text style={styles.searchResultText}>{item.display_name}</Text>
            </TouchableOpacity>
          )}
          style={styles.searchResultsList}
        />
      ) : (
        searchQuery.length >= 3 && !loading && (
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
            source={{ uri: getMapUrl() }}
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
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff00ff" />
        </View>
      ) : selectedLocation ? (
        confessions.length > 0 ? (
          <FlatList
            data={confessions}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderConfessionItem}
            contentContainerStyle={styles.confessionsList}
            refreshing={loading}
            onRefresh={refreshConfessions}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={60} color="#ff00ff" />
            <Text style={styles.emptyText}>No confessions yet. Be the first to share!</Text>
          </View>
        )
      ) : (
        <View style={styles.instructionContainer}>
          <Ionicons name="search" size={60} color="#ff00ff" />
          <Text style={styles.instructionText}>
            Search for a place or select a location on the map to see confessions
          </Text>
        </View>
      )}
      
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
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Place</Text>
            
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
          </View>
        </View>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000033',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: '#ff00ff',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#550033',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#330022',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#fff',
    marginRight: 10,
  },
  mapButton: {
    backgroundColor: '#330022',
    borderRadius: 20,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultsList: {
    backgroundColor: '#330022',
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#550033',
  },
  searchResultText: {
    color: '#fff',
    marginLeft: 10,
    flex: 1,
  },
  noResultsContainer: {
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#330022',
  },
  noResultsText: {
    color: '#fff',
    marginBottom: 10,
  },
  addPlaceButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addPlaceButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  errorContainer: {
    padding: 15,
    backgroundColor: '#550033',
  },
  errorText: {
    color: '#ff0000',
    textAlign: 'center',
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
    backgroundColor: '#550033',
    padding: 15,
  },
  locationProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationProfileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 15,
  },
  locationProfileInfo: {
    flex: 1,
    marginRight: 10,
  },
  locationProfileName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  locationProfileBio: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 18,
  },
  editProfileButton: {
    padding: 8,
    backgroundColor: '#330022',
    borderRadius: 20,
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
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
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
  },
  username: {
    color: '#fff',
    fontWeight: 'bold',
  },
  dateText: {
    color: '#999',
    fontSize: 12,
    marginRight: 10,
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
  },
  mediaContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  mediaItem: {
    width: 150,
    height: 150,
    borderRadius: 10,
    marginRight: 10,
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
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#550033',
    paddingTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionText: {
    color: '#ff00ff',
    marginLeft: 5,
  },
  verificationContainer: {
    flexDirection: 'row',
    marginLeft: 'auto',
    alignItems: 'center',
  },
  verificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#220011',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginLeft: 8,
  },
  verificationButtonActive: {
    backgroundColor: '#ff00ff',
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
    padding: 20,
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
    padding: 20,
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#330022',
    borderRadius: 15,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#ff00ff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#220011',
    borderRadius: 8,
    color: '#fff',
    fontSize: 16,
    padding: 12,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#220011',
    borderWidth: 1,
    borderColor: '#666',
  },
  selectedType: {
    backgroundColor: '#ff00ff',
    borderColor: '#ff00ff',
  },
  typeText: {
    color: '#fff',
    fontSize: 14,
  },
  selectedTypeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  submitButton: {
    backgroundColor: '#ff00ff',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  profileImageSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImageContainer: {
    position: 'relative',
  },
  profileImagePreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profileImageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(255, 0, 255, 0.8)',
    borderRadius: 20,
    padding: 8,
  },
  saveProfileButton: {
    backgroundColor: '#ff00ff',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  saveProfileButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  confessionInput: {
    backgroundColor: '#220011',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  selectedMediaContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  selectedMediaItem: {
    position: 'relative',
    marginRight: 10,
  },
  selectedMediaPreview: {
    width: 80,
    height: 80,
    borderRadius: 5,
  },
  removeMediaButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#330022',
    borderRadius: 10,
  },
  mediaButtons: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  mediaButton: {
    backgroundColor: '#220011',
    borderRadius: 10,
    padding: 10,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mediaButtonText: {
    color: '#ff00ff',
    marginLeft: 8,
    fontSize: 14,
  },
  anonymousOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  anonymousText: {
    color: '#fff',
    fontSize: 16,
  },
  postButton: {
    backgroundColor: '#ff00ff',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  postButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  reactionModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionModalContent: {
    backgroundColor: '#330022',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    minWidth: 300,
  },
  reactionModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  emojiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 15,
  },
  emojiButton: {
    backgroundColor: '#220011',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 24,
  },
});

export default ConfessionScreen;