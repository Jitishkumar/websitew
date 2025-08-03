import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
// Remove Camera import since we're having issues with it
// import { Camera } from 'expo-camera';
import { RAZORPAY_KEY_ID } from '@env';
import RazorpayCheckout from 'react-native-razorpay';
import { uploadToCloudinary } from '../config/cloudinary';

const VerifyAccountScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [realName, setRealName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [document, setDocument] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [uploading, setUploading] = useState(false);
  // Remove Camera-related state variables
  // const [hasCameraPermission, setHasCameraPermission] = useState(null);
  // const [cameraRef, setCameraRef] = useState(null);
  // const [showCamera, setShowCamera] = useState(false);
  // const [cameraType, setCameraType] = useState(Camera.Constants.Type.front);
  
  // Get user profile on mount and request camera permissions
  useEffect(() => {
    fetchUserProfile();
    // Request image picker permissions instead of camera
    (async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos');
      }
    })();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      if (data) {
        setRealName(data.full_name || '');
        // Phone number will be set by user input since the column doesn't exist yet
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        setDocument(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to select document');
    }
  };

  const takeSelfie = async () => {
    try {
      // Use ImagePicker with camera instead of Camera component
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        cameraType: ImagePicker.CameraType.front,
      });

      if (!result.canceled) {
        setSelfie(result.assets[0]);
      }
    } catch (error) {
      console.error('Error taking selfie:', error);
      Alert.alert('Error', 'Failed to take selfie');
    }
  };

  // Remove unused camera functions
  // const handleTakePicture = async () => {
  //   if (cameraRef) {
  //     try {
  //       const photo = await cameraRef.takePictureAsync({
  //         quality: 0.8,
  //         skipProcessing: false,
  //       });
  //       setSelfie(photo);
  //       setShowCamera(false);
  //     } catch (error) {
  //       console.error('Error taking picture:', error);
  //       Alert.alert('Error', 'Failed to take selfie');
  //     }
  //   }
  // };

  // const cancelCamera = () => {
  //   setShowCamera(false);
  // };

  const uploadDocuments = async () => {
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Upload ID document to Cloudinary
      let documentUrl = null;
      let documentPublicId = null;
      if (document) {
        try {
          console.log('Uploading ID document to Cloudinary...');
          const result = await uploadToCloudinary(document.uri, 'image');
          documentUrl = result.url;
          documentPublicId = result.publicId;
          console.log('ID document uploaded successfully:', documentUrl);
        } catch (uploadError) {
          console.error('Error uploading ID document to Cloudinary:', uploadError);
          throw new Error(`Failed to upload ID document: ${uploadError.message}`);
        }
      }

      // Upload selfie to Cloudinary
      let selfieUrl = null;
      let selfiePublicId = null;
      if (selfie) {
        try {
          console.log('Uploading selfie to Cloudinary...');
          const result = await uploadToCloudinary(selfie.uri, 'image');
          selfieUrl = result.url;
          selfiePublicId = result.publicId;
          console.log('Selfie uploaded successfully:', selfieUrl);
        } catch (uploadError) {
          console.error('Error uploading selfie to Cloudinary:', uploadError);
          throw new Error(`Failed to upload selfie: ${uploadError.message}`);
        }
      }

      // Get username for the verified_accounts table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Check if entry already exists and update instead of insert if it does
      const { data: existingVerification } = await supabase
        .from('verified_accounts')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      let error;
      if (existingVerification) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('verified_accounts')
          .update({
            username: profileData.username,
            document_url: documentUrl,
            selfie_url: selfieUrl,
            verified: false
          })
          .eq('id', user.id);
        error = updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('verified_accounts')
          .insert({
            id: user.id,
            username: profileData.username,
            document_url: documentUrl,
            selfie_url: selfieUrl,
            verified: false
          });
        error = insertError;
      }

      if (error) throw error;

      return { documentUrl, selfieUrl };
    } catch (error) {
      console.error('Error uploading documents:', error);
      Alert.alert('Error', 'Failed to upload documents');
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleVerificationPayment = async () => {
    // Validate inputs
    if (!realName.trim()) {
      Alert.alert('Error', 'Please enter your real name');
      return;
    }

    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    if (!document) {
      Alert.alert('Error', 'Please upload your ID document');
      return;
    }

    if (!selfie) {
      Alert.alert('Error', 'Please take a selfie for verification');
      return;
    }

    try {
      setLoading(true);
      
      // Show processing alert to prevent user from closing the screen
      Alert.alert(
        'Processing',
        'Please wait while we process your verification. Do not close this screen.',
        [],
        { cancelable: false }
      );
      
      // Upload documents first
      const { documentUrl, selfieUrl } = await uploadDocuments();
      
      // Get user data
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      // Process payment
      const options = {
        description: "Account Verification (1 month)",
        currency: "INR",
        key: RAZORPAY_KEY_ID,
        amount: 100, // 70 rupees in paise
        name: 'Perfect FL',
        prefill: {
          email: profile?.email || user.email || "user@example.com",
          contact: phoneNumber || "9999999999",
          name: realName,
        },
        theme: {
          color: "#ff00ff"
        },
      };

      // Dismiss the processing alert before opening payment
      Alert.alert(
        '',
        '',
        [{ text: 'OK', style: 'cancel' }],
        { cancelable: true }
      );

      const paymentData = await RazorpayCheckout.open(options);
      
      // Show processing alert again after payment
      Alert.alert(
        'Finalizing',
        'Please wait while we finalize your verification. Do not close this screen.',
        [],
        { cancelable: false }
      );
      
      // Save verification data
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 month from now
      
      const { error } = await supabase
        .from('profiles')
        .update({
          real_name: realName,
          phone: phoneNumber, // Add phone number to the update
          id_document1_url: documentUrl, // Keep this for backward compatibility
          verification_payment_id: paymentData.razorpay_payment_id,
          verification_expires_at: expiryDate.toISOString(),
          // Note: verification status in verified_accounts table remains false until manually verified by admin
      // Images are now stored in Cloudinary instead of Supabase storage
        })
        .eq('id', user.id);

      if (error) throw error;

      // Dismiss the processing alert before showing success
      Alert.alert(
        '',
        '',
        [{ text: 'OK', style: 'cancel' }],
        { cancelable: true }
      );

      Alert.alert(
        'Verification Submitted',
        'Your verification request has been submitted. Once approved, a red verification badge will appear next to your username.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      if (error.code !== 'PAYMENT_CANCELLED') {
        console.error('Verification error:', error);
        Alert.alert('Error', 'Failed to complete verification process');
      }
    } finally {
      setLoading(false);
    }
  };

  // Remove Camera UI since we're using ImagePicker instead
  // if (showCamera) {
  //   return (
  //     <SafeAreaView style={styles.safeArea}>
  //       <View style={styles.cameraContainer}>
  //         <Camera
  //           style={styles.camera}
  //           type={cameraType}
  //           ref={ref => setCameraRef(ref)}
  //         >
  //           <View style={styles.cameraControls}>
  //             <TouchableOpacity 
  //               style={styles.cameraButton}
  //               onPress={cancelCamera}
  //             >
  //               <Ionicons name="close-circle" size={40} color="#fff" />
  //             </TouchableOpacity>
  //             
  //             <TouchableOpacity 
  //               style={styles.cameraButton}
  //               onPress={handleTakePicture}
  //             >
  //               <Ionicons name="radio-button-on" size={70} color="#fff" />
  //             </TouchableOpacity>
  //             
  //             <TouchableOpacity 
  //               style={styles.cameraButton}
  //               onPress={() => setCameraType(
  //                 cameraType === Camera.Constants.Type.front
  //                   ? Camera.Constants.Type.back
  //                   : Camera.Constants.Type.front
  //               )}
  //             >
  //               <Ionicons name="camera-reverse" size={40} color="#fff" />
  //             </TouchableOpacity>
  //           </View>
  //         </Camera>
  //       </View>
  //     </SafeAreaView>
  //   );
  // }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <LinearGradient
          colors={['#330033', '#000000']}
          style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 50 }]}
        >
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#ff00ff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verify Account</Text>
        </LinearGradient>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }]}
        >
          <View style={styles.infoContainer}>
            <Ionicons name="checkmark-circle" size={24} color="#ff0000" style={styles.infoIcon} />
            <Text style={styles.infoText}>
              Get a red verification badge next to your username for ₹10/month. Your information will be reviewed manually.
            </Text>
          </View>
          
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ff00ff" />
              <Text style={styles.loadingText}>Processing verification. Please wait and do not close this screen.</Text>
            </View>
          )}

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Real Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your legal name"
                placeholderTextColor="#666"
                value={realName}
                onChangeText={setRealName}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your phone number"
                placeholderTextColor="#666"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
              />
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Identity Verification</Text>
            <Text style={styles.description}>
              Please upload a government-issued ID document (Aadhaar, PAN, Passport, etc.) and take a selfie for verification.
            </Text>

            <TouchableOpacity 
              style={[styles.documentButton, document && styles.documentSelected]}
              onPress={pickDocument}
            >
              <Ionicons 
                name={document ? "checkmark-circle" : "add-circle-outline"} 
                size={24} 
                color={document ? "#00ff00" : "#ff00ff"} 
              />
              <Text style={styles.documentButtonText}>
                {document ? "ID Document Selected" : "Upload ID Document"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.documentButton, selfie && styles.documentSelected]}
              onPress={takeSelfie}
            >
              <Ionicons 
                name={selfie ? "checkmark-circle" : "camera-outline"} 
                size={24} 
                color={selfie ? "#00ff00" : "#ff00ff"} 
              />
              <Text style={styles.documentButtonText}>
                {selfie ? "Selfie Captured" : "Take Selfie with Camera"}
              </Text>
            </TouchableOpacity>

            {selfie && (
              <View style={styles.previewContainer}>
                <Text style={styles.previewLabel}>Selfie Preview:</Text>
                <Image source={{ uri: selfie.uri }} style={styles.previewImage} />
              </View>
            )}
          </View>

          <View style={styles.paymentSection}>
            <Text style={styles.paymentTitle}>Verification Fee</Text>
            <Text style={styles.paymentAmount}>₹10.00</Text>
            <Text style={styles.paymentDescription}>One month of account verification</Text>
          </View>

          <TouchableOpacity 
            style={styles.verifyButton}
            onPress={handleVerificationPayment}
            disabled={loading || uploading}
          >
            {loading || uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.verifyButtonText}>Pay & Submit Verification</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            By submitting, you confirm that the information provided is accurate. Verification is subject to approval.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: '#330033',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: 12,
  },
  infoText: {
    color: '#fff',
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  formSection: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#ff00ff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  description: {
    color: '#999',
    fontSize: 14,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#222',
    borderRadius: 8,
    color: '#fff',
    fontSize: 16,
    padding: 12,
  },
  documentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  documentSelected: {
    backgroundColor: '#223322',
    borderColor: '#00ff00',
    borderWidth: 1,
  },
  documentButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
  },
  paymentSection: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  paymentTitle: {
    color: '#ff00ff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  paymentAmount: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  paymentDescription: {
    color: '#999',
    fontSize: 14,
  },
  verifyButton: {
    backgroundColor: '#ff00ff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disclaimer: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
  },
  // Camera styles - keeping for reference but no longer used with ImagePicker
  // cameraContainer: {
  //   flex: 1,
  //   backgroundColor: '#000',
  // },
  // camera: {
  //   flex: 1,
  // },
  // cameraControls: {
  //   flex: 1,
  //   backgroundColor: 'transparent',
  //   flexDirection: 'row',
  //   justifyContent: 'space-between',
  //   alignItems: 'flex-end',
  //   padding: 20,
  //   paddingBottom: 40,
  // },
  // cameraButton: {
  //   alignSelf: 'center',
  //   alignItems: 'center',
  //   backgroundColor: 'transparent',
  // },
  // Preview styles
  previewContainer: {
    marginTop: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  previewLabel: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  previewImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: '#ff00ff',
  },

});

export default VerifyAccountScreen;