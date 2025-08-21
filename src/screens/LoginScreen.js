import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LoginScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
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
      colors={['#0a0a2a', '#1a1a3a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <Text style={styles.logo}>Flexx</Text>

      <TextInput
        style={styles.input}
        placeholder="Email or Username"
        placeholderTextColor="#666"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#666"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Logging in...' : 'Login'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signupButton} onPress={() => navigation.navigate('Signup')}>
        <Text style={styles.signupText}>Don't have an account? Sign up</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  logo: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#ff00ff',
    textAlign: 'center',
    marginBottom: 40,
    textShadowColor: 'rgba(255, 0, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 15,
    marginBottom: 15,
    color: 'white',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.3)',
  },
  button: {
    backgroundColor: '#ff00ff',
    padding: 15,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: { color: 'white', fontWeight: 'bold' },
  signupButton: { marginTop: 20, alignItems: 'center' },
  signupText: { color: '#ff00ff', fontSize: 16 },
});

export default LoginScreen;
