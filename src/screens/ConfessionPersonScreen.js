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
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
// Removed WebView for map as it's not needed for person confessions
// import { WebView } from 'react-native-webview'; 
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
// Removed expo-location as it's not needed for person confessions
// import * as Location from 'expo-location'; 
import * as FileSystem from 'expo-file-system';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';
import ConfessionPersonCommentScreen from './ConfessionPersonCommentScreen'; // New import for person-specific comment screen

const { width: screenWidth } = Dimensions.get('window');


// New PersonConfessionsHeader component (adapted from ConfessionsHeader)
const PersonConfessionsHeader = React.memo(function PersonConfessionsHeaderComponent(props) {

  return (
    <View>
      <LinearGradient
        colors={['#0a0a2a', '#1a1a3a']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.header}
      >
        <TouchableOpacity 
          onPress={() => props.navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#ff00ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Person Confessions</Text>
      </LinearGradient>

      <LinearGradient
        colors={['#1a1a3a', '#0d0d2a']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.searchContainer}
      >
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a person..."
          placeholderTextColor="#999"
          value={props.searchQuery}
          onChangeText={props.setSearchQuery}
          autoCapitalize="none"
        />
        {props.searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => props.setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </LinearGradient>

      {props.searchResults.length > 0 ? (
        <ScrollView style={styles.searchResultsList} nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
         {props.searchResults.map((item) => (
  <TouchableOpacity 
    key={item.id.toString()}
    style={styles.searchResultItem}
    onPress={() => props.selectPerson(item)}
  >
    <Image 
      source={{ uri: item.profile_image || 'https://via.placeholder.com/40x40?text=User' }}
      style={styles.searchUserAvatar}
    />
    <View style={styles.searchUserInfo}>
      <View style={styles.searchUsernameContainer}>
        <Text style={styles.searchResultText}>{item.name}</Text>
        {item.isVerified && (
          <Ionicons name="checkmark-circle" size={16} color="#ff0000" style={styles.verifiedBadge} />
        )}
      </View>
    </View>
  </TouchableOpacity>
))}
        </ScrollView>
      ) : (
        props.searchQuery.trim().length > 0 && !props.searchLoading && (
          <View style={styles.noResultsContainer}>
            <Text style={styles.noResultsText}>No persons found</Text>
            <TouchableOpacity 
              style={styles.addPlaceButton}
              onPress={() => props.setShowAddPersonModal(true)}
            >
              <Text style={styles.addPlaceButtonText}>Add New Person</Text>
            </TouchableOpacity>
          </View>
        )
      )}

      {props.searchError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {props.searchError.includes('Network request failed') 
              ? 'Network error. Check your connection.' 
              : 'Error searching persons. Try again.'}
          </Text>
        </View>
      )}
      
      {props.selectedPerson && props.renderPersonProfile()}

      {props.searchLoading && (
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
  const route = useRoute(); // Add useRoute hook
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
  const [currentUserUsername, setCurrentUserUsername] = useState(null); // New state for current user's username
  const [confessionLikes, setConfessionLikes] = useState({});
  const [confessionComments, setConfessionComments] = useState({});
  const [showCommentModal, setShowCommentModal] = useState(false); // Added state for CommentScreen modal
  const searchTimeoutRef = useRef(null); 
  const confessionsListRef = useRef(null); // Ref for FlatList to scroll to a specific confession
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

    if (route.params?.selectedConfessionId && !selectedPerson) {
      // If navigated from a comment notification, load the specific confession
      const { selectedConfessionId } = route.params;
      const fetchAndSetConfession = async () => {
        try {
          setLoading(true);
          const { data: confessionData, error } = await supabase
            .from('person_confessions')
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
              person:person_id(name, profile_image),
              confession_creator:creator_id(username, avatar_url)
            `)
            .eq('id', selectedConfessionId)
            .single();
          
          if (error) throw error;
          
          if (confessionData) {
            let personDetails = null;
            if (confessionData.person_id) {
              const { data: profileData, error: profileError } = await supabase
                .from('person_profiles')
                .select('*')
                .eq('id', confessionData.person_id)
                .single();
              
              if (profileError && profileError.code !== 'PGRST116') {
                console.error('Error fetching person details for confession:', profileError);
              } else if (profileData) {
                personDetails = {
                  id: profileData.id,
                  name: profileData.name,
                  profile_image: profileData.profile_image,
                  bio: profileData.bio,
                };
              }
            }
            
            if (!personDetails && confessionData.person_name) {
              personDetails = {
                id: confessionData.person_name, // Using name as ID if actual ID not found
                name: confessionData.person_name,
                profile_image: null,
                bio: null,
              };
            }
            
            if (personDetails) {
              setSelectedPerson(personDetails);
              loadPersonConfessions(personDetails.id); // Load confessions using person ID
            } else {
              Alert.alert('Error', 'Could not retrieve person for the confession.');
            }
          }
        } catch (error) {
          console.error('Error fetching specific person confession:', error);
          Alert.alert('Error', 'Failed to load specific person confession.');
        } finally {
          setLoading(false);
        }
      };
      fetchAndSetConfession();
    }
  
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [route.params?.selectedConfessionId, selectedPerson]);

  // Debounce search input
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    const trimmed = searchQuery.trim();
    if (trimmed.length === 0) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => {
      searchPersons(trimmed);
    }, 500);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchPersons]);
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
  const searchPersons = React.useCallback(async (query) => {
    if (query.length < 1) {
      setSearchResults([]);
      return;
    }
    
    setSearchLoading(true);
    setSearchError(null);
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      const { data: personsData, error: personsError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .ilike('username', `%${query}%`)
        .order('username')
        .limit(20);
      
      if (personsError) throw personsError;
      
      // Filter out current user
      const filteredData = currentUser ? personsData.filter(user => user.id !== currentUser.id) : personsData;
      
      // Check for blocked status and verification
      const usersWithStatus = await Promise.all(filteredData.map(async (user) => {
        if (!currentUser) return user;
        
        const { data: isBlocked, error: isBlockedError } = await supabase.rpc('is_blocked', {
          user_id_1: currentUser.id,
          user_id_2: user.id
        });
  
        if (isBlockedError || isBlocked) return null;
  
        const { data: verifiedData } = await supabase
          .from('verified_accounts')
          .select('verified')
          .eq('id', user.id)
          .maybeSingle();
          
        return {
          id: user.id,
          name: user.username || user.full_name || 'Unknown User',
          profile_image: user.avatar_url,
          bio: null,
          isVerified: verifiedData?.verified || false
        };
      }));
      
      setSearchResults(usersWithStatus.filter(Boolean) || []);
    } catch (error) {
      console.error('Error searching persons:', error);
      setSearchError(error.message);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

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
      
      // Check if a profile with this name already exists
      const { data: existingProfile, error: existingProfileError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .or(`username.ilike.%${newPerson.name}%,full_name.ilike.%${newPerson.name}%`)
        .single();
      
      if (existingProfileError && existingProfileError.code !== 'PGRST116') {
        throw existingProfileError;
      }

      let targetPersonId = existingProfile?.id;

      if (!targetPersonId) {
        // If no existing profile, create a "placeholder" profile in `person_profiles`
        // Note: This is a simplified approach. In a real app, you might want a more robust way to handle "adding a new person" who isn't a user yet.
        const { data: insertedPerson, error: insertError } = await supabase
          .from('person_profiles') 
          .insert({
            name: newPerson.name,
            bio: newPerson.bio || null,
            created_at: new Date().toISOString(),
            created_by: user.id
          })
          .select()
          .single();

        if (insertError) throw insertError;
        targetPersonId = insertedPerson.id;
      } else {
        // If profile exists, also try to create/update an entry in `person_profiles` for additional info
        const { error: upsertPersonProfileError } = await supabase
          .from('person_profiles')
          .upsert({
            id: targetPersonId,
            name: newPerson.name,
            bio: newPerson.bio || null,
            created_at: new Date().toISOString(),
            created_by: user.id
          }, { onConflict: 'id' });
        
        if (upsertPersonProfileError) {
          console.error('Error upserting person_profiles for existing user:', upsertPersonProfileError);
          // Don't throw, just log and continue, as the main profile exists
        }
      }

      setShowAddPersonModal(false); 
      setNewPerson({ 
        name: '',
        bio: ''
      });

      // Construct a result object to select
      const newPersonResult = { 
        id: targetPersonId,
        name: newPerson.name,
        profile_image: existingProfile?.avatar_url || null, // Use existing avatar if available
        bio: newPerson.bio
      };
      
      setSearchResults(prevResults => [...prevResults, newPersonResult]);
      selectPerson(newPersonResult); 
      
      Alert.alert('Success', 'Person added successfully');
    } catch (error) {
      console.error('Error adding person:', error);
      Alert.alert('Error', 'Failed to add person. Please try again.');
    }
  };

  const selectPerson = React.useCallback((person) => { 
    if (!person) {
      console.error('Error: Attempted to select undefined person');
      return;
    }
    
    setSelectedPerson(person); 
    setSearchResults([]);
    
    if (!person.id) { 
      console.error('Error: Selected person has no ID');
      Alert.alert('Error', 'Invalid person data. Please try selecting a different person.');
      return;
    }
    
    loadPersonProfile(person.id); 
    loadPersonConfessions(person.id); // Load confessions using person ID
  }, [setSearchResults, setSelectedPerson, loadPersonProfile, loadPersonConfessions]); 

  const loadPersonProfile = React.useCallback(async (personId) => { 
    try {
      const { data, error } = await supabase
        .from('person_profiles') 
        .select('*')
        .eq('id', personId) 
        .single();
      
      if (error && error.code !== 'PGRST116') { 
        throw error;
      }
      
      setPersonProfile(data || null); 
    } catch (error) {
      console.error('Error loading person profile:', error);
      setPersonProfile(null);
    }
  }, [setPersonProfile]); 

  const savePersonProfile = async () => { 
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
        id: selectedPerson.id, 
        name: selectedPerson.name,
        profile_image: imageUrl || (personProfile?.profile_image || null),
        bio: profileBio || (personProfile?.bio || null),
        updated_at: new Date().toISOString(),
        created_by: user.id
      };

      const { error } = await supabase
        .from('person_profiles') 
        .upsert([profileData], { onConflict: 'id' }); 

      if (error) throw error;

      loadPersonProfile(selectedPerson.id); 
      setShowPersonProfileModal(false); 
      setProfileImage(null);
      setProfileBio('');
      
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error saving person profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };



  const loadPersonConfessions = React.useCallback(async (personIdentifier) => { // Removed useNameForConfessions, use ID
    setLoading(true);
    try {
      if (!personIdentifier) {
        Alert.alert('Error', 'Invalid person. Please select a person and try again.');
        setLoading(false);
        return;
      }
      
      let query = supabase
        .from('person_confessions')
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
          person:person_id(name, profile_image),
          confession_creator:creator_id(username, avatar_url)
        `)
        .eq('person_id', personIdentifier) // Always query by person_id
        .order('created_at', { ascending: false })
        .limit(50);

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

        // Only fetch likes if currentUser exists and has an ID
        let is_liked = false;
        if (currentUser && currentUser.id) {
          try {
            const { data: userLikeData, error: userLikeError } = await supabase
              .from('person_confession_likes')
              .select('confession_id')
              .eq('confession_id', confession.id)
              .eq('user_id', currentUser.id)
              .single(); // Use single to check for existence
             
            if (userLikeError && userLikeError.code !== 'PGRST116') {
              console.error("Error fetching user like for person confession:", userLikeError);
            } else {
              is_liked = !!userLikeData; // Check if userLikeData is not null
            }
          } catch (error) {
            console.error("Error in like check:", error);
          }
        }

        return {
          ...confession,
          media: validatedMedia,
          username: confession.confession_creator?.username || 'User',
          avatar_url: confession.confession_creator?.avatar_url,
          is_liked: is_liked,
          confessedPersonName: confession.person?.name,
          confessedPersonProfileImage: confession.person?.profile_image,
          is_tagged_in_content: currentUserUsername && confession.content.includes(`@${currentUserUsername}`),
          // is_tagged_in_comment is handled in the comment screen, not here
        };
      }));

      setConfessions(processedConfessions);
      
      // Load reactions and verifications for person confessions
      await loadReactionsAndVerifications(processedConfessions.map(c => c.id));

      // If a specific confession was requested, scroll to it
      if (route.params?.selectedConfessionId) {
        const index = processedConfessions.findIndex(c => c.id === route.params.selectedConfessionId);
        if (index !== -1) { // Removed check for confessionsListRef.current, assume it exists or handle error later
          // Use a timeout to ensure FlatList has rendered its items
          setTimeout(() => {
            // confessionsListRef.current.scrollToIndex({ animated: true, index, viewPosition: 0.5 });
            // Clear the param after scrolling to prevent re-scrolling on future renders
            navigation.setParams({ selectedConfessionId: undefined }); 
          }, 500); // Adjust delay as needed
        }
      }
    } catch (error) {
      console.error('Error loading person confessions:', error);
      Alert.alert('Error', 'Failed to load person confessions. Please try again.');
      setConfessions([]);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setConfessions, loadReactionsAndVerifications, currentUser, currentUserUsername, route.params?.selectedConfessionId, navigation]);


  const loadReactionsAndVerifications = React.useCallback(async (confessionIds) => {
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
  }, [currentUser]);

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
    if (!currentUser || !currentUser.id) {
      Alert.alert('Error', 'You must be logged in to like a confession');
      return;
    }

    try {
      // Check if already liked
      const { data: existingLike, error: fetchError } = await supabase
        .from('person_confession_likes')
        .select('confession_id') // Select any column to check for existence, e.g., confession_id
        .eq('confession_id', confessionId)
        .eq('user_id', currentUser.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError; 
      }

      if (existingLike) {
        // Unlike
        const { error: deleteError } = await supabase
          .from('person_confession_likes')
          .delete()
          .eq('confession_id', confessionId) // Delete using both parts of the composite key
          .eq('user_id', currentUser.id);

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
          .from('person_confession_likes')
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
    
    console.log('Starting postConfession...');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user:', user?.id);
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to post a confession');
        return;
      }
      
      // Upload media if any
      const mediaUrls = [];
      for (const item of media) {
        if (item.uri) {
          try {
            const uploadResult = await uploadToCloudinary(item.uri, 'person_confessions');
            
            if (!uploadResult || !uploadResult.secure_url) {
              throw new Error('Failed to upload media');
            }
            
            mediaUrls.push({
              url: uploadResult.secure_url,
              type: 'image',
              publicId: uploadResult.public_id
            });
          } catch (mediaError) {
            console.error('Media upload error:', mediaError);
            throw new Error('Failed to upload media: ' + (mediaError.message || 'Unknown error'));
          }
        }
      }
      
      // Prepare confession data
      const confessionData = {
        user_id: remainAnonymous ? null : user.id,
        creator_id: user.id,
        person_id: selectedPerson.id,
        person_name: selectedPerson.name,
        content: newConfession.trim(),
        media: mediaUrls.length > 0 ? mediaUrls : null,
        is_anonymous: remainAnonymous,
        created_at: new Date().toISOString()
      };

      // Insert the new confession
      const { data: newConfessionData, error: confessionError } = await supabase
        .from('person_confessions')
        .insert([confessionData])
        .select()
        .single();

      if (confessionError) throw confessionError;

      // Create a notification for the person being confessed about
      console.log('Creating notification for person ID:', selectedPerson.id);
      
      // Get the person's profile to find their user account or creator
      const { data: personProfile, error: personError } = await supabase
        .from('person_profiles')
        .select(`
          id, 
          name,
          created_by,
          user_id  // This is the user account associated with this person
        `)
        .eq('id', selectedPerson.id)
        .single();

      console.log('Person profile data:', personProfile);
      
      if (personError) {
        console.error('Error fetching person profile:', personError);
        return; // Exit if we can't get the person's profile
      }

      // Determine who should receive the notification
      // Priority 1: If the person is linked to a user account (user_id), notify that user
      // Priority 2: Otherwise, if there's a creator (created_by), notify them
      const recipientId = personProfile.user_id || personProfile.created_by;
      
      if (recipientId) {
        console.log(`Sending notification to user: ${recipientId}`);
        
        // Get the sender's username if not anonymous
        let senderName = 'Someone';
        if (!remainAnonymous) {
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();
          
          if (senderProfile?.username) {
            senderName = senderProfile.username;
          }
        }
        
        const notificationContent = `${senderName} posted a confession about you (${personProfile.name}): "${newConfession.trim().substring(0, 50)}${newConfession.length > 50 ? '...' : ''}"`;
        
        const { data: notificationData, error: notificationError } = await supabase
          .from('notifications')
          .insert([
            {
              recipient_id: recipientId,
              sender_id: remainAnonymous ? null : user.id,
              type: 'mention',
              content: notificationContent,
              reference_id: newConfessionData.id,
              is_read: false
            }
          ])
          .select();
          
        if (notificationError) {
          console.error('Error creating notification:', notificationError);
        } else {
          console.log('Notification created successfully:', notificationData);
        }
      } else {
        console.log('No user account or creator found for person profile, skipping notification');
      }
      
      // Reset form and refresh confessions
      setNewConfession('');
      setMedia([]);
      setShowNewConfessionModal(false);
      
      // Refresh the confessions list
      if (selectedPerson?.id) {
        loadPersonConfessions(selectedPerson.id);
      }
      
      // Show success message
      Alert.alert('Success', 'Your confession has been posted!');
      
    } catch (error) {
      console.error('Error posting person confession:', error);
      Alert.alert('Error', error.message || 'Failed to post confession. Please try again.');
    }
  };

  const deleteConfession = async (confessionId) => {
    try {
      // First, get the confession to check for media that needs to be deleted
      const { data: confessionData, error: fetchError } = await supabase
        .from('person_confessions')
        .select('id, media, creator_id')
        .eq('id', confessionId)
        .single();

      if (fetchError) throw fetchError;
      
      // Check if the current user is the creator of the confession
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id !== confessionData.creator_id) {
        Alert.alert('Error', 'You can only delete your own confessions');
        return;
      }

      // Delete media from Cloudinary if it exists
      if (confessionData.media && Array.isArray(confessionData.media)) {
        for (const mediaItem of confessionData.media) {
          if (mediaItem.publicId) {
            try {
              await deleteFromCloudinary(mediaItem.publicId, 'image');
            } catch (mediaError) {
              console.error('Error deleting media from Cloudinary:', mediaError);
              // Continue even if media deletion fails
            }
          }
        }
      }
      
      // Delete the confession from the database
      const { error: deleteError } = await supabase
        .from('person_confessions')
        .delete()
        .eq('id', confessionId);

      if (deleteError) throw deleteError;
      
      // Refresh the confessions list
      if (selectedPerson?.id) {
        loadPersonConfessions(selectedPerson.id);
      }
      
      Alert.alert('Success', 'Confession deleted successfully');
      
    } catch (error) {
      console.error('Error deleting confession:', error);
      Alert.alert('Error', 'Failed to delete confession. Please try again.');
    }
  };

  const refreshConfessions = () => {
    if (selectedPerson?.id) { // Refresh by ID
      loadPersonConfessions(selectedPerson.id); 
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
            {/* Display confessed person's name and profile image if available */}
            {item.confessedPersonName && (
              <View style={styles.confessedPersonContainer}>
                <Image
                  source={{ uri: item.confessedPersonProfileImage || 'https://via.placeholder.com/20x20?text=P' }}
                  style={styles.confessedPersonImage}
                />
              
              </View>
            )}
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

        {/* Removed is_tagged_in_comment here, will handle in comment screen */}
      </TouchableOpacity>
    );
  }; 

  const setShowAddPersonModalCallback = React.useCallback((value) => { // Changed from setShowAddPlaceModalCallback
    setShowAddPersonModal(value);
  }, [setShowAddPersonModal]); 

  return (
    <View style={styles.container}>
      <FlatList
        data={confessions}
        keyExtractor={(item) => item.id.toString()}
        // Add ref for scrolling
        ref={confessionsListRef}
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
              {/* <View style={styles.formGroup>
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
      <Modal
        visible={showCommentModal} // New state for CommentScreen modal
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCommentModal(false)}
      >
        <ConfessionPersonCommentScreen // Use the person-specific comment screen
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
  searchIcon: {
    marginRight: 10,
  },
  searchUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 15,
  },
  searchUserInfo: {
    flex: 1,
  },
  searchUsernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedBadge: {
    marginLeft: 5,
  },
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
  mentionText: {
    color: '#00ffff',
    fontWeight: 'bold',
  },
  confessedPersonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  confessedPersonImage: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 5,
  },
  confessedPersonText: {
    color: '#00ffff',
    fontSize: 12,
    fontWeight: 'bold',
  }
});

export default ConfessionPersonScreen;
