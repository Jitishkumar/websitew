import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView, Modal, Platform, ActionSheetIOS } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GroupsService } from '../services/GroupsService';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';

const GroupInfoScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { groupId } = route.params;

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showMemberOptions, setShowMemberOptions] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);
  const [loadingJoinRequests, setLoadingJoinRequests] = useState(false);

  useEffect(() => {
    getCurrentUser();
    fetchGroupInfo();
  }, []);

  useEffect(() => {
    if (isAdmin && group) {
      fetchJoinRequests();
    }
  }, [isAdmin, group]);

  const getCurrentUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      console.log('getCurrentUser result:', { user: user?.id, error });
      if (user) {
        setCurrentUserId(user.id);
        console.log('Current user ID set to:', user.id);
      } else {
        console.log('No current user ID available');
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };

  const updateGroupAvatar = async (uri) => {
    try {
      setUploadingAvatar(true);
      
      // Upload image to Cloudinary
      const cloudinaryResult = await uploadToCloudinary(uri, 'image');
      
      // Update group avatar URL in Supabase
      const { error } = await supabase
        .from('groups')
        .update({ 
          avatar_url: cloudinaryResult.url
        })
        .eq('id', groupId);

      if (error) throw error;
      
      // Update the local state
      setGroup(prev => ({
        ...prev,
        avatar_url: cloudinaryResult.url,
        avatar_public_id: cloudinaryResult.publicId // Keep locally for deletion
      }));
      
      Alert.alert('Success', 'Group avatar updated successfully');
    } catch (error) {
      console.error('Error updating group avatar:', error);
      Alert.alert('Error', error.message || 'Failed to update group avatar. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };
  
  const removeGroupAvatar = async () => {
    try {
      setUploadingAvatar(true);
      
      // Delete from Cloudinary if public_id exists
      if (group?.avatar_public_id) {
        try {
          await deleteFromCloudinary(group.avatar_public_id, 'image');
        } catch (cloudinaryError) {
          console.warn('Failed to delete from Cloudinary:', cloudinaryError);
          // Continue with database update even if Cloudinary deletion fails
        }
      }
      
      // Remove avatar URL from Supabase
      const { error } = await supabase
        .from('groups')
        .update({ 
          avatar_url: null
        })
        .eq('id', groupId);

      if (error) throw error;
      
      // Update the local state
      setGroup(prev => ({
        ...prev,
        avatar_url: null,
        avatar_public_id: null
      }));
      
      Alert.alert('Success', 'Group avatar removed');
    } catch (error) {
      console.error('Error removing group avatar:', error);
      Alert.alert('Error', 'Failed to remove group avatar. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };
  
  const handleAvatarPress = async () => {
    console.log('Avatar pressed - isAdmin:', isAdmin, 'currentUserId:', currentUserId);
    if (!isAdmin) {
      console.log('User is not admin, returning');
      return;
    }
    
    const options = ['Take Photo', 'Choose from Library'];
    if (group?.avatar_url) {
      options.push('Remove Photo');
    }
    options.push('Cancel');
    
    const { action: buttonIndex, options: iosOptions } = await new Promise((resolve) => {
      // For iOS, we'll use ActionSheetIOS
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            cancelButtonIndex: options.length - 1,
            userInterfaceStyle: 'dark',
          },
          (buttonIndex) => resolve({ action: buttonIndex, options })
        );
      } else {
        // For Android, we'll use Alert
        Alert.alert(
          'Update Group Photo',
          null,
          options.map((option, index) => ({
            text: option,
            onPress: () => resolve({ action: index, options }),
            style: option === 'Cancel' ? 'cancel' : 'default',
          })),
          { cancelable: true, onDismiss: () => resolve({ action: options.length - 1, options }) }
        );
      }
    });
    
    const selectedOption = options[buttonIndex];
    
    if (selectedOption === 'Take Photo') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera permission is required to take photos');
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets[0]) {
        await updateGroupAvatar(result.assets[0].uri);
      }
    } else if (selectedOption === 'Choose from Library') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Photo library permission is required to select photos');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets[0]) {
        await updateGroupAvatar(result.assets[0].uri);
      }
    } else if (selectedOption === 'Remove Photo') {
      Alert.alert(
        'Remove Photo',
        'Are you sure you want to remove the group photo?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: removeGroupAvatar }
        ]
      );
    }
  };

  const fetchGroupInfo = async () => {
    try {
      // Fetch group details
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;

      setGroup(groupData);
      setNewGroupName(groupData.name);

      // Fetch group members with user details
      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('group_id', groupId);

      if (membersError) throw membersError;

      setMembers(membersData || []);

      // Check if current user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const userMember = membersData?.find(member => member.user_id === user.id);
        setIsAdmin(userMember?.role === 'admin');
      }

    } catch (error) {
      console.error('Error fetching group info:', error);
      Alert.alert('Error', 'Failed to load group information');
    } finally {
      setLoading(false);
    }
  };

  const fetchJoinRequests = async () => {
    try {
      setLoadingJoinRequests(true);
      // Use the RPC function with proper error handling
      const { data, error } = await supabase
        .rpc('get_group_join_requests', { group_id_param: groupId });

      if (error) {
        console.error('RPC Error:', error);
        throw error;
      }

      // Filter for pending requests and sort by creation date
      const pendingRequests = (data || [])
        .filter(req => req.status === 'pending')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setJoinRequests(pendingRequests);
    } catch (error) {
      console.error('Error in fetchJoinRequests:', error);
      Alert.alert('Error', 'Failed to load join requests. Please try again.');
    } finally {
      setLoadingJoinRequests(false);
    }
  };

  // Search for users when query changes
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length > 0 && showAddMembers) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, showAddMembers]);

  const searchUsers = async () => {
    setSearchLoading(true);
    try {
      // Search for users by username
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .ilike('username', `%${searchQuery}%`)
        .order('username')
        .limit(20);

      if (error) throw error;

      // Filter out current members and current user
      const memberIds = members.map(member => member.user_id);
      const filteredData = data.filter(user => 
        !memberIds.includes(user.id) && user.id !== currentUserId
      );

      // Check for blocked status
      const usersWithStatus = await Promise.all(filteredData.map(async (user) => {
        const { data: isBlocked, error: isBlockedError } = await supabase.rpc('is_blocked', {
          user_id_1: currentUserId,
          user_id_2: user.id
        });

        if (isBlockedError || isBlocked) {
          return null;
        }

        // Fetch verification status
        const { data: verifiedData } = await supabase
          .from('verified_accounts')
          .select('verified')
          .eq('id', user.id)
          .maybeSingle();
          
        return {
          ...user,
          isVerified: verifiedData?.verified || false
        };
      }));
      
      setSearchResults(usersWithStatus.filter(Boolean) || []);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const updateGroupName = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Error', 'Group name cannot be empty');
      return;
    }

    try {
      const { error } = await supabase
        .from('groups')
        .update({ name: newGroupName.trim() })
        .eq('id', groupId);

      if (error) throw error;

      setGroup({ ...group, name: newGroupName.trim() });
      setEditingName(false);
      Alert.alert('Success', 'Group name updated successfully');
    } catch (error) {
      console.error('Error updating group name:', error);
      Alert.alert('Error', 'Failed to update group name');
    }
  };

  const addMember = async (user) => {
    try {
      const { error } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: user.id,
          role: 'member'
        });

      if (error) throw error;

      // Add to local state
      const newMember = {
        user_id: user.id,
        role: 'member',
        profiles: user
      };
      setMembers([...members, newMember]);
      
      // Remove from search results
      setSearchResults(searchResults.filter(u => u.id !== user.id));
      
      Alert.alert('Success', `${user.username} added to group`);
    } catch (error) {
      console.error('Error adding member:', error);
      Alert.alert('Error', 'Failed to add member to group');
    }
  };

  const removeMember = async (memberId, memberName) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${memberName} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Removing member:', { groupId, memberId, memberName });
              
              const { data, error } = await supabase
                .from('group_members')
                .delete()
                .eq('group_id', groupId)
                .eq('user_id', memberId);

              console.log('Delete result:', { data, error });

              if (error) {
                console.error('Database error removing member:', error);
                throw error;
              }

              // Refresh the group info to get updated member list
              await fetchGroupInfo();
              Alert.alert('Success', 'Member removed from group');
            } catch (error) {
              console.error('Error removing member:', error);
              Alert.alert('Error', `Failed to remove member: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const uploadAvatar = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload group avatar');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await updateGroupAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      Alert.alert('Error', 'Failed to upload group avatar');
    }
  };

  const makeAdmin = async (memberId, memberName) => {
    Alert.alert(
      'Make Admin',
      `Are you sure you want to make ${memberName} an admin?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Make Admin',
          onPress: async () => {
            try {
              console.log('Making admin:', { groupId, memberId, memberName });
              
              const { error } = await supabase
                .from('group_members')
                .update({ role: 'admin' })
                .eq('group_id', groupId)
                .eq('user_id', memberId);

              if (error) {
                console.error('Database error making admin:', error);
                throw error;
              }

              // Refresh the group info to get updated member list
              await fetchGroupInfo();
              Alert.alert('Success', `${memberName} is now an admin`);
            } catch (error) {
              console.error('Error making admin:', error);
              Alert.alert('Error', `Failed to make user admin: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const togglePrivacy = async () => {
    try {
      const newPrivacyStatus = !group.is_private;
      const { error } = await supabase
        .from('groups')
        .update({ is_private: newPrivacyStatus })
        .eq('id', groupId);

      if (error) throw error;

      setGroup({ ...group, is_private: newPrivacyStatus });
      Alert.alert('Success', `Group is now ${newPrivacyStatus ? 'private' : 'public'}`);
    } catch (error) {
      console.error('Error updating privacy:', error);
      Alert.alert('Error', 'Failed to update group privacy');
    }
  };

  const toggleAutoJoin = async () => {
    try {
      const newAutoJoinStatus = !group.auto_join;
      const { error } = await supabase
        .from('groups')
        .update({ auto_join: newAutoJoinStatus })
        .eq('id', groupId);

      if (error) throw error;

      setGroup({ ...group, auto_join: newAutoJoinStatus });
      Alert.alert('Success', `Auto-join is now ${newAutoJoinStatus ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating auto-join:', error);
      Alert.alert('Error', 'Failed to update auto-join setting');
    }
  };

  const handleJoinRequest = async (requestId, action, username) => {
    try {
      const { error } = await supabase
        .from('group_join_requests')
        .update({ status: action })
        .eq('id', requestId);

      if (error) throw error;

      if (action === 'approved') {
        // Add user to group_members
        const request = joinRequests.find(r => r.id === requestId);
        if (request) {
          const { error: memberError } = await supabase
            .from('group_members')
            .insert({
              group_id: groupId,
              user_id: request.user_id,
              role: 'member'
            });

          if (memberError) throw memberError;
        }
      }

      // Refresh join requests and group info
      await fetchJoinRequests();
      await fetchGroupInfo();
      
      Alert.alert('Success', `Join request ${action} for ${username}`);
    } catch (error) {
      console.error('Error handling join request:', error);
      Alert.alert('Error', `Failed to ${action} join request`);
    }
  };

  const removeAdmin = async (memberId, memberName) => {
    Alert.alert(
      'Remove Admin',
      `Are you sure you want to remove admin privileges from ${memberName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Admin',
          onPress: async () => {
            try {
              console.log('Removing admin:', { groupId, memberId, memberName });
              
              const { error } = await supabase
                .from('group_members')
                .update({ role: 'member' })
                .eq('group_id', groupId)
                .eq('user_id', memberId);

              if (error) {
                console.error('Database error removing admin:', error);
                throw error;
              }

              // Refresh the group info to get updated member list
              await fetchGroupInfo();
              Alert.alert('Success', `${memberName} is no longer an admin`);
            } catch (error) {
              console.error('Error removing admin:', error);
              Alert.alert('Error', `Failed to remove admin privileges: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const leaveGroup = async () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              // Check if user is an admin
              const currentMember = members.find(m => m.user_id === currentUserId);
              const isCurrentUserAdmin = currentMember?.role === 'admin';
              
              // Remove user from group
              const { error: leaveError } = await supabase
                .from('group_members')
                .delete()
                .eq('group_id', groupId)
                .eq('user_id', currentUserId);

              if (leaveError) throw leaveError;

              // If leaving user was admin, check if any admins remain
              if (isCurrentUserAdmin) {
                const { data: remainingAdmins, error: adminError } = await supabase
                  .from('group_members')
                  .select('user_id')
                  .eq('group_id', groupId)
                  .eq('role', 'admin');

                if (adminError) throw adminError;

                // If no admins left, promote a random member to admin
                if (!remainingAdmins || remainingAdmins.length === 0) {
                  const { data: remainingMembers, error: membersError } = await supabase
                    .from('group_members')
                    .select('user_id')
                    .eq('group_id', groupId)
                    .limit(1);

                  if (membersError) throw membersError;

                  if (remainingMembers && remainingMembers.length > 0) {
                    const newAdminId = remainingMembers[0].user_id;
                    
                    const { error: promoteError } = await supabase
                      .from('group_members')
                      .update({ role: 'admin' })
                      .eq('group_id', groupId)
                      .eq('user_id', newAdminId);

                    if (promoteError) throw promoteError;
                  }
                }
              }

              Alert.alert('Success', 'You have left the group');
              navigation.goBack();
            } catch (error) {
              console.error('Error leaving group:', error);
              Alert.alert('Error', 'Failed to leave group. Please try again.');
            }
          }
        }
      ]
    );
  };

  const deleteGroup = async () => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('groups')
                .delete()
                .eq('id', groupId);

              if (error) throw error;

              Alert.alert('Success', 'Group deleted successfully');
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting group:', error);
              Alert.alert('Error', 'Failed to delete group. Please try again.');
            }
          }
        }
      ]
    );
  };

  const renderMember = ({ item }) => {
    const user = item.profiles;
    const canRemove = isAdmin && item.user_id !== currentUserId;
    const canChangeRole = isAdmin && item.user_id !== currentUserId;

    return (
      <TouchableOpacity 
        style={styles.memberItem}
        onLongPress={() => {
          if (canChangeRole) {
            setShowMemberOptions({
              userId: item.user_id,
              username: user.username,
              role: item.role
            });
          }
        }}
        delayLongPress={500}
      >
        <Image 
          source={{ uri: user.avatar_url || 'https://via.placeholder.com/150' }}
          style={styles.memberAvatar}
        />
        <View style={styles.memberInfo}>
          <View style={styles.usernameContainer}>
            <Text style={styles.memberName}>{user.username}</Text>
            {user.isVerified && (
              <Ionicons name="checkmark-circle" size={16} color="#ff0000" style={styles.verifiedBadge} />
            )}
          </View>
          <Text style={styles.memberRole}>{item.role}</Text>
        </View>
        {canRemove && (
          <TouchableOpacity 
            onPress={() => removeMember(item.user_id, user.username)}
            style={styles.removeButton}
          >
            <Ionicons name="remove-circle" size={24} color="#ff6b6b" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderSearchResult = ({ item }) => (
    <TouchableOpacity 
      style={styles.searchResultItem}
      onPress={() => addMember(item)}
    >
      <Image 
        source={{ uri: item.avatar_url || 'https://via.placeholder.com/150' }}
        style={styles.searchAvatar}
      />
      <View style={styles.searchUserInfo}>
        <View style={styles.usernameContainer}>
          <Text style={styles.searchUsername}>{item.username}</Text>
          {item.isVerified && (
            <Ionicons name="checkmark-circle" size={16} color="#ff0000" style={styles.verifiedBadge} />
          )}
        </View>
        <Text style={styles.searchFullName}>{item.full_name || ''}</Text>
      </View>
      <Ionicons name="add-circle" size={24} color="#00ff88" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
        <ActivityIndicator size="large" color="#ff6b6b" style={styles.loader} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 50 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Group Avatar Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Avatar</Text>
          <View style={styles.avatarSection}>
            <TouchableOpacity 
              onPress={isAdmin ? handleAvatarPress : null}
              style={[styles.groupAvatarContainer, isAdmin && styles.editableAvatar]}
              disabled={!isAdmin || uploadingAvatar}
              activeOpacity={isAdmin ? 0.7 : 1}
            >
              {uploadingAvatar ? (
                <View style={styles.groupAvatarPlaceholder}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              ) : group?.avatar_url ? (
                <Image 
                  source={{ uri: group.avatar_url }}
                  style={styles.groupAvatarImage}
                />
              ) : (
                <LinearGradient
                  colors={['rgba(102, 126, 234, 0.8)', 'rgba(156, 136, 255, 0.8)']}
                  style={styles.groupAvatarPlaceholder}
                >
                  <Ionicons name="people" size={40} color="#fff" />
                </LinearGradient>
              )}
              {isAdmin && (
                <View style={styles.avatarEditOverlay}>
                  <Ionicons name="camera" size={20} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            {isAdmin && (
              <Text style={styles.avatarHint}>Tap to change group photo</Text>
            )}
          </View>
        </View>

        {/* Group Name Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Name</Text>
          {editingName ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.editInput}
                value={newGroupName}
                onChangeText={setNewGroupName}
                placeholder="Enter group name"
                placeholderTextColor="rgba(255,255,255,0.4)"
                maxLength={50}
              />
              <View style={styles.editButtons}>
                <TouchableOpacity 
                  onPress={() => {
                    setEditingName(false);
                    setNewGroupName(group.name);
                  }}
                  style={styles.cancelEditButton}
                >
                  <Text style={styles.cancelEditText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={updateGroupName} style={styles.saveEditButton}>
                  <Text style={styles.saveEditText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.groupNameContainer}>
              <Text style={styles.groupName}>{group?.name}</Text>
              {isAdmin && (
                <TouchableOpacity onPress={() => setEditingName(true)}>
                  <Ionicons name="pencil" size={20} color="#ff6b6b" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <View style={styles.membersHeader}>
            <Text style={styles.sectionTitle}>Members ({members.length})</Text>
            {isAdmin && (
              <TouchableOpacity 
                onPress={() => setShowAddMembers(!showAddMembers)}
                style={styles.addMemberButton}
              >
                <Ionicons name={showAddMembers ? "close" : "add"} size={20} color="#00ff88" />
                <Text style={styles.addMemberText}>
                  {showAddMembers ? "Cancel" : "Add"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Add Members Search */}
          {showAddMembers && isAdmin && (
            <View style={styles.addMembersSection}>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="rgba(255,255,255,0.6)" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search for users to add..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                />
              </View>

              {searchLoading ? (
                <ActivityIndicator size="small" color="#ff6b6b" style={styles.searchLoader} />
              ) : (
                <FlatList
                  data={searchResults}
                  renderItem={renderSearchResult}
                  keyExtractor={(item) => item.id}
                  ListEmptyComponent={
                    searchQuery.length > 0 ? (
                      <Text style={styles.emptyText}>No users found</Text>
                    ) : null
                  }
                  style={styles.searchResults}
                  scrollEnabled={false}
                />
              )}
            </View>
          )}

          {/* Members List */}
          <FlatList
            data={members}
            renderItem={renderMember}
            keyExtractor={(item) => item.user_id}
            style={styles.membersList}
            scrollEnabled={false}
          />
        </View>

        {/* Privacy Settings */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy Settings</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Private Group</Text>
                <Text style={styles.settingDescription}>
                  Only members can see this group in search
                </Text>
              </View>
              <TouchableOpacity 
                onPress={togglePrivacy}
                style={[styles.toggle, group?.is_private && styles.toggleActive]}
              >
                <View style={[styles.toggleCircle, group?.is_private && styles.toggleCircleActive]} />
              </TouchableOpacity>
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Auto Join</Text>
                <Text style={styles.settingDescription}>
                  Users can join automatically without approval
                </Text>
              </View>
              <TouchableOpacity 
                onPress={toggleAutoJoin}
                style={[styles.toggle, group?.auto_join && styles.toggleActive]}
              >
                <View style={[styles.toggleCircle, group?.auto_join && styles.toggleCircleActive]} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Join Requests */}
        {isAdmin && !group?.auto_join && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Join Requests ({joinRequests.length})</Text>
            
            {loadingJoinRequests ? (
              <ActivityIndicator size="small" color="#ff6b6b" style={styles.loader} />
            ) : joinRequests.length > 0 ? (
              <FlatList
                data={joinRequests}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View style={styles.joinRequestItem}>
                    <Image 
                      source={{ uri: item.avatar_url || 'https://via.placeholder.com/150' }}
                      style={styles.requestAvatar}
                    />
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestUsername}>{item.username || 'Unknown User'}</Text>
                      <Text style={styles.requestTime}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </Text>
                      {item.message && (
                        <Text style={styles.requestMessage}>{item.message}</Text>
                      )}
                    </View>
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        onPress={() => handleJoinRequest(item.id, 'approved', item.username)}
                        style={styles.approveButton}
                      >
                        <Ionicons name="checkmark" size={20} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleJoinRequest(item.id, 'rejected', item.username)}
                        style={styles.rejectButton}
                      >
                        <Ionicons name="close" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            ) : (
              <Text style={styles.emptyText}>No pending join requests</Text>
            )}
          </View>
        )}

        {/* Group Actions */}
        <View style={[styles.section, styles.lastSection]}>
          <Text style={styles.sectionTitle}>Group Actions</Text>
          
          {/* Leave Group - Available to all members */}
          <TouchableOpacity onPress={leaveGroup} style={styles.leaveButton}>
            <Ionicons name="exit-outline" size={20} color="#fff" />
            <Text style={styles.leaveButtonText}>Leave Group</Text>
          </TouchableOpacity>
          
          {/* Delete Group - Admin only */}
          {isAdmin && (
            <TouchableOpacity onPress={deleteGroup} style={styles.deleteButton}>
              <Ionicons name="trash" size={20} color="#fff" />
              <Text style={styles.deleteButtonText}>Delete Group</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Member Options Modal */}
      <Modal
        visible={showMemberOptions !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMemberOptions(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Manage {showMemberOptions?.username}
            </Text>
            
            {showMemberOptions?.role === 'member' ? (
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  makeAdmin(showMemberOptions.userId, showMemberOptions.username);
                  setShowMemberOptions(null);
                }}
              >
                <Ionicons name="shield-checkmark" size={20} color="#00ff88" />
                <Text style={styles.modalOptionText}>Make Admin</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  removeAdmin(showMemberOptions.userId, showMemberOptions.username);
                  setShowMemberOptions(null);
                }}
              >
                <Ionicons name="shield" size={20} color="#ff6b6b" />
                <Text style={styles.modalOptionText}>Remove Admin</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                removeMember(showMemberOptions.userId, showMemberOptions.username);
                setShowMemberOptions(null);
              }}
            >
              <Ionicons name="person-remove" size={20} color="#ff6b6b" />
              <Text style={styles.modalOptionText}>Remove from Group</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.modalCancelOption}
              onPress={() => setShowMemberOptions(null)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 24,
  },
  
  // Avatar Section
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  groupAvatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  groupAvatarImage: {
    width: '100%',
    height: '100%',
  },
  groupAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  editableAvatar: {
    borderWidth: 2,
    borderColor: 'rgba(102, 126, 234, 0.8)',
  },
  avatarEditOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 8,
  },
  
  // Edit Controls
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    marginRight: 8,
  },
  editButtons: {
    flexDirection: 'row',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  cancelButton: {
    backgroundColor: '#f44336',
    padding: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '500',
  },
  
  // Members List
  membersList: {
    maxHeight: 400,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  memberRole: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  adminBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  adminBadgeText: {
    color: '#4CAF50',
    fontSize: 10,
    fontWeight: '600',
  },
  
  // Search Section
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 50,
    color: '#fff',
    fontSize: 16,
  },
  searchResults: {
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  searchAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  searchUserInfo: {
    flex: 1,
  },
  searchUsername: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  searchFullName: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  
  // Action Buttons
  actionButton: {
    padding: 8,
    borderRadius: 20,
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addMemberText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  
  // Modals
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  
  // Join Requests
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  requestInfo: {
    flex: 1,
    marginRight: 12,
  },
  requestName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  requestUsername: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#00ff88',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#ff6b6b',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Utility
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 20,
  },
  sectionTitle: {
  // Layout
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 24,
  },
  
  // Avatar Section
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  groupAvatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  groupAvatarImage: {
    width: '100%',
    height: '100%',
  },
  groupAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  editableAvatar: {
    borderWidth: 2,
    borderColor: 'rgba(102, 126, 234, 0.8)',
  },
  avatarEditOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 8,
  },
  
  // Edit Controls
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    marginRight: 8,
  },
  editButtons: {
    flexDirection: 'row',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  cancelButton: {
    backgroundColor: '#f44336',
    padding: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '500',
  },
  
  // Members List
  membersList: {
    maxHeight: 400,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  memberRole: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  adminBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  adminBadgeText: {
    color: '#4CAF50',
    fontSize: 10,
    fontWeight: '600',
  },
  
  // Search Section
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 50,
    color: '#fff',
    fontSize: 16,
  },
  searchResults: {
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  searchAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  searchUserInfo: {
    flex: 1,
  },
  searchUsername: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  searchFullName: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  
  // Action Buttons
  actionButton: {
    padding: 8,
    borderRadius: 20,
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addMemberText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  
  // Modals
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  
  // Utility
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 12,
  },
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRight: {
    width: 24,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 12,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  groupAvatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  groupAvatarImage: {
    width: '100%',
    height: '100%',
  },
  groupAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  editableAvatar: {
    borderWidth: 2,
    borderColor: 'rgba(102, 126, 234, 0.8)',
  },
  avatarEditOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 8,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    marginRight: 8,
  },
  editButtons: {
    flexDirection: 'row',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  cancelButton: {
    backgroundColor: '#f44336',
    padding: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '500',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  memberRole: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  adminBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  adminBadgeText: {
    color: '#4CAF50',
    fontSize: 10,
    fontWeight: '600',
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  searchInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    marginBottom: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  searchUserInfo: {
    flex: 1,
  },
  searchUsername: {
    color: '#fff',
    fontWeight: '500',
  },
  searchFullName: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 24,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  groupNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
    flex: 1,
  },
  editContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
  },
  editInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelEditButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  cancelEditText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
  },
  saveEditButton: {
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveEditText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addMemberText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  addMembersSection: {
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 50,
    color: '#fff',
    fontSize: 16,
  },
  searchLoader: {
    marginVertical: 12,
  },
  searchResults: {
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  searchAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  searchUserInfo: {
    flex: 1,
  },
  searchUsername: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  searchFullName: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  membersList: {
    maxHeight: 400,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  verifiedBadge: {
    marginLeft: 5,
  },
  memberRole: {
    color: '#ff6b6b',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  removeButton: {
    padding: 4,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff4757',
    borderRadius: 12,
    padding: 16,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  groupAvatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  groupAvatarImage: {
    width: '100%',
    height: '100%',
  },
  groupAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  editableAvatar: {
    borderWidth: 2,
    borderColor: 'rgba(102, 126, 234, 0.8)',
  },
  avatarEditOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
    fontWeight: '500',
  },
  modalCancelOption: {
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCancelText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#00ff88',
  },
  toggleCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  toggleCircleActive: {
    alignSelf: 'flex-end',
  },
  joinRequestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  requestAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  requestInfo: {
    flex: 1,
  },
  requestUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  requestTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  requestMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#00ff88',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#ff6b6b',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 12,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lastSection: {
    marginBottom: 100, // Add extra bottom padding to prevent collision with bottom navigation
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff9500',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
  },
  leaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default GroupInfoScreen;
