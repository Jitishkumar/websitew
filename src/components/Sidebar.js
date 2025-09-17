import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OfflineChatModal from './OfflineChatModal';
import ProfileVisitsModal from './ProfileVisitsModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { donate } from '../lib/donate';
import { LinearGradient } from 'expo-linear-gradient';



const Sidebar = ({ isVisible, onClose }) => {
  const navigation = useNavigation();
  const [showOfflineChatModal, setShowOfflineChatModal] = useState(false);
  const [showVisitsModal, setShowVisitsModal] = useState(false);
  const [showConfessionInfoModal, setShowConfessionInfoModal] = useState(false);
  const [isFemaleProfle, setIsFemaleProfle] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (isVisible) {
      checkUserGender();
    }
  }, [isVisible]);

  const checkUserGender = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('gender')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setIsFemaleProfle(data?.gender === 'female');
    } catch (error) {
      console.error('Error checking user gender:', error);
    }
  };

  const handleLogout = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Error', 'No user session found');
        return;
      }

      // Store the email before signing out
      const userEmail = user.email;

      // Sign out from Supabase first
      const { error } = await supabase.auth.signOut();
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      // Clear all saved accounts from AsyncStorage
      try {
        await AsyncStorage.removeItem('savedAccounts');
        await AsyncStorage.removeItem('accountsLastUpdated');
      } catch (storageError) {
        console.error('Storage error:', storageError);
      }
      
      onClose();
      navigation.replace('Login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout');
    }
  };

  const handleAddAccount = () => {
    onClose();
    navigation.navigate('Signup');
  };

  return (
    <>
      <Modal
        visible={isVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={onClose}
      >
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f3460']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.sidebar,
            { 
              paddingTop: insets.top > 0 ? insets.top : 20,
              paddingLeft: insets.left + 20,
              paddingRight: 20,
              paddingBottom: insets.bottom > 0 ? insets.bottom : 20
            }
          ]}
        >
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <View style={styles.closeButtonContainer}>
              <Ionicons name="close" size={24} color="#ffd700" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => {
              setShowConfessionInfoModal(true);
            }}
          >
            <LinearGradient
              colors={['rgba(255, 215, 0, 0.1)', 'rgba(255, 215, 0, 0.05)']}
              style={styles.menuItemGradient}
            >
              <Ionicons name="heart" size={24} color="#ffd700" />
              <Text style={styles.menuText}>Confessions</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255, 215, 0, 0.6)" />
            </LinearGradient>
          </TouchableOpacity>

          {isFemaleProfle && (
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => setShowVisitsModal(true)}
            >
              <LinearGradient
                colors={['rgba(156, 136, 255, 0.1)', 'rgba(156, 136, 255, 0.05)']}
                style={styles.menuItemGradient}
              >
                <Ionicons name="eye" size={24} color="#9c88ff" />
                <Text style={styles.menuText}>Profile Visits</Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(156, 136, 255, 0.6)" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {
              onClose();
              navigation.navigate('Settings');
            }}
          >
            <LinearGradient
              colors={['rgba(102, 126, 234, 0.1)', 'rgba(102, 126, 234, 0.05)']}
              style={styles.menuItemGradient}
            >
              <Ionicons name="settings" size={24} color="#667eea" />
              <Text style={styles.menuText}>Settings</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(102, 126, 234, 0.6)" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleAddAccount}>
            <LinearGradient
              colors={['rgba(255, 107, 107, 0.1)', 'rgba(255, 107, 107, 0.05)']}
              style={styles.menuItemGradient}
            >
              <Ionicons name="person-add" size={24} color="#ff6b6b" />
              <Text style={styles.menuText}>Add Account</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255, 107, 107, 0.6)" />
            </LinearGradient>
          </TouchableOpacity>

           {/* Donate to Founder */}
           <TouchableOpacity
             style={styles.menuItem}
             onPress={() => {
               onClose();
               navigation.navigate('Donate');
             }}
           >
             <LinearGradient
               colors={['rgba(255, 215, 0, 0.15)', 'rgba(255, 215, 0, 0.08)']}
               style={styles.menuItemGradient}
             >
               <Ionicons name="diamond" size={24} color="#ffd700" />
               <Text style={styles.menuText}>Donate to Founder</Text>
               <Ionicons name="chevron-forward" size={16} color="rgba(255, 215, 0, 0.6)" />
             </LinearGradient>
           </TouchableOpacity>

           {/* Wealthiest Donors */}
           <TouchableOpacity
             style={styles.menuItem}
             onPress={() => {
               onClose();
               navigation.navigate('WealthiestDonors');
             }}
           >
             <LinearGradient
               colors={['rgba(255, 193, 7, 0.15)', 'rgba(255, 193, 7, 0.08)']}
               style={styles.menuItemGradient}
             >
               <Ionicons name="trophy" size={24} color="#ffc107" />
               <Text style={styles.menuText}>Wealthiest Donors</Text>
               <Ionicons name="chevron-forward" size={16} color="rgba(255, 193, 7, 0.6)" />
             </LinearGradient>
           </TouchableOpacity>

           {/* Offline Chat */}
           <TouchableOpacity 
             style={styles.menuItem}
             onPress={() => setShowOfflineChatModal(true)}
           >
             <LinearGradient
               colors={['rgba(0, 122, 255, 0.1)', 'rgba(0, 122, 255, 0.05)']}
               style={styles.menuItemGradient}
             >
               <Ionicons name="wifi-outline" size={24} color="#007AFF" />
               <Text style={styles.menuText}>Offline Chat</Text>
               <Ionicons name="chevron-forward" size={16} color="rgba(0, 122, 255, 0.6)" />
             </LinearGradient>
           </TouchableOpacity>

           {/* Logout */}
           <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <LinearGradient
              colors={['rgba(255, 82, 82, 0.1)', 'rgba(255, 82, 82, 0.05)']}
              style={styles.menuItemGradient}
            >
              <Ionicons name="log-out" size={24} color="#ff5252" />
              <Text style={styles.menuText}>Logout</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255, 82, 82, 0.6)" />
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
      
      <ProfileVisitsModal
        visible={showVisitsModal}
        onClose={() => setShowVisitsModal(false)}
      />
      
      {/* Confession Info Modal */}
      <Modal
        visible={showConfessionInfoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfessionInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f3460']}
            style={styles.modalContent}
          >
            <ScrollView>
              <Text style={styles.modalTitle}>How to Use Confessions</Text>
              <Text style={styles.modalText}>
                In the Confession feature, you can write about any person, office, building, or place by their name.
              </Text>
              <Text style={styles.modalText}>
                • Search for a person, place, or building by typing their name
              </Text>
              <Text style={styles.modalText}>
                • Select from the suggestions that appear
              </Text>
              <Text style={styles.modalText}>
                • If what you're looking for isn't in the suggestions, you can create a new entry
              </Text>
              <Text style={styles.modalText}>
                • Write your confession and optionally add media
              </Text>
              <Text style={styles.modalText}>
                • Choose whether to remain anonymous
              </Text>
              <Text style={styles.modalText}>
                Share your thoughts, experiences, or feelings about places and people.
                
              </Text>
            </ScrollView>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity 
                style={styles.modalButton} 
                onPress={() => {
                  setShowConfessionInfoModal(false);
                  onClose();
                  navigation.navigate('ConfessionButton');
                }}
              >
                <LinearGradient
                  colors={['#ffd700', '#ffb300']}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.modalButtonText}>Continue to Confessions</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setShowConfessionInfoModal(false)}
              >
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.modalButtonText}>Close</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      <OfflineChatModal
        visible={showOfflineChatModal}
        onClose={() => setShowOfflineChatModal(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  sidebar: {
    width: '75%',
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  closeButton: {
    marginBottom: 20,
    alignSelf: 'flex-end',
  },
  closeButtonContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  menuItem: {
    marginVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItemGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 15,
  },
  modalTitle: {
    color: '#ffd700',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  modalText: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 12,
    lineHeight: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modalButtonContainer: {
    marginTop: 24,
  },
  modalButton: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonGradient: {
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  cancelButton: {
    // No background needed as gradient handles it
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  menuText: {
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 16,
    flex: 1,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default Sidebar;