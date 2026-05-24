import React, { useRef, useEffect, useCallback, useState } from 'react';
import { View, FlatList, Dimensions, StyleSheet, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import PostItem from '../components/PostItem';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideo } from '../context/VideoContext';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

const viewabilityConfig = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 100,
};

const PostViewerScreen = ({ route }) => {
  const { posts, initialIndex } = route.params;
  const navigation = useNavigation();
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
  const insets = useSafeAreaInsets();
  const { setActiveVideo, clearActiveVideo } = useVideo();

  // Hide status bar for fullscreen experience
  useEffect(() => {
    StatusBar.setHidden(true);
    return () => StatusBar.setHidden(false);
  }, []);

  // Scroll to initial index immediately
  useEffect(() => {
    if (flatListRef.current && initialIndex >= 0) {
      // Use a small delay to ensure FlatList is ready
      setTimeout(() => {
        flatListRef.current.scrollToIndex({
          index: initialIndex,
          animated: false,
        });
      }, 100);
    }
  }, [initialIndex]);

  const renderItem = useCallback(({ item, index }) => {
    return (
      <View style={styles.postContainer}>
        <PostItem post={item} />
      </View>
    );
  }, []);
  
  // Handle viewable items changed for video management
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const viewablePost = viewableItems[0];
      setCurrentIndex(viewablePost.index);
      
      // Clear previous videos
      clearActiveVideo();
      
      // Set active video if current post is a video
      if (viewablePost.item && (viewablePost.item.type === 'video' || viewablePost.item.mediaType === 'video')) {
        setTimeout(() => {
          setActiveVideo(viewablePost.item.id);
        }, 200);
      }
    }
  }, [setActiveVideo, clearActiveVideo]);
  
  // Clean up videos when leaving screen
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        clearActiveVideo();
      };
    }, [clearActiveVideo])
  );

  const onScrollToIndexFailed = (info) => {
    console.log('Scroll to index failed:', info);
    // Wait for layout and try again
    setTimeout(() => {
      if (flatListRef.current && info.index < posts.length) {
        flatListRef.current.scrollToIndex({
          index: info.index,
          animated: false,
        });
      }
    }, 500);
  };

  const getItemLayout = (data, index) => ({
    length: windowHeight,
    offset: windowHeight * index,
    index,
  });

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <View style={[styles.backButtonContainer, { top: insets.top + 10 }]}>
        <Ionicons
          name="arrow-back"
          size={28}
          color="#fff"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        />
      </View>

      {/* Post indicator */}
      <View style={[styles.indicatorContainer, { top: insets.top + 10 }]}>
        <View style={styles.indicator}>
          <Ionicons name="grid-outline" size={16} color="#fff" />
          <View style={styles.indicatorText}>
            <Ionicons name="ellipse" size={4} color="#fff" style={{ marginHorizontal: 2 }} />
            <Ionicons name="ellipse" size={4} color="#fff" style={{ marginHorizontal: 2 }} />
            <Ionicons name="ellipse" size={4} color="#fff" style={{ marginHorizontal: 2 }} />
          </View>
        </View>
      </View>

      {/* FlatList for Posts */}
      <FlatList
        ref={flatListRef}
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        pagingEnabled={true}
        showsVerticalScrollIndicator={false}
        snapToInterval={windowHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        onScrollToIndexFailed={onScrollToIndexFailed}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={getItemLayout}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backButtonContainer: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
  },
  backButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  indicatorContainer: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  indicatorText: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  postContainer: {
    width: windowWidth,
    height: windowHeight,
    backgroundColor: '#000',
  },
});

export default PostViewerScreen;