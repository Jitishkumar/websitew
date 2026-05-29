import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Animated, Alert, FlatList, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import ProfileViewBlinker from '../components/ProfileViewBlinker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideo } from '../context/VideoContext';
import { Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { CacheManager, CACHE_KEYS, CACHE_TTL } from '../utils/cache';
import PostItem from '../components/PostItem';
import { useTheme } from '../context/ThemeContext';

const UserProfileScreen = () => {
  const { isDarkMode, theme } = useTheme();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFullBio, setShowFullBio] = useState(false);
  const [viewerGender, setViewerGender] = useState(null);
  const [posts, setPosts] = useState([]);
  const [shorts, setShorts] = useState([]);
  const [tweets, setTweets] = useState([]);
  const [postsCount, setPostsCount] = useState(0);
  const [shortsCount, setShortsCount] = useState(0);
  const [activeTab, setActiveTab] = useState('Details');
  const [loadingContent, setLoadingContent] = useState(false);
  const blinkAnimation = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const { activeVideoId, setActiveVideo, clearActiveVideo } = useVideo();
  
  const memoizedPosts = useMemo(() => posts, [posts]);
  const memoizedShorts = useMemo(() => shorts, [shorts]);
  const memoizedTweets = useMemo(() => tweets, [tweets]);

  // State for followers/following modals
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(false);

  // Function to fetch blocked user IDs
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

  // Function to create blinking animation
  const createBlinkAnimation = (color) => {
    Animated.sequence([
      Animated.timing(blinkAnimation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: false,
      }),
      Animated.timing(blinkAnimation, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: false,
      }),
    ]).start(() => {
      // Repeat two more times for a total of 3 blinks
      Animated.sequence([
        Animated.timing(blinkAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(blinkAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(blinkAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(blinkAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ]).start();
    });
  };
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params;

  useEffect(() => {
    // OPTIMIZED: Load all data in parallel with caching
    loadUserProfileWithCache();
    
    // Set up realtime subscription for follows
    const followsSubscription = supabase
      .channel('public:follows')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${userId}` }, 
        (payload) => {
          // When a follow/unfollow happens, refresh the follow status
          checkFollowStatus();
          fetchFollowersCount();
          fetchFollowingCount();
      })
      .subscribe();
      
    // Clean up subscription when component unmounts
    return () => {
      supabase.removeChannel(followsSubscription);
      clearActiveVideo(); // Clear any active video when unmounting
    };
  }, [userId]);
  
  useEffect(() => {
    if (canViewPrivateContent || !hasPrivateAccount) {
      fetchUserContent();
    }
  }, [userId, activeTab, canViewPrivateContent, hasPrivateAccount]);

  const loadViewerGender = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('gender')
          .eq('id', user.id)
          .single();

        if (data) {
          setViewerGender(data.gender);
        }
      }
    } catch (error) {
      console.error('Error loading viewer gender:', error);
    }
  };

  const [hasPrivateAccount, setHasPrivateAccount] = useState(false);
  const [canViewPrivateContent, setCanViewPrivateContent] = useState(false);

  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  const getProfilePrivacy = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('private_account')
        .eq('user_id', userId)
        .single();
      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        throw error;
      }
      return data?.private_account || false;
    } catch (error) {
      console.error('Error fetching profile privacy:', error);
      return false; // Default to public if error
    }
  };

  const handleMentionPress = async (username) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();

      if (error || !profile) {
        Alert.alert('Error', `User @${username} not found.`);
        return;
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to view profiles.');
        return;
      }

      // If the mentioned user is the current user, navigate to their own profile
      if (currentUser.id === profile.id) {
        navigation.navigate('UserProfileScreen', { userId: currentUser.id });
        return;
      }

      const isPrivate = await getProfilePrivacy(profile.id);

      if (isPrivate) {
        const { data: followData, error: followError } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', currentUser.id)
          .eq('following_id', profile.id)
          .maybeSingle();

        if (followError) {
          console.error('Error checking follow status:', followError);
          throw followError;
        }

        if (!followData) {
          navigation.navigate('PrivateProfileScreen', { userId: profile.id });
          return;
        }
      }

      navigation.navigate('UserProfileScreen', { userId: profile.id });
    } catch (error) {
      console.error('Error navigating to mentioned user profile:', error);
      Alert.alert('Error', 'Could not open user profile.');
    }
  };

  const renderMentionedContent = (content, shouldTruncate) => {
    if (!content) return null;

    const parts = [];
    let lastIndex = 0;
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;

    const textToRender = shouldTruncate ? content.substring(0, 50) : content;

    textToRender.replace(mentionRegex, (match, username, offset) => {
      if (offset > lastIndex) {
        parts.push(<Text key={`text-${lastIndex}`} style={[styles.bioText, { color: theme.textPrimary }]}>{textToRender.substring(lastIndex, offset)}</Text>);
      }
      parts.push(
        <TouchableOpacity key={`mention-${offset}`} onPress={() => handleMentionPress(username)}>
          <Text style={[styles.mentionText, { color: theme.secondaryAccent }]}>@{username}</Text>
        </TouchableOpacity>
      );
      lastIndex = offset + match.length;
      return match;
    });

    if (lastIndex < textToRender.length) {
      parts.push(<Text key={`text-${lastIndex}`} style={[styles.bioText, { color: theme.textPrimary }]}>{textToRender.substring(lastIndex)}</Text>);
    }
    return <Text style={[styles.bioText, { color: theme.textPrimary }]}>{parts}</Text>;
  };

  // OPTIMIZED: Load profile with caching
  const loadUserProfileWithCache = async (forceRefresh = false) => {
    try {
      const startTime = Date.now();
      const cacheKey = `${CACHE_KEYS.USER_PROFILE}_${userId}`;
      
      // Try cache first
      if (!forceRefresh) {
        const cached = await CacheManager.get(cacheKey);
        if (cached) {
          console.log('📦 Loaded user profile from cache');
          setUserProfile(cached.profile);
          setFollowersCount(cached.followersCount);
          setFollowingCount(cached.followingCount);
          setPostsCount(cached.postsCount);
          setShortsCount(cached.shortsCount);
          setIsFollowing(cached.isFollowing);
          setHasPrivateAccount(cached.hasPrivateAccount);
          setCanViewPrivateContent(cached.canViewPrivateContent);
          setLoading(false);
          
          // Load fresh data in background
          loadUserProfileFresh();
          return;
        }
      }
      
      // No cache - load fresh
      await loadUserProfileFresh();
      
    } catch (error) {
      console.error('Error in loadUserProfileWithCache:', error);
      setLoading(false);
    }
  };

  const loadUserProfileFresh = async () => {
    try {
      const startTime = Date.now();
      setLoading(true);
      
      // Get current user for recording visit
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // Check if the users are blocked
      if (currentUser && currentUser.id !== userId) {
        const { data: isBlocked, error: isBlockedError } = await supabase.rpc('is_blocked', {
          user_id_1: currentUser.id,
          user_id_2: userId
        });

        if (isBlockedError) {
          console.error('Error checking block status:', isBlockedError);
        } else if (isBlocked) {
          setIsBlocked(true);
          setBlockReason('You are unable to view this profile.');
          setLoading(false);
          return;
        }

        // Record profile visit if not blocked (non-blocking)
        supabase
          .from('profile_visits')
          .insert({
            profile_id: userId,
            visitor_id: currentUser.id
          })
          .then(() => {})
          .catch(error => console.error('Error recording profile visit:', error));
      }

      // OPTIMIZED: Load all data in parallel
      const [profileResult, settingsResult, verifiedResult, followersResult, followingResult, postsResult, shortsResult, followStatusResult, viewerGenderResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('user_settings').select('private_account').eq('user_id', userId).maybeSingle(),
        supabase.from('verified_accounts').select('verified').eq('id', userId).maybeSingle(),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('type', 'video'),
        currentUser ? supabase.from('follows').select('*').eq('follower_id', currentUser.id).eq('following_id', userId).maybeSingle() : Promise.resolve({ data: null }),
        currentUser ? supabase.from('profiles').select('gender').eq('id', currentUser.id).single() : Promise.resolve({ data: null })
      ]);

      const { data, error } = profileResult;
      const { data: settingsData } = settingsResult;
      const { data: verifiedData } = verifiedResult;
        
      const isPrivate = settingsData?.private_account ?? false;
      setHasPrivateAccount(isPrivate);
      
      // Set counts from parallel queries
      setFollowersCount(followersResult.count || 0);
      setFollowingCount(followingResult.count || 0);
      setPostsCount(postsResult.count || 0);
      setShortsCount(shortsResult.count || 0);
      setIsFollowing(!!followStatusResult.data);
      
      // Set viewer gender
      if (viewerGenderResult.data) {
        setViewerGender(viewerGenderResult.data.gender);
      }
      
      // User can view private content if they are the profile owner or if they follow the user
      if (currentUser) {
        if (currentUser.id === userId) {
          setCanViewPrivateContent(true);
        } else if (isPrivate) {
          setCanViewPrivateContent(!!followStatusResult.data);
        } else {
          setCanViewPrivateContent(true);
        }
      }
  
      if (error) {
        console.error('Error loading user profile:', error);
        setUserProfile(null);
        return; // Exit early if there's an error
      }
      
      console.log('Raw profile data:', data); // Debug log for raw data
      
      // Fix for nested URLs in avatar_url and cover_url
      let avatarUrl = null;
      let coverUrl = null;
      
      if (data.avatar_url) {
        console.log('Avatar loading started');
        // Handle double-nested URLs by extracting just the file path
        let avatarPath = data.avatar_url;
        
        // Check if URL is nested (contains the URL twice)
        if (avatarPath.includes('media/media/')) {
          // Extract just the file path after the last 'media/'
          const parts = avatarPath.split('media/');
          avatarPath = parts[parts.length - 1];
        } else if (avatarPath.includes('media/')) {
          // For single nested URLs
          avatarPath = avatarPath.split('media/').pop();
        }
        
        // Get the public URL directly
        avatarUrl = `https://lckhaysswueoyinhfzyz.supabase.co/storage/v1/object/public/media/${avatarPath}`;
        console.log('Fixed Avatar URL:', avatarUrl);
      }
      
      if (data.cover_url) {
        console.log('Cover photo loading started');
        // Handle double-nested URLs by extracting just the file path
        let coverPath = data.cover_url;
        
        // Check if URL is nested (contains the URL twice)
        if (coverPath.includes('media/media/')) {
          // Extract just the file path after the last 'media/'
          const parts = coverPath.split('media/');
          coverPath = parts[parts.length - 1];
        } else if (coverPath.includes('media/')) {
          // For single nested URLs
          coverPath = coverPath.split('media/').pop();
        }
        
        // Get the public URL directly
        coverUrl = `https://lckhaysswueoyinhfzyz.supabase.co/storage/v1/object/public/media/${coverPath}`;
        console.log('Fixed Cover URL:', coverUrl);
      }

      const profile = {
        ...data,
        avatar_url: avatarUrl,
        cover_url: coverUrl,
        isVerified: verifiedData?.verified || false
      };
      
      setUserProfile(profile);

      // Trigger blinking animation based on gender
      if (viewerGender && profile.gender) {
        let blinkColor;
        if (profile.gender === 'third') {
          blinkColor = '#00FF00'; // Green for third gender
        } else if (viewerGender === 'male' && profile.gender === 'female') {
          blinkColor = '#FF69B4'; // Pink when male views female
        } else if (viewerGender === 'female' && profile.gender === 'male') {
          blinkColor = '#ADD8E6'; // Light blue when female views male
        }
        
        if (blinkColor) {
          createBlinkAnimation(blinkColor);
        }
      }
      
      // Cache the profile data
      const cacheKey = `${CACHE_KEYS.USER_PROFILE}_${userId}`;
      await CacheManager.set(cacheKey, {
        profile,
        followersCount: followersResult.count || 0,
        followingCount: followingResult.count || 0,
        postsCount: postsResult.count || 0,
        shortsCount: shortsResult.count || 0,
        isFollowing: !!followStatusResult.data,
        hasPrivateAccount: isPrivate,
        canViewPrivateContent: currentUser?.id === userId || (isPrivate ? !!followStatusResult.data : true)
      }, CACHE_TTL.MEDIUM);
      
      const endTime = Date.now();
      console.log(`⚡ User profile loaded in ${endTime - startTime}ms`);
      
    } catch (error) {
      console.error('Error loading user profile:', error);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  // Add the missing functions
  const renderBio = () => {
    if (!userProfile?.bio) return null;
    
    const shouldTruncate = userProfile.bio.length > 50 && !showFullBio;
    const displayBio = shouldTruncate 
      ? userProfile.bio.substring(0, 50) + '...' 
      : userProfile.bio;

    return (
      <View style={styles.bioContainer}>
        <Text style={styles.bioText}>
          {renderMentionedContent(userProfile.bio, shouldTruncate)}
          {shouldTruncate && (
            <Text 
              style={styles.moreText}
              onPress={() => setShowFullBio(true)}
            > more</Text>
          )}
        </Text>
      </View>
    );
  };

  // Implement these functions properly
    const checkFollowStatus = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.user) return;
        
        const currentUserId = sessionData.session.user.id;
        
        // Don't check follow status if viewing own profile
        if (currentUserId === userId) {
          setIsFollowing(false);
          return;
        }
        
        const { data, error } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', currentUserId)
          .eq('following_id', userId)
          .single();
          
        if (error && error.code !== 'PGRST116') {
          console.error('Error checking follow status:', error);
        }
        
        setIsFollowing(!!data);
      } catch (error) {
        console.error('Error checking follow status:', error);
      }
    };
  
    const fetchFollowersCount = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.user) return;
        
        const currentUserId = sessionData.session.user.id;

        const blockedIds = await getBlockedUserIds(currentUserId);
        
        let query = supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', userId);

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
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.user) return;

        const currentUserId = sessionData.session.user.id;
        
        const blockedIds = await getBlockedUserIds(currentUserId);

        let query = supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', userId);

        if (blockedIds.length > 0) {
          blockedIds.forEach(blockedId => {
            query = query.neq('following_id', blockedId);
          });
        }

        const { count, error } = await query;
          
        if (error) {
          console.error('Error fetching following count:', error);
        }
        else {
          setFollowingCount(count || 0);
        }
      } catch (error) {
        console.error('Error fetching following count:', error);
      }
    };

    const fetchFollowers = async () => {
      try {
        setLoadingConnections(true);
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.user) return;
        const currentUserId = sessionData.session.user.id;

        const blockedIds = await getBlockedUserIds(currentUserId);

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
          .eq('following_id', userId);

        if (blockedIds.length > 0) {
          blockedIds.forEach(blockedId => {
            query = query.neq('follower_id', blockedId);
          });
        }

        const { data, error } = await query;

        if (error) throw error;

        const followersList = data.map(item => {
          const profile = item.profiles;
          let avatarUrl = null;
          if (profile.avatar_url) {
            let avatarPath = profile.avatar_url;
            if (avatarPath.includes('media/media/') || avatarPath.includes('storage/v1/object/public/media/')) {
              const match = avatarPath.match(/([a-f0-9-]+\/avatar_[0-9]+\\.jpg)/);
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
        Alert.alert('Error', 'Failed to load followers.');
      } finally {
        setLoadingConnections(false);
      }
    };

    const fetchFollowing = async () => {
      try {
        setLoadingConnections(true);
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.user) return;
        const currentUserId = sessionData.session.user.id;

        const blockedIds = await getBlockedUserIds(currentUserId);

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
          .eq('follower_id', userId);

        if (blockedIds.length > 0) {
          blockedIds.forEach(blockedId => {
            query = query.neq('following_id', blockedId);
          });
        }

        const { data, error } = await query;

        if (error) throw error;

        const followingList = data.map(item => {
          const profile = item.profiles;
          let avatarUrl = null;
          if (profile.avatar_url) {
            let avatarPath = profile.avatar_url;
            if (avatarPath.includes('media/media/') || avatarPath.includes('storage/v1/object/public/media/')) {
              const match = avatarPath.match(/([a-f0-9-]+\/avatar_[0-9]+\\.jpg)/);
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
        Alert.alert('Error', 'Failed to load following.');
      } finally {
        setLoadingConnections(false);
      }
    };
  
    const fetchPostsCount = async () => {
      try {
        if (!userId) return;

        const { count, error } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        if (error) {
          console.error('Error fetching posts count:', error);
        } else {
          setPostsCount(count || 0);
        }
      } catch (error) {
        console.error('Error fetching posts count:', error);
      }
    };

    const fetchShortsCount = async () => {
      try {
        if (!userId) return;

        const { count, error } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
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
  
    const fetchUserContent = async () => {
      try {
        setLoadingContent(true);
        if (!userId) return;

        if (activeTab === 'Post') {
          // Fetch only posts with media (images or videos)
          const { data, error } = await supabase
            .from('posts')
            .select(`
              *,
              profiles:user_id (*),
              likes:post_likes (count),
              comments:post_comments (count),
              user_likes:post_likes (user_id)
            `)
            .eq('user_id', userId)
            .not('media_url', 'is', null)
            .order('created_at', { ascending: false });

          if (error) throw error;
          const { data: { user } } = await supabase.auth.getUser();
          const postsWithLikeStatus = data.map(post => ({
            ...post,
            is_liked: post.user_likes?.some(like => like.user_id === user?.id) || false
          }));
          setPosts(postsWithLikeStatus || []);
        } else if (activeTab === 'Tweets') {
          // Fetch only text posts (no media)
          const { data, error } = await supabase
            .from('posts')
            .select(`
              *,
              profiles:user_id (*),
              likes:post_likes (count),
              comments:post_comments (count),
              user_likes:post_likes (user_id)
            `)
            .eq('user_id', userId)
            .is('media_url', null)
            .order('created_at', { ascending: false });

          if (error) throw error;
          const { data: { user } } = await supabase.auth.getUser();
          const tweetsWithLikeStatus = data.map(post => ({
            ...post,
            is_liked: post.user_likes?.some(like => like.user_id === user?.id) || false
          }));
          setTweets(tweetsWithLikeStatus || []);
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
            .eq('user_id', userId)
            .eq('type', 'video')
            .order('created_at', { ascending: false });

          if (error) throw error;
          const { data: { user } } = await supabase.auth.getUser();
          const shortsWithLikeStatus = data.map(post => ({
            ...post,
            is_liked: post.user_likes?.some(like => like.user_id === user?.id) || false
          }));
          setShorts(shortsWithLikeStatus || []);
        }
      } catch (error) {
        console.error('Error fetching user content:', error);
      } finally {
        setLoadingContent(false);
      }
    };
  
    // Add state for follow request status
    const [followRequestStatus, setFollowRequestStatus] = useState(null); // 'pending', 'accepted', 'declined', or null
    
    // Fix the handleFollow function to handle private accounts
    const handleFollow = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.user) {
          // Redirect to login if not logged in
          navigation.navigate('Login');
          return;
        }
        
        const currentUserId = sessionData.session.user.id;
        
        // Don't allow following yourself
        if (currentUserId === userId) return;
        
        if (isFollowing) {
          // Unfollow
          const { error } = await supabase
            .from('follows')
            .delete()
            .eq('follower_id', currentUserId)
            .eq('following_id', userId);
            
          if (error) {
            console.error('Error unfollowing user:', error);
          } else {
            setIsFollowing(false);
            setFollowersCount(prev => Math.max(0, prev - 1));
            // Update canViewPrivateContent when unfollowing a private account
            if (hasPrivateAccount) {
              setCanViewPrivateContent(false);
            }
          }
        } else {
          // Check if the user has a private account
          if (hasPrivateAccount) {
            // For private accounts, navigate to PrivateProfileScreen to send follow request
            navigation.replace('PrivateProfileScreen', { userId });
            return;
          } else {
            // Follow - for public accounts
            const { error } = await supabase
              .from('follows')
              .insert({
                follower_id: currentUserId,
                following_id: userId
              });
              
            // Create a notification for the followed user
            if (!error) {
              // Get current user's profile info for the notification
              const { data: followerProfile } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', currentUserId)
                .single();
                
              if (followerProfile) {
                // Create notification using the create_notification function
                try {
                  const { data: notificationData, error: notificationError } = await supabase
                    .rpc('create_notification', {
                      p_recipient_id: userId,
                      p_sender_id: currentUserId,
                      p_type: 'follow',
                      p_content: 'started following you',
                      p_reference_id: null
                    });
                    
                  if (notificationError) {
                    console.error('Error creating follow notification:', notificationError.message, notificationError.details);
                  } else {
                    console.log('Follow notification created successfully');
                  }
                } catch (notifError) {
                  console.error('Exception creating follow notification:', notifError);
                }
              }
            }
              
            if (error) {
              console.error('Error following user:', error);
            } else {
              setIsFollowing(true);
              setFollowersCount(prev => prev + 1);
            }
          }
        }
      } catch (error) {
        console.error('Error handling follow:', error);
      }
    };
    
    // Add function to check follow request status
    const checkFollowRequestStatus = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.user) return;
        
        const currentUserId = sessionData.session.user.id;
        
        const { data, error } = await supabase
          .from('follow_requests')
          .select('status')
          .eq('sender_id', currentUserId)
          .eq('recipient_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (error) {
          console.error('Error checking follow request status:', error);
          return;
        }
        
        if (data && data.length > 0) {
          setFollowRequestStatus(data[0].status);
        } else {
          setFollowRequestStatus(null);
        }
      } catch (error) {
        console.error('Error checking follow request status:', error);
      }
    };
    
    // Add effect to check follow request status and subscribe to changes
    useEffect(() => {
      checkFollowRequestStatus();
      
      // Set up subscription for follow requests
      const followRequestsSubscription = supabase
        .channel('follow_requests_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'follow_requests', filter: `sender_id=eq.${userId} OR recipient_id=eq.${userId}` }, 
          () => {
            checkFollowRequestStatus();
          })
        .subscribe();
        
      return () => {
        supabase.removeChannel(followRequestsSubscription);
      };
    }, [userId]);
  
    // Fix the handleMessage function to navigate to MessageScreen
    const handleMessage = () => {
    // Navigate to MessageScreen instead of showing an alert
    navigation.navigate('MessageScreen', { 
      recipientId: userId,
      recipientName: userProfile?.full_name || userProfile?.username || 'User',
      recipientAvatar: userProfile?.avatar_url
    });
    };

  const handleFollowersPress = () => {
    // Check if user can view followers list
    if (hasPrivateAccount && !canViewPrivateContent) {
      Alert.alert(
        'Private Account',
        'You need to follow this account to see their followers.',
        [{ text: 'OK' }]
      );
      return;
    }
    fetchFollowers();
  };

  const handleFollowingPress = () => {
    // Check if user can view following list
    if (hasPrivateAccount && !canViewPrivateContent) {
      Alert.alert(
        'Private Account',
        'You need to follow this account to see who they follow.',
        [{ text: 'OK' }]
      );
      return;
    }
    fetchFollowing();
  };
  
  const handlePostPress = (index) => {
    console.log('Post pressed at index:', index);
    const currentPosts = activeTab === 'Post' ? memoizedPosts : 
                         activeTab === 'Tweets' ? memoizedTweets : 
                         memoizedShorts;
    const post = currentPosts[index];
    
    // If it's a video post, set the active video ID before navigating
    if (post && post.type === 'video') {
      setActiveVideo(post.id);
    }
    
    navigation.navigate('PostViewer', {
      posts: currentPosts,
      initialIndex: index,
    });
  };

  const renderGridItem = ({ item, index }) => {
    if (item.type === 'text' || !item.media_url) {
      return (
        <TouchableOpacity 
          style={[styles.gridItem, styles.textGridItem, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderWidth: 1 }]} 
          onPress={() => handlePostPress(index)}
        >
          <View style={styles.textPostContent}>
            <Text style={[styles.gridTextContent, { color: theme.textPrimary }]} numberOfLines={4}>
              {item.caption || item.content}
            </Text>
            <View style={styles.gridItemFooter}>
              <View style={styles.gridItemStats}>
                <Ionicons name="heart" size={14} color={theme.primaryAccent} />
                <Text style={[styles.gridItemStatsText, { color: theme.textSecondary }]}>{item.likes?.[0]?.count || 0}</Text>
                <Ionicons name="chatbubble" size={14} color={theme.primaryAccent} style={{ marginLeft: 8 }} />
                <Text style={[styles.gridItemStatsText, { color: theme.textSecondary }]}>{item.comments?.[0]?.count || 0}</Text>
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
              source={{ uri: item.media_url || 'https://via.placeholder.com/300' }}
              style={styles.gridImage}
              resizeMode="cover"
              play={false}
              muted={true}
              loop={false}
              controls={false}
              poster={item.media_url}
            />
            <TouchableOpacity 
              style={styles.videoIndicator}
              onPress={() => {
                setActiveVideo(item.id);
                handlePostPress(index);
              }}
            >
              <Ionicons name="play-circle" size={24} color="#fff" />
            </TouchableOpacity>
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
  
  const renderContent = () => {
    if (loadingContent) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryAccent} />
        </View>
      );
    }

    if (activeTab === 'Details') {
      return (
        <View style={styles.detailsSection}>
          <View style={styles.detailItem}>
            <Ionicons name="person-outline" size={24} color="#666" />
            <View style={styles.detailContent}>
              <Text style={styles.detailTitle}>About me</Text>
              <Text style={styles.detailText}>
                {userProfile?.bio || 'No bio added yet'}
              </Text>
            </View>
          </View>

          <View style={styles.detailItem}>
            <Ionicons name="trophy-outline" size={24} color="#FFD700" />
            <View style={styles.detailContent}>
              <Text style={styles.detailTitle}>Member Rank</Text>
              <Text style={styles.detailText}>
                {userProfile?.rank 
                  ? `Member #${userProfile.rank} on Flexx`
                  : 'Rank not assigned yet'}
              </Text>
            </View>
          </View>
        </View>
      );
    }

    const data = activeTab === 'Post' ? memoizedPosts : 
                 activeTab === 'Tweets' ? memoizedTweets : 
                 memoizedShorts;
    
    // For Tweets tab, use PostItem component instead of grid
    if (activeTab === 'Tweets') {
      return data.length > 0 ? (
        <FlatList
          data={data}
          renderItem={({ item }) => <PostItem post={item} />}
          keyExtractor={item => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          scrollEnabled={true}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No snips yet</Text>
        </View>
      );
    }
    
    // For Posts and Shorts, use grid view
    return data.length > 0 ? (
      <FlatList
        data={data}
        renderItem={renderGridItem}
        numColumns={3}
        keyExtractor={item => item.id.toString()}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
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

  // Separate component for profile header to avoid nesting ScrollView and FlatList
  // Separate component for profile header to avoid nesting ScrollView and FlatList
  const ProfileHeader = () => (
    <View style={styles.profileSection}>
      {/* Cover Photo */}
      <View style={[styles.coverPhotoContainer, { borderColor: theme.border }]}>
        {console.log('Rendering cover with URL:', userProfile?.cover_url)}
        <Image
          style={styles.coverPhoto}
          source={userProfile?.cover_url 
            ? { uri: userProfile.cover_url, cache: 'reload' } 
            : require('../../assets/defaultcover.png')
          }
          onError={(e) => {
            console.log('Cover photo error:', e.nativeEvent.error);
          }}
        />
      </View>
      
      {console.log('Rendering avatar with URL:', userProfile?.avatar_url)}
      <Image
        style={[styles.profileImage, { borderColor: theme.backgroundSolid }]}
        source={userProfile?.avatar_url 
          ? { uri: userProfile.avatar_url, cache: 'reload' } 
          : require('../../assets/defaultavatar.png')
        }
        onError={(e) => {
          console.log('Avatar photo error:', e.nativeEvent.error);
        }}
      />
      <Text style={[styles.name, { color: theme.textPrimary }]}>{userProfile?.full_name || 'No name set'}</Text>
      <View style={styles.usernameContainer}>
        <Text style={[styles.username, { color: theme.textSecondary }]}>@{userProfile?.username || 'username'}</Text>
        {userProfile?.isVerified && (
          <Ionicons name="checkmark-circle" size={20} color={theme.secondaryAccent} style={styles.verifiedBadge} />
        )}
      </View>
      <View style={[styles.rankBadge, { backgroundColor: theme.secondaryAccent + '15' }]}>
        <Ionicons name="trophy-outline" size={16} color={theme.secondaryAccent} />
        <Text style={[styles.rankNumber, { color: theme.secondaryAccent }]}>
          {userProfile?.rank 
            ? `Rank #${userProfile.rank} ${userProfile.rank === 1 ? '(First Member!)' : ''}`
            : 'Rank not assigned'}
        </Text>
      </View>
      {renderBio()}
      
      <View style={styles.buttonContainer}>
        {/* Show follow button for all accounts, but handle private accounts differently */}
        {followRequestStatus === 'pending' ? (
          <TouchableOpacity 
            style={[styles.followButton, styles.pendingButton, { backgroundColor: theme.border, borderColor: theme.border }]}
            disabled={true}
          >
            <Text style={[styles.followButtonText, { color: theme.textSecondary }]}>
              REQUEST SENT
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[
              styles.followButton,
              { backgroundColor: theme.primaryAccent },
              isFollowing ? [styles.followingButton, { backgroundColor: 'transparent', borderColor: theme.primaryAccent, borderWidth: 1 }] : {}
            ]}
            onPress={handleFollow}
          >
            <Text style={[styles.followButtonText, { color: isFollowing ? theme.primaryAccent : '#fff' }]}>
              {isFollowing ? 'FOLLOWING' : 'FOLLOW'}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={[styles.messageButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.primaryAccent }]}
          onPress={handleMessage}
        >
          <Ionicons name="chatbubble-outline" size={24} color={theme.primaryAccent} />
        </TouchableOpacity>
      </View>

      <View style={[styles.statsContainer, { borderColor: theme.border }]}>
        <View style={styles.stat}>
          <Text style={[styles.statNumber, { color: theme.textPrimary }]}>{canViewPrivateContent ? postsCount : hasPrivateAccount ? '•••' : postsCount}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Post</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statNumber, { color: theme.textPrimary }]}>{canViewPrivateContent ? shortsCount : hasPrivateAccount ? '•••' : shortsCount}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Shorts</Text>
        </View>
        <TouchableOpacity style={styles.stat} onPress={handleFollowersPress}>
          <Text style={[styles.statNumber, { color: theme.textPrimary }]}>{canViewPrivateContent ? followersCount : hasPrivateAccount ? '•••' : followersCount}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.stat} onPress={handleFollowingPress}>
          <Text style={[styles.statNumber, { color: theme.textPrimary }]}>{canViewPrivateContent ? followingCount : hasPrivateAccount ? '•••' : followingCount}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Following</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Tabs component
  const TabsSection = () => (
    <View style={[styles.tabsContainer, { borderBottomColor: theme.border }]}>
      <TouchableOpacity 
        style={[styles.tabButton, activeTab === 'Post' && [styles.activeTab, { borderBottomColor: theme.primaryAccent }]]}
        onPress={() => {
          if (hasPrivateAccount && !canViewPrivateContent) {
            Alert.alert(
              'Private Account',
              'You need to follow this account to see their posts.',
              [{ text: 'OK' }]
            );
            return;
          }
          setActiveTab('Post');
        }}
      >
        <Text style={[styles.tabButtonText, { color: activeTab === 'Post' ? theme.primaryAccent : theme.textSecondary }]}>Posts</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.tabButton, activeTab === 'Tweets' && [styles.activeTab, { borderBottomColor: theme.primaryAccent }]]}
        onPress={() => {
          if (hasPrivateAccount && !canViewPrivateContent) {
            Alert.alert(
              'Private Account',
              'You need to follow this account to see their snips.',
              [{ text: 'OK' }]
            );
            return;
          }
          setActiveTab('Tweets');
        }}
      >
        <Text style={[styles.tabButtonText, { color: activeTab === 'Tweets' ? theme.primaryAccent : theme.textSecondary }, styles.italicText]}>Snips</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.tabButton, activeTab === 'Short' && [styles.activeTab, { borderBottomColor: theme.primaryAccent }]]}
        onPress={() => {
          if (hasPrivateAccount && !canViewPrivateContent) {
            Alert.alert(
              'Private Account',
              'You need to follow this account to see their shorts.',
              [{ text: 'OK' }]
            );
            return;
          }
          setActiveTab('Short');
        }}
      >
        <Text style={[styles.tabButtonText, { color: activeTab === 'Short' ? theme.primaryAccent : theme.textSecondary }]}>Shorts</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.tabButton, activeTab === 'Details' && [styles.activeTab, { borderBottomColor: theme.primaryAccent }]]}
        onPress={() => setActiveTab('Details')}
      >
        <Text style={[styles.tabButtonText, { color: activeTab === 'Details' ? theme.primaryAccent : theme.textSecondary }]}>Details</Text>
      </TouchableOpacity>
    </View>
  );

  // Connections Modal (moved from ProfileScreen.js)
  // Connections Modal (moved from ProfileScreen.js)
  const ConnectionsModal = ({ visible, onClose, title, connections, isLoading }) => {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>{title}</Text>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primaryAccent} />
              </View>
            ) : connections.length > 0 ? (
              <FlatList
                data={connections}
                keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={[styles.connectionItem, { borderBottomColor: theme.border }]}
                    onPress={() => {
                      onClose();
                      navigation.navigate('UserProfile', { userId: item.id });
                    }}
                  >
                    <Image 
                      source={{ uri: item.avatar_url || 'https://via.placeholder.com/150' }}
                      style={styles.connectionAvatar}
                    />
                    <View style={styles.connectionInfo}>
                      <Text style={[styles.connectionName, { color: theme.textPrimary }]}>{item.full_name || 'No name'}</Text>
                      <Text style={[styles.connectionUsername, { color: theme.textSecondary }]}>@{item.username || 'username'}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                style={styles.connectionsList}
              />
            ) : (
              <View style={[styles.emptyContainer, { backgroundColor: 'transparent' }]}>
                <Ionicons name="people-outline" size={50} color={theme.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No {title.toLowerCase()} yet</Text>
              </View>
            )}
            <TouchableOpacity 
              style={[styles.closeButton, { backgroundColor: theme.primaryAccent }]}
              onPress={onClose}
            >
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // Content for Posts and Shorts tabs
  const ContentSection = () => {
    if (activeTab === 'Details') {
      return (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
          <View style={styles.detailsSection}>
            <View style={styles.detailItem}>
              <Ionicons name="person-outline" size={24} color={theme.textSecondary} />
              <View style={styles.detailContent}>
                <Text style={[styles.detailTitle, { color: theme.textPrimary }]}>About me</Text>
                <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                  {userProfile?.bio || 'No bio added yet'}
                </Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <Ionicons name="trophy-outline" size={24} color={theme.secondaryAccent} />
              <View style={styles.detailContent}>
                <Text style={[styles.detailTitle, { color: theme.textPrimary }]}>Member Rank</Text>
                <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                  {userProfile?.rank 
                    ? `Member #${userProfile.rank} on Flexx`
                    : 'Rank not assigned yet'}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      );
    }

    const data = activeTab === 'Post' ? memoizedPosts : 
                 activeTab === 'Tweets' ? memoizedTweets : 
                 memoizedShorts;
    
    if (loadingContent) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryAccent} />
        </View>
      );
    }
    
    // For Tweets tab, use list view with PostItem
    if (activeTab === 'Tweets') {
      return data.length > 0 ? (
        <FlatList
          data={data}
          renderItem={({ item }) => <PostItem post={item} />}
          keyExtractor={item => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
          ListHeaderComponent={< packageComponentHeaderPropsForTheme />}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
          <ProfileHeader />
          <TabsSection />
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No snips yet</Text>
          </View>
        </ScrollView>
      );
    }
    
    // For Posts and Shorts, use grid view
    return data.length > 0 ? (
      <FlatList
        data={data}
        renderItem={renderGridItem}
        numColumns={3}
        keyExtractor={item => item.id.toString()}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.gridContainer, { paddingBottom: insets.bottom }]}
        ListHeaderComponent={< packageComponentHeaderPropsForTheme />}
      />
    ) : (
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
        <ProfileHeader />
        <TabsSection />
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {activeTab === 'Post' ? 'No posts yet' : 'No shorts yet'}
          </Text>
        </View>
      </ScrollView>
    );
  };

  const packageComponentHeaderPropsForTheme = () => (
    <>
      <ProfileHeader />
      <TabsSection />
      {hasPrivateAccount && !canViewPrivateContent && (
        <View style={[styles.privateAccountMessage, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderWidth: 1 }]}>
          <Ionicons name="lock-closed" size={40} color={theme.primaryAccent} />
          <Text style={[styles.privateAccountTitle, { color: theme.textPrimary }]}>This Account is Private</Text>
          <Text style={[styles.privateAccountText, { color: theme.textSecondary }]}>
            {activeTab === 'Tweets' ? 'Follow this account to see their snips.' : 'Follow this account to see their posts and shorts.'}
          </Text>
        </View>
      )}
    </>
  );

  return (
    <LinearGradient colors={theme.backgrounds} style={[styles.container, { backgroundColor: theme.backgroundSolid }]}>
      <ProfileViewBlinker 
        gender={userProfile?.gender} 
        viewerGender={viewerGender} 
      />
      {/* Add back button at the top */}
      <LinearGradient
        colors={isDarkMode ? ['rgba(95, 115, 242, 0.15)', 'rgba(95, 115, 242, 0.05)', 'transparent'] : ['rgba(79, 70, 229, 0.08)', 'rgba(79, 70, 229, 0.03)', 'transparent']}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.primaryAccent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Profile</Text>
      </LinearGradient>
      
      {loading ? (
        <View style={[styles.container, { backgroundColor: 'transparent' }, styles.centered]}>
          <ActivityIndicator size="large" color={theme.primaryAccent} />
        </View>
      ) : isBlocked ? (
        <View style={[styles.container, { backgroundColor: 'transparent' }, styles.centered]}>
          <Ionicons name="ban" size={60} color={theme.error} />
          <Text style={[styles.blockedTitle, { color: theme.textPrimary }]}>Profile Unavailable</Text>
          <Text style={[styles.blockedText, { color: theme.textSecondary }]}>{blockReason}</Text>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: theme.primaryAccent }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : userProfile ? (
        activeTab === 'Details' ? (
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
            <ProfileHeader />
            <TabsSection />
            <View style={styles.detailsSection}>
              <View style={styles.detailItem}>
                <Ionicons name="person-outline" size={24} color={theme.textSecondary} />
                <View style={styles.detailContent}>
                  <Text style={[styles.detailTitle, { color: theme.textPrimary }]}>About me</Text>
                  <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                    {userProfile?.bio || 'No bio added yet'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailItem}>
                <Ionicons name="trophy-outline" size={24} color={theme.secondaryAccent} />
                <View style={styles.detailContent}>
                  <Text style={[styles.detailTitle, { color: theme.textPrimary }]}>Member Rank</Text>
                  <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                    {userProfile?.rank 
                      ? `Member #${userProfile.rank} on Flexx`
                      : 'Rank not assigned yet'}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        ) : (
          (!hasPrivateAccount || canViewPrivateContent) ? (
            <ContentSection />
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
              <ProfileHeader />
              <TabsSection />
              <View style={[styles.privateAccountMessage, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderWidth: 1 }]}>
                <Ionicons name="lock-closed" size={40} color={theme.primaryAccent} />
                <Text style={[styles.privateAccountTitle, { color: theme.textPrimary }]}>This Account is Private</Text>
                <Text style={[styles.privateAccountText, { color: theme.textSecondary }]}>Follow this account to see their posts and shorts.</Text>
              </View>
            </ScrollView>
          )
        )
      ) : (
        <View style={[styles.container, { backgroundColor: 'transparent' }, styles.centered]}>
          <Text style={[styles.errorText, { color: theme.textPrimary }]}>Could not load profile</Text>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: theme.primaryAccent }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}
      {/* Render Connections Modals */}
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
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  blinkIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    zIndex: 999,
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 200,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  detailsSection: {
    padding: 20,
  },
  detailItem: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  detailContent: {
    marginLeft: 15,
    flex: 1,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 20,
  },
  blockedTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  blockedText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 40,
  },
  backButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  backButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 200,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
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
  privateAccountMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginHorizontal: 20,
    marginVertical: 20,
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  privateAccountTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 8,
  },
  privateAccountText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
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
    borderWidth: 2,
    borderColor: '#1DA1F2',
  },
  coverPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#e3a6be',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 10,
  },
  username: {
    fontSize: 16,
    color: '#faf7f8',
    marginTop: 5,
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  verifiedBadge: {
    marginLeft: 5,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 15,
    marginTop: 5,
  },
  rankNumber: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5,
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
  mentionText: {
    color: '#00ffff',
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
  },
  followButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 30,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10, // Add margin to separate buttons
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ff00ff',
  },
  pendingButton: {
    backgroundColor: '#888',
    borderWidth: 1,
    borderColor: '#666',
  },
  followButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  messageButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ff00ff',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1a1a1a',
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    marginTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  tabButton: {
    paddingBottom: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonText: {
    color: '#faf7f8',
    fontSize: 14,
  },
  italicText: {
    fontStyle: 'italic',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#ff00ff',
  },
  activeTabText: {
    color: '#ff00ff',
  },
  detailsSection: {
    padding: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  detailContent: {
    marginLeft: 15,
    flex: 1,
  },
  detailTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  detailText: {
    color: '#faf7f8',
    fontSize: 14,
  },
  // New styles for the refactored components
  bio: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginTop: 15,
    paddingHorizontal: 20,
  },
  bioExpanded: {
    marginTop: 5,
  },
  readMoreButton: {
    marginTop: 5,
  },
  readMoreText: {
    color: '#ff00ff',
    fontWeight: 'bold',
  },
  mentionText: {
    color: '#1DA1F2', // Example color for mentions
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
  },
  connectionsList: {
    width: '100%',
    maxHeight: '70%',
    marginBottom: 20,
  },
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  connectionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  connectionUsername: {
    color: '#999',
    fontSize: 14,
  },
  closeButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 20,
  },
  closeText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default UserProfileScreen;