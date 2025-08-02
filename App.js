import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from './src/navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { VideoProvider } from './src/context/VideoContext';
import { AccountProvider } from './src/context/AccountContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { MessageProvider } from './src/context/MessageContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <AccountProvider>
        <NotificationProvider>
          <MessageProvider>
            <VideoProvider>
              <NavigationContainer>
                <AppNavigator />
                <StatusBar style="light" />
              </NavigationContainer>
            </VideoProvider>
          </MessageProvider>
        </NotificationProvider>
      </AccountProvider>
    </SafeAreaProvider>
  );
}