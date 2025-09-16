import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class NotificationService {
  static async registerForPushNotifications() {
    let token;

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          console.log('Push notification permissions denied');
          return null;
        }
        
        try {
          token = (await Notifications.getExpoPushTokenAsync({
            projectId: '017b33e7-453f-45db-95db-9ef1c4285c72',
          })).data;
          
          console.log('Push token:', token);
        } catch (tokenError) {
          console.log('Error getting push token (likely in development):', tokenError.message);
          return null;
        }
      } else {
        console.log('Push notifications require physical device');
        return null;
      }

      return token;
    } catch (error) {
      console.log('Error registering for push notifications:', error.message);
      return null;
    }
  }

  static async savePushToken(userId, token) {
    try {
      const { error } = await supabase
        .from('user_push_tokens')
        .upsert({
          user_id: userId,
          push_token: token,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      console.log('Push token saved successfully');
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }

  static async sendMessageNotification(recipientUserId, senderName, messageText) {
    try {
      // Get recipient's push token
      const { data: tokenData, error } = await supabase
        .from('user_push_tokens')
        .select('push_token')
        .eq('user_id', recipientUserId)
        .single();

      if (error || !tokenData?.push_token) {
        console.log('No push token found for user:', recipientUserId);
        return;
      }

      // Send push notification
      const message = {
        to: tokenData.push_token,
        sound: 'default',
        title: `New message from ${senderName}`,
        body: messageText.length > 100 ? messageText.substring(0, 97) + '...' : messageText,
        data: {
          type: 'message',
          senderId: recipientUserId,
          senderName: senderName
        },
        badge: 1,
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      console.log('Notification sent:', result);
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

}
