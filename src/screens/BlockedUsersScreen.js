import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BlockedUsersScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const fetchBlockedUsers = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated');
        navigation.navigate('Login');
        return;
      }
      
      // 1) Fetch block records (this is allowed by your RLS)
      const { data: blocks, error: blocksError } = await supabase
        .from('blocked_users')
        .select('id, blocked_id, created_at')
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false });
      
      if (blocksError) {
        console.error('Error fetching blocked users:', blocksError);
        Alert.alert('Error', 'Failed to load blocked users');
        return;
      }
      
      if (!blocks || blocks.length === 0) {
        setBlockedUsers([]);
        return;
      }
      
      // 2) Prefer secure RPC to bypass RLS for showing minimal info in UI
      const blockedIds = blocks.map(b => b.blocked_id);
      let profiles = [];
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_blocked_profiles', { p_blocker_id: user.id });
        if (rpcError) {
          console.warn('RPC get_blocked_profiles unavailable or failed, falling back:', rpcError);
          // Fallback: attempt direct profiles read (may be empty due to RLS)
          const { data: fallbackProfiles, error: fallbackError } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .in('id', blockedIds);
          if (fallbackError) {
            console.error('Error fetching blocked profiles (fallback):', fallbackError);
          } else {
            profiles = fallbackProfiles || [];
          }
        } else {
          profiles = rpcData || [];
        }
      } catch (rpcEx) {
        console.warn('RPC exception, falling back to direct profiles read:', rpcEx);
        const { data: fallbackProfiles, error: fallbackError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', blockedIds);
        if (fallbackError) {
          console.error('Error fetching blocked profiles (fallback):', fallbackError);
        } else {
          profiles = fallbackProfiles || [];
        }
      }
      
      const idToProfile = {};
      (profiles || []).forEach(p => {
        let avatarUrl = p.avatar_url;
        if (avatarUrl) {
          if (avatarUrl.includes('media/media/') || avatarUrl.includes('storage/v1/object/public/media/')) {
            const parts = avatarUrl.split('media/');
            const last = parts[parts.length - 1];
            avatarUrl = `https://lckhaysswueoyinhfzyz.supabase.co/storage/v1/object/public/media/${last}`;
          }
        }
        idToProfile[p.id] = { ...p, avatar_url: avatarUrl };
      });
      
      const merged = blocks.map(b => ({
        ...b,
        profiles: idToProfile[b.blocked_id] || null,
      }));
      
      setBlockedUsers(merged);
    } catch (error) {
      console.error('Error in fetchBlockedUsers:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleUnblock = async (blockedUserId, blockRecordId) => {
    try {
      Alert.alert(
        'Unblock User',
        'Are you sure you want to unblock this user? They will be able to see your profile and interact with you again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Unblock', 
            onPress: async () => {
              // Delete the block record
              const { error } = await supabase
                .from('blocked_users')
                .delete()
                .eq('id', blockRecordId);
                
              if (error) {
                console.error('Error unblocking user:', error);
                Alert.alert('Error', 'Failed to unblock user');
                return;
              }
              
              // Update the UI
              setBlockedUsers(prevUsers => 
                prevUsers.filter(user => user.id !== blockRecordId)
              );
              
              Alert.alert('Success', 'User has been unblocked');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in handleUnblock:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const renderBlockedUser = ({ item }) => {
    const profile = item.profiles;
    const displayName = profile?.full_name || 'Blocked user';
    const displayHandle = profile?.username ? `@${profile.username}` : `ID: ${item.blocked_id.slice(0, 8)}…`;
    const avatarSource = profile?.avatar_url
      ? { uri: profile.avatar_url }
      : require('../../assets/defaultavatar.png');
    const targetUserId = profile?.id || item.blocked_id;
    
    return (
      <View style={styles.userItem}>
        <Image 
          source={avatarSource}
          style={styles.avatar} 
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userHandle}>{displayHandle}</Text>
        </View>
        <TouchableOpacity 
          style={styles.unblockButton}
          onPress={() => handleUnblock(targetUserId, item.id)}
        >
          <Text style={styles.unblockText}>Unblock</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBlockedUsers();
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#330033', '#000000']}
        style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 50 }]}
      >
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#ff00ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked Users</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff00ff" />
          <Text style={styles.loadingText}>Loading blocked users...</Text>
        </View>
      ) : blockedUsers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="shield-checkmark-outline" size={60} color="#ff00ff" />
          <Text style={styles.emptyTitle}>No Blocked Users</Text>
          <Text style={styles.emptyText}>You haven't blocked any users yet.</Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          renderItem={renderBlockedUser}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListHeaderComponent={
            <Text style={styles.infoText}>
              Blocked users cannot see your profile, posts, or interact with you in any way.
            </Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#999',
    marginTop: 10,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  infoText: {
    color: '#999',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333',
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  userHandle: {
    color: '#999',
    fontSize: 14,
    marginTop: 4,
  },
  unblockButton: {
    backgroundColor: '#ff00ff20',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ff00ff',
  },
  unblockText: {
    color: '#ff00ff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default BlockedUsersScreen;