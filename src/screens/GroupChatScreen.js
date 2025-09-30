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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { uploadToCloudinary } from '../config/cloudinary';

// Audio Player Component for Messages
const AudioPlayer = ({ audioUrl, duration }) => {
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
    <View style={styles.audioPlayerContainer}>
      <TouchableOpacity onPress={playPauseAudio} style={styles.audioPlayButton}>
        <Ionicons 
          name={isPlaying ? 'pause' : 'play'} 
          size={16} 
          color="#ff00ff" 
        />
      </TouchableOpacity>
      <View style={styles.audioWaveform}>
        <View style={[styles.audioProgress, { width: `${(position / audioDuration) * 100}%` }]} />
      </View>
      <Text style={styles.audioDuration}>
        {formatTime(position)} / {formatTime(audioDuration)}
      </Text>
    </View>
  );
};

const GroupChatScreen = () => {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [groupInfo, setGroupInfo] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [userRole, setUserRole] = useState('member');
  const navigation = useNavigation();
  const route = useRoute();
  const { groupId, groupName, groupAvatar } = route.params;
  const flatListRef = useRef(null);
  
  // Audio recording states
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState(null);
  const [audioSound, setAudioSound] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef(null);

  // Get current user and set up group
  useEffect(() => {
    const setupGroup = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('User not authenticated');
          navigation.navigate('Login');
          return;
        }
        
        setUserId(user.id);
        
        await loadGroupInfo(groupId, user.id);
        await loadMessages(groupId);
        
      } catch (error) {
        console.error('Error setting up group:', error);
      }
    };
    
    setupGroup();
  }, [groupId]);

  // Load group information and members
  const loadGroupInfo = async (groupId, userId) => {
    try {
      // Get group info
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;
      setGroupInfo(group);

      // Get group members
      const { data: members, error: membersError } = await supabase
        .from('group_members')
        .select(`
          *,
          profiles (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('group_id', groupId);

      if (membersError) throw membersError;
      setGroupMembers(members);

      // Find current user's role
      const currentUserMember = members.find(member => member.user_id === userId);
      if (currentUserMember) {
        setUserRole(currentUserMember.role);
      }

    } catch (error) {
      console.error('Error loading group info:', error);
    }
  };

  // Load group messages
  const loadMessages = async (groupId) => {
    try {
      setLoading(true);
      
      const { data: messagesData, error } = await supabase
        .from('group_messages')
        .select(`
          *,
          profiles (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(messagesData || []);
      
      // Scroll to bottom
      setTimeout(() => {
        if (flatListRef.current && messagesData?.length > 0) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);

    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Audio recording functions
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

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant microphone permission to record audio');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
      setIsRecording(false);
      setRecording(null);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;

      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setAudioUri(uri);
      setRecording(null);

    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

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

  const deleteAudioRecording = () => {
    setAudioUri(null);
    setRecordingDuration(0);
    if (audioSound) {
      audioSound.unloadAsync();
      setAudioSound(null);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Send message
  const sendMessage = async () => {
    if ((!inputText.trim() && !audioUri) || !userId || !groupId) return;

    try {
      const messageContent = inputText.trim();
      let audioUrl = null;
      let audioPublicId = null;

      // Upload audio if exists
      if (audioUri) {
        try {
          const audioUpload = await uploadToCloudinary(audioUri, 'video');
          audioUrl = audioUpload.url;
          audioPublicId = audioUpload.publicId;
        } catch (uploadError) {
          console.error('Error uploading audio:', uploadError);
          Alert.alert('Error', 'Failed to upload audio recording');
          return;
        }
      }

      setInputText('');
      deleteAudioRecording();

      const { error } = await supabase
        .from('group_messages')
        .insert({
          group_id: groupId,
          sender_id: userId,
          content: messageContent || (audioUrl ? '🎤 Audio message' : ''),
          message_type: audioUrl ? 'audio' : 'text',
          audio_url: audioUrl,
          audio_public_id: audioPublicId,
          audio_duration: recordingDuration
        });

      if (error) throw error;

      // Reload messages to show the new one
      await loadMessages(groupId);

    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render message item
  const renderMessage = ({ item }) => {
    const isOwnMessage = item.sender_id === userId;
    const senderInfo = item.profiles;

    return (
      <View style={[styles.messageContainer, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
        {!isOwnMessage && (
          <Image
            source={{ uri: senderInfo?.avatar_url || 'https://via.placeholder.com/30' }}
            style={styles.messageAvatar}
          />
        )}
        <View style={[styles.messageBubble, isOwnMessage ? styles.ownBubble : styles.otherBubble]}>
          {!isOwnMessage && (
            <Text style={styles.senderName}>
              {senderInfo?.username || senderInfo?.full_name || 'User'}
            </Text>
          )}
          <Text style={[styles.messageText, isOwnMessage ? styles.ownMessageText : styles.otherMessageText]}>
            {item.content}
          </Text>
          
          {/* Audio Player */}
          {item.audio_url && (
            <AudioPlayer 
              audioUrl={item.audio_url} 
              duration={item.audio_duration || 0}
            />
          )}
          
          <Text style={[styles.messageTime, isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      
      {/* Header */}
      <LinearGradient
        colors={['rgba(102, 126, 234, 0.3)', 'rgba(156, 136, 255, 0.2)', 'transparent']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <LinearGradient
            colors={['rgba(102, 126, 234, 0.8)', 'rgba(156, 136, 255, 0.6)']}
            style={styles.backButtonGradient}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.groupInfo} onPress={() => {
          console.log('Group info pressed from header');
          navigation.navigate('GroupInfoScreen', { 
            groupId: groupId 
          });
        }}>
          <LinearGradient
            colors={['rgba(255, 107, 107, 0.8)', 'rgba(255, 82, 82, 0.6)']}
            style={styles.groupAvatar}
          >
            <Ionicons name="people" size={20} color="#fff" />
          </LinearGradient>
          <View>
            <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
              {groupName || 'Group Chat'}
            </Text>
            <Text style={styles.memberCountText}>
              {groupMembers.length} members
            </Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => {
          console.log('Group info icon pressed');
          navigation.navigate('GroupInfoScreen', { 
            groupId: groupId 
          });
        }}>
          <LinearGradient
            colors={['rgba(255, 107, 107, 0.8)', 'rgba(255, 82, 82, 0.6)']}
            style={styles.headerIconGradient}
          >
            <Ionicons name="information-circle" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>

      {/* Messages List */}
      <KeyboardAvoidingView 
        style={styles.messagesContainer} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            contentContainerStyle={[styles.messagesContent, { paddingBottom: 100 }]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: true });
              }
            }}
          />
        )}

        {/* Input Area */}
        <LinearGradient
          colors={['rgba(102, 126, 234, 0.1)', 'rgba(156, 136, 255, 0.05)']}
          style={styles.inputContainer}
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
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording... {formatDuration(recordingDuration)}</Text>
            </View>
          )}
          
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.04)']}
            style={styles.inputWrapper}
          >
            {/* Audio Record Button */}
            <TouchableOpacity
              onPress={isRecording ? stopRecording : startRecording}
              style={styles.audioButton}
            >
              <Ionicons 
                name={isRecording ? 'stop' : 'mic'} 
                size={24} 
                color={isRecording ? '#ff4444' : '#ff00ff'} 
              />
            </TouchableOpacity>
            
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
              editable={!isRecording}
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={sendMessage}
              disabled={(!inputText.trim() && !audioUri) || isRecording}
            >
              <LinearGradient
                colors={(inputText.trim() || audioUri) ? 
                  ['rgba(255, 107, 107, 0.9)', 'rgba(255, 82, 82, 0.8)'] :
                  ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                style={styles.sendButtonGradient}
              >
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={(inputText.trim() || audioUri) ? "#fff" : "rgba(255,255,255,0.3)"} 
                />
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </LinearGradient>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(102, 126, 234, 0.3)',
  },
  backButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 15,
  },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    maxWidth: 150,
  },
  memberCountText: {
    fontSize: 12,
    color: 'rgba(255,107,107,0.8)',
    marginTop: 2,
  },
  headerIconGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 15,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
  },
  ownMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 18,
    marginHorizontal: 5,
  },
  ownBubble: {
    backgroundColor: 'rgba(255, 107, 107, 0.8)',
    borderBottomRightRadius: 5,
  },
  otherBubble: {
    backgroundColor: 'rgba(102, 126, 234, 0.3)',
    borderBottomLeftRadius: 5,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: 'rgba(255,255,255,0.6)',
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(102, 126, 234, 0.3)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.3)',
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 5,
  },
  sendButton: {
    marginLeft: 10,
  },
  sendButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Audio recording styles
  audioButton: {
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
  recordingIndicator: {
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
  // Audio player styles
  audioPlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 255, 0.05)',
    borderRadius: 12,
    padding: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  audioPlayButton: {
    marginRight: 10,
  },
  audioWaveform: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 10,
  },
  audioProgress: {
    height: '100%',
    backgroundColor: '#ff00ff',
    borderRadius: 2,
  },
  audioDuration: {
    color: '#999',
    fontSize: 11,
    minWidth: 60,
    textAlign: 'right',
  },
});

export default GroupChatScreen;
