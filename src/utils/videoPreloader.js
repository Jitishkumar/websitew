/**
 * Video Preloader - Manages video loading for current, previous, and next videos
 * Prevents loading all videos at once
 */

class VideoPreloaderClass {
  constructor() {
    this.loadedVideos = new Map(); // videoId -> { uri, loaded, timestamp }
    this.currentIndex = 0;
    this.videos = [];
    this.maxCachedVideos = 5; // Keep only 5 videos in memory
  }

  /**
   * Set the video list and current index
   */
  setVideos(videos, currentIndex = 0) {
    this.videos = videos;
    this.currentIndex = currentIndex;
    this.preloadVideos();
  }

  /**
   * Update current index and preload adjacent videos
   */
  setCurrentIndex(index) {
    if (index === this.currentIndex) return;
    
    this.currentIndex = index;
    this.preloadVideos();
    this.cleanupOldVideos();
  }

  /**
   * Preload current, previous, and next videos
   */
  preloadVideos() {
    const indicesToLoad = [
      this.currentIndex - 1, // Previous
      this.currentIndex,     // Current
      this.currentIndex + 1  // Next
    ];

    indicesToLoad.forEach(index => {
      if (index >= 0 && index < this.videos.length) {
        const video = this.videos[index];
        if (video && !this.isVideoLoaded(video.id)) {
          this.markVideoAsLoaded(video.id, video.media_url);
        }
      }
    });

    console.log(`🎬 Preloaded videos: ${indicesToLoad.filter(i => i >= 0 && i < this.videos.length).length}`);
  }

  /**
   * Mark a video as loaded
   */
  markVideoAsLoaded(videoId, uri) {
    this.loadedVideos.set(videoId, {
      uri,
      loaded: true,
      timestamp: Date.now()
    });
  }

  /**
   * Check if video is loaded
   */
  isVideoLoaded(videoId) {
    return this.loadedVideos.has(videoId);
  }

  /**
   * Get video info
   */
  getVideoInfo(videoId) {
    return this.loadedVideos.get(videoId);
  }

  /**
   * Should this video be loaded?
   */
  shouldLoadVideo(index) {
    // Load current, previous, and next only
    const distance = Math.abs(index - this.currentIndex);
    return distance <= 1;
  }

  /**
   * Clean up videos that are far from current index
   */
  cleanupOldVideos() {
    const videosToKeep = new Set();
    
    // Keep current, previous, and next
    for (let i = this.currentIndex - 1; i <= this.currentIndex + 1; i++) {
      if (i >= 0 && i < this.videos.length) {
        videosToKeep.add(this.videos[i].id);
      }
    }

    // Remove videos not in the keep set
    for (const [videoId] of this.loadedVideos) {
      if (!videosToKeep.has(videoId)) {
        this.loadedVideos.delete(videoId);
        console.log(`🗑️ Unloaded video: ${videoId}`);
      }
    }

    // If still too many, remove oldest
    if (this.loadedVideos.size > this.maxCachedVideos) {
      const sorted = Array.from(this.loadedVideos.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = sorted.slice(0, this.loadedVideos.size - this.maxCachedVideos);
      toRemove.forEach(([videoId]) => {
        this.loadedVideos.delete(videoId);
        console.log(`🗑️ Removed old video: ${videoId}`);
      });
    }
  }

  /**
   * Clear all loaded videos
   */
  clear() {
    this.loadedVideos.clear();
    this.videos = [];
    this.currentIndex = 0;
    console.log('🗑️ Cleared all videos');
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      loadedCount: this.loadedVideos.size,
      totalVideos: this.videos.length,
      currentIndex: this.currentIndex
    };
  }
}

export const VideoPreloader = new VideoPreloaderClass();
