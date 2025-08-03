import RazorpayCheckout from 'react-native-razorpay';
import { Alert } from 'react-native';
import { supabase } from '../config/supabase';
import { RAZORPAY_KEY_ID } from '@env';

export const donate = async (amount) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, phone')
      .eq('id', user.id)
      .single();

    const options = {
      description: "Donation to Founder",
      currency: "INR",
      key: RAZORPAY_KEY_ID,
      amount: Math.round(amount * 100), // Convert to paise and ensure it's an integer
      name: 'Perfect FL',
      prefill: {
        email: profile?.email || user.email || "user@example.com",
        contact: profile?.phone || "9999999999",
        name: "User",
      },
      theme: {
        color: "#ff00ff"
      },
    };

    const paymentData = await RazorpayCheckout.open(options);
    return paymentData;
  } catch (error) {
    // Check for payment cancellation in different possible error structures
    if (error.code === 'PAYMENT_CANCELLED' || 
        (error.error && error.error.reason === 'payment_cancelled') ||
        (error.description && error.description.includes('cancelled'))) {
      console.log('Payment was cancelled by user');
      throw { code: 'PAYMENT_CANCELLED', message: 'Payment was cancelled' };
    }
    console.error('Donation error:', error);
    throw error;
  }
};
