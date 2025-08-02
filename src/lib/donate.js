import RazorpayCheckout from 'react-native-razorpay';
import { supabase } from '../config/supabase';

// Simple helper to trigger a one-time donation (default ₹50)
// amountRupees – integer, whole rupee value
export const donate = async (amountRupees = 50) => {
  try {
    const amountPaise = amountRupees * 100; // Razorpay expects the smallest currency unit

    // Create order via Supabase Edge Function (you must implement this on the backend)
    const { data: orderRes, error } = await supabase.functions.invoke('create-razorpay-order', {
      body: { amount: amountPaise }
    });
    if (error) throw error;

    const options = {
      key: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID, // expose your key via app config
      name: 'Donate to Founder',
      description: 'Thank you for supporting the project!',
      currency: 'INR',
      amount: amountPaise.toString(),
      order_id: orderRes.orderId, // <- returned from edge function
      theme: { color: '#F37254' }
    };

    // Open Razorpay modal
    const paymentResult = await RazorpayCheckout.open(options);

    // Verify payment signature on the server
    await supabase.functions.invoke('verify-razorpay', { body: paymentResult });

    return paymentResult;
  } catch (err) {
    console.error('Donation error', err);
    throw err;
  }
};
