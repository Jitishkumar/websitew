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
  Dimensions
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessages } from '../context/MessageContext';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

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
  
  // Media preview states
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [previewMediaUrl, setPreviewMediaUrl] = useState(null);
  const videoRef = useRef(null);
  
  // Media picker states
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);

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
        if (payload?.type === 'reel' || payload?.type === 'video') return 'video';
        if (payload?.type === 'image') return 'image';
        if (!mediaUrl) return null; // text-only share
        const lower = mediaUrl.toLowerCase();
        if (lower.endsWith('.mp4') || lower.includes('/video')) return 'video';
        return 'image';
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

  const loadMessages = async (convId, currentUserId = null) => {
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

    // Try to load from cache first for instant loading
    try {
      const storedMessages = await AsyncStorage.getItem(`conversation_${convId}`);
      if (storedMessages) {
          const parsedMessages = JSON.parse(storedMessages);
          const updatedMessages = parsedMessages.map(msg => ({
              ...msg,
              sender: msg.sender_id === actualUserId ? 'me' : 'them'
          }));
          setMessages(updatedMessages);
          setLoading(false); // Stop loading immediately when cache is available
          console.log('Loaded messages from cache:', updatedMessages.length);
      }
    } catch (cacheError) {
      console.error('Error loading from cache:', cacheError);
    }

    // Fetch latest messages from network
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching messages:', error);
            if (!storedMessages) setLoading(false);
            return;
        }

        let formattedMessages = data.map(msg => ({
            id: msg.id,
            text: msg.content,
            sender: msg.sender_id === actualUserId ? 'me' : 'them',
            timestamp: new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            sender_id: msg.sender_id,
            read: msg.read || false,
            media_url: msg.media_url || null,
            media_type: msg.media_type || null,
            cloudinary_public_id: msg.cloudinary_public_id || null
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
              .select('media_url, user_id, profiles:user_id (username, avatar_url)')
              .in('media_url', mediaUrls);
            if (!postsError && postsData && postsData.length > 0) {
              const urlToOwner = {};
              postsData.forEach(p => {
                urlToOwner[p.media_url] = {
                  username: p.profiles?.username || 'User',
                  avatar_url: p.profiles?.avatar_url || null,
                };
              });
              formattedMessages = formattedMessages.map(m => (
                m.media_url && urlToOwner[m.media_url]
                  ? { ...m, post_owner_username: urlToOwner[m.media_url].username, post_owner_avatar: urlToOwner[m.media_url].avatar_url }
                  : m
              ));
            }
          }
        } catch (e) {
          console.warn('Failed to enrich messages with post owner info:', e);
        }

        setMessages(formattedMessages);
        
        // Update cache
        await AsyncStorage.setItem(`conversation_${convId}`, JSON.stringify(formattedMessages));
        console.log('Messages updated from network and cached:', formattedMessages.length);
    } catch (error) {
        console.error('Error loading messages:', error);
    } finally {
        setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    
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

          {item.text ? (
            <TouchableOpacity
              onLongPress={() => onLongPress(item)}
              onPress={() => {
                // Check if this is a shared post (starts with 📝 Shared post from)
                if (item.text.startsWith('📝 Shared post from')) {
                  // Extract username and content for shared text posts
                  const usernameMatch = item.text.match(/@(\w+):/);
                  const username = usernameMatch ? usernameMatch[1] : 'Unknown User';
                  const content = item.text.split(':\n\n')[1] || item.text;
                  
                  // Create a mock post object that PhotoTextViewerScreen expects
                  const mockPost = {
                    id: `shared-${Date.now()}`,
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
              }}
              delayLongPress={500}
              style={[
                styles.textMessageContainer,
                item.text.startsWith('📝 Shared post from') && styles.sharedTextContainer
              ]}
            >
              <Text style={[
                styles.messageText,
                item.text.startsWith('📝 Shared post from') && styles.sharedTextMessage
              ]}>
                {item.text}
              </Text>
              {item.text.startsWith('📝 Shared post from') && (
                <View style={styles.sharedTextIndicator}>
                  <Ionicons name="open-outline" size={16} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.tapToViewText}>Tap to view</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : null}
          
          {item.media_url ? (
            <TouchableOpacity
              onLongPress={() => onLongPress(item)}
              onPress={() => onMediaPress(item.media_url, item.media_type)}
              delayLongPress={500}
              style={styles.mediaContainer}
            >
              {item.media_type === 'video' ? (
                <View style={styles.videoThumbContainer}>
                  <Video
                    source={{ uri: item.media_url }}
                    style={styles.messageImage}
                    resizeMode="cover"
                    shouldPlay={false}
                    isMuted={true}
                    usePoster={true}
                    posterSource={{ uri: item.media_url }}
                  />
                  <View style={styles.playOverlay}>
                    <Ionicons name="play-circle" size={40} color="#fff" />
                  </View>
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
          
          <View style={styles.messageFooter}>
            <Text style={styles.timestamp}>{item.timestamp}</Text>
            {item.sender === 'me' && (
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
  
  // Memoized renderItem function to prevent recreation on each render
  const renderMessage = React.useCallback(({ item }) => {
    return (
      <MessageItem 
        item={item} 
        recipientReadReceipts={recipientReadReceipts}
        onLongPress={handleLongPress}
        onMediaPress={(url, type) => {
          setPreviewMediaUrl(url);
          if (type === 'video') {
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

    if (diffInSeconds < 300) {
      return 'Active now';
    }

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
              data={messages}
              keyExtractor={React.useCallback((item) => `message-${item.id.toString()}`, [])}
              renderItem={renderMessage}
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
              removeClippedSubviews={Platform.OS !== 'web'}
              maxToRenderPerBatch={10}
              initialNumToRender={15}
              windowSize={21}
              updateCellsBatchingPeriod={50}
              getItemLayout={React.useCallback(
                (data, index) => ({
                  length: 100, // Approximate height of a message item
                  offset: 100 * index,
                  index,
                }),
                []
              )}
              onContentSizeChange={() => {
                if (messages.length > 0) {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }
              }}
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
              style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}
            >
              <View style={styles.inputWrapper}>
                <TouchableOpacity onPress={() => setShowMediaPicker(true)}>
                  <LinearGradient
                    colors={['#00ffff', '#0099ff']}
                    style={styles.mediaButton}
                  >
                    <Ionicons name="attach" size={24} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
                
                <TextInput
                  style={styles.input}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Type a message..."
                  placeholderTextColor="#8e8e8e"
                  multiline
                />
                
                {!inputText.trim() ? (
                  <TouchableOpacity style={styles.mediaButton}>
                    <MaterialCommunityIcons name="microphone" size={24} color="#ff00ff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={sendMessage}>
                    <LinearGradient
                      colors={['#ff00ff', '#9900ff']}
                      style={styles.sendButton}
                    >
                      <Ionicons name="send" size={24} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                )}
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
                if (videoRef.current) {
                  videoRef.current.pauseAsync();
                }
                setShowVideoPreview(false);
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
                      if (videoRef.current) {
                        videoRef.current.pauseAsync();
                      }
                      setShowVideoPreview(false);
                    }}
                  >
                    <Ionicons name="close" size={28} color="#fff" />
                  </TouchableOpacity>
                  
                  <Video
                    ref={videoRef}
                    source={{ uri: previewMediaUrl }}
                    style={styles.previewVideo}
                    resizeMode="contain"
                    shouldPlay={true}
                    isLooping={true}
                    useNativeControls={true}
                  />
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
    paddingBottom: 8,
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
  mediaContainer: {
    marginVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#222',
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
  videoText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 0, 255, 0.2)',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#999',
    fontSize: 14,
    marginTop: 10,
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
});

export default MessageScreen;