import React, { useState, useEffect, useRef } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
// Removed WebView for map as it's not needed for person confessions
// import { WebView } from 'react-native-webview'; 
import { decode } from 'base64-arraybuffer';
import { supabase } from '../config/supabase';
// Removed expo-location as it's not needed for person confessions
// import * as Location from 'expo-location'; 
import * as FileSystem from 'expo-file-system';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';
// import ConfessionPersonCommentScreen from './ConfessionPersonCommentScreen'; // New import for person-specific comment screen

const { width: screenWidth } = Dimensions.get('window');

// New PersonConfessionsHeader component (adapted from ConfessionsHeader)
const PersonConfessionsHeader = React.memo(({
  navigation,
  searchQuery,
  setSearchQuery,
  searchTimeoutRef,
  searchPersons, // Changed from searchLocations
  searchResults, // Now searchResults for persons
  selectPerson, // Changed from selectLocation
  searchLoading,
  selectedPerson, // Changed from selectedLocation
  renderPersonProfile, // Changed from renderLocationProfile
  setShowAddPersonModal, // Changed from setShowAddPlaceModal
  searchError,
  loading,
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
        <Text style={styles.headerTitle}>Person Confessions</Text> {/* Changed title */}
      </LinearGradient>

      <LinearGradient
        colors={['#1a1a3a', '#0d0d2a']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.searchContainer}
      >
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a person..." // Changed placeholder
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            
            if (searchTimeoutRef.current) {
              clearTimeout(searchTimeoutRef.current);
            }
            
            if (text.length < 3) {
              return;
            }
            
            searchTimeoutRef.current = setTimeout(() => {
              searchPersons(text); // Call searchPersons
            }, 500);
          }}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
        {/* Removed map button */}
        {/* <TouchableOpacity 
          style={styles.mapButton}
          onPress={() => setShowMap(!showMap)}
        >
          <Ionicons name={showMap ? "map" : "map-outline"} size={20} color="#ff00ff" />
        </TouchableOpacity> */}
      </LinearGradient>

      {searchResults.length > 0 ? (
        <ScrollView style={styles.searchResultsList} nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
          {searchResults.map((item) => (
            <TouchableOpacity 
              key={item.id.toString()} // Key by person ID
              style={styles.searchResultItem}
              onPress={() => selectPerson(item)} // Call selectPerson
            >
              <Ionicons name="person" size={20} color="#ff00ff" /> {/* Changed icon */}
              <Text style={styles.searchResultText}>{item.name}</Text> {/* Display person name */}
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        searchQuery.length >= 3 && !searchLoading && (
          <View style={styles.noResultsContainer}>
            <Text style={styles.noResultsText}>No persons found</Text> {/* Changed text */}
            <TouchableOpacity 
              style={styles.addPlaceButton} // Keep style name for now, but semantically 'Add Person'
              onPress={() => setShowAddPersonModal(true)} // Call setShowAddPersonModal
            >
              <Text style={styles.addPlaceButtonText}>Add New Person</Text> {/* Changed text */}
            </TouchableOpacity>
          </View>
        )
      )}

      {searchError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {searchError.includes('Network request failed') 
              ? 'Network error. Check your connection.' 
              : 'Error searching persons. Try again.'}
          </Text>
        </View>
      )}
      
      {/* Removed map functionality */}
      {/* {showMap && (
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
      )} */}
      
      {selectedPerson && renderPersonProfile()}

      {searchLoading && ( // Display search-specific loading indicator
        <View style={styles.searchOverlayLoading}>
          <ActivityIndicator size="small" color="#ff00ff" />
          <Text style={styles.searchOverlayLoadingText}>Searching...</Text>
        </View>
      )}
    </View>
  );
});

const ConfessionPersonScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null); // Changed from selectedLocation
  // Removed showMap, mapRegion, userLocation, locationPermission
  // const [showMap, setShowMap] = useState(false);
  const [confessions, setConfessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNewConfessionModal, setShowNewConfessionModal] = useState(false);
  const [newConfession, setNewConfession] = useState('');
  const [media, setMedia] = useState([]);
  const [remainAnonymous, setRemainAnonymous] = useState(true);
  // Removed mapRegion, userLocation, locationPermission
  // const [mapRegion, setMapRegion] = useState({
  //   latitude: 37.78825,
  //   longitude: -122.4324,
  // });
  // const [userLocation, setUserLocation] = useState(null);
  // const [locationPermission, setLocationPermission] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [personProfile, setPersonProfile] = useState(null); // Changed from locationProfile
  const [showPersonProfileModal, setShowPersonProfileModal] = useState(false); // Changed from showLocationProfileModal
  const [profileImage, setProfileImage] = useState(null);
  const [profileBio, setProfileBio] = useState('');
  const [showReactionModal, setShowReactionModal] = useState(false);
  const [selectedConfessionForReaction, setSelectedConfessionForReaction] = useState(null);
  const [confessionReactions, setConfessionReactions] = useState({});
  const [confessionVerifications, setConfessionVerifications] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [confessionLikes, setConfessionLikes] = useState({});
  const [confessionComments, setConfessionComments] = useState({});
  const searchTimeoutRef = useRef(null); 
  const [showAddPersonModal, setShowAddPersonModal] = useState(false); // Changed from showAddPlaceModal
  const [newPerson, setNewPerson] = useState({ // Changed from newPlace
    name: '',
    bio: '' // Added bio for person profile
  });
  const [searchLoading, setSearchLoading] = useState(false); 

  // Emoji options for reactions
  const emojiOptions = ['😂', '❤️', '😮', '😢', '😡', '👍', '👎', '🔥', '💯', '🤔'];

  // Request location permission and get current location (runs once on mount)
  useEffect(() => {
    const setupInitialData = async () => {
      // Removed location permission and current location logic
      // const { status } = await Location.requestForegroundPermissionsAsync();
      // setLocationPermission(status);
      
      // if (status === 'granted') {
      //   const location = await Location.getCurrentPositionAsync({});
      //   setUserLocation(location);
      //   setMapRegion({
      //     latitude: location.coords.latitude,
      //     longitude: location.coords.longitude,
      //   });
      // }
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    
    setupInitialData();

    // Cleanup function for search timeout (runs on unmount)
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []); 

  // Removed getMapUrl
  // const getMapUrl = React.useCallback(({ mapRegion, selectedLocation, userLocation }) => {
  //   const lat = mapRegion.latitude;
  //   const lon = mapRegion.longitude;
  //   let url = `https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.05},${lat-0.05},${lon+0.05},${lat+0.05}&layer=mapnik`;
    
  //   if (selectedLocation) {
  //     url += `&marker=${selectedLocation.lat},${selectedLocation.lon}`;
  //   }
  //   if (userLocation) {
  //     url += `&marker=${userLocation.coords.latitude},${userLocation.coords.longitude}`;
  //   }
  //   return url;
  // }, [mapRegion, selectedLocation, userLocation]); 

  const searchPersons = React.useCallback(async (query) => { // Changed from searchLocations
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    
    setSearchLoading(true);
    setSearchError(null);
    try {
      const { data: personsData, error: personsError } = await supabase
        .from('person_profiles') // Query person_profiles table
        .select('*')
        .ilike('name', `%${query}%`) // Search by person name
        .limit(20);
      
      if (personsError) {
        console.error('Error searching persons:', personsError);
        throw personsError;
      }
      
      setSearchResults(personsData);
    } catch (error) {
      console.error('Error searching persons:', error);
      setSearchError(error.message);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [setSearchResults, setSearchLoading, setSearchError]); // Dependencies for useCallback

  const handleAddPerson = async () => { // Changed from handleAddPlace
    if (!newPerson.name) {
      Alert.alert('Error', 'Please fill in the person\'s name');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to add a person');
        return;
      }
      
      const personData = {
        name: newPerson.name,
        bio: newPerson.bio || null,
        created_at: new Date().toISOString(),
        created_by: user.id
      };
      
      const { data, error } = await supabase
        .from('person_profiles') // Insert into person_profiles
        .insert([personData])
        .select()
        .single();

      if (error) throw error;

      setShowAddPersonModal(false); // Changed modal state
      setNewPerson({ // Reset newPerson state
        name: '',
        bio: ''
      });

      const newPersonResult = { // Format for search results
        id: data.id,
        name: data.name,
        profile_image: data.profile_image,
        bio: data.bio
      };
      
      setSearchResults(prevResults => [...prevResults, newPersonResult]);
      selectPerson(newPersonResult); // Select the newly added person
      
      Alert.alert('Success', 'Person added successfully');
    } catch (error) {
      console.error('Error adding person:', error);
      Alert.alert('Error', 'Failed to add person. Please try again.');
    }
  };

  const selectPerson = React.useCallback((person) => { // Changed from selectLocation
    if (!person) {
      console.error('Error: Attempted to select undefined person');
      return;
    }
    
    setSelectedPerson(person); // Changed from setSelectedLocation
    setSearchResults([]);
    
    // Removed map region setting
    // if (person.lat && person.lon) {
    //   setMapRegion({
    //     latitude: parseFloat(person.lat),
    //     longitude: parseFloat(person.lon),
    //   });
    // }
    
    if (!person.id) { // Check for person ID
      console.error('Error: Selected person has no ID');
      Alert.alert('Error', 'Invalid person data. Please try selecting a different person.');
      return;
    }
    
    loadPersonProfile(person.id); // Load person profile
    loadPersonConfessions(person.name, true); // Load confessions using person_name
  }, [setSearchResults, setSelectedPerson, loadPersonProfile, loadPersonConfessions]); // Dependencies for useCallback

  const loadPersonProfile = React.useCallback(async (personId) => { // Changed from loadLocationProfile
    try {
      const { data, error } = await supabase
        .from('person_profiles') // From person_profiles
        .select('*')
        .eq('id', personId) // Query by person ID
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
        throw error;
      }
      
      setPersonProfile(data || null); // Set person profile
    } catch (error) {
      console.error('Error loading person profile:', error);
      setPersonProfile(null);
    }
  }, [setPersonProfile]); // Dependencies for useCallback

  const savePersonProfile = async () => { // Changed from saveLocationProfile
    if (!selectedPerson) return;
    
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
      
      const profileData = {
        id: selectedPerson.id, // Update by person ID
        name: selectedPerson.name,
        profile_image: imageUrl || (personProfile?.profile_image || null),
        bio: profileBio || (personProfile?.bio || null),
        updated_at: new Date().toISOString(),
        created_by: user.id
      };

      const { error } = await supabase
        .from('person_profiles') // Upsert into person_profiles
        .upsert([profileData], { onConflict: 'id' }); // Conflict on ID

      if (error) throw error;

      loadPersonProfile(selectedPerson.id); // Reload person profile
      setShowPersonProfileModal(false); // Close person profile modal
      setProfileImage(null);
      setProfileBio('');
      
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error saving person profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  const loadPersonConfessions = React.useCallback(async (personIdentifier, useNameForConfessions = false) => { // Changed from loadConfessions
    setLoading(true);
    try {
      if (!personIdentifier) {
        Alert.alert('Error', 'Invalid person. Please select a person and try again.');
        setLoading(false);
        return;
      }
      
      let query = supabase
        .from('person_confessions') // From person_confessions table
        .select(`
          id,
          user_id,
          creator_id,
          person_id,
          person_name,
          content,
          media,
          is_anonymous,
          likes_count,
          comments_count,
          created_at,
          confession_creator:creator_id(username, avatar_url),
          confessed_person:person_id(name, profile_image)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (useNameForConfessions) {
        query = query.eq('person_name', personIdentifier); // Query by person_name
      } else {
        query = query.eq('person_id', personIdentifier); // Query by person_id
      }

      const { data: confessionsData, error: confessionsError } = await query;

      if (confessionsError) {
        console.error('Error fetching person confessions:', confessionsError);
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

        // Fetch likes separately to ensure `is_liked` is accurate for current user
        const { data: userLikeData, error: userLikeError } = await supabase
          .from('person_confession_likes')
          .select('id')
          .eq('confession_id', confession.id)
          .eq('user_id', currentUser?.id);

        if (userLikeError) console.error("Error fetching user like for person confession:", userLikeError);

        return {
          ...confession,
          media: validatedMedia,
          username: confession.confession_creator?.username || 'User', // Get username from joined creator profile
          avatar_url: confession.confession_creator?.avatar_url, // Get avatar from joined creator profile
          is_liked: userLikeData && userLikeData.length > 0,
          confessedPersonName: confession.confessed_person?.name, // Add confessed person's name
          confessedPersonProfileImage: confession.confessed_person?.profile_image // Add confessed person's profile image
        };
      }));

      setConfessions(processedConfessions);
      
      // Load reactions and verifications for person confessions
      await loadReactionsAndVerifications(processedConfessions.map(c => c.id));
    } catch (error) {
      console.error('Error loading person confessions:', error);
      Alert.alert('Error', 'Failed to load person confessions. Please try again.');
      setConfessions([]);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setConfessions, loadReactionsAndVerifications, currentUser]); // Dependencies for useCallback

  const loadReactionsAndVerifications = async (confessionIds) => {
    try {
      // Load reactions
      const { data: reactionsData, error: reactionsError } = await supabase
        .from('person_confession_reactions') // From person_confession_reactions
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
        .from('person_confession_verifications') // From person_confession_verifications
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
      console.error('Error loading reactions and verifications for person confessions:', error);
    }
  };

  const handleReaction = async (confessionId, emoji) => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to react');
      return;
    }

    try {
      const { error } = await supabase
        .from('person_confession_reactions') // Upsert into person_confession_reactions
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
      console.error('Error adding reaction to person confession:', error);
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
        .from('person_confession_verifications') // Upsert into person_confession_verifications
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

    } catch (error) {
      console.error('Error adding verification for person confession:', error);
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
        .from('person_confession_likes') // From person_confession_likes
        .select('id')
        .eq('confession_id', confessionId)
        .eq('user_id', currentUser.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError; 
      }

      if (existingLike) {
        // Unlike
        const { error: deleteError } = await supabase
          .from('person_confession_likes') // Delete from person_confession_likes
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
          .from('person_confession_likes') // Insert into person_confession_likes
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
      console.error('Error toggling like for person confession:', error);
      Alert.alert('Error', 'Failed to update like. Please try again.');
    }
  };

  const handleCommentPress = (confessionId) => {
    // Navigate to the ConfessionPersonCommentScreen, passing confessionId as a route parameter
    navigation.navigate('ConfessionPersonComment', { confessionId: confessionId });
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
        person_id: selectedPerson.id, // Use person_id
        person_name: selectedPerson.name, // Use person_name
        content: newConfession.trim(),
        media: mediaUrls,
        is_anonymous: remainAnonymous,
        created_at: new Date().toISOString()
      };

      const { error: confessionError } = await supabase
        .from('person_confessions') // Insert into person_confessions
        .insert([confessionData]);
        
      if (confessionError) throw confessionError;
      
      setNewConfession('');
      setMedia([]);
      setShowNewConfessionModal(false);
      // After posting, reload confessions for the selected person by name
      if (selectedPerson?.name) {
        loadPersonConfessions(selectedPerson.name, true);
      } else if (selectedPerson?.id) {
        loadPersonConfessions(selectedPerson.id.toString());
      }
      
    } catch (error) {
      console.error('Error posting person confession:', error);
      Alert.alert('Error', error.message || 'Failed to post confession. Please try again.');
    }
  };

  const deleteConfession = async (confessionId) => {
    try {
      const { data: confessionData, error: fetchError } = await supabase
        .from('person_confessions') // From person_confessions
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
        .from('person_confessions') // Delete from person_confessions
        .delete()
        .eq('id', confessionId);

      if (error) throw error;
      
      // Use person_name for reloading confessions after deletion
      if (selectedPerson?.name) {
        loadPersonConfessions(selectedPerson.name, true);
      } else if (selectedPerson?.id) {
        loadPersonConfessions(selectedPerson.id.toString());
      }
    } catch (error) {
      console.error('Error deleting person confession:', error);
      Alert.alert('Error', 'Failed to delete confession. Please try again.');
    }
  };

  const refreshConfessions = () => {
    if (selectedPerson) {
      if (selectedPerson.name) {
        loadPersonConfessions(selectedPerson.name, true); 
      } else if (selectedPerson.id) {
        loadPersonConfessions(selectedPerson.id.toString());
      }
    }
  };

  // Memoized renderPersonProfile function
  const renderPersonProfile = React.useCallback(() => {
    if (!selectedPerson) return null;

    return (
      <View style={styles.locationProfileContainer}> {/* Keep style name for now */}
        <View style={styles.locationProfileHeader}>
          <TouchableOpacity onPress={() => setShowPersonProfileModal(true)}>
            <Image 
              source={{ 
                uri: personProfile?.profile_image || 'https://via.placeholder.com/80x80?text=Add+Photo'
              }}
              style={styles.locationProfileImage}
            />
          </TouchableOpacity>
          <View style={styles.locationProfileInfo}>
            <Text style={styles.locationProfileName} numberOfLines={2}>
              {selectedPerson.name}
            </Text>
            <Text style={styles.locationProfileBio} numberOfLines={3}>
              {personProfile?.bio || 'No description yet. Tap to add one!'}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.editProfileButton}
            onPress={() => {
              setProfileBio(personProfile?.bio || '');
              setShowPersonProfileModal(true);
            }}
          >
            <Ionicons name="create-outline" size={20} color="#ff00ff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [selectedPerson, personProfile, setProfileBio, setShowPersonProfileModal]); 

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
            onPress={() => handleCommentPress(item.id)} // Navigate to person comment screen
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
      </TouchableOpacity>
    );
  }; 

  // Removed goToUserLocation, setShowMapCallback
  // const goToUserLocation = React.useCallback(() => {
  //   if (userLocation) {
  //     setMapRegion({
  //       latitude: userLocation.coords.latitude,
  //       longitude: userLocation.coords.longitude,
  //     });
  //   }
  // }, [userLocation, setMapRegion]); 

  // const setShowMapCallback = React.useCallback((value) => {
  //   setShowMap(value);
  // }, [setShowMap]); 

  const setShowAddPersonModalCallback = React.useCallback((value) => { // Changed from setShowAddPlaceModalCallback
    setShowAddPersonModal(value);
  }, [setShowAddPersonModal]); 

  return (
    <View style={styles.container}>
      <FlatList
        data={confessions}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderConfessionItem}
        ListHeaderComponent={
          <PersonConfessionsHeader // Use new header component
            navigation={navigation}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchTimeoutRef={searchTimeoutRef}
            searchPersons={searchPersons} // Pass searchPersons
            searchResults={searchResults}
            selectPerson={selectPerson} // Pass selectPerson
            searchLoading={searchLoading}
            // Removed map related props
            // showMap={showMap}
            // setShowMap={setShowMapCallback}
            // goToUserLocation={goToUserLocation}
            selectedPerson={selectedPerson} // Pass selectedPerson
            renderPersonProfile={renderPersonProfile} // Pass renderPersonProfile
            setShowAddPersonModal={setShowAddPersonModalCallback} // Pass setShowAddPersonModalCallback
            searchError={searchError}
            loading={loading}
            // Removed userLocation
            // userLocation={userLocation}
          />
        }
        contentContainerStyle={styles.confessionsList}
        refreshing={loading} 
        onRefresh={refreshConfessions}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          !selectedPerson ? (
            <View style={styles.instructionContainer}>
              <Ionicons name="search" size={60} color="#ff00ff" />
              <Text style={styles.instructionText}>
                Search for a person or add a new one to see confessions
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
      
      {selectedPerson && (
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowNewConfessionModal(true)}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Add Person Modal (adapted from Add Place Modal) */}
      <Modal
        visible={showAddPersonModal} // Changed modal state
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddPersonModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingContainer} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Person</Text> {/* Changed title */}
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollViewContent}>
              {/* Removed Type selector */}
              {/* <View style={styles.formGroup}>
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
              </View> */}

              <View style={styles.formGroup}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={newPerson.name} // Use newPerson.name
                  onChangeText={(text) => setNewPerson(prev => ({ ...prev, name: text }))}
                  placeholder="Enter person's name" // Changed placeholder
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Bio (Optional)</Text> {/* Added Bio field */}
                <TextInput
                  style={[styles.input, styles.bioInput]}
                  value={newPerson.bio}
                  onChangeText={(text) => setNewPerson(prev => ({ ...prev, bio: text }))}
                  placeholder="Tell something about this person..."
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={4}
                />
              </View>

              {/* Removed City, District, State, Country fields */}
              {/* <View style={styles.formGroup}>
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
              </View> */}

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowAddPersonModal(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.submitButton]}
                  onPress={handleAddPerson} // Call handleAddPerson
                >
                  <Text style={styles.buttonText}>Add Person</Text> {/* Changed text */}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Person Profile Modal (adapted from Location Profile Modal) */}
      <Modal
        visible={showPersonProfileModal} // Changed modal state
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPersonProfileModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Person Profile</Text> {/* Changed title */}
              <TouchableOpacity onPress={() => setShowPersonProfileModal(false)}>
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
                    uri: profileImage?.uri || personProfile?.profile_image || 'https://via.placeholder.com/120x120?text=Add+Photo'
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
                placeholder="Tell others about this person..." // Changed placeholder
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
              />
            </View>

            <TouchableOpacity 
              style={styles.saveProfileButton}
              onPress={savePersonProfile} // Call savePersonProfile
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
              placeholder="What's your confession about this person?" // Changed placeholder
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
  // Removed mapButton styles
  // mapButton: {
  //   backgroundColor: 'rgba(0, 255, 255, 0.2)',
  //   borderRadius: 25,
  //   width: 50,
  //   height: 50,
  //   justifyContent: 'center',
  //   alignItems: 'center',
  //   shadowColor: '#00ffff',
  //   shadowOffset: { width: 0, height: 2 },
  //   shadowOpacity: 0.5,
  //   shadowRadius: 5,
  //   elevation: 8,
  // },
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
  addPlaceButton: { // Retained name for now
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
  addPlaceButtonText: { // Retained name for now
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
  // Removed mapContainer and map styles
  // mapContainer: {
  //   height: 300,
  //   position: 'relative',
  // },
  // map: {
  //   ...StyleSheet.absoluteFillObject,
  // },
  // mapControls: {
  //   position: 'absolute',
  //   top: 10,
  //   right: 10,
  //   gap: 10,
  // },
  // closeMapButton: {
  //   backgroundColor: 'rgba(0,0,0,0.5)',
  //   borderRadius: 20,
  //   padding: 5,
  // },
  // locationButton: {
  //   backgroundColor: 'rgba(0,0,0,0.5)',
  //   borderRadius: 20,
  //   padding: 8,
  // },
  locationProfileContainer: { // Keep name for now, but semantically "Person Profile Container"
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
  locationProfileHeader: { // Keep name for now
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationProfileImage: { // Keep name for now
    width: 90,
    height: 90,
    borderRadius: 45,
    marginRight: 15,
    borderWidth: 3,
    borderColor: '#ff00ff',
  },
  locationProfileInfo: { // Keep name for now
    flex: 1,
    marginRight: 10,
  },
  locationProfileName: { // Keep name for now
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    textShadowColor: 'rgba(255, 0, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  locationProfileBio: { // Keep name for now
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
  dateText: {
    color: '#b0b0ff',
    fontSize: 11,
    marginRight: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 3,
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
    flexWrap: 'wrap', 
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 0, 255, 0.4)',
    paddingTop: 15,
    paddingHorizontal: 5,
    justifyContent: 'space-around', 
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  actionText: {
    color: '#ff00ff',
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
  typeSelector: { // Retained for now but not used
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeButton: { // Retained for now but not used
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
  selectedType: { // Retained for now but not used
    backgroundColor: '#00ffff',
    borderColor: '#00ffff',
    shadowColor: '#00ffff',
  },
  typeText: { // Retained for now but not used
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  selectedTypeText: { // Retained for now but not used
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
});

export default ConfessionPersonScreen;
