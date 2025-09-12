import React, { useRef, useEffect, useCallback, useState } from 'react';
import { View, FlatList, Dimensions, StyleSheet, Platform, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import PostItem from '../components/PostItem';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

const viewabilityConfig = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 300,
};

const PhotoTextViewerScreen = ({ route }) => {
  const { posts, initialIndex } = route.params;
  const navigation = useNavigation();
  const flatListRef = useRef(null);
  const hasScrolledToIndex = useRef(false);
  const [viewableItems, setViewableItems] = useState([]);
  const insets = useSafeAreaInsets();

  // Animation refs for ultra-premium effects
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const buttonPulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  // Initialize animations
  useEffect(() => {
    initializeAnimations();
  }, []);

  const initializeAnimations = () => {
    // Main entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Continuous glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Continuous shimmer animation
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: true,
      })
    ).start();

    // Button pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(buttonPulseAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(buttonPulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Floating animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -3,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 3,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // Scroll to the initial index when the screen loads
  useEffect(() => {
    if (flatListRef.current && initialIndex >= 0 && !hasScrolledToIndex.current) {
      hasScrolledToIndex.current = true;
      const timer = setTimeout(() => {
        flatListRef.current.scrollToIndex({
          index: initialIndex,
          animated: false,
          viewPosition: 0, // Ensure the post is at the top of the screen
        });
      }, 1000); // Increased delay to ensure rendering

      return () => clearTimeout(timer);
    }
  }, [initialIndex]);

  const renderItem = useCallback(({ item, index }) => {
    return (
      <Animated.View 
        style={[
          styles.postContainer,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: slideAnim }
            ]
          }
        ]}
      >
        <View style={styles.postWrapper}>
          {/* Post glow effect */}
          <Animated.View
            style={[
              styles.postGlow,
              {
                opacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.1, 0.3]
                })
              }
            ]}
          />
          
          <PostItem post={item} />
          
          {/* Post shimmer effect */}
          <Animated.View
            style={[
              styles.postShimmer,
              {
                opacity: shimmerAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0.2, 0]
                }),
                transform: [{
                  translateX: shimmerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-windowWidth, windowWidth]
                  })
                }]
              }
            ]}
          >
            <LinearGradient
              colors={['transparent', 'rgba(255, 0, 255, 0.3)', 'rgba(0, 255, 255, 0.3)', 'transparent']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={styles.shimmerGradient}
            />
          </Animated.View>
        </View>
      </Animated.View>
    );
  }, [fadeAnim, scaleAnim, slideAnim, glowAnim, shimmerAnim]);
  
  // Handle viewable items changed
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    setViewableItems(viewableItems);
  }, []);
  
  const onScrollToIndexFailed = (info) => {
    console.log('Scroll to index failed:', info);
    const wait = new Promise(resolve => setTimeout(resolve, 1000));
    wait.then(() => {
      flatListRef.current?.scrollToIndex({
        index: info.index,
        animated: false,
        viewPosition: 0,
      });
    });
  };

  return (
    <LinearGradient
      colors={['#000', '#1a1a2e', '#000']}
      style={styles.container}
    >
      {/* Enhanced Back Button */}
      <Animated.View
        style={[
          styles.backButtonContainer,
          {
            top: insets.top > 0 ? insets.top + 10 : Platform.OS === 'ios' ? 40 : 20,
            opacity: fadeAnim,
            transform: [
              { scale: buttonPulseAnim },
              { translateX: slideAnim },
              { translateY: floatAnim }
            ]
          }
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#ff00ff', '#ff6b9d', '#00ffff']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.backButtonGradient}
          >
            {/* Button glow effect */}
            <Animated.View
              style={[
                styles.buttonGlow,
                {
                  opacity: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 0.8]
                  })
                }
              ]}
            />
            
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Ionicons
                name="arrow-back"
                size={24}
                color="#fff"
              />
            </Animated.View>
            
            {/* Button shimmer effect */}
            <Animated.View
              style={[
                styles.buttonShimmer,
                {
                  opacity: shimmerAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 0.4, 0]
                  }),
                  transform: [{
                    translateX: shimmerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-60, 60]
                    })
                  }]
                }
              ]}
            >
              <LinearGradient
                colors={['transparent', 'rgba(255, 255, 255, 0.6)', 'transparent']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={styles.shimmerGradient}
              />
            </Animated.View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
      
      {/* Enhanced FlatList for Posts */}
      <Animated.View 
        style={[
          styles.listContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <FlatList
          ref={flatListRef}
          data={posts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          windowSize={5}
          maxToRenderPerBatch={3}
          initialNumToRender={Math.max(initialIndex + 1, 3)} // Ensure enough items are rendered to reach initialIndex
          onScrollToIndexFailed={onScrollToIndexFailed}
          contentContainerStyle={[styles.listContent, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      </Animated.View>
    </LinearGradient>
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
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  backButtonGradient: {
    padding: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  buttonGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  buttonShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 30,
  },
  listContainer: {
    flex: 1,
  },
  postContainer: {
    width: windowWidth,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  postWrapper: {
    position: 'relative',
    overflow: 'hidden',
  },
  postGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 0, 255, 0.05)',
    zIndex: 1,
  },
  postShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 200,
    zIndex: 2,
  },
  shimmerGradient: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
});

export default PhotoTextViewerScreen;