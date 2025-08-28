import apiClient, { handleApiResponse, handleApiError } from './apiClient';
import { Order, PaginatedResponse, ApiResponse } from '@/types';

class OrderService {
  /**
   * Get orders with pagination and status filter
   */
  async getOrders(params: {
    page?: number;
    limit?: number;
    status?: string;
  } = {}): Promise<ApiResponse<PaginatedResponse<Order>>> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.status) queryParams.append('status', params.status);

      const response = await apiClient.get(`/orders?${queryParams.toString()}`);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<ApiResponse<Order>> {
    try {
      const response = await apiClient.get(`/orders/${orderId}`);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Create new order
   */
  async createOrder(orderData: {
    productId: string;
    quantity: number;
    deliveryAddress: string;
  }): Promise<ApiResponse<Order>> {
    try {
      const response = await apiClient.post('/orders', orderData);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: string): Promise<ApiResponse<Order>> {
    try {
      const response = await apiClient.patch(`/orders/${orderId}/status`, { status });
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string): Promise<ApiResponse<Order>> {
    try {
      const response = await apiClient.post(`/orders/${orderId}/cancel`);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Get active orders
   */
  async getActiveOrders(): Promise<ApiResponse<Order[]>> {
    try {
      const response = await apiClient.get('/orders/active');
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Get order history
   */
  async getOrderHistory(params: {
    page?: number;
    limit?: number;
  } = {}): Promise<ApiResponse<PaginatedResponse<Order>>> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());

      const response = await apiClient.get(`/orders/history?${queryParams.toString()}`);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }
}

export const orderService = new OrderService();
export default orderService;