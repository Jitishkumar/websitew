import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, Animated, Dimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { Alert } from 'react-native';

const { width } = Dimensions.get('window');

const AccountSwitcher = ({ isVisible, onClose }) => {
  const [accounts, setAccounts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const navigation = useNavigation();
  
  // Ultra-premium animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      loadAccounts();
      startAnimations();
    } else {
      resetAnimations();
    }
  }, [isVisible]);
  
  const startAnimations = () => {
    Animated.parallel([
      // Entrance animations
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 120,
        friction: 7,
        useNativeDriver: true,
      }),
      // Continuous shimmer effect
      Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      ),
      // Pulse effect
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ),
      // Glow effect
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ),
    ]).start();
  };
  
  const resetAnimations = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    scaleAnim.setValue(0.8);
    shimmerAnim.setValue(0);
    pulseAnim.setValue(1);
    rotateAnim.setValue(0);
    glowAnim.setValue(0);
  };

  // Function to clear current user's account data
  const clearCurrentUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const savedAccounts = await AsyncStorage.getItem('savedAccounts');
        if (savedAccounts) {
          const parsedAccounts = JSON.parse(savedAccounts);
          const updatedAccounts = parsedAccounts.filter(
            account => account.email !== user.email
          );
          await AsyncStorage.setItem('savedAccounts', JSON.stringify(updatedAccounts));
          setAccounts(updatedAccounts);
        }
      }
    } catch (error) {
      console.error('Error clearing user data:', error);
    }
  };

  const loadAccounts = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Get saved accounts
      const savedAccounts = await AsyncStorage.getItem('savedAccounts');
      if (savedAccounts) {
        const parsedAccounts = JSON.parse(savedAccounts);
        // Filter out duplicates and current account
        const uniqueAccounts = parsedAccounts.filter(
          (account, index, self) =>
            account.email !== user?.email && // Remove current user
            index === self.findIndex((a) => a.email === account.email) // Remove duplicates
        );
        setAccounts(uniqueAccounts);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const switchAccount = async (account) => {
    try {
      // Get current user before signing out
      const { data: { user } } = await supabase.auth.getUser();
      
      // Sign out current user
      await supabase.auth.signOut();
      
      // Remove current account from saved accounts
      const savedAccounts = await AsyncStorage.getItem('savedAccounts');
      if (savedAccounts) {
        const parsedAccounts = JSON.parse(savedAccounts);
        const updatedAccounts = parsedAccounts.filter(
          acc => acc.email !== user.email
        );
        await AsyncStorage.setItem('savedAccounts', JSON.stringify(updatedAccounts));
      }
      
      onClose();
      // Navigate to login with the selected account's email
      navigation.replace('Login', { 
        prefilledEmail: account.email,
        isAccountSwitch: true 
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to switch account');
    }
  };

  const removeAccount = async (accountToRemove) => {
    try {
      // Get saved accounts
      const savedAccounts = await AsyncStorage.getItem('savedAccounts');
      if (savedAccounts) {
        const parsedAccounts = JSON.parse(savedAccounts);
        // Filter out the account to remove
        const updatedAccounts = parsedAccounts.filter(
          account => account.email !== accountToRemove.email
        );
        // Save updated accounts list
        await AsyncStorage.setItem('savedAccounts', JSON.stringify(updatedAccounts));
        // Refresh the accounts list
        loadAccounts();
      }
    } catch (error) {
      console.error('Error removing account:', error);
      Alert.alert('Error', 'Failed to remove account');
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
                { perspective: 1000 }
              ]
            }
          ]}
        >
          <LinearGradient
            colors={['rgba(26, 26, 46, 0.98)', 'rgba(22, 33, 62, 0.95)', 'rgba(15, 52, 96, 0.92)']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.contentGradient}
          >
            {/* Shimmer overlay effect */}
            <Animated.View 
              style={[
                styles.shimmerOverlay,
                {
                  opacity: shimmerAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 0.4, 0]
                  }),
                  transform: [{
                    translateX: shimmerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-width, width]
                    })
                  }]
                }
              ]}
            />
            
            <LinearGradient
              colors={['rgba(255, 0, 255, 0.15)', 'rgba(255, 0, 255, 0.08)', 'transparent']}
              style={styles.header}
            >
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <LinearGradient
                  colors={['#ff00ff', '#ff6b9d', '#c44569']}
                  style={styles.titleContainer}
                >
                  <Text style={styles.title}>Switch Account</Text>
                </LinearGradient>
              </Animated.View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <LinearGradient
                  colors={['rgba(255, 0, 255, 0.2)', 'rgba(255, 0, 255, 0.1)']}
                  style={styles.closeButtonGradient}
                >
                  <Ionicons name="close" size={24} color="#ff00ff" />
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>

            <FlatList
              data={accounts}
              keyExtractor={(item) => item.userId}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => {
                const itemAnim = useRef(new Animated.Value(0)).current;
                const itemGlowAnim = useRef(new Animated.Value(0)).current;
                
                React.useEffect(() => {
                  if (isVisible) {
                    Animated.parallel([
                      Animated.timing(itemAnim, {
                        toValue: 1,
                        duration: 600,
                        delay: index * 100,
                        useNativeDriver: true,
                      }),
                      Animated.loop(
                        Animated.sequence([
                          Animated.timing(itemGlowAnim, {
                            toValue: 1,
                            duration: 2000,
                            useNativeDriver: true,
                          }),
                          Animated.timing(itemGlowAnim, {
                            toValue: 0.2,
                            duration: 2000,
                            useNativeDriver: true,
                          }),
                        ])
                      ),
                    ]).start();
                  }
                }, [isVisible, index]);
                
                return (
                  <Animated.View 
                    style={[
                      styles.accountItemContainer,
                      {
                        opacity: itemAnim,
                        transform: [{
                          translateX: itemAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [50, 0]
                          })
                        }]
                      }
                    ]}
                  >
                    <LinearGradient
                      colors={['rgba(255, 0, 255, 0.1)', 'rgba(255, 0, 255, 0.05)', 'transparent']}
                      style={styles.accountItemGradient}
                    >
                      {/* Glow effect for account item */}
                      <Animated.View 
                        style={[
                          styles.accountItemGlow,
                          {
                            opacity: itemGlowAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 0.6]
                            })
                          }
                        ]}
                      />
                      
                      <TouchableOpacity 
                        style={styles.accountItem}
                        onPress={() => switchAccount(item)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.avatarContainer}>
                          <LinearGradient
                            colors={['#ff00ff', '#ff6b9d', '#c44569']}
                            style={styles.avatarBorder}
                          >
                            <Image 
                              source={{ uri: item.avatar_url || 'https://via.placeholder.com/40' }}
                              style={styles.avatar}
                            />
                          </LinearGradient>
                          <Animated.View 
                            style={[
                              styles.avatarGlow,
                              {
                                opacity: itemGlowAnim,
                                transform: [{
                                  scale: itemGlowAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 1.2]
                                  })
                                }]
                              }
                            ]}
                          />
                        </View>
                        <View style={styles.accountInfo}>
                          <Text style={styles.accountEmail}>{item.email}</Text>
                          <Text style={styles.accountUsername}>@{item.username || 'username'}</Text>
                        </View>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.removeButton}
                        onPress={() => {
                          Alert.alert(
                            'Remove Account',
                            'Are you sure you want to remove this account? You will need to log in again to use it.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { 
                                text: 'Remove', 
                                style: 'destructive',
                                onPress: () => removeAccount(item)
                              }
                            ]
                          );
                        }}
                        activeOpacity={0.7}
                      >
                        <LinearGradient
                          colors={['rgba(255, 59, 48, 0.2)', 'rgba(255, 59, 48, 0.1)']}
                          style={styles.removeButtonGradient}
                        >
                          <Ionicons name="close-circle" size={24} color="#ff3b30" />
                        </LinearGradient>
                      </TouchableOpacity>
                    </LinearGradient>
                  </Animated.View>
                );
              }}
            />

            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity 
                style={styles.addAccountButton}
                onPress={() => {
                  onClose();
                  navigation.navigate('Login');
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#ff00ff', '#ff6b9d', '#c44569']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={styles.addAccountGradient}
                >
                  <Animated.View 
                    style={[
                      styles.addAccountGlow,
                      {
                        opacity: glowAnim,
                        transform: [{
                          scale: glowAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.1]
                          })
                        }]
                      }
                    ]}
                  />
                  <Ionicons name="add-circle-outline" size={24} color="#fff" />
                  <Text style={styles.addAccountText}>Add Account</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: width * 0.9,
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  contentGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.3)',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ skewX: '-20deg' }],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 0, 255, 0.2)',
  },
  titleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.3)',
  },
  accountItemContainer: {
    marginBottom: 12,
  },
  accountItemGradient: {
    borderRadius: 16,
    padding: 2,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.2)',
    shadowColor: 'rgba(255, 0, 255, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  accountItemGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    zIndex: -1,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  avatarBorder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: 'rgba(26, 26, 46, 0.8)',
  },
  avatarGlow: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 0, 255, 0.2)',
    zIndex: -1,
  },
  accountInfo: {
    flex: 1,
  },
  accountEmail: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  accountUsername: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  removeButton: {
    padding: 8,
    marginLeft: 12,
  },
  removeButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  addAccountButton: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  addAccountGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    position: 'relative',
  },
  addAccountGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 0, 255, 0.2)',
    zIndex: -1,
  },
  addAccountText: {
    color: '#fff',
    marginLeft: 12,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AccountSwitcher;