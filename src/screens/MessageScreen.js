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
import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessages } from '../context/MessageContext';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
// BlurView is causing issues, so we'll use a regular View with backgroundColor instead

const MessageScreen = () => {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const navigation = useNavigation();
  const route = useRoute();
  const { recipientId, recipientName = "Chat", recipientAvatar } = route.params;
  const flatListRef = useRef(null);
  const { markConversationAsRead, fetchUnreadCount } = useMessages();
  
  // Use refs to prevent multiple calls
  const isMarkingAsRead = useRef(false);
  const hasMarkedOnFocus = useRef(false);
  
  // Media preview states
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [previewMediaUrl, setPreviewMediaUrl] = useState(null);
  const videoRef = useRef(null);
  
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
        
        await loadMessages(convId);
      } catch (error) {
        console.error('Error setting up conversation:', error);
      }
    };
    
    setupConversation();
  }, [recipientId]);

  // Set up focus listener ONCE - don't include changing dependencies
  useEffect(() => {
    if (!conversationId || !userId) return;
    
    const unsubscribe = navigation.addListener('focus', () => {
      // Only mark as read if we haven't already done so for this focus event
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
  }, [navigation, conversationId, userId]); // Remove isMarkedAsRead from dependencies

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
    
    const subscription = supabase
      .channel(`messages_${conversationId}_${Date.now()}`) // Unique channel name
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
      supabase.removeChannel(subscription);
    };
  }, [conversationId, userId]);

  // Improved mark as read function
  const markMessagesAsReadOnce = async (currentUserId, convId) => {
    // Prevent multiple simultaneous calls
    if (isMarkingAsRead.current) {
      console.log('Already marking messages as read, skipping...');
      return;
    }
    
    try {
      isMarkingAsRead.current = true;
      hasMarkedOnFocus.current = true;
      
      console.log('Marking messages as read for user:', currentUserId, 'in conversation:', convId);
      
      // Use the MessageContext to mark conversation as read
      await markConversationAsRead(convId);
      
      // Update database
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
        
        // Update local state
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
        
        // Update unread count
        await fetchUnreadCount();
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    } finally {
      // Always reset the flag after a delay to prevent race conditions
      setTimeout(() => {
        isMarkingAsRead.current = false;
      }, 1000);
    }
  };
  
  // Improved real-time update handler
  const handleRealTimeUpdate = (payload) => {
    if (payload.eventType === 'INSERT') {
      const newMessage = payload.new;
      
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
      
      // Add message to state (avoid duplicates)
      setMessages(prevMessages => {
        const messageExists = prevMessages.some(msg => msg.id === formattedMessage.id);
        if (messageExists) {
          return prevMessages;
        }
        return [...prevMessages, formattedMessage];
      });
      
      // If it's a message for the current user and screen is focused, mark as read
      // But don't reset the hasMarkedOnFocus flag - let it stay true until screen blurs
      if (newMessage.receiver_id === userId && !newMessage.read && hasMarkedOnFocus.current) {
        // Use a timeout to avoid immediate re-triggering
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

  // Load messages function (unchanged)
  const loadMessages = async (convId) => {
    try {
      setLoading(true);
      
      let currentUserId = userId;
      if (!currentUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          currentUserId = user.id;
          setUserId(currentUserId);
        } else {
          console.error('User not authenticated');
          navigation.navigate('Login');
          return;
        }
      }
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });
        
      if (error) {
        console.error('Error fetching messages:', error);
        const storedMessages = await AsyncStorage.getItem(`conversation_${convId}`);
        if (storedMessages) {
          const parsedMessages = JSON.parse(storedMessages);
          const updatedMessages = parsedMessages.map(msg => ({
            ...msg,
            sender: msg.sender_id === currentUserId ? 'me' : 'them'
          }));
          setMessages(updatedMessages);
        }
      } else {
        const formattedMessages = data.map(msg => ({
          id: msg.id,
          text: msg.content,
          sender: msg.sender_id === currentUserId ? 'me' : 'them',
          timestamp: new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          sender_id: msg.sender_id,
          read: msg.read || false,
          media_url: msg.media_url || null,
          media_type: msg.media_type || null,
          cloudinary_public_id: msg.cloudinary_public_id || null
        }));
        
        setMessages(formattedMessages);
        await AsyncStorage.setItem(`conversation_${convId}`, JSON.stringify(formattedMessages));
      }
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
      
      const newMessage = { 
        id: Date.now().toString(), 
        text: inputText,
        sender: 'me',
        sender_id: userId,
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      };
      
      const updatedMessages = [...messages, newMessage];
      setMessages(updatedMessages);
      setInputText('');
      
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
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== newMessage.id));
      } else {
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === newMessage.id ? { ...msg, id: data.id } : msg
          )
        );
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      const messageToDelete = messages.find(msg => msg.id === messageId);
      if (!messageToDelete || messageToDelete.sender_id !== userId) {
        console.error('Cannot delete message: not authorized');
        return;
      }

      // First, get the message to access its media data
      const { data: messageData, error: fetchError } = await supabase
        .from('messages')
        .select('media_url, media_type, cloudinary_public_id')
        .eq('id', messageId)
        .single();

      if (fetchError) {
        console.error('Error fetching message data:', fetchError);
      }

      // Delete the message from Supabase
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', userId);

      if (error) {
        console.error('Error deleting message:', error);
        return;
      }

      // Delete media from Cloudinary if it exists
      if (messageData?.cloudinary_public_id) {
        try {
          // Import the Cloudinary delete function
          const { deleteFromCloudinary } = await import('../config/cloudinary');
          
          await deleteFromCloudinary(
            messageData.cloudinary_public_id, 
            messageData.media_type || 'image'
          );
          console.log('Deleted media from Cloudinary:', messageData.cloudinary_public_id);
        } catch (mediaError) {
          console.error('Error deleting media from Cloudinary:', mediaError);
          // Continue with message deletion even if media deletion fails
        }
      }

      // Update local state
      setMessages(prevMessages => 
        prevMessages.filter(msg => msg.id !== messageId)
      );

      // Update AsyncStorage
      const updatedMessages = messages.filter(msg => msg.id !== messageId);
      await AsyncStorage.setItem(`conversation_${conversationId}`, JSON.stringify(updatedMessages));
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const renderMessage = ({ item }) => (
    <TouchableOpacity
      onLongPress={() => {
        if (item.sender_id === userId) {
          Alert.alert(
            'Delete Message',
            'Are you sure you want to delete this message?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteMessage(item.id) }
            ],
            { cancelable: true }
          );
        }
      }}
      delayLongPress={500}
    >
      <View style={[
        styles.messageBubble,
        item.sender === 'me' ? styles.myMessage : styles.theirMessage
      ]}>
        {/* Display text message if present */}
        {item.text ? (
          <Text style={styles.messageText}>{item.text}</Text>
        ) : null}
        
        {/* Display media content if present */}
        {item.media_url ? (
          item.media_type === 'video' ? (
            // Video message
            <TouchableOpacity 
              style={styles.mediaContainer}
              onPress={() => {
                // Open video in fullscreen preview
                setPreviewMediaUrl(item.media_url);
                setShowVideoPreview(true);
              }}
            >
              <View style={styles.videoPlaceholder}>
                <Ionicons name="play-circle" size={40} color="#fff" />
                <Text style={styles.videoText}>Play Video</Text>
              </View>
            </TouchableOpacity>
          ) : (
            // Image message
            <TouchableOpacity 
              style={styles.mediaContainer}
              onPress={() => {
                // Open image in fullscreen preview
                setPreviewMediaUrl(item.media_url);
                setShowImagePreview(true);
              }}
            >
              <Image 
                source={{ uri: item.media_url }} 
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )
        ) : null}
        
        <View style={styles.messageFooter}>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
          {item.sender === 'me' && (
            <View style={styles.readStatus}>
              <Ionicons 
                name={item.read ? "checkmark-done" : "checkmark"} 
                size={14} 
                color={item.read ? "#34aadc" : "rgba(255, 255, 255, 0.5)"} 
              />
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const getDisplayName = () => {
    if (recipientName && recipientName !== "User") {
      return recipientName;
    }
    return "Chat";
  };

  const [showCamera, setShowCamera] = useState(false);
  const [cameraType, setCameraType] = useState('back'); // Using string literal instead of ImagePicker.CameraType.back
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [flashMode, setFlashMode] = useState('off'); // Using string literal instead of ImagePicker.FlashMode.off

  useEffect(() => {
    (async () => {
      try {
        // Request camera permissions using ImagePicker instead of Camera
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        setHasCameraPermission(cameraStatus === 'granted');
        
        const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (mediaStatus !== 'granted') {
          Alert.alert('Permission required', 'Please allow access to your photo library to send images');
        }
      } catch (error) {
        console.error('Error requesting camera permissions:', error);
        setHasCameraPermission(false);
        // Don't show camera option if there's an error with the camera module
        setShowCamera(false);
      }
    })();
  }, []);

  const handleCameraCapture = async () => {
    try {
      // Use ImagePicker instead of Camera component
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // Using MediaTypeOptions since MediaType is undefined
        allowsEditing: true,
        quality: 0.7,
        cameraType: cameraType, // Already using string literal ('front' or 'back')
        flashMode: flashMode // Already using string literal ('on', 'off', 'auto', or 'torch')
      });
      
      if (!result.canceled) {
        setShowCamera(false);
        
        // Show loading indicator
        Alert.alert('Uploading', 'Uploading photo, please wait...');
        
        try {
          // Import the Cloudinary upload function
          const { uploadToCloudinary } = await import('../config/cloudinary');
          
          // Upload to Cloudinary
          const uploadResult = await uploadToCloudinary(result.assets[0].uri, 'image');
          
          if (!uploadResult || !uploadResult.url) {
            throw new Error('Failed to upload photo');
          }
          
          // Create a temporary message object
          const newMessage = { 
            id: Date.now().toString(), 
            text: '',
            media_url: uploadResult.url,
            media_type: 'image',
            sender: 'me',
            sender_id: userId,
            timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
          };
          
          // Add message to local state
          const updatedMessages = [...messages, newMessage];
          setMessages(updatedMessages);
          
          // Save to AsyncStorage
          await AsyncStorage.setItem(`conversation_${conversationId}`, JSON.stringify(updatedMessages));
          
          // Save to Supabase
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
            setMessages(prevMessages => prevMessages.filter(msg => msg.id !== newMessage.id));
            Alert.alert('Error', 'Failed to send photo message');
          } else {
            setMessages(prevMessages => 
              prevMessages.map(msg => 
                msg.id === newMessage.id ? { ...msg, id: data.id } : msg
              )
            );
          }
        } catch (uploadError) {
          console.error('Error uploading photo:', uploadError);
          Alert.alert('Error', 'Failed to upload photo: ' + uploadError.message);
        }
      } else {
        setShowCamera(false);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture');
      setShowCamera(false);
    }
  };
  
  // This function is now redundant since we're using ImagePicker directly
  // Keeping it for backward compatibility with existing code
  const takePictureWithImagePicker = async () => {
    // Just call handleCameraCapture since it now uses ImagePicker
    await handleCameraCapture();
  };

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
        // Show loading indicator
        Alert.alert('Uploading', 'Uploading media, please wait...');
        
        try {
          // Import the Cloudinary upload function
          const { uploadToCloudinary } = await import('../config/cloudinary');
          
          // Upload to Cloudinary
          const mediaType = type === 'photo' ? 'image' : 'video';
          const uploadResult = await uploadToCloudinary(result.assets[0].uri, mediaType);
          
          if (!uploadResult || !uploadResult.url) {
            throw new Error('Failed to upload media');
          }
          
          // Create a temporary message object
          const newMessage = { 
            id: Date.now().toString(), 
            text: '',
            media_url: uploadResult.url,
            media_type: mediaType,
            sender: 'me',
            sender_id: userId,
            timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
          };
          
          // Add message to local state
          const updatedMessages = [...messages, newMessage];
          setMessages(updatedMessages);
          
          // Save to AsyncStorage
          await AsyncStorage.setItem(`conversation_${conversationId}`, JSON.stringify(updatedMessages));
          
          // Save to Supabase
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
            setMessages(prevMessages => prevMessages.filter(msg => msg.id !== newMessage.id));
            Alert.alert('Error', 'Failed to send media message');
          } else {
            setMessages(prevMessages => 
              prevMessages.map(msg => 
                msg.id === newMessage.id ? { ...msg, id: data.id } : msg
              )
            );
          }
        } catch (uploadError) {
          console.error('Error uploading media:', uploadError);
          Alert.alert('Error', 'Failed to upload media: ' + uploadError.message);
        }
      }
    } catch (error) {
      console.error('Error picking media:', error);
      Alert.alert('Error', 'Failed to pick media');
    }
    setShowMediaPicker(false);
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
              setCameraType('back'); // Using string literal instead of ImagePicker.CameraType.back
              handleCameraCapture();
            }}
          >
            <MaterialCommunityIcons name="camera" size={32} color="#ff00ff" />
            <Text style={styles.mediaOptionText}>Rear Camera</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.mediaOption} 
            onPress={() => {
              setShowMediaPicker(false);
              setCameraType('front'); // Using string literal instead of ImagePicker.CameraType.front
              handleCameraCapture();
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

  // We no longer need the showCamera conditional rendering since we're using ImagePicker directly
  // The handleCameraCapture function will be called directly from the MediaPickerModal

  // Add styles for the new camera UI elements
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 16,
      backgroundColor: '#1a1a1a',
    },
    backButton: {
      padding: 8,
    },
    profileInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginLeft: 8,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      marginRight: 8,
    },
    headerTitle: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
    },
    headerActions: {
      flexDirection: 'row',
    },
    headerButton: {
      marginLeft: 16,
    },
    // Media message styles
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
    messageList: {
      flex: 1,
      paddingHorizontal: 16,
    },
    messageListContent: {
      paddingTop: 16,
      paddingBottom: 8,
    },
    messageBubble: {
      maxWidth: '80%',
      padding: 12,
      borderRadius: 18,
      marginBottom: 8,
    },
    myMessage: {
      alignSelf: 'flex-end',
      backgroundColor: '#ff00ff',
      borderBottomRightRadius: 4,
    },
    theirMessage: {
      alignSelf: 'flex-start',
      backgroundColor: '#333',
      borderBottomLeftRadius: 4,
    },
    messageText: {
      color: '#fff',
      fontSize: 16,
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
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: '#1a1a1a',
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      backgroundColor: 'transparent',
    },
    input: {
      flex: 1,
      backgroundColor: '#333',
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      color: '#fff',
      fontSize: 16,
      marginRight: 8,
    },
    sendButton: {
      backgroundColor: '#ff00ff',
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    mediaButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
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
    cameraContainer: {
      flex: 1,
      backgroundColor: '#000',
    },
    camera: {
      flex: 1,
    },
    cameraHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 20,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    cameraControls: {
      flex: 1,
      backgroundColor: 'transparent',
      justifyContent: 'flex-end',
      padding: 20,
    },
    cameraControlsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    cameraButton: {
      alignSelf: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    captureButton: {
      alignSelf: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    captureOuter: {
      borderWidth: 2,
      borderColor: '#fff',
      borderRadius: 35,
      height: 70,
      width: 70,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    captureInner: {
      borderWidth: 2,
      borderColor: '#fff',
      borderRadius: 30,
      height: 60,
      width: 60,
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    cameraTypeText: {
      color: '#fff',
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 10,
    },
    // Preview modal styles
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
    // Empty state styles
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
    // Loading state styles
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
    sendButtonActive: {
      backgroundColor: '#ff00ff',
    },
  });
  
  return (
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
            <Text style={styles.headerTitle}>{getDisplayName()}</Text>
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
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
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

        <View style={[styles.inputContainer, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
          <View style={styles.inputWrapper}>
            <TouchableOpacity 
              style={styles.mediaButton}
              onPress={() => setShowMediaPicker(true)}
            >
              <MaterialCommunityIcons name="plus-circle" size={24} color="#ff00ff" />
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
              <TouchableOpacity 
                style={[styles.sendButton, styles.sendButtonActive]}
                onPress={sendMessage}
              >
                <MaterialCommunityIcons name="send" size={20} color="white" />
              </TouchableOpacity>
            )}
          </View>
        </View>

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
  );
};

export default MessageScreen;