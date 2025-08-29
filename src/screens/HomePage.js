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
  const insets = useSafeAreaInsets();
  const pollIntervalRef = useRef(null);
  const matchingTimeoutRef = useRef(null);

  useEffect(() => {
    getCurrentUser();
    
    // Clean up any existing waiting entries for this user on mount
    return () => {
      cleanupUserWaitingEntry();
      clearPolling();
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

  const clearPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (matchingTimeoutRef.current) {
      clearTimeout(matchingTimeoutRef.current);
      matchingTimeoutRef.current = null;
    }
  };

  const findRandomMatch = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'Please login first');
      return;
    }

    if (isMatching) {
      return; // Prevent multiple simultaneous matching attempts
    }

    setIsMatching(true);
    setMatchingStatus('Checking for available users...');
    
    try {
      // First, clean up old waiting users (older than 5 minutes)
      await supabase.rpc('cleanup_old_waiting_users');

      // Clean up any existing entries for current user
      await cleanupUserWaitingEntry();

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

      setMatchingStatus('Looking for available matches...');

      // Step 1: Try to find opposite gender match in waiting users
      let availableMatch = null;
      
      if (currentUser.gender === 'male' || currentUser.gender === 'female') {
        const oppositeGender = currentUser.gender === 'male' ? 'female' : 'male';
        
        const { data: oppositeMatches } = await supabase
          .from('waiting_users')
          .select('*')
          .eq('gender', oppositeGender)
          .eq('status', 'waiting')
          .neq('user_id', currentUser.id)
          .order('created_at', { ascending: true })
          .limit(1);
          
        if (oppositeMatches && oppositeMatches.length > 0) {
          availableMatch = oppositeMatches[0];
        }
      }

      // Step 2: If no opposite gender, try same gender
      if (!availableMatch && currentUser.gender) {
        const { data: sameGenderMatches } = await supabase
          .from('waiting_users')
          .select('*')
          .eq('gender', currentUser.gender)
          .eq('status', 'waiting')
          .neq('user_id', currentUser.id)
          .order('created_at', { ascending: true })
          .limit(1);
          
        if (sameGenderMatches && sameGenderMatches.length > 0) {
          availableMatch = sameGenderMatches[0];
        }
      }

      // Step 3: If still no match, try any available user
      if (!availableMatch) {
        const { data: anyMatches } = await supabase
          .from('waiting_users')
          .select('*')
          .eq('status', 'waiting')
          .neq('user_id', currentUser.id)
          .order('created_at', { ascending: true })
          .limit(1);
          
        if (anyMatches && anyMatches.length > 0) {
          availableMatch = anyMatches[0];
        }
      }

      // If we found a match, create the call
      if (availableMatch) {
        setMatchingStatus('Match found! Connecting...');
        
        const callIdToUse = availableMatch.call_id;
        
        // Use a transaction-like approach with error handling
        try {
          // Remove the matched user from waiting list first
          const { error: deleteError } = await supabase
            .from('waiting_users')
            .delete()
            .eq('user_id', availableMatch.user_id);

          if (deleteError) {
            console.error('Error removing waiting user:', deleteError);
            setIsMatching(false);
            setMatchingStatus('');
            Alert.alert('Error', 'Failed to connect. Please try again.');
            return;
          }

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
            
            // If call creation failed, restore the waiting user
            await supabase
              .from('waiting_users')
              .insert({
                user_id: availableMatch.user_id,
                username: availableMatch.username,
                gender: availableMatch.gender,
                call_id: availableMatch.call_id,
                status: 'waiting'
              });

            setIsMatching(false);
            setMatchingStatus('');
            Alert.alert('Error', 'Failed to create call session. Please try again.');
            return;
          }

          setCallId(callIdToUse);
          setIsMatching(false);
          setMatchingStatus('');
          
          // Navigate to call page
          navigation.navigate('CallPage', {
            data: currentUser.username,
            id: callIdToUse,
            matchedUser: availableMatch.username,
            isJoining: true
          });

        } catch (error) {
          console.error('Error in match creation process:', error);
          setIsMatching(false);
          setMatchingStatus('');
          Alert.alert('Error', 'Failed to connect. Please try again.');
        }

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
            status: 'waiting'
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
      Alert.alert('Error', 'Failed to find a match. Please try again.');
    }
  };

  const startMatchingPolling = (callId) => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        // Check if someone joined our call
        const { data: activeCall } = await supabase
          .from('active_calls')
          .select('*')
          .eq('call_id', callId)
          .eq('status', 'active')
          .limit(1);

        if (activeCall && activeCall.length > 0) {
          clearPolling();
          setMatchingStatus('');
          
          const call = activeCall[0];
          const matchedUser = call.user1_id === currentUser.id ? call.user2_name : call.user1_name;
          
          // Navigate to call page
          navigation.navigate('CallPage', {
            data: currentUser.username,
            id: callId,
            matchedUser: matchedUser,
            isJoining: false
          });
        }
      } catch (error) {
        console.error('Error polling for match:', error);
      }
    }, 2000); // Poll every 2 seconds

    // Stop polling after 5 minutes and remove from waiting list
    matchingTimeoutRef.current = setTimeout(async () => {
      clearPolling();
      setMatchingStatus('');
      await cleanupUserWaitingEntry();
      Alert.alert('Timeout', 'No match found within 5 minutes. Please try again.');
    }, 300000); // 5 minutes
  };

  const cancelWaiting = async () => {
    clearPolling();
    await cleanupUserWaitingEntry();
    setMatchingStatus('');
    setCallId('');
    setIsMatching(false);
  };

  const handleGoBack = () => {
    if (isMatching || matchingStatus) {
      cancelWaiting();
    }
    navigation.navigate('MainApp');
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
        <View style={styles.headerRight} />
      </View>
      <View style={styles.container}>
        <View style={styles.userInfo}>
          <Text style={styles.infoText}>Username: {name || 'Loading...'}</Text>
          <Text style={styles.infoText}>Call ID: {callId || 'Will be generated'}</Text>
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
          <Text style={styles.statusText}>{matchingStatus}</Text>
        )}

        <TouchableOpacity
          style={[styles.joinButton, (isMatching && !isWaiting) && styles.joinButtonDisabled]}
          onPress={isWaiting ? cancelWaiting : findRandomMatch}
          disabled={(isMatching && !isWaiting) || !name}
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

        <Text style={styles.infoText}>
          Priority matching: {currentUser?.gender === 'male' ? 'Female' : currentUser?.gender === 'female' ? 'Male' : 'Anyone'}
        </Text>
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
  statusText: {
    color: '#00aaff',
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 10,
    textAlign: 'center',
  },
  input: {
    marginVertical: 12,
    marginHorizontal: 20,
    width: '85%',
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
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 20,
    elevation: 3,
    shadowColor: '#00aaff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    minWidth: 200,
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
});

export default HomePage;