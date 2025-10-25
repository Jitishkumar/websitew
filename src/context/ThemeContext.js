import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Load theme from AsyncStorage IMMEDIATELY to prevent flash
  const [isDarkMode, setIsDarkMode] = useState(null); // null = not loaded yet
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadThemeImmediately();
  }, []);

  // Load theme from AsyncStorage FIRST (instant), then sync with database
  const loadThemeImmediately = async () => {
    try {
      // Step 1: Load from AsyncStorage immediately (no network delay)
      const cachedTheme = await AsyncStorage.getItem('user_theme_preference');
      if (cachedTheme !== null) {
        const isDark = cachedTheme === 'dark';
        setIsDarkMode(isDark);
        console.log('✅ Theme loaded instantly from cache:', isDark ? 'dark' : 'light');
      } else {
        // No cache, default to dark mode
        setIsDarkMode(true);
      }
      
      // Step 2: Load from database in background and sync
      loadThemeSettings();
    } catch (error) {
      console.error('Error loading theme from cache:', error);
      setIsDarkMode(true); // Fallback to dark
      loadThemeSettings();
    }
  };

  const loadThemeSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('dark_mode')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading theme settings:', error);
        setLoading(false);
        return;
      }

      if (data) {
        const dbDarkMode = data.dark_mode ?? true;
        setIsDarkMode(dbDarkMode);
        // Update AsyncStorage cache
        await AsyncStorage.setItem('user_theme_preference', dbDarkMode ? 'dark' : 'light');
      } else {
        // Create default settings if none exist
        await createDefaultSettings(user.id);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error in loadThemeSettings:', error);
      setLoading(false);
    }
  };

  const createDefaultSettings = async (userId) => {
    try {
      const { error } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          dark_mode: true,
          notifications: true,
          private_account: false,
          autoplay: true
        });

      if (error) {
        console.error('Error creating default settings:', error);
      }
    } catch (error) {
      console.error('Error in createDefaultSettings:', error);
    }
  };

  const toggleDarkMode = async (newValue) => {
    // Update UI immediately for instant response
    setIsDarkMode(newValue);
    
    // Save to AsyncStorage immediately (instant cache)
    try {
      await AsyncStorage.setItem('user_theme_preference', newValue ? 'dark' : 'light');
    } catch (error) {
      console.error('Error caching theme:', error);
    }
    
    // Save to database in background
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          dark_mode: newValue,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error updating dark mode:', error);
      }
    } catch (error) {
      console.error('Error in toggleDarkMode:', error);
    }
  };

  const value = {
    isDarkMode,
    toggleDarkMode,
    loading
  };

  // Don't render children until theme is loaded from cache (prevents flash)
  if (isDarkMode === null) {
    return null; // or return a splash screen
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
