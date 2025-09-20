import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [privateAccount, setPrivateAccount] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    loadUserSettings();
    checkVerificationStatus();
  }, []);

  const loadUserSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading settings:', error);
        return;
      }

      if (data) {
        setNotifications(data.notifications ?? true);
        setPrivateAccount(data.private_account ?? false);
        setAutoplay(data.autoplay ?? true);
      } else {
        // Create default settings if none exist
        createDefaultSettings(user.id);
      }
      
      setDataLoaded(true);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const checkVerificationStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('verified_accounts')
        .select('verified')
        .eq('id', user.id)
        .single();

      if (error) {
        // If the record doesn't exist, it means the user is not verified
        if (error.code === 'PGRST116') {
          setIsVerified(false);
          return;
        }
        throw error;
      }
      
      setIsVerified(data?.verified || false);
    } catch (error) {
      console.error('Error checking verification status:', error);
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

      if (error) throw error;
    } catch (error) {
      console.error('Error creating default settings:', error);
    }
  };

  const updateSetting = async (setting, value) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_settings')
        .update({ [setting]: value })
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error(`Error updating ${setting}:`, error);
      Alert.alert('Error', `Failed to update ${setting}. Please try again.`);
    }
  };


  const handleNotificationsToggle = (value) => {
    setNotifications(value);
    updateSetting('notifications', value);
  };

  const handlePrivateAccountToggle = (value) => {
    setPrivateAccount(value);
    updateSetting('private_account', value);
  };

  const handleAutoplayToggle = (value) => {
    setAutoplay(value);
    updateSetting('autoplay', value);
  };

  const renderSettingItem = (icon, title, description, value, onToggle) => (
    <View style={styles.settingItem}>
      <LinearGradient
        colors={['rgba(255, 215, 0, 0.08)', 'rgba(255, 215, 0, 0.04)']} 
        style={styles.settingItemGradient}
      >
        <View style={styles.settingIconContainer}>
          <LinearGradient
            colors={['#ffd700', '#ffed4e']}
            style={styles.iconGradient}
          >
            <Ionicons name={icon} size={20} color="#000" />
          </LinearGradient>
        </View>
        <View style={styles.settingContent}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingDescription}>{description}</Text>
        </View>
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: '#444', true: 'rgba(255, 215, 0, 0.3)' }}
          thumbColor={value ? '#ffd700' : '#888'}
          ios_backgroundColor="#444"
        />
      </LinearGradient>
    </View>
  );

  return (
    <LinearGradient colors={['#0f0f23', '#1a1a2e', '#16213e']} style={styles.container}>
      <LinearGradient
        colors={['rgba(255, 215, 0, 0.2)', 'rgba(255, 215, 0, 0.1)', 'transparent']}
        style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 50 }]}
      >
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <LinearGradient
            colors={['#ffd700', '#ffed4e']}
            style={styles.backButtonGradient}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        {isVerified && (
          <View style={styles.headerVerifiedBadge}>
            <LinearGradient
              colors={['#ffd700', '#ffed4e']}
              style={styles.headerVerifiedGradient}
            >
              <Ionicons name="checkmark-circle" size={12} color="#000" />
              <Text style={styles.headerVerifiedText}>VERIFIED</Text>
            </LinearGradient>
          </View>
        )}
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }]}
      >
        <View style={styles.section}>
          <LinearGradient
            colors={['rgba(255, 215, 0, 0.15)', 'rgba(255, 215, 0, 0.08)']}
            style={styles.sectionHeader}
          >
            <Text style={styles.sectionTitle}>✨ Appearance</Text>
          </LinearGradient>
          {renderSettingItem(
            'moon',
            'Dark Mode',
            'Enable Gen Z dark theme (vs bright theme)',
            isDarkMode,
            (value) => toggleDarkMode(value)
          )}
        </View>

        <View style={styles.section}>
          <LinearGradient
            colors={['rgba(255, 215, 0, 0.15)', 'rgba(255, 215, 0, 0.08)']}
            style={styles.sectionHeader}
          >
            <Text style={styles.sectionTitle}>🔒 Privacy</Text>
          </LinearGradient>
          {renderSettingItem(
            'lock-closed',
            'Private Account',
            'Only followers can see your posts, shorts, followers and following lists. Profile info remains visible to everyone.',
            privateAccount,
            handlePrivateAccountToggle
          )}
        </View>

        <View style={styles.section}>
          <LinearGradient
            colors={['rgba(255, 215, 0, 0.15)', 'rgba(255, 215, 0, 0.08)']}
            style={styles.sectionHeader}
          >
            <Text style={styles.sectionTitle}>🔔 Notifications</Text>
          </LinearGradient>
          {renderSettingItem(
            'notifications',
            'Push Notifications',
            'Receive notifications for likes, comments, and follows',
            notifications,
            handleNotificationsToggle
          )}
        </View>

        <View style={styles.section}>
          <LinearGradient
            colors={['rgba(255, 215, 0, 0.15)', 'rgba(255, 215, 0, 0.08)']}
            style={styles.sectionHeader}
          >
            <Text style={styles.sectionTitle}>🎬 Content</Text>
          </LinearGradient>
          {renderSettingItem(
            'play-circle',
            'Autoplay Videos',
            'Automatically play videos while scrolling',
            autoplay,
            handleAutoplayToggle
          )}
        </View>

        <View style={styles.section}>
          <LinearGradient
            colors={['rgba(255, 215, 0, 0.15)', 'rgba(255, 215, 0, 0.08)']}
            style={styles.sectionHeader}
          >
            <Text style={styles.sectionTitle}>👤 Account</Text>
          </LinearGradient>
          
          {/* Verification Status */}
          <TouchableOpacity 
            style={styles.linkItem}
            onPress={() => {
              if (isVerified) {
                Alert.alert('Verified Account', 'Your account is already verified with a red badge.');
              } else {
                navigation.navigate('VerifyAccount');
              }
            }}
          >
            <LinearGradient
              colors={['rgba(255, 215, 0, 0.08)', 'rgba(255, 215, 0, 0.04)']} 
              style={styles.linkItemGradient}
            >
              <View style={styles.settingIconContainer}>
                <LinearGradient
                  colors={isVerified ? ['#ff4757', '#ff3838'] : ['#ffd700', '#ffed4e']}
                  style={styles.iconGradient}
                >
                  <Ionicons name="checkmark-circle" size={20} color={isVerified ? "#fff" : "#000"} />
                </LinearGradient>
              </View>
              <View style={styles.settingContent}>
                <View style={styles.verificationTitleContainer}>
                  <Text style={styles.settingTitle}>Verify Account</Text>
                  {isVerified && (
                    <View style={styles.verifiedBadge}>
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.settingDescription}>
                  {isVerified 
                    ? 'Your account is verified with a red badge' 
                    : 'Get a red verification badge (₹70/month)'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ffd700" />
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.linkItem}>
            <LinearGradient
              colors={['rgba(255, 215, 0, 0.08)', 'rgba(255, 215, 0, 0.04)']} 
              style={styles.linkItemGradient}
            >
              <View style={styles.settingIconContainer}>
                <LinearGradient
                  colors={['#ffd700', '#ffed4e']}
                  style={styles.iconGradient}
                >
                  <Ionicons name="shield" size={20} color="#000" />
                </LinearGradient>
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Privacy Policy</Text>
                <Text style={styles.settingDescription}>Read our privacy policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ffd700" />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.linkItem}
            onPress={() => navigation.navigate('BlockedUsers')}
          >
            <LinearGradient
              colors={['rgba(255, 215, 0, 0.08)', 'rgba(255, 215, 0, 0.04)']} 
              style={styles.linkItemGradient}
            >
              <View style={styles.settingIconContainer}>
                <LinearGradient
                  colors={['#ffd700', '#ffed4e']}
                  style={styles.iconGradient}
                >
                  <Ionicons name="shield-outline" size={20} color="#000" />
                </LinearGradient>
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Blocked Users</Text>
                <Text style={styles.settingDescription}>View and manage blocked users</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ffd700" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkItem}>
            <LinearGradient
              colors={['rgba(255, 215, 0, 0.08)', 'rgba(255, 215, 0, 0.04)']} 
              style={styles.linkItemGradient}
            >
              <View style={styles.settingIconContainer}>
                <LinearGradient
                  colors={['#ffd700', '#ffed4e']}
                  style={styles.iconGradient}
                >
                  <Ionicons name="document-text" size={20} color="#000" />
                </LinearGradient>
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Terms of Service</Text>
                <Text style={styles.settingDescription}>Read our terms of service</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ffd700" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.linkItem}
            onPress={() => {
              Alert.alert(
                'Delete Account',
                'Are you sure you want to delete your account? This action cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Delete', 
                    style: 'destructive',
                    onPress: () => {
                      Alert.alert('Feature Coming Soon', 'Account deletion will be available in a future update.');
                    }
                  }
                ]
              );
            }}
          >
            <LinearGradient
              colors={['rgba(255, 71, 87, 0.08)', 'rgba(255, 71, 87, 0.04)']} 
              style={styles.linkItemGradient}
            >
              <View style={styles.settingIconContainer}>
                <LinearGradient
                  colors={['#ff4757', '#ff3838']}
                  style={styles.iconGradient}
                >
                  <Ionicons name="trash" size={20} color="#fff" />
                </LinearGradient>
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: '#ff4757' }]}>Delete Account</Text>
                <Text style={styles.settingDescription}>Permanently delete your account and data</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ff4757" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.1)',
  },
  backButton: {
    marginRight: 15,
  },
  backButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textShadowColor: 'rgba(255, 215, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerVerifiedBadge: {
    marginLeft: 10,
  },
  headerVerifiedGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  headerVerifiedText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 25,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.2)',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(255, 215, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  settingItem: {
    marginBottom: 2,
  },
  settingItemGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.1)',
  },
  linkItem: {
    marginBottom: 2,
  },
  linkItemGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.1)',
  },
  settingIconContainer: {
    marginRight: 16,
  },
  iconGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  settingContent: {
    flex: 1,
  },
  verificationTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedBadge: {
    backgroundColor: '#ff4757',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
    shadowColor: '#ff4757',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  settingTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default SettingsScreen;