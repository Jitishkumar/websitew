import { supabase } from '../config/supabase';

/**
 * Finds all @mentions in a given text and creates notifications for the mentioned users.
 * @param {string} text - The text content to scan for mentions.
 * @param {string} senderId - The ID of the user who made the mention.
 * @param {boolean} isAnonymous - Whether the mention sender is anonymous.
 * @param {string} commentId - The ID of the comment where the mention occurred.
 * @param {string} referenceType - The type of item where the mention occurred (e.g., 'confession_comment', 'post_comment').
 */
export const processMentions = async (text, senderId, isAnonymous, commentId, referenceType) => {
  const mentionRegex = /@([a-zA-Z0-9_.]+)/g;
  let match;
  const mentions = new Set(); // Use a Set to store unique usernames

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.add(match[1]);
  }

  if (mentions.size === 0) {
    return;
  }

  const mentionedUsernames = Array.from(mentions);

  try {
    // Fetch profile IDs for mentioned usernames
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, username')
      .in('username', mentionedUsernames);

    if (profileError) {
      console.error('Error fetching mentioned profiles:', profileError);
      return;
    }

    if (!profiles || profiles.length === 0) {
      console.log('No matching profiles found for mentions.');
      return;
    }

    const notificationsToInsert = [];
    let senderDisplayName = 'An anonymous user'; // Default for anonymous
    
    if (!isAnonymous) {
      // Fetch sender's username if not anonymous
      const { data: senderProfile, error: senderProfileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', senderId)
        .single();

      if (senderProfileError) {
        console.error('Error fetching sender profile for mention:', senderProfileError);
      } else if (senderProfile) {
        senderDisplayName = `@${senderProfile.username}`;
      }
    }

    for (const profile of profiles) {
      if (profile.id !== senderId) { // Don't send notification to self
        const notificationContent = `${senderDisplayName} mentioned you in a ${referenceType}.`;
        notificationsToInsert.push({
          recipient_id: profile.id,
          sender_id: senderId,
          type: 'mention',
          content: notificationContent,
          reference_id: commentId, // Now storing the commentId here
        });
      }
    }

    if (notificationsToInsert.length > 0) {
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert(notificationsToInsert);

      if (notificationError) {
        console.error('Error inserting mention notifications:', notificationError);
      } else {
        console.log('Mention notifications created successfully.');
      }
    }

  } catch (error) {
    console.error('Unexpected error in processMentions:', error);
  }
};
