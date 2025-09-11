import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  FlatList, 
  Image, 
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';

const { width, height } = Dimensions.get('window');

const ConfessionButtonScreen = () => {
  const navigation = useNavigation();
  const [randomConfessions, setRandomConfessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const buttonScaleAnim1 = useRef(new Animated.Value(1)).current;
  const buttonScaleAnim2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchCurrentUser();
    fetchRandomConfessions();
    startAnimations();
    startPulseAnimation();
  }, []);

  const startAnimations = () => {
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
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      })
    ]).start();
  };

  const startPulseAnimation = () => {
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
        })
      ])
    ).start();
  };

  const animateButtonPress = (animRef, callback) => {
    Animated.sequence([
      Animated.timing(animRef, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animRef, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      })
    ]).start(() => callback && callback());
  };

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchRandomConfessions = async () => {
    try {
      setLoading(true);
      
      // Fetch random confessions from both tables
      const { data: placeConfessions, error: placeError } = await supabase
        .from('confessions')
        .select(`
          id,
          user_id,
          creator_id,
          location_name,
          content,
          media,
          is_anonymous,
          likes_count,
          comments_count,
          created_at,
          username,
          confession_likes!left(user_id)
        `)
        .order('created_at', { ascending: false })
        .limit(4);

      if (placeError) throw placeError;

      const { data: personConfessions, error: personError } = await supabase
        .from('person_confessions')
        .select(`
          id,
          user_id,
          creator_id,
          person_id,
          content,
          media,
          is_anonymous,
          likes_count,
          comments_count,
          created_at,
          person:person_id(name),
          creator_profile:creator_id(username, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(4);

      if (personError) throw personError;

      // Combine and shuffle confessions
      const allConfessions = [
        ...(placeConfessions || []).map(conf => ({ ...conf, type: 'place' })),
        ...(personConfessions || []).map(conf => ({ 
          ...conf, 
          type: 'person',
          location_name: `@${conf.person?.name || 'Unknown Person'}`, // Use person.name
          username: conf.creator_profile?.username || 'User', // Use creator_profile.username
          avatar_url: conf.creator_profile?.avatar_url, // Use creator_profile.avatar_url
        }))
      ];

      // Shuffle the combined confessions
      for (let i = allConfessions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allConfessions[i], allConfessions[j]] = [allConfessions[j], allConfessions[i]];
      }

      // Limit to 4 confessions
      setRandomConfessions(allConfessions.slice(0, 4));
    } catch (error) {
      console.error('Error fetching random confessions:', error);
      Alert.alert('Error', 'Failed to load confessions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    return [];
  }

  const onRefresh = () => {
    setRefreshing(true);
    fetchRandomConfessions();
  };

  const handlePersonConfession = () => {
    animateButtonPress(buttonScaleAnim1, () => {
      navigation.navigate('ConfessionPersonScreen');
    });
  };

  const handlePlaceConfession = () => {
    animateButtonPress(buttonScaleAnim2, () => {
      navigation.navigate('ConfessionScreen');
    });
  };

  const handleLike = async (confessionId, confessionType) => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to like a confession');
      return;
    }

    try {
      const tableName = confessionType === 'place' ? 'confession_likes' : 'person_confession_likes';
      const columnName = confessionType === 'place' ? 'confession_id' : 'person_confession_id';

      // Check if already liked
      const { data: existingLike, error: fetchError } = await supabase
        .from(tableName)
        .select('id')
        .eq(columnName, confessionId)
        .eq('user_id', currentUser.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingLike) {
        // Unlike
        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .eq('id', existingLike.id);

        if (deleteError) throw deleteError;

        // Update local state
        setRandomConfessions(prevConfessions => prevConfessions.map(conf => 
          conf.id === confessionId && conf.type === confessionType
            ? { ...conf, is_liked: false, likes_count: (conf.likes_count || 0) - 1 } 
            : conf
        ));
      } else {
        // Like
        const { error: insertError } = await supabase
          .from(tableName)
          .insert([{
            [columnName]: confessionId,
            user_id: currentUser.id,
          }]);

        if (insertError) throw insertError;

        // Update local state
        setRandomConfessions(prevConfessions => prevConfessions.map(conf => 
          conf.id === confessionId && conf.type === confessionType
            ? { ...conf, is_liked: true, likes_count: (conf.likes_count || 0) + 1 } 
            : conf
        ));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like. Please try again.');
    }
  };

  const navigateToConfession = (confession) => {
    if (confession.type === 'place') {
      // Navigate to place confession screen with specific confession
      navigation.navigate('Confession', { selectedConfessionId: confession.id });
    } else {
      // Navigate to person confession screen with specific confession
      navigation.navigate('ConfessionPerson', { selectedConfessionId: confession.id });
    }
  };

  const renderConfessionItem = ({ item }) => {
    const formattedDate = item.created_at 
      ? new Date(item.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })
      : '';

    return (
      <TouchableOpacity 
        style={styles.confessionCard}
        onPress={() => navigateToConfession(item)}
      >
        <View style={styles.confessionHeader}>
          <Image 
            source={{ uri: item.is_anonymous 
              ? 'https://via.placeholder.com/40x40?text=A' 
              : (item.avatar_url || 'https://via.placeholder.com/40x40?text=U') 
            }}
            style={styles.avatar}
          />
          <View style={styles.userInfoContainer}>
            <Text style={styles.username}>
              {item.is_anonymous ? 'Anonymous' : (item.username || 'User')}
            </Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {item.location_name || 'Unknown location'}
            </Text>
          </View>
          <View style={styles.typeAndDateContainer}>
            <View style={[styles.typeBadge, item.type === 'person' ? styles.personBadge : styles.placeBadge]}>
              <Ionicons 
                name={item.type === 'person' ? 'person' : 'business'} 
                size={10} 
                color="#fff" 
              />
              <Text style={styles.typeBadgeText}>
                {item.type === 'person' ? 'Person' : 'Place'}
              </Text>
            </View>
            <Text style={styles.dateText}>{formattedDate}</Text>
          </View>
        </View>
        
        <Text style={styles.confessionContent} numberOfLines={4}>
          {item.content}
        </Text>
        
        {item.media && item.media.length > 0 && (
          <View style={styles.mediaIndicator}>
            <Ionicons name="image" size={12} color="#ff00ff" />
            <Text style={styles.mediaText}>{item.media.length} media</Text>
          </View>
        )}
        
        <View style={styles.actionBar}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={(e) => {
              e.stopPropagation();
              handleLike(item.id, item.type);
            }}
          >
            <Ionicons 
              name={item.is_liked ? 'heart' : 'heart-outline'} 
              size={16} 
              color={item.is_liked ? '#ff00ff' : '#999'} 
            />
            <Text style={[styles.actionText, item.is_liked && styles.likedText]}>
              {item.likes_count || 0}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={16} color="#999" />
            <Text style={styles.actionText}>{item.comments_count || 0}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0a0a2a', '#1a1a4a']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.header}
      >
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#ff00ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post a Confession</Text>
      </LinearGradient>

      <FlatList
        data={randomConfessions}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={renderConfessionItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff00ff" />
        }
        ListHeaderComponent={() => (
          <Animated.View 
            style={[
              styles.buttonContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }, { scale: scaleAnim }]
              }
            ]}
          >
            {/* Premium Action Buttons */}
            <View style={styles.actionButtonsRow}>
              <Animated.View style={[styles.buttonWrapper, { transform: [{ scale: buttonScaleAnim1 }] }]}>
                <TouchableOpacity 
                  style={styles.premiumButton} 
                  onPress={handlePersonConfession}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#FF6B81', '#FF4757', '#C44569']}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 1}}
                    style={styles.gradientButton}
                  >
                    <View style={styles.buttonIconContainer}>
                      <Animated.View style={[styles.iconWrapper, { transform: [{ scale: pulseAnim }] }]}>
                        <MaterialIcons name="person" size={36} color="#fff" />
                      </Animated.View>
                      <View style={styles.sparkleContainer}>
                        <Ionicons name="sparkles" size={16} color="rgba(255,255,255,0.8)" style={styles.sparkle1} />
                        <Ionicons name="sparkles" size={12} color="rgba(255,255,255,0.6)" style={styles.sparkle2} />
                      </View>
                    </View>
                    <Text style={styles.premiumButtonText}>Person</Text>
                    <Text style={styles.buttonSubtext}>Share about someone</Text>
                  </LinearGradient>
                  <View style={styles.buttonGlow} />
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={[styles.buttonWrapper, { transform: [{ scale: buttonScaleAnim2 }] }]}>
                <TouchableOpacity 
                  style={styles.premiumButton} 
                  onPress={handlePlaceConfession}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#4CAF50', '#8BC44A', '#2E7D32']}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 1}}
                    style={styles.gradientButton}
                  >
                    <View style={styles.buttonIconContainer}>
                      <Animated.View style={[styles.iconWrapper, { transform: [{ scale: pulseAnim }] }]}>
                        <MaterialIcons name="business" size={36} color="#fff" />
                      </Animated.View>
                      <View style={styles.sparkleContainer}>
                        <Ionicons name="sparkles" size={16} color="rgba(255,255,255,0.8)" style={styles.sparkle1} />
                        <Ionicons name="sparkles" size={12} color="rgba(255,255,255,0.6)" style={styles.sparkle2} />
                      </View>
                    </View>
                    <Text style={styles.premiumButtonText}>Place</Text>
                    <Text style={styles.buttonSubtext}>Share about a location</Text>
                  </LinearGradient>
                  <View style={styles.buttonGlow} />
                </TouchableOpacity>
              </Animated.View>
            </View>
            
            {/* Enhanced Section Header */}
            <View style={styles.enhancedSectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <LinearGradient
                  colors={['#ff00ff', '#ff6b9d', '#c44569']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={styles.sectionTitleGradient}
                >
                  <MaterialIcons name="trending-up" size={24} color="#fff" />
                  <Text style={styles.enhancedSectionTitle}>Trending Confessions</Text>
                </LinearGradient>
              </View>
              <TouchableOpacity onPress={onRefresh} style={styles.enhancedRefreshButton}>
                <LinearGradient
                  colors={['rgba(255,0,255,0.2)', 'rgba(255,0,255,0.1)']}
                  style={styles.refreshButtonGradient}
                >
                  <Ionicons name="refresh" size={20} color="#ff00ff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={() => (
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ff00ff" />
              <Text style={styles.loadingText}>Loading confessions...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={60} color="#ff00ff" />
              <Text style={styles.emptyText}>No confessions available</Text>
            </View>
          )
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a2a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 15,
    paddingBottom: 15,
    backgroundColor: '#0a0a2a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 0, 255, 0.2)',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 15,
    textShadowColor: 'rgba(255, 0, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  listContainer: {
    paddingBottom: 20,
  },
  buttonContainer: {
    padding: 20,
    gap: 25,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  buttonWrapper: {
    flex: 1,
    position: 'relative',
  },
  premiumButton: {
    height: 140,
    borderRadius: 20,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 15,
    overflow: 'hidden',
    position: 'relative',
  },
  gradientButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    position: 'relative',
  },
  buttonIconContainer: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 25,
    padding: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  sparkleContainer: {
    position: 'absolute',
    top: -5,
    right: -5,
  },
  sparkle1: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  sparkle2: {
    position: 'absolute',
    top: 8,
    right: 12,
  },
  premiumButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 6,
    marginBottom: 4,
  },
  buttonSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
  enhancedSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 15,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitleGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  enhancedSectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  enhancedRefreshButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  refreshButtonGradient: {
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.3)',
  },
  confessionCard: {
    backgroundColor: '#1a1a4a',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 15,
    shadowColor: "#ff00ff",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.3)',
    position: 'relative',
    overflow: 'hidden',
  },
  confessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 18,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 0, 255, 0.4)',
  },
  userInfoContainer: {
    flex: 1,
  },
  username: {
    color: '#ff00ff',
    fontWeight: '700',
    fontSize: 15,
    textShadowColor: 'rgba(255, 0, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  locationText: {
    color: '#999',
    fontSize: 11,
    marginTop: 2,
  },
  typeAndDateContainer: {
    alignItems: 'flex-end',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  personBadge: {
    backgroundColor: '#FF6B81',
  },
  placeBadge: {
    backgroundColor: '#4CAF50',
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  dateText: {
    color: '#666',
    fontSize: 10,
  },
  confessionContent: {
    color: '#fff',
    fontSize: 15,
    marginBottom: 12,
    lineHeight: 22,
    fontWeight: '400',
  },
  mediaIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  mediaText: {
    color: '#ff00ff',
    fontSize: 11,
    marginLeft: 4,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 0, 255, 0.2)',
    paddingTop: 12,
    gap: 25,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionText: {
    color: '#999',
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '500',
  },
  likedText: {
    color: '#ff00ff',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#ff00ff',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 16,
  },
});

export default ConfessionButtonScreen;