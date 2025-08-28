import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Circle, Callout, Region } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MapViewProps, LocationData, MapMarker, MarkerType } from '@/types';
import { locationService } from '@/services/locationService';
import { useI18n } from '@/hooks/useVoiceI18n';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const AgriTradeMapView: React.FC<MapViewProps> = ({
  initialRegion,
  markers = [],
  showUserLocation = true,
  showLocationButton = true,
  onMarkerPress,
  onMapPress,
  onRegionChange,
  radiusFilter,
  markerFilters = [],
  isLoading = false,
}) => {
  const { t } = useI18n();
  const mapRef = useRef<MapView>(null);
  
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>(
    initialRegion || {
      latitude: -1.2921, // Nairobi, Kenya (default for African agricultural context)
      longitude: 36.8219,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    }
  );
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [locationPermission, setLocationPermission] = useState<string>('unknown');

  useEffect(() => {
    initializeLocation();
    return () => {
      locationService.cleanup();
    };
  }, []);

  const initializeLocation = async () => {
    try {
      const permission = await locationService.requestLocationPermission();
      setLocationPermission(permission);

      if (permission === 'granted') {
        const location = await locationService.getCurrentLocation();
        setCurrentLocation(location);
        
        // Center map on user location if no initial region provided
        if (!initialRegion) {
          setMapRegion({
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          });
        }
      }
    } catch (error) {
      console.error('Failed to get location:', error);
    }
  };

  const handleMyLocationPress = async () => {
    try {
      if (locationPermission !== 'granted') {
        const permission = await locationService.requestLocationPermission();
        if (permission !== 'granted') {
          locationService.showLocationPermissionAlert();
          return;
        }
      }

      const location = await locationService.getCurrentLocation();
      setCurrentLocation(location);

      const newRegion = {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

      setMapRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 1000);
    } catch (error) {
      console.error('Failed to get current location:', error);
    }
  };

  const handleMarkerPress = (marker: MapMarker) => {
    setSelectedMarker(marker);
    onMarkerPress?.(marker);
  };

  const handleMapPress = () => {
    setSelectedMarker(null);
    onMapPress?.();
  };

  const handleRegionChange = (region: Region) => {
    setMapRegion(region);
    onRegionChange?.(region);
  };

  const getMarkerIcon = (type: MarkerType): string => {
    switch (type) {
      case 'farmer':
        return 'agriculture';
      case 'buyer':
        return 'business';
      case 'market':
        return 'store';
      case 'product':
        return 'inventory';
      case 'warehouse':
        return 'warehouse';
      default:
        return 'place';
    }
  };

  const getMarkerColor = (type: MarkerType): string => {
    switch (type) {
      case 'farmer':
        return '#4CAF50';
      case 'buyer':
        return '#2196F3';
      case 'market':
        return '#FF9800';
      case 'product':
        return '#9C27B0';
      case 'warehouse':
        return '#795548';
      default:
        return '#757575';
    }
  };

  const filterMarkers = (): MapMarker[] => {
    let filteredMarkers = markers;

    // Apply marker type filters
    if (markerFilters.length > 0) {
      filteredMarkers = filteredMarkers.filter(marker =>
        markerFilters.includes(marker.type)
      );
    }

    // Apply radius filter if enabled and user location available
    if (radiusFilter && currentLocation) {
      filteredMarkers = filteredMarkers.filter(marker =>
        locationService.isWithinRadius(
          currentLocation.latitude,
          currentLocation.longitude,
          marker.latitude,
          marker.longitude,
          radiusFilter
        )
      );
    }

    return filteredMarkers;
  };

  const renderMarker = (marker: MapMarker) => (
    <Marker
      key={marker.id}
      coordinate={{
        latitude: marker.latitude,
        longitude: marker.longitude,
      }}
      title={marker.title}
      description={marker.description}
      onPress={() => handleMarkerPress(marker)}
    >
      <View style={[
        styles.markerContainer,
        { backgroundColor: getMarkerColor(marker.type) }
      ]}>
        <Icon
          name={getMarkerIcon(marker.type)}
          size={20}
          color="#FFFFFF"
        />
      </View>

      <Callout style={styles.callout}>
        <View style={styles.calloutContainer}>
          <Text style={styles.calloutTitle}>{marker.title}</Text>
          <Text style={styles.calloutDescription}>{marker.description}</Text>
          {marker.distance && (
            <Text style={styles.calloutDistance}>
              {marker.distance.toFixed(1)} km {t('common.away')}
            </Text>
          )}
          {marker.price && (
            <Text style={styles.calloutPrice}>
              {marker.price}
            </Text>
          )}
        </View>
      </Callout>
    </Marker>
  );

  const renderUserLocationMarker = () => {
    if (!showUserLocation || !currentLocation) return null;

    return (
      <Marker
        coordinate={{
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        }}
        title={t('map.yourLocation')}
        description={t('map.currentPosition')}
      >
        <View style={styles.userLocationMarker}>
          <View style={styles.userLocationDot} />
        </View>
      </Marker>
    );
  };

  const renderRadiusCircle = () => {
    if (!radiusFilter || !currentLocation) return null;

    return (
      <Circle
        center={{
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        }}
        radius={radiusFilter * 1000} // Convert km to meters
        strokeWidth={2}
        strokeColor="rgba(46, 125, 50, 0.5)"
        fillColor="rgba(46, 125, 50, 0.1)"
      />
    );
  };

  const renderLocationButton = () => {
    if (!showLocationButton) return null;

    return (
      <TouchableOpacity
        style={styles.locationButton}
        onPress={handleMyLocationPress}
        activeOpacity={0.7}
      >
        <Icon name="my-location" size={24} color="#2E7D32" />
      </TouchableOpacity>
    );
  };

  const renderFilterControls = () => {
    if (markerFilters.length === 0) return null;

    return (
      <View style={styles.filterControls}>
        <Text style={styles.filterTitle}>{t('map.filters')}</Text>
        <View style={styles.filterButtons}>
          {['farmer', 'buyer', 'market', 'product'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterButton,
                markerFilters.includes(type as MarkerType) && styles.filterButtonActive
              ]}
              onPress={() => {
                // Toggle filter - this would be handled by parent component
                console.log(`Toggle filter: ${type}`);
              }}
            >
              <Icon
                name={getMarkerIcon(type as MarkerType)}
                size={16}
                color={markerFilters.includes(type as MarkerType) ? '#FFFFFF' : '#757575'}
              />
              <Text style={[
                styles.filterButtonText,
                markerFilters.includes(type as MarkerType) && styles.filterButtonTextActive
              ]}>
                {t(`map.${type}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderLoadingOverlay = () => {
    if (!isLoading) return null;

    return (
      <View style={styles.loadingOverlay}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>{t('map.loading')}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        region={mapRegion}
        onRegionChangeComplete={handleRegionChange}
        onPress={handleMapPress}
        showsUserLocation={false} // We'll use custom marker
        showsMyLocationButton={false} // We'll use custom button
        showsCompass={true}
        showsScale={true}
        mapType="standard"
      >
        {renderUserLocationMarker()}
        {filterMarkers().map(renderMarker)}
        {renderRadiusCircle()}
      </MapView>

      {renderLocationButton()}
      {renderFilterControls()}
      {renderLoadingOverlay()}

      {/* Map Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>{t('map.legend')}</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.legendText}>{t('map.farmer')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
            <Text style={styles.legendText}>{t('map.buyer')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
            <Text style={styles.legendText}>{t('map.market')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  userLocationMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2E7D32',
  },
  callout: {
    width: 200,
  },
  calloutContainer: {
    padding: 8,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  calloutDescription: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 4,
  },
  calloutDistance: {
    fontSize: 11,
    color: '#9E9E9E',
    fontStyle: 'italic',
  },
  calloutPrice: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
    marginTop: 4,
  },
  locationButton: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  filterControls: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterButtonActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 4,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  legend: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  legendItems: {
    gap: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 10,
    color: '#757575',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#212121',
    marginTop: 12,
  },
});

export default AgriTradeMapView;