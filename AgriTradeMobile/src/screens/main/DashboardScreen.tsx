import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RootState, AppDispatch } from '@/store';
import { fetchProducts } from '@/store/slices/productsSlice';
import ProductCard from '@/components/product/ProductCard';
import QualityIndicator from '@/components/product/QualityIndicator';

const { width: screenWidth } = Dimensions.get('window');

const DashboardScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation();
  const { user } = useSelector((state: RootState) => state.auth);
  const { items: products, isLoading } = useSelector((state: RootState) => state.products);
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    // Load initial data
    dispatch(fetchProducts({ page: 1, limit: 10 }));
  }, [dispatch]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchProducts({ page: 1, limit: 10 }));
    setRefreshing(false);
  }, [dispatch]);

  const handleProductPress = (productId: string) => {
    navigation.navigate('Products' as never, { 
      screen: 'ProductDetails', 
      params: { productId } 
    } as never);
  };

  const handleQualityAnalysis = () => {
    navigation.navigate('Home' as never, { 
      screen: 'QualityAnalysis' 
    } as never);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const userRecentProducts = products.filter(p => p.farmerId === user?._id).slice(0, 3);
  const featuredProducts = products.slice(0, 5);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.greeting}>
          {getGreeting()}, {user?.name || 'Farmer'}! 👋
        </Text>
        <Text style={styles.welcomeText}>
          {user?.userType === 'farmer' 
            ? "Ready to showcase your quality crops?"
            : "Discover quality products from local farmers"
          }
        </Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={handleQualityAnalysis}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#E8F5E8' }]}>
              <Icon name="camera-alt" size={24} color="#2E7D32" />
            </View>
            <Text style={styles.quickActionTitle}>Analyze Quality</Text>
            <Text style={styles.quickActionSubtitle}>AI-powered analysis</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Products' as never)}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#FFF3E0' }]}>
              <Icon name="add-shopping-cart" size={24} color="#FF8F00" />
            </View>
            <Text style={styles.quickActionTitle}>Browse Products</Text>
            <Text style={styles.quickActionSubtitle}>Find quality crops</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Orders' as never)}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#E3F2FD' }]}>
              <Icon name="list-alt" size={24} color="#2196F3" />
            </View>
            <Text style={styles.quickActionTitle}>My Orders</Text>
            <Text style={styles.quickActionSubtitle}>Track progress</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Profile' as never)}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#F3E5F5' }]}>
              <Icon name="account-circle" size={24} color="#9C27B0" />
            </View>
            <Text style={styles.quickActionTitle}>Profile</Text>
            <Text style={styles.quickActionSubtitle}>Settings & info</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Section for Farmers */}
      {user?.userType === 'farmer' && (
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Your Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>12</Text>
              <Text style={styles.statLabel}>Products Listed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>8.2</Text>
              <Text style={styles.statLabel}>Avg. Quality Score</Text>
              <QualityIndicator score={8.2} size="small" showLabel={false} />
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>$2,450</Text>
              <Text style={styles.statLabel}>Monthly Revenue</Text>
            </View>
          </View>
        </View>
      )}

      {/* Recent Products for Farmers */}
      {user?.userType === 'farmer' && userRecentProducts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Recent Products</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Products' as never)}>
              <Text style={styles.sectionLink}>View All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {userRecentProducts.map((product) => (
              <View key={product._id} style={styles.horizontalProductCard}>
                <ProductCard
                  product={product}
                  onPress={handleProductPress}
                  showActions={false}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Featured Products */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {user?.userType === 'farmer' ? 'Featured Products' : 'Quality Products'}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Products' as never)}>
            <Text style={styles.sectionLink}>View All</Text>
          </TouchableOpacity>
        </View>
        {featuredProducts.map((product) => (
          <ProductCard
            key={product._id}
            product={product}
            onPress={handleProductPress}
            showActions={user?.userType === 'buyer'}
          />
        ))}
      </View>

      {/* Bottom Spacing */}
      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  welcomeSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 16,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 16,
    color: '#757575',
    lineHeight: 22,
  },
  quickActionsSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: (screenWidth - 60) / 2,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 4,
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: '#757575',
    textAlign: 'center',
  },
  statsSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 4,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#757575',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  horizontalProductCard: {
    width: 200,
    marginRight: 16,
  },
  bottomSpacing: {
    height: 20,
  },
});

export default DashboardScreen;