import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const OTPVerificationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const { email } = route.params;

  const handleVerify = async () => {
    if (!token) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email,
        token: token.trim(),
        type: 'signup',
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      Alert.alert(
        'Success',
        'Your email has been verified! You can now log in.'
      );
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 50 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#3399ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Account</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.infoText}>
          An email with a verification code has been sent to {email}.
        </Text>
        <TextInput 
          style={styles.input}
          placeholder="Enter verification code"
          placeholderTextColor="#666666"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          keyboardType="number-pad"
        />
        <TouchableOpacity 
          style={[styles.verifyButton, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          <Text style={styles.verifyButtonText}>
            {loading ? 'Verifying...' : 'Verify'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ paddingBottom: insets.bottom }} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000033' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingBottom: 15 },
  backButton: { padding: 5 },
  headerTitle: { color: '#3399ff', fontSize: 20, fontWeight: 'bold', marginLeft: 15 },
  content: { flex: 1, padding: 20, justifyContent: 'center' },
  infoText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#000066',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#3399ff',
    textAlign: 'center',
    fontSize: 18,
  },
  verifyButton: {
    backgroundColor: '#3399ff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.7 },
  verifyButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});

export default OTPVerificationScreen;