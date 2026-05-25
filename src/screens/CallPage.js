import React, { useEffect, useState, useRef } from 'react';
import { 
  Text, 
  StyleSheet, 
  View, 
  TouchableOpacity, 
  SafeAreaView, 
  Alert, 
  AppState,
  PermissionsAndroid,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { WebView } from 'react-native-webview';
import { Camera } from 'expo-camera';

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
  const appStateRef = useRef(AppState.currentState);
  const webViewRef = useRef(null);

  useEffect(() => {
    requestPermissions();
    getCurrentUser();
    
    // Start 3-minute timer for automatic call end
    callTimerRef.current = setTimeout(() => {
      if (!callEnded) {
        Alert.alert('Time Up', 'Call duration limit (3 minutes) reached. Call will end now.');
        handleCallEnd('time_limit');
      }
    }, 180000); // 3 minutes

    // Listen for app state changes (user switching apps, going to background)
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Update call session when component mounts
    updateCallSession('active');
    
    return () => {
      if (callTimerRef.current) {
        clearTimeout(callTimerRef.current);
      }
      appStateSubscription?.remove();
      
      // Clean up when component unmounts
      if (!callEnded) {
        handleCallEnd('component_unmount');
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
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const requestPermissions = async () => {
    try {
      if (Platform.OS === 'android') {
        // Request Android permissions
        const cameraPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'Flexx needs access to your camera for video calls',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        const audioPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'Flexx needs access to your microphone for video calls',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (
          cameraPermission === PermissionsAndroid.RESULTS.GRANTED &&
          audioPermission === PermissionsAndroid.RESULTS.GRANTED
        ) {
          console.log('✅ Camera and microphone permissions granted (Android)');
        } else {
          console.warn('⚠️ Permissions denied');
          Alert.alert(
            'Permissions Required',
            'Camera and microphone permissions are required for video calls. Please enable them in settings.',
            [
              { text: 'OK', onPress: () => {} }
            ]
          );
        }
      } else {
        // Request iOS permissions
        const cameraStatus = await Camera.requestCameraPermissionsAsync();
        const audioStatus = await Camera.requestMicrophonePermissionsAsync();

        if (cameraStatus.granted && audioStatus.granted) {
          console.log('✅ Camera and microphone permissions granted (iOS)');
        } else {
          console.warn('⚠️ Permissions denied');
          Alert.alert(
            'Permissions Required',
            'Camera and microphone permissions are required for video calls. Please enable them in settings.',
            [
              { text: 'OK', onPress: () => {} }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  const handleAppStateChange = (nextAppState) => {
    // If user goes to background or inactive, end the call
    if (appStateRef.current === 'active' && (nextAppState === 'background' || nextAppState === 'inactive')) {
      if (!callEnded) {
        handleCallEnd('app_background');
      }
    }
    appStateRef.current = nextAppState;
  };

  const updateCallSession = async (status) => {
    try {
      const updateData = {
        status: status
      };
      
      if (status === 'ended') {
        updateData.ended_at = new Date().toISOString();
      }
      
      await supabase
        .from('active_calls')
        .update(updateData)
        .eq('call_id', id);
    } catch (error) {
      console.error('Error updating call session:', error);
    }
  };

  const cleanupCallData = async () => {
    if (!currentUser) return;
    
    try {
      // Remove from active calls
      await supabase
        .from('active_calls')
        .delete()
        .eq('call_id', id);

      // Remove from waiting users (in case they were waiting)
      await supabase
        .from('waiting_users')
        .delete()
        .eq('user_id', currentUser.id);
        
    } catch (error) {
      console.error('Error cleaning up call data:', error);
    }
  };

  const handleCallEnd = async (reason) => {
    if (callEnded) return; // Prevent multiple calls
    
    setCallEnded(true);
    
    // Clear timer
    if (callTimerRef.current) {
      clearTimeout(callTimerRef.current);
    }
    
    console.log('Call ended:', { callID: id, reason });
    
    // Update call session and cleanup
    await updateCallSession('ended');
    await cleanupCallData();
    
    // Navigate back to homepage
    props.navigation.navigate('MainApp', { screen: 'Home' });
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
      props.navigation.navigate('MainApp', { screen: 'Home' });
    }
  };
  
  const headerStyle = {
    ...styles.header,
    paddingTop: insets.top > 0 ? insets.top : 16,
  };
  
  // Create Jitsi URL with proper configuration
  const jitsiConfig = {
    startWithAudioMuted: false,
    startWithVideoMuted: false,
    disableModeratorIndicator: false,
    prejoinPageEnabled: false,
    startAudioOnly: false,
    requireDisplayName: false,
    enableWelcomePage: false,
    enableClosePage: false,
  };
  
  const jitsiParams = new URLSearchParams({
    'userInfo.displayName': name || 'User',
  });
  
  // Add config parameters
  Object.keys(jitsiConfig).forEach(key => {
    jitsiParams.append(`config.${key}`, jitsiConfig[key].toString());
  });
  
  // Use hash parameters for better compatibility
  const jitsiUrl = `https://meet.jit.si/${id}#${jitsiParams.toString()}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={headerStyle}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="call-outline" size={24} color="#ff4444" />
          <Text style={styles.endCallText}>End</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Video Call</Text>
          <Text style={styles.matchInfo}>Connected with: {matchedUser}</Text>
          <Text style={styles.timerInfo}>Call limit: 3 minutes</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.statusIndicator}>
            <View style={styles.activeIndicator} />
            <Text style={styles.activeText}>Live</Text>
          </View>
        </View>
      </View>
      
      <WebView
        source={{ uri: jitsiUrl }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        allowsProtectedMedia={true}
        startInLoadingState={true}
        userAgent="Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
        onLoadEnd={() => {
          console.log('✅ Jitsi loaded successfully');
        }}
        onError={(error) => {
          console.error('WebView error:', error);
          Alert.alert(
            'Connection Error',
            'Failed to load video call interface. Please check your internet connection.',
            [
              { text: 'OK', onPress: () => handleCallEnd('webview_error') }
            ]
          );
        }}
        onMessage={(event) => {
          console.log('WebView message:', event.nativeEvent.data);
        }}
      />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a2a',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  callContainer: {
    flex: 1,
    backgroundColor: '#0a0a2a',
  },
  remoteVideoContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  remoteVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  participantLabel: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a2a',
    paddingHorizontal: 20,
  },
  waitingText: {
    color: '#ffffff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
  },
  waitingSubText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    textAlign: 'center',
  },
  localVideoInfo: {
    position: 'absolute',
    top: 100,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  localLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
  },
  controlButtonMuted: {
    backgroundColor: 'rgba(255, 68, 68, 0.3)',
  },
  endCallButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ff4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
  },
  webview: {
    flex: 1,
    backgroundColor: '#0a0a2a',
  },
});

export default CallPage;