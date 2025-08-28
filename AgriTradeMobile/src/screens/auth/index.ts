import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

const RegisterScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Register Screen</Text>
        <Text style={styles.subtitle}>User registration will be implemented here</Text>
      </View>
    </SafeAreaView>
  );
};

const PhoneVerificationScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Phone Verification</Text>
        <Text style={styles.subtitle}>SMS verification will be implemented here</Text>
      </View>
    </SafeAreaView>
  );
};

const ProfileSetupScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile Setup</Text>
        <Text style={styles.subtitle}>Initial profile setup will be implemented here</Text>
      </View>
    </SafeAreaView>
  );
};

const OnboardingScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Onboarding</Text>
        <Text style={styles.subtitle}>App tutorial will be implemented here</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
  },
});

export { RegisterScreen, PhoneVerificationScreen, ProfileSetupScreen, OnboardingScreen };