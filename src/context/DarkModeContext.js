import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const DarkModeContext = createContext();

export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
};

export const DarkModeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDarkModeSetting();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        loadDarkModeSetting();
      } else if (event === 'SIGNED_OUT') {
        setIsDarkMode(true); // Reset to default when signed out
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadDarkModeSetting = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('dark_mode')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading dark mode setting:', error);
        setIsLoading(false);
        return;
      }

      if (data) {
        setIsDarkMode(data.dark_mode ?? true);
      } else {
        // Create default settings if none exist
        await createDefaultSettings(user.id);
        setIsDarkMode(true);
      }
    } catch (error) {
      console.error('Error in loadDarkModeSetting:', error);
    } finally {
      setIsLoading(false);
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

  const toggleDarkMode = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newDarkMode = !isDarkMode;
      
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          dark_mode: newDarkMode,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error updating dark mode:', error);
        return;
      }

      setIsDarkMode(newDarkMode);
    } catch (error) {
      console.error('Error in toggleDarkMode:', error);
    }
  };

  const updateDarkMode = async (value) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          dark_mode: value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error updating dark mode:', error);
        return;
      }

      setIsDarkMode(value);
    } catch (error) {
      console.error('Error in updateDarkMode:', error);
    }
  };

  const value = {
    isDarkMode,
    isLoading,
    toggleDarkMode,
    updateDarkMode,
    loadDarkModeSetting
  };

  return (
    <DarkModeContext.Provider value={value}>
      {children}
    </DarkModeContext.Provider>
  );
};
