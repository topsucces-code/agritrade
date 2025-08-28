import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ProductStackParamList } from '@/types';

// Import screens
import { 
  ProductListScreen,
  ProductDetailsScreen,
  AddProductScreen,
  EditProductScreen
} from '@/screens/main';

// Import custom header
import HeaderWithProfile from '@/components/navigation/HeaderWithProfile';

const Stack = createStackNavigator<ProductStackParamList>();

const ProductNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        cardStyle: { backgroundColor: '#F5F5F5' },
        animationEnabled: true,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen 
        name="ProductList" 
        component={ProductListScreen}
        options={{
          header: () => <HeaderWithProfile title="Products" showSearch={true} />,
        }}
      />
      <Stack.Screen 
        name="ProductDetails" 
        component={ProductDetailsScreen}
        options={{
          header: () => <HeaderWithProfile title="Product Details" showBack={true} />,
        }}
      />
      <Stack.Screen 
        name="AddProduct" 
        component={AddProductScreen}
        options={{
          header: () => <HeaderWithProfile title="Add Product" showBack={true} />,
          gestureEnabled: false, // Prevent accidental navigation during form filling
        }}
      />
      <Stack.Screen 
        name="EditProduct" 
        component={EditProductScreen}
        options={{
          header: () => <HeaderWithProfile title="Edit Product" showBack={true} />,
          gestureEnabled: false, // Prevent accidental navigation during form editing
        }}
      />
    </Stack.Navigator>
  );
};

export default ProductNavigator;