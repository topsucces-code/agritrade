import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Order, PaginatedResponse } from '@/types';
import { orderService } from '@/services/orderService';

interface OrdersState {
  items: Order[];
  activeOrders: Order[];
  orderHistory: Order[];
  currentOrder: Order | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  isLoading: boolean;
  error: string | null;
}

const initialState: OrdersState = {
  items: [],
  activeOrders: [],
  orderHistory: [],
  currentOrder: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
  },
  isLoading: false,
  error: null,
};

// Async thunks
export const fetchOrders = createAsyncThunk(
  'orders/fetchOrders',
  async (params: { page?: number; limit?: number; status?: string }, { rejectWithValue }) => {
    try {
      const response = await orderService.getOrders(params);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch orders');
    }
  }
);

export const fetchOrderDetails = createAsyncThunk(
  'orders/fetchOrderDetails',
  async (orderId: string, { rejectWithValue }) => {
    try {
      const response = await orderService.getOrderById(orderId);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch order details');
    }
  }
);

export const createOrder = createAsyncThunk(
  'orders/createOrder',
  async (orderData: {
    productId: string;
    quantity: number;
    deliveryAddress: string;
  }, { rejectWithValue }) => {
    try {
      const response = await orderService.createOrder(orderData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create order');
    }
  }
);

export const updateOrderStatus = createAsyncThunk(
  'orders/updateStatus',
  async ({ orderId, status }: { orderId: string; status: string }, { rejectWithValue }) => {
    try {
      const response = await orderService.updateOrderStatus(orderId, status);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update order status');
    }
  }
);

export const cancelOrder = createAsyncThunk(
  'orders/cancelOrder',
  async (orderId: string, { rejectWithValue }) => {
    try {
      const response = await orderService.cancelOrder(orderId);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to cancel order');
    }
  }
);

export const fetchActiveOrders = createAsyncThunk(
  'orders/fetchActiveOrders',
  async (_, { rejectWithValue }) => {
    try {
      const response = await orderService.getActiveOrders();
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch active orders');
    }
  }
);

export const fetchOrderHistory = createAsyncThunk(
  'orders/fetchOrderHistory',
  async (params: { page?: number; limit?: number }, { rejectWithValue }) => {
    try {
      const response = await orderService.getOrderHistory(params);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch order history');
    }
  }
);

// Orders slice
const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCurrentOrder: (state, action: PayloadAction<Order | null>) => {
      state.currentOrder = action.payload;
    },
    updateOrderInList: (state, action: PayloadAction<Order>) => {
      const index = state.items.findIndex(order => order._id === action.payload._id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
      
      const activeIndex = state.activeOrders.findIndex(order => order._id === action.payload._id);
      if (activeIndex !== -1) {
        state.activeOrders[activeIndex] = action.payload;
      }
    },
    removeOrderFromList: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(order => order._id !== action.payload);
      state.activeOrders = state.activeOrders.filter(order => order._id !== action.payload);
    },
    clearOrders: (state) => {
      state.items = [];
      state.activeOrders = [];
      state.orderHistory = [];
      state.pagination = { page: 1, limit: 20, total: 0 };
    },
  },
  extraReducers: (builder) => {
    // Fetch orders
    builder
      .addCase(fetchOrders.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchOrders.fulfilled, (state, action: PayloadAction<PaginatedResponse<Order>>) => {
        state.isLoading = false;
        if (action.payload.pagination.page === 1) {
          state.items = action.payload.items;
        } else {
          state.items = [...state.items, ...action.payload.items];
        }
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch order details
    builder
      .addCase(fetchOrderDetails.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchOrderDetails.fulfilled, (state, action: PayloadAction<Order>) => {
        state.isLoading = false;
        state.currentOrder = action.payload;
        
        // Update in list if exists
        const index = state.items.findIndex(order => order._id === action.payload._id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(fetchOrderDetails.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Create order
    builder
      .addCase(createOrder.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createOrder.fulfilled, (state, action: PayloadAction<Order>) => {
        state.isLoading = false;
        state.items.unshift(action.payload);
        state.activeOrders.unshift(action.payload);
        state.currentOrder = action.payload;
      })
      .addCase(createOrder.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Update order status
    builder
      .addCase(updateOrderStatus.fulfilled, (state, action: PayloadAction<Order>) => {
        const index = state.items.findIndex(order => order._id === action.payload._id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        
        const activeIndex = state.activeOrders.findIndex(order => order._id === action.payload._id);
        if (activeIndex !== -1) {
          if (['delivered', 'cancelled'].includes(action.payload.status)) {
            state.activeOrders.splice(activeIndex, 1);
          } else {
            state.activeOrders[activeIndex] = action.payload;
          }
        }
        
        if (state.currentOrder?._id === action.payload._id) {
          state.currentOrder = action.payload;
        }
      });

    // Cancel order
    builder
      .addCase(cancelOrder.fulfilled, (state, action: PayloadAction<Order>) => {
        const index = state.items.findIndex(order => order._id === action.payload._id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        
        state.activeOrders = state.activeOrders.filter(order => order._id !== action.payload._id);
        
        if (state.currentOrder?._id === action.payload._id) {
          state.currentOrder = action.payload;
        }
      });

    // Fetch active orders
    builder
      .addCase(fetchActiveOrders.fulfilled, (state, action: PayloadAction<Order[]>) => {
        state.activeOrders = action.payload;
      });

    // Fetch order history
    builder
      .addCase(fetchOrderHistory.fulfilled, (state, action: PayloadAction<PaginatedResponse<Order>>) => {
        if (action.payload.pagination.page === 1) {
          state.orderHistory = action.payload.items;
        } else {
          state.orderHistory = [...state.orderHistory, ...action.payload.items];
        }
      });
  },
});

export const {
  clearError,
  setCurrentOrder,
  updateOrderInList,
  removeOrderFromList,
  clearOrders,
} = ordersSlice.actions;

export default ordersSlice.reducer;