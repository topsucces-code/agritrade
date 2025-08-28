import productService from '../productService';
import apiClient, { handleApiResponse, handleApiError, createFormData } from '../apiClient';
import { Product, ProductFilters, PaginatedResponse } from '@/types';

// Mock the apiClient and its functions
jest.mock('../apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  handleApiResponse: jest.fn(),
  handleApiError: jest.fn(),
  createFormData: jest.fn(),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockHandleApiResponse = handleApiResponse as jest.MockedFunction<typeof handleApiResponse>;
const mockHandleApiError = handleApiError as jest.MockedFunction<typeof handleApiError>;
const mockCreateFormData = createFormData as jest.MockedFunction<typeof createFormData>;

describe('ProductService', () => {
  const mockProduct: Product = {
    id: '1',
    name: 'Fresh Tomatoes',
    description: 'Organic tomatoes from local farm',
    category: 'vegetables',
    price: 25.50,
    unit: 'kg',
    quantity: 100,
    images: ['https://example.com/tomato1.jpg', 'https://example.com/tomato2.jpg'],
    qualityScore: 8.5,
    farmerId: 'farmer1',
    farmerName: 'John Farmer',
    farmerAvatar: 'https://example.com/farmer.jpg',
    location: {
      latitude: 40.7128,
      longitude: -74.0060,
      address: 'New York, NY',
    },
    status: 'available',
    harvestDate: '2023-12-01',
    expiryDate: '2023-12-15',
    tags: ['organic', 'fresh', 'local'],
    isFavorite: false,
    createdAt: '2023-12-01T00:00:00Z',
    updatedAt: '2023-12-01T00:00:00Z',
  };

  const mockPaginatedResponse: PaginatedResponse<Product> = {
    data: [mockProduct],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      pages: 1,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProducts', () => {
    it('should get products without filters', async () => {
      const mockResponse = { data: mockPaginatedResponse };
      const mockApiResponse = { success: true, data: mockPaginatedResponse };
      
      mockApiClient.get.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await productService.getProducts();

      expect(mockApiClient.get).toHaveBeenCalledWith('/products?');
      expect(mockHandleApiResponse).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockApiResponse);
    });

    it('should get products with pagination', async () => {
      const mockResponse = { data: mockPaginatedResponse };
      const mockApiResponse = { success: true, data: mockPaginatedResponse };
      
      mockApiClient.get.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await productService.getProducts({ page: 2, limit: 20 });

      expect(mockApiClient.get).toHaveBeenCalledWith('/products?page=2&limit=20');
      expect(result).toEqual(mockApiResponse);
    });

    it('should get products with category filter', async () => {
      const filters: ProductFilters = {
        category: 'vegetables',
      };

      mockApiClient.get.mockResolvedValue({ data: mockPaginatedResponse });
      mockHandleApiResponse.mockReturnValue({ success: true, data: mockPaginatedResponse });

      await productService.getProducts({ filters });

      expect(mockApiClient.get).toHaveBeenCalledWith('/products?category=vegetables');
    });

    it('should get products with price range filter', async () => {
      const filters: ProductFilters = {
        priceRange: { min: 10, max: 50 },
      };

      mockApiClient.get.mockResolvedValue({ data: mockPaginatedResponse });
      mockHandleApiResponse.mockReturnValue({ success: true, data: mockPaginatedResponse });

      await productService.getProducts({ filters });

      expect(mockApiClient.get).toHaveBeenCalledWith('/products?minPrice=10&maxPrice=50');
    });

    it('should get products with quality score filter', async () => {
      const filters: ProductFilters = {
        qualityScore: { min: 7.0, max: 10.0 },
      };

      mockApiClient.get.mockResolvedValue({ data: mockPaginatedResponse });
      mockHandleApiResponse.mockReturnValue({ success: true, data: mockPaginatedResponse });

      await productService.getProducts({ filters });

      expect(mockApiClient.get).toHaveBeenCalledWith('/products?minQuality=7&maxQuality=10');
    });

    it('should get products with location filter', async () => {
      const filters: ProductFilters = {
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          radius: 10,
        },
      };

      mockApiClient.get.mockResolvedValue({ data: mockPaginatedResponse });
      mockHandleApiResponse.mockReturnValue({ success: true, data: mockPaginatedResponse });

      await productService.getProducts({ filters });

      expect(mockApiClient.get).toHaveBeenCalledWith('/products?latitude=40.7128&longitude=-74.006&radius=10');
    });

    it('should get products with sorting', async () => {
      const filters: ProductFilters = {
        sortBy: 'price',
        sortOrder: 'desc',
      };

      mockApiClient.get.mockResolvedValue({ data: mockPaginatedResponse });
      mockHandleApiResponse.mockReturnValue({ success: true, data: mockPaginatedResponse });

      await productService.getProducts({ filters });

      expect(mockApiClient.get).toHaveBeenCalledWith('/products?sortBy=price&sortOrder=desc');
    });

    it('should get products with all filters combined', async () => {
      const filters: ProductFilters = {
        category: 'vegetables',
        priceRange: { min: 10, max: 50 },
        qualityScore: { min: 7.0, max: 10.0 },
        location: { latitude: 40.7128, longitude: -74.0060, radius: 10 },
        sortBy: 'price',
        sortOrder: 'asc',
      };

      mockApiClient.get.mockResolvedValue({ data: mockPaginatedResponse });
      mockHandleApiResponse.mockReturnValue({ success: true, data: mockPaginatedResponse });

      await productService.getProducts({ filters, page: 1, limit: 10 });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/products?page=1&limit=10&category=vegetables&minPrice=10&maxPrice=50&minQuality=7&maxQuality=10&latitude=40.7128&longitude=-74.006&radius=10&sortBy=price&sortOrder=asc'
      );
    });

    it('should handle get products error', async () => {
      const mockError = new Error('Network error');
      mockApiClient.get.mockRejectedValue(mockError);

      await productService.getProducts();

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('searchProducts', () => {
    it('should search products by query', async () => {
      const mockResponse = { data: mockPaginatedResponse };
      const mockApiResponse = { success: true, data: mockPaginatedResponse };
      
      mockApiClient.post.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await productService.searchProducts('tomatoes');

      expect(mockApiClient.post).toHaveBeenCalledWith('/products/search', {
        query: 'tomatoes',
        filters: undefined,
      });
      expect(result).toEqual(mockApiResponse);
    });

    it('should search products with filters', async () => {
      const filters: ProductFilters = { category: 'vegetables' };
      
      mockApiClient.post.mockResolvedValue({ data: mockPaginatedResponse });
      mockHandleApiResponse.mockReturnValue({ success: true, data: mockPaginatedResponse });

      await productService.searchProducts('tomatoes', filters);

      expect(mockApiClient.post).toHaveBeenCalledWith('/products/search', {
        query: 'tomatoes',
        filters,
      });
    });

    it('should handle search error', async () => {
      const mockError = new Error('Search failed');
      mockApiClient.post.mockRejectedValue(mockError);

      await productService.searchProducts('tomatoes');

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('getProductById', () => {
    it('should get product by ID', async () => {
      const mockResponse = { data: mockProduct };
      const mockApiResponse = { success: true, data: mockProduct };
      
      mockApiClient.get.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await productService.getProductById('1');

      expect(mockApiClient.get).toHaveBeenCalledWith('/products/1');
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle get product by ID error', async () => {
      const mockError = new Error('Product not found');
      mockApiClient.get.mockRejectedValue(mockError);

      await productService.getProductById('1');

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('createProduct', () => {
    it('should create product with regular data', async () => {
      const productData = {
        name: 'Fresh Tomatoes',
        description: 'Organic tomatoes',
        category: 'vegetables',
        price: 25.50,
      };

      const mockResponse = { data: mockProduct };
      const mockApiResponse = { success: true, data: mockProduct };
      
      mockApiClient.post.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await productService.createProduct(productData);

      expect(mockApiClient.post).toHaveBeenCalledWith('/products', productData, { headers: {} });
      expect(result).toEqual(mockApiResponse);
    });

    it('should create product with FormData', async () => {
      const formData = new FormData();
      formData.append('name', 'Fresh Tomatoes');

      mockApiClient.post.mockResolvedValue({ data: mockProduct });
      mockHandleApiResponse.mockReturnValue({ success: true, data: mockProduct });

      await productService.createProduct(formData);

      expect(mockApiClient.post).toHaveBeenCalledWith('/products', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    });

    it('should create product with images array', async () => {
      const productData = {
        name: 'Fresh Tomatoes',
        images: [{ uri: 'file://image1.jpg' }, { uri: 'file://image2.jpg' }],
      };

      const mockFormData = new FormData();
      mockCreateFormData.mockReturnValue(mockFormData);

      mockApiClient.post.mockResolvedValue({ data: mockProduct });
      mockHandleApiResponse.mockReturnValue({ success: true, data: mockProduct });

      await productService.createProduct(productData);

      expect(mockCreateFormData).toHaveBeenCalledWith(productData);
      expect(mockApiClient.post).toHaveBeenCalledWith('/products', mockFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    });

    it('should handle create product error', async () => {
      const mockError = new Error('Creation failed');
      mockApiClient.post.mockRejectedValue(mockError);

      await productService.createProduct({});

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('updateProduct', () => {
    it('should update product with regular data', async () => {
      const productData = { name: 'Updated Tomatoes' };

      mockApiClient.put.mockResolvedValue({ data: mockProduct });
      mockHandleApiResponse.mockReturnValue({ success: true, data: mockProduct });

      const result = await productService.updateProduct('1', productData);

      expect(mockApiClient.put).toHaveBeenCalledWith('/products/1', productData, { headers: {} });
      expect(result).toEqual({ success: true, data: mockProduct });
    });

    it('should update product with FormData', async () => {
      const formData = new FormData();

      mockApiClient.put.mockResolvedValue({ data: mockProduct });
      mockHandleApiResponse.mockReturnValue({ success: true, data: mockProduct });

      await productService.updateProduct('1', formData);

      expect(mockApiClient.put).toHaveBeenCalledWith('/products/1', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    });

    it('should handle update product error', async () => {
      const mockError = new Error('Update failed');
      mockApiClient.put.mockRejectedValue(mockError);

      await productService.updateProduct('1', {});

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('deleteProduct', () => {
    it('should delete product successfully', async () => {
      const mockResponse = { data: { success: true } };
      const mockApiResponse = { success: true, data: { success: true } };
      
      mockApiClient.delete.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await productService.deleteProduct('1');

      expect(mockApiClient.delete).toHaveBeenCalledWith('/products/1');
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle delete product error', async () => {
      const mockError = new Error('Delete failed');
      mockApiClient.delete.mockRejectedValue(mockError);

      await productService.deleteProduct('1');

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('getCategories', () => {
    it('should get product categories', async () => {
      const categories = ['vegetables', 'fruits', 'grains'];
      const mockResponse = { data: categories };
      const mockApiResponse = { success: true, data: categories };
      
      mockApiClient.get.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await productService.getCategories();

      expect(mockApiClient.get).toHaveBeenCalledWith('/products/categories');
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle get categories error', async () => {
      const mockError = new Error('Categories fetch failed');
      mockApiClient.get.mockRejectedValue(mockError);

      await productService.getCategories();

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('getFarmerProducts', () => {
    it('should get current farmer products', async () => {
      mockApiClient.get.mockResolvedValue({ data: mockPaginatedResponse });
      mockHandleApiResponse.mockReturnValue({ success: true, data: mockPaginatedResponse });

      await productService.getFarmerProducts();

      expect(mockApiClient.get).toHaveBeenCalledWith('/products/my-products?');
    });

    it('should get specific farmer products', async () => {
      mockApiClient.get.mockResolvedValue({ data: mockPaginatedResponse });
      mockHandleApiResponse.mockReturnValue({ success: true, data: mockPaginatedResponse });

      await productService.getFarmerProducts('farmer123');

      expect(mockApiClient.get).toHaveBeenCalledWith('/products/farmer/farmer123?');
    });

    it('should get farmer products with pagination', async () => {
      mockApiClient.get.mockResolvedValue({ data: mockPaginatedResponse });
      mockHandleApiResponse.mockReturnValue({ success: true, data: mockPaginatedResponse });

      await productService.getFarmerProducts('farmer123', 2, 20);

      expect(mockApiClient.get).toHaveBeenCalledWith('/products/farmer/farmer123?page=2&limit=20');
    });

    it('should handle get farmer products error', async () => {
      const mockError = new Error('Farmer products fetch failed');
      mockApiClient.get.mockRejectedValue(mockError);

      await productService.getFarmerProducts();

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('getSimilarProducts', () => {
    it('should get similar products', async () => {
      const similarProducts = [mockProduct];
      const mockResponse = { data: similarProducts };
      const mockApiResponse = { success: true, data: similarProducts };
      
      mockApiClient.get.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await productService.getSimilarProducts('1');

      expect(mockApiClient.get).toHaveBeenCalledWith('/products/1/similar');
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle get similar products error', async () => {
      const mockError = new Error('Similar products fetch failed');
      mockApiClient.get.mockRejectedValue(mockError);

      await productService.getSimilarProducts('1');

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('toggleFavorite', () => {
    it('should toggle favorite status', async () => {
      const mockResponse = { data: { isFavorite: true } };
      const mockApiResponse = { success: true, data: { isFavorite: true } };
      
      mockApiClient.post.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await productService.toggleFavorite('1');

      expect(mockApiClient.post).toHaveBeenCalledWith('/products/1/favorite');
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle toggle favorite error', async () => {
      const mockError = new Error('Toggle favorite failed');
      mockApiClient.post.mockRejectedValue(mockError);

      await productService.toggleFavorite('1');

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('getFavoriteProducts', () => {
    it('should get favorite products', async () => {
      const favoriteProducts = [mockProduct];
      const mockResponse = { data: favoriteProducts };
      const mockApiResponse = { success: true, data: favoriteProducts };
      
      mockApiClient.get.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await productService.getFavoriteProducts();

      expect(mockApiClient.get).toHaveBeenCalledWith('/products/favorites');
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle get favorite products error', async () => {
      const mockError = new Error('Favorites fetch failed');
      mockApiClient.get.mockRejectedValue(mockError);

      await productService.getFavoriteProducts();

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('reportProduct', () => {
    it('should report product with reason only', async () => {
      const mockResponse = { data: { success: true } };
      const mockApiResponse = { success: true, data: { success: true } };
      
      mockApiClient.post.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await productService.reportProduct('1', 'inappropriate');

      expect(mockApiClient.post).toHaveBeenCalledWith('/products/1/report', {
        reason: 'inappropriate',
        description: undefined,
      });
      expect(result).toEqual(mockApiResponse);
    });

    it('should report product with reason and description', async () => {
      mockApiClient.post.mockResolvedValue({ data: { success: true } });
      mockHandleApiResponse.mockReturnValue({ success: true, data: { success: true } });

      await productService.reportProduct('1', 'inappropriate', 'Contains offensive content');

      expect(mockApiClient.post).toHaveBeenCalledWith('/products/1/report', {
        reason: 'inappropriate',
        description: 'Contains offensive content',
      });
    });

    it('should handle report product error', async () => {
      const mockError = new Error('Report failed');
      mockApiClient.post.mockRejectedValue(mockError);

      await productService.reportProduct('1', 'inappropriate');

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('getProductAnalytics', () => {
    it('should get product analytics', async () => {
      const analytics = {
        views: 100,
        inquiries: 10,
        favorites: 5,
        orders: 3,
        revenue: 76.50,
      };
      const mockResponse = { data: analytics };
      const mockApiResponse = { success: true, data: analytics };
      
      mockApiClient.get.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await productService.getProductAnalytics('1');

      expect(mockApiClient.get).toHaveBeenCalledWith('/products/1/analytics');
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle get product analytics error', async () => {
      const mockError = new Error('Analytics fetch failed');
      mockApiClient.get.mockRejectedValue(mockError);

      await productService.getProductAnalytics('1');

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('updateProductStatus', () => {
    it('should update product status', async () => {
      const updatedProduct = { ...mockProduct, status: 'sold' as const };
      const mockResponse = { data: updatedProduct };
      const mockApiResponse = { success: true, data: updatedProduct };
      
      mockApiClient.patch.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await productService.updateProductStatus('1', 'sold');

      expect(mockApiClient.patch).toHaveBeenCalledWith('/products/1/status', { status: 'sold' });
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle all valid status values', async () => {
      const statuses: Array<'available' | 'sold' | 'reserved' | 'expired'> = [
        'available', 'sold', 'reserved', 'expired'
      ];

      mockApiClient.patch.mockResolvedValue({ data: mockProduct });
      mockHandleApiResponse.mockReturnValue({ success: true, data: mockProduct });

      for (const status of statuses) {
        await productService.updateProductStatus('1', status);
        expect(mockApiClient.patch).toHaveBeenCalledWith('/products/1/status', { status });
      }
    });

    it('should handle update product status error', async () => {
      const mockError = new Error('Status update failed');
      mockApiClient.patch.mockRejectedValue(mockError);

      await productService.updateProductStatus('1', 'sold');

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });
});