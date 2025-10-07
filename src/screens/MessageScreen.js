import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
  PanResponder
} from 'react-native';
import { Video } from 'expo-av';
import { Audio } from 'expo-av';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessages } from '../context/MessageContext';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { cloudinaryConfig, uploadToCloudinary } from '../config/cloudinary';
import { NotificationService } from '../services/NotificationService';

// Audio Player Component for Messages (same as CommentScreen)
const MessageAudioPlayer = ({ audioUrl, duration }) => {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const playPauseAudio = async () => {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis / 1000);
      setAudioDuration(status.durationMillis / 1000);
      
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.messageAudioPlayerContainer}>
      <TouchableOpacity onPress={playPauseAudio} style={styles.messageAudioPlayButton}>
        <Ionicons 
          name={isPlaying ? 'pause' : 'play'} 
          size={20} 
          color="#ff00ff" 
        />
      </TouchableOpacity>
      <View style={styles.messageAudioWaveform}>
        <View style={[styles.messageAudioProgress, { width: `${(position / (audioDuration || 1)) * 100}%` }]} />
      </View>
      <Text style={styles.messageAudioDuration}>
        {formatTime(position)} / {formatTime(audioDuration)}
      </Text>
    </View>
  );
};

const MessageScreen = () => {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const navigation = useNavigation();
  const route = useRoute();
  const { recipientId, recipientName = "Chat", recipientAvatar, sharePayload } = route.params;
  const flatListRef = useRef(null);
  const { markConversationAsRead, fetchUnreadCount, onlineStatus, updateCurrentUserLastActive } = useMessages();
  const recipientOnlineStatus = onlineStatus[recipientId];
  const [recipientReadReceipts, setRecipientReadReceipts] = useState(true);
  const [currentUserReadReceipts, setCurrentUserReadReceipts] = useState(true);
  
  // Use refs to prevent multiple calls
  const isMarkingAsRead = useRef(false);
  const hasMarkedOnFocus = useRef(false);
  
  // Pagination states
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const MESSAGES_PER_PAGE = 50;
  
  // Media preview states
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [previewMediaUrl, setPreviewMediaUrl] = useState(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoRef = useRef(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  
  // Voice recording states
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasAudioPermission, setHasAudioPermission] = useState(null);
  const recordingTimer = useRef(null);
  const [audioUri, setAudioUri] = useState(null);
  const [audioSound, setAudioSound] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  
  // Audio playback states
  const [playingAudio, setPlayingAudio] = useState(null);
  const [audioPositions, setAudioPositions] = useState({});
  const audioRefs = useRef({});

  // Helper function to get relative time
  const getRelativeTime = (dateString) => {
    const messageDate = new Date(dateString);
    const now = new Date();
    const diffInMs = now - messageDate;
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
    
    if (diffInHours < 24) {
      return 'Today';
    } else if (diffInDays < 7) {
      return `${Math.floor(diffInDays)} day${Math.floor(diffInDays) > 1 ? 's' : ''} ago`;
    } else if (diffInDays < 30) {
      return `${Math.floor(diffInDays / 7)} week${Math.floor(diffInDays / 7) > 1 ? 's' : ''} ago`;
    } else {
      return `${Math.floor(diffInDays / 30)} month${Math.floor(diffInDays / 30) > 1 ? 's' : ''} ago`;
    }
  };

  // Add date separators to messages
  const addDateSeparators = (messages) => {
    if (!messages || messages.length === 0) return [];
    
    const messagesWithSeparators = [];
    let lastDateGroup = null;
    
    messages.forEach((message, index) => {
      const currentDateGroup = getRelativeTime(message.created_at);
      
      // Add date separator if this is a new date group
      if (currentDateGroup !== lastDateGroup) {
        messagesWithSeparators.push({
          id: `date-separator-${index}`,
          type: 'date-separator',
          dateText: currentDateGroup,
          created_at: message.created_at
        });
        lastDateGroup = currentDateGroup;
      }
      
      messagesWithSeparators.push(message);
    });
    
    return messagesWithSeparators;
  };

  // Request audio permissions
  useEffect(() => {
    const getAudioPermissions = async () => {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        setHasAudioPermission(status === 'granted');
        
        if (status === 'granted') {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
          });
        }
      } catch (error) {
        console.error('Error requesting audio permissions:', error);
      }
    };
    
    getAudioPermissions();
  }, []);

  // Get current user and set up conversation
  useEffect(() => {
    const setupConversation = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('User not authenticated');
          navigation.navigate('Login');
          return;
        }
        
        setUserId(user.id);
        
        const participants = [user.id, recipientId].sort();
        const convId = `${participants[0]}_${participants[1]}`;
        setConversationId(convId);
        
        await loadMessages(convId, user.id);
        fetchReadReceiptsSettings(user.id, recipientId);

        // If opened with a share payload (from Reels), auto-send the reel once
        if (route?.params?.sharePayload) {
          await sendSharedReelOnce(route.params.sharePayload, user.id, recipientId, convId);
        }
      } catch (error) {
        console.error('Error setting up conversation:', error);
      }
    };
    
    setupConversation();
  }, [recipientId]);

  const hasSentShare = useRef(false);

  const sendSharedReelOnce = async (payload, currentUserId, toUserId, convId) => {
    if (hasSentShare.current) return;
    hasSentShare.current = true;
    try {
      // Payload expected: { type: 'reel'|'video'|'image'|'text'|'media', postId, media_url, caption }
      const mediaUrl = payload?.media_url || null;
      const inferredType = (() => {
        // First check explicit type from payload
        if (payload?.type === 'video' || payload?.postType === 'video') return 'video';
        if (payload?.type === 'image' || payload?.postType === 'image') return 'image';
        
        // If no media URL, it's text only
        if (!mediaUrl) return null;
        
        // Check URL patterns
        const lower = mediaUrl.toLowerCase();
        
        // Video patterns
        if (lower.includes('.mp4') || 
            lower.includes('/video/') || 
            lower.includes('video') ||
            lower.includes('res_video')) {
          return 'video';
        }
        
        // Image patterns  
        if (lower.includes('.jpg') || 
            lower.includes('.jpeg') || 
            lower.includes('.png') || 
            lower.includes('.gif') ||
            lower.includes('/image/') || 
            lower.includes('image') ||
            lower.includes('res_image')) {
          return 'image';
        }
        
        // For Cloudinary URLs without clear indicators, check resource type in URL
        if (lower.includes('cloudinary.com')) {
          // Look for resource type in URL path
          if (lower.includes('/video/upload/') || lower.includes('/video/')) return 'video';
          if (lower.includes('/image/upload/') || lower.includes('/image/')) return 'image';
          
          // If from PostItem, use the post type
          if (payload?.from === 'PostItem' && payload?.postType) {
            return payload.postType;
          }
          
          // Default Cloudinary to video since most shares are videos
          return 'video';
        }
        
        // Final fallback
        return 'video';
      })();

      const tempId = `share-${Date.now()}`;
      const newMessage = inferredType ? {
        id: tempId,
        text: payload?.caption || '',
        sender: 'me',
        sender_id: currentUserId,
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        read: false,
        media_url: mediaUrl,
        media_type: inferredType,
        cloudinary_public_id: null,
      } : {
        id: tempId,
        text: payload?.caption || '',
        sender: 'me',
        sender_id: currentUserId,
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        read: false,
        media_url: null,
        media_type: null,
        cloudinary_public_id: null,
      };

      const optimistic = [...messages, newMessage];
      setMessages(optimistic);
      await AsyncStorage.setItem(`conversation_${convId}`, JSON.stringify(optimistic));

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: convId,
          sender_id: currentUserId,
          receiver_id: toUserId,
          content: payload?.caption || '',
          media_url: inferredType ? mediaUrl : null,
          media_type: inferredType,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending shared reel:', error);
        setMessages(prev => prev.filter(m => m.id !== tempId));
        const rollback = optimistic.filter(m => m.id !== tempId);
        await AsyncStorage.setItem(`conversation_${convId}`, JSON.stringify(rollback));
      } else {
        setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, id: data.id } : m)));
        const finalized = optimistic.map(m => (m.id === tempId ? { ...m, id: data.id } : m));
        await AsyncStorage.setItem(`conversation_${convId}`, JSON.stringify(finalized));
        // Reload full conversation to ensure entire history is shown
        await loadMessages(convId, currentUserId);
      }
    } catch (e) {
      console.error('Exception sending shared reel:', e);
    }
  };

  const fetchReadReceiptsSettings = async (currentUserId, recipientUserId) => {
    try {
      const { data: currentUserData, error: currentUserError } = await supabase
        .from('user_message_settings')
        .select('show_read_receipts')
        .eq('user_id', currentUserId)
        .single();

      if (currentUserError && currentUserError.code !== 'PGRST116') {
        console.error('Error fetching current user read receipts:', currentUserError);
      } else if (currentUserData) {
        setCurrentUserReadReceipts(currentUserData.show_read_receipts);
      }

      const { data: recipientUserData, error: recipientUserError } = await supabase
        .from('user_message_settings')
        .select('show_read_receipts')
        .eq('user_id', recipientUserId)
        .single();

      if (recipientUserError && recipientUserError.code !== 'PGRST116') {
        console.error('Error fetching recipient read receipts:', recipientUserError);
      } else if (recipientUserData) {
        setRecipientReadReceipts(recipientUserData.show_read_receipts);
      }
    } catch (error) {
      console.error('Error in fetchReadReceiptsSettings:', error);
    }
  };



  // Set up focus listener
  useEffect(() => {
    if (!conversationId || !userId) return;
    
    const unsubscribe = navigation.addListener('focus', () => {
      updateCurrentUserLastActive();
      if (!hasMarkedOnFocus.current && !isMarkingAsRead.current) {
        console.log('Screen focused, marking messages as read');
        markMessagesAsReadOnce(userId, conversationId);
      }
    });
    
    // Mark messages as read when component first mounts
    if (!hasMarkedOnFocus.current && !isMarkingAsRead.current) {
      markMessagesAsReadOnce(userId, conversationId);
    }
    
    return unsubscribe;
  }, [navigation, conversationId, userId]);
  
  // Periodically update user's last active status while on message screen
  useEffect(() => {
    // Update immediately when component mounts
    updateCurrentUserLastActive();
    
    // Then update every 60 seconds
    const interval = setInterval(() => {
      updateCurrentUserLastActive();
    }, 60000); // 60 seconds
    
    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, []);

  // Reset the focus flag when leaving the screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      hasMarkedOnFocus.current = false;
    });
    
    return unsubscribe;
  }, [navigation]);

  // Set up real-time subscription
  useEffect(() => {
    if (!conversationId) return;
    
    const messageSubscription = supabase
      .channel(`messages_${conversationId}_${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        handleRealTimeUpdate(payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messageSubscription);
    };
  }, [conversationId, userId]);









  // Request permissions
  useEffect(() => {
    (async () => {
      try {
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        setHasCameraPermission(cameraStatus === 'granted');
        
        const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (mediaStatus !== 'granted') {
          Alert.alert('Permission required', 'Please allow access to your photo library to send images');
        }
      } catch (error) {
        console.error('Error requesting permissions:', error);
        setHasCameraPermission(false);
      }
    })();
  }, []);

  const markMessagesAsReadOnce = async (currentUserId, convId) => {
    try {
      const { data: settings, error: settingsError } = await supabase
        .from('user_message_settings')
        .select('show_read_receipts')
        .eq('user_id', currentUserId)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('Error fetching user settings:', settingsError);
        return;
      }

      if (settings && !settings.show_read_receipts) {
        console.log('Read receipts are disabled for the current user. Not marking messages as read.');
        return;
      }
    } catch (error) {
      console.error('Error checking read receipt setting:', error);
      return;
    }
    if (isMarkingAsRead.current) {
      console.log('Already marking messages as read, skipping...');
      return;
    }
    
    try {
      isMarkingAsRead.current = true;
      hasMarkedOnFocus.current = true;
      
      console.log('Marking messages as read for user:', currentUserId, 'in conversation:', convId);
      
      await markConversationAsRead(convId);
      
      const { data, error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('conversation_id', convId)
        .eq('receiver_id', currentUserId)
        .eq('read', false)
        .select();
        
      if (error) {
        console.error('Error marking messages as read:', error);
      } else {
        console.log('Messages marked as read:', data?.length || 0, 'messages updated');
        
        if (data && data.length > 0) {
          setMessages(prevMessages => 
            prevMessages.map(msg => {
              const updatedMsg = data.find(m => m.id === msg.id);
              if (updatedMsg) {
                return { ...msg, read: true };
              }
              return msg;
            })
          );
        }
        
        await fetchUnreadCount();
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    } finally {
      setTimeout(() => {
        isMarkingAsRead.current = false;
      }, 1000);
    }
  };
  
  const handleRealTimeUpdate = async (payload) => {
    if (payload.eventType === 'INSERT') {
      const newMessage = payload.new;
      
      // Check if the sender is blocked before processing the message
      try {
        const { data: blockedData, error: blockedError } = await supabase
          .from('blocked_users')
          .select('*')
          .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
          .eq(userId === newMessage.sender_id ? 'blocked_id' : 'blocker_id', newMessage.sender_id);
        
        if (blockedError) {
          console.error('Error checking blocked status:', blockedError);
        } else if (blockedData && blockedData.length > 0) {
          // If the sender is blocked, don't process the message
          console.log('Message from blocked user ignored');
          return;
        }
      } catch (blockCheckError) {
        console.error('Error checking blocked status:', blockCheckError);
      }
      
      const formattedMessage = {
        id: newMessage.id,
        text: newMessage.content,
        sender: newMessage.sender_id === userId ? 'me' : 'them',
        timestamp: new Date(newMessage.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        sender_id: newMessage.sender_id,
        read: newMessage.read || false,
        media_url: newMessage.media_url || null,
        media_type: newMessage.media_type || null,
        cloudinary_public_id: newMessage.cloudinary_public_id || null
      };
      
      setMessages(prevMessages => {
        const messageExists = prevMessages.some(msg => msg.id === formattedMessage.id);
        if (messageExists) {
          return prevMessages;
        }
        return [...prevMessages, formattedMessage];
      });
      
      if (newMessage.receiver_id === userId && !newMessage.read && hasMarkedOnFocus.current) {
        setTimeout(() => {
          if (!isMarkingAsRead.current) {
            markMessagesAsReadOnce(userId, conversationId);
          }
        }, 500);
      }
      
    } else if (payload.eventType === 'UPDATE') {
      const updatedMessage = payload.new;
      
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === updatedMessage.id ? 
          {
            ...msg,
            read: updatedMessage.read
          } : msg
        )
      );
    } else if (payload.eventType === 'DELETE') {
      setMessages(prevMessages => 
        prevMessages.filter(msg => msg.id !== payload.old.id)
      );
    }
  };

  const loadMessages = async (convId, currentUserId = null, page = 0, isLoadingOlder = false) => {
    let actualUserId = currentUserId || userId;
    if (!actualUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            actualUserId = user.id;
            setUserId(actualUserId);
        } else {
            console.error('User not authenticated');
            navigation.navigate('Login');
            return;
        }
    }
    
    // Check if the user is blocked
    try {
      const { data: blockedData, error: blockedError } = await supabase
        .from('blocked_users')
        .select('*')
        .or(`blocker_id.eq.${actualUserId},blocked_id.eq.${actualUserId}`)
        .eq(actualUserId === recipientId ? 'blocker_id' : 'blocked_id', actualUserId === recipientId ? userId : recipientId);
      
      if (blockedError) {
        console.error('Error checking blocked status:', blockedError);
      } else if (blockedData && blockedData.length > 0) {
        // If the current user has blocked the recipient or vice versa
        setMessages([]);
        setLoading(false);
        Alert.alert('Blocked', 'You cannot exchange messages with this user as one of you has blocked the other.');
        return;
      }
    } catch (blockCheckError) {
      console.error('Error checking blocked status:', blockCheckError);
    }

    // Set loading state for older messages
    if (isLoadingOlder) {
      setLoadingOlder(true);
    }

    // Try to load from cache first for instant loading (only for initial load)
    if (page === 0 && !isLoadingOlder) {
      try {
        const storedMessages = await AsyncStorage.getItem(`conversation_${convId}`);
        if (storedMessages) {
            const parsedMessages = JSON.parse(storedMessages);
            const updatedMessages = parsedMessages.slice(-MESSAGES_PER_PAGE).map(msg => ({
                ...msg,
                sender: msg.sender_id === actualUserId ? 'me' : 'them'
            }));
            setMessages(updatedMessages);
            setLoading(false);
            console.log('Loaded messages from cache:', updatedMessages.length);
            
            // Scroll to bottom when loading from cache
            setTimeout(() => {
              if (flatListRef.current && updatedMessages.length > 0) {
                flatListRef.current.scrollToEnd({ animated: false });
              }
            }, 100);
        }
      } catch (cacheError) {
        console.error('Error loading from cache:', cacheError);
      }
    }

    // Fetch messages from network with pagination
    try {
        const offset = page * MESSAGES_PER_PAGE;
        const { data, error, count } = await supabase
            .from('messages')
            .select('*', { count: 'exact' })
            .eq('conversation_id', convId)
            .order('created_at', { ascending: false })
            .range(offset, offset + MESSAGES_PER_PAGE - 1);

        if (error) {
            console.error('Error fetching messages:', error);
            if (!storedMessages) setLoading(false);
            return;
        }

        // Check if there are more messages to load
        setHasMoreMessages(count > offset + MESSAGES_PER_PAGE);

        let formattedMessages = data.reverse().map(msg => ({
            id: msg.id,
            text: msg.content,
            sender: msg.sender_id === actualUserId ? 'me' : 'them',
            timestamp: new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            sender_id: msg.sender_id,
            read: msg.read || false,
            media_url: msg.media_url || null,
            media_type: msg.media_type || null,
            cloudinary_public_id: msg.cloudinary_public_id || null,
            audio_url: msg.audio_url || null,
            audio_public_id: msg.audio_public_id || null,
            audio_duration: msg.audio_duration || 0,
            created_at: msg.created_at
        }));

        // Enrich shared media messages with original post owner info (username, avatar)
        try {
          const mediaUrls = Array.from(new Set(
            formattedMessages
              .filter(m => !!m.media_url)
              .map(m => m.media_url)
          ));
          if (mediaUrls.length > 0) {
            const { data: postsData, error: postsError } = await supabase
              .from('posts')
              .select('*, profiles:user_id (*)')
              .in('media_url', mediaUrls);
            if (!postsError && postsData && postsData.length > 0) {
              const urlToPostData = {};
              postsData.forEach(p => {
                urlToPostData[p.media_url] = p;
              });

              formattedMessages = formattedMessages.map(m => {
                if (m.media_url && urlToPostData[m.media_url]) {
                  const postData = urlToPostData[m.media_url];
                  return {
                    ...m,
                    post_owner_username: postData.profiles?.username || 'User',
                    post_owner_avatar: postData.profiles?.avatar_url || null,
                    original_post: postData, // Attach the full post object
                  };
                }
                return m;
              });
            }
          }
        } catch (e) {
          console.warn('Failed to enrich messages with post owner info:', e);
        }

        if (isLoadingOlder) {
          // Prepend older messages to existing ones
          setMessages(prevMessages => [...formattedMessages, ...prevMessages]);
          setCurrentPage(page);
        } else {
          // Set new messages
          if (page === 0) {
            setMessages(formattedMessages);
            setCurrentPage(0);
            
            // Always scroll to bottom for initial load (latest messages)
            setTimeout(() => {
              if (flatListRef.current && formattedMessages.length > 0) {
                flatListRef.current.scrollToEnd({ animated: false });
              }
            }, 100);
          }
        }
        
        // Update cache only for initial load
        if (!isLoadingOlder) {
          await AsyncStorage.setItem(`conversation_${convId}`, JSON.stringify(formattedMessages));
          console.log('Messages updated from network and cached:', formattedMessages.length);
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    } finally {
        setLoading(false);
        setLoadingOlder(false);
    }
  };

  // Load older messages when scrolling up
  const loadOlderMessages = async () => {
    if (loadingOlder || !hasMoreMessages) return;
    
    const nextPage = currentPage + 1;
  };

  // Start voice recording
  const startRecording = async () => {
    try {
      // Clean up any existing recording first
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
        } catch (cleanupError) {
          console.log('Cleanup error (expected):', cleanupError);
        }
        setRecording(null);
      }

      // Clean up any existing audio sound
      if (audioSound) {
        try {
          await audioSound.unloadAsync();
        } catch (cleanupError) {
          console.log('Audio cleanup error (expected):', cleanupError);
        }
        setAudioSound(null);
      }

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant microphone permission to record audio');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const recordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100,
          numberOfChannels: 1, // Changed to mono for better compatibility
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 44100,
          numberOfChannels: 1, // Changed to mono for better compatibility
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      };

      console.log('Creating recording with options:', recordingOptions);
      const { recording: newRecording } = await Audio.Recording.createAsync(
        recordingOptions,
        null,
        100 // Update interval in milliseconds
      );
      
      console.log('Recording created successfully');
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);

      // Start timer for recording duration
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      console.log('Recording started successfully');
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
      setRecording(null);
      
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
      
      Alert.alert('Recording Error', `Failed to start recording: ${error.message}. Please check microphone permissions and try again.`);
    }
  };

  // Stop voice recording (without sending)
  const stopRecording = async () => {
    if (!recording) return;

    try {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }

      setIsRecording(false);
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (uri) {
        setAudioUri(uri);
      }

      setRecording(null);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
      setRecording(null);
      setRecordingDuration(0);
    }
  };

  // Play audio preview
  const playPreview = async () => {
    try {
      if (!audioUri) return;

      if (isPlayingPreview && audioSound) {
        await audioSound.pauseAsync();
        setIsPlayingPreview(false);
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );

      setAudioSound(sound);
      setIsPlayingPreview(true);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlayingPreview(false);
        }
      });

    } catch (error) {
      console.error('Failed to play audio:', error);
      Alert.alert('Error', 'Failed to play audio');
    }
  };

  // Delete audio recording
  const deleteAudioRecording = () => {
    setAudioUri(null);
    setRecordingDuration(0);
    if (audioSound) {
      audioSound.unloadAsync();
      setAudioSound(null);
    }
  };

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Send voice message
  const sendVoiceMessage = async (audioUri, duration) => {
    try {
      if (!userId || !conversationId) {
        console.error('Missing user ID or conversation ID');
        return;
      }

      // Upload audio to Cloudinary
      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: `voice_${Date.now()}.m4a`,
      });
      formData.append('upload_preset', 'connect_app_preset');

      const cloudinaryResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const cloudinaryData = await cloudinaryResponse.json();
      
      if (!cloudinaryData.secure_url) {
        throw new Error('Failed to upload audio');
      }

      const tempId = Date.now().toString();
      const newMessage = {
        id: tempId,
        text: `🎤 Voice message (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})`,
        sender: 'me',
        sender_id: userId,
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        read: false,
        audio_url: cloudinaryData.secure_url,
        audio_public_id: cloudinaryData.public_id,
        audio_duration: duration,
        created_at: new Date().toISOString()
      };

      const updatedMessages = [...messages, newMessage];
      setMessages(updatedMessages);

      // Update cache immediately
      await AsyncStorage.setItem(`conversation_${conversationId}`, JSON.stringify(updatedMessages));

      // Scroll to bottom after sending
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: false });
        }
      }, 100);

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          receiver_id: recipientId,
          content: newMessage.text,
          audio_url: cloudinaryData.secure_url,
          audio_public_id: cloudinaryData.public_id,
          audio_duration: duration,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending voice message:', error);
        // Remove failed message
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
        const failedMessages = messages.filter(msg => msg.id !== tempId);
        await AsyncStorage.setItem(`conversation_${conversationId}`, JSON.stringify(failedMessages));
      } else {
        // Update message with real ID
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === tempId ? { ...msg, id: data.id } : msg
          )
        );

        const finalMessages = updatedMessages.map(msg => 
          msg.id === tempId ? { ...msg, id: data.id } : msg
        );
        await AsyncStorage.setItem(`conversation_${conversationId}`, JSON.stringify(finalMessages));
      }
    } catch (error) {
      console.error('Error sending voice message:', error);
      Alert.alert('Error', 'Failed to send voice message. Please try again.');
    }
  };

  // Audio playback functions
  const playAudio = async (messageId, audioUrl) => {
    try {
      // Stop any currently playing audio
      if (playingAudio && playingAudio !== messageId) {
        await stopAudio(playingAudio);
      }

      if (playingAudio === messageId) {
        // If same audio is playing, pause it
        await stopAudio(messageId);
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );

      audioRefs.current[messageId] = sound;
      setPlayingAudio(messageId);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setAudioPositions(prev => ({
            ...prev,
            [messageId]: {
              position: status.positionMillis,
              duration: status.durationMillis
            }
          }));

          if (status.didJustFinish) {
            setPlayingAudio(null);
            sound.unloadAsync();
            delete audioRefs.current[messageId];
          }
        }
      });
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Failed to play voice message');
    }
  };

  const stopAudio = async (messageId) => {
    try {
      const sound = audioRefs.current[messageId];
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        delete audioRefs.current[messageId];
      }
      setPlayingAudio(null);
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
  };

  // Format audio duration
  const formatAudioDuration = (milliseconds) => {
    if (!milliseconds) return '0:00';
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderMessageWithSeparator = ({ item }) => {
    if (!item) return null;
    
    // Render date separator
    if (item.type === 'date-separator') {
      return (
        <View style={styles.dateSeparatorContainer}>
          <View style={styles.dateSeparatorLine} />
          <Text style={styles.dateSeparatorText}>{item.dateText}</Text>
          <View style={styles.dateSeparatorLine} />
        </View>
      );
    }

    // Use the existing renderMessage function for regular messages
    return renderMessage({ item });
  };

  const sendMessage = async () => {
    if (!inputText.trim() && !audioUri) return;
    
    // If there's audio, send it as voice message
    if (audioUri) {
      await sendVoiceMessage(audioUri, recordingDuration);
      deleteAudioRecording();
      return;
    }
    
    try {
      if (!userId || !conversationId) {
        console.error('Missing user ID or conversation ID');
        return;
      }
      
      // Check if the user is blocked before sending a message
      const { data: blockedData, error: blockedError } = await supabase
        .from('blocked_users')
        .select('*')
        .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
        .eq(userId === recipientId ? 'blocker_id' : 'blocked_id', userId === recipientId ? userId : recipientId);
      
      if (blockedError) {
        console.error('Error checking blocked status:', blockedError);
      } else if (blockedData && blockedData.length > 0) {
        // If the current user has blocked the recipient or vice versa
        Alert.alert('Blocked', 'You cannot send messages to this user as one of you has blocked the other.');
        return;
      }
      
      const tempId = Date.now().toString();
      const newMessage = { 
        id: tempId, 
        text: inputText,
        sender: 'me',
        sender_id: userId,
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        read: false,
        media_url: null,
        media_type: null,
        cloudinary_public_id: null
      };
      
      const updatedMessages = [...messages, newMessage];
      setMessages(updatedMessages);
      setInputText('');
      
      // Update cache immediately
      await AsyncStorage.setItem(`conversation_${conversationId}`, JSON.stringify(updatedMessages));
      
      // Scroll to bottom after sending
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: false });
        }
      }, 100);
      
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          receiver_id: recipientId,
          content: inputText,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        console.error('Error sending message:', error);
        // Remove failed message
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
        // Update cache
        const failedMessages = messages.filter(msg => msg.id !== tempId);
        await AsyncStorage.setItem(`conversation_${conversationId}`, JSON.stringify(failedMessages));
      } else {
        // Update message with real ID
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === tempId ? { ...msg, id: data.id } : msg
          )
        );
        
        // Update cache with real ID
        const finalMessages = updatedMessages.map(msg => 
          msg.id === tempId ? { ...msg, id: data.id } : msg
        );
        await AsyncStorage.setItem(`conversation_${conversationId}`, JSON.stringify(finalMessages));
        
        // Send push notification to recipient
        try {
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', userId)
            .single();
          
          const senderName = senderProfile?.username || 'Someone';
          await NotificationService.sendMessageNotification(recipientId, senderName, inputText);
        } catch (notificationError) {
          console.log('Error sending notification:', notificationError);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const deleteMessage = React.useCallback(async (messageId, cloudinaryPublicId, mediaType) => {
    try {
      const messageToDelete = messages.find(msg => msg.id === messageId);
      if (!messageToDelete || messageToDelete.sender_id !== userId) {
        console.error('Cannot delete message: not authorized');
        Alert.alert('Error', 'You can only delete your own messages');
        return;
      }

      // Show loading alert for media deletion
      if (messageToDelete.media_url) {
        Alert.alert('Deleting', 'Deleting message and media, please wait...');
      }

      // Delete the message from Supabase first
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', userId);

      if (deleteError) {
        console.error('Error deleting message from database:', deleteError);
        Alert.alert('Error', 'Failed to delete message');
        return;
      }

      // Delete media from Cloudinary if it exists
      if (cloudinaryPublicId) {
        try {
          const { deleteFromCloudinary } = await import('../config/cloudinary');
          await deleteFromCloudinary(
            cloudinaryPublicId, 
            mediaType || 'image'
          );
          console.log('Deleted media from Cloudinary:', cloudinaryPublicId);
        } catch (mediaError) {
          console.error('Error deleting media from Cloudinary:', mediaError);
          // Continue with message deletion even if media deletion fails
        }
      }

      // Update local state
      const updatedMessages = messages.filter(msg => msg.id !== messageId);
      setMessages(updatedMessages);

      // Update AsyncStorage cache
      await AsyncStorage.setItem(`conversation_${conversationId}`, JSON.stringify(updatedMessages));
      
      console.log('Message deleted successfully');
      
    } catch (error) {
      console.error('Error deleting message:', error);
      Alert.alert('Error', 'Failed to delete message');
    }
  }, [messages, userId, conversationId]);

  const handleMediaPick = async (type) => {
    try {
      const options = {
        mediaTypes: type === 'photo' ? 
          ImagePicker.MediaTypeOptions.Images : 
          ImagePicker.MediaTypeOptions.Videos,
        quality: 0.7,
        allowsEditing: true
      };

      const result = await ImagePicker.launchImageLibraryAsync(options);
      
      if (!result.canceled) {
        setShowMediaPicker(false);
        Alert.alert('Uploading', 'Uploading media, please wait...');
        
        try {
          const { uploadToCloudinary } = await import('../config/cloudinary');
          
          const mediaType = type === 'photo' ? 'image' : 'video';
          const uploadResult = await uploadToCloudinary(result.assets[0].uri, mediaType);
          
          if (!uploadResult || !uploadResult.url) {
            throw new Error('Failed to upload media');
          }
          
          const tempId = Date.now().toString();
          const newMessage = { 
            id: tempId, 
            text: '',
            media_url: uploadResult.url,
            media_type: mediaType,
            sender: 'me',
            sender_id: userId,
            timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            read: false,
            cloudinary_public_id: uploadResult.publicId
          };
          
          const updatedMessages = [...messages, newMessage];
          setMessages(updatedMessages);
          
          await AsyncStorage.setItem(`conversation_${conversationId}`, JSON.stringify(updatedMessages));
          
          const { data, error } = await supabase
            .from('messages')
            .insert({
              conversation_id: conversationId,
              sender_id: userId,
              receiver_id: recipientId,
              content: '',
              media_url: uploadResult.url,
              media_type: mediaType,
              cloudinary_public_id: uploadResult.publicId,
              created_at: new Date().toISOString()
            })
            .select()
            .single();
            
          if (error) {
            console.error('Error sending media message:', error);
            setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
            Alert.alert('Error', 'Failed to send media message');
          } else {
            setMessages(prevMessages => 
              prevMessages.map(msg => 
                msg.id === tempId ? { ...msg, id: data.id } : msg
              )
            );
            
            const finalMessages = updatedMessages.map(msg => 
              msg.id === tempId ? { ...msg, id: data.id } : msg
            );
            await AsyncStorage.setItem(`conversation_${conversationId}`, JSON.stringify(finalMessages));
          }
        } catch (uploadError) {
          console.error('Error uploading media:', uploadError);
          Alert.alert('Error', 'Failed to upload media: ' + uploadError.message);
        }
      } else {
        setShowMediaPicker(false);
      }
    } catch (error) {
      console.error('Error picking media:', error);
      Alert.alert('Error', 'Failed to pick media');
      setShowMediaPicker(false);
    }
  };

  const handleCameraCapture = async (cameraType = 'back') => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        cameraType: cameraType
      });
      
      if (!result.canceled) {
        Alert.alert('Uploading', 'Uploading photo, please wait...');
        
        try {
          const { uploadToCloudinary } = await import('../config/cloudinary');
          const uploadResult = await uploadToCloudinary(result.assets[0].uri, 'image');
          
          if (!uploadResult || !uploadResult.url) {
            throw new Error('Failed to upload photo');
          }
          
          const tempId = Date.now().toString();
          const newMessage = { 
            id: tempId, 
            text: '',
            media_url: uploadResult.url,
            media_type: 'image',
            sender: 'me',
            sender_id: userId,
            timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            read: false,
            cloudinary_public_id: uploadResult.publicId
          };
          
          const updatedMessages = [...messages, newMessage];
          setMessages(updatedMessages);
          
          await AsyncStorage.setItem(`conversation_${conversationId}`, JSON.stringify(updatedMessages));
          
          const { data, error } = await supabase
            .from('messages')
            .insert({
              conversation_id: conversationId,
              sender_id: userId,
              receiver_id: recipientId,
              content: '',
              media_url: uploadResult.url,
              media_type: 'image',
              cloudinary_public_id: uploadResult.publicId,
              created_at: new Date().toISOString()
            })
            .select()
            .single();
            
          if (error) {
            console.error('Error sending photo message:', error);
            setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
            Alert.alert('Error', 'Failed to send photo message');
          } else {
            setMessages(prevMessages => 
              prevMessages.map(msg => 
                msg.id === tempId ? { ...msg, id: data.id } : msg
              )
            );
            
            const finalMessages = updatedMessages.map(msg => 
              msg.id === tempId ? { ...msg, id: data.id } : msg
            );
            await AsyncStorage.setItem(`conversation_${conversationId}`, JSON.stringify(finalMessages));
          }
        } catch (uploadError) {
          console.error('Error uploading photo:', uploadError);
          Alert.alert('Error', 'Failed to upload photo: ' + uploadError.message);
        }
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture');
    }
  };

  const handleLongPress = React.useCallback((item) => {
    console.log('Long press detected for message:', item.id, 'sender_id:', item.sender_id, 'current userId:', userId);
    
    if (item.sender_id === userId) {
      const messageType = item.media_url ? 
        (item.media_type === 'video' ? 'video' : 'photo') : 
        'message';
      
      Alert.alert(
        `Delete ${messageType}`,
        `Are you sure you want to delete this ${messageType}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive', 
            onPress: () => deleteMessage(item.id, item.cloudinary_public_id, item.media_type) 
          }
        ],
        { cancelable: true }
      );
    } else {
      console.log('Cannot delete message: not the sender');
    }
  }, [userId, deleteMessage]);

  // Memoized message item component to prevent unnecessary re-renders
  const MessageItem = React.memo(({ item, onLongPress, onMediaPress, recipientReadReceipts }) => {
    return (
      <View style={[
        styles.messageBubble,
        item.sender === 'me' ? styles.myMessage : styles.theirMessage,
      ]}>
        <LinearGradient
          colors={item.sender === 'me' ? ['#333', '#222'] : ['#ff00ff', '#9900ff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.messageBubbleGradient}
        >
          {/* Shared post owner header (for media shares) */}
          {item.media_url && (item.post_owner_username || item.post_owner_avatar) ? (
            <View style={styles.sharedHeader}>
              <Image 
                source={{ uri: item.post_owner_avatar || 'https://via.placeholder.com/24' }} 
                style={styles.sharedAvatar}
              />
              <Text style={styles.sharedUsername}>@{item.post_owner_username || 'user'}</Text>
            </View>
          ) : null}

          {item.text && !item.audio_url ? (
            <TouchableOpacity
              onLongPress={() => onLongPress(item)}
              onPress={() => {
                // Check if this is a shared post or confession
                if (item.text.startsWith('📝 Shared post from') || item.text.startsWith('🤫 Shared confession from')) {
                  // Extract username and content for shared text posts
                  const usernameMatch = item.text.match(/@(\w+):/);
                  const username = usernameMatch ? usernameMatch[1] : 'Unknown User';
                  
                  // Extract post ID, source, and entity info from hidden metadata
                  const postIdMatch = item.text.match(/\u200B\[PostID:([^\]]+)\]/);
                  const fromMatch = item.text.match(/\u200B\[From:([^\]]+)\]/);
                  const personIdMatch = item.text.match(/\u200B\[PersonID:([^\]]+)\]/);
                  const locationIdMatch = item.text.match(/\u200B\[LocationID:([^\]]+)\]/);
                  
                  const postId = postIdMatch ? postIdMatch[1] : null;
                  const fromSource = fromMatch ? fromMatch[1] : null;
                  const personId = personIdMatch ? personIdMatch[1] : null;
                  const locationId = locationIdMatch ? locationIdMatch[1] : null;
                  
                  // Navigate based on the source and post ID
                  if (postId && fromSource) {
                    if (fromSource === 'Confession' && locationId) {
                      // Navigate to Confession screen with specific location and post ID
                      navigation.navigate('Confession', { 
                        selectedConfessionId: postId,
                        locationId: locationId
                      });
                    } else if (fromSource === 'ConfessionPerson' && personId) {
                      // Navigate to ConfessionPerson screen with specific person and post ID
                      navigation.navigate('ConfessionPerson', { 
                        selectedConfessionId: postId,
                        personId: personId
                      });
                    } else {
                      // For regular posts, navigate to PhotoTextViewer
                      const content = item.text.split(':\n\n')[1]?.split('\n\n[PostID:')[0] || item.text;
                      const mockPost = {
                        id: postId,
                        caption: content,
                        user_id: 'shared',
                        profiles: {
                          username: username,
                          avatar_url: null
                        },
                        media_url: null,
                        type: 'text',
                        isSharedPost: true
                      };
                      
                      navigation.navigate('PhotoTextViewer', {
                        posts: [mockPost],
                        initialIndex: 0
                      });
                    }
                  } else {
                    // Fallback for older shared messages without post ID
                    if (username === 'Anonymous') {
                      navigation.navigate('Confession');
                    } else if (username !== 'Unknown User') {
                      navigation.navigate('ConfessionPerson');
                    }
                  }
                }
              }}
              delayLongPress={500}
              style={[
                styles.textMessageContainer,
                item.text.startsWith('📝 Shared post from') && styles.sharedConfessionContainer
              ]}
            >
{item.text.startsWith('📝 Shared post from') || item.text.startsWith('🤫 Shared confession from') || item.text.startsWith('✨ Shared by') || item.text.startsWith('💎 Shared by') ? (
                (() => {
                  // Clean the text by removing hidden metadata
                  const cleanText = item.text.replace(/\u200B\[PostID:[^\]]+\]/g, '')
                                            .replace(/\u200B\[From:[^\]]+\]/g, '')
                                            .replace(/\u200B\[PersonID:[^\]]+\]/g, '')
                                            .replace(/\u200B\[LocationID:[^\]]+\]/g, '');
                  
                  if (item.text.startsWith('🤫 Shared confession from')) {
                    // This is a confession
                    return (
                      <View style={styles.premiumSharedContent}>
                        <LinearGradient
                          colors={['#1a1a2e', '#16213e', '#0f3460']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.premiumGradient}
                        >
                          <View style={styles.premiumHeader}>
                            <View style={styles.confessionBadge}>
                              <Text style={styles.confessionBadgeText}>🤫 CONFESSION</Text>
                            </View>
                          </View>
                          <Text style={styles.premiumSharedText}>{cleanText}</Text>
                          <View style={styles.premiumFooter}>
                            <View style={styles.tapIndicator}>
                              <Ionicons name="diamond-outline" size={12} color="#ffd700" />
                              <Text style={styles.tapIndicatorText}>Tap to view</Text>
                            </View>
                          </View>
                        </LinearGradient>
                      </View>
                    );
                  } else if (item.text.startsWith('✨ Shared by') || item.text.startsWith('💎 Shared by')) {
                    // This is a premium shared post
                    const isMedia = item.text.startsWith('✨');
                    return (
                      <View style={styles.premiumSharedContent}>
                        <LinearGradient
                          colors={isMedia ? ['#ff6b6b', '#ee5a24', '#e55039'] : ['#9c88ff', '#8c7ae6', '#7158e2']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.premiumGradient}
                        >
                          <View style={styles.premiumHeader}>
                            <View style={styles.postBadge}>
                              <Text style={styles.postBadgeText}>{isMedia ? '✨ MEDIA' : '💎 POST'}</Text>
                            </View>
                          </View>
                          <Text style={styles.premiumSharedText}>{cleanText}</Text>
                          <View style={styles.premiumFooter}>
                            <View style={styles.tapIndicator}>
                              <Ionicons name="diamond-outline" size={12} color="#ffd700" />
                              <Text style={styles.tapIndicatorText}>Tap to view</Text>
                            </View>
                          </View>
                        </LinearGradient>
                      </View>
                    );
                  } else {
                    // Legacy shared post format
                    return (
                      <View style={styles.premiumSharedContent}>
                        <LinearGradient
                          colors={['#667eea', '#764ba2']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.premiumGradient}
                        >
                          <Text style={styles.premiumSharedText}>{cleanText}</Text>
                          <View style={styles.premiumFooter}>
                            <View style={styles.tapIndicator}>
                              <Ionicons name="diamond-outline" size={12} color="#ffd700" />
                              <Text style={styles.tapIndicatorText}>Tap to view</Text>
                            </View>
                          </View>
                        </LinearGradient>
                      </View>
                    );
                  }
                })()
              ) : (
                <Text style={styles.messageText}>{item.text}</Text>
              )}
            </TouchableOpacity>
          ) : null}
          
          {item.media_url ? (
            <TouchableOpacity
              onLongPress={() => onLongPress(item)}
              onPress={() => {
                if (item.media_type === 'video') {
                  // Create a mock post object for ShortsScreen
                  const mockPost = item.original_post || {
                    id: `message_${item.id}`,
                    media_url: item.media_url,
                    type: 'video',
                    caption: item.text || '',
                    user_id: item.sender_id,
                    created_at: new Date().toISOString(),
                    profiles: {
                      username: item.post_owner_username || (item.sender === 'me' ? 'You' : recipientName),
                      avatar_url: item.post_owner_avatar || recipientAvatar
                    },
                    shouldAutoPlay: true
                  };
                  
                  // Navigate to ReelsScreen with the mock post and auto-play enabled
                  navigation.navigate('Reels', {
                    initialPost: mockPost,
                    autoPlay: true,
                    fromMessage: true
                  });
                } else if (item.media_type === 'image') {
                  // Use existing media press handler for images
                  onMediaPress(item.media_url, item.media_type);
                }
              }}
              delayLongPress={500}
              style={styles.mediaContainer}
            >
              {item.media_type === 'video' ? (
                <View style={styles.videoContainer}>
                  <Video
                    source={{ uri: item.media_url }}
                    style={styles.messageVideo}
                    resizeMode="cover"
                    shouldPlay={false}
                    useNativeControls={false}
                    isLooping={false}
                    onError={(error) => {
                      console.error('Video error in message:', error);
                    }}
                    onLoadStart={() => {
                      console.log('Video loading started for:', item.media_url);
                    }}
                    onLoad={async (status) => {
                      console.log('Video loaded successfully:', status);
                      // Seek to 1 second after load for thumbnail
                      try {
                        if (status.isLoaded) {
                          await status.setPositionAsync(1000);
                        }
                      } catch (error) {
                        console.warn('Error seeking video for thumbnail:', error);
                      }
                    }}
                  />
                  <View style={styles.videoOverlay}>
                    <Ionicons name="play-circle" size={50} color="rgba(255, 255, 255, 0.8)" />
                  </View>
                </View>
              ) : item.media_type === 'audio' ? (
                <View style={styles.audioMessageContainer}>
                  <TouchableOpacity
                    style={styles.audioPlayButton}
                    onPress={() => playAudio(item.id, item.media_url)}
                  >
                    <Ionicons 
                      name={playingAudio === item.id ? "pause" : "play"} 
                      size={20} 
                      color="#fff" 
                    />
                  </TouchableOpacity>
                  <View style={styles.audioWaveform}>
                    <Text style={styles.audioWaveformText}>
                      {playingAudio === item.id ? "Playing..." : "🎤 Voice message"}
                    </Text>
                  </View>
                  <Text style={styles.audioDuration}>
                    {audioPositions[item.id] 
                      ? formatAudioDuration(audioPositions[item.id].position)
                      : (item.audio_duration 
                          ? `${Math.floor(item.audio_duration / 60)}:${(item.audio_duration % 60).toString().padStart(2, '0')}`
                          : '0:00'
                        )
                    }
                  </Text>
                </View>
              ) : (
                <Image 
                  source={{ uri: item.media_url }} 
                  style={styles.messageImage}
                  resizeMode="cover"
                />
              )}
            </TouchableOpacity>
          ) : null}
          
          {/* Audio Message Player (for new audio_url field) */}
          {item.audio_url ? (
            <MessageAudioPlayer 
              audioUrl={item.audio_url} 
              duration={item.audio_duration || 0}
            />
          ) : null}
          
          <View style={styles.messageFooter}>
            <Text style={styles.timestamp}>{item.timestamp}</Text>
            {item.sender === 'me' && currentUserReadReceipts && (
              <View style={styles.readStatus}>
                <Ionicons 
                  name={item.read && recipientReadReceipts ? "checkmark-done" : "checkmark"} 
                  size={14} 
                  color={item.read && recipientReadReceipts ? "#34aadc" : "rgba(255, 255, 255, 0.5)"} 
                />
              </View>
            )}
          </View>
        </LinearGradient>
      </View>
    );
  });

  const renderMessage = React.useCallback(({ item }) => {
    return (
      <MessageItem 
        item={item} 
        recipientReadReceipts={recipientReadReceipts}
        onLongPress={handleLongPress}
        onMediaPress={(url, type) => {
          setPreviewMediaUrl(url);
          if (type === 'video') {
            setPreviewVideoUrl(url);
            setVideoPlaying(false);
            setVideoLoaded(false);
            setShowVideoPreview(true);
          } else {
            setShowImagePreview(true);
          }
        }}
      />
    );
  }, [recipientReadReceipts, handleLongPress]);

  const getDisplayName = () => {
    if (recipientName && recipientName !== "User") {
      return recipientName;
    }
    return "Chat";
  };

  const formatLastActive = (lastActive) => {
    // Handle null, undefined, or empty array cases
    if (!lastActive || Array.isArray(lastActive)) {
      console.log('Invalid lastActive value:', lastActive, 'Type:', typeof lastActive, 'Is Array:', Array.isArray(lastActive));
      return '';
    }

    if (lastActive === 'online') {
      return 'Active now';
    }

    const now = new Date();
    const lastActiveDate = new Date(lastActive);

    if (isNaN(lastActiveDate.getTime())) {
      console.error('Invalid date format for lastActive:', lastActive, 'Type:', typeof lastActive);
      return '';
    }

    const diffInSeconds = Math.floor((now - lastActiveDate) / 1000);

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInDays > 0) {
      return `Last seen on ${lastActiveDate.toLocaleDateString()}`;
    } else if (diffInHours > 0) {
      return `Last seen ${diffInHours}h ago`;
    } else if (diffInMinutes > 0) {
      return `Last seen ${diffInMinutes}m ago`;
    } else {
      return 'Last seen just now';
    }
  };

  const MediaPickerModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showMediaPicker}
      onRequestClose={() => setShowMediaPicker(false)}
    >
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
        <View style={styles.mediaPickerContainer}>
          <TouchableOpacity 
            style={styles.mediaOption} 
            onPress={() => handleMediaPick('photo')}
          >
            <MaterialCommunityIcons name="image" size={32} color="#ff00ff" />
            <Text style={styles.mediaOptionText}>Photo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.mediaOption} 
            onPress={() => handleMediaPick('video')}
          >
            <MaterialCommunityIcons name="video" size={32} color="#ff00ff" />
            <Text style={styles.mediaOptionText}>Video</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.mediaOption} 
            onPress={() => {
              setShowMediaPicker(false);
              handleCameraCapture('back');
            }}
          >
            <MaterialCommunityIcons name="camera" size={32} color="#ff00ff" />
            <Text style={styles.mediaOptionText}>Rear Camera</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.mediaOption} 
            onPress={() => {
              setShowMediaPicker(false);
              handleCameraCapture('front');
            }}
          >
            <MaterialCommunityIcons name="camera-front" size={32} color="#ff00ff" />
            <Text style={styles.mediaOptionText}>Selfie Camera</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.mediaOption, { backgroundColor: '#333' }]} 
            onPress={() => setShowMediaPicker(false)}
          >
            <MaterialCommunityIcons name="close" size={32} color="#ff00ff" />
            <Text style={styles.mediaOptionText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <LinearGradient colors={['#0a0a2a', '#1a1a3a']} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.container}>
            <StatusBar style="light" />
            
            <LinearGradient
              colors={['#1a1a1a', '#000']}
              style={[styles.header, { paddingTop: insets.top }]}
            >
              <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              
              <View style={styles.profileInfo}>
                <Image 
                  source={{ uri: recipientAvatar || 'https://via.placeholder.com/40' }} 
                  style={styles.avatar} 
                />
                <TouchableOpacity onPress={() => navigation.navigate('MessageSettings', { recipientId, recipientName })}>
                <View>
                  <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">{getDisplayName()}</Text>
                  {recipientOnlineStatus ? (
                    <Text style={styles.onlineStatusText}>
                      {formatLastActive(recipientOnlineStatus)}
                    </Text>
                  ) : (
                    <Text style={styles.onlineStatusText}>Flexx</Text>
                  )}
                </View>
              </TouchableOpacity>
              </View>
              
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.headerButton}>
                  <Ionicons name="call-outline" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerButton}>
                  <Ionicons name="videocam-outline" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <FlatList
              ref={flatListRef}
              data={addDateSeparators(messages)}
              keyExtractor={React.useCallback((item) => `message-${item.id.toString()}`, [])}
              renderItem={renderMessageWithSeparator}
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
              removeClippedSubviews={Platform.OS !== 'web'}
              maxToRenderPerBatch={10}
              initialNumToRender={15}
              windowSize={21}
              updateCellsBatchingPeriod={50}
              inverted={false}
              showsVerticalScrollIndicator={true}
              maintainVisibleContentPosition={{
                minIndexForVisible: 0,
                autoscrollToTopThreshold: 10,
              }}
              onScroll={({ nativeEvent }) => {
                const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
                // Check if user scrolled to top (with some threshold)
                if (contentOffset.y <= 50 && hasMoreMessages && !loadingOlder) {
                  loadOlderMessages();
                }
              }}
              scrollEventThrottle={400}
              onContentSizeChange={() => {
                // Always scroll to bottom when content changes (new messages or initial load)
                if (messages.length > 0) {
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: false });
                  }, 50);
                }
              }}
              onLayout={() => {
                // Always scroll to bottom on layout (when navigating to chat)
                if (messages.length > 0) {
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: false });
                  }, 50);
                }
              }}
              ListHeaderComponent={
                loadingOlder ? (
                  <View style={styles.loadingOlderContainer}>
                    <ActivityIndicator size="small" color="#3399ff" />
                    <Text style={styles.loadingOlderText}>Loading older messages...</Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                !loading ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No messages yet</Text>
                    <Text style={styles.emptySubtext}>Start a conversation!</Text>
                  </View>
                ) : (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#3399ff" />
                    <Text style={styles.loadingText}>Loading messages...</Text>
                  </View>
                )
              }
            />

            <LinearGradient
              colors={['#1a1a3a', '#0d0d2a']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={[styles.inputContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}
            >
              {/* Audio Recording Preview */}
              {audioUri && !isRecording && (
                <View style={styles.audioPreviewContainer}>
                  <TouchableOpacity onPress={playPreview} style={styles.audioPreviewButton}>
                    <Ionicons 
                      name={isPlayingPreview ? 'pause-circle' : 'play-circle'} 
                      size={32} 
                      color="#ff00ff" 
                    />
                  </TouchableOpacity>
                  <View style={styles.audioPreviewInfo}>
                    <Text style={styles.audioPreviewText}>Audio recorded</Text>
                    <Text style={styles.audioPreviewDuration}>{formatDuration(recordingDuration)}</Text>
                  </View>
                  <TouchableOpacity onPress={deleteAudioRecording} style={styles.audioDeleteButton}>
                    <Ionicons name="trash-outline" size={20} color="#ff4444" />
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Recording Indicator */}
              {isRecording && (
                <View style={styles.recordingIndicatorBanner}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>Recording... {formatDuration(recordingDuration)}</Text>
                </View>
              )}
              
              <View style={styles.inputWrapper}>
                <TouchableOpacity onPress={() => setShowMediaPicker(true)}>
                  <LinearGradient
                    colors={['#00ffff', '#0099ff']}
                    style={styles.mediaButton}
                  >
                    <Ionicons name="attach" size={24} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={isRecording ? stopRecording : startRecording}
                  style={styles.audioButtonWrapper}
                  disabled={inputText.trim().length > 0}
                >
                  <Ionicons 
                    name={isRecording ? 'stop' : 'mic'} 
                    size={24} 
                    color={isRecording ? '#ff4444' : (inputText.trim() ? '#666' : '#ff00ff')} 
                  />
                </TouchableOpacity>
                
                <TextInput
                  style={styles.input}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Type a message..."
                  placeholderTextColor="#8e8e8e"
                  multiline
                  editable={!isRecording}
                />
                
                <TouchableOpacity 
                  onPress={sendMessage}
                  disabled={(!inputText.trim() && !audioUri) || isRecording}
                >
                  <LinearGradient
                    colors={(inputText.trim() || audioUri) ? ['#ff00ff', '#9900ff'] : ['#666', '#444']}
                    style={styles.sendButton}
                  >
                    <Ionicons name="send" size={24} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <MediaPickerModal />
            
            {/* Image Preview Modal */}
            <Modal
              visible={showImagePreview}
              transparent={false}
              animationType="fade"
              onRequestClose={() => setShowImagePreview(false)}
            >
              <View style={styles.previewContainer}>
                <LinearGradient
                  colors={['#1a1a1a', '#000']}
                  style={styles.previewGradient}
                >
                  <TouchableOpacity 
                    style={styles.previewCloseButton}
                    onPress={() => setShowImagePreview(false)}
                  >
                    <Ionicons name="close" size={28} color="#fff" />
                  </TouchableOpacity>
                  
                  <Image
                    source={{ uri: previewMediaUrl }}
                    style={styles.previewImage}
                    resizeMode="contain"
                  />
                </LinearGradient>
              </View>
            </Modal>
            
            {/* Video Preview Modal */}
            <Modal
              visible={showVideoPreview}
              transparent={false}
              animationType="fade"
              onRequestClose={() => {
                try {
                  if (videoRef?.current) {
                    videoRef.current.pauseAsync();
                  }
                } catch {}
                setVideoPlaying(false);
                setVideoLoaded(false);
                setShowVideoPreview(false);
                setPreviewVideoUrl(null);
              }}
            >
              <View style={styles.previewContainer}>
                <LinearGradient
                  colors={['#1a1a1a', '#000']}
                  style={styles.previewGradient}
                >
                  <TouchableOpacity 
                    style={styles.previewCloseButton}
                    onPress={() => {
                      try {
                        if (videoRef?.current) {
                          videoRef.current.pauseAsync();
                        }
                      } catch {}
                      setVideoPlaying(false);
                      setVideoLoaded(false);
                      setShowVideoPreview(false);
                      setPreviewVideoUrl(null);
                    }}
                  >
                    <Ionicons name="close" size={28} color="#fff" />
                  </TouchableOpacity>

                  {previewVideoUrl ? (
                    <>
                      {!videoLoaded && (
                        <ActivityIndicator size="large" color="#3399ff" />
                      )}
                      <Video
                        ref={videoRef}
                        source={{ uri: previewVideoUrl }}
                        style={styles.previewVideo}
                        resizeMode="contain"
                        shouldPlay={videoPlaying}
                        isLooping={true}
                        useNativeControls={true}
                        onLoad={async () => {
                          setVideoLoaded(true);
                          setVideoPlaying(true);
                          try {
                            if (videoRef.current) {
                              await videoRef.current.playAsync();
                            }
                          } catch (e) {
                            console.warn('Error starting video:', e);
                          }
                        }}
                        onError={(e) => {
                          console.error('Video error', e);
                          Alert.alert('Error', 'Unable to play this video.');
                          setVideoPlaying(false);
                        }}
                      />
                      
                      {/* Custom video controls */}
                      <TouchableOpacity 
                        style={styles.videoControlsOverlay}
                        onPress={async () => {
                          const next = !videoPlaying;
                          setVideoPlaying(next);
                          try {
                            if (videoRef.current) {
                              if (next) {
                                await videoRef.current.playAsync();
                              } else {
                                await videoRef.current.pauseAsync();
                              }
                            }
                          } catch (e) {
                            console.warn('Toggle play error', e);
                          }
                        }}
                      >
                        <View style={styles.pausePlayButton}>
                          <Ionicons 
                            name={videoPlaying ? "pause" : "play"} 
                            size={50} 
                            color="rgba(255,255,255,0.8)" 
                          />
                        </View>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <ActivityIndicator size="large" color="#3399ff" />
                  )}
                </LinearGradient>
              </View>
            </Modal>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  dateSeparatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dateSeparatorText: {
    color: '#fff',
    marginHorizontal: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 0, 255, 0.2)',
  },
  backButton: {
    marginRight: 10,
    padding: 5,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#ff00ff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(255, 0, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  onlineStatusText: {
    fontSize: 12,
    color: '#66ccff',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 16,
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageListContent: {
    paddingTop: 16,
    paddingBottom: 120, // Extra padding to prevent messages from being hidden behind input
  },
  messageBubble: {
    marginVertical: 8,
    marginHorizontal: 10,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    borderRadius: 20,
  },
  messageBubbleGradient: {
    padding: 12,
    borderRadius: 20,
  },
  textMessageContainer: {
    minHeight: 20,
  },
  myMessage: {
    alignSelf: 'flex-end',
    borderTopRightRadius: 5,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    borderTopLeftRadius: 5,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginRight: 4,
  },
  readStatus: {
    marginLeft: 4,
  },
  videoContainer: {
    position: 'relative',
    borderRadius: 15,
    overflow: 'hidden',
    marginVertical: 5,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageVideo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  videoPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    zIndex: 1,
  },
  placeholderGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  videoPlayButton: {
    position: 'absolute',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  sharedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  sharedAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
    backgroundColor: '#222',
  },
  sharedUsername: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
  videoThumbContainer: {
    width: 200,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  playOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width: 200,
    height: 150,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  videoContainer: {
    position: 'relative',
    width: 200,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  videoText: {
    color: '#fff',
    fontSize: 10,
    marginLeft: 4,
  },
  inputContainer: {
    paddingHorizontal: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 0, 255, 0.2)',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    backgroundColor: 'transparent',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 25,
    paddingHorizontal: 20,
    marginHorizontal: 8,
    color: '#fff',
    fontSize: 16,
    ...Platform.select({
      ios: {
        paddingVertical: 12,
        minHeight: 48,
      },
      android: {
        paddingVertical: 8,
        textAlignVertical: 'center',
        minHeight: 48,
      },
    }),
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  mediaPickerContainer: {
    backgroundColor: '#222',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  mediaOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  mediaOptionText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 16,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 5,
  },
  previewImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.8,
  },
  previewVideo: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#999',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    width: '100%',
    minHeight: 120,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  confessionCardGradient: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  confessionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  confessionUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confessionAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  confessionAvatarText: {
    fontSize: 12,
  },
  confessionUsername: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  confessionBadge: {
    backgroundColor: 'rgba(255,0,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,0,255,0.3)',
  },
  confessionBadgeText: {
    color: '#ff00ff',
    fontSize: 10,
    fontWeight: '500',
  },
  confessionContent: {
    flex: 1,
    justifyContent: 'center',
    marginVertical: 8,
  },
  confessionText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  confessionCardFooter: {
    alignItems: 'center',
  },
  tapToViewIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tapToViewText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    marginLeft: 4,
  },
  instagramVideoPreview: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'space-between',
    padding: 12,
  },
  videoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  videoUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoUserAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  videoUsername: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  videoPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  videoText: {
    color: '#fff',
    fontSize: 10,
    marginLeft: 4,
  },
  videoControlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pausePlayButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 50,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sharedPostPreview: {
    width: '100%',
    minHeight: 100,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  sharedPostGradient: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  sharedPostHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sharedPostUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sharedPostAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  sharedPostAvatarText: {
    fontSize: 12,
  },
  sharedPostUsername: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  sharedPostBadge: {
    backgroundColor: 'rgba(0,150,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,150,255,0.3)',
  },
  sharedPostBadgeText: {
    color: '#0096ff',
    fontSize: 10,
    fontWeight: '500',
  },
  sharedPostContent: {
    flex: 1,
    justifyContent: 'center',
    marginVertical: 8,
  },
  sharedPostText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'left',
  },
  sharedPostFooter: {
    alignItems: 'center',
  },
  sharedTextContainer: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
  },
  sharedTextMessage: {
    fontStyle: 'italic',
  },
  sharedTextIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  tapToViewText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginLeft: 4,
  },
  // Premium shared content styles
  premiumSharedContent: {
    marginVertical: 4,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  premiumGradient: {
    padding: 16,
    borderRadius: 16,
    minHeight: 80,
  },
  premiumHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  premiumSharedText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginBottom: 12,
  },
  premiumFooter: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 8,
  },
  confessionBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  confessionBadgeText: {
    color: '#ffd700',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  postBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  postBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  tapIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tapIndicatorText: {
    color: '#ffd700',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
    letterSpacing: 0.3,
  },
  // Voice recording styles
  recordingButton: {
    backgroundColor: '#ff00ff',
    transform: [{ scale: 1.1 }],
  },
  recordingIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  recordingPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 0, 255, 0.3)',
    opacity: 0.7,
  },
  recordingDurationContainer: {
    position: 'absolute',
    top: -60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  recordingDurationBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.5)',
  },
  recordingDurationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    marginRight: 12,
  },
  recordingHintText: {
    color: '#ccc',
    fontSize: 12,
  },
  // New audio recording styles
  audioButtonWrapper: {
    marginRight: 10,
    padding: 5,
  },
  audioPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    borderRadius: 15,
    padding: 10,
    marginBottom: 10,
  },
  audioPreviewButton: {
    marginRight: 10,
  },
  audioPreviewInfo: {
    flex: 1,
  },
  audioPreviewText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  audioPreviewDuration: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  audioDeleteButton: {
    padding: 5,
  },
  recordingIndicatorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 15,
    padding: 10,
    marginBottom: 10,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4444',
    marginRight: 10,
  },
  recordingText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Message audio player styles
  messageAudioPlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
    marginVertical: 8,
  },
  messageAudioPlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  messageAudioWaveform: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 10,
  },
  messageAudioProgress: {
    height: '100%',
    backgroundColor: '#ff00ff',
    borderRadius: 2,
  },
  messageAudioDuration: {
    color: '#fff',
    fontSize: 11,
    minWidth: 70,
    textAlign: 'right',
  },
  audioMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  audioPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  audioWaveform: {
    flex: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioWaveformText: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
  audioDuration: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
    marginLeft: 8,
  },
});

export default MessageScreen;