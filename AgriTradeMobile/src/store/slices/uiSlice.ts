import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Theme, Language } from '@/types';

interface UIState {
  theme: Theme;
  language: Language;
  isLoading: boolean;
  loadingMessage: string;
  isNetworkConnected: boolean;
  isOfflineMode: boolean;
  modals: {
    [key: string]: {
      isVisible: boolean;
      data?: any;
    };
  };
  notifications: {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
    timestamp: number;
  }[];
  tabBarVisible: boolean;
  headerVisible: boolean;
  deviceInfo: {
    isTablet: boolean;
    screenWidth: number;
    screenHeight: number;
    hasNotch: boolean;
  };
}

const initialState: UIState = {
  theme: 'light',
  language: 'en',
  isLoading: false,
  loadingMessage: '',
  isNetworkConnected: true,
  isOfflineMode: false,
  modals: {},
  notifications: [],
  tabBarVisible: true,
  headerVisible: true,
  deviceInfo: {
    isTablet: false,
    screenWidth: 0,
    screenHeight: 0,
    hasNotch: false,
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Theme and language
    setTheme: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload;
    },
    setLanguage: (state, action: PayloadAction<Language>) => {
      state.language = action.payload;
    },
    
    // Loading states
    setGlobalLoading: (state, action: PayloadAction<{ isLoading: boolean; message?: string }>) => {
      state.isLoading = action.payload.isLoading;
      state.loadingMessage = action.payload.message || '';
    },
    
    // Network and offline
    setNetworkStatus: (state, action: PayloadAction<boolean>) => {
      state.isNetworkConnected = action.payload;
    },
    setOfflineMode: (state, action: PayloadAction<boolean>) => {
      state.isOfflineMode = action.payload;
    },
    
    // Modals
    showModal: (state, action: PayloadAction<{ name: string; data?: any }>) => {
      state.modals[action.payload.name] = {
        isVisible: true,
        data: action.payload.data,
      };
    },
    hideModal: (state, action: PayloadAction<string>) => {
      if (state.modals[action.payload]) {
        state.modals[action.payload].isVisible = false;
      }
    },
    clearModals: (state) => {
      state.modals = {};
    },
    
    // Notifications
    addNotification: (state, action: PayloadAction<{
      type: 'success' | 'error' | 'warning' | 'info';
      title: string;
      message: string;
      duration?: number;
    }>) => {
      const notification = {
        id: Date.now().toString(),
        ...action.payload,
        timestamp: Date.now(),
      };
      state.notifications.push(notification);
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    
    // Navigation UI
    setTabBarVisible: (state, action: PayloadAction<boolean>) => {
      state.tabBarVisible = action.payload;
    },
    setHeaderVisible: (state, action: PayloadAction<boolean>) => {
      state.headerVisible = action.payload;
    },
    
    // Device info
    setDeviceInfo: (state, action: PayloadAction<Partial<UIState['deviceInfo']>>) => {
      state.deviceInfo = { ...state.deviceInfo, ...action.payload };
    },
  },
});

export const {
  setTheme,
  setLanguage,
  setGlobalLoading,
  setNetworkStatus,
  setOfflineMode,
  showModal,
  hideModal,
  clearModals,
  addNotification,
  removeNotification,
  clearNotifications,
  setTabBarVisible,
  setHeaderVisible,
  setDeviceInfo,
} = uiSlice.actions;

export default uiSlice.reducer;