import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface OfflineAction {
  id: string;
  type: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

interface OfflineState {
  isOnline: boolean;
  syncQueue: OfflineAction[];
  syncInProgress: boolean;
  lastSyncTime: number | null;
  cachedData: {
    [key: string]: {
      data: any;
      timestamp: number;
      expiry: number;
    };
  };
  failedActions: OfflineAction[];
}

const initialState: OfflineState = {
  isOnline: true,
  syncQueue: [],
  syncInProgress: false,
  lastSyncTime: null,
  cachedData: {},
  failedActions: [],
};

const offlineSlice = createSlice({
  name: 'offline',
  initialState,
  reducers: {
    // Online/offline status
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    
    // Sync queue management
    addToSyncQueue: (state, action: PayloadAction<Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>>) => {
      const action_item: OfflineAction = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        retryCount: 0,
        ...action.payload,
      };
      state.syncQueue.push(action_item);
    },
    
    removeFromSyncQueue: (state, action: PayloadAction<string>) => {
      state.syncQueue = state.syncQueue.filter(item => item.id !== action.payload);
    },
    
    incrementRetryCount: (state, action: PayloadAction<string>) => {
      const item = state.syncQueue.find(item => item.id === action.payload);
      if (item) {
        item.retryCount += 1;
      }
    },
    
    clearSyncQueue: (state) => {
      state.syncQueue = [];
    },
    
    // Sync status
    setSyncInProgress: (state, action: PayloadAction<boolean>) => {
      state.syncInProgress = action.payload;
    },
    
    setLastSyncTime: (state, action: PayloadAction<number>) => {
      state.lastSyncTime = action.payload;
    },
    
    // Cache management
    setCachedData: (state, action: PayloadAction<{
      key: string;
      data: any;
      expiry?: number;
    }>) => {
      const expiry = action.payload.expiry || (Date.now() + 30 * 60 * 1000); // Default 30 minutes
      state.cachedData[action.payload.key] = {
        data: action.payload.data,
        timestamp: Date.now(),
        expiry,
      };
    },
    
    removeCachedData: (state, action: PayloadAction<string>) => {
      delete state.cachedData[action.payload];
    },
    
    clearExpiredCache: (state) => {
      const now = Date.now();
      Object.keys(state.cachedData).forEach(key => {
        if (state.cachedData[key].expiry < now) {
          delete state.cachedData[key];
        }
      });
    },
    
    clearAllCache: (state) => {
      state.cachedData = {};
    },
    
    // Failed actions
    moveToFailedActions: (state, action: PayloadAction<string>) => {
      const actionIndex = state.syncQueue.findIndex(item => item.id === action.payload);
      if (actionIndex !== -1) {
        const failedAction = state.syncQueue[actionIndex];
        state.failedActions.push(failedAction);
        state.syncQueue.splice(actionIndex, 1);
      }
    },
    
    retryFailedAction: (state, action: PayloadAction<string>) => {
      const actionIndex = state.failedActions.findIndex(item => item.id === action.payload);
      if (actionIndex !== -1) {
        const retryAction = { ...state.failedActions[actionIndex], retryCount: 0 };
        state.syncQueue.push(retryAction);
        state.failedActions.splice(actionIndex, 1);
      }
    },
    
    clearFailedActions: (state) => {
      state.failedActions = [];
    },
    
    // Bulk operations
    bulkAddToSyncQueue: (state, action: PayloadAction<Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>[]>) => {
      const newActions = action.payload.map(item => ({
        id: `${Date.now()}_${Math.random()}`,
        timestamp: Date.now(),
        retryCount: 0,
        ...item,
      }));
      state.syncQueue.push(...newActions);
    },
    
    bulkRemoveFromSyncQueue: (state, action: PayloadAction<string[]>) => {
      state.syncQueue = state.syncQueue.filter(item => !action.payload.includes(item.id));
    },
  },
});

export const {
  setOnlineStatus,
  addToSyncQueue,
  removeFromSyncQueue,
  incrementRetryCount,
  clearSyncQueue,
  setSyncInProgress,
  setLastSyncTime,
  setCachedData,
  removeCachedData,
  clearExpiredCache,
  clearAllCache,
  moveToFailedActions,
  retryFailedAction,
  clearFailedActions,
  bulkAddToSyncQueue,
  bulkRemoveFromSyncQueue,
} = offlineSlice.actions;

export default offlineSlice.reducer;