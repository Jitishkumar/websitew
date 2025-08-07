import { supabase } from '../lib/supabase'; // Adjust path as needed

export class MatchingUtils {
  
  /**
   * Generate a unique call ID
   */
  static generateCallId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 9);
    return `call_${timestamp}_${randomStr}`;
  }

  /**
   * Find available users for matching, prioritizing opposite gender
   */
  static async findAvailableMatch(currentUserId, currentUserGender) {
    try {
      // Get users not currently in active calls
      const activeCallUsers = await this.getActiveCallUsers();
      
      // Build the base query excluding current user and users in active calls
      let excludeIds = [currentUserId, ...activeCallUsers];
      
      // Priority 1: Try to find opposite gender users
      if (currentUserGender && (currentUserGender === 'male' || currentUserGender === 'female')) {
        const oppositeGender = currentUserGender === 'male' ? 'female' : 'male';
        const oppositeMatches = await this.getUsersByGender(oppositeGender, excludeIds);
        
        if (oppositeMatches.length > 0) {
          return this.selectRandomUser(oppositeMatches);
        }
      }
      
      // Priority 2: If no opposite gender, try same gender
      if (currentUserGender) {
        const sameGenderMatches = await this.getUsersByGender(currentUserGender, excludeIds);
        if (sameGenderMatches.length > 0) {
          return this.selectRandomUser(sameGenderMatches);
        }
      }
      
      // Priority 3: Get any available user
      const anyMatches = await this.getAnyAvailableUsers(excludeIds);
      if (anyMatches.length > 0) {
        return this.selectRandomUser(anyMatches);
      }
      
      return null; // No matches found
      
    } catch (error) {
      console.error('Error finding available match:', error);
      throw error;
    }
  }

  /**
   * Get users currently in active calls
   */
  static async getActiveCallUsers() {
    const { data, error } = await supabase
      .from('call_sessions')
      .select('user1_id, user2_id')
      .eq('status', 'active');
    
    if (error) {
      console.error('Error getting active call users:', error);
      return [];
    }
    
    const activeUsers = [];
    data.forEach(session => {
      if (session.user1_id) activeUsers.push(session.user1_id);
      if (session.user2_id) activeUsers.push(session.user2_id);
    });
    
    return activeUsers;
  }

  /**
   * Get users by specific gender
   */
  static async getUsersByGender(gender, excludeIds = []) {
    let query = supabase
      .from('profiles')
      .select('id, username, gender, full_name')
      .eq('gender', gender);
    
    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.map(id => `"${id}"`).join(',')})`);
    }
    
    const { data, error } = await query.limit(50);
    
    if (error) {
      console.error('Error getting users by gender:', error);
      return [];
    }
    
    return data || [];
  }

  /**
   * Get any available users
   */
  static async getAnyAvailableUsers(excludeIds = []) {
    let query = supabase
      .from('profiles')
      .select('id, username, gender, full_name')
      .not('username', 'is', null); // Ensure username exists
    
    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.map(id => `"${id}"`).join(',')})`);
    }
    
    const { data, error } = await query.limit(50);
    
    if (error) {
      console.error('Error getting any available users:', error);
      return [];
    }
    
    return data || [];
  }

  /**
   * Select a random user from the array
   */
  static selectRandomUser(users) {
    if (!users || users.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * users.length);
    return users[randomIndex];
  }

  /**
   * Create a call session
   */
  static async createCallSession(callId, user1, user2) {
    try {
      const { data, error } = await supabase
        .from('call_sessions')
        .insert({
          call_id: callId,
          user1_id: user1.id,
          user1_name: user1.username,
          user2_id: user2.id,
          user2_name: user2.username,
          status: 'active',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating call session:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in createCallSession:', error);
      throw error;
    }
  }

  /**
   * Update call session status
   */
  static async updateCallSession(callId, status, additionalData = {}) {
    try {
      const updateData = {
        status,
        ...additionalData
      };

      if (status === 'ended') {
        updateData.ended_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('call_sessions')
        .update(updateData)
        .eq('call_id', callId)
        .select()
        .single();

      if (error) {
        console.error('Error updating call session:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in updateCallSession:', error);
      throw error;
    }
  }

  /**
   * Get call session by call ID
   */
  static async getCallSession(callId) {
    try {
      const { data, error } = await supabase
        .from('call_sessions')
        .select('*')
        .eq('call_id', callId)
        .single();

      if (error) {
        console.error('Error getting call session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getCallSession:', error);
      return null;
    }
  }

  /**
   * Check if a user is currently in an active call
   */
  static async isUserInActiveCall(userId) {
    try {
      const { data, error } = await supabase
        .from('call_sessions')
        .select('id')
        .eq('status', 'active')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .limit(1);

      if (error) {
        console.error('Error checking if user is in active call:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error in isUserInActiveCall:', error);
      return false;
    }
  }

  /**
   * Clean up abandoned call sessions (optional utility)
   */
  static async cleanupAbandonedSessions() {
    try {
      // Mark sessions older than 30 minutes as ended
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from('call_sessions')
        .update({ 
          status: 'ended', 
          ended_at: new Date().toISOString() 
        })
        .eq('status', 'active')
        .lt('created_at', thirtyMinutesAgo);

      if (error) {
        console.error('Error cleaning up abandoned sessions:', error);
      }
    } catch (error) {
      console.error('Error in cleanupAbandonedSessions:', error);
    }
  }
}