import apiClient, { handleApiResponse, handleApiError, createFormData } from './apiClient';
import { Product, ProductFilters, PaginatedResponse, ApiResponse } from '@/types';

class ProductService {
  /**
   * Get products with filters and pagination
   */
  async getProducts(params: {
    filters?: ProductFilters;
    page?: number;
    limit?: number;
  } = {}): Promise<ApiResponse<PaginatedResponse<Product>>> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      
      if (params.filters) {
        if (params.filters.category) queryParams.append('category', params.filters.category);
        if (params.filters.priceRange) {
          queryParams.append('minPrice', params.filters.priceRange.min.toString());
          queryParams.append('maxPrice', params.filters.priceRange.max.toString());
        }
        if (params.filters.qualityScore) {
          queryParams.append('minQuality', params.filters.qualityScore.min.toString());
          queryParams.append('maxQuality', params.filters.qualityScore.max.toString());
        }
        if (params.filters.location) {
          queryParams.append('latitude', params.filters.location.latitude.toString());
          queryParams.append('longitude', params.filters.location.longitude.toString());
          queryParams.append('radius', params.filters.location.radius.toString());
        }
        if (params.filters.sortBy) queryParams.append('sortBy', params.filters.sortBy);
        if (params.filters.sortOrder) queryParams.append('sortOrder', params.filters.sortOrder);
      }

      const response = await apiClient.get(`/products?${queryParams.toString()}`);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Search products by query
   */
  async searchProducts(
    query: string, 
    filters?: ProductFilters
  ): Promise<ApiResponse<PaginatedResponse<Product>>> {
    try {
      const response = await apiClient.post('/products/search', { query, filters });
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Get product by ID
   */
  async getProductById(productId: string): Promise<ApiResponse<Product>> {
    try {
      const response = await apiClient.get(`/products/${productId}`);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Create new product
   */
  async createProduct(productData: any): Promise<ApiResponse<Product>> {
    try {
      let data;
      let headers = {};

      // Check if we have file uploads
      if (productData instanceof FormData) {
        data = productData;
        headers = { 'Content-Type': 'multipart/form-data' };
      } else if (productData.images && Array.isArray(productData.images)) {
        // Create form data for file uploads
        data = createFormData(productData);
        headers = { 'Content-Type': 'multipart/form-data' };
      } else {
        data = productData;
      }

      const response = await apiClient.post('/products', data, { headers });
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string, 
    productData: any
  ): Promise<ApiResponse<Product>> {
    try {
      let data;
      let headers = {};

      // Check if we have file uploads
      if (productData instanceof FormData) {
        data = productData;
        headers = { 'Content-Type': 'multipart/form-data' };
      } else if (productData.images && Array.isArray(productData.images)) {
        // Create form data for file uploads
        data = createFormData(productData);
        headers = { 'Content-Type': 'multipart/form-data' };
      } else {
        data = productData;
      }

      const response = await apiClient.put(`/products/${productId}`, data, { headers });
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Delete product
   */
  async deleteProduct(productId: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await apiClient.delete(`/products/${productId}`);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Get product categories
   */
  async getCategories(): Promise<ApiResponse<string[]>> {
    try {
      const response = await apiClient.get('/products/categories');
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Get farmer's products
   */
  async getFarmerProducts(
    farmerId?: string,
    page?: number,
    limit?: number
  ): Promise<ApiResponse<PaginatedResponse<Product>>> {
    try {
      const queryParams = new URLSearchParams();
      if (page) queryParams.append('page', page.toString());
      if (limit) queryParams.append('limit', limit.toString());
      
      const endpoint = farmerId 
        ? `/products/farmer/${farmerId}?${queryParams.toString()}`
        : `/products/my-products?${queryParams.toString()}`;
        
      const response = await apiClient.get(endpoint);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Get similar products
   */
  async getSimilarProducts(productId: string): Promise<ApiResponse<Product[]>> {
    try {
      const response = await apiClient.get(`/products/${productId}/similar`);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Toggle product favorite status
   */
  async toggleFavorite(productId: string): Promise<ApiResponse<{ isFavorite: boolean }>> {
    try {
      const response = await apiClient.post(`/products/${productId}/favorite`);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Get user's favorite products
   */
  async getFavoriteProducts(): Promise<ApiResponse<Product[]>> {
    try {
      const response = await apiClient.get('/products/favorites');
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Report a product
   */
  async reportProduct(
    productId: string, 
    reason: string, 
    description?: string
  ): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await apiClient.post(`/products/${productId}/report`, {
        reason,
        description,
      });
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Get product analytics (for farmers)
   */
  async getProductAnalytics(productId: string): Promise<ApiResponse<{
    views: number;
    inquiries: number;
    favorites: number;
    orders: number;
    revenue: number;
  }>> {
    try {
      const response = await apiClient.get(`/products/${productId}/analytics`);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Update product status
   */
  async updateProductStatus(
    productId: string, 
    status: 'available' | 'sold' | 'reserved' | 'expired'
  ): Promise<ApiResponse<Product>> {
    try {
      const response = await apiClient.patch(`/products/${productId}/status`, { status });
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }
}

export const productService = new ProductService();
export default productService;