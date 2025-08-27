import { supabase } from '../lib/supabase';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const StoriesService = {
  // Fetch stories for a specific user
  getUserStories: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select(`
          id,
          user_id,
          media_url,
          created_at,
          type,
          followers_only,
          is_first_story,
          user:profiles (
            id,
            username,
            avatar_url,
            rank
          )
        `)
        .eq('user_id', userId)
        .not('user_id', 'in', `(SELECT blocked_id FROM blocked_users WHERE blocker_id = (await supabase.auth.getUser()).data.user.id)`)
        .gte('expires_at', new Date().toISOString()) // Only fetch non-expired stories
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching stories:', error);
      throw error;
    }
  },

  // Mark a story as viewed
  markStoryAsViewed: async (storyId) => {
    try {
      const { error } = await supabase
        .from('story_views')
        .insert({
          story_id: storyId,
          user_id: (await supabase.auth.getUser()).data.user.id, // Assuming auth.uid() is available for the current user
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error marking story as viewed:', error);
      throw error;
    }
  },

  // Delete a story
  deleteStory: async (storyId) => {
    try {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error deleting story:', error);
      throw error;
    }
  },
};

const StoriesScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Stories Screen</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  text: {
    color: '#fff',
    fontSize: 24,
  },
});

export default StoriesScreen;