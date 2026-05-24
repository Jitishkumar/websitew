import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AccountProvider } from './src/context/AccountContext';
import { MessageProvider } from './src/context/MessageContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { VideoProvider } from './src/context/VideoContext';
import { ThemeProvider } from './src/context/ThemeContext';
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
        // Silently fail if Supabase is unavailable
        console.log('Notifications unavailable - Supabase connection failed');
      }
    };

    initializeNotifications();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider style={styles.container}>
        <ThemeProvider>
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
        </ThemeProvider>
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