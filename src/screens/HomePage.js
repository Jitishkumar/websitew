import { Text, View, StyleSheet, Alert, TouchableOpacity, SafeAreaView, ActivityIndicator, Animated, Dimensions } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { TextInput } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

function HomePage({navigation}) {
  const [name, setName] = useState('');
  const [callId, setCallId] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [isMatching, setIsMatching] = useState(false);
  const [matchingStatus, setMatchingStatus] = useState('');
  const [waitingUsers, setWaitingUsers] = useState(0);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const insets = useSafeAreaInsets();
  const pollIntervalRef = useRef(null);
  const timeoutRef = useRef(null);

  // Animation refs for ultra-premium effects
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const buttonPulseAnim = useRef(new Animated.Value(1)).current;
  const statusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getCurrentUser();
    getWaitingUsersCount();
    requestPermissions();
    initializeAnimations();
    
    // Clean up any existing waiting entries for this user on mount
    return () => {
      cleanupUserWaitingEntry();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const initializeAnimations = () => {
    // Main entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous pulse animation
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

    // Continuous glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Continuous shimmer animation
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: true,
      })
    ).start();

    // Button pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(buttonPulseAnim, {
          toValue: 1.02,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(buttonPulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const requestPermissions = async () => {
    try {
      // Request camera permissions
      const cameraStatus = await Camera.requestCameraPermissionsAsync();
      
      // Request microphone permissions
      const audioStatus = await Audio.requestPermissionsAsync();
      
      if (cameraStatus.status === 'granted' && audioStatus.status === 'granted') {
        setPermissionsGranted(true);
        console.log('Camera and microphone permissions granted');
      } else {
        setPermissionsGranted(false);
        Alert.alert(
          'Permissions Required',
          'Camera and microphone permissions are required for video calls. Please enable them in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Try Again', onPress: requestPermissions }
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      setPermissionsGranted(false);
    }
  };

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, gender')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setCurrentUser({...user, ...profile});
          setName(profile.username || '');
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      Alert.alert('Error', 'Failed to load user profile. Please try again.');
    }
  };

  const getWaitingUsersCount = async () => {
    try {
      const { count } = await supabase
        .from('waiting_users')
        .select('*', { count: 'exact' })
        .eq('status', 'waiting');
      setWaitingUsers(count || 0);
    } catch (error) {
      console.error('Error getting waiting users count:', error);
    }
  };

  const generateCallId = () => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 9);
    return `call_${timestamp}_${randomStr}`;
  };

  const cleanupUserWaitingEntry = async () => {
    if (currentUser) {
      try {
        await supabase
          .from('waiting_users')
          .delete()
          .eq('user_id', currentUser.id);
      } catch (error) {
        console.error('Error cleaning up waiting entry:', error);
      }
    }
  };

  const cleanupExpiredEntries = async () => {
    try {
      // Clean up waiting users older than 10 minutes
      await supabase
        .from('waiting_users')
        .delete()
        .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

      // Clean up active calls older than 5 minutes that are still marked as active
      await supabase
        .from('active_calls')
        .delete()
        .eq('status', 'active')
        .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());
    } catch (error) {
      console.error('Error cleaning up expired entries:', error);
    }
  };

  const findRandomMatch = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'Please login first');
      return;
    }

    if (!currentUser.gender) {
      Alert.alert('Profile Incomplete', 'Please complete your profile with gender information to enable matching.');
      return;
    }

    // Check permissions before starting match
    if (!permissionsGranted) {
      Alert.alert(
        'Permissions Required',
        'Camera and microphone permissions are required for video calls. Please grant permissions first.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Grant Permissions', onPress: requestPermissions }
        ]
      );
      return;
    }

    setIsMatching(true);
    setMatchingStatus('Preparing to find a match...');
    
    try {
      // Clean up expired entries first
      await cleanupExpiredEntries();

      // Check if user is already in an active call
      const { data: activeCall } = await supabase
        .from('active_calls')
        .select('id')
        .eq('status', 'active')
        .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
        .limit(1);

      if (activeCall && activeCall.length > 0) {
        setIsMatching(false);
        setMatchingStatus('');
        Alert.alert('Already in Call', 'You are already in an active call. Please end your current call first.');
        return;
      }

      // Check if user is already waiting
      const { data: alreadyWaiting } = await supabase
        .from('waiting_users')
        .select('id, call_id')
        .eq('user_id', currentUser.id)
        .eq('status', 'waiting')
        .limit(1);

      if (alreadyWaiting && alreadyWaiting.length > 0) {
        setIsMatching(false);
        setMatchingStatus('');
        setCallId(alreadyWaiting[0].call_id);
        Alert.alert('Already Searching', 'You are already searching for a match. Please wait or cancel your current search.');
        return;
      }

      setMatchingStatus('Looking for available matches...');
      await getWaitingUsersCount();

      // Step 1: Try to find opposite gender match in waiting users
      let availableMatch = null;
      
      if (currentUser.gender === 'male' || currentUser.gender === 'female') {
        const oppositeGender = currentUser.gender === 'male' ? 'female' : 'male';
        
        const { data: oppositeMatches, error: oppositeError } = await supabase
          .from('waiting_users')
          .select('*')
          .eq('gender', oppositeGender)
          .eq('status', 'waiting')
          .neq('user_id', currentUser.id)
          .limit(1);
          
        if (oppositeError) {
          console.error('Error finding opposite gender matches:', oppositeError);
        } else if (oppositeMatches && oppositeMatches.length > 0) {
          availableMatch = oppositeMatches[0];
        }
      }

      // Step 2: If no opposite gender, try same gender
      if (!availableMatch && currentUser.gender) {
        const { data: sameGenderMatches, error: sameGenderError } = await supabase
          .from('waiting_users')
          .select('*')
          .eq('gender', currentUser.gender)
          .eq('status', 'waiting')
          .neq('user_id', currentUser.id)
          .limit(1);
          
        if (sameGenderError) {
          console.error('Error finding same gender matches:', sameGenderError);
        } else if (sameGenderMatches && sameGenderMatches.length > 0) {
          availableMatch = sameGenderMatches[0];
        }
      }

      // Step 3: If still no match, try any available user
      if (!availableMatch) {
        const { data: anyMatches, error: anyError } = await supabase
          .from('waiting_users')
          .select('*')
          .eq('status', 'waiting')
          .neq('user_id', currentUser.id)
          .limit(1);
          
        if (anyError) {
          console.error('Error finding any matches:', anyError);
        } else if (anyMatches && anyMatches.length > 0) {
          availableMatch = anyMatches[0];
        }
      }

      // If we found a match, create the call
      if (availableMatch) {
        setMatchingStatus('Match found! Setting up call...');
        
        // Use the waiting user's existing call_id
        const callIdToUse = availableMatch.call_id;
        
        // Create active call session
        const { error: sessionError } = await supabase
          .from('active_calls')
          .insert({
            call_id: callIdToUse,
            user1_id: availableMatch.user_id,
            user1_name: availableMatch.username,
            user2_id: currentUser.id,
            user2_name: currentUser.username,
            created_at: new Date().toISOString(),
            status: 'active'
          });

        if (sessionError) {
          console.error('Error creating session:', sessionError);
          setIsMatching(false);
          setMatchingStatus('');
          Alert.alert('Error', 'Failed to create call session. Please try again.');
          return;
        }

        // Remove the matched user from waiting list
        const { error: deleteError } = await supabase
          .from('waiting_users')
          .delete()
          .eq('user_id', availableMatch.user_id);

        if (deleteError) {
          console.error('Error removing matched user from waiting list:', deleteError);
        }

        setCallId(callIdToUse);
        setIsMatching(false);
        setMatchingStatus('');
        
        // Add a small delay to ensure database operations complete
        setTimeout(() => {
          navigation.navigate('CallPage', {
            data: currentUser.username,
            id: callIdToUse,
            matchedUser: availableMatch.username,
            isJoining: true
          });
        }, 500);

      } else {
        // No match found, add user to waiting list
        setMatchingStatus('No users available. Adding you to waiting list...');
        
        const newCallId = generateCallId();
        
        const { error: waitingError } = await supabase
          .from('waiting_users')
          .insert({
            user_id: currentUser.id,
            username: currentUser.username,
            gender: currentUser.gender,
            call_id: newCallId,
            status: 'waiting',
            created_at: new Date().toISOString()
          });

        if (waitingError) {
          console.error('Error adding to waiting list:', waitingError);
          setIsMatching(false);
          setMatchingStatus('');
          Alert.alert('Error', 'Failed to add to waiting list. Please try again.');
          return;
        }

        setCallId(newCallId);
        setIsMatching(false);
        setMatchingStatus('Waiting for someone to join...');
        
        // Start polling for matches
        startMatchingPolling(newCallId);
      }

    } catch (error) {
      console.error('Error finding match:', error);
      setIsMatching(false);
      setMatchingStatus('');
      Alert.alert('Error', 'Failed to find a match. Please check your connection and try again.');
    }
  };

  const startMatchingPolling = (callId) => {
    let pollCount = 0;
    const maxPolls = 150; // 5 minutes with 2-second intervals
    
    pollIntervalRef.current = setInterval(async () => {
      pollCount++;
      
      try {
        // Update waiting users count
        await getWaitingUsersCount();
        
        // Check if someone joined our call
        const { data: activeCall } = await supabase
          .from('active_calls')
          .select('*')
          .eq('call_id', callId)
          .eq('status', 'active')
          .limit(1);

        if (activeCall && activeCall.length > 0) {
          clearInterval(pollIntervalRef.current);
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          
          setMatchingStatus('Match found! Connecting...');
          
          const call = activeCall[0];
          const matchedUser = call.user1_id === currentUser.id ? call.user2_name : call.user1_name;
          
          // Add delay to show the status message
          setTimeout(() => {
            setMatchingStatus('');
            navigation.navigate('CallPage', {
              data: currentUser.username,
              id: callId,
              matchedUser: matchedUser,
              isJoining: false
            });
          }, 1000);
          
          return;
        }
        
        // Update status with poll count for user feedback
        if (pollCount % 15 === 0) { // Every 30 seconds
          setMatchingStatus(`Waiting for someone to join... (${Math.floor(pollCount / 30)}min)`);
        }
        
      } catch (error) {
        console.error('Error polling for match:', error);
      }
      
      // Stop polling after max attempts
      if (pollCount >= maxPolls) {
        clearInterval(pollIntervalRef.current);
        setMatchingStatus('');
        cleanupUserWaitingEntry();
        Alert.alert(
          'Search Timeout', 
          'No match found within 5 minutes. Would you like to try again?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Try Again', onPress: findRandomMatch }
          ]
        );
      }
    }, 2000);

    // Set a timeout as backup
    timeoutRef.current = setTimeout(async () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      setMatchingStatus('');
      await cleanupUserWaitingEntry();
      Alert.alert('Timeout', 'No match found within 5 minutes. Please try again.');
    }, 300000); // 5 minutes
  };

  const cancelWaiting = async () => {
    try {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      await cleanupUserWaitingEntry();
      setMatchingStatus('');
      setCallId('');
      setIsMatching(false);
      
      Alert.alert('Search Cancelled', 'Your search for a match has been cancelled.');
    } catch (error) {
      console.error('Error cancelling waiting:', error);
      Alert.alert('Error', 'Failed to cancel search. Please try again.');
    }
  };

  const handleGoBack = () => {
    navigation.navigate('MainApp');
  };

  const getPriorityGender = () => {
    if (!currentUser?.gender) return 'Please set your gender in profile';
    return currentUser.gender === 'male' ? 'Female users' : 
           currentUser.gender === 'female' ? 'Male users' : 'Anyone';
  };

  const headerStyle = {
    ...styles.header,
    paddingTop: insets.top > 0 ? insets.top : 16,
  };

  const isWaiting = matchingStatus.includes('Waiting for someone');

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Enhanced Header with animations */}
      <Animated.View
        style={[
          headerStyle,
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
          style={styles.headerGradient}
        >
          {/* Header glow effect */}
          <Animated.View
            style={[
              styles.headerGlow,
              {
                opacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.2, 0.6]
                })
              }
            ]}
          />
          
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color="#ff00ff" />
            </TouchableOpacity>
          </Animated.View>
          
          <Text style={styles.headerTitle}>Random Video Call</Text>
          
          <View style={styles.headerRight}>
            {waitingUsers > 0 && (
              <Animated.View 
                style={[
                  styles.waitingIndicator,
                  { transform: [{ scale: pulseAnim }] }
                ]}
              >
                <LinearGradient
                  colors={['#ff00ff', '#00ffff']}
                  style={styles.waitingBadge}
                >
                  <Text style={styles.waitingCount}>{waitingUsers}</Text>
                </LinearGradient>
              </Animated.View>
            )}
          </View>
          
          {/* Header shimmer effect */}
          <Animated.View
            style={[
              styles.headerShimmer,
              {
                opacity: shimmerAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0.3, 0]
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
              colors={['transparent', 'rgba(255, 0, 255, 0.4)', 'rgba(0, 255, 255, 0.4)', 'transparent']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={styles.shimmerGradient}
            />
          </Animated.View>
        </LinearGradient>
      </Animated.View>
      
      <Animated.View 
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {/* Enhanced User Info Section */}
        <Animated.View 
          style={[
            styles.userInfo,
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          <LinearGradient
            colors={['rgba(26, 26, 46, 0.8)', 'rgba(22, 33, 62, 0.6)']}
            style={styles.userInfoContainer}
          >
            <Animated.View
              style={[
                styles.userInfoGlow,
                {
                  opacity: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.1, 0.4]
                  })
                }
              ]}
            />
            <Text style={styles.infoText}>Username: {name || 'Loading...'}</Text>
            <Text style={styles.infoText}>Call ID: {callId || 'Will be generated'}</Text>
            {waitingUsers > 0 && (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Text style={styles.waitingText}>
                  {waitingUsers} user{waitingUsers === 1 ? '' : 's'} waiting
                </Text>
              </Animated.View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Enhanced Input Fields */}
        <Animated.View
          style={[
            styles.inputContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <LinearGradient
            colors={['rgba(255, 0, 255, 0.1)', 'rgba(0, 255, 255, 0.05)']}
            style={styles.inputGradient}
          >
            <TextInput 
              style={styles.input}
              placeholder="Your username (auto-filled)" 
              value={name}
              editable={false}
              mode="outlined"
              outlineColor="rgba(255, 0, 255, 0.3)"
              activeOutlineColor="#ff00ff"
              elevation={2}
              theme={{ colors: { text: '#ffffff', primary: '#ff00ff', placeholder: 'rgba(255, 255, 255, 0.6)' } }}
              textColor="#ffffff"
              contentStyle={styles.inputText}
            />

            <TextInput 
              style={styles.input}
              placeholder="Call ID (auto-generated)" 
              value={callId}
              editable={false}
              mode="outlined"
              outlineColor="rgba(255, 0, 255, 0.3)"
              activeOutlineColor="#ff00ff"
              elevation={2}
              theme={{ colors: { text: '#ffffff', primary: '#ff00ff', placeholder: 'rgba(255, 255, 255, 0.6)' } }}
              textColor="#ffffff"
              contentStyle={styles.inputText}
            />
          </LinearGradient>
        </Animated.View>

        {/* Enhanced Status Display */}
        {matchingStatus && (
          <Animated.View 
            style={[
              styles.statusContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            <LinearGradient
              colors={['rgba(0, 170, 255, 0.2)', 'rgba(255, 0, 255, 0.1)']}
              style={styles.statusGradient}
            >
              <Animated.View
                style={[
                  styles.statusGlow,
                  {
                    opacity: glowAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.2, 0.8]
                    })
                  }
                ]}
              />
              <Text style={styles.statusText}>{matchingStatus}</Text>
              {isMatching && !isWaiting && (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <ActivityIndicator 
                    size="small" 
                    color="#00aaff" 
                    style={styles.statusSpinner} 
                  />
                </Animated.View>
              )}
            </LinearGradient>
          </Animated.View>
        )}

        {/* Enhanced Main Button */}
        <Animated.View
          style={[
            {
              transform: [{ scale: buttonPulseAnim }]
            }
          ]}
        >
          <TouchableOpacity
            style={[
              styles.joinButton, 
              (isMatching && !isWaiting) && styles.joinButtonDisabled,
              (!currentUser?.gender || !permissionsGranted) && styles.joinButtonDisabled
            ]}
            onPress={isWaiting ? cancelWaiting : findRandomMatch}
            disabled={(isMatching && !isWaiting) || !name || !currentUser?.gender || !permissionsGranted}
          >
            <LinearGradient
              colors={
                (isMatching && !isWaiting) || (!currentUser?.gender || !permissionsGranted)
                  ? ['#666666', '#444444']
                  : isWaiting
                  ? ['#ff4444', '#cc0000']
                  : ['#ff00ff', '#00aaff', '#00ffff']
              }
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.buttonGradient}
            >
              <Animated.View
                style={[
                  styles.buttonGlow,
                  {
                    opacity: glowAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0.8]
                    })
                  }
                ]}
              />
              {isMatching && !isWaiting ? (
                <View style={styles.loadingContainer}>
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <ActivityIndicator size="small" color="#ffffff" style={styles.spinner} />
                  </Animated.View>
                  <Text style={styles.joinButtonText}>SEARCHING...</Text>
                </View>
              ) : isWaiting ? (
                <Text style={styles.joinButtonText}>CANCEL WAITING</Text>
              ) : (
                <Text style={styles.joinButtonText}>FIND RANDOM MATCH</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Enhanced Info Section */}
        <Animated.View 
          style={[
            styles.matchingInfo,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <LinearGradient
            colors={['rgba(26, 26, 46, 0.6)', 'rgba(22, 33, 62, 0.4)']}
            style={styles.infoGradient}
          >
            <Text style={styles.infoText}>
              Priority matching: {getPriorityGender()}
            </Text>
            {!currentUser?.gender && (
              <Animated.View 
                style={[
                  styles.genderWarning,
                  { transform: [{ scale: pulseAnim }] }
                ]}
              >
                <LinearGradient
                  colors={['rgba(255, 152, 0, 0.2)', 'rgba(255, 193, 7, 0.1)']}
                  style={styles.warningGradient}
                >
                  <Ionicons name="warning-outline" size={20} color="#ff9800" />
                  <Text style={styles.genderWarningText}>
                    Please complete your profile with gender information to enable matching.
                  </Text>
                </LinearGradient>
              </Animated.View>
            )}

            {!permissionsGranted && (
              <Animated.View 
                style={[
                  styles.permissionWarning,
                  { transform: [{ scale: pulseAnim }] }
                ]}
              >
                <LinearGradient
                  colors={['rgba(255, 68, 68, 0.2)', 'rgba(244, 67, 54, 0.1)']}
                  style={styles.warningGradient}
                >
                  <Ionicons name="camera-outline" size={20} color="#ff4444" />
                  <Text style={styles.permissionWarningText}>
                    Camera and microphone permissions required for video calls.
                  </Text>
                  <TouchableOpacity 
                    style={styles.permissionButton}
                    onPress={requestPermissions}
                  >
                    <LinearGradient
                      colors={['#ff4444', '#cc0000']}
                      style={styles.permissionButtonGradient}
                    >
                      <Text style={styles.permissionButtonText}>Grant Permissions</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </LinearGradient>
              </Animated.View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Enhanced Help Section */}
        <Animated.View 
          style={[
            styles.helpText,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <LinearGradient
            colors={['rgba(26, 26, 46, 0.4)', 'rgba(22, 33, 62, 0.2)']}
            style={styles.helpGradient}
          >
            <Text style={styles.helpTitle}>How it works:</Text>
            <Text style={styles.helpItem}>• Priority given to opposite gender matches</Text>
            <Text style={styles.helpItem}>• Falls back to same gender if no opposite available</Text>
            <Text style={styles.helpItem}>• 3-minute call limit for all matches</Text>
            <Text style={styles.helpItem}>• Automatic cleanup after 5 minutes of waiting</Text>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 0,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 0, 255, 0.2)',
    position: 'relative',
    overflow: 'hidden',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  shimmerGradient: {
    flex: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: 'rgba(255, 0, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  headerRight: {
    width: 40,
    alignItems: 'center',
  },
  waitingIndicator: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },
  waitingBadge: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingCount: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  userInfo: {
    marginBottom: 20,
    alignItems: 'center',
    width: '100%',
  },
  userInfoContainer: {
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    width: '100%',
    borderWidth: 2,
    borderColor: 'rgba(255, 0, 255, 0.3)',
    position: 'relative',
    overflow: 'hidden',
  },
  userInfoGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    borderRadius: 20,
  },
  inputContainer: {
    width: '100%',
    marginVertical: 10,
  },
  inputGradient: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 0, 255, 0.2)',
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    marginVertical: 4,
    textAlign: 'center',
    fontWeight: '500',
    textShadowColor: 'rgba(255, 0, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  waitingText: {
    color: '#00aaff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    textShadowColor: 'rgba(0, 170, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statusContainer: {
    marginVertical: 15,
    minHeight: 60,
    width: '100%',
  },
  statusGradient: {
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: 'rgba(0, 170, 255, 0.3)',
    position: 'relative',
    overflow: 'hidden',
  },
  statusGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 170, 255, 0.1)',
    borderRadius: 20,
  },
  statusText: {
    color: '#00aaff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 170, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statusSpinner: {
    marginLeft: 10,
  },
  input: {
    marginVertical: 8,
    width: '100%',
    backgroundColor: 'transparent',
  },
  inputText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  joinButton: {
    borderRadius: 25,
    marginTop: 20,
    elevation: 8,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    minWidth: 250,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  buttonGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  joinButtonDisabled: {
    elevation: 2,
    shadowColor: '#666666',
    shadowOpacity: 0.2,
  },
  joinButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginRight: 8,
  },
  matchingInfo: {
    marginTop: 20,
    alignItems: 'center',
    width: '100%',
  },
  infoGradient: {
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.2)',
  },
  genderWarning: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  permissionWarning: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  warningGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.3)',
    borderRadius: 12,
  },
  genderWarningText: {
    color: '#ff9800',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },
  permissionWarningText: {
    color: '#ff4444',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },
  permissionButton: {
    borderRadius: 8,
    marginLeft: 8,
    overflow: 'hidden',
  },
  permissionButtonGradient: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  helpText: {
    marginTop: 30,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
    width: '100%',
  },
  helpGradient: {
    padding: 20,
    borderRadius: 20,
    alignItems: 'flex-start',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.1)',
  },
  helpTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textShadowColor: 'rgba(255, 0, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  helpItem: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginVertical: 3,
    paddingLeft: 8,
    lineHeight: 20,
  },
});

export default HomePage;