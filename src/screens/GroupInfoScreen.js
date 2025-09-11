import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

  useEffect(() => {
    getCurrentUser();
    fetchGroupInfo();
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
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
              const { error } = await supabase
                .from('group_members')
                .delete()
                .eq('group_id', groupId)
                .eq('user_id', memberId);

              if (error) throw error;

              setMembers(members.filter(member => member.user_id !== memberId));
              Alert.alert('Success', 'Member removed from group');
            } catch (error) {
              console.error('Error removing member:', error);
              Alert.alert('Error', 'Failed to remove member');
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
              // Delete group members first
              await supabase
                .from('group_members')
                .delete()
                .eq('group_id', groupId);

              // Delete group messages
              await supabase
                .from('group_messages')
                .delete()
                .eq('group_id', groupId);

              // Delete group
              const { error } = await supabase
                .from('groups')
                .delete()
                .eq('id', groupId);

              if (error) throw error;

              Alert.alert('Success', 'Group deleted successfully', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (error) {
              console.error('Error deleting group:', error);
              Alert.alert('Error', 'Failed to delete group');
            }
          }
        }
      ]
    );
  };

  const renderMember = ({ item }) => {
    const user = item.profiles;
    const canRemove = isAdmin && item.user_id !== currentUserId;

    return (
      <View style={styles.memberItem}>
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
      </View>
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

        {/* Admin Actions */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin Actions</Text>
            <TouchableOpacity onPress={deleteGroup} style={styles.deleteButton}>
              <Ionicons name="trash" size={20} color="#fff" />
              <Text style={styles.deleteButtonText}>Delete Group</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    fontWeight: '600',
    marginLeft: 8,
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
});

export default GroupInfoScreen;
