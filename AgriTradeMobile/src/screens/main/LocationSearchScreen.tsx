import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AgriTradeMapView from '@/components/common/MapView';
import { ProductCard } from '@/components/product';
import { useLocation, useLocationBasedSearch } from '@/hooks/useLocation';
import { useI18n } from '@/hooks/useVoiceI18n';
import { LocationSearchScreenProps } from '@/types';

const LocationSearchScreen: React.FC<LocationSearchScreenProps> = ({ navigation }) => {
  const { t } = useI18n();
  const {
    currentLocation,
    permissionStatus,
    error: locationError,
    requestPermission,
  } = useLocation();
  
  const {
    searchRadius,
    locationResults,
    isSearching,
    setSearchRadius,
    searchNearbyProducts,
    searchNearbyFarmers,
    searchNearbyMarkets,
  } = useLocationBasedSearch();

  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');
  const [searchCategory, setSearchCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mapMarkers, setMapMarkers] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const categories = [
    { key: 'all', label: t('category.all'), icon: 'apps' },
    { key: 'vegetables', label: t('category.vegetables'), icon: 'local-florist' },
    { key: 'fruits', label: t('category.fruits'), icon: 'local-grocery-store' },
    { key: 'grains', label: t('category.grains'), icon: 'grass' },
    { key: 'legumes', label: t('category.legumes'), icon: 'eco' },
  ];

  const radiusOptions = [10, 25, 50, 100, 200];

  useEffect(() => {
    if (permissionStatus === 'granted' && currentLocation) {
      performSearch();
    }
  }, [currentLocation, searchCategory, searchRadius]);

  const performSearch = async () => {
    if (!currentLocation) return;

    try {
      const [products, farmers, markets] = await Promise.all([
        searchNearbyProducts(searchCategory === 'all' ? undefined : searchCategory),
        searchNearbyFarmers(),
        searchNearbyMarkets(),
      ]);

      // Convert results to map markers
      const markers = [
        ...products.map((product: any) => ({
          id: `product-${product.id}`,
          type: 'product',
          latitude: product.latitude,
          longitude: product.longitude,
          title: product.name,
          description: `${product.price} | ${product.farmerName}`,
          price: product.price,
        })),
        ...farmers.map((farmer: any) => ({
          id: `farmer-${farmer.id}`,
          type: 'farmer',
          latitude: farmer.latitude,
          longitude: farmer.longitude,
          title: farmer.name,
          description: `${farmer.productsCount} products`,
        })),
        ...markets.map((market: any) => ({
          id: `market-${market.id}`,
          type: 'market',
          latitude: market.latitude,
          longitude: market.longitude,
          title: market.name,
          description: market.description,
        })),
      ];

      setMapMarkers(markers);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await performSearch();
    setIsRefreshing(false);
  };

  const handleLocationPermission = async () => {
    const permission = await requestPermission();
    if (permission !== 'granted') {
      // Show permission explanation
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Icon name="search" size={20} color="#757575" />
          <TextInput
            style={styles.searchInput}
            placeholder={t('location.searchPlaceholder')}
            placeholderTextColor="#9E9E9E"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        
        <TouchableOpacity style={styles.filterButton} activeOpacity={0.7}>
          <Icon name="tune" size={20} color="#2E7D32" />
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryFilter}
        contentContainerStyle={styles.categoryFilterContent}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category.key}
            style={[
              styles.categoryButton,
              searchCategory === category.key && styles.categoryButtonActive,
            ]}
            onPress={() => setSearchCategory(category.key)}
            activeOpacity={0.7}
          >
            <Icon
              name={category.icon}
              size={16}
              color={searchCategory === category.key ? '#FFFFFF' : '#757575'}
            />
            <Text
              style={[
                styles.categoryButtonText,
                searchCategory === category.key && styles.categoryButtonTextActive,
              ]}
            >
              {category.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Radius Filter */}
      <View style={styles.radiusFilter}>
        <Text style={styles.radiusLabel}>{t('location.searchRadius')}: {searchRadius}km</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.radiusOptions}
        >
          {radiusOptions.map((radius) => (
            <TouchableOpacity
              key={radius}
              style={[
                styles.radiusOption,
                searchRadius === radius && styles.radiusOptionActive,
              ]}
              onPress={() => setSearchRadius(radius)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.radiusOptionText,
                  searchRadius === radius && styles.radiusOptionTextActive,
                ]}
              >
                {radius}km
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'map' && styles.tabActive]}
          onPress={() => setActiveTab('map')}
          activeOpacity={0.7}
        >
          <Icon
            name="map"
            size={18}
            color={activeTab === 'map' ? '#FFFFFF' : '#757575'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'map' && styles.tabTextActive,
            ]}
          >
            {t('location.mapView')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'list' && styles.tabActive]}
          onPress={() => setActiveTab('list')}
          activeOpacity={0.7}
        >
          <Icon
            name="list"
            size={18}
            color={activeTab === 'list' ? '#FFFFFF' : '#757575'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'list' && styles.tabTextActive,
            ]}
          >
            {t('location.listView')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderLocationPermissionRequest = () => (
    <View style={styles.permissionContainer}>
      <Icon name="location-off" size={64} color="#E0E0E0" />
      <Text style={styles.permissionTitle}>{t('location.permissionRequired')}</Text>
      <Text style={styles.permissionText}>{t('location.permissionDescription')}</Text>
      <TouchableOpacity
        style={styles.permissionButton}
        onPress={handleLocationPermission}
        activeOpacity={0.7}
      >
        <Text style={styles.permissionButtonText}>{t('location.enableLocation')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMapView = () => (
    <AgriTradeMapView
      markers={mapMarkers}
      showUserLocation={true}
      showLocationButton={true}
      radiusFilter={searchRadius}
      isLoading={isSearching}
      onMarkerPress={(marker) => {
        // Handle marker press - navigate to detail screen
        console.log('Marker pressed:', marker);
      }}
    />
  );

  const renderListView = () => (
    <ScrollView
      style={styles.listContainer}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={['#2E7D32']}
          tintColor="#2E7D32"
        />
      }
    >
      {locationResults.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="location-searching" size={48} color="#E0E0E0" />
          <Text style={styles.emptyStateTitle}>{t('location.noResults')}</Text>
          <Text style={styles.emptyStateText}>{t('location.noResultsDescription')}</Text>
        </View>
      ) : (
        locationResults.map((item, index) => (
          <ProductCard
            key={`${item.type}-${item.id}`}
            product={item}
            onPress={() => {
              // Navigate to detail screen
              navigation.navigate('ProductDetails', { productId: item.id });
            }}
            showDistance={true}
          />
        ))
      )}
    </ScrollView>
  );

  const renderContent = () => {
    if (permissionStatus !== 'granted') {
      return renderLocationPermissionRequest();
    }

    if (locationError) {
      return (
        <View style={styles.errorContainer}>
          <Icon name="error" size={48} color="#F44336" />
          <Text style={styles.errorTitle}>{t('location.error')}</Text>
          <Text style={styles.errorText}>{locationError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRefresh}
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.content}>
        {activeTab === 'map' ? renderMapView() : renderListView()}
        
        {/* Loading Overlay */}
        {isSearching && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>{t('location.searching')}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      {renderContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#212121',
    marginLeft: 8,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryFilter: {
    marginBottom: 16,
  },
  categoryFilterContent: {
    paddingRight: 16,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#2E7D32',
  },
  categoryButtonText: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 4,
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  radiusFilter: {
    marginBottom: 16,
  },
  radiusLabel: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 8,
  },
  radiusOptions: {
    flexDirection: 'row',
  },
  radiusOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  radiusOptionActive: {
    backgroundColor: '#2E7D32',
  },
  radiusOptionText: {
    fontSize: 11,
    color: '#757575',
  },
  radiusOptionTextActive: {
    color: '#FFFFFF',
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#2E7D32',
  },
  tabText: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 4,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#757575',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F44336',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#F44336',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#212121',
    marginTop: 12,
  },
});

export default LocationSearchScreen;