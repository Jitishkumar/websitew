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
        console.log('Not enough waiting users to match');
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
                status: 'matched', // Set to 'matched' initially, will be 'active' when both accept
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
   */
  async addToWaitingQueue(supabase, userId, username) {
    try {
      // First, remove any existing entries for this user to prevent duplicates
      await supabase
        .from('waiting_users')
        .delete()
        .eq('user_id', userId);

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

        return {
          matched: true,
          callData: {
            id: matchedCall.id,
            roomName: matchedCall.call_id,
            roomUrl: matchedCall.room_url,
            isUser1: matchedCall.user1_id === userId,
            otherUserId: otherUserId,
            otherUserName: otherUserName,
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
   */
  async endCall(supabase, callId) {
    try {
      // Update call status to ended
      const { error: updateError } = await supabase
        .from('active_calls')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', callId);

      if (updateError) {
        console.error('Error ending call:', updateError);
        return { success: false, error: updateError };
      }

      // Get call data to clean up users
      const { data: callData } = await supabase
        .from('active_calls')
        .select('user1_id, user2_id')
        .eq('id', callId)
        .single();

      if (callData) {
        // Remove both users from waiting queue
        await supabase
          .from('waiting_users')
          .delete()
          .or(`user_id.eq.${callData.user1_id},user_id.eq.${callData.user2_id}`);
      }

      console.log('✅ Call ended successfully');
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