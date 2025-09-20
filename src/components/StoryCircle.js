import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';

const StoryCircle = ({ user, onAddStory }) => {
  const [hasStory, setHasStory] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const navigation = useNavigation();

  useEffect(() => {
    getCurrentUser();
    checkUserStories();
  }, [user]);

  const getCurrentUser = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setCurrentUserId(currentUser?.id);
  };

  const checkUserStories = async () => {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select('id')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .limit(1);

      if (error) throw error;
      setHasStory(data && data.length > 0);
    } catch (error) {
      console.error('Error checking user stories:', error);
      setHasStory(false);
    }
  };

  const handlePress = () => {
    const isCurrentUser = user.id === currentUserId;
    
    if (isCurrentUser) {
      // Current user's story circle
      if (hasStory) {
        // Show options: View Story or Add Story
        Alert.alert(
          'Your Story',
          'What would you like to do?',
          [
            { text: 'View Story', onPress: () => viewStory() },
            { text: 'Add Story', onPress: () => addStory() },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      } else {
        // No story, directly add
        addStory();
      }
    } else {
      // Other user's story
      if (hasStory) {
        viewStory();
      }
    }
  };

  const viewStory = () => {
    navigation.navigate('StoriesScreen', {
      userId: user.id,
      initialStoryIndex: 0
    });
  };

  const addStory = () => {
    if (onAddStory) {
      onAddStory();
    } else {
      // Navigate to story creation screen
      navigation.navigate('CreateStory');
    }
  };

  const isCurrentUser = user.id === currentUserId;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handlePress} style={styles.storyCircle}>
        {hasStory ? (
          // Story exists - show gradient border
          <LinearGradient
            colors={['#ff00ff', '#00ffff', '#ff00ff']}
            style={styles.gradientBorder}
          >
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: user.avatar_url || 'https://via.placeholder.com/60' }}
                style={styles.avatar}
              />
            </View>
          </LinearGradient>
        ) : (
          // No story - show regular avatar
          <View style={styles.regularBorder}>
            <Image
              source={{ uri: user.avatar_url || 'https://via.placeholder.com/60' }}
              style={styles.avatar}
            />
          </View>
        )}
        
        {/* Plus icon for current user */}
        {isCurrentUser && (
          <View style={styles.plusContainer}>
            <LinearGradient
              colors={['#ff00ff', '#00ffff']}
              style={styles.plusGradient}
            >
              <Ionicons name="add" size={16} color="#fff" />
            </LinearGradient>
          </View>
        )}
      </TouchableOpacity>
      
      <Text style={styles.username} numberOfLines={1}>
        {isCurrentUser ? 'Your Story' : user.username || 'User'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginRight: 15,
    width: 70,
  },
  storyCircle: {
    position: 'relative',
  },
  gradientBorder: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regularBorder: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#000',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  plusContainer: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
  },
  plusGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  username: {
    color: '#fff',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default StoryCircle;
