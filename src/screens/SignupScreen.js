import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SignupScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!email || !password || !username) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const lowerEmail = email.trim().toLowerCase();
    if (!lowerEmail.endsWith('@gmail.com') && !lowerEmail.endsWith('@hotmail.com')) {
      Alert.alert('Error', 'Only Gmail or Hotmail addresses are allowed');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: lowerEmail,
        password: password.trim(),
        options: {
          data: { username: username.trim() },
        },
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      if (data.user) {
        Alert.alert(
          'Verify your email',
          'We sent you a confirmation code. Please check your email and enter the code to verify your account.'
        );
        navigation.navigate('OTPVerification', { email: lowerEmail });
      } else {
        Alert.alert('Error', 'An unexpected error occurred during sign-up.');
      }
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
        <Text style={styles.headerTitle}>Create Account</Text>
      </View>

      <View style={styles.content}>
        <TextInput 
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#666666"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput 
          style={styles.input}
          placeholder="Email (Gmail or Hotmail only)"
          placeholderTextColor="#666666"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput 
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#666666"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        <TouchableOpacity 
          style={[styles.signupButton, loading && styles.buttonDisabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          <Text style={styles.signupButtonText}>
            {loading ? 'Creating Account...' : 'Sign Up'}
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
  input: {
    backgroundColor: '#000066',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#3399ff',
  },
  signupButton: {
    backgroundColor: '#3399ff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.7 },
  signupButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});

export default SignupScreen;
