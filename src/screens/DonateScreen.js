import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, Animated, Dimensions } from 'react-native';
import { supabase } from '../lib/supabase';
import { donate } from '../lib/donate';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const DonateScreen = () => {
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const navigation = useNavigation();

  // Animation refs for ultra-premium effects
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const buttonPulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    initializeAnimations();
  }, []);

  const initializeAnimations = () => {
    // Main entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous pulse animation
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
    ).start();

    // Continuous glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Continuous shimmer animation
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: true,
      })
    ).start();

    // Button pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(buttonPulseAnim, {
          toValue: 1.02,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(buttonPulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Floating animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -5,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 5,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

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
    <LinearGradient colors={['#000', '#1a1a2e', '#16213e']} style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Animated.View 
            style={[
              styles.container,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            {/* Enhanced Header with animations */}
            <Animated.View
              style={[
                styles.header,
                {
                  transform: [{ scale: scaleAnim }, { translateY: floatAnim }]
                }
              ]}
            >
              <LinearGradient
                colors={['rgba(255, 0, 255, 0.3)', 'rgba(0, 255, 255, 0.2)', 'transparent']}
                style={styles.headerGradient}
              >
                {/* Header glow effect */}
                <Animated.View
                  style={[
                    styles.headerGlow,
                    {
                      opacity: glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.2, 0.6]
                      })
                    }
                  ]}
                />
                
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={() => navigation.goBack()}
                  >
                    <LinearGradient
                      colors={['#ff00ff', '#00ffff']}
                      style={styles.backButtonGradient}
                    >
                      <Ionicons name="arrow-back" size={20} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
                
                <Animated.Text 
                  style={[
                    styles.title,
                    { transform: [{ scale: pulseAnim }] }
                  ]}
                >
                  💎 Support the Founder
                </Animated.Text>
                
                {/* Header shimmer effect */}
                <Animated.View
                  style={[
                    styles.headerShimmer,
                    {
                      opacity: shimmerAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, 0.3, 0]
                      }),
                      transform: [{
                        translateX: shimmerAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-width, width]
                        })
                      }]
                    }
                  ]}
                >
                  <LinearGradient
                    colors={['transparent', 'rgba(255, 0, 255, 0.4)', 'rgba(0, 255, 255, 0.4)', 'transparent']}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 0}}
                    style={styles.shimmerGradient}
                  />
                </Animated.View>
              </LinearGradient>
            </Animated.View>
            
            {/* Enhanced Input Fields */}
            <Animated.View 
              style={[
                styles.inputContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }]
                }
              ]}
            >
              <LinearGradient
                colors={['rgba(26, 26, 46, 0.8)', 'rgba(22, 33, 62, 0.6)']}
                style={styles.inputWrapper}
              >
                <Animated.View
                  style={[
                    styles.inputGlow,
                    {
                      opacity: glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.1, 0.4]
                      })
                    }
                  ]}
                />
                <Text style={styles.label}>Your Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your name"
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={setName}
                />
              </LinearGradient>
            </Animated.View>

            <Animated.View 
              style={[
                styles.inputContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }]
                }
              ]}
            >
              <LinearGradient
                colors={['rgba(26, 26, 46, 0.8)', 'rgba(22, 33, 62, 0.6)']}
                style={styles.inputWrapper}
              >
                <Animated.View
                  style={[
                    styles.inputGlow,
                    {
                      opacity: glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.1, 0.4]
                      })
                    }
                  ]}
                />
                <Text style={styles.label}>Amount (₹)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter amount"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                />
              </LinearGradient>
            </Animated.View>

            {/* Enhanced Donate Button */}
            <Animated.View
              style={[
                {
                  transform: [{ scale: buttonPulseAnim }, { translateY: floatAnim }]
                }
              ]}
            >
              <TouchableOpacity style={styles.donateButton} onPress={handleDonation}>
                <LinearGradient
                  colors={['#ff00ff', '#ff6b9d', '#00ffff']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}
                  style={styles.donateButtonGradient}
                >
                  <Animated.View
                    style={[
                      styles.buttonGlow,
                      {
                        opacity: glowAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 0.8]
                        })
                      }
                    ]}
                  />
                  <Animated.Text 
                    style={[
                      styles.donateButtonText,
                      { transform: [{ scale: pulseAnim }] }
                    ]}
                  >
                    💝 Donate Now
                  </Animated.Text>
                  
                  {/* Button shimmer effect */}
                  <Animated.View
                    style={[
                      styles.buttonShimmer,
                      {
                        opacity: shimmerAnim.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [0, 0.4, 0]
                        }),
                        transform: [{
                          translateX: shimmerAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-200, 200]
                          })
                        }]
                      }
                    ]}
                  >
                    <LinearGradient
                      colors={['transparent', 'rgba(255, 255, 255, 0.6)', 'transparent']}
                      start={{x: 0, y: 0}}
                      end={{x: 1, y: 0}}
                      style={styles.shimmerGradient}
                    />
                  </Animated.View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: 20,
    paddingTop: 10,
  },
  header: {
    marginBottom: 40,
    position: 'relative',
    overflow: 'hidden',
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 0, 255, 0.3)',
    position: 'relative',
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    borderRadius: 20,
  },
  headerShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 200,
  },
  shimmerGradient: {
    flex: 1,
    borderRadius: 20,
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  backButtonGradient: {
    padding: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginRight: 30,
    textShadowColor: 'rgba(255, 0, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  inputContainer: {
    marginBottom: 25,
  },
  inputWrapper: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 0, 255, 0.2)',
    position: 'relative',
    overflow: 'hidden',
  },
  inputGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 0, 255, 0.05)',
    borderRadius: 20,
  },
  label: {
    color: '#ffffff',
    fontSize: 18,
    marginBottom: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(255, 0, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  input: {
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 15,
    padding: 18,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    borderWidth: 2,
    borderColor: 'rgba(255, 0, 255, 0.3)',
  },
  donateButton: {
    borderRadius: 25,
    marginTop: 30,
    marginBottom: 60,
    elevation: 8,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  donateButtonGradient: {
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  buttonGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  buttonShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 100,
  },
  donateButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default DonateScreen;