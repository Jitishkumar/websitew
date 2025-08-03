import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { supabase } from '../config/supabase';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const WealthiestDonorsScreen = () => {
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    fetchDonors();
  }, []);

  const fetchDonors = async () => {
    try {
      const { data, error } = await supabase
        .from('donations')
        .select('*')
        .eq('payment_verified', true)
        .order('amount', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDonors(data || []);
    } catch (error) {
      console.error('Error fetching donors:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderDonorItem = ({ item, index }) => (
    <View style={styles.donorItem}>
      <Text style={styles.rank}>#{index + 1}</Text>
      <View style={styles.donorInfo}>
        <Text style={styles.donorName}>{item.donor_name}</Text>
        <Text style={styles.donationAmount}>₹{item.amount.toLocaleString()}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#ff00ff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#ff00ff" />
          </TouchableOpacity>
          <Text style={styles.title}>Wealthiest Donors</Text>
          <Text style={styles.subtitle}>(Verified donations only)</Text>
          <Text style={styles.rankingInfo}>Ranked by highest donation amount</Text>
        </View>
        
        {donors.length === 0 && !loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No verified donations yet. Be the first to donate!</Text>
            <Text style={styles.verificationNote}>Note: Donations require verification before appearing in this list.</Text>
            <TouchableOpacity 
              style={styles.donateButton} 
              onPress={() => navigation.navigate('Donate')}
            >
              <Text style={styles.donateButtonText}>Donate Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={donors}
            renderItem={renderDonorItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000033',
    paddingTop: Platform.OS === 'ios' ? 50 : 30, // Additional padding for camera notch
  },
  container: {
    flex: 1,
    backgroundColor: '#000033',
    padding: 20,
    paddingTop: 10,
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 5,
    padding: 5,
    zIndex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff00ff',
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 5,
  },
  rankingInfo: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
  },
  verificationNote: {
    fontSize: 14,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  donateButton: {
    backgroundColor: '#ff00ff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    width: '80%',
    marginBottom: 20, // Added bottom margin
  },
  donateButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingBottom: 80, // Increased bottom padding
  },
  donorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#330033',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  rank: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff00ff',
    marginRight: 15,
  },
  donorInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  donorName: {
    fontSize: 16,
    color: '#ffffff',
  },
  donationAmount: {
    fontSize: 16,
    color: '#00ff00',
    fontWeight: 'bold',
  },
});

export default WealthiestDonorsScreen;