import { useState, useEffect, useCallback } from 'react';
import { LocationData, LocationPermissionStatus, MapMarker } from '@/types';
import { locationService } from '@/services/locationService';

/**
 * Hook for location services functionality
 */
export const useLocation = () => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus>('unknown');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    initializeLocation();
    return () => {
      locationService.cleanup();
    };
  }, []);

  const initializeLocation = async () => {
    try {
      setIsLoading(true);
      locationService.initialize({
        onLocationUpdate: (location) => {
          setCurrentLocation(location);
          setError(null);
        },
        onLocationError: (error) => {
          setError(error);
        },
        onPermissionDenied: () => {
          setPermissionStatus('denied');
        },
      });

      const permission = await locationService.requestLocationPermission();
      setPermissionStatus(permission);

      if (permission === 'granted') {
        const location = await locationService.getCurrentLocation();
        setCurrentLocation(location);
      }
    } catch (error) {
      console.error('Failed to initialize location:', error);
      setError('Failed to initialize location services');
    } finally {
      setIsLoading(false);
    }
  };

  const requestPermission = useCallback(async () => {
    try {
      const permission = await locationService.requestLocationPermission();
      setPermissionStatus(permission);
      return permission;
    } catch (error) {
      console.error('Failed to request permission:', error);
      setError('Failed to request location permission');
      return 'denied';
    }
  }, []);

  const getCurrentLocation = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const location = await locationService.getCurrentLocation();
      setCurrentLocation(location);
      return location;
    } catch (error) {
      console.error('Failed to get current location:', error);
      setError('Failed to get current location');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startTracking = useCallback(async () => {
    try {
      setError(null);
      await locationService.startLocationTracking();
      setIsTracking(true);
    } catch (error) {
      console.error('Failed to start tracking:', error);
      setError('Failed to start location tracking');
    }
  }, []);

  const stopTracking = useCallback(() => {
    locationService.stopLocationTracking();
    setIsTracking(false);
  }, []);

  const calculateDistance = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number) => {
      return locationService.calculateDistance(lat1, lon1, lat2, lon2);
    },
    []
  );

  const isWithinRadius = useCallback(
    (centerLat: number, centerLon: number, targetLat: number, targetLon: number, radiusKm: number) => {
      return locationService.isWithinRadius(centerLat, centerLon, targetLat, targetLon, radiusKm);
    },
    []
  );

  const getNearbyLocations = useCallback(
    <T extends { latitude: number; longitude: number }>(
      locations: T[],
      radiusKm: number
    ): Array<T & { distance: number }> => {
      if (!currentLocation) return [];
      
      return locationService.getNearbyLocations(
        locations,
        currentLocation.latitude,
        currentLocation.longitude,
        radiusKm
      );
    },
    [currentLocation]
  );

  const reverseGeocode = useCallback(async (latitude: number, longitude: number) => {
    try {
      return await locationService.reverseGeocode(latitude, longitude);
    } catch (error) {
      console.error('Failed to reverse geocode:', error);
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
  }, []);

  const forwardGeocode = useCallback(async (address: string) => {
    try {
      return await locationService.forwardGeocode(address);
    } catch (error) {
      console.error('Failed to forward geocode:', error);
      return null;
    }
  }, []);

  return {
    currentLocation,
    isTracking,
    permissionStatus,
    error,
    isLoading,
    requestPermission,
    getCurrentLocation,
    startTracking,
    stopTracking,
    calculateDistance,
    isWithinRadius,
    getNearbyLocations,
    reverseGeocode,
    forwardGeocode,
  };
};

/**
 * Hook for map functionality
 */
