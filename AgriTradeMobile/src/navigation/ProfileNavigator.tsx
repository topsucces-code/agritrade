import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Import screens
import {
  ProfileScreen,
  SettingsScreen,
  HelpScreen
} from '@/screens/main';

// Import custom header
import HeaderWithProfile from '@/components/navigation/HeaderWithProfile';

export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
  Help: undefined;
};

const Stack = createStackNavigator<ProfileStackParamList>();

const ProfileNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        cardStyle: { backgroundColor: '#F5F5F5' },
        animationEnabled: true,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          header: () => <HeaderWithProfile title="Profile" />,
        }}
      />
      <Stack.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          header: () => <HeaderWithProfile title="Settings" showBack={true} />,
        }}
      />
      <Stack.Screen 
        name="Help" 
        component={HelpScreen}
        options={{
          header: () => <HeaderWithProfile title="Help & Support" showBack={true} />,
        }}
      />
    </Stack.Navigator>
  );
};

export default ProfileNavigator;