import React, { useState, useEffect } from 'react';
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
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { useTheme } from '../context/ThemeContext';

const ConfessionButtonScreen = () => {
  const { isDarkMode, theme } = useTheme();
  const navigation = useNavigation();
  const [randomConfessions, setRandomConfessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  const CONFESSIONS_CACHE_KEY = 'confessions_cache';
  const CACHE_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    fetchCurrentUser();
    loadCachedConfessions();
  }, []);

  // Load cached confessions first for instant display
  const loadCachedConfessions = async () => {
    try {
      const cachedData = await AsyncStorage.getItem(CONFESSIONS_CACHE_KEY);
      if (cachedData) {
        const { confessions, timestamp } = JSON.parse(cachedData);
        const now = Date.now();
        
        // Show cached confessions immediately
        if (confessions && confessions.length > 0) {
          setRandomConfessions(confessions);
          setLoading(false);
          console.log('✅ Instant load: Showing cached confessions');
          
          // Refresh in background if cache is old
          if (now - timestamp > CACHE_EXPIRY_TIME) {
            setTimeout(() => {
              fetchRandomConfessions(true); // Silent refresh
            }, 100);
          }
        } else {
          fetchRandomConfessions();
        }
      } else {
        fetchRandomConfessions();
      }
    } catch (error) {
      console.error('Error loading cached confessions:', error);
      fetchRandomConfessions();
    }
  };

  // Save confessions to cache
  const cacheConfessions = async (confessionsData) => {
    try {
      const cacheData = {
        confessions: confessionsData,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(CONFESSIONS_CACHE_KEY, JSON.stringify(cacheData));
      console.log('Cached confessions for instant loading');
    } catch (error) {
      console.error('Error caching confessions:', error);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchRandomConfessions = async (isSilent = false) => {
    try {
      if (!isSilent) {
        setLoading(true);
      }
      
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
      const limitedConfessions = allConfessions.slice(0, 4);
      setRandomConfessions(limitedConfessions);
      
      // Cache for instant loading next time
      cacheConfessions(limitedConfessions);
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
    navigation.navigate('ConfessionPersonScreen');
  };

  const handlePlaceConfession = () => {
    navigation.navigate('ConfessionScreen');
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
        style={[styles.confessionCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
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
            <Text style={[styles.username, { color: theme.primaryAccent }]}>
              {item.is_anonymous ? 'Anonymous' : (item.username || 'User')}
            </Text>
            <Text style={[styles.locationText, { color: theme.textSecondary }]} numberOfLines={1}>
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
            <Text style={[styles.dateText, { color: theme.textSecondary }]}>{formattedDate}</Text>
          </View>
        </View>
        
        <Text style={[styles.confessionContent, { color: theme.textPrimary }]} numberOfLines={4}>
          {item.content}
        </Text>
        
        {item.media && item.media.length > 0 && (
          <View style={styles.mediaIndicator}>
            <Ionicons name="image" size={12} color={theme.secondaryAccent} />
            <Text style={[styles.mediaText, { color: theme.secondaryAccent }]}>{item.media.length} media</Text>
          </View>
        )}
        
        <View style={[styles.actionBar, { borderTopColor: theme.border }]}>
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
              color={item.is_liked ? '#F43F5E' : theme.textSecondary} 
            />
            <Text style={[styles.actionText, { color: theme.textSecondary }, item.is_liked && { color: '#F43F5E' }]}>
              {item.likes_count || 0}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={16} color={theme.textSecondary} />
            <Text style={[styles.actionText, { color: theme.textSecondary }]}>{item.comments_count || 0}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundSolid }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: theme.border }]}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Post a Confession</Text>
      </View>

      <FlatList
        data={randomConfessions}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={renderConfessionItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primaryAccent} />
        }
        ListHeaderComponent={() => (
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={handlePersonConfession}>
              <LinearGradient
                colors={isDarkMode ? ['rgba(95, 115, 242, 0.9)', 'rgba(56, 189, 248, 0.8)'] : [theme.primaryAccent, theme.secondaryAccent]}
                style={styles.simpleButton}
              >
                <Ionicons name="person" size={42} color="#fff" />
                <Text style={styles.buttonText}>Person</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={handlePlaceConfession}>
              <LinearGradient
                colors={isDarkMode ? ['rgba(56, 189, 248, 0.9)', 'rgba(95, 115, 242, 0.8)'] : [theme.secondaryAccent, theme.primaryAccent]}
                style={styles.simpleButton}
              >
                <Ionicons name="business" size={42} color="#fff" />
                <Text style={styles.buttonText}>Colleges/Offices/Places</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Recent Confessions</Text>
              <TouchableOpacity onPress={onRefresh} style={[styles.refreshButton, { backgroundColor: theme.border }]}>
                <Ionicons name="refresh" size={20} color={theme.primaryAccent} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={() => (
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primaryAccent} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading confessions...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={60} color={theme.secondaryAccent} />
              <Text style={[styles.emptyText, { color: theme.secondaryAccent }]}>No confessions available</Text>
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
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 15,
    paddingBottom: 15,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 15,
  },
  listContainer: {
    paddingBottom: 20,
  },
  buttonContainer: {
    padding: 20,
    gap: 20,
  },
  button: {
    width: '100%',
    height: 100,
    borderRadius: 15,
    overflow: 'hidden',
  },
  personButton: {
    backgroundColor: '#FF6B81',
  },
  placeButton: {
    backgroundColor: '#4CAF50',
  },
  simpleButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
  },
  confessionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  confessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 15,
    marginRight: 10,
  },
  userInfoContainer: {
    flex: 1,
  },
  username: {
    color: '#ff00ff',
    fontWeight: 'bold',
    fontSize: 14,
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
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
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
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 18,
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
    borderTopColor: 'rgba(255, 0, 255, 0.1)',
    paddingTop: 8,
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    color: '#999',
    marginLeft: 4,
    fontSize: 12,
  },
  likedText: {
    color: '#ff00ff',
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