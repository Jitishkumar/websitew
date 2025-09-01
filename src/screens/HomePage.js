import { Text, View, StyleSheet, Alert, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { TextInput } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

function HomePage({navigation}) {
  const [name, setName] = useState('');
  const [callId, setCallId] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [isMatching, setIsMatching] = useState(false);
  const [matchingStatus, setMatchingStatus] = useState('');
  const [waitingUsers, setWaitingUsers] = useState(0);
  const insets = useSafeAreaInsets();
  const pollIntervalRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    getCurrentUser();
    getWaitingUsersCount();
    
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
      <View style={headerStyle}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Random Video Call</Text>
        <View style={styles.headerRight}>
          {waitingUsers > 0 && (
            <View style={styles.waitingIndicator}>
              <Text style={styles.waitingCount}>{waitingUsers}</Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.container}>
        <View style={styles.userInfo}>
          <Text style={styles.infoText}>Username: {name || 'Loading...'}</Text>
          <Text style={styles.infoText}>Call ID: {callId || 'Will be generated'}</Text>
          {waitingUsers > 0 && (
            <Text style={styles.waitingText}>
              {waitingUsers} user{waitingUsers === 1 ? '' : 's'} waiting
            </Text>
          )}
        </View>

        <TextInput 
          style={styles.input}
          placeholder="Your username (auto-filled)" 
          value={name}
          editable={false}
          mode="outlined"
          outlineColor="rgba(255, 255, 255, 0.5)"
          activeOutlineColor="#ffffff"
          elevation={2}
          theme={{ colors: { text: '#ffffff', primary: '#ffffff', placeholder: 'rgba(255, 255, 255, 0.6)' } }}
          textColor="#ffffff"
          contentStyle={styles.inputText}
        />

        <TextInput 
          style={styles.input}
          placeholder="Call ID (auto-generated)" 
          value={callId}
          editable={false}
          mode="outlined"
          outlineColor="rgba(255, 255, 255, 0.5)"
          activeOutlineColor="#ffffff"
          elevation={2}
          theme={{ colors: { text: '#ffffff', primary: '#ffffff', placeholder: 'rgba(255, 255, 255, 0.6)' } }}
          textColor="#ffffff"
          contentStyle={styles.inputText}
        />

        {matchingStatus && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>{matchingStatus}</Text>
            {isMatching && !isWaiting && (
              <ActivityIndicator 
                size="small" 
                color="#00aaff" 
                style={styles.statusSpinner} 
              />
            )}
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.joinButton, 
            (isMatching && !isWaiting) && styles.joinButtonDisabled,
            !currentUser?.gender && styles.joinButtonDisabled
          ]}
          onPress={isWaiting ? cancelWaiting : findRandomMatch}
          disabled={(isMatching && !isWaiting) || !name || !currentUser?.gender}
        >
          {isMatching && !isWaiting ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#ffffff" style={styles.spinner} />
              <Text style={styles.joinButtonText}>SEARCHING...</Text>
            </View>
          ) : isWaiting ? (
            <Text style={styles.joinButtonText}>CANCEL WAITING</Text>
          ) : (
            <Text style={styles.joinButtonText}>FIND RANDOM MATCH</Text>
          )}
        </TouchableOpacity>

        <View style={styles.matchingInfo}>
          <Text style={styles.infoText}>
            Priority matching: {getPriorityGender()}
          </Text>
          {!currentUser?.gender && (
            <Text style={styles.warningText}>
              ⚠️ Please complete your profile with gender information
            </Text>
          )}
        </View>

        <View style={styles.helpText}>
          <Text style={styles.helpTitle}>How it works:</Text>
          <Text style={styles.helpItem}>• Priority given to opposite gender matches</Text>
          <Text style={styles.helpItem}>• Falls back to same gender if no opposite available</Text>
          <Text style={styles.helpItem}>• 3-minute call limit for all matches</Text>
          <Text style={styles.helpItem}>• Automatic cleanup after 5 minutes of waiting</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0a2a',
    paddingTop: 0,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a2a',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#0a0a2a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 0, 255, 0.2)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerRight: {
    width: 40,
    alignItems: 'center',
  },
  waitingIndicator: {
    backgroundColor: '#00aaff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  waitingCount: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  userInfo: {
    marginBottom: 20,
    alignItems: 'center',
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginVertical: 4,
    textAlign: 'center',
  },
  waitingText: {
    color: '#00aaff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
  },
  warningText: {
    color: '#ffa500',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 15,
    minHeight: 30,
  },
  statusText: {
    color: '#00aaff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statusSpinner: {
    marginLeft: 10,
  },
  input: {
    marginVertical: 12,
    width: '100%',
    backgroundColor: 'transparent',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  inputText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  joinButton: {
    backgroundColor: '#00aaff',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 20,
    elevation: 3,
    shadowColor: '#00aaff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    minWidth: 220,
  },
  joinButtonDisabled: {
    backgroundColor: '#666666',
    shadowColor: '#666666',
  },
  joinButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
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
  },
  helpText: {
    marginTop: 30,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
  },
  helpTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  helpItem: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginVertical: 2,
    lineHeight: 18,
  },
});

export default HomePage;