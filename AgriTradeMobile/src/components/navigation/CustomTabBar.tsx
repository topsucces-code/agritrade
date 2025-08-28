import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';

const CustomTabBar: React.FC<BottomTabBarProps> = ({ 
  state, 
  descriptors, 
  navigation 
}) => {
  const insets = useSafeAreaInsets();
  const { tabBarVisible } = useSelector((state: RootState) => state.ui);
  const { user } = useSelector((state: RootState) => state.auth);

  if (!tabBarVisible) {
    return null;
  }

  const getIconName = (routeName: string, focused: boolean) => {
    switch (routeName) {
      case 'Home':
        return focused ? 'dashboard' : 'dashboard';
      case 'Products':
        return focused ? 'inventory' : 'inventory-2';
      case 'Orders':
        return focused ? 'shopping-cart' : 'shopping-cart';
      case 'Profile':
        return focused ? 'person' : 'person-outline';
      default:
        return 'help';
    }
  };

  const getTabLabel = (routeName: string) => {
    switch (routeName) {
      case 'Home':
        return 'Home';
      case 'Products':
        return user?.userType === 'farmer' ? 'My Products' : 'Browse';
      case 'Orders':
        return 'Orders';
      case 'Profile':
        return 'Profile';
      default:
        return routeName;
    }
  };

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            <Animated.View style={[
              styles.iconContainer,
              isFocused && styles.iconContainerFocused
            ]}>
              <Icon 
                name={getIconName(route.name, isFocused)} 
                size={24} 
                color={isFocused ? '#2E7D32' : '#757575'} 
              />
            </Animated.View>
            <Text style={[
              styles.tabLabel,
              isFocused ? styles.tabLabelFocused : styles.tabLabelInactive
            ]}>
              {getTabLabel(route.name)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E0E0E0',
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconContainer: {
    padding: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  iconContainerFocused: {
    backgroundColor: 'rgba(46, 125, 50, 0.1)',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  tabLabelFocused: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  tabLabelInactive: {
    color: '#757575',
  },
});

export default CustomTabBar;