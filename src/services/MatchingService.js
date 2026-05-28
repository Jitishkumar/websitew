/**
 * Matching Service for Expo App
 * Handles automatic matching of waiting users with database constraint fixes
 */

export const MatchingService = {
  /**
   * Find and match waiting users
   * Fixed to remove users from queue instead of updating to avoid constraint violations
   */
  async matchWaitingUsers(supabase) {
    try {
      // Get all waiting users
      const { data: waitingUsers, error: fetchError } = await supabase
        .from('waiting_users')
        .select('*')
        .eq('status', 'waiting')
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error('Error fetching waiting users:', fetchError);
        return;
      }

      if (!waitingUsers || waitingUsers.length < 2) {
        // Silently return - this is normal when there aren't enough users
        return;
      }

      // Match users in pairs
      for (let i = 0; i < waitingUsers.length - 1; i += 2) {
        const user1 = waitingUsers[i];
        const user2 = waitingUsers[i + 1];

        // Generate shared room name
        const roomName = `room_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const roomUrl = `https://meet.jit.si/${roomName}`;

        try {
          // Create active call record
          const { data: callData, error: callError } = await supabase
            .from('active_calls')
            .insert([
              {
                call_id: roomName,
                user1_id: user1.user_id,
                user1_name: user1.username,
                user2_id: user2.user_id,
                user2_name: user2.username,
                status: 'matched', // Set to 'matched' initially
                room_url: roomUrl,
              },
            ])
            .select();

          if (callError) {
            console.error('Error creating call record:', callError);
            continue;
          }

          console.log('Call record created:', callData);

          // FIXED: Remove both users from waiting queue (don't update, just delete)
          // This prevents the "duplicate key value violates unique constraint" error
          const { error: deleteError1 } = await supabase
            .from('waiting_users')
            .delete()
            .eq('user_id', user1.user_id);

          if (deleteError1) {
            console.error('Error removing user1 from queue:', deleteError1);
          }

          const { error: deleteError2 } = await supabase
            .from('waiting_users')
            .delete()
            .eq('user_id', user2.user_id);

          if (deleteError2) {
            console.error('Error removing user2 from queue:', deleteError2);
          }

          console.log(`✅ Matched ${user1.username} with ${user2.username} in room: ${roomName}`);
        } catch (pairError) {
          console.error('Error matching pair:', pairError);
        }
      }
    } catch (error) {
      console.error('Error in matching service:', error);
    }
  },

  /**
   * Add user to waiting queue
   * FIXED: Delete old records first to prevent duplicates
   */
  async addToWaitingQueue(supabase, userId, username) {
    try {
      console.log('🧹 Cleaning up old records for user:', userId);
      
      // CRITICAL: Delete ALL old records for this user first
      // This prevents "already waiting" errors
      const { error: deleteWaitingError } = await supabase
        .from('waiting_users')
        .delete()
        .eq('user_id', userId);

      if (deleteWaitingError) {
        console.error('⚠️ Error deleting old waiting records:', deleteWaitingError);
      } else {
        console.log('✅ Deleted old waiting records');
      }

      // Also delete any stuck active calls for this user
      const { error: deleteCallsError } = await supabase
        .from('active_calls')
        .delete()
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .in('status', ['matched', 'active']);

      if (deleteCallsError) {
        console.error('⚠️ Error deleting old active calls:', deleteCallsError);
      } else {
        console.log('✅ Deleted old active calls');
      }

      // Generate unique call ID for this waiting session
      const callId = `call_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Add user to waiting queue
      const { error: waitingError } = await supabase
        .from('waiting_users')
        .insert([
          {
            user_id: userId,
            username: username,
            call_id: callId,
            status: 'waiting',
          },
        ]);

      if (waitingError) {
        console.error('Error adding to waiting queue:', waitingError);
        return { success: false, error: waitingError };
      }

      console.log('✅ Added to waiting queue with call_id:', callId);
      return { success: true, callId };
    } catch (error) {
      console.error('Error in addToWaitingQueue:', error);
      return { success: false, error };
    }
  },

  /**
   * Check if user has been matched
   */
  async checkForMatch(supabase, userId) {
    try {
      // Check if this user has been matched
      const { data: matchedCall, error: matchError } = await supabase
        .from('active_calls')
        .select('*')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .in('status', ['matched', 'active'])
        .single();

      if (matchError && matchError.code !== 'PGRST116') {
        // PGRST116 means no rows found, which is expected
        console.error('Error checking for match:', matchError);
        return { matched: false };
      }

      if (matchedCall) {
        // User has been matched!
        console.log('✅ Match found!', matchedCall);

        // Get other user's details
        const otherUserId = matchedCall.user1_id === userId ? matchedCall.user2_id : matchedCall.user1_id;
        const otherUserName = matchedCall.user1_id === userId ? matchedCall.user2_name : matchedCall.user1_name;

        // Fetch other user's profile photo from profiles table
        const { data: otherUserProfile } = await supabase
          .from('profiles')
          .select('avatar_url, username')
          .eq('id', otherUserId)
          .single();

        return {
          matched: true,
          callData: {
            id: matchedCall.id,
            roomName: matchedCall.call_id,
            roomUrl: matchedCall.room_url,
            isUser1: matchedCall.user1_id === userId,
            otherUserId: otherUserId,
            otherUserName: otherUserProfile?.username || otherUserName,
            otherUserAvatar: otherUserProfile?.avatar_url || null,
            status: matchedCall.status
          }
        };
      }

      return { matched: false };
    } catch (error) {
      console.error('Error checking for match:', error);
      return { matched: false, error };
    }
  },

  /**
   * Accept a match (both users need to accept)
   */
  async acceptMatch(supabase, callId, userId) {
    try {
      // Get the call data
      const { data: callData, error: fetchError } = await supabase
        .from('active_calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (fetchError) {
        console.error('Error fetching call data:', fetchError);
        return { success: false, error: fetchError };
      }

      // Mark user as accepted
      const updateField = callData.user1_id === userId ? 'user1_accepted' : 'user2_accepted';
      
      const { error: updateError } = await supabase
        .from('active_calls')
        .update({ [updateField]: true })
        .eq('id', callId);

      if (updateError) {
        console.error('Error updating acceptance:', updateError);
        return { success: false, error: updateError };
      }

      // Check if both users have accepted
      const { data: updatedCall, error: checkError } = await supabase
        .from('active_calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (checkError) {
        console.error('Error checking acceptance status:', checkError);
        return { success: false, error: checkError };
      }

      // If both accepted, update status to active
      if (updatedCall.user1_accepted && updatedCall.user2_accepted) {
        const { error: activateError } = await supabase
          .from('active_calls')
          .update({ 
            status: 'active',
            started_at: new Date().toISOString()
          })
          .eq('id', callId);

        if (activateError) {
          console.error('Error activating call:', activateError);
          return { success: false, error: activateError };
        }

        console.log('✅ Both users accepted, call is now active');
        return { success: true, bothAccepted: true, callData: updatedCall };
      }

      console.log('✅ User accepted, waiting for other user');
      return { success: true, bothAccepted: false, callData: updatedCall };
    } catch (error) {
      console.error('Error accepting match:', error);
      return { success: false, error };
    }
  },

  /**
   * Reject a match
   */
  async rejectMatch(supabase, callId, userId) {
    try {
      // End the call
      const { error: updateError } = await supabase
        .from('active_calls')
        .update({
          status: 'rejected',
          ended_at: new Date().toISOString(),
        })
        .eq('id', callId);

      if (updateError) {
        console.error('Error rejecting match:', updateError);
        return { success: false, error: updateError };
      }

      // Remove user from waiting queue if still there
      await supabase
        .from('waiting_users')
        .delete()
        .eq('user_id', userId);

      console.log('✅ Match rejected successfully');
      return { success: true };
    } catch (error) {
      console.error('Error rejecting match:', error);
      return { success: false, error };
    }
  },

  /**
   * End a call and disconnect both users
   * FIXED: Delete records for BOTH users
   */
  async endCall(supabase, callId) {
    try {
      console.log('🔚 Ending call:', callId);
      
      // Get call data to find both users
      const { data: callData, error: fetchError } = await supabase
        .from('active_calls')
        .select('user1_id, user2_id, call_id')
        .eq('call_id', callId)
        .single();

      if (fetchError) {
        console.error('Error fetching call data:', fetchError);
      }

      // Update call status to ended
      const { error: updateError } = await supabase
        .from('active_calls')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('call_id', callId);

      if (updateError) {
        console.error('Error updating call status:', updateError);
      } else {
        console.log('✅ Updated call status to ended');
      }

      // CRITICAL: Delete from active_calls table
      const { error: deleteCallError } = await supabase
        .from('active_calls')
        .delete()
        .eq('call_id', callId);

      if (deleteCallError) {
        console.error('Error deleting from active_calls:', deleteCallError);
      } else {
        console.log('✅ Deleted from active_calls');
      }

      // CRITICAL: Delete from waiting_users for BOTH users
      if (callData) {
        // Delete user1 from waiting
        const { error: deleteUser1Error } = await supabase
          .from('waiting_users')
          .delete()
          .eq('user_id', callData.user1_id);

        if (deleteUser1Error) {
          console.error('Error deleting user1 from waiting:', deleteUser1Error);
        } else {
          console.log('✅ Deleted user1 from waiting_users');
        }

        // Delete user2 from waiting
        const { error: deleteUser2Error } = await supabase
          .from('waiting_users')
          .delete()
          .eq('user_id', callData.user2_id);

        if (deleteUser2Error) {
          console.error('Error deleting user2 from waiting:', deleteUser2Error);
        } else {
          console.log('✅ Deleted user2 from waiting_users');
        }
      }

      console.log('✅ Call ended successfully and records deleted');
      return { success: true };
    } catch (error) {
      console.error('Error ending call:', error);
      return { success: false, error };
    }
  },

  /**
   * Remove user from waiting queue (skip)
   */
  async skipUser(supabase, userId) {
    try {
      const { error } = await supabase
        .from('waiting_users')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error skipping user:', error);
        return { success: false, error };
      }

      console.log('✅ User skipped successfully');
      return { success: true };
    } catch (error) {
      console.error('Error in skip:', error);
      return { success: false, error };
    }
  },

  /**
   * Handle user disconnect (cleanup)
   */
  async handleUserDisconnect(supabase, userId) {
    try {
      // Remove from waiting queue
      await supabase
        .from('waiting_users')
        .delete()
        .eq('user_id', userId);

      // End any active calls
      const { data: activeCalls } = await supabase
        .from('active_calls')
        .select('id')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .eq('status', 'active');

      if (activeCalls && activeCalls.length > 0) {
        for (const call of activeCalls) {
          await this.endCall(supabase, call.id);
        }
      }

      console.log('✅ User disconnect handled');
      return { success: true };
    } catch (error) {
      console.error('Error handling disconnect:', error);
      return { success: false, error };
    }
  },
};