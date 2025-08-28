import Geolocation from '@react-native-community/geolocation';
import { request, PERMISSIONS, RESULTS, Permission } from 'react-native-permissions';
import { Platform, Alert } from 'react-native';
import { LocationData, LocationPermissionStatus } from '@/types';

interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  distanceFilter?: number;
}

interface LocationServiceCallbacks {
  onLocationUpdate?: (location: LocationData) => void;
  onLocationError?: (error: string) => void;
  onPermissionDenied?: () => void;
}

class LocationService {
  private watchId: number | null = null;
  private currentLocation: LocationData | null = null;
  private isTracking = false;
  private callbacks: LocationServiceCallbacks = {};

  /**
   * Initialize location service
   */
  initialize(callbacks: LocationServiceCallbacks = {}): void {
    this.callbacks = callbacks;
    
    // Configure geolocation
    Geolocation.setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: 'whenInUse',
      enableBackgroundLocationUpdates: false,
      locationProvider: 'auto',
    });
  }

  /**
   * Request location permissions
   */
  async requestLocationPermission(): Promise<LocationPermissionStatus> {
    try {
      let permission: Permission;
      
      if (Platform.OS === 'ios') {
        permission = PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
      } else {
        permission = PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
      }

      const result = await request(permission);
      
      switch (result) {
        case RESULTS.GRANTED:
          return 'granted';
        case RESULTS.DENIED:
          return 'denied';
        case RESULTS.BLOCKED:
          return 'blocked';
        case RESULTS.UNAVAILABLE:
          return 'unavailable';
        default:
          return 'denied';
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return 'denied';
    }
  }

  /**
   * Get current location
   */
  async getCurrentLocation(options: GeolocationOptions = {}): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      const defaultOptions = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
        ...options,
      };

      Geolocation.getCurrentPosition(
        (position) => {
          const location: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 0,
            altitude: position.coords.altitude || 0,
            heading: position.coords.heading || 0,
            speed: position.coords.speed || 0,
            timestamp: position.timestamp,
          };

          this.currentLocation = location;
          resolve(location);
        },
        (error) => {
          console.error('Geolocation error:', error);
          const errorMessage = this.getLocationErrorMessage(error.code);
          this.callbacks.onLocationError?.(errorMessage);
          reject(new Error(errorMessage));
        },
        defaultOptions
      );
    });
  }

  /**
   * Start watching location changes
   */
  async startLocationTracking(options: GeolocationOptions = {}): Promise<void> {
    if (this.isTracking) {
      console.warn('Location tracking is already active');
      return;
    }

    const permission = await this.requestLocationPermission();
    if (permission !== 'granted') {
      this.callbacks.onPermissionDenied?.();
      throw new Error('Location permission not granted');
    }

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 5000,
      distanceFilter: 10, // Update every 10 meters
      ...options,
    };

    this.watchId = Geolocation.watchPosition(
      (position) => {
        const location: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy || 0,
          altitude: position.coords.altitude || 0,
          heading: position.coords.heading || 0,
          speed: position.coords.speed || 0,
          timestamp: position.timestamp,
        };

        this.currentLocation = location;
        this.callbacks.onLocationUpdate?.(location);
      },
      (error) => {
        console.error('Location tracking error:', error);
        const errorMessage = this.getLocationErrorMessage(error.code);
        this.callbacks.onLocationError?.(errorMessage);
      },
      defaultOptions
    );

    this.isTracking = true;
  }

  /**
   * Stop watching location changes
   */
  stopLocationTracking(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
  }

  /**
   * Get current cached location
   */
  getCachedLocation(): LocationData | null {
    return this.currentLocation;
  }

  /**
   * Check if location tracking is active
   */
  isLocationTracking(): boolean {
    return this.isTracking;
  }

  /**
   * Calculate distance between two coordinates (in kilometers)
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Get bearing between two coordinates
   */
  calculateBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const dLon = this.toRadians(lon2 - lon1);
    const lat1Rad = this.toRadians(lat1);
    const lat2Rad = this.toRadians(lat2);

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    const bearing = Math.atan2(y, x);
    return (this.toDegrees(bearing) + 360) % 360;
  }

  /**
   * Check if location is within radius of another location
   */
  isWithinRadius(
    centerLat: number,
    centerLon: number,
    targetLat: number,
    targetLon: number,
    radiusKm: number
  ): boolean {
    const distance = this.calculateDistance(centerLat, centerLon, targetLat, targetLon);
    return distance <= radiusKm;
  }

  /**
   * Get nearby locations within radius
   */
  getNearbyLocations<T extends { latitude: number; longitude: number }>(
    locations: T[],
    centerLat: number,
    centerLon: number,
    radiusKm: number
  ): Array<T & { distance: number }> {
    return locations
      .map(location => ({
        ...location,
        distance: this.calculateDistance(
          centerLat,
          centerLon,
          location.latitude,
          location.longitude
        ),
      }))
      .filter(location => location.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * Reverse geocoding - convert coordinates to address (mock implementation)
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    try {
      // In a real implementation, you would call a geocoding service like:
      // - Google Maps Geocoding API
      // - Mapbox Geocoding API
      // - OpenStreetMap Nominatim
      
      // Mock implementation
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=YOUR_MAPBOX_TOKEN`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          return data.features[0].place_name;
        }
      }
      
      // Fallback to coordinates
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
  }

  /**
   * Forward geocoding - convert address to coordinates (mock implementation)
   */
  async forwardGeocode(address: string): Promise<LocationData | null> {
    try {
      // Mock implementation - in real app, use geocoding service
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=YOUR_MAPBOX_TOKEN`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const [longitude, latitude] = data.features[0].center;
          return {
            latitude,
            longitude,
            accuracy: 0,
            altitude: 0,
            heading: 0,
            speed: 0,
            timestamp: Date.now(),
            address: data.features[0].place_name,
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Forward geocoding error:', error);
      return null;
    }
  }

  /**
   * Get location-based suggestions for farmers/products
   */
  getLocationBasedSuggestions(currentLocation: LocationData, maxDistance: number = 50) {
    // This would integrate with your backend to get location-based suggestions
    // For now, return mock data structure
    return {
      nearbyFarmers: [],
      nearbyMarkets: [],
      nearbyBuyers: [],
      localPrices: [],
      weatherInfo: null,
    };
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convert radians to degrees
   */
  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  /**
   * Get human-readable error message
   */
  private getLocationErrorMessage(errorCode: number): string {
    switch (errorCode) {
      case 1:
        return 'Location access denied by user';
      case 2:
        return 'Location unavailable';
      case 3:
        return 'Location request timed out';
      default:
        return 'Unknown location error';
    }
  }

  /**
   * Show location permission alert
   */
  showLocationPermissionAlert(): void {
    Alert.alert(
      'Location Permission Required',
      'AgriTrade needs access to your location to show nearby farmers, markets, and provide location-based services.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => {
          // In real app, open device settings
          console.log('Open device settings');
        }},
      ]
    );
  }

  /**
   * Cleanup location service
   */
  cleanup(): void {
    this.stopLocationTracking();
    this.currentLocation = null;
    this.callbacks = {};
  }
}

export const locationService = new LocationService();
export default locationService;