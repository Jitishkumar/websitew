import React, { useEffect, useState, useRef } from 'react';
import { 
  Text, 
  StyleSheet, 
  View, 
  TouchableOpacity, 
  SafeAreaView, 
  Alert, 
  Linking,
  BackHandler,
  AppState
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

function CallPage(props) {
  console.log(props.route.params);
  const name = props.route.params.data;
  const id = props.route.params.id;
  const roomUrl = props.route.params.roomUrl;
  const matchedUser = props.route.params.matchedUser || 'Unknown User';
  const insets = useSafeAreaInsets();
  const [callEnded, setCallEnded] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const callTimerRef = useRef(null);
  const cleanupDoneRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const callStartTimeRef = useRef(Date.now());

  // Auto-return to home when app regains focus after 30 seconds
  useFocusEffect(
    React.useCallback(() => {
      const handleAppStateChange = (nextAppState) => {
        console.log('App state changed:', appStateRef.current, '->', nextAppState);
        
        if (appStateRef.current === 'background' && nextAppState === 'active') {
          // App came back from background
          const timeInCall = Date.now() - callStartTimeRef.current;
          
          if (timeInCall > 30000) { // If more than 30 seconds have passed
            console.log('🔄 App returned from background after call, auto-returning to home');
            Alert.alert(
              'Call Completed',
              'Welcome back! Ready for another match?',
              [
                {
                  text: 'Find New Match',
                  onPress: () => handleCallEnd('auto_return'),
                }
              ]
            );
          }
        }
        
        appStateRef.current = nextAppState;
      };

      const subscription = AppState.addEventListener('change', handleAppStateChange);
      
      return () => subscription?.remove();
    }, [])
  );

  useEffect(() => {
    getCurrentUser();
    openJitsiInBrowser();
    
    // Start 3-minute timer for automatic call end
    callTimerRef.current = setTimeout(() => {
      if (!callEnded) {
        Alert.alert('Time Up', 'Call duration limit (3 minutes) reached.');
        handleCallEnd('time_limit');
      }
    }, 180000); // 3 minutes

    // Handle Android back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleGoBack();
      return true;
    });
    
    return () => {
      if (callTimerRef.current) {
        clearTimeout(callTimerRef.current);
      }
      backHandler.remove();
      
      // Clean up when component unmounts
      if (!cleanupDoneRef.current) {
        cleanupCallData();
      }
    };
  }, []);

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const openJitsiInBrowser = async () => {
    try {
      // Enhanced Jitsi URL with desktop mode and better configuration
      const jitsiParams = new URLSearchParams({
        // Force desktop mode for better quality and features
        'config.isMobile': 'false',
        'config.disableMobile': 'true',
        // User configuration
        'userInfo.displayName': name || 'User',
        // Video/Audio quality settings for desktop mode
        'config.resolution': '720',
        'config.constraints.video.height.ideal': '720',
        'config.constraints.video.width.ideal': '1280',
        'config.startWithVideoMuted': 'false',
        'config.startWithAudioMuted': 'false',
        // Disable authentication and moderation
        'config.requireDisplayName': 'false',
        'config.prejoinPageEnabled': 'false',
        'config.enableWelcomePage': 'false',
        'config.enableClosePage': 'false',
        'config.disableModeratorIndicator': 'true',
        'config.enableUserRolesBasedOnToken': 'false',
        'config.enableFeaturesBasedOnToken': 'false',
        'config.enableAuth': 'false',
        'config.enableGuests': 'true',
        // Enhanced features for desktop mode
        'config.enableLayerSuspension': 'true',
        'config.enableTalkWhileMuted': 'true',
        'config.enableNoAudioSignal': 'true',
        'config.enableNoisyMicDetection': 'true',
        // Disable lobby and authentication
        'config.enableLobby': 'false',
        'config.enableLobbyChat': 'false',
        'config.disableInviteFunctions': 'true',
        'config.doNotStoreRoom': 'true',
        // Enable video effects and filters
        'config.videoQuality.maxBitrateForTileView': '2500000',
        'config.videoQuality.minHeightForQualityLvl': '360',
        'config.enableInsecureRoomNameWarning': 'false',
      });
      
      // Use desktop user agent to force desktop mode
      const jitsiUrl = `https://meet.jit.si/${id}?${jitsiParams.toString()}`;
      
      console.log('🖥️ Opening Jitsi in desktop mode:', jitsiUrl);
      
      const supported = await Linking.canOpenURL(jitsiUrl);
      if (supported) {
        await Linking.openURL(jitsiUrl);
        console.log('✅ Opened Jitsi in browser with desktop mode');
      } else {
        Alert.alert('Error', 'Cannot open video call');
      }
    } catch (error) {
      console.error('Error opening Jitsi:', error);
      Alert.alert('Error', 'Failed to open video call');
    }
  };

  const cleanupCallData = async () => {
    if (cleanupDoneRef.current) return; // Prevent duplicate cleanup
    cleanupDoneRef.current = true;
    
    if (!currentUser) {
      console.log('⚠️ No current user for cleanup');
      return;
    }
    
    try {
      console.log('🧹 Cleaning up call data for user:', currentUser.id);
      
      // 1. Delete from active_calls table (by call_id)
      const { error: callError } = await supabase
        .from('active_calls')
        .delete()
        .eq('call_id', id);

      if (callError) {
        console.error('Error deleting from active_calls:', callError);
      } else {
        console.log('✅ Deleted from active_calls');
      }

      // 2. Delete from waiting_users table (by user_id)
      const { error: waitingError } = await supabase
        .from('waiting_users')
        .delete()
        .eq('user_id', currentUser.id);

      if (waitingError) {
        console.error('Error deleting from waiting_users:', waitingError);
      } else {
        console.log('✅ Deleted from waiting_users');
      }

      // 3. EXTRA: Also delete any other stuck records for this user
      // This handles edge cases where records weren't properly cleaned
      const { error: extraCleanupError } = await supabase
        .from('active_calls')
        .delete()
        .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
        .in('status', ['matched', 'active']);

      if (extraCleanupError) {
        console.error('Error in extra cleanup:', extraCleanupError);
      } else {
        console.log('✅ Extra cleanup completed');
      }
      
      console.log('✅ Cleanup completed successfully');
    } catch (error) {
      console.error('Error cleaning up call data:', error);
    }
  };

  const handleCallEnd = async (reason = 'user_ended') => {
    if (callEnded) {
      console.log('⚠️ Call already ended, auto-starting new match');
      // Auto-start new match instead of just going to home
      props.navigation.replace('MainApp', { screen: 'Home', params: { autoStartMatch: true } });
      return;
    }
    
    setCallEnded(true);
    
    // Clear timer
    if (callTimerRef.current) {
      clearTimeout(callTimerRef.current);
    }
    
    console.log('📞 Call ended:', { callID: id, reason });
    
    try {
      // Cleanup database
      await cleanupCallData();
      console.log('✅ Database cleanup completed, auto-starting new match');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
    
    // Navigate back to homepage with autoStartMatch flag to automatically find new match
    console.log('🏠 Replacing current screen with MainApp -> Home (auto-start match)');
    props.navigation.replace('MainApp', { screen: 'Home', params: { autoStartMatch: true } });
  };

  const handleGoBack = () => {
    if (!callEnded) {
      Alert.alert(
        'End Call',
        'Are you sure you want to end this call?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'End Call',
            style: 'destructive',
            onPress: () => handleCallEnd('user_ended'),
          },
        ]
      );
    } else {
      console.log('🏠 Call already ended, navigating to home via handleGoBack');
      props.navigation.replace('MainApp', { screen: 'Home' });
    }
  };
  
  const headerStyle = {
    ...styles.header,
    paddingTop: insets.top > 0 ? insets.top : 16,
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={headerStyle}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="call-outline" size={24} color="#ff4444" />
          <Text style={styles.endCallText}>End Call</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Video Call</Text>
          <Text style={styles.matchInfo}>Connected with: {matchedUser}</Text>
          <Text style={styles.timerInfo}>Call opened in browser (Desktop Mode)</Text>
          <Text style={styles.timerInfo}>Call limit: 3 minutes</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.statusIndicator}>
            <View style={styles.activeIndicator} />
            <Text style={styles.activeText}>Live</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.callContainer}>
        <View style={styles.instructionsContainer}>
          <Ionicons name="videocam" size={80} color="#ff00ff" />
          <Text style={styles.instructionsTitle}>Video Call Started</Text>
          <Text style={styles.instructionsText}>
            Your video call has been opened in your browser.
          </Text>
          <Text style={styles.instructionsText}>
            🖥️ Desktop mode enabled for better quality!
          </Text>
          <Text style={styles.instructionsText}>
            Switch to your browser to join the call.
          </Text>
          <Text style={styles.instructionsSubtext}>
            Room: {id}
          </Text>
          <Text style={styles.instructionsSubtext}>
            Matched with: {matchedUser}
          </Text>
          
          <View style={styles.featuresContainer}>
            <Text style={styles.featuresTitle}>✨ Available Features:</Text>
            <Text style={styles.featureText}>📹 HD Video Quality (720p)</Text>
            <Text style={styles.featureText}>🎤 Noise Suppression</Text>
            <Text style={styles.featureText}>🖼️ Background Blur/Effects</Text>
            <Text style={styles.featureText}>💬 Chat Messages</Text>
            <Text style={styles.featureText}>📱 Screen Sharing</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.endCallButton}
            onPress={() => handleCallEnd('user_ended')}
          >
            <Ionicons name="call" size={24} color="#fff" />
            <Text style={styles.endCallButtonText}>End Call & Return Home</Text>
          </TouchableOpacity>
          
          <Text style={styles.warningText}>
            ⚠️ Call will automatically end after 3 minutes
          </Text>
          
          <Text style={styles.autoReturnText}>
            🔄 App will auto-return to Home when you come back
          </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 20,
  },
  endCallText: {
    color: '#ff4444',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  matchInfo: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  timerInfo: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    marginTop: 1,
  },
  headerRight: {
    width: 60,
    alignItems: 'flex-end',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00ff00',
    marginRight: 4,
  },
  activeText: {
    color: '#00ff00',
    fontSize: 10,
    fontWeight: 'bold',
  },
  callContainer: {
    flex: 1,
    backgroundColor: '#0a0a2a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  instructionsContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    borderRadius: 20,
    padding: 30,
    borderWidth: 2,
    borderColor: '#ff00ff',
    maxWidth: 400,
  },
  instructionsTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  instructionsText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  instructionsSubtext: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  featuresContainer: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  featuresTitle: {
    color: '#ff00ff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  featureText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 2,
  },
  endCallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff4444',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 20,
    gap: 10,
  },
  endCallButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  warningText: {
    color: '#ffaa00',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 15,
  },
  autoReturnText: {
    color: '#00ff88',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default CallPage;