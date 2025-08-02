import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../config/supabase';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch unread notifications count
  const fetchUnreadCount = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Count unread notifications
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', user.id)
          .eq('is_read', false);
          
        if (error) throw error;
        
        setUnreadCount(count || 0);
      }
    } catch (error) {
      console.error('Error fetching unread notifications count:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark a notification as read
  const markAsRead = async (notificationId) => {
    try {
      // Update in the database
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
      
      // Update local count
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('recipient_id', user.id)
          .eq('is_read', false);

        if (error) throw error;
        
        // Reset count to zero
        setUnreadCount(0);
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  };

  // Set up real-time subscription for new notifications
  useEffect(() => {
    let subscription;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Initial fetch
        fetchUnreadCount();
        
        // Subscribe to new notifications
        subscription = supabase
          .channel('notification-changes')
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${user.id}`,
          }, () => {
            // Increment the unread count when a new notification is received
            setUnreadCount(prev => prev + 1);
          })
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${user.id}`,
          }, (payload) => {
            // If a notification was marked as read, update the count
            if (payload.new.is_read && !payload.old.is_read) {
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
    <NotificationContext.Provider
      value={{
        unreadCount,
        loading,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);