import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Modal, ActivityIndicator, FlatList, Dimensions, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Video } from 'expo-av';
import Sidebar from '../components/Sidebar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAccounts } from '../context/AccountContext';
import PostItem from '../components/PostItem';

// AccountSwitcherModal component
const AccountSwitcherModal = ({ visible, onClose, loadUserProfile }) => {
  const { accounts, addAccount } = useAccounts();
  const navigation = useNavigation();
  const [currentUser, setCurrentUser] = useState(null);
  const [refreshedAccounts, setRefreshedAccounts] = useState([]);

  useEffect(() => {
    if (visible) {
      getCurrentUser();
      refreshAccountData();
    }
  }, [visible]);

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user.id);
      }
    } catch (error) {
      console.error("Error getting current user:", error);
    }
  };

  const refreshAccountData = async () => {
    try {
      const uniqueIds = {};
      accounts.forEach(account => {
        uniqueIds[account.id] = account;
      });
      const uniqueAccounts = Object.values(uniqueIds);
      const refreshed = await Promise.all(
        uniqueAccounts.map(async (account) => {
          try {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', account.id)
              .single();
            if (error) throw error;
            if (data) {
              const updatedAccount = {
                ...account,
                username: data.username,
                avatar_url: data.avatar_url
              };
              addAccount(updatedAccount);
              return updatedAccount;
            }
            return account;
          } catch (e) {
            console.error("Error refreshing account:", e);
            return account;
          }
        })
      );
      setRefreshedAccounts(refreshed);
    } catch (error) {
      console.error("Error refreshing accounts:", error);
    }
  };

  const displayAccounts = refreshedAccounts.length > 0 ? refreshedAccounts : 
    Object.values(accounts.reduce((acc, account) => {
      acc[account.id] = account;
      return acc;
    }, {}));

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Switch Account</Text>
          {displayAccounts.map((account, index) => (
            <TouchableOpacity 
              key={index}
              style={[
                styles.accountItem, 
                currentUser === account.id && styles.currentAccountItem
              ]}
              onPress={async () => {
                try {
                  if (currentUser !== account.id) {
                    onClose();
                    const { data, error } = await supabase.auth.signInWithPassword({
                      email: account.email,
                      password: account.stored_password || ''
                    });
                    if (error) {
                      if (account.session_token) {
                        const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession({
                          refresh_token: account.session_token
                        });
                        if (sessionError) {
                          Alert.alert(
                            "Session Expired", 
                            "Please log in again to access this account.",
                            [{ text: "OK", onPress: () => navigation.navigate('Login', { email: account.email }) }]
                          );
                          return;
                        }
                        await loadUserProfile();
                        navigation.reset({
                          index: 0,
                          routes: [{ name: 'MainApp' }],
                        });
                        return;
                      } else {
                        Alert.alert(
                          "Login Required", 
                          "Please log in to access this account.",
                          [{ text: "OK", onPress: () => navigation.navigate('Login', { email: account.email }) }]
                        );
                        return;
                      }
                    }
                    await loadUserProfile();
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'MainApp' }],
                    });
                  } else {
                    onClose();
                  }
                } catch (error) {
                  console.error("Error switching account:", error);
                  Alert.alert("Error", "Failed to switch account. Please try logging in manually.");
                  onClose();
                }
              }}
            >
              <Image 
                source={{ uri: account.avatar_url || 'https://via.placeholder.com/150' }}
                style={styles.accountAvatar}
              />
              <Text style={styles.accountUsername}>{account.username}</Text>
              {currentUser === account.id && (
                <View style={styles.currentAccountBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#ff00ff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity 
            style={styles.addAccountButton}
            onPress={() => {
              onClose();
              navigation.navigate('Login');
            }}
          >
            <Ionicons name="add-circle-outline" size={24} color="#ff00ff" />
            <Text style={styles.addAccountText}>Add Account</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Main ProfileScreen component
const ProfileScreen = () => {
  const { accounts, addAccount } = useAccounts();
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [isAccountSwitcherVisible, setAccountSwitcherVisible] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [showFullBio, setShowFullBio] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [postsCount, setPostsCount] = useState(0);
  const [shortsCount, setShortsCount] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [activeTab, setActiveTab] = useState('Post');
  const [shorts, setShorts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const navigation = useNavigation();
  
  // Animations disabled for instant loading
  const memoizedPosts = useMemo(() => posts, [posts]);
  const memoizedShorts = useMemo(() => shorts, [shorts]);
  const videoRefs = useRef({});
  
  useEffect(() => {
    const unloadAllVideos = () => {
      Object.values(videoRefs.current).forEach(videoRef => {
        if (videoRef && videoRef.unloadAsync) {
          videoRef.unloadAsync().catch(err => console.log('Error unloading video:', err));
        }
      });
      // Clear the refs after unloading
      videoRefs.current = {};
    };

    // Subscribe to focus events
    const unsubscribe = navigation.addListener('blur', unloadAllVideos);

    // Cleanup on unmount
    return () => {
      unloadAllVideos();
      unsubscribe();
    };
  }, [navigation]);


  const handlePostPress = async (index) => {
    console.log('Post pressed at index:', index);
    const currentPosts = activeTab === 'Post' ? memoizedPosts : memoizedShorts;
    const post = currentPosts[index];

    // Unload all videos before navigation
    const unloadAllVideos = async () => {
      const promises = Object.entries(videoRefs.current).map(async ([id, ref]) => {
        if (ref && ref.unloadAsync) {
          try {
            await ref.unloadAsync();
            delete videoRefs.current[id];
          } catch (e) { console.log('Error unloading video:', e); }
        }
      });
      await Promise.all(promises);
    };

    await unloadAllVideos();
  
    // If it's a video post, navigate to ShortsScreen
    if (post && post.type === 'video') {
      // Navigate to ShortsScreen for video posts
      setTimeout(() => {
        navigation.navigate('Shorts', {
          posts: currentPosts.filter(p => p.type === 'video'),
          initialIndex: currentPosts.filter(p => p.type === 'video').findIndex(p => p.id === post.id),
        });
      }, 100);
    } else {
      // For non-video posts (photos and text), navigate to PhotoTextViewer
      navigation.navigate('PhotoTextViewer', {
        posts: currentPosts.filter(p => p.type !== 'video'),
        initialIndex: currentPosts.filter(p => p.type !== 'video').findIndex(p => p.id === post.id),
      });
    }
  };

  const renderGridItem = ({ item, index }) => {
    if (item.type === 'text' || !item.media_url) {
      return (
        <TouchableOpacity 
          style={[styles.gridItem, styles.textGridItem]} 
          onPress={() => handlePostPress(index)}
        >
          <View style={styles.textPostContent}>
            <Text style={styles.gridTextContent} numberOfLines={4}>
              {item.caption || item.content}
            </Text>
            <View style={styles.gridItemFooter}>
              <View style={styles.gridItemStats}>
                <Ionicons name="heart" size={14} color="#ffd700" />
                <Text style={styles.gridItemStatsText}>{item.likes?.[0]?.count || 0}</Text>
                <Ionicons name="chatbubble" size={14} color="#ffd700" style={{ marginLeft: 8 }} />
                <Text style={styles.gridItemStatsText}>{item.comments?.[0]?.count || 0}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity 
        style={styles.gridItem} 
        onPress={() => handlePostPress(index)}
      >
        {item.type === 'video' ? (
          <View style={styles.gridVideoContainer}>
            <Video
              ref={ref => {
                if (ref) {
                  videoRefs.current[item.id] = ref;
                }
              }}
              source={{ uri: item.media_url || 'https://via.placeholder.com/300' }}
              style={styles.gridImage}
              resizeMode="cover"
              shouldPlay={false}
              isMuted={true}
              isLooping={false}
              controls={false}
              posterSource={{ uri: item.media_url }}
              usePoster={true}
              useNativeControls={false}
              onError={(error) => console.log('Video loading error:', error)}
            />
            <View style={styles.videoIndicator}>
              <Ionicons name="play-circle" size={24} color="#fff" />
            </View>
          </View>
        ) : (
          <Image
            source={{ uri: item.media_url || 'https://via.placeholder.com/300' }}
            style={styles.gridImage}
            resizeMode="cover"
          />
        )}
        <View style={styles.gridItemOverlay}>
          <View style={styles.gridItemStats}>
            <Ionicons name="heart" size={14} color="#fff" />
            <Text style={styles.gridItemStatsText}>{item.likes?.[0]?.count || 0}</Text>
            <Ionicons name="chatbubble" size={14} color="#fff" style={{ marginLeft: 8 }} />
            <Text style={styles.gridItemStatsText}>{item.comments?.[0]?.count || 0}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <>
      <LinearGradient
        colors={['#0f0f23', '#1a1a2e', '#16213e']}
        style={styles.header}
      >
        <TouchableOpacity 
          onPress={() => setSidebarVisible(true)}
          style={styles.headerButton}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#ffd700', '#ffed4e']}
            style={styles.headerIconContainer}
          >
            <Ionicons name="menu" size={20} color="#000" />
          </LinearGradient>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerSubtitle}>
            <MaterialIcons name="verified" size={16} color="#ffd700" />
            <Text style={styles.headerSubtitleText}>Premium Account</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          onPress={() => setAccountSwitcherVisible(true)}
          style={styles.headerButton}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#ffd700', '#ffed4e']}
            style={styles.headerIconContainer}
          >
            <Ionicons name="add-circle-outline" size={20} color="#000" />
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.profileSection}>
        <View style={styles.coverPhotoContainer}>
          <LinearGradient
            colors={['rgba(255,215,0,0.3)', 'rgba(255,0,255,0.2)', 'rgba(0,0,0,0.8)']}
            style={styles.coverGradientOverlay}
          />
          {userProfile?.cover_is_video ? (
            <View style={styles.videoCoverContainer}>
              <Video
                source={{ uri: userProfile.cover_url }}
                style={styles.coverPhoto}
                resizeMode="cover"
                shouldPlay
                isLooping
                isMuted={true}
              />
              <View style={styles.videoIndicatorOverlay}>
                <Ionicons name="videocam" size={20} color="#fff" />
              </View>
            </View>
          ) : (
            <Image
              style={styles.coverPhoto}
              source={
                userProfile?.cover_url
                  ? { uri: userProfile.cover_url, cache: 'reload' }
                  : require('../../assets/defaultcover.png')
              }
              onLoadStart={() => console.log('Cover photo loading started')}
              onLoadEnd={() => console.log('Cover photo loading ended')}
              onError={(e) => console.log('Cover photo error:', e.nativeEvent.error)}
            />
          )}
          <View style={styles.coverStats}>
            <View style={styles.coverStatItem}>
              <MaterialIcons name="visibility" size={16} color="#ffd700" />
              <Text style={styles.coverStatText}>{totalViews >= 1000 ? `${Math.round(totalViews / 1000)}K` : totalViews}</Text>
            </View>
            <View style={styles.coverStatItem}>
              <MaterialIcons name="favorite" size={16} color="#ff69b4" />
              <Text style={styles.coverStatText}>{totalLikes >= 1000 ? `${Math.round(totalLikes / 1000)}K` : totalLikes}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.profileImageContainer}>
          <LinearGradient
            colors={['#ffd700', '#ff69b4', '#8a2be2']}
            style={styles.profileImageGradient}
          >
            <Image
              style={styles.profileImage}
              source={
                userProfile?.avatar_url
                  ? { uri: userProfile.avatar_url, cache: 'reload' }
                  : require('../../assets/defaultavatar.png')
              }
              onLoadStart={() => console.log('Avatar loading started')}
              onLoadEnd={() => console.log('Avatar loading ended')}
              onError={(e) => console.log('Avatar error:', e.nativeEvent.error)}
            />
          </LinearGradient>
          <TouchableOpacity style={styles.profileImageBadge}>
            <LinearGradient
              colors={['#00ff88', '#00cc6a']}
              style={styles.onlineBadge}
            >
              <View style={styles.onlineDot} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
        
        <View style={styles.nameSection}>
          <Text style={styles.name}>{userProfile?.full_name || 'No name set'}</Text>
          <View style={styles.usernameContainer}>
            <Text style={styles.username}>@{userProfile?.username || 'username'}</Text>
            {userProfile?.isVerified && (
              <View>
                <LinearGradient
                  colors={['#ffd700', '#ff69b4']}
                  style={styles.verifiedBadgeGradient}
                >
                  <MaterialIcons name="verified" size={18} color="#fff" />
                </LinearGradient>
              </View>
            )}
          </View>
          <View style={styles.userTags}>
            <View style={styles.tag}>
              <MaterialIcons name="star" size={12} color="#ffd700" />
              <Text style={styles.tagText}>Creator</Text>
            </View>
            <View style={styles.tag}>
              <MaterialIcons name="trending-up" size={12} color="#00ff88" />
              <Text style={styles.tagText}>Rising</Text>
            </View>
          </View>
        </View>
        <View style={styles.achievementsSection}>
          <LinearGradient
            colors={['#ffd700', '#ffed4e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.rankBadge}
          >
            <MaterialIcons name="emoji-events" size={18} color="#000" />
            <Text style={styles.rankNumber}>
              {userProfile?.rank 
                ? `Rank #${userProfile.rank} ${userProfile.rank === 1 ? '(First Member!)' : ''}`
                : 'Rank not assigned'}
            </Text>
          </LinearGradient>
          
          <View style={styles.achievementBadges}>
            <TouchableOpacity style={styles.achievementBadge}>
              <LinearGradient colors={['#ff6b6b', '#ee5a52']} style={styles.badgeGradient}>
                <MaterialIcons name="favorite" size={16} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.achievementBadge}>
              <LinearGradient colors={['#4ecdc4', '#44a08d']} style={styles.badgeGradient}>
                <MaterialIcons name="flash-on" size={16} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.achievementBadge}>
              <LinearGradient colors={['#a8e6cf', '#7fcdcd']} style={styles.badgeGradient}>
                <MaterialIcons name="trending-up" size={16} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
        {userProfile?.bio && (
          <View style={styles.bioContainer}>
            <Text style={styles.bioText}>
              {userProfile.bio.length > 50 && !showFullBio
                ? userProfile.bio.substring(0, 50) + '...'
                : userProfile.bio}
              {userProfile.bio.length > 50 && !showFullBio && (
                <Text 
                  style={styles.moreText}
                  onPress={() => setShowFullBio(true)}
                > more</Text>
              )}
            </Text>
          </View>
        )}
        
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#ffd700', '#ffed4e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.editButtonGradient}
            >
              <MaterialIcons name="edit" size={18} color="#000" style={{ marginRight: 8 }} />
              <Text style={[styles.editButtonText, { color: '#000' }]}>EDIT PROFILE</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.shareButton} activeOpacity={0.8}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.shareButtonGradient}
            >
              <MaterialIcons name="share" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <TouchableOpacity style={styles.stat} activeOpacity={0.7}>
            <LinearGradient
              colors={['rgba(255,215,0,0.1)', 'rgba(255,215,0,0.05)']}
              style={styles.statBackground}
            >
              <MaterialIcons name="article" size={20} color="#ffd700" />
              <Text style={styles.statNumber}>{postsCount}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.stat} activeOpacity={0.7}>
            <LinearGradient
              colors={['rgba(255,105,180,0.1)', 'rgba(255,105,180,0.05)']}
              style={styles.statBackground}
            >
              <MaterialIcons name="videocam" size={20} color="#ff69b4" />
              <Text style={styles.statNumber}>{shortsCount}</Text>
              <Text style={styles.statLabel}>Shorts</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.stat}
            onPress={fetchFollowers}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['rgba(0,255,136,0.1)', 'rgba(0,255,136,0.05)']}
              style={styles.statBackground}
            >
              <MaterialIcons name="people" size={20} color="#00ff88" />
              <Text style={styles.statNumber}>{followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.stat}
            onPress={fetchFollowing}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['rgba(138,43,226,0.1)', 'rgba(138,43,226,0.05)']}
              style={styles.statBackground}
            >
              <MaterialIcons name="person-add" size={20} color="#8a2be2" />
              <Text style={styles.statNumber}>{followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'Post' && styles.activeTab]}
          onPress={() => {
            setActiveTab('Post');
            fetchUserContent();
          }}
        >
          <Text style={[styles.tabButtonText, activeTab === 'Post' && styles.activeTabText]}>Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'Short' && styles.activeTab]}
          onPress={() => {
            setActiveTab('Short');
            fetchUserContent();
          }}
        >
          <Text style={[styles.tabButtonText, activeTab === 'Short' && styles.activeTabText]}>Shorts</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'Details' && styles.activeTab]}
          onPress={() => setActiveTab('Details')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'Details' && styles.activeTabText]}>Details</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff00ff" />
        </View>
      );
    }

    if (activeTab === 'Details') {
      return (
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsText}>Details tab content coming soon!</Text>
        </View>
      );
    }

    const data = activeTab === 'Post' ? memoizedPosts : memoizedShorts;
    console.log(`Rendering ${data.length} items for ${activeTab} tab`);
    return data.length > 0 ? (
      <FlatList
        data={data}
        renderItem={renderGridItem}
        numColumns={3}
        keyExtractor={item => item.id.toString()}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.gridContainer}
        scrollEnabled={true}
      />
    ) : (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {activeTab === 'Post' ? 'No posts yet' : 'No shorts yet'}
        </Text>
      </View>
    );
  };

  useFocusEffect(
    React.useCallback(() => {
      console.log('ProfileScreen focused - Loading data for tab:', activeTab);
      // Load critical data first
      loadUserProfile();
      fetchUserContent();
      
      // Load counts in background (non-blocking)
      setTimeout(() => {
        fetchFollowersCount();
        fetchFollowingCount();
        fetchPostsCount();
        fetchShortsCount();
      }, 0);

      return () => {
        console.log('ProfileScreen unfocused');
      };
    }, [activeTab])
  );

  const fetchShortsCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
        .from('posts')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('type', 'video');

      if (error) {
        console.error('Error fetching shorts count:', error);
      } else {
        setShortsCount(count || 0);
      }
    } catch (error) {
      console.error('Error fetching shorts count:', error);
    }
  };

  const fetchPostsCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
        .from('posts')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching posts count:', error);
      } else {
        setPostsCount(count);
      }
    } catch (error) {
      console.error('Error fetching posts count:', error);
    }
  };

  const fetchUserContent = async (isSilent = false) => {
    try {
      if (!isSilent) {
        setLoading(true);
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Try to load from cache first for instant display
      const CONTENT_CACHE_KEY = `user_content_${user.id}_${activeTab}`;
      const CACHE_EXPIRY_TIME = 3 * 60 * 1000; // 3 minutes for content
      
      try {
        const cachedData = await AsyncStorage.getItem(CONTENT_CACHE_KEY);
        console.log('Checking cache for:', CONTENT_CACHE_KEY, cachedData ? 'Found' : 'Not found');
        if (cachedData && !isSilent) {
          const { content, timestamp } = JSON.parse(cachedData);
          const now = Date.now();
          const cacheAge = now - timestamp;
          console.log('Cache age:', Math.round(cacheAge / 1000), 'seconds');
          
          // Show cached content immediately
          if (content) {
            console.log('Cache content:', {
              postsCount: content.posts?.length || 0,
              shortsCount: content.shorts?.length || 0,
              totalViews: content.totalViews,
              totalLikes: content.totalLikes
            });
            
            if (activeTab === 'Post') {
              console.log('Setting posts from cache:', content.posts?.length || 0);
              setPosts(content.posts || []);
            } else {
              console.log('Setting shorts from cache:', content.shorts?.length || 0);
              setShorts(content.shorts || []);
            }
            setTotalViews(content.totalViews || 0);
            setTotalLikes(content.totalLikes || 0);
            setLoading(false);
            console.log('✅ Instant load: Showing cached content');
            
            // Refresh in background if cache is old
            if (now - timestamp > CACHE_EXPIRY_TIME) {
              console.log('Cache expired, refreshing in background');
              setTimeout(() => {
                fetchUserContent(true); // Silent refresh
              }, 100);
              return;
            } else {
              console.log('Cache is fresh, using cached data');
              return; // Cache is fresh, no need to fetch
            }
          }
        }
      } catch (cacheError) {
        console.error('Content cache error:', cacheError);
      }

      // Fetch ALL posts first to calculate totals
      const { data: allPostsData, error: allPostsError } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (*),
          likes:post_likes (count),
          comments:post_comments (count),
          user_likes:post_likes (user_id)
        `)
        .eq('user_id', user.id);

      if (!allPostsError && allPostsData) {
        // Calculate total views and likes from all posts
        const views = allPostsData.reduce((sum, post) => sum + (post.views || 0), 0);
        const likes = allPostsData.reduce((sum, post) => {
          const likeCount = post.likes?.[0]?.count || 0;
          return sum + likeCount;
        }, 0);
        setTotalViews(views);
        setTotalLikes(likes);
      }

      if (activeTab === 'Post') {
        const { data, error } = await supabase
          .from('posts')
          .select(`
            *,
            profiles:user_id (*),
            likes:post_likes (count),
            comments:post_comments (count),
            user_likes:post_likes (user_id)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        console.log(`Fetched ${data?.length || 0} posts from Supabase`);
        const postsWithLikeStatus = data.map(post => ({
          ...post,
          is_liked: post.user_likes?.some(like => like.user_id === user.id) || false
        }));
        console.log('Setting posts state with data:', postsWithLikeStatus?.length || 0);
        setPosts(postsWithLikeStatus || []);
      } else if (activeTab === 'Short') {
        const { data, error } = await supabase
          .from('posts')
          .select(`
            *,
            profiles:user_id (*),
            likes:post_likes (count),
            comments:post_comments (count),
            user_likes:post_likes (user_id)
          `)
          .eq('user_id', user.id)
          .eq('type', 'video')
          .order('created_at', { ascending: false });

        if (error) throw error;
        console.log(`Fetched ${data?.length || 0} shorts from Supabase`);
        const shortsWithLikeStatus = data.map(post => ({
          ...post,
          is_liked: post.user_likes?.some(like => like.user_id === user.id) || false
        }));
        console.log('Setting shorts state with data:', shortsWithLikeStatus?.length || 0);
        setShorts(shortsWithLikeStatus || []);
      }
      
      // Cache the content for instant loading next time
      try {
        const CONTENT_CACHE_KEY = `user_content_${user.id}_${activeTab}`;
        // Use the current state for caching which will have the most up-to-date data
        const contentToCache = {
          posts: activeTab === 'Post' ? posts : [],
          shorts: activeTab === 'Short' ? shorts : [],
          totalViews,
          totalLikes
        };
        const cacheData = {
          content: contentToCache,
          timestamp: Date.now()
        };
        await AsyncStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(cacheData));
        console.log('Cached user content for instant loading');
      } catch (cacheError) {
        console.error('Error caching content:', cacheError);
      }
    } catch (error) {
      console.error('Error fetching user content:', error);
    } finally {
      setLoading(false);
    }
  };

  // Background cleanup function - doesn't block UI
  const cleanupOldFiles = async (userId, newData) => {
    try {
      const { data: oldData } = await supabase
        .from('profiles')
        .select('avatar_url, cover_url')
        .eq('id', userId)
        .single();

      if (!oldData) return;

      // Clean up old avatar
      if (oldData?.avatar_url && oldData.avatar_url !== newData.avatar_url) {
        let oldAvatarPath = oldData.avatar_url;
        if (oldAvatarPath.includes('media/')) {
          oldAvatarPath = oldAvatarPath.split('media/')[1];
        }
        supabase.storage.from('media').remove([oldAvatarPath]).then(() => {});
      }

      // Clean up old cover
      if (oldData?.cover_url && oldData.cover_url !== newData.cover_url) {
        let oldCoverPath = oldData.cover_url;
        if (oldCoverPath.includes('media/')) {
          oldCoverPath = oldCoverPath.split('media/')[1];
        }
        supabase.storage.from('media').remove([oldCoverPath]).then(() => {});
      }
    } catch (error) {
      console.log('Background cleanup error:', error);
    }
  };

  const loadUserProfile = async (isSilent = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found');
        return;
      }

      // Try to load from cache first for instant display
      const PROFILE_CACHE_KEY = `profile_${user.id}`;
      const CACHE_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes
      
      try {
        const cachedData = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
        if (cachedData && !isSilent) {
          const { profile: cachedProfile, timestamp } = JSON.parse(cachedData);
          const now = Date.now();
          
          // Show cached profile immediately
          if (cachedProfile) {
            setUserProfile(cachedProfile);
            console.log('✅ Instant load: Showing cached profile');
            
            // Refresh in background if cache is old
            if (now - timestamp > CACHE_EXPIRY_TIME) {
              setTimeout(() => {
                loadUserProfile(true); // Silent refresh
              }, 100);
              return;
            } else {
              return; // Cache is fresh, no need to fetch
            }
          }
        }
      } catch (cacheError) {
        console.error('Cache error:', cacheError);
      }

      // Load profile data (critical)
      const { data: newData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading user profile:', error);
        setUserProfile(null);
        return;
      }
      
      // Check if cover URL is a video by extension if cover_is_video flag is not set
      if (newData.cover_url && newData.cover_url.endsWith('.mp4') && !newData.cover_is_video) {
        // Update in background - don't block UI
        supabase
          .from('profiles')
          .update({ cover_is_video: true })
          .eq('id', user.id)
          .then(() => {});
          
        // Update the local data
        newData.cover_is_video = true;
      }

      // Clean up old files in background - don't block UI loading
      // This runs asynchronously without blocking profile display
      setTimeout(() => {
        cleanupOldFiles(user.id, newData);
      }, 1000);

      let avatarUrl = null;
      let coverUrl = null;

      if (newData.avatar_url) {
        let avatarPath = newData.avatar_url;
        if (avatarPath.includes('media/media/') || avatarPath.includes('storage/v1/object/public/media/')) {
          const match = avatarPath.match(/([a-f0-9-]+\/avatar_[0-9]+\.jpg)/);
          if (match && match[1]) {
            avatarPath = match[1];
          } else {
            avatarPath = avatarPath.split('media/').pop();
          }
        }
        avatarUrl = `https://lckhaysswueoyinhfzyz.supabase.co/storage/v1/object/public/media/${avatarPath}`;
        console.log('Constructed Avatar URL:', avatarUrl);
      }

      if (newData.cover_url) {
        let coverPath = newData.cover_url;
        if (coverPath.includes('media/media/') || coverPath.includes('storage/v1/object/public/media/')) {
          const match = coverPath.match(/([a-f0-9-]+\/cover_[0-9]+\.jpg)/);
          if (match && match[1]) {
            coverPath = match[1];
          } else {
            coverPath = coverPath.split('media/').pop();
          }
        }
        coverUrl = `https://lckhaysswueoyinhfzyz.supabase.co/storage/v1/object/public/media/${coverPath}`;
        console.log('Constructed Cover URL:', coverUrl);
      }

      // Check if user is verified
      const { data: verifiedData } = await supabase
        .from('verified_accounts')
        .select('verified')
        .eq('id', user.id)
        .maybeSingle();

      const finalProfile = {
        ...newData,
        avatar_url: avatarUrl,
        cover_url: coverUrl,
        isVerified: verifiedData?.verified || false
      };
      
      setUserProfile(finalProfile);
      
      // Cache the profile for instant loading next time
      try {
        const PROFILE_CACHE_KEY = `profile_${user.id}`;
        const cacheData = {
          profile: finalProfile,
          timestamp: Date.now()
        };
        await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cacheData));
        console.log('Cached profile for instant loading');
      } catch (cacheError) {
        console.error('Error caching profile:', cacheError);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setUserProfile(null);
    }
  };

  const fetchFollowersCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const blockedIds = await getBlockedUserIds(user.id);
        
      let query = supabase
        .from('follows')
        .select('*', { count: 'exact' })
        .eq('following_id', user.id);

      if (blockedIds.length > 0) {
        blockedIds.forEach(blockedId => {
          query = query.neq('follower_id', blockedId);
        });
      }

      const { count, error } = await query;
          
      if (error) {
        console.error('Error fetching followers count:', error);
      } else {
        setFollowersCount(count || 0);
      }
    } catch (error) {
      console.error('Error fetching followers count:', error);
    }
  };

  const fetchFollowingCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const blockedIds = await getBlockedUserIds(user.id);

      let query = supabase
        .from('follows')
        .select('*', { count: 'exact' })
        .eq('follower_id', user.id);

      if (blockedIds.length > 0) {
        blockedIds.forEach(blockedId => {
          query = query.neq('following_id', blockedId);
        });
      }

      const { count, error } = await query;
          
      if (error) {
        console.error('Error fetching following count:', error);
      } else {
        setFollowingCount(count);
      }
    } catch (error) {
      console.error('Error fetching following count:', error);
    }
  };

  const getBlockedUserIds = async (currentUserId) => {
    const { data, error } = await supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', currentUserId);

    if (error) {
      console.error('Error fetching blocked user IDs:', error);
      return [];
    }
    return data.map(item => item.blocked_id);
  };

  const fetchFollowers = async () => {
    try {
      setLoadingConnections(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const blockedIds = await getBlockedUserIds(user.id);

      let query = supabase
        .from('follows')
        .select(`
          follower_id,
          profiles!follows_follower_id_fkey (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('following_id', user.id);

      if (blockedIds.length > 0) {
        blockedIds.forEach(blockedId => {
          query = query.neq('follower_id', blockedId);
        });
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching followers:', error);
        return;
      }

      const followersList = data.map(item => {
        const profile = item.profiles;
        let avatarUrl = null;
        if (profile.avatar_url) {
          let avatarPath = profile.avatar_url;
          if (avatarPath.includes('media/media/') || avatarPath.includes('storage/v1/object/public/media/')) {
            const match = avatarPath.match(/([a-f0-9-]+\/avatar_[0-9]+\.jpg)/);
            if (match && match[1]) {
              avatarPath = match[1];
            } else {
              avatarPath = avatarPath.split('media/').pop();
            }
          }
          avatarUrl = `https://lckhaysswueoyinhfzyz.supabase.co/storage/v1/object/public/media/${avatarPath}`;
        }
        return {
          ...profile,
          avatar_url: avatarUrl
        };
      });

      setFollowers(followersList);
      setShowFollowersModal(true);
    } catch (error) {
      console.error('Error fetching followers:', error);
    } finally {
      setLoadingConnections(false);
    }
  };

  const fetchFollowing = async () => {
    try {
      setLoadingConnections(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const blockedIds = await getBlockedUserIds(user.id);

      let query = supabase
        .from('follows')
        .select(`
          following_id,
          profiles!follows_following_id_fkey (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('follower_id', user.id);

      if (blockedIds.length > 0) {
        blockedIds.forEach(blockedId => {
          query = query.neq('following_id', blockedId);
        });
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching following:', error);
        return;
      }

      const followingList = data.map(item => {
        const profile = item.profiles;
        let avatarUrl = null;
        if (profile.avatar_url) {
          let avatarPath = profile.avatar_url;
          if (avatarPath.includes('media/media/') || avatarPath.includes('storage/v1/object/public/media/')) {
            const match = avatarPath.match(/([a-f0-9-]+\/avatar_[0-9]+\.jpg)/);
            if (match && match[1]) {
              avatarPath = match[1];
            } else {
              avatarPath = avatarPath.split('media/').pop();
            }
          }
          avatarUrl = `https://lckhaysswueoyinhfzyz.supabase.co/storage/v1/object/public/media/${avatarPath}`;
        }
        return {
          ...profile,
          avatar_url: avatarUrl
        };
      });

      setFollowing(followingList);
      setShowFollowingModal(true);
    } catch (error) {
      console.error('Error fetching following:', error);
    } finally {
      setLoadingConnections(false);
    }
  };

  const ConnectionsModal = ({ visible, onClose, title, connections, isLoading }) => {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{title}</Text>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ff00ff" />
              </View>
            ) : connections.length > 0 ? (
              <FlatList
                data={connections}
                keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.connectionItem}
                    onPress={() => {
                      onClose();
                      navigation.navigate('UserProfileScreen', { userId: item.id });
                    }}
                  >
                    <Image 
                      source={{ uri: item.avatar_url || 'https://via.placeholder.com/150' }}
                      style={styles.connectionAvatar}
                    />
                    <View style={styles.connectionInfo}>
                      <Text style={styles.connectionName}>{item.full_name || 'No name'}</Text>
                      <Text style={styles.connectionUsername}>@{item.username || 'username'}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                style={styles.connectionsList}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={50} color="#666" />
                <Text style={styles.emptyText}>No {title.toLowerCase()} yet</Text>
              </View>
            )}
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <Sidebar 
        isVisible={isSidebarVisible} 
        onClose={() => setSidebarVisible(false)}
      />
      <AccountSwitcherModal 
        visible={isAccountSwitcherVisible}
        onClose={() => setAccountSwitcherVisible(false)}
        loadUserProfile={loadUserProfile}
      />
      <ConnectionsModal
        visible={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
        title="Followers"
        connections={followers}
        isLoading={loadingConnections}
      />
      <ConnectionsModal
        visible={showFollowingModal}
        onClose={() => setShowFollowingModal(false)}
        title="Following"
        connections={following}
        isLoading={loadingConnections}
      />
      <FlatList
        data={[{ key: 'header' }, { key: 'content' }]}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          if (item.key === 'header') {
            return renderHeader();
          } else {
            return renderContent();
          }
        }}
        showsVerticalScrollIndicator={false}
        onRefresh={async () => {
          // Load critical data first
          setLoading(true);
          await Promise.all([
            loadUserProfile(),
            fetchUserContent()
          ]);
          setLoading(false);
          
          // Load counts in background (don't wait)
          setTimeout(() => {
            fetchFollowersCount();
            fetchFollowingCount();
            fetchPostsCount();
            fetchShortsCount();
          }, 0);
        }}
        refreshing={loading}
        contentContainerStyle={{ paddingBottom: 80 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  videoCoverContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  headerButton: {
    padding: 4,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerSubtitleText: {
    color: '#ffd700',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  coverGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  coverStats: {
    position: 'absolute',
    top: 15,
    right: 15,
    flexDirection: 'row',
    zIndex: 2,
  },
  coverStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  coverStatText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  profileImageContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  profileImageGradient: {
    padding: 4,
    borderRadius: 54,
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  profileImageBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
  },
  onlineBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  nameSection: {
    alignItems: 'center',
    marginTop: 15,
  },
  verifiedBadgeGradient: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  userTags: {
    flexDirection: 'row',
    marginTop: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  tagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  achievementsSection: {
    alignItems: 'center',
    marginTop: 15,
  },
  achievementBadges: {
    flexDirection: 'row',
    marginTop: 10,
  },
  achievementBadge: {
    marginHorizontal: 6,
  },
  badgeGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  shareButton: {
    marginLeft: 12,
  },
  shareButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  statBackground: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  verifiedBadge: {
    marginLeft: 5,
  },
  videoIndicatorOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 15,
    padding: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    paddingTop: 50,
  },
  profileSection: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 0,
  },
  coverPhotoContainer: {
    width: '100%',
    height: 200,
    marginBottom: -50,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  coverPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    backgroundColor: '#1a1a1a',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1a1a1a',
  },
  name: {
    fontSize: 26,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(255, 215, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  username: {
    fontSize: 16,
    color: '#faf7f8',
    marginTop: 5,
  },
  bioContainer: {
    marginTop: 10,
    paddingHorizontal: 20,
    width: '100%',
  },
  bioText: {
    color: '#faf7f8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  moreText: {
    color: '#ff00ff',
    fontWeight: '600',
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  rankNumber: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  editButton: {
    flex: 1,
    maxWidth: 200,
    elevation: 3,
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  editButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  editButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 12,
    paddingHorizontal: 30,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 25,
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  stat: {
    flex: 1,
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontWeight: '500',
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    marginTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.2)',
  },
  tabButton: {
    marginRight: 30,
    paddingBottom: 10,
    flex: 1,
    alignItems: 'center',
  },
  tabButtonText: {
    color: '#faf7f8',
    fontSize: 16,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#ffd700',
  },
  activeTabText: {
    color: '#ffd700',
  },
  gridContainer: {
    padding: 4,
    paddingBottom: 20,
  },
  gridRow: {
    justifyContent: 'flex-start',
    padding: 2,
  },
  gridItem: {
    flex: 1,
    margin: 2,
    aspectRatio: 1,
    maxWidth: '33.33%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridVideoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 4,
    zIndex: 2,
  },
  gridItemOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
  },
  gridItemStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridItemStatsText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  textGridItem: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  textPostContent: {
    flex: 1,
    padding: 8,
    justifyContent: 'space-between',
  },
  gridTextContent: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 16,
  },
  gridItemFooter: {
    marginTop: 'auto',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 30,
    minHeight: '40%',
  },
  modalTitle: {
    color: '#ff00ff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 25,
    textAlign: 'center',
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    marginVertical: 5,
  },
  accountAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    borderWidth: 2,
    borderColor: '#ff00ff',
  },
  accountUsername: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '500',
  },
  currentAccountItem: {
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#ff00ff',
    borderRadius: 10,
  },
  currentAccountBadge: {
    marginLeft: 'auto',
  },
  addAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
  },
  addAccountText: {
    color: '#ff00ff',
    fontSize: 18,
    marginLeft: 15,
    fontWeight: '500',
  },
  closeButton: {
    alignItems: 'center',
    padding: 15,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  closeText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '500',
  },
  connectionsList: {
    maxHeight: 400,
  },
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  connectionAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#ff00ff',
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  connectionUsername: {
    color: '#999',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    flex: 1,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  detailsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  detailsText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default ProfileScreen;