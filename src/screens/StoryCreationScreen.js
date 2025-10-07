import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
  PanResponder,
  Animated,
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { StoriesService } from '../services/StoriesService';

const { width, height } = Dimensions.get('window');

const StoryCreationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { sharePayload } = route.params || {};

  const [uploading, setUploading] = useState(false);
  const [scale, setScale] = useState(0.6); // Initial scale
  const [position, setPosition] = useState({ x: width / 2 - 100, y: height / 2 - 150 });

  // Animation values
  const pan = useRef(new Animated.ValueXY(position)).current;
  const scaleAnim = useRef(new Animated.Value(scale)).current;

  // Pan responder for dragging
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value,
        });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        setPosition({
          x: pan.x._value,
          y: pan.y._value,
        });
      },
    })
  ).current;

  // Pinch to zoom handlers
  const handleScaleIncrease = () => {
    const newScale = Math.min(scale + 0.1, 1.5);
    setScale(newScale);
    Animated.spring(scaleAnim, {
      toValue: newScale,
      useNativeDriver: true,
    }).start();
  };

  const handleScaleDecrease = () => {
    const newScale = Math.max(scale - 0.1, 0.3);
    setScale(newScale);
    Animated.spring(scaleAnim, {
      toValue: newScale,
      useNativeDriver: true,
    }).start();
  };

  const handlePublishStory = async () => {
    if (!sharePayload) {
      Alert.alert('Error', 'No content to share');
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to post a story');
        setUploading(false);
        return;
      }

      // Create story with shared content
      const storyData = {
        user_id: user.id,
        media_url: sharePayload.media_url,
        media_type: sharePayload.media_type || 'image',
        caption: sharePayload.caption || '',
        shared_from_user_id: sharePayload.author?.id || null,
        shared_from_username: sharePayload.author?.username || null,
        position_x: position.x,
        position_y: position.y,
        scale: scale,
      };

      const result = await StoriesService.createStory(storyData);

      if (result.success) {
        Alert.alert(
          'Success!',
          'Your story has been published',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Home'),
            },
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to publish story');
      }
    } catch (error) {
      console.error('Error publishing story:', error);
      Alert.alert('Error', 'Failed to publish story. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const renderSharedContent = () => {
    if (!sharePayload) return null;

    const animatedStyle = {
      transform: [
        { translateX: pan.x },
        { translateY: pan.y },
        { scale: scaleAnim },
      ],
    };

    return (
      <Animated.View
        style={[styles.sharedContentContainer, animatedStyle]}
        {...panResponder.panHandlers}
      >
        {sharePayload.media_type === 'video' ? (
          <Video
            source={{ uri: sharePayload.media_url }}
            style={styles.sharedMedia}
            resizeMode="cover"
            shouldPlay={false}
            isLooping
            isMuted
          />
        ) : (
          <Image
            source={{ uri: sharePayload.media_url }}
            style={styles.sharedMedia}
            resizeMode="cover"
          />
        )}
        
        {/* Username overlay */}
        {sharePayload.author?.username && (
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.usernameOverlay}
          >
            <Text style={styles.usernameText}>
              @{sharePayload.author.username}
            </Text>
          </LinearGradient>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#1a0f2e', '#2a1f3e', '#1a0f2e']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share to Your Story</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Story Preview */}
        <View style={styles.previewContainer}>
          {renderSharedContent()}
        </View>

        {/* Controls */}
        <View style={styles.controlsContainer}>
          <View style={styles.scaleControls}>
            <TouchableOpacity
              style={styles.scaleButton}
              onPress={handleScaleDecrease}
            >
              <Ionicons name="remove-circle" size={40} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.scaleText}>{Math.round(scale * 100)}%</Text>
            <TouchableOpacity
              style={styles.scaleButton}
              onPress={handleScaleIncrease}
            >
              <Ionicons name="add-circle" size={40} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.instructionText}>
            Drag to reposition • Tap +/- to resize
          </Text>

          {/* Publish Button */}
          <TouchableOpacity
            style={[styles.publishButton, uploading && styles.publishButtonDisabled]}
            onPress={handlePublishStory}
            disabled={uploading}
          >
            <LinearGradient
              colors={['#6c3fd8', '#8b5cf6']}
              style={styles.publishGradient}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.publishButtonText}>Share to Story</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a0f2e',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  sharedContentContainer: {
    width: 200,
    height: 300,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  sharedMedia: {
    width: '100%',
    height: '100%',
  },
  usernameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  usernameText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  controlsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    alignItems: 'center',
  },
  scaleControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    gap: 20,
  },
  scaleButton: {
    padding: 10,
  },
  scaleText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    minWidth: 60,
    textAlign: 'center',
  },
  instructionText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  publishButton: {
    width: '100%',
    borderRadius: 25,
    overflow: 'hidden',
    marginTop: 10,
  },
  publishButtonDisabled: {
    opacity: 0.6,
  },
  publishGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default StoryCreationScreen;
