
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ChangePassword= () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const validatePassword = (password) => {
    if (password.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    return null;
  };

  const handleChangePassword = async () => {
    // Validation
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      Alert.alert('Error', passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (oldPassword === newPassword) {
      Alert.alert('Error', 'New password must be different from old password');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Get current user email
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Unable to get user information');
      }

      // Step 2: Verify old password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      });

      if (signInError) {
        Alert.alert('Error', 'Current password is incorrect');
        setLoading(false);
        return;
      }

      // Step 3: Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw updateError;
      }

      // Success
      Alert.alert(
        'Success',
        'Your password has been changed successfully',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );

      // Clear fields
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');

    } catch (error) {
      console.error('Error changing password:', error);
      Alert.alert('Error', error.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderPasswordInput = (
    label,
    value,
    onChangeText,
    placeholder,
    showPassword,
    setShowPassword,
    icon
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.passwordInputWrapper}>
        <LinearGradient
          colors={['rgba(255, 215, 0, 0.08)', 'rgba(255, 215, 0, 0.04)']}
          style={styles.inputGradient}
        >
          <View style={styles.iconContainer}>
            <Ionicons name={icon} size={20} color="#ffd700" />
          </View>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            editable={!loading}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeIcon}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color="rgba(255, 215, 0, 0.6)"
            />
          </TouchableOpacity>
        </LinearGradient>
      </View>
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
        <Text style={styles.headerTitle}>Change Password</Text>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom + 20 : 40 }]}
      >
        <View style={styles.infoCard}>
          <LinearGradient
            colors={['rgba(255, 215, 0, 0.1)', 'rgba(255, 215, 0, 0.05)']}
            style={styles.infoCardGradient}
          >
            <Ionicons name="information-circle" size={24} color="#ffd700" />
            <Text style={styles.infoText}>
              For security, you must enter your current password before setting a new one.
            </Text>
          </LinearGradient>
        </View>

        <View style={styles.form}>
          {renderPasswordInput(
            'Current Password',
            oldPassword,
            setOldPassword,
            'Enter your current password',
            showOldPassword,
            setShowOldPassword,
            'lock-closed'
          )}

          {renderPasswordInput(
            'New Password',
            newPassword,
            setNewPassword,
            'Enter new password (min 6 characters)',
            showNewPassword,
            setShowNewPassword,
            'key'
          )}

          {renderPasswordInput(
            'Confirm New Password',
            confirmPassword,
            setConfirmPassword,
            'Re-enter new password',
            showConfirmPassword,
            setShowConfirmPassword,
            'checkmark-circle'
          )}

          <View style={styles.passwordRequirements}>
            <Text style={styles.requirementsTitle}>Password Requirements:</Text>
            <View style={styles.requirementItem}>
              <Ionicons 
                name={newPassword.length >= 6 ? "checkmark-circle" : "ellipse-outline"} 
                size={16} 
                color={newPassword.length >= 6 ? "#4ade80" : "rgba(255, 255, 255, 0.4)"} 
              />
              <Text style={[
                styles.requirementText,
                newPassword.length >= 6 && styles.requirementMet
              ]}>
                At least 6 characters
              </Text>
            </View>
            <View style={styles.requirementItem}>
              <Ionicons 
                name={newPassword && newPassword === confirmPassword ? "checkmark-circle" : "ellipse-outline"} 
                size={16} 
                color={newPassword && newPassword === confirmPassword ? "#4ade80" : "rgba(255, 255, 255, 0.4)"} 
              />
              <Text style={[
                styles.requirementText,
                newPassword && newPassword === confirmPassword && styles.requirementMet
              ]}>
                Passwords match
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleChangePassword}
            disabled={loading}
          >
            <LinearGradient
              colors={loading ? ['#666', '#555'] : ['#ffd700', '#ffed4e']}
              style={styles.submitButtonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={20} color="#000" />
                  <Text style={styles.submitButtonText}>Update Password</Text>
                </>
              )}
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  infoCard: {
    marginBottom: 30,
    borderRadius: 15,
    overflow: 'hidden',
  },
  infoCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: 15,
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    marginBottom: 8,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    textShadowColor: 'rgba(255, 215, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  passwordInputWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  inputGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  iconContainer: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 12,
  },
  eyeIcon: {
    padding: 8,
  },
  passwordRequirements: {
    marginTop: 10,
    padding: 16,
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.1)',
  },
  requirementsTitle: {
    color: '#ffd700',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requirementText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginLeft: 8,
  },
  requirementMet: {
    color: '#4ade80',
  },
  submitButton: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  submitButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ChangePasswordScreen;


