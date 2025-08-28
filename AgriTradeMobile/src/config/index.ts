import { NativeModules } from 'react-native';

const Config = {
  // API Configuration
  API_BASE_URL: __DEV__ 
    ? 'http://localhost:3000/api' 
    : 'https://api.agritrade.ai/api',
  
  // WebSocket Configuration
  WS_URL: __DEV__ 
    ? 'ws://localhost:3000' 
    : 'wss://api.agritrade.ai',
  
  // Environment
  NODE_ENV: __DEV__ ? 'development' : 'production',
  
  // Feature Flags
  ENABLE_DEBUG_LOGS: __DEV__,
  ENABLE_ANALYTICS: !__DEV__,
  ENABLE_CRASHLYTICS: !__DEV__,
  
  // API Timeouts
  API_TIMEOUT: 15000,
  UPLOAD_TIMEOUT: 60000,
  
  // Image Configuration
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  IMAGE_QUALITY: 0.8,
  MAX_IMAGES_PER_PRODUCT: 10,
  
  // Cache Configuration
  CACHE_EXPIRY: 30 * 60 * 1000, // 30 minutes
  OFFLINE_STORAGE_LIMIT: 100 * 1024 * 1024, // 100MB
  
  // Location Configuration
  LOCATION_TIMEOUT: 15000,
  LOCATION_MAX_AGE: 60000,
  
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // Supported Languages
  SUPPORTED_LANGUAGES: ['en', 'fr', 'sw', 'ar'],
  DEFAULT_LANGUAGE: 'en',
  
  // Currency Configuration
  SUPPORTED_CURRENCIES: ['USD', 'XOF', 'KES', 'TZS', 'UGX'],
  DEFAULT_CURRENCY: 'USD',
  
  // Social/External Services
  GOOGLE_MAPS_API_KEY: '', // To be filled with actual key
  MAPBOX_API_KEY: '', // To be filled with actual key
  
  // Push Notifications
  FCM_SENDER_ID: '', // To be filled with actual sender ID
  
  // Error Tracking
  SENTRY_DSN: '', // To be filled with actual DSN
  
  // Analytics
  GOOGLE_ANALYTICS_ID: '', // To be filled with actual ID
  
  // Development URLs
  DEV_API_URL: 'http://10.0.2.2:3000/api', // Android emulator localhost
  DEV_WS_URL: 'ws://10.0.2.2:3000',
};

// Override with react-native-config values if available
const RNConfig = NativeModules.ReactNativeConfig || {};

// Merge configs
const AppConfig = {
  ...Config,
  ...Object.keys(RNConfig).reduce((acc, key) => {
    // Convert string values to appropriate types
    let value = RNConfig[key];
    if (value === 'true') value = true;
    if (value === 'false') value = false;
    if (!isNaN(value) && value !== '') value = Number(value);
    
    acc[key] = value;
    return acc;
  }, {} as any),
};

export default AppConfig;