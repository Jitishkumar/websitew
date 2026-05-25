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
    props.navigation.reset({
      index: 0,
      routes: [{ name: 'HomePage' }],
    });
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
      props.navigation.navigate('HomePage');
    }
  };
  
  const headerStyle = {
    ...styles.header,
    paddingTop: insets.top > 0 ? insets.top : 16,
  };

  // Create HTML for Jitsi Meet - with proper media handling
  const jitsiHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <title>Jitsi Video Call</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          html, body {
            width: 100%;
            height: 100%;
            background: #0a0a2a;
            overflow: hidden;
          }
          #jitsi-container {
            width: 100%;
            height: 100%;
          }
          .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
            color: white;
            font-family: Arial, sans-serif;
          }
        </style>
      </head>
      <body>
        <div id="jitsi-container" class="loading">Connecting...</div>
        <script src="https://meet.jit.si/external_api.js"></script>
        <script>
          const roomUrl = '${roomUrl}';
          const userName = '${name}';
          
          // Extract room name from URL
          const roomName = roomUrl.split('/').pop();
          
          console.log('🚀 Initializing Jitsi Meet...');
          console.log('📍 Room:', roomName);
          console.log('👤 User:', userName);
          
          const domain = 'meet.jit.si';
          const options = {
            roomName: roomName,
            width: '100%',
            height: '100%',
            parentNode: document.querySelector('#jitsi-container'),
            userInfo: {
              displayName: userName
            },
            configOverwrite: {
              startWithAudioMuted: false,
              startWithVideoMuted: false,
              enableWelcomePage: false,
              prejoinPageEnabled: false,
              disableDeepLinking: true,
              enableClosePage: false,
              requireDisplayName: false,
              disableProfile: true,
              hideConferenceSubject: true,
              hideConferenceTimer: false,
              toolbarButtons: [
                'microphone',
                'camera',
                'hangup',
                'chat',
                'settings',
                'videoquality',
                'filmstrip',
                'tileview'
              ],
              // Enable audio/video by default
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              },
              video: {
                width: 640,
                height: 480
              }
            },
            interfaceConfigOverwrite: {
              SHOW_JITSI_WATERMARK: false,
              SHOW_WATERMARK_FOR_GUESTS: false,
              SHOW_BRAND_WATERMARK: false,
              SHOW_POWERED_BY: false,
              DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
              MOBILE_APP_PROMO: false,
              HIDE_INVITE_MORE_HEADER: true,
              DISABLE_VIDEO_BACKGROUND: false,
              VIDEO_LAYOUT_FIT: 'both'
            }
          };
          
          try {
            const api = new JitsiMeetExternalAPI(domain, options);
            
            // Request camera and microphone permissions
            navigator.mediaDevices.getUserMedia({ 
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              },
              video: {
                width: { ideal: 640 },
                height: { ideal: 480 }
              }
            }).then((stream) => {
              console.log('✅ Got media stream:', stream);
              // Stop the stream since we're just checking permissions
              stream.getTracks().forEach(track => track.stop());
            }).catch((error) => {
              console.error('❌ Media permission error:', error);
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'permission-error',
                error: error.name + ': ' + error.message
              }));
            });
            
            api.addEventListener('videoConferenceJoined', (event) => {
              console.log('✅ Joined conference:', event);
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'conference-joined',
                data: event
              }));
            });
            
            api.addEventListener('videoConferenceLeft', (event) => {
              console.log('👋 Left conference:', event);
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'call-ended',
                reason: 'left-meeting'
              }));
            });
            
            api.addEventListener('participantLeft', (event) => {
              console.log('👤 Participant left:', event);
              setTimeout(() => {
                const participants = api.getNumberOfParticipants();
                if (participants <= 1) {
                  window.ReactNativeWebView?.postMessage(JSON.stringify({
                    type: 'call-ended',
                    reason: 'participant-left'
                  }));
                }
              }, 1000);
            });
            
            api.addEventListener('readyToClose', () => {
              console.log('🔴 Ready to close');
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'call-ended',
                reason: 'ready-to-close'
              }));
            });
            
            api.addEventListener('errorOccurred', (error) => {
              console.error('❌ Jitsi error:', error);
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'call-error',
                error: error.error || 'Unknown error'
              }));
            });
            
          } catch (error) {
            console.error('❌ Error initializing Jitsi:', error);
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: 'call-error',
              error: error.message
            }));
          }
        </script>
      </body>
    </html>
  `;

  const handleWebViewMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'call-ended':
          handleCallEnd(message.reason);
          break;
        case 'call-error':
          Alert.alert(
            'Call Error', 
            'An error occurred during the video call. Please try again.',
            [
              { text: 'OK', onPress: () => handleCallEnd('error') }
            ]
          );
          break;
        case 'permission-error':
          Alert.alert(
            'Permission Error',
            `Camera/Microphone access failed: ${message.error}\n\nPlease check your device settings and ensure permissions are granted.`,
            [
              { text: 'OK', onPress: () => {} }
            ]
          );
          break;
        case 'conference-joined':
          console.log('✅ Conference joined successfully');
          break;
        default:
          console.log('Unknown message from WebView:', message);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

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
        source={{ html: jitsiHTML }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        allowsProtectedMedia={true}
        mediaCapturePermissionGrantType="grant"
        onMessage={handleWebViewMessage}
        onPermissionRequest={(request) => {
          console.log('🎥 WebView permission request:', request.resources);
          // Auto-grant all permissions (camera, microphone, etc.)
          request.grant(request.resources);
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
        userAgent="Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        startInLoadingState={true}
        scalesPageToFit={true}
        scrollEnabled={false}
        bounces={false}
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