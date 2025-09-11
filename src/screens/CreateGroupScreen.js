import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CreateGroupScreen = () => {
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Get current user ID
  const [currentUserId, setCurrentUserId] = useState(null);
  
  useEffect(() => {
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  // Search for users when query changes
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    }, 500); // Debounce search for 500ms

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const searchUsers = async () => {
    setLoading(true);
    try {
      // Search for users by username
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .ilike('username', `%${searchQuery}%`)
        .order('username')
        .limit(20);

      if (error) throw error;

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setSearchResults([]);
        setLoading(false);
        return;
      }

      // Filter out the current user from the search results
      const filteredData = data.filter(user => user.id !== currentUser.id);

      // Check for blocked status and fetch verification status
      const usersWithStatus = await Promise.all(filteredData.map(async (user) => {
        // Check if the user is blocked
        const { data: isBlocked, error: isBlockedError } = await supabase.rpc('is_blocked', {
          user_id_1: currentUser.id,
          user_id_2: user.id
        });

        if (isBlockedError) {
          console.error('Error checking block status:', isBlockedError);
          return {
            ...user,
            isVerified: false
          }; // Include user even on error for group creation
        }

        if (isBlocked) {
          return null; // Exclude blocked user
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
      
      // Filter out any null values from the results
      setSearchResults(usersWithStatus.filter(Boolean) || []);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMemberSelection = (user) => {
    console.log('Member selected:', user.id, user.username);
    if (selectedMembers.find(member => member.id === user.id)) {
      const newSelected = selectedMembers.filter(member => member.id !== user.id);
      console.log('Removing member, new list:', newSelected);
      setSelectedMembers(newSelected);
    } else {
      const newSelected = [...selectedMembers, user];
      console.log('Adding member, new list:', newSelected);
      setSelectedMembers(newSelected);
    }
  };

  const createGroup = async () => {
    console.log('Create group called');
    console.log('Group name:', groupName);
    console.log('Selected members:', selectedMembers);
    console.log('Current user ID:', currentUserId);
    
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name.');
      return;
    }
    
    if (selectedMembers.length === 0) {
      Alert.alert('Error', 'Please select at least one member.');
      return;
    }
    
    if (!currentUserId) {
      Alert.alert('Error', 'User not authenticated. Please try again.');
      return;
    }
    
    setCreating(true);
    
    try {
      console.log('Creating group with data:', {
        name: groupName.trim(),
        description: groupDescription.trim(),
        created_by: currentUserId
      });
      
      // Create the group
      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: groupName.trim(),
          description: groupDescription.trim(),
          created_by: currentUserId
        })
        .select()
        .single();
      
      console.log('Group creation result:', { newGroup, groupError });
      
      if (groupError) {
        console.error('Error creating group:', groupError);
        Alert.alert('Error', `Failed to create group: ${groupError.message}`);
        return;
      }
      
      // Check if admin already exists (might be from previous failed attempt)
      const { data: existingAdmin } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', newGroup.id)
        .eq('user_id', currentUserId)
        .single();
      
      if (!existingAdmin) {
        // Add creator as admin only if not already exists
        const { error: adminError } = await supabase
          .from('group_members')
          .insert({
            group_id: newGroup.id,
            user_id: currentUserId,
            role: 'admin'
          });
        
        if (adminError) {
          console.error('Error adding admin:', adminError);
          await supabase.from('groups').delete().eq('id', newGroup.id);
          Alert.alert('Error', 'Failed to create group admin. Please try again.');
          return;
        }
      } else {
        console.log('Admin already exists for this group');
      }
      
      // Then add selected members (excluding creator if they selected themselves)
      const filteredMembers = selectedMembers.filter(member => member.id !== currentUserId);
      console.log('Filtered members (excluding creator):', filteredMembers);
      
      if (filteredMembers.length > 0) {
        const memberInserts = filteredMembers.map(member => ({
          group_id: newGroup.id,
          user_id: member.id,
          role: 'member'
        }));
        
        console.log('Member inserts:', memberInserts);
        
        const { error: membersError } = await supabase
          .from('group_members')
          .insert(memberInserts);
        
        if (membersError) {
          console.error('Error adding members:', membersError);
          Alert.alert('Error', 'Group created but failed to add some members.');
          // Don't return here, group creation was successful
        }
      }
      
      Alert.alert('Success', 'Group created successfully!', [
        { text: 'OK', onPress: () => {
          // Reset form
          setGroupName('');
          setGroupDescription('');
          setSelectedMembers([]);
          setSearchQuery('');
          navigation.goBack();
        }}
      ]);
      
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const renderUserItem = ({ item }) => {
    const isSelected = selectedMembers.find(member => member.id === item.id);
    
    return (
      <TouchableOpacity 
        style={[styles.userItem, isSelected && styles.selectedUserItem]}
        onPress={() => toggleMemberSelection(item)}
      >
        <Image 
          source={{ uri: item.avatar_url || 'https://via.placeholder.com/150' }}
          style={styles.userAvatar}
        />
        <View style={styles.userInfo}>
          <View style={styles.usernameContainer}>
            <Text style={styles.username}>{item.username}</Text>
            {item.isVerified && (
              <Ionicons name="checkmark-circle" size={16} color="#ff0000" style={styles.verifiedBadge} />
            )}
          </View>
          <Text style={styles.fullName}>{item.full_name || ''}</Text>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color="#00ff88" />
        )}
      </TouchableOpacity>
    );
  };

  const renderSelectedMember = ({ item }) => (
    <View style={styles.selectedMemberChip}>
      <Image 
        source={{ uri: item.avatar_url || 'https://via.placeholder.com/150' }}
        style={styles.chipAvatar}
      />
      <Text style={styles.chipUsername}>{item.username}</Text>
      <TouchableOpacity onPress={() => toggleMemberSelection(item)}>
        <Ionicons name="close-circle" size={20} color="#ff6b6b" />
      </TouchableOpacity>
    </View>
  );

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 50 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Group</Text>
        <TouchableOpacity 
          onPress={createGroup}
          disabled={creating || !groupName.trim() || selectedMembers.length === 0}
          style={[styles.createButton, (creating || !groupName.trim() || selectedMembers.length === 0) && styles.createButtonDisabled]}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.createButtonText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Group Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Group Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter group name"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={groupName}
              onChangeText={setGroupName}
              maxLength={50}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Description (Optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Enter group description"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={groupDescription}
              onChangeText={setGroupDescription}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>
        </View>

        {/* Selected Members Section */}
        {selectedMembers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Selected Members ({selectedMembers.length})</Text>
            <FlatList
              data={selectedMembers}
              renderItem={renderSelectedMember}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.selectedMembersList}
            />
          </View>
        )}

        {/* Search Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Members</Text>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="rgba(255,255,255,0.6)" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for users..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#ff6b6b" style={styles.loader} />
          ) : (
            <FlatList
              data={searchResults}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                searchQuery.length > 0 ? (
                  <Text style={styles.emptyText}>No users found</Text>
                ) : (
                  <Text style={styles.emptyText}>Search for users to add to your group</Text>
                )
              }
              style={styles.searchResultsList}
              scrollEnabled={false}
            />
          )}
        </View>
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
    marginHorizontal: 20,
  },
  createButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: 'rgba(255, 107, 107, 0.3)',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.3)',
    minHeight: 50,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectedMembersList: {
    maxHeight: 80,
  },
  selectedMemberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(102, 126, 234, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  chipAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  chipUsername: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.3)',
    marginBottom: 16,
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
  searchResultsList: {
    maxHeight: 300,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  selectedUserItem: {
    backgroundColor: 'rgba(102, 126, 234, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.5)',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedBadge: {
    marginLeft: 5,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  fullName: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  loader: {
    marginTop: 20,
  },
});

export default CreateGroupScreen;
