import React from 'react';
import { useTheme } from '../context/ThemeContext';
import HomeScreen from './HomeScreen'; // New Gen Z UI
import HomeScreenOld from './HomeScreenold'; // Old bright UI
import { View, ActivityIndicator } from 'react-native';

const ThemeAwareHomeScreen = () => {
  const { isDarkMode, loading } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a2a' }}>
        <ActivityIndicator size="large" color="#ff00ff" />
      </View>
    );
  }

  // Dark Mode ON = New Gen Z UI (HomeScreen.js)
  // Dark Mode OFF = Old bright UI (HomeScreenold.js)
  return isDarkMode ? <HomeScreen /> : <HomeScreenOld />;
};

export default ThemeAwareHomeScreen;
