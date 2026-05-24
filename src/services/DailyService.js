import { DAILY_API_KEY } from '@env';

const DAILY_API_BASE_URL = 'https://api.daily.co/v1';

/**
 * Daily.co API Service
 * Handles room creation and management
 */
class DailyService {
  /**
   * Create a new Daily.co room
   * @param {string} roomName - Unique room name
   * @returns {Promise<{url: string, name: string}>} Room details
   */
  static async createRoom(roomName) {
    try {
      const response = await fetch(`${DAILY_API_BASE_URL}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          name: roomName,
          privacy: 'public',
          properties: {
            enable_screenshare: false,
            enable_chat: false,
            enable_knocking: false,
            enable_prejoin_ui: false,
            start_video_off: false,
            start_audio_off: false,
            owner_only_broadcast: false,
            enable_recording: 'cloud',
            max_participants: 2,
            eject_at_room_exp: true,
            exp: Math.floor(Date.now() / 1000) + (60 * 10), // Expire in 10 minutes
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Daily.co API error:', errorData);
        throw new Error(`Failed to create room: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      console.log('Daily.co room created successfully:', {
        url: data.url,
        name: data.name,
        privacy: data.privacy,
        config: data.config
      });
      return {
        url: data.url,
        name: data.name,
      };
    } catch (error) {
      console.error('Error creating Daily.co room:', error);
      throw error;
    }
  }

  /**
   * Delete a Daily.co room
   * @param {string} roomName - Room name to delete
   * @returns {Promise<boolean>} Success status
   */
  static async deleteRoom(roomName) {
    try {
      const response = await fetch(`${DAILY_API_BASE_URL}/rooms/${roomName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${DAILY_API_KEY}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to delete room:', response.statusText);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting Daily.co room:', error);
      return false;
    }
  }

  /**
   * Get room information
   * @param {string} roomName - Room name
   * @returns {Promise<Object>} Room details
   */
  static async getRoomInfo(roomName) {
    try {
      const response = await fetch(`${DAILY_API_BASE_URL}/rooms/${roomName}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${DAILY_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get room info: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting Daily.co room info:', error);
      throw error;
    }
  }

  /**
   * Check if API key is configured
   * @returns {boolean} True if API key exists
   */
  static isConfigured() {
    console.log('Daily API Key check:', {
      exists: !!DAILY_API_KEY,
      value: DAILY_API_KEY ? `${DAILY_API_KEY.substring(0, 10)}...` : 'undefined',
      isDefault: DAILY_API_KEY === 'YOUR_DAILY_API_KEY_HERE'
    });
    return !!DAILY_API_KEY && DAILY_API_KEY !== 'YOUR_DAILY_API_KEY_HERE';
  }
}

export default DailyService;
