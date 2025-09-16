import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AccountProvider } from './src/context/AccountContext';
import { MessageProvider } from './src/context/MessageContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { VideoProvider } from './src/context/VideoContext';
import { StyleSheet, View, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NotificationService } from './src/services/NotificationService';
import { supabase } from './src/lib/supabase';

export default function App() {
  useEffect(() => {
    // Initialize push notifications when app starts
    const initializeNotifications = async () => {
      try {
        const token = await NotificationService.registerForPushNotifications();
        
        if (token) {
          // Get current user and save token
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await NotificationService.savePushToken(user.id, token);
          }
        }
      } catch (error) {
        console.error('Error initializing notifications:', error);
      }
    };

    initializeNotifications();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider style={styles.container}>
        <AccountProvider>
          <MessageProvider>
            <NotificationProvider>
              <VideoProvider>
                <NavigationContainer>
                  <AppNavigator />
                </NavigationContainer>
              </VideoProvider>
            </NotificationProvider>
          </MessageProvider>
        </AccountProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});