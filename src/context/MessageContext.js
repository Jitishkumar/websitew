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

  // Fetch unread messages count (excluding dismissed messages)
  const fetchUnreadCount = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Count unread messages that haven't been dismissed by this user
        const { data, error } = await supabase
          .from('messages')
          .select('id, dismissed_by')
          .eq('receiver_id', user.id)
          .eq('read', false);
          
        if (error) throw error;
        
        // Filter out messages dismissed by current user
        const undismissedMessages = data?.filter(msg => {
          const dismissedBy = msg.dismissed_by || [];
          return !dismissedBy.includes(user.id);
        }) || [];
        
        setUnreadCount(undismissedMessages.length);
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

  // Clear local unread count without marking backend (for when read receipts are off)
  const clearLocalUnreadCount = async (conversationId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('User not authenticated');
        return { success: false, count: 0 };
      }

      // Get unread messages for this conversation
      const { data: unreadMessages, error: fetchError } = await supabase
        .from('messages')
        .select('id, dismissed_by')
        .eq('conversation_id', conversationId)
        .eq('receiver_id', user.id)
        .eq('read', false);

      if (fetchError) throw fetchError;

      if (unreadMessages && unreadMessages.length > 0) {
        // Mark messages as dismissed for this user (without marking as read)
        for (const message of unreadMessages) {
          const dismissedBy = message.dismissed_by || [];
          
          // Only update if user hasn't already dismissed
          if (!dismissedBy.includes(user.id)) {
            await supabase
              .from('messages')
              .update({ 
                dismissed_by: [...dismissedBy, user.id]
              })
              .eq('id', message.id);
          }
        }
        
        // Decrease local unread count
        setUnreadCount(prev => Math.max(0, prev - unreadMessages.length));
        console.log(`Dismissed ${unreadMessages.length} notifications for conversation: ${conversationId}`);
      }
      
      return { success: true, count: unreadMessages?.length || 0 };
    } catch (error) {
      console.error('Error clearing local unread count:', error);
      return { success: false, count: 0 };
    }
  };

  // Mark all messages from a conversation as read (respects read receipt settings)
  const markConversationAsRead = async (conversationId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('User not authenticated');
        return false;
      }
      
      // Check read receipt preference
      const { data: settings, error: settingsError } = await supabase
        .from('user_message_settings')
        .select('show_read_receipts')
        .eq('user_id', user.id)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('Error fetching message settings:', settingsError);
      }

      // If read receipts are disabled, only clear local count
      if (settings && settings.show_read_receipts === false) {
        console.log('Read receipts disabled; clearing local count only.');
        const result = await clearLocalUnreadCount(conversationId);
        return result.success;
      }

      // Read receipts enabled: mark as read in backend
      const { data: unreadMessages, error: fetchError } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('receiver_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      if (unreadMessages && unreadMessages.length > 0) {
        const unreadIds = unreadMessages.map(message => message.id);

        // Mark all unread messages as read in backend
        const { error: updateError } = await supabase
          .from('messages')
          .update({ read: true })
          .in('id', unreadIds);

        if (updateError) throw updateError;

        // Decrease unread count
        setUnreadCount(prev => Math.max(0, prev - unreadIds.length));
        console.log(`Marked ${unreadIds.length} messages as read (with receipts) in conversation: ${conversationId}`);
      }
      
      // Refresh total unread count
      await fetchUnreadCount();
      return true;
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
        clearLocalUnreadCount,
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