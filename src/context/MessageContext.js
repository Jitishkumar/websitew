import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const MessageContext = createContext();

export const MessageProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

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

  // Mark all messages as read
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
      }
    };

    setupSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, []);

  // Refresh unread count periodically
  useEffect(() => {
    // Initial fetch
    fetchUnreadCount();
    
    // Set up periodic refresh (every 60 seconds)
    const intervalId = setInterval(() => {
      fetchUnreadCount();
    }, 60000);
    
    // Clean up interval on unmount
    return () => {
      clearInterval(intervalId);
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