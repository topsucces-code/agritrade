import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { store } from '@/store';
import { logout, refreshToken } from '@/store/slices/authSlice';
import { setNetworkStatus, addNotification } from '@/store/slices/uiSlice';
import { addToSyncQueue } from '@/store/slices/offlineSlice';
import Config from 'react-native-config';

// API Configuration
const API_BASE_URL = Config.API_BASE_URL || 'http://localhost:3000/api';
const API_TIMEOUT = 15000;

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const state = store.getState();
    const { token } = state.auth;
    
    // Add authorization header if token exists
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add request timestamp for debugging
    config.metadata = { startTime: new Date() };
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Calculate request duration
    const endTime = new Date();
    const startTime = response.config.metadata?.startTime;
    if (startTime) {
      const duration = endTime.getTime() - startTime.getTime();
      console.log(`API Request to ${response.config.url} took ${duration}ms`);
    }
    
    // Update network status to online
    store.dispatch(setNetworkStatus(true));
    
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    
    // Handle different error types
    if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED') {
      // Network error - update offline status
      store.dispatch(setNetworkStatus(false));
      
      // Add request to sync queue if it's a POST, PUT, or DELETE
      if (originalRequest && ['post', 'put', 'delete'].includes(originalRequest.method?.toLowerCase())) {
        store.dispatch(addToSyncQueue({
          type: 'api_request',
          endpoint: originalRequest.url,
          method: originalRequest.method.toUpperCase(),
          data: originalRequest.data,
          maxRetries: 3,
        }));
      }
      
      // Show offline notification
      store.dispatch(addNotification({
        type: 'warning',
        title: 'Network Error',
        message: 'You appear to be offline. Changes will be synced when connection is restored.',
        duration: 5000,
      }));
      
      return Promise.reject(error);
    }
    
    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh token
        await store.dispatch(refreshToken()).unwrap();
        
        // Retry original request with new token
        const state = store.getState();
        if (state.auth.token) {
          originalRequest.headers.Authorization = `Bearer ${state.auth.token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        store.dispatch(logout());
        store.dispatch(addNotification({
          type: 'error',
          title: 'Session Expired',
          message: 'Please log in again to continue.',
          duration: 5000,
        }));
      }
    }
    
    // Handle other HTTP errors
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 403:
          store.dispatch(addNotification({
            type: 'error',
            title: 'Access Denied',
            message: 'You don\'t have permission to perform this action.',
            duration: 5000,
          }));
          break;
        case 404:
          store.dispatch(addNotification({
            type: 'error',
            title: 'Not Found',
            message: 'The requested resource was not found.',
            duration: 3000,
          }));
          break;
        case 429:
          store.dispatch(addNotification({
            type: 'warning',
            title: 'Rate Limited',
            message: 'Too many requests. Please wait a moment and try again.',
            duration: 5000,
          }));
          break;
        case 500:
          store.dispatch(addNotification({
            type: 'error',
            title: 'Server Error',
            message: 'Internal server error. Please try again later.',
            duration: 5000,
          }));
          break;
        default:
          if (data?.message) {
            store.dispatch(addNotification({
              type: 'error',
              title: 'Error',
              message: data.message,
              duration: 5000,
            }));
          }
      }
    }
    
    return Promise.reject(error);
  }
);

// Helper function to create form data
export const createFormData = (data: any): FormData => {
  const formData = new FormData();
  
  Object.keys(data).forEach(key => {
    const value = data[key];
    
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object' && item.uri) {
            // Handle file uploads
            formData.append(key, {
              uri: item.uri,
              type: item.type || 'image/jpeg',
              name: item.name || `file_${index}.jpg`,
            } as any);
          } else {
            formData.append(`${key}[${index}]`, item);
          }
        });
      } else if (typeof value === 'object' && value.uri) {
        // Handle single file upload
        formData.append(key, {
          uri: value.uri,
          type: value.type || 'image/jpeg',
          name: value.name || 'file.jpg',
        } as any);
      } else if (typeof value === 'object') {
        // Handle nested objects
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, value.toString());
      }
    }
  });
  
  return formData;
};

// Helper function for handling API responses
export const handleApiResponse = <T>(response: AxiosResponse<T>): T => {
  return response.data;
};

// Helper function for handling API errors
export const handleApiError = (error: AxiosError): never => {
  if (error.response?.data) {
    throw new Error((error.response.data as any).message || 'An error occurred');
  }
  throw new Error(error.message || 'Network error');
};

export default apiClient;