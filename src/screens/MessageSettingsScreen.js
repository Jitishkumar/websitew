import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../config/supabase';

const MessageSettingsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { recipientId, recipientName } = route.params;

  const [isOnlineVisible, setIsOnlineVisible] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showReadReceipts, setShowReadReceipts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState(null);
  const [settingsId, setSettingsId] = useState(null);

  // Fetch current user and settings
  useEffect(() => {
    const fetchUserAndSettings = async () => {
      try {
        setLoading(true);
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('User not authenticated');
          navigation.navigate('Login');
          return;
        }
        
        setUserId(user.id);
        
        // Check if user is blocked
        const { data: blockedData, error: blockedError } = await supabase
          .from('blocked_users')
          .select('*')
          .eq('blocker_id', user.id)
          .eq('blocked_id', recipientId)
          .single();
          
        if (blockedError && blockedError.code !== 'PGRST116') { // PGRST116 is not found error
          console.error('Error checking blocked status:', blockedError);
        } else {
          setIsBlocked(!!blockedData);
        }
        
        // Get user settings
        const { data: settings, error: settingsError } = await supabase
          .from('user_message_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        if (settingsError && settingsError.code !== 'PGRST116') {
          console.error('Error fetching settings:', settingsError);
        } else if (settings) {
          setSettingsId(settings.id);
          setIsOnlineVisible(settings.show_online_status ?? false);
          setShowReadReceipts(settings.show_read_receipts ?? false);
        } else {
          // Create default settings if none exist
          const { data: newSettings, error: createError } = await supabase
            .from('user_message_settings')
            .insert({
              user_id: user.id,
              show_online_status: false,
              show_read_receipts: false
            })
            .select()
            .single();
            
          if (createError) {
            console.error('Error creating settings:', createError);
          } else if (newSettings) {
            setSettingsId(newSettings.id);
          }
        }
      } catch (error) {
        console.error('Error in fetchUserAndSettings:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserAndSettings();
  }, []);

  // Handle online visibility toggle
  const handleOnlineVisibilityToggle = async (value) => {
    try {
      setIsOnlineVisible(value);
      await updateSettings({ show_online_status: value });
    } catch (error) {
      console.error('Error updating online visibility:', error);
      // Revert UI state if update fails
      setIsOnlineVisible(!value);
      Alert.alert('Error', 'Failed to update online visibility setting');
    }
  };

  // Handle read receipts toggle
  const handleReadReceiptsToggle = async (value) => {
    try {
      setShowReadReceipts(value);
      await updateSettings({ show_read_receipts: value });
    } catch (error) {
      console.error('Error updating read receipts:', error);
      // Revert UI state if update fails
      setShowReadReceipts(!value);
      Alert.alert('Error', 'Failed to update read receipts setting');
    }
  };

  // Handle block/unblock user
  const handleBlockToggle = async (value) => {
    try {
      setSaving(true);
      setIsBlocked(value);
      
      if (value) {
        // Block user
        const { error } = await supabase
          .from('blocked_users')
          .insert({
            blocker_id: userId,
            blocked_id: recipientId,
            created_at: new Date().toISOString()
          });
          
        if (error) throw error;
      } else {
        // Unblock user
        const { error } = await supabase
          .from('blocked_users')
          .delete()
          .eq('blocker_id', userId)
          .eq('blocked_id', recipientId);
          
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error updating block status:', error);
      // Revert UI state if update fails
      setIsBlocked(!value);
      Alert.alert('Error', 'Failed to update block status');
    } finally {
      setSaving(false);
    }
  };

  // Update settings in database
  const updateSettings = async (updates) => {
    if (!userId || !settingsId) return;
    
    try {
      setSaving(true);
      const { error } = await supabase
        .from('user_message_settings')
        .update(updates)
        .eq('id', settingsId);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleDefault = async () => {
    try {
      setSaving(true);
      setIsOnlineVisible(false);
      setShowReadReceipts(false);
      
      await updateSettings({
        show_online_status: false,
        show_read_receipts: false
      });
      
      Alert.alert('Success', 'Settings reset to default');
    } catch (error) {
      console.error('Error resetting to default:', error);
      Alert.alert('Error', 'Failed to reset settings to default');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000033', '#000033']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{recipientName}</Text>
      </LinearGradient>

      <View style={styles.settingsContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6c3fd8" />
            <Text style={styles.loadingText}>Loading settings...</Text>
          </View>
        ) : (
          <>
            <View style={styles.settingItem}>
              <Text style={styles.settingText}>Show when you are online</Text>
              <Switch
                value={isOnlineVisible}
                onValueChange={handleOnlineVisibilityToggle}
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={isOnlineVisible ? '#f5dd4b' : '#f4f3f4'}
                disabled={saving}
              />
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.settingText}>Show that you read the message</Text>
              <Switch
                value={showReadReceipts}
                onValueChange={handleReadReceiptsToggle}
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={showReadReceipts ? '#f5dd4b' : '#f4f3f4'}
                disabled={saving}
              />
            </View>
          </>
        )}

        <TouchableOpacity 
          style={[styles.button, saving && styles.disabledButton]} 
          onPress={handleDefault}
          disabled={saving || loading}
        >
            <LinearGradient colors={['#3399ff', '#66ccff']} style={styles.gradient}>
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.buttonText}>Set to Default</Text>
                )}
            </LinearGradient>
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={styles.settingItem}>
          <Text style={[styles.settingText, styles.blockText]}>Block {recipientName}</Text>
          <Switch
            value={isBlocked}
            onValueChange={handleBlockToggle}
            trackColor={{ false: '#767577', true: '#ff4d4d' }}
            thumbColor={isBlocked ? '#ff4d4d' : '#f4f3f4'}
            disabled={saving}
          />
        </View>

        <TouchableOpacity 
          style={[styles.button, saving && styles.disabledButton]} 
          onPress={() => handleBlockToggle(!isBlocked)}
          disabled={saving || loading}
        >
            <LinearGradient colors={['#ff4d4d', '#ff8080']} style={styles.gradient}>
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.buttonText}>{isBlocked ? 'Unblock User' : 'Block User'}</Text>
                )}
            </LinearGradient>
        </TouchableOpacity>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000033',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a4a',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  settingsContainer: {
    padding: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a4a',
  },
  settingText: {
    color: 'white',
    fontSize: 16,
  },
  blockText: {
    color: '#ff4d4d',
  },
  button: {
    marginTop: 20,
    borderRadius: 25,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 15,
    alignItems: 'center',
    borderRadius: 25,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#1a1a4a',
    marginVertical: 20,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default MessageSettingsScreen;