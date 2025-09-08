import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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
    <LinearGradient
      colors={index === 0 ? ['rgba(255, 215, 0, 0.3)', 'rgba(255, 193, 7, 0.2)'] : 
             index === 1 ? ['rgba(192, 192, 192, 0.3)', 'rgba(169, 169, 169, 0.2)'] :
             index === 2 ? ['rgba(205, 127, 50, 0.3)', 'rgba(184, 115, 51, 0.2)'] :
             ['rgba(102, 126, 234, 0.2)', 'rgba(156, 136, 255, 0.1)']}
      style={styles.donorItem}
    >
      <LinearGradient
        colors={index < 3 ? ['rgba(255, 107, 107, 0.8)', 'rgba(255, 82, 82, 0.6)'] : ['rgba(102, 126, 234, 0.6)', 'rgba(156, 136, 255, 0.4)']}
        style={styles.rankBadge}
      >
        <Text style={styles.rank}>#{index + 1}</Text>
      </LinearGradient>
      <View style={styles.donorInfo}>
        <Text style={styles.donorName}>{item.donor_name}</Text>
        <Text style={styles.donationAmount}>💎 ₹{item.amount.toLocaleString()}</Text>
      </View>
      {index < 3 && (
        <Ionicons 
          name={index === 0 ? 'trophy' : index === 1 ? 'medal' : 'ribbon'} 
          size={24} 
          color={index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32'} 
        />
      )}
    </LinearGradient>
  );

  if (loading) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.safeArea}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading donors...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.safeArea}>
      <View style={styles.container}>
        <LinearGradient
          colors={['rgba(102, 126, 234, 0.3)', 'rgba(156, 136, 255, 0.2)', 'transparent']}
          style={styles.header}
        >
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <LinearGradient
              colors={['rgba(102, 126, 234, 0.8)', 'rgba(156, 136, 255, 0.6)']}
              style={styles.backButtonGradient}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.title}>🏆 Wealthiest Donors</Text>
        </LinearGradient>
        
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
            style={styles.list}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </LinearGradient>    
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
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
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    flex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  backButtonGradient: {
    padding: 8,
    borderRadius: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 20,
  },
  donorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginVertical: 6,
    borderRadius: 15,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  rank: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  donorInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  donorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  donationAmount: {
    fontSize: 14,
    color: '#9c88ff',
    marginTop: 2,
    fontWeight: '600',
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
    marginBottom: 20, 
  },
  donateButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
  },
});

export default WealthiestDonorsScreen;