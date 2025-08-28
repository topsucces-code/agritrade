import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';

interface LoadingScreenProps {
  message?: string;
  showLogo?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = 'Loading...', 
  showLogo = true 
}) => {
  const { loadingMessage } = useSelector((state: RootState) => state.ui);
  
  const displayMessage = loadingMessage || message;

  return (
    <View style={styles.container}>
      {showLogo && (
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>🌾</Text>
          <Text style={styles.logoTitle}>AgriTrade AI</Text>
        </View>
      )}
      
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingMessage}>{displayMessage}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoText: {
    fontSize: 48,
    marginBottom: 8,
  },
  logoTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2E7D32',
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingMessage: {
    fontSize: 16,
    color: '#757575',
    marginTop: 16,
    textAlign: 'center',
  },
});

export default LoadingScreen;