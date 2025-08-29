import { Text, StyleSheet, View, TouchableOpacity, SafeAreaView, Alert, AppState } from 'react-native';
import React, { useEffect, useState, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import JitsiMeet from '@jitsi/react-native-sdk';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

function CallPage(props) {
    const params = props.route.params;
    console.log('CallPage params:', params);
    
    const name = params.data;
    const id = params.id;
    const matchedUser = params.matchedUser || 'Unknown User';
    const isJoining = params.isJoining || false;
    
    const insets = useSafeAreaInsets();
    const [callEnded, setCallEnded] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [callStarted, setCallStarted] = useState(false);
    
    const callTimerRef = useRef(null);
    const appStateRef = useRef(AppState.currentState);
    const cleanupExecutedRef = useRef(false);

    useEffect(() => {
        if (callStarted) return; // Prevent multiple initializations
        
        setCallStarted(true);
        getCurrentUser();
        
        // Start 3-minute timer for automatic call end
        callTimerRef.current = setTimeout(() => {
            if (!callEnded && !cleanupExecutedRef.current) {
                Alert.alert('Time Up', 'Call duration limit (3 minutes) reached. Call will end now.');
                handleCallEnd('time_limit');
            }
        }, 180000); // 3 minutes

        // Listen for app state changes
        const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

        // Update call session when component mounts
        updateCallSession('active');
        
        return () => {
            if (callTimerRef.current) {
                clearTimeout(callTimerRef.current);
            }
            appStateSubscription?.remove();
            
            // Clean up when component unmounts
            if (!callEnded && !cleanupExecutedRef.current) {
                handleCallEnd('component_unmount');
            }
        };
    }, []); // Empty dependency array to run only once

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
            if (!callEnded && !cleanupExecutedRef.current) {
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
        if (!currentUser || cleanupExecutedRef.current) return;
        
        cleanupExecutedRef.current = true;
        
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
        if (callEnded || cleanupExecutedRef.current) return; // Prevent multiple calls
        
        console.log('Ending call:', { callID: id, reason });
        setCallEnded(true);
        
        // Clear timer
        if (callTimerRef.current) {
            clearTimeout(callTimerRef.current);
        }
        
        // Update call session and cleanup
        await updateCallSession('ended');
        await cleanupCallData();
        
        // Navigate back to homepage
        props.navigation.reset({
            index: 0,
            routes: [{ name: 'HomePage' }],
        });

        // End Jitsi Meet call
        try {
            await JitsiMeet.endCall();
        } catch (error) {
            console.error('Error ending Jitsi call:', error);
        }
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

    // Jitsi Meet configuration for one-on-one calls
    const jitsiConfig = {
        roomName: id, // Use call_id as room name
        domain: 'meet.jit.si', // Use Jitsi's hosted server
        config: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            disableModeratorIndicator: true, // Simplify for one-on-one
            maxUsers: 2, // Limit to 2 participants
            showUserName: true,
            defaultLocalDisplayName: name || 'You', // User's display name
            toolbarButtons: [
                'camera',
                'microphone',
                'hangup',
                'tileview',
                'videoquality',
            ],
            // Ensure gallery view for equal video display
            defaultView: 'tile',
            // Disable features not needed for one-on-one
            disableScreenSharing: true,
            disableVideoBackground: true,
            // Call duration display
            showCallTimer: true,
        },
        userInfo: {
            displayName: name || 'You',
            email: currentUser?.email || '',
        },
        // Handle call end events
        onConferenceTerminated: () => {
            console.log('Jitsi conference terminated');
            handleCallEnd('jitsi_terminated');
        },
        onConferenceLeft: () => {
            console.log('User left Jitsi conference');
            setTimeout(() => {
                if (!callEnded) {
                    handleCallEnd('user_left');
                }
            }, 2000); // 2-second delay for temporary disconnections
        },
        onConferenceJoined: () => {
            console.log('User joined Jitsi conference');
        },
    };

    if (callEnded) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.endedContainer}>
                    <Text style={styles.endedText}>Call Ended</Text>
                    <TouchableOpacity style={styles.backButton} onPress={() => props.navigation.navigate('HomePage')}>
                        <Text style={styles.backButtonText}>Back to Home</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

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
                {name && id && (
                    <JitsiMeet
                        style={{ flex: 1, width: '100%' }}
                        config={jitsiConfig}
                    />
                )}
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
    endedContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    endedText: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
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
    backButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
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