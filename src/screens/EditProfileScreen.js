import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Image, Animated, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import { decode } from 'base64-arraybuffer';
import { useTheme } from '../context/ThemeContext';

const EditProfileScreen = ({ navigation }) => {
  const { isDarkMode, theme } = useTheme();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [coverUrl, setCoverUrl] = useState(null);
  const [tempCoverUrl, setTempCoverUrl] = useState(null); // For instant preview
  const [gender, setGender] = useState('');
  const [showGenderModal, setShowGenderModal] = useState(false);
  const blinkAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (data) {
          setName(data.full_name || '');
          setUsername(data.username || '');
          setBio(data.bio || '');
          setAvatarUrl(data.avatar_url);
          setCoverUrl(data.cover_url);
          setGender(data.gender || '');
          
          // If the cover URL is a video (either by extension or by the cover_is_video flag)
          if ((data.cover_url && data.cover_url.endsWith('.mp4')) || data.cover_is_video) {
            // Ensure the profile has the cover_is_video flag set
            if (!data.cover_is_video) {
              await supabase
                .from('profiles')
                .update({ cover_is_video: true })
                .eq('id', user.id);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const pickImage = async (type) => {
    try {
      // Allow videos only for cover photos, not for avatar
      const mediaTypes = type === 'cover' ? ['images', 'videos'] : ['images'];
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes,
        allowsEditing: true,
        aspect: type === 'avatar' ? [1, 1] : [16, 9],
        quality: type === 'cover' ? 0.7 : 0.5, // Better quality for cover
        base64: false, // Don't use base64 for faster upload
        videoMaxDuration: 30,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        const isVideo = file.type?.startsWith('video');
        
        if (type === 'avatar' && isVideo) {
          Alert.alert('Error', 'Videos can only be used as cover photos, not as profile pictures');
          return;
        }
        
        // Show immediate preview for cover photo (optimistic UI)
        if (type === 'cover') {
          setTempCoverUrl(file.uri);
          console.log('✅ Instant preview shown');
        }
        
        // Upload in background
        await uploadImageOptimized(file.uri, type, isVideo);
      }
    } catch (error) {
      console.error('Error picking media:', error);
      Alert.alert('Error', 'Failed to pick media');
      setTempCoverUrl(null);
    }
  };

  // Optimized upload without base64 encoding
  const uploadImageOptimized = async (fileUri, type, isVideo = false) => {
    try {
      setLoading(true);
      setUploadProgress(0);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      // Create FormData for direct file upload (faster than base64)
      const fileExtension = isVideo ? 'mp4' : 'jpg';
      const fileName = `${type}_${Date.now()}.${fileExtension}`;
      const filePath = `${user.id}/${fileName}`;
      
      // Fetch the file as blob (faster than base64)
      const response = await fetch(fileUri);
      const blob = await response.blob();
      
      // Check file size
      const fileSizeInMB = blob.size / (1024 * 1024);
      const maxSizeMB = isVideo ? 20 : 5;
      
      if (fileSizeInMB > maxSizeMB) {
        throw new Error(`File size too large. Please select a ${isVideo ? 'video' : 'photo'} under ${maxSizeMB}MB.`);
      }

      setUploadProgress(20);

      // Delete old file if exists (don't wait for it)
      if (type === 'avatar' && avatarUrl) {
        const oldPath = avatarUrl.split('/').pop();
        supabase.storage.from('media').remove([`${user.id}/${oldPath}`]).catch(console.error);
      } else if (type === 'cover' && coverUrl) {
        const oldPath = coverUrl.split('/').pop();
        supabase.storage.from('media').remove([`${user.id}/${oldPath}`]).catch(console.error);
      }

      setUploadProgress(40);

      // Upload new file using ArrayBuffer (faster)
      const arrayBuffer = await blob.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, arrayBuffer, { 
          contentType: isVideo ? 'video/mp4' : 'image/jpeg',
          upsert: true 
        });

      if (uploadError) throw uploadError;

      setUploadProgress(80);

      // Get the public URL
      const { data } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      if (type === 'avatar') {
        setAvatarUrl(publicUrl);
      } else {
        setCoverUrl(publicUrl);
        setTempCoverUrl(null); // Clear temp preview
        
        // Update cover_is_video flag in background
        if (isVideo) {
          supabase
            .from('profiles')
            .update({ cover_is_video: isVideo })
            .eq('id', user.id)
            .then(() => console.log('✅ Cover video flag updated'))
            .catch(console.error);
        }
      }

      setUploadProgress(100);
      console.log(`✅ ${type} uploaded successfully:`, publicUrl);
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', error.message || 'Failed to upload');
      setTempCoverUrl(null);
    } finally {
      setLoading(false);
      setTimeout(() => setUploadProgress(0), 500);
    }
  };

  const handleSave = async () => {
    if (!name || !username) {
      Alert.alert('Error', 'Name and username are required');
      return;
    }

    // Add username format validation
    if (username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters long');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      Alert.alert('Error', 'Username can only contain letters, numbers, and underscores');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Check if username is already taken by another user
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase()) // Convert to lowercase for consistency
        .neq('id', user.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking username:', checkError);
        Alert.alert('Error', 'Failed to check username availability');
        return;
      }

      if (existingUser) {
        Alert.alert('Error', 'Username is already taken');
        setLoading(false);
        return;
      }

      // Get the current profile to check if cover is video
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('cover_is_video')
        .eq('id', user.id)
        .single();

      // Update profile with lowercase username
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: name,
          username: username.toLowerCase(), // Store username in lowercase
          bio,
          avatar_url: avatarUrl,
          cover_url: coverUrl,
          gender,
          // Preserve the cover_is_video field if it exists
          cover_is_video: currentProfile?.cover_is_video || false,
        }, { onConflict: 'id' });

      if (updateError) {
        console.error('Error updating profile:', updateError);
        Alert.alert('Error', updateError.message || 'Failed to update profile');
        return;
      }
      
      Alert.alert('Success', 'Profile updated successfully');
      navigation.goBack();
    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.backgroundSolid }]}>
      {/* Cover Photo */}
      <TouchableOpacity onPress={() => pickImage('cover')} style={[styles.coverContainer, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderBottomWidth: 1 }]}>
        {(tempCoverUrl || coverUrl) ? (
          <View style={styles.coverPhotoContainer}>
            {/* Show temp preview immediately, then replace with uploaded URL */}
            {(tempCoverUrl || coverUrl).endsWith('.mp4') ? (
              <Video
                source={{ uri: tempCoverUrl || coverUrl }}
                style={styles.coverPhoto}
                resizeMode="cover"
                play
                loop
                muted={true}
              />
            ) : (
              <Image source={{ uri: tempCoverUrl || coverUrl }} style={styles.coverPhoto} />
            )}
            
            {/* Upload progress indicator */}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <View style={styles.uploadProgressContainer}>
                <View style={styles.uploadProgressBar}>
                  <View style={[styles.uploadProgressFill, { width: `${uploadProgress}%` }]} />
                </View>
                <Text style={styles.uploadProgressText}>Uploading... {uploadProgress}%</Text>
              </View>
            )}
            
            <View style={styles.coverTypeIndicator}>
              <Ionicons name={(tempCoverUrl || coverUrl).endsWith('.mp4') ? "videocam" : "image"} size={20} color="#fff" />
              <Text style={styles.coverTypeText}>{(tempCoverUrl || coverUrl).endsWith('.mp4') ? "Video" : "Photo"}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="image-outline" size={40} color={theme.textSecondary} />
            <Ionicons name="videocam-outline" size={40} color={theme.textSecondary} style={{ marginLeft: 10 }} />
            <Text style={[styles.placeholderText, { color: theme.textSecondary }]}>Add Cover Photo or Video</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Profile Photo */}
      <TouchableOpacity onPress={() => pickImage('avatar')} style={styles.avatarContainer}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={[styles.avatar, { borderColor: theme.backgroundSolid }]} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: theme.surfaceElevated, borderColor: theme.backgroundSolid }]}>
            <Ionicons name="person-outline" size={40} color={theme.textSecondary} />
          </View>
        )}
        <View style={[styles.editIconContainer, { backgroundColor: theme.primaryAccent, borderColor: theme.backgroundSolid }]}>
          <Ionicons name="camera" size={20} color="#fff" />
        </View>
      </TouchableOpacity>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.primaryAccent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          <Text style={[styles.saveButton, { color: theme.primaryAccent }, loading && styles.saveButtonDisabled]}>
            {loading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.primaryAccent }]}>Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderWidth: 1, color: theme.textPrimary }]}
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.primaryAccent }]}>Username</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderWidth: 1, color: theme.textPrimary }]}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter username"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.primaryAccent }]}>Gender (Optional)</Text>
          <TouchableOpacity
            style={[styles.input, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderWidth: 1 }]}
            onPress={() => setShowGenderModal(true)}
          >
            <Text style={[styles.genderText, { color: gender ? theme.textPrimary : theme.textSecondary }]}>
              {gender ? (
                gender === 'male' ? 'Male' :
                gender === 'female' ? 'Female' :
                gender === 'third' ? 'Third gender{LGBTQ+}' : ''
              ) : 'Select your gender'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.primaryAccent }]}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderWidth: 1, color: theme.textPrimary }]}
            value={bio}
            onChangeText={setBio}
            placeholder="Write something about yourself"
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Gender Selection Modal */}
        <Modal
          visible={showGenderModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowGenderModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
              <Text style={[styles.modalTitle, { color: theme.primaryAccent }]}>Select Gender</Text>
              
              <TouchableOpacity 
                style={[styles.genderOption, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderWidth: 1 }]}
                onPress={() => {
                  setGender('male');
                  setShowGenderModal(false);
                }}
              >
                <Text style={[styles.genderOptionText, { color: theme.textPrimary }]}>Male</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.genderOption, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderWidth: 1 }]}
                onPress={() => {
                  setGender('female');
                  setShowGenderModal(false);
                }}
              >
                <Text style={[styles.genderOptionText, { color: theme.textPrimary }]}>Female</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.genderOption, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderWidth: 1 }]}
                onPress={() => {
                  setGender('third');
                  setShowGenderModal(false);
                }}
              >
                <Text style={[styles.genderOptionText, { color: theme.textPrimary }]}>Third gender</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.genderOption, styles.clearOption, { borderColor: theme.primaryAccent }]}
                onPress={() => {
                  setGender('');
                  setShowGenderModal(false);
                }}
              >
                <Text style={[styles.genderOptionText, styles.clearOptionText, { color: theme.primaryAccent }]}>Clear Selection</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowGenderModal(false)}
              >
                <Text style={[styles.closeButtonText, { color: theme.primaryAccent }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  coverPhotoContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  coverTypeIndicator: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 15,
    padding: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  coverTypeText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#ff00ff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  genderOption: {
    width: '100%',
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#001453',
    marginBottom: 10,
  },
  genderOptionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
  clearOption: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ff00ff',
  },
  clearOptionText: {
    color: '#ff00ff',
  },
  closeButton: {
    marginTop: 10,
    padding: 15,
    width: '100%',
  },
  closeButtonText: {
    color: '#ff00ff',
    textAlign: 'center',
    fontSize: 16,
  },
  genderText: {
    color: 'white',
    fontSize: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
  },
  headerTitle: {
    color: '#ff00ff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveButton: {
    color: '#ff00ff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  form: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: '#ff00ff',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    color: 'white',
    fontSize: 16,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  coverContainer: {
    height: 200,
    width: '100%',
    backgroundColor: '#001453',
    marginBottom: -50,
  },
  coverPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadProgressContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    padding: 10,
  },
  uploadProgressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 5,
  },
  uploadProgressFill: {
    height: '100%',
    backgroundColor: '#00ff88',
    borderRadius: 3,
  },
  uploadProgressText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginLeft: 20,
    elevation: 4,
    position: 'relative',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#000B2E',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    backgroundColor: '#001453',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000B2E',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0066FF',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000B2E',
  },
  placeholderText: {
    color: '#666',
    marginTop: 8,
  },
});

export default EditProfileScreen;