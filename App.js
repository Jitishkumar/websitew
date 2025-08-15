import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AccountProvider } from './src/context/AccountContext';
import { MessageProvider } from './src/context/MessageContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { VideoProvider } from './src/context/VideoContext';
import { StyleSheet, View, Platform } from 'react-native';

export default function App() {
  return (
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});