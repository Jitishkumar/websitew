import React, { useEffect, useState, useRef } from 'react';
import { 
  Text, 
  StyleSheet, 
  View, 
  TouchableOpacity, 
  SafeAreaView, 
  Alert, 
  Linking,
  BackHandler
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
      // Simple Jitsi URL that opens in browser
      const jitsiUrl = `https://meet.jit.si/${id}`;
      
      const supported = await Linking.canOpenURL(jitsiUrl);
      if (supported) {
        await Linking.openURL(jitsiUrl);
        console.log('✅ Opened Jitsi in browser:', jitsiUrl);
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
      
      // 1. Delete from active_calls table
      const { error: callError } = await supabase
        .from('active_calls')
        .delete()
        .eq('call_id', id);

      if (callError) {
        console.error('Error deleting from active_calls:', callError);
      } else {
        console.log('✅ Deleted from active_calls');
      }

      // 2. Delete from waiting_users table (in case they were waiting)
      const { error: waitingError } = await supabase
        .from('waiting_users')
        .delete()
        .eq('user_id', currentUser.id);

      if (waitingError) {
        console.error('Error deleting from waiting_users:', waitingError);
      } else {
        console.log('✅ Deleted from waiting_users');
      }
      
      console.log('✅ Cleanup completed successfully');
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
    
    console.log('📞 Call ended:', { callID: id, reason });
    
    // Cleanup database
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
          <Text style={styles.timerInfo}>Call opened in browser</Text>
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
            Switch to your browser to join the call.
          </Text>
          <Text style={styles.instructionsSubtext}>
            Room: {id}
          </Text>
          <Text style={styles.instructionsSubtext}>
            Matched with: {matchedUser}
          </Text>
          
          <TouchableOpacity 
            style={styles.endCallButton}
            onPress={handleCallEnd}
          >
            <Ionicons name="call" size={24} color="#fff" />
            <Text style={styles.endCallButtonText}>End Call & Return Home</Text>
          </TouchableOpacity>
          
          <Text style={styles.warningText}>
            ⚠️ Call will automatically end after 3 minutes
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
  endCallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff4444',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 30,
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
    marginTop: 20,
  },
});

export default CallPage;