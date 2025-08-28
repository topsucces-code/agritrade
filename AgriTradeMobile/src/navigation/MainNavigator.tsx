import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RootState } from '@/store';
import { MainTabParamList } from '@/types';

// Import navigators
import HomeNavigator from './HomeNavigator';
import ProductNavigator from './ProductNavigator';
import OrderNavigator from './OrderNavigator';
import ProfileNavigator from './ProfileNavigator';

// Import custom components
import CustomTabBar from '@/components/navigation/CustomTabBar';

const Tab = createBottomTabNavigator<MainTabParamList>();

const MainNavigator: React.FC = () => {
  const { tabBarVisible } = useSelector((state: RootState) => state.ui);
  const { user } = useSelector((state: RootState) => state.auth);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'dashboard' : 'dashboard';
              break;
            case 'Products':
              iconName = focused ? 'inventory' : 'inventory-2';
              break;
            case 'Orders':
              iconName = focused ? 'shopping-cart' : 'shopping-cart';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2E7D32',
        tabBarInactiveTintColor: '#757575',
        tabBarStyle: {
          display: tabBarVisible ? 'flex' : 'none',
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E0E0E0',
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      })}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeNavigator}
        options={{
          tabBarLabel: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
        }}
      />
      <Tab.Screen 
        name="Products" 
        component={ProductNavigator}
        options={{
          tabBarLabel: user?.userType === 'farmer' ? 'My Products' : 'Browse',
          tabBarAccessibilityLabel: 'Products tab',
        }}
      />
      <Tab.Screen 
        name="Orders" 
        component={OrderNavigator}
        options={{
          tabBarLabel: 'Orders',
          tabBarAccessibilityLabel: 'Orders tab',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileNavigator}
        options={{
          tabBarLabel: 'Profile',
          tabBarAccessibilityLabel: 'Profile tab',
        }}
      />
    </Tab.Navigator>
  );
};

export default MainNavigator;