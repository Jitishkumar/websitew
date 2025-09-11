import { supabase } from '../lib/supabase';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';

export class GroupsService {
  // Create a new group with avatar
  static async createGroup(name, description, createdBy, avatarUri = null) {
    try {
      let groupData = {
        name: name.trim(),
        description: description.trim(),
        created_by: createdBy
      };

      // Handle avatar upload if provided
      if (avatarUri) {
        try {
          console.log('Uploading group avatar to Cloudinary...');
          const cloudinaryResponse = await uploadToCloudinary(avatarUri, 'image');
          
          if (!cloudinaryResponse || !cloudinaryResponse.url) {
            throw new Error('Failed to upload group avatar');
          }
          
          console.log('Avatar upload successful');
          groupData.avatar_url = cloudinaryResponse.url;
          groupData.avatar_public_id = cloudinaryResponse.publicId;
        } catch (uploadError) {
          console.error('Error uploading avatar:', uploadError);
          if (uploadError.publicId) {
            await deleteFromCloudinary(uploadError.publicId, 'image').catch(console.error);
          }
          throw new Error('Failed to upload group avatar. ' + (uploadError.message || 'Please try again.'));
        }
      }

      // Save group to database
      console.log('Creating group in database...');
      const { data: group, error } = await supabase
        .from('groups')
        .insert(groupData)
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        // Clean up Cloudinary upload if database insert fails
        if (groupData.avatar_public_id) {
          await deleteFromCloudinary(groupData.avatar_public_id, 'image').catch(console.error);
        }
        throw new Error(error.message || 'Failed to create group');
      }

      return group;
    } catch (error) {
      console.error('Error in GroupsService.createGroup:', error);
      throw error;
    }
  }

  // Update group avatar
  static async updateGroupAvatar(groupId, avatarUri) {
    try {
      if (!avatarUri) {
        throw new Error('No avatar URI provided');
      }

      // First, get the current group to check for existing avatar
      const { data: currentGroup, error: fetchError } = await supabase
        .from('groups')
        .select('avatar_public_id')
        .eq('id', groupId)
        .single();

      if (fetchError) throw fetchError;

      // Upload new avatar to Cloudinary
      console.log('Uploading new group avatar to Cloudinary...');
      const cloudinaryResponse = await uploadToCloudinary(avatarUri, 'image');
      
      if (!cloudinaryResponse || !cloudinaryResponse.url) {
        throw new Error('Failed to upload new group avatar');
      }

      // Update group with new avatar
      const { data: updatedGroup, error: updateError } = await supabase
        .from('groups')
        .update({
          avatar_url: cloudinaryResponse.url,
          avatar_public_id: cloudinaryResponse.publicId
        })
        .eq('id', groupId)
        .select()
        .single();

      if (updateError) {
        // Clean up the new upload if update fails
        await deleteFromCloudinary(cloudinaryResponse.publicId, 'image').catch(console.error);
        throw updateError;
      }

      // Delete old avatar from Cloudinary if it exists
      if (currentGroup?.avatar_public_id) {
        await deleteFromCloudinary(currentGroup.avatar_public_id, 'image').catch(console.error);
      }

      return updatedGroup;
    } catch (error) {
      console.error('Error in GroupsService.updateGroupAvatar:', error);
      throw error;
    }
  }

  // Remove group avatar
  static async removeGroupAvatar(groupId) {
    try {
      // Get current group to get the public_id
      const { data: group, error: fetchError } = await supabase
        .from('groups')
        .select('avatar_public_id')
        .eq('id', groupId)
        .single();

      if (fetchError) throw fetchError;
      if (!group?.avatar_public_id) return true; // No avatar to remove

      // Delete from Cloudinary
      await deleteFromCloudinary(group.avatar_public_id, 'image');

      // Update group to remove avatar reference
      const { error: updateError } = await supabase
        .from('groups')
        .update({
          avatar_url: null,
          avatar_public_id: null
        })
        .eq('id', groupId);

      if (updateError) throw updateError;

      return true;
    } catch (error) {
      console.error('Error in GroupsService.removeGroupAvatar:', error);
      throw error;
    }
  }
}
