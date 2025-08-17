import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const MessageContext = createContext();

export const MessageProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlineStatus, setOnlineStatus] = useState({});
  const [loading, setLoading] = useState(true);

  const updateCurrentUserLastActive = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.rpc('update_user_last_active', { user_id: user.id });
      }
    } catch (error) {
      console.error('Error updating current user last active:', error);
    }
  };

  // Fetch unread messages count
  const fetchUnreadCount = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Count unread messages
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('receiver_id', user.id)
          .eq('read', false);
          
        if (error) throw error;
        
        setUnreadCount(data ? data.length : 0);
      }
    } catch (error) {
      console.error('Error fetching unread messages count:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark a message as read
  const markMessageAsRead = async (messageId) => {
    try {
      // Update in the database
      const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('id', messageId);

      if (error) throw error;
      
      // Update local count
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      return true;
    } catch (error) {
      console.error('Error marking message as read:', error);
      return false;
    }
  };

  // Mark all messages from a conversation as read
  const markConversationAsRead = async (conversationId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('User not authenticated');
        return false;
      }
      
      // Check if read receipts are enabled for the current user
      const { data: settings, error: settingsError } = await supabase
        .from('user_message_settings')
        .select('show_read_receipts')
        .eq('user_id', user.id)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('Error fetching user settings:', settingsError);
      }

      // If read receipts are disabled, don't mark messages as read
      if (settings && !settings.show_read_receipts) {
        console.log('Read receipts are disabled for the current user. Not marking messages as read.');
        return true;
      }
      
      // Get the most recent unread message (if any)
      const { data: unreadMessages, error: fetchError } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('receiver_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      if (unreadMessages && unreadMessages.length > 0) {
        const lastUnreadId = unreadMessages[0].id;
        // Mark only the latest unread message as read
        const { error: updateError } = await supabase
          .from('messages')
          .update({ read: true })
          .eq('id', lastUnreadId);

        if (updateError) throw updateError;

        // Decrease unread count by 1
        setUnreadCount(prev => Math.max(0, prev - 1));
        console.log(`Marked latest message (${lastUnreadId}) as read in conversation: ${conversationId}`);
      }
      return true; // Operation completed successfully
    } catch (error) {
      console.error('Error marking conversation as read:', error);
      return false;
    }
  };

  // Fetch user's online status
  const fetchOnlineStatus = async (userId) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase.rpc('get_user_online_status', { p_user_id: userId });
      if (error) throw error;

      // Log the response for debugging
      console.log('Online status response for user', userId, ':', data);
      
      if (data && data.length > 0) {
        const statusData = data[0];
        
        // Check if the user is online based on the is_online flag
        if (statusData.is_online) {
          setOnlineStatus(prevStatus => ({
            ...prevStatus,
            [userId]: 'online',
          }));
        } else if (statusData.last_active_time) {
          // If not online but has last_active_time, show when they were last active
          setOnlineStatus(prevStatus => ({
            ...prevStatus,
            [userId]: statusData.last_active_time,
          }));
        } else {
          setOnlineStatus(prevStatus => ({
            ...prevStatus,
            [userId]: null,
          }));
        }
      } else {
        setOnlineStatus(prevStatus => ({
          ...prevStatus,
          [userId]: null,
        }));
      }
    } catch (error) {
      console.error('Error fetching online status:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { error } = await supabase
          .from('messages')
          .update({ read: true })
          .eq('receiver_id', user.id)
          .eq('read', false);

        if (error) throw error;
        
        // Reset count to zero
        setUnreadCount(0);
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error marking all messages as read:', error);
      return false;
    }
  };

  // Set up real-time subscription for new messages
  useEffect(() => {
    let subscription;
    let settingsSubscription;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Initial fetch
        fetchUnreadCount();
        
        // Subscribe to new messages
        subscription = supabase
          .channel('message-changes')
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${user.id}`,
          }, () => {
            // Increment the unread count when a new message is received
            setUnreadCount(prev => prev + 1);
          })
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${user.id}`,
          }, (payload) => {
            // If a message was marked as read, update the count
            if (payload.new.read && !payload.old.read) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            }
          })
          .subscribe();

        // Set up subscription for user settings changes to track online status
        settingsSubscription = supabase
          .channel('user-settings-changes')
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_message_settings',
          }, (payload) => {
            // Only fetch online status if show_online_status was changed or last_active was updated
            if (payload.old && payload.new && 
                (payload.old.show_online_status !== payload.new.show_online_status || 
                 payload.old.last_active !== payload.new.last_active)) {
              console.log('User settings changed, updating online status for:', payload.new.user_id);
              fetchOnlineStatus(payload.new.user_id);
            }
          })
          .subscribe();

      }
    };

    setupSubscription();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
      if (settingsSubscription) {
        supabase.removeChannel(settingsSubscription);
      }
    };
  }, []);

  return (
    <MessageContext.Provider
      value={{
        unreadCount,
        loading,
        fetchUnreadCount,
        markMessageAsRead,
        markConversationAsRead,
        markAllAsRead,
        onlineStatus,
        fetchOnlineStatus,
        updateCurrentUserLastActive,
      }}
    >
      {children}
    </MessageContext.Provider>
  );
};

export const useMessages = () => {
  const context = useContext(MessageContext);
  if (context === undefined) {
    throw new Error('useMessages must be used within a MessageProvider');
  }
  return context;
};