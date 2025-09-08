import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import { PostsService } from '../services/PostsService';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const CreatePostScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [postText, setPostText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleMediaPicker = async () => {
    try {
      // Reset any previous error messages
      setErrorMessage('');
      
      // Check user authentication first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please login to create a post');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false, // Allow selecting whole photo
        quality: 0.8, // Slightly reduced quality for better upload performance
        presentationStyle: 'pageSheet',
        exif: false // Don't need EXIF data, reduces file size
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const uri = result.assets[0].uri;
        if (!uri) {
          Alert.alert('Error', 'Failed to get image/video');
          return;
        }
        const type = uri.endsWith('.mp4') ? 'video' : 'image';
        setSelectedMedia({ uri, type });
        console.log(`Selected ${type} with URI: ${uri}`);
      }
    } catch (error) {
      console.error('Error selecting media:', error);
      setErrorMessage('Failed to select media: ' + (error.message || 'Unknown error'));
      Alert.alert('Error', error.message || 'Failed to select media');
    }
  };

  const handleCreatePost = async () => {
    if (!selectedMedia && !postText.trim()) {
      Alert.alert('Error', 'Please add some text or media to your post');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setErrorMessage('');
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + (Math.random() * 0.1);
          return newProgress > 0.9 ? 0.9 : newProgress; // Cap at 90% until complete
        });
      }, 500);
      
      let updatedPosts;
      if (selectedMedia) {
        console.log(`Starting upload of ${selectedMedia.type}...`);
        await PostsService.createPost(selectedMedia.uri, postText.trim(), selectedMedia.type);
      } else {
        console.log('Creating text-only post...');
        await PostsService.createPost('', postText.trim(), 'text');
      }
      
      clearInterval(progressInterval);
      setUploadProgress(1); // Complete the progress
      
      // Refresh posts in HomeScreen
      console.log('Post created, refreshing feed...');
      updatedPosts = await PostsService.getAllPosts();
      
      navigation.navigate('MainApp', {
        screen: 'Home',
        params: { refresh: true, updatedPosts: updatedPosts }
      });
      
      Alert.alert('Success', 'Post created successfully');
    } catch (error) {
      console.error('Error creating post:', error);
      setErrorMessage(error.message || 'Failed to create post');
      
      // Show a more detailed error message with retry option
      Alert.alert(
        'Upload Failed', 
        `${error.message || 'Failed to create post'}\n\nWould you like to try again?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Retry', 
            onPress: () => {
              // Small delay before retrying
              setTimeout(() => handleCreatePost(), 500);
            }
          }
        ]
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const renderUploadProgress = () => {
    if (!uploading) return null;
    
    return (
      <LinearGradient
        colors={['rgba(102, 126, 234, 0.2)', 'rgba(156, 136, 255, 0.1)']}
        style={styles.progressContainer}
      >
        <View style={styles.progressBarContainer}>
          <LinearGradient
            colors={['#667eea', '#9c88ff']}
            style={[styles.progressBar, { width: `${uploadProgress * 100}%` }]}
          />
        </View>
        <Text style={styles.progressText}>
          ⏳ {uploadProgress < 1 ? 'Uploading...' : 'Processing...'}
        </Text>
      </LinearGradient>
    );
  };

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <LinearGradient
          colors={['rgba(102, 126, 234, 0.15)', 'rgba(156, 136, 255, 0.1)']}
          style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 15 }]}
        >
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <LinearGradient
              colors={['rgba(255, 107, 107, 0.8)', 'rgba(255, 82, 82, 0.6)']}
              style={styles.closeButtonGradient}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>✨ Create Post</Text>
          
          <TouchableOpacity 
            onPress={handleCreatePost}
            disabled={!selectedMedia && !postText.trim() || uploading}
          >
            <LinearGradient
              colors={(!selectedMedia && !postText.trim()) || uploading ? 
                ['rgba(102, 102, 102, 0.6)', 'rgba(85, 85, 85, 0.4)'] :
                ['rgba(102, 126, 234, 0.9)', 'rgba(156, 136, 255, 0.8)']}
              style={styles.postButton}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.postButtonText}>📤 Post</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>

      {renderUploadProgress()}
      
        {errorMessage ? (
          <LinearGradient
            colors={['rgba(255, 107, 107, 0.2)', 'rgba(255, 82, 82, 0.1)']}
            style={styles.errorContainer}
          >
            <Ionicons name="warning" size={16} color="#ff6b6b" style={styles.errorIcon} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </LinearGradient>
        ) : null}

        <ScrollView style={styles.content}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.04)']}
            style={styles.inputContainer}
          >
            <TextInput
              style={styles.input}
              placeholder="💭 What's on your mind?"
              placeholderTextColor="rgba(255,255,255,0.4)"
              multiline
              value={postText}
              onChangeText={setPostText}
              color="#ffffff"
              editable={!uploading}
            />
          </LinearGradient>

          {selectedMedia && (
            <LinearGradient
              colors={['rgba(102, 126, 234, 0.1)', 'rgba(156, 136, 255, 0.05)']}
              style={styles.mediaPreview}
            >
              {selectedMedia.type === 'video' ? (
                <Video
                  source={{ uri: selectedMedia.uri }}
                  style={styles.previewMedia}
                  resizeMode="contain"
                  play={false}
                  controls
                />
              ) : (
                <Image
                  source={{ uri: selectedMedia.uri }}
                  style={styles.previewMedia}
                  resizeMode="contain"
                />
              )}
              <TouchableOpacity 
                onPress={() => setSelectedMedia(null)}
                disabled={uploading}
              >
                <LinearGradient
                  colors={['rgba(255, 107, 107, 0.9)', 'rgba(255, 82, 82, 0.7)']}
                  style={styles.removeMediaButton}
                >
                  <Ionicons name="close-circle" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          )}
        </ScrollView>

        <LinearGradient
          colors={['rgba(102, 126, 234, 0.15)', 'rgba(156, 136, 255, 0.1)']}
          style={[styles.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 15 }]}
        >
          <TouchableOpacity 
            onPress={handleMediaPicker}
            disabled={uploading}
          >
            <LinearGradient
              colors={uploading ? 
                ['rgba(102, 102, 102, 0.4)', 'rgba(85, 85, 85, 0.2)'] :
                ['rgba(255, 107, 107, 0.8)', 'rgba(255, 82, 82, 0.6)']}
              style={styles.mediaButton}
            >
              <Ionicons name="images" size={20} color="#fff" />
              <Text style={styles.mediaButtonText}>🖼️ Gallery</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(102, 126, 234, 0.3)',
  },
  closeButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff6b6b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    flex: 1,
    textShadowColor: 'rgba(102, 126, 234, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#666',
  },
  postButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  content: {
    flex: 1,
  },
  inputContainer: {
    margin: 15,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  input: {
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    color: '#fff',
    padding: 15,
    lineHeight: 22,
  },
  mediaPreview: {
    margin: 15,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a3a',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.3)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    minHeight: 200,
    maxHeight: 400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewMedia: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  removeMediaButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 15,
    padding: 5,
    shadowColor: '#ff6b6b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(102, 126, 234, 0.3)',
    padding: 15,
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#ff6b6b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  mediaButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  disabledText: {
    color: '#666',
  },
  progressContainer: {
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  errorContainer: {
    margin: 10,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#ff6b6b',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#ff6b6b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    flex: 1,
    marginLeft: 8,
    fontWeight: '500',
  },
  errorIcon: {
    marginRight: 4,
  },
});

export default CreatePostScreen;