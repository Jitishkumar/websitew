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
import * as FileSystem from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';
import { PostsService } from '../services/PostsService';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const CreatePostScreen = () => {
  const { isDarkMode, theme } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [postText, setPostText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Helper function to get file size
  const getFileSize = async (uri) => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      return fileInfo.size || 0;
    } catch (error) {
      console.error('Error getting file size:', error);
      return 0;
    }
  };

  // Helper function to format file size for display
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

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
        mediaTypes: 'All',
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
        
        // Determine file type
        const type = uri.endsWith('.mp4') || uri.endsWith('.mov') || uri.endsWith('.avi') ? 'video' : 'image';
        
        // Check file size
        const fileSize = await getFileSize(uri);
        const fileSizeMB = fileSize / (1024 * 1024); // Convert to MB
        
        // File size limits
        const MAX_IMAGE_SIZE_MB = 10;
        const MAX_VIDEO_SIZE_MB = 100;
        
        if (type === 'image' && fileSizeMB > MAX_IMAGE_SIZE_MB) {
          Alert.alert(
            'File Too Large', 
            `Image size is ${formatFileSize(fileSize)}. Maximum allowed size for images is ${MAX_IMAGE_SIZE_MB}MB. Please choose a smaller image or compress it.`,
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
        
        if (type === 'video' && fileSizeMB > MAX_VIDEO_SIZE_MB) {
          Alert.alert(
            'File Too Large', 
            `Video size is ${formatFileSize(fileSize)}. Maximum allowed size for videos is ${MAX_VIDEO_SIZE_MB}MB. Please choose a smaller video or compress it.`,
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
        
        setSelectedMedia({ uri, type, size: fileSize });
        console.log(`Selected ${type} with URI: ${uri}, Size: ${formatFileSize(fileSize)}`);
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
        colors={isDarkMode ? ['rgba(95, 115, 242, 0.2)', 'rgba(56, 189, 248, 0.1)'] : ['rgba(79, 70, 229, 0.15)', 'rgba(2, 132, 199, 0.08)']}
        style={styles.progressContainer}
      >
        <View style={[styles.progressBarContainer, { backgroundColor: theme.border }]} >
          <LinearGradient
            colors={[theme.primaryAccent, theme.secondaryAccent]}
            style={[styles.progressBar, { width: `${uploadProgress * 100}%` }]}
          />
        </View>
        <Text style={[styles.progressText, { color: theme.textSecondary }]} >
          ⏳ {uploadProgress < 1 ? 'Uploading...' : 'Processing...'}
        </Text>
      </LinearGradient>
    );
  };

  return (
    <LinearGradient
      colors={theme.backgrounds}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <LinearGradient
          colors={isDarkMode ? ['rgba(95, 115, 242, 0.15)', 'rgba(95, 115, 242, 0.05)'] : ['rgba(79, 70, 229, 0.08)', 'rgba(79, 70, 229, 0.03)']}
          style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 15, borderBottomColor: theme.border }]}
        >
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              style={styles.closeButtonGradient}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: theme.textPrimary, textShadowColor: theme.border }]}>✨ Create Post</Text>
          
          <TouchableOpacity 
            onPress={handleCreatePost}
            disabled={!selectedMedia && !postText.trim() || uploading}
          >
            <LinearGradient
              colors={(!selectedMedia && !postText.trim()) || uploading ? 
                (isDarkMode ? ['rgba(102, 102, 102, 0.4)', 'rgba(85, 85, 85, 0.2)'] : ['rgba(200, 200, 200, 0.5)', 'rgba(180, 180, 180, 0.3)']) :
                [theme.primaryAccent, theme.secondaryAccent]}
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
            colors={isDarkMode ? ['rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0.1)'] : ['rgba(220, 38, 38, 0.15)', 'rgba(220, 38, 38, 0.05)']}
            style={[styles.errorContainer, { borderLeftColor: theme.error }]}
          >
            <Ionicons name="warning" size={16} color={theme.error} style={styles.errorIcon} />
            <Text style={[styles.errorText, { color: theme.error }]}>{errorMessage}</Text>
          </LinearGradient>
        ) : null}

        <ScrollView style={styles.content}>
          <View
            style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
          >
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="💭 What's on your mind?"
              placeholderTextColor={theme.textSecondary + '80'}
              multiline
              value={postText}
              onChangeText={setPostText}
              color={theme.textPrimary}
              editable={!uploading}
            />
          </View>

          {selectedMedia && (
            <LinearGradient
              colors={isDarkMode ? ['rgba(95, 115, 242, 0.1)', 'rgba(56, 189, 248, 0.05)'] : ['rgba(79, 70, 229, 0.05)', 'rgba(2, 132, 199, 0.02)']}
              style={[styles.mediaPreview, { borderColor: theme.border, backgroundColor: theme.surface }]}
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
              
              {/* File size indicator */}
              <View style={styles.fileSizeIndicator}>
                <Text style={styles.fileSizeText}>
                  {selectedMedia.size ? formatFileSize(selectedMedia.size) : 'Unknown size'}
                </Text>
              </View>
              
              <TouchableOpacity 
                onPress={() => setSelectedMedia(null)}
                disabled={uploading}
              >
                <LinearGradient
                  colors={['#EF4444', '#DC2626']}
                  style={styles.removeMediaButton}
                >
                  <Ionicons name="close-circle" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          )}
        </ScrollView>

        <LinearGradient
          colors={isDarkMode ? ['rgba(95, 115, 242, 0.15)', 'rgba(95, 115, 242, 0.05)'] : ['rgba(79, 70, 229, 0.08)', 'rgba(79, 70, 229, 0.03)']}
          style={[styles.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 15, borderTopColor: theme.border }]}
        >
          <TouchableOpacity 
            onPress={handleMediaPicker}
            disabled={uploading}
          >
            <LinearGradient
              colors={uploading ? 
                (isDarkMode ? ['rgba(102, 102, 102, 0.4)', 'rgba(85, 85, 85, 0.2)'] : ['rgba(200, 200, 200, 0.5)', 'rgba(180, 180, 180, 0.3)']) :
                [theme.primaryAccent, theme.secondaryAccent]}
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
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  input: {
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    padding: 15,
    lineHeight: 22,
  },
  mediaPreview: {
    margin: 15,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
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
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
  },
  footer: {
    borderTopWidth: 1,
    padding: 15,
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
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
  fileSizeIndicator: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fileSizeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default CreatePostScreen;