import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cache utility for storing and retrieving data
 * Implements TTL (Time To Live) for automatic cache expiration
 */

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

export class CacheManager {
  /**
   * Save data to cache with TTL
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
   */
  static async set(key, data, ttl = DEFAULT_TTL) {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttl
      };
      
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
      console.log(`✅ Cached: ${key} (expires in ${ttl / 1000}s)`);
      return true;
    } catch (error) {
      console.error(`❌ Cache set error for ${key}:`, error);
      return false;
    }
  }

  /**
   * Get data from cache if not expired
   * @param {string} key - Cache key
   * @returns {any|null} - Cached data or null if expired/not found
   */
  static async get(key) {
    try {
      const cached = await AsyncStorage.getItem(key);
      
      if (!cached) {
        console.log(`⚠️ Cache miss: ${key}`);
        return null;
      }

      const cacheData = JSON.parse(cached);
      const now = Date.now();

      // Check if cache has expired
      if (now > cacheData.expiresAt) {
        console.log(`⏰ Cache expired: ${key}`);
        await this.remove(key);
        return null;
      }

      const age = Math.round((now - cacheData.timestamp) / 1000);
      console.log(`✅ Cache hit: ${key} (age: ${age}s)`);
      return cacheData.data;
    } catch (error) {
      console.error(`❌ Cache get error for ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove specific cache entry
   * @param {string} key - Cache key
   */
  static async remove(key) {
    try {
      await AsyncStorage.removeItem(key);
      console.log(`🗑️ Removed cache: ${key}`);
      return true;
    } catch (error) {
      console.error(`❌ Cache remove error for ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all cache entries with a specific prefix
   * @param {string} prefix - Cache key prefix
   */
  static async clearByPrefix(prefix) {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const keysToRemove = keys.filter(key => key.startsWith(prefix));
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`🗑️ Cleared ${keysToRemove.length} cache entries with prefix: ${prefix}`);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Cache clear error for prefix ${prefix}:`, error);
      return false;
    }
  }

  /**
   * Clear all cache
   */
  static async clearAll() {
    try {
      await AsyncStorage.clear();
      console.log('🗑️ Cleared all cache');
      return true;
    } catch (error) {
      console.error('❌ Cache clear all error:', error);
      return false;
    }
  }

  /**
   * Check if cache exists and is valid
   * @param {string} key - Cache key
   * @returns {boolean} - True if cache exists and is valid
   */
  static async isValid(key) {
    try {
      const cached = await AsyncStorage.getItem(key);
      
      if (!cached) return false;

      const cacheData = JSON.parse(cached);
      const now = Date.now();

      return now <= cacheData.expiresAt;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cache age in seconds
   * @param {string} key - Cache key
   * @returns {number|null} - Age in seconds or null if not found
   */
  static async getAge(key) {
    try {
      const cached = await AsyncStorage.getItem(key);
      
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      const age = Math.round((Date.now() - cacheData.timestamp) / 1000);
      
      return age;
    } catch (error) {
      return null;
    }
  }
}

// Cache keys constants
export const CACHE_KEYS = {
  POSTS: 'cache_posts',
  STORIES: 'cache_stories',
  USER_PROFILE: 'cache_user_profile',
  CONVERSATIONS: 'cache_conversations',
  NOTIFICATIONS: 'cache_notifications',
  TRENDING: 'cache_trending',
  REELS: 'cache_reels',
  CONFESSIONS: 'cache_confessions',
};

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  SHORT: 2 * 60 * 1000,      // 2 minutes
  MEDIUM: 5 * 60 * 1000,     // 5 minutes
  LONG: 15 * 60 * 1000,      // 15 minutes
  VERY_LONG: 60 * 60 * 1000, // 1 hour
};
