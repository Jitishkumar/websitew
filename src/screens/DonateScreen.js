import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { supabase } from '../config/supabase';
import { donate } from '../lib/donate';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const DonateScreen = () => {
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const navigation = useNavigation();

  const handleDonation = async () => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid donation amount');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your name');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please login to donate');
        return;
      }

      const donationAmount = parseFloat(amount);
      const paymentData = await donate(donationAmount);

      // Save donation record to Supabase
      const { error } = await supabase.from('donations').insert([
        {
          user_id: user.id,
          donor_name: name.trim(),
          amount: donationAmount,
          payment_id: paymentData.razorpay_payment_id,
          payment_verified: false, // Default to false, will be verified manually
        },
      ]);

      if (error) throw error;

      // Show success message explaining verification process
      Alert.alert(
        'Donation Successful',
        'Thank you for your donation! Your name will appear in the Wealthiest Donors list after payment verification.',
        [
          { text: 'OK', onPress: () => navigation.navigate('WealthiestDonors') }
        ]
      );
    } catch (error) {
      if (error.code !== 'PAYMENT_CANCELLED') {
        Alert.alert('Error', 'Failed to process donation');
        console.error('Donation error:', error);
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={24} color="#ff00ff" />
              </TouchableOpacity>
              <Text style={styles.title}>Support the Founder</Text>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Your Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor="#666666"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Amount (₹)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter amount"
                placeholderTextColor="#666666"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            <TouchableOpacity style={styles.donateButton} onPress={handleDonation}>
              <Text style={styles.donateButtonText}>Donate Now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000033',
    paddingTop: Platform.OS === 'ios' ? 50 : 30, // Additional padding for camera notch
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#000033',
    padding: 20,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  backButton: {
    padding: 5,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff00ff',
    textAlign: 'center',
    marginRight: 30, // To offset the back button and center the title
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#330033',
    borderRadius: 8,
    padding: 15,
    color: '#ffffff',
    fontSize: 16,
  },
  donateButton: {
    backgroundColor: '#ff00ff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 60, // Increased bottom padding for buttons
  },
  donateButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default DonateScreen;