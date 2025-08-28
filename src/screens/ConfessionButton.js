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
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';

const ConfessionButtonScreen = () => {
  const navigation = useNavigation();
  const [randomConfessions, setRandomConfessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    fetchCurrentUser();
    fetchRandomConfessions();
  }, []);

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
        .limit(10);

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
        .limit(10);

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

      // Shuffle array and take first 15 items
      const shuffled = allConfessions.sort(() => 0.5 - Math.random()).slice(0, 15);
      
      // Process confessions to add user profiles and like status
      const processedConfessions = await Promise.all(shuffled.map(async confession => {
        let processedMedia = confession.media;
        
        if (typeof confession.media === 'string') {
          try {
            processedMedia = JSON.parse(confession.media);
          } catch (e) {
            processedMedia = [];
          }
        }
        
        if (!processedMedia) {
          processedMedia = [];
        }
        
        const validatedMedia = Array.isArray(processedMedia) ?
          processedMedia.map(item => {
            if (item && typeof item === 'object' && item.url) {
              return item;
            }
            if (typeof item === 'string') {
              return { url: item, type: 'image' };
            }
            return null;
          }).filter(Boolean) : [];

        // For 'place' type, get the userProfile from the confession.user_id
        // For 'person' type, username and avatar_url are already set during the initial mapping from creator_profile
        let userProfile = { username: confession.username, avatar_url: confession.avatar_url };
        if (confession.type === 'place' && !confession.is_anonymous && confession.user_id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username, full_name, avatar_url')
            .eq('id', confession.user_id)
            .single();

          if (profileData) {
            userProfile = {
              username: profileData.username || profileData.full_name,
              avatar_url: profileData.avatar_url
            };
          }
        }

        // Check if current user has liked this confession
        const likesArray = confession.type === 'place' 
          ? confession.confession_likes 
          : confession.person_confession_likes;
        
        const isLiked = currentUser && likesArray 
          ? !!likesArray.find(like => like.user_id === currentUser.id)
          : false;

        return {
          ...confession,
          media: validatedMedia,
          ...(userProfile && { username: userProfile.username, avatar_url: userProfile.avatar_url }),
          is_liked: isLiked
        };
      }));

      setRandomConfessions(processedConfessions);
    } catch (error) {
      console.error('Error fetching random confessions:', error);
      Alert.alert('Error', 'Failed to load confessions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRandomConfessions();
  };

  const handlePersonConfession = () => {
    navigation.navigate('ConfessionPerson');
  };

  const handlePlaceConfession = () => {
    navigation.navigate('Confession');
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
              ? 'https://via.placeholder.com/30x30?text=A' 
              : (item.avatar_url || 'https://via.placeholder.com/30x30?text=U') 
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
        
        <Text style={styles.confessionContent} numberOfLines={3}>
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
        colors={['#0a0a2a', '#1a1a3a']}
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
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={handlePersonConfession}>
              <LinearGradient
                colors={['#FF6B81', '#FF4757']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={styles.gradientButton}
              >
                <Ionicons name="person" size={32} color="#fff" />
                <Text style={styles.buttonText}>Person</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={handlePlaceConfession}>
              <LinearGradient
                colors={['#4CAF50', '#8BC34A']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={styles.gradientButton}
              >
                <Ionicons name="business" size={32} color="#fff" />
                <Text style={styles.buttonText}>Colleges/Offices/Places</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Confessions</Text>
              <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
                <Ionicons name="refresh" size={20} color="#ff00ff" />
              </TouchableOpacity>
            </View>
          </View>
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
    gap: 20,
  },
  button: {
    width: '100%',
    height: 100,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    overflow: 'hidden',
  },
  gradientButton: {
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
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
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
    textShadowColor: 'rgba(255, 0, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  refreshButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    borderRadius: 15,
  },
  confessionCard: {
    backgroundColor: '#1a1a3a',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: "#9900ff",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.2)',
  },
  confessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  userInfoContainer: {
    flex: 1,
  },
  username: {
    color: '#ff00ff',
    fontWeight: 'bold',
    fontSize: 13,
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