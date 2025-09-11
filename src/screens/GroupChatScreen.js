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

  // Send message
  const sendMessage = async () => {
    if (!inputText.trim() || !userId || !groupId) return;

    try {
      const messageContent = inputText.trim();
      setInputText('');

      const { error } = await supabase
        .from('group_messages')
        .insert({
          group_id: groupId,
          sender_id: userId,
          content: messageContent,
          message_type: 'text'
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
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.04)']}
            style={styles.inputWrapper}
          >
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={sendMessage}
              disabled={!inputText.trim()}
            >
              <LinearGradient
                colors={inputText.trim() ? 
                  ['rgba(255, 107, 107, 0.9)', 'rgba(255, 82, 82, 0.8)'] :
                  ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                style={styles.sendButtonGradient}
              >
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={inputText.trim() ? "#fff" : "rgba(255,255,255,0.3)"} 
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
});

export default GroupChatScreen;
