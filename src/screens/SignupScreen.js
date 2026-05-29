import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const SignupScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useTheme();
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
          '✨ Almost There!',
          'We sent you a premium verification code. Please check your email and enter the code to unlock your exclusive Flexx experience.'
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
    <LinearGradient
      colors={theme.backgrounds}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top + 10 : 50 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <LinearGradient
            colors={[isDarkMode ? 'rgba(95, 115, 242, 0.15)' : 'rgba(79, 70, 229, 0.1)', isDarkMode ? 'rgba(95, 115, 242, 0.05)' : 'rgba(79, 70, 229, 0.05)']}
            style={styles.backButtonGradient}
          >
            <Ionicons name="arrow-back" size={24} color={theme.primaryAccent} />
          </LinearGradient>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.primaryAccent }]}>Create Account</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={[theme.primaryAccent, theme.secondaryAccent]}
            style={[styles.logoGradient, { shadowColor: theme.primaryAccent }]}
          >
            <Text style={styles.logo}>✨ Join Flexx</Text>
          </LinearGradient>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Premium Social Experience Awaits</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)' }]}>
            <Ionicons name="person-outline" size={20} color={theme.primaryAccent} style={styles.inputIcon} />
            <TextInput 
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="Username"
              placeholderTextColor={isDarkMode ? 'rgba(226, 232, 240, 0.4)' : 'rgba(15, 23, 42, 0.4)'}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)' }]}>
            <Ionicons name="mail-outline" size={20} color={theme.primaryAccent} style={styles.inputIcon} />
            <TextInput 
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="Email (Gmail or Hotmail only)"
              placeholderTextColor={isDarkMode ? 'rgba(226, 232, 240, 0.4)' : 'rgba(15, 23, 42, 0.4)'}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)' }]}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.primaryAccent} style={styles.inputIcon} />
            <TextInput 
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="Password"
              placeholderTextColor={isDarkMode ? 'rgba(226, 232, 240, 0.4)' : 'rgba(15, 23, 42, 0.4)'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity 
            style={[styles.signupButton, { shadowColor: theme.primaryAccent }, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            <LinearGradient
              colors={[theme.primaryAccent, theme.secondaryAccent]}
              style={styles.buttonGradient}
            >
              <Text style={styles.signupButtonText}>
                {loading ? 'Creating Account...' : 'Sign Up'}
              </Text>
              {!loading && <Ionicons name="sparkles" size={20} color="#ffffff" style={styles.buttonIcon} />}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ paddingBottom: insets.bottom }} />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingBottom: 20 
  },
  backButton: { 
    borderRadius: 12,
    overflow: 'hidden',
  },
  backButtonGradient: {
    padding: 12,
    borderRadius: 12,
  },
  headerTitle: { 
    color: '#ffd700', 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginLeft: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  content: { 
    flex: 1, 
    padding: 24, 
    justifyContent: 'center' 
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoGradient: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 22,
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a2e',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  formContainer: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  inputIcon: {
    marginLeft: 16,
    marginRight: 12,
  },
  input: {
    flex: 1,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
  },
  signupButton: {
    borderRadius: 16,
    marginTop: 20,
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
  },
  buttonDisabled: { opacity: 0.7 },
  signupButtonText: { 
    color: '#1a1a2e', 
    fontSize: 18, 
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  buttonIcon: {
    marginLeft: 8,
  },
});

export default SignupScreen;
