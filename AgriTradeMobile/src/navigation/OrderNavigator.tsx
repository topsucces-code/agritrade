import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Import screens
import {
  OrderHistoryScreen,
  ActiveOrdersScreen,
  OrderDetailsScreen
} from '@/screens/main';

// Import custom header
import HeaderWithProfile from '@/components/navigation/HeaderWithProfile';

export type OrderStackParamList = {
  OrderHistory: undefined;
  ActiveOrders: undefined;
  OrderDetails: { orderId: string };
};

const Stack = createStackNavigator<OrderStackParamList>();

const OrderNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        cardStyle: { backgroundColor: '#F5F5F5' },
        animationEnabled: true,
        gestureEnabled: true,
      }}
      initialRouteName="ActiveOrders"
    >
      <Stack.Screen 
        name="ActiveOrders" 
        component={ActiveOrdersScreen}
        options={{
          header: () => <HeaderWithProfile title="Active Orders" />,
        }}
      />
      <Stack.Screen 
        name="OrderHistory" 
        component={OrderHistoryScreen}
        options={{
          header: () => <HeaderWithProfile title="Order History" showBack={true} />,
        }}
      />
      <Stack.Screen 
        name="OrderDetails" 
        component={OrderDetailsScreen}
        options={{
          header: () => <HeaderWithProfile title="Order Details" showBack={true} />,
        }}
      />
    </Stack.Navigator>
  );
};

export default OrderNavigator;