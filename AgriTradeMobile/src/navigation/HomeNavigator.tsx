import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { HomeStackParamList } from '@/types';

// Import screens
import DashboardScreen from '@/screens/main/DashboardScreen';
import { 
  QualityAnalysisScreen, 
  PriceRecommendationsScreen 
} from '@/screens/main';

// Import custom header
import HeaderWithProfile from '@/components/navigation/HeaderWithProfile';

const Stack = createStackNavigator<HomeStackParamList>();

const HomeNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        cardStyle: { backgroundColor: '#F5F5F5' },
        animationEnabled: true,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          header: () => <HeaderWithProfile title="AgriTrade AI" showProfile={true} />,
        }}
      />
      <Stack.Screen 
        name="QualityAnalysis" 
        component={QualityAnalysisScreen}
        options={{
          header: () => <HeaderWithProfile title="Quality Analysis" showBack={true} />,
        }}
      />
      <Stack.Screen 
        name="PriceRecommendations" 
        component={PriceRecommendationsScreen}
        options={{
          header: () => <HeaderWithProfile title="Price Recommendations" showBack={true} />,
        }}
      />
    </Stack.Navigator>
  );
};

export default HomeNavigator;