export const useMap = () => {
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: -1.2921,
    longitude: 36.8219,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });
  const [markerFilters, setMarkerFilters] = useState<string[]>([]);
  const [radiusFilter, setRadiusFilter] = useState<number | null>(null);

  const addMarker = useCallback((marker: MapMarker) => {
    setMarkers(prev => [...prev, marker]);
  }, []);

  const removeMarker = useCallback((markerId: string) => {
    setMarkers(prev => prev.filter(marker => marker.id !== markerId));
  }, []);

  const updateMarker = useCallback((markerId: string, updates: Partial<MapMarker>) => {
    setMarkers(prev =>
      prev.map(marker =>
        marker.id === markerId ? { ...marker, ...updates } : marker
      )
    );
  }, []);

  const clearMarkers = useCallback(() => {
    setMarkers([]);
    setSelectedMarker(null);
  }, []);

  const toggleMarkerFilter = useCallback((filter: string) => {
    setMarkerFilters(prev =>
      prev.includes(filter)
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setMarkerFilters([]);
    setRadiusFilter(null);
  }, []);

  const getFilteredMarkers = useCallback(() => {
    let filtered = markers;

    // Apply type filters
    if (markerFilters.length > 0) {
      filtered = filtered.filter(marker => markerFilters.includes(marker.type));
    }

    return filtered;
  }, [markers, markerFilters]);

  const centerMapOnMarker = useCallback((marker: MapMarker) => {
    setMapRegion({
      latitude: marker.latitude,
      longitude: marker.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    setSelectedMarker(marker);
  }, []);

  const centerMapOnLocation = useCallback((location: LocationData) => {
    setMapRegion({
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    });
  }, []);

  return {
    markers,
    selectedMarker,
    mapRegion,
    markerFilters,
    radiusFilter,
    addMarker,
    removeMarker,
    updateMarker,
    clearMarkers,
    toggleMarkerFilter,
    clearFilters,
    getFilteredMarkers,
    centerMapOnMarker,
    centerMapOnLocation,
    setSelectedMarker,
    setMapRegion,
    setRadiusFilter,
  };
};

/**
 * Hook for location-based product search
 */
export const useLocationBasedSearch = () => {
  const { currentLocation } = useLocation();
  const [searchRadius, setSearchRadius] = useState(50); // km
  const [locationResults, setLocationResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchNearbyProducts = useCallback(async (category?: string) => {
    if (!currentLocation) return [];

    try {
      setIsSearching(true);
      // This would call your backend API with location parameters
      const results = await fetch('/api/products/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          radius: searchRadius,
          category,
        }),
      });

      if (results.ok) {
        const data = await results.json();
        setLocationResults(data);
        return data;
      }

      return [];
    } catch (error) {
      console.error('Failed to search nearby products:', error);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [currentLocation, searchRadius]);

  const searchNearbyFarmers = useCallback(async () => {
    if (!currentLocation) return [];

    try {
      setIsSearching(true);
      // Similar API call for farmers
      const results = await fetch('/api/farmers/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          radius: searchRadius,
        }),
      });

      if (results.ok) {
        const data = await results.json();
        return data;
      }

      return [];
    } catch (error) {
      console.error('Failed to search nearby farmers:', error);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [currentLocation, searchRadius]);

  const searchNearbyMarkets = useCallback(async () => {
    if (!currentLocation) return [];

    try {
      setIsSearching(true);
      // Similar API call for markets
      const results = await fetch('/api/markets/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          radius: searchRadius,
        }),
      });

      if (results.ok) {
        const data = await results.json();
        return data;
      }

      return [];
    } catch (error) {
      console.error('Failed to search nearby markets:', error);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [currentLocation, searchRadius]);

  return {
    currentLocation,
    searchRadius,
    locationResults,
    isSearching,
    setSearchRadius,
    searchNearbyProducts,
    searchNearbyFarmers,
    searchNearbyMarkets,
  };
};

/**
 * Hook for delivery and logistics
 */
export const useDelivery = () => {
  const { currentLocation, calculateDistance } = useLocation();

  const calculateDeliveryDistance = useCallback(
    (destinationLat: number, destinationLon: number) => {
      if (!currentLocation) return null;
      
      return calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        destinationLat,
        destinationLon
      );
    },
    [currentLocation, calculateDistance]
  );

  const estimateDeliveryTime = useCallback(
    (distance: number, transportType: 'walking' | 'bicycle' | 'motorcycle' | 'car' | 'truck' = 'car') => {
      const speeds = {
        walking: 5, // km/h
        bicycle: 15,
        motorcycle: 40,
        car: 50,
        truck: 35,
      };

      const speed = speeds[transportType];
      return (distance / speed) * 60; // minutes
    },
    []
  );

  const estimateDeliveryCost = useCallback(
    (distance: number, weight: number = 1) => {
      // Simple cost calculation - in real app, this would be more sophisticated
      const baseCost = 2; // Base delivery cost
      const distanceCost = distance * 0.5; // Cost per km
      const weightCost = weight > 5 ? (weight - 5) * 0.2 : 0; // Extra cost for heavy items

      return baseCost + distanceCost + weightCost;
    },
    []
  );

  return {
    currentLocation,
    calculateDeliveryDistance,
    estimateDeliveryTime,
    estimateDeliveryCost,
  };
};