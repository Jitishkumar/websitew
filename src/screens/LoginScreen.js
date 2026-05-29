import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const LoginScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useTheme();
  const [identifier, setIdentifier] = useState(''); // email or username
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const resolveEmailFromIdentifier = async (raw) => {
    const id = raw.trim().toLowerCase();
    if (id.includes('@')) return id; // looks like an email, use directly

    // Otherwise, map username -> email via your RPC
    const { data: resolvedEmail, error } = await supabase.rpc(
      'get_user_by_email_or_username',
      { identifier: id }
    );
    if (error) throw error;
    if (!resolvedEmail) throw new Error('User not found');
    return resolvedEmail;
  };

  const ensureProfileExists = async (user) => {
    // Check if a profile already exists
    const { data: existing, error: selectErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (selectErr) throw selectErr;

    if (!existing) {
      // Insert minimal profile data; your DB trigger will set rank
      const usernameFromMeta = user.user_metadata?.username ?? null;

      const { error: insertErr } = await supabase.from('profiles').insert({
        id: user.id,
        username: usernameFromMeta,
        // no rank here; let BEFORE INSERT trigger assign_rank_on_insert handle it
      });

      // Ignore unique violation (if a race created it)
      // @ts-ignore (RN env: insertErr may have code)
      if (insertErr && insertErr.code !== '23505') {
        throw insertErr;
      }
    }
  };

  const handleLogin = async () => {
    try {
      setLoading(true);

      if (!identifier || !password) {
        throw new Error('Please enter your email/username and password.');
      }

      const emailToUse = await resolveEmailFromIdentifier(identifier);

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: password,
      });
      if (signInError) throw signInError;

      const user = signInData?.user;
      if (!user) throw new Error('Login failed. Please try again.');

      const isConfirmed = !!(user.email_confirmed_at || user.confirmed_at);
      if (!isConfirmed) {
        // Optional: sign out to avoid any partial sessions
        await supabase.auth.signOut();
        throw new Error('Please verify your email before logging in.');
      }

      // Create profile only AFTER verification & successful login
      await ensureProfileExists(user);

      navigation.replace('MainApp');
    } catch (error) {
      Alert.alert('Login Error', error.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={theme.backgrounds}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <View style={styles.logoContainer}>
        <LinearGradient
          colors={[theme.primaryAccent, theme.secondaryAccent]}
          style={[styles.logoGradient, { shadowColor: theme.primaryAccent }]}
        >
          <Text style={styles.logo}>✨ Flexx</Text>
        </LinearGradient>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Premium Social Experience</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)' }]}>
          <Ionicons name="person-outline" size={20} color={theme.primaryAccent} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: theme.textPrimary }]}
            placeholder="Email or Username"
            placeholderTextColor={isDarkMode ? 'rgba(226, 232, 240, 0.4)' : 'rgba(15, 23, 42, 0.4)'}
            value={identifier}
            onChangeText={setIdentifier}
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
          style={[styles.button, { shadowColor: theme.primaryAccent }, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          <LinearGradient
            colors={[theme.primaryAccent, theme.secondaryAccent]}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Logging in...' : 'Login'}
            </Text>
            {!loading && <Ionicons name="arrow-forward" size={20} color="#ffffff" style={styles.buttonIcon} />}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signupButton} onPress={() => navigation.navigate('Signup')}>
          <Text style={[styles.signupText, { color: theme.textSecondary }]}>Don't have an account? </Text>
          <Text style={[styles.signupTextBold, { color: theme.primaryAccent }]}>Sign up</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 24, 
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoGradient: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  logo: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#1a1a2e',
    textAlign: 'center',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  formContainer: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    marginBottom: 20,
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
    padding: 18,
    color: 'white',
    fontSize: 16,
  },
  button: {
    borderRadius: 16,
    marginTop: 12,
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
  buttonText: { 
    color: '#1a1a2e', 
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 1,
  },
  buttonIcon: {
    marginLeft: 8,
  },
  signupButton: { 
    marginTop: 32, 
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupText: { 
    color: 'rgba(255, 255, 255, 0.7)', 
    fontSize: 16,
  },
  signupTextBold: {
    color: '#ffd700',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LoginScreen;
