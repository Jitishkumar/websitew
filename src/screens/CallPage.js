import { Text, StyleSheet, View, TouchableOpacity, SafeAreaView, Alert, AppState } from 'react-native';
import React, { useEffect, useState, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    ZegoUIKitPrebuiltCall,
    ONE_ON_ONE_VIDEO_CALL_CONFIG,
} from '@zegocloud/zego-uikit-prebuilt-call-rn';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

function CallPage(props) {
    console.log(props.route.params);
    const name = props.route.params.data;
    const id = props.route.params.id;
    const matchedUser = props.route.params.matchedUser || 'Unknown User';
    const isJoining = props.route.params.isJoining || false;
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

    // Custom config for one-on-one calls with 3-minute limit
    const callConfig = {
        ...ONE_ON_ONE_VIDEO_CALL_CONFIG,
        onCallEnd: (callID, reason, duration) => { 
            handleCallEnd('zego_ended');
        },
        onUserJoin: (users) => {
            console.log('Users joined:', users);
        },
        onUserLeave: (users) => {
            console.log('Users left:', users);
            // If the other user leaves, end the call
            if (users.length === 0 || users.length === 1) {
                handleCallEnd('user_left');
            }
        },
        // Limit to 2 participants maximum
        maxUsers: 2,
        // Show usernames in the call
        showUserName: true,
        // Enable camera by default
        turnOnCameraWhenJoining: true,
        // Enable microphone by default
        turnOnMicrophoneWhenJoining: true,
        // Custom UI settings
        layout: {
            mode: 'pictureInPicture',
            config: {
                isSmallViewDraggable: true,
                smallViewPosition: 'topRight',
            }
        },
        // Show call duration
        showCallTimer: true,
        // Automatically hang up after network disconnection
        hangUpConfirmInfo: {
            title: 'End Call',
            message: 'Are you sure you want to end this call?',
            cancelButtonName: 'Cancel',
            confirmButtonName: 'End Call',
        },
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
            <View style={styles.container}>
                <ZegoUIKitPrebuiltCall
                    appID={139240443}
                    appSign={'9f90ba0d2d6029c51fe4992a8821060e1199d7bcac53c20da01e472df4cb8ca4'}
                    userID={name} 
                    userName={name}
                    callID={id} 
                    config={callConfig}
                />
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
});

export default CallPage;