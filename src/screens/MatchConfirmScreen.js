import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { MatchingService } from '../services/MatchingService';

function MatchConfirmScreen({ route, navigation }) {
  const { callData, userName } = route.params;
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30); // 30 seconds to accept/reject
  const [waitingForOther, setWaitingForOther] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  // Separate useEffect for timer to avoid setState in render
  useEffect(() => {
    // Countdown timer
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Auto-reject when timer reaches 0
  useEffect(() => {
    if (timeLeft === 0 && !loading) {
      console.log('⏰ Timer expired, auto-rejecting');
      handleReject();
    }
  }, [timeLeft, loading]);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user.id)
          .single();
        
        setCurrentUser({
          id: user.id,
          name: profile?.username || userName,
          email: user.email,
          avatar_url: profile?.avatar_url,
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleAccept = async () => {
    // Safety check for currentUser
    if (!currentUser || !currentUser.id) {
      console.error('❌ Current user not loaded yet');
      Alert.alert('Error', 'User data not loaded. Please try again.');
      navigation.navigate('MainApp', { screen: 'Home' });
      return;
    }

    setLoading(true);
    try {
      console.log('✅ User accepted match');
      
      // Update acceptance in database (simplified - no MatchingService)
      const updateField = callData.isUser1 ? 'user1_accepted' : 'user2_accepted';
      
      const { error: updateError } = await supabase
        .from('active_calls')
        .update({ [updateField]: true })
        .eq('id', callData.id);

      if (updateError) {
        console.error('Error updating acceptance:', updateError);
        Alert.alert('Error', 'Failed to accept match');
        setLoading(false);
        return;
      }

      // Check if both users have accepted
      const { data: updatedCall, error: checkError } = await supabase
        .from('active_calls')
        .select('user1_accepted, user2_accepted')
        .eq('id', callData.id)
        .single();

      if (checkError) {
        console.error('Error checking acceptance:', checkError);
        setLoading(false);
        return;
      }

      if (updatedCall.user1_accepted && updatedCall.user2_accepted) {
        // Both accepted - update status and start call
        await supabase
          .from('active_calls')
          .update({ 
            status: 'active',
            started_at: new Date().toISOString()
          })
          .eq('id', callData.id);

        console.log('🎉 Both users accepted, starting call');
        navigation.replace('CallPage', {
          data: currentUser.name,
          id: callData.roomName,
          roomUrl: callData.roomUrl,
          matchedUser: callData.otherUserName,
          isUser1: callData.isUser1,
          callRecordId: callData.id,
          callType: callData.callType || 'video', // Pass call type
        });
      } else {
        // Waiting for other user
        console.log('⏳ Waiting for other user to accept');
        setWaitingForOther(true);
        setLoading(false);
        
        // Poll for other user's response
        const pollInterval = setInterval(async () => {
          try {
            const { data: call } = await supabase
              .from('active_calls')
              .select('*')
              .eq('id', callData.id)
              .single();

            if (call) {
              if (call.user1_accepted && call.user2_accepted) {
                // Both accepted
                clearInterval(pollInterval);
                navigation.replace('CallPage', {
                  data: currentUser.name,
                  id: callData.roomName,
                  roomUrl: callData.roomUrl,
                  matchedUser: callData.otherUserName,
                  isUser1: callData.isUser1,
                  callRecordId: callData.id,
                  callType: callData.callType || 'video', // Pass call type
                });
              } else if (call.status === 'rejected') {
                // Other user rejected
                clearInterval(pollInterval);
                Alert.alert('Match Rejected', 'The other user declined. Finding you another match...', [
                  { text: 'OK', onPress: () => navigation.navigate('MainApp', { screen: 'Home' }) }
                ]);
              }
            }
          } catch (error) {
            console.error('Error polling:', error);
          }
        }, 2000);

        // Timeout after 30 seconds
        setTimeout(() => {
          clearInterval(pollInterval);
          if (waitingForOther) {
            Alert.alert('Timeout', 'The other user did not respond. Finding you another match...', [
              { text: 'OK', onPress: () => navigation.navigate('MainApp', { screen: 'Home' }) }
            ]);
          }
        }, 30000);
      }
    } catch (error) {
      console.error('Error accepting match:', error);
      Alert.alert('Error', 'Failed to accept match');
      setLoading(false);
    }
  };

  const handleReject = async () => {
    // Safety check for currentUser
    if (!currentUser || !currentUser.id) {
      console.error('❌ Current user not loaded yet');
      navigation.navigate('MainApp', { screen: 'Home' });
      return;
    }

    setLoading(true);
    try {
      // Delete the call record
      if (callData && callData.id) {
        await supabase
          .from('active_calls')
          .delete()
          .eq('id', callData.id);
      }

      console.log('✅ Match rejected, searching for next match');
      
      // Go back to home to find another match
      navigation.navigate('MainApp', { screen: 'Home' });
    } catch (error) {
      console.error('Error rejecting match:', error);
      navigation.navigate('MainApp', { screen: 'Home' });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff00ff" />
          <Text style={styles.loadingText}>
            {waitingForOther ? 'Waiting for other user...' : 'Connecting...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Match Found!</Text>
        <Text style={styles.subtitle}>
          {waitingForOther ? 'Waiting for response...' : `Accept to start ${callData.callType || 'video'} call`}
        </Text>
      </View>

      <View style={styles.content}>
        {/* Current User */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            {currentUser?.avatar_url ? (
              <Image 
                source={{ uri: currentUser.avatar_url }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarText}>
                {currentUser?.name?.charAt(0).toUpperCase() || 'Y'}
              </Text>
            )}
          </View>
          <Text style={styles.userName}>{currentUser?.name || 'You'}</Text>
          <Text style={styles.userEmail}>{currentUser?.email}</Text>
          <Text style={styles.userLabel}>You</Text>
        </View>

        {/* VS */}
        <View style={styles.vsContainer}>
          <Text style={styles.vsText}>VS</Text>
        </View>

        {/* Other User */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            {callData.otherUserAvatar ? (
              <Image 
                source={{ uri: callData.otherUserAvatar }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarText}>
                {callData.otherUserName?.charAt(0).toUpperCase() || 'U'}
              </Text>
            )}
          </View>
          <Text style={styles.userName}>{callData.otherUserName}</Text>
          <Text style={styles.userLabel}>Matched User</Text>
        </View>
      </View>

      {!waitingForOther && (
        <>
          {/* Timer */}
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>Responding in: {timeLeft}s</Text>
            <View style={styles.timerBar}>
              <View
                style={[
                  styles.timerFill,
                  { width: `${(timeLeft / 30) * 100}%` },
                ]}
              />
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.rejectButton]}
              onPress={handleReject}
              disabled={loading}
            >
              <Ionicons name="close" size={20} color="#fff" />
              <Text style={styles.buttonText}>Reject</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.acceptButton]}
              onPress={handleAccept}
              disabled={loading}
            >
              <Ionicons name="videocam" size={20} color="#fff" />
              <Text style={styles.buttonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {waitingForOther && (
        <View style={styles.waitingContainer}>
          <ActivityIndicator size="large" color="#ff00ff" />
          <Text style={styles.waitingText}>
            Waiting for {callData.otherUserName} to respond...
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleReject}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {waitingForOther 
            ? 'The other user has 30 seconds to respond'
            : "If you don't respond, we'll find you another match"
          }
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a2a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#fff',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 0, 255, 0.2)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ff00ff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  userCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: '#ff00ff',
    width: '100%',
    marginVertical: 10,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ff00ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 8,
  },
  userLabel: {
    fontSize: 12,
    color: '#ff00ff',
    fontWeight: 'bold',
  },
  vsContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  vsText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff00ff',
  },
  timerContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  timerText: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
    textAlign: 'center',
  },
  timerBar: {
    height: 4,
    backgroundColor: 'rgba(255, 0, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    backgroundColor: '#ff00ff',
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  rejectButton: {
    backgroundColor: '#ff4444',
  },
  acceptButton: {
    backgroundColor: '#00ff00',
  },
  cancelButton: {
    backgroundColor: '#ff4444',
    marginTop: 20,
    paddingHorizontal: 40,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  waitingContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  waitingText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default MatchConfirmScreen;