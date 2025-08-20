import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProfileVisitsModal from './ProfileVisitsModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { donate } from '../lib/donate';



const Sidebar = ({ isVisible, onClose }) => {
  const navigation = useNavigation();
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
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={[
          styles.sidebar,
          { 
            paddingTop: insets.top > 0 ? insets.top : 20,
            paddingLeft: insets.left + 20,
            paddingRight: 20,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 20
          }
        ]}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#ff00ff" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => {
              setShowConfessionInfoModal(true);
            }}
          >
            <Ionicons name="heart" size={24} color="#ff00ff" />
            <Text style={styles.menuText}>Confessions</Text>
          </TouchableOpacity>

          {isFemaleProfle && (
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => setShowVisitsModal(true)}
            >
              <Ionicons name="eye" size={24} color="#ff00ff" />
              <Text style={styles.menuText}>Profile Visits</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {
              onClose();
              navigation.navigate('Settings');
            }}
          >
            <Ionicons name="settings" size={24} color="#ff00ff" />
            <Text style={styles.menuText}>Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleAddAccount}>
             <Ionicons name="person-add" size={24} color="#ff00ff" />
             <Text style={styles.menuText}>Add Account</Text>
           </TouchableOpacity>

           {/* Donate to Founder */}
           <TouchableOpacity
             style={styles.menuItem}
             onPress={() => {
               onClose();
               navigation.navigate('Donate');
             }}
           >
             <Ionicons name="cash-outline" size={24} color="#ff00ff" />
             <Text style={styles.menuText}>Donate to Founder</Text>
           </TouchableOpacity>

           {/* Wealthiest Donors */}
           <TouchableOpacity
             style={styles.menuItem}
             onPress={() => {
               onClose();
               navigation.navigate('WealthiestDonors');
             }}
           >
             <Ionicons name="trophy-outline" size={24} color="#ff00ff" />
             <Text style={styles.menuText}>Wealthiest Donors</Text>
           </TouchableOpacity>

           {/* Logout */}
           <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <Ionicons name="log-out" size={24} color="#ff00ff" />
            <Text style={styles.menuText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
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
          <View style={styles.modalContent}>
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
                  navigation.navigate('Confession');
                }}
              >
                <Text style={styles.modalButtonText}>Continue to Confessions</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setShowConfessionInfoModal(false)}
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sidebar: {
    width: '70%',
    height: '100%',
    backgroundColor: '#330033',
  },
  closeButton: {
    marginBottom: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#440044',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#330033',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#ff00ff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalText: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 10,
    lineHeight: 22,
  },
  modalButtonContainer: {
    marginTop: 20,
  },
  modalButton: {
    backgroundColor: '#ff00ff',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 10,
  },
  cancelButton: {
    backgroundColor: '#550055',
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuText: {
    color: '#ff00ff',
    fontSize: 16,
    marginLeft: 15,
  },
});

export default Sidebar;