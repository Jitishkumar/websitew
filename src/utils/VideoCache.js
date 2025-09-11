import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio, Video } from 'expo-av';

class VideoCache {
  constructor() {
    this.cache = new Map();
    this.preloadQueue = [];
    this.maxCacheSize = 50; // Maximum videos to cache
    this.isProcessing = false;
  }

  // Get cache key for video
  getCacheKey(videoUrl) {
    return `video_cache_${videoUrl}`;
  }

  // Check if video is cached
  isCached(videoUrl) {
    return this.cache.has(videoUrl);
  }

  // Add video to cache
  async addToCache(videoUrl, videoData) {
    try {
      // Remove oldest if cache is full
      if (this.cache.size >= this.maxCacheSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      this.cache.set(videoUrl, {
        ...videoData,
        timestamp: Date.now(),
        accessed: Date.now()
      });

      // Store in AsyncStorage for persistence
      await AsyncStorage.setItem(
        this.getCacheKey(videoUrl),
        JSON.stringify({
          url: videoUrl,
          timestamp: Date.now()
        })
      );

      console.log(`Video cached: ${videoUrl}`);
    } catch (error) {
      console.error('Error caching video:', error);
    }
  }

  // Get video from cache
  getCachedVideo(videoUrl) {
    const cached = this.cache.get(videoUrl);
    if (cached) {
      cached.accessed = Date.now();
      return cached;
    }
    return null;
  }

  // Preload video
  async preloadVideo(videoUrl, priority = 'normal') {
    if (this.isCached(videoUrl)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const preloadItem = {
        url: videoUrl,
        priority,
        resolve,
        reject,
        timestamp: Date.now()
      };

      // Add to queue based on priority
      if (priority === 'high') {
        this.preloadQueue.unshift(preloadItem);
      } else {
        this.preloadQueue.push(preloadItem);
      }

      this.processPreloadQueue();
    });
  }

  // Process preload queue
  async processPreloadQueue() {
    if (this.isProcessing || this.preloadQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.preloadQueue.length > 0) {
      const item = this.preloadQueue.shift();
      
      try {
        await this.loadVideo(item.url);
        item.resolve();
      } catch (error) {
        console.error(`Failed to preload video: ${item.url}`, error);
        item.reject(error);
      }
    }

    this.isProcessing = false;
  }

  // Load video
  async loadVideo(videoUrl) {
    try {
      // Create a temporary video component to load the video
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: videoUrl },
        { shouldPlay: false }
      );

      if (status.isLoaded) {
        await this.addToCache(videoUrl, {
          duration: status.durationMillis,
          isLoaded: true
        });
        
        // Unload the temporary sound
        await sound.unloadAsync();
      }
    } catch (error) {
      console.error('Error loading video:', error);
      throw error;
    }
  }

  // Clear old cache entries
  async clearOldCache(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    const now = Date.now();
    const keysToRemove = [];

    for (const [url, data] of this.cache.entries()) {
      if (now - data.timestamp > maxAge) {
        keysToRemove.push(url);
      }
    }

    for (const key of keysToRemove) {
      this.cache.delete(key);
      try {
        await AsyncStorage.removeItem(this.getCacheKey(key));
      } catch (error) {
        console.error('Error removing cached video:', error);
      }
    }

    console.log(`Cleared ${keysToRemove.length} old cache entries`);
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      queueLength: this.preloadQueue.length,
      isProcessing: this.isProcessing
    };
  }

  // Generate thumbnail URL from video URL
  getThumbnailUrl(videoUrl, width = 400, height = 600) {
    if (videoUrl.includes('cloudinary.com')) {
      return videoUrl
        .replace('/video/upload/', `/image/upload/c_fill,w_${width},h_${height},q_auto:low/`)
        .replace(/\.(mp4|mov|avi|webm)$/, '.jpg');
    }
    return null;
  }

  // Preload adjacent videos (Instagram/YouTube strategy)
  preloadAdjacentVideos(videos, currentIndex, range = 2) {
    const preloadPromises = [];
    
    // Preload current video with high priority
    if (videos[currentIndex]) {
      preloadPromises.push(
        this.preloadVideo(videos[currentIndex].media_url, 'high')
      );
    }

    // Preload next videos
    for (let i = 1; i <= range; i++) {
      const nextIndex = currentIndex + i;
      if (nextIndex < videos.length) {
        preloadPromises.push(
          this.preloadVideo(videos[nextIndex].media_url, 'normal')
        );
      }
    }

    // Preload previous video
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      preloadPromises.push(
        this.preloadVideo(videos[prevIndex].media_url, 'normal')
      );
    }

    return Promise.allSettled(preloadPromises);
  }
}

// Export singleton instance
export const videoCache = new VideoCache();
export default VideoCache;
