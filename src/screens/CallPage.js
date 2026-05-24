import React, { useEffect, useState, useRef } from 'react';
import { 
  Text, 
  StyleSheet, 
  View, 
  TouchableOpacity, 
  SafeAreaView, 
  Alert, 
  AppState
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { WebView } from 'react-native-webview';

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

  // Create HTML for Daily.co Prebuilt - using Daily.js SDK
  const dailyHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
        <title>Daily Video Call</title>
        <script crossorigin src="https://unpkg.com/@daily-co/daily-js"></script>
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          #call-container {
            width: 100%;
            height: 100%;
          }
          #status {
            position: absolute;
            top: 10px;
            left: 10px;
            color: white;
            background: rgba(0,0,0,0.5);
            padding: 10px;
            border-radius: 5px;
            z-index: 1000;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div id="status">Connecting...</div>
        <div id="call-container"></div>
        <script>
          const roomUrl = '${roomUrl}';
          const userName = '${name}';
          const statusDiv = document.getElementById('status');
          
          console.log('Initializing Daily.co call...');
          console.log('Room URL:', roomUrl);
          console.log('User name:', userName);
          
          statusDiv.textContent = 'Initializing...';
          
          try {
            // Create Daily call object
            const callFrame = window.DailyIframe.createFrame('call-container', {
              showLeaveButton: true,
              showFullscreenButton: false,
              iframeStyle: {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none'
              }
            });
            
            statusDiv.textContent = 'Joining room...';
            
            // Join the room
            callFrame.join({ 
              url: roomUrl,
              userName: userName
            })
            .then(() => {
              console.log('Successfully joined room');
              statusDiv.textContent = 'Connected!';
              setTimeout(() => {
                statusDiv.style.display = 'none';
              }, 2000);
            })
            .catch((error) => {
              console.error('Failed to join room:', error);
              statusDiv.textContent = 'Error: ' + error.message;
              statusDiv.style.background = 'rgba(255,0,0,0.8)';
              
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'call-error',
                error: error.message,
                roomUrl: roomUrl
              }));
            });
            
            // Set up event listeners
            callFrame.on('left-meeting', () => {
              console.log('Left meeting');
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'call-ended',
                reason: 'left-meeting'
              }));
            });
            
            callFrame.on('error', (error) => {
              console.error('Daily error:', error);
              statusDiv.textContent = 'Error: ' + (error.errorMsg || 'Unknown error');
              statusDiv.style.background = 'rgba(255,0,0,0.8)';
              
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'call-error',
                error: error.errorMsg || 'Unknown error'
              }));
            });
            
            callFrame.on('participant-left', (event) => {
              console.log('Participant left:', event);
              // Check if we're alone now
              setTimeout(() => {
                callFrame.participants().then((participants) => {
                  if (Object.keys(participants).length <= 1) {
                    window.ReactNativeWebView?.postMessage(JSON.stringify({
                      type: 'call-ended',
                      reason: 'participant-left'
                    }));
                  }
                });
              }, 1000);
            });
            
          } catch (error) {
            console.error('Error initializing call:', error);
            statusDiv.textContent = 'Initialization error: ' + error.message;
            statusDiv.style.background = 'rgba(255,0,0,0.8)';
            
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
            'Failed to connect to video call. This might be because:\n\n' +
            '1. Daily.co API key is not configured\n' +
            '2. Network connection issue\n' +
            '3. Room URL is invalid\n\n' +
            'Please check GET_DAILY_API_KEY.md for setup instructions.',
            [
              { text: 'OK', onPress: () => handleCallEnd('error') }
            ]
          );
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
        source={{ html: dailyHTML }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        onMessage={handleWebViewMessage}
        onError={(error) => {
          console.error('WebView error:', error);
          Alert.alert(
            'Connection Error',
            'Failed to load video call interface. Please check:\n\n' +
            '1. Internet connection\n' +
            '2. Daily.co API key is configured\n' +
            '3. Room URL is valid\n\n' +
            'See GET_DAILY_API_KEY.md for setup instructions.',
            [
              { text: 'OK', onPress: () => handleCallEnd('webview_error') }
            ]
          );
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