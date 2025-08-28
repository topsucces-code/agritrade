// Core user types
export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  userType: 'farmer' | 'buyer' | 'admin';
  location: {
    latitude: number;
    longitude: number;
    address?: string;
    district?: string;
    country?: string;
  };
  profile: {
    avatar?: string;
    language: string;
    verified: boolean;
    rating?: number;
    totalTransactions: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Product related types
export interface Product {
  _id: string;
  name: string;
  category: string;
  subcategory?: string;
  description: string;
  images: string[];
  farmerId: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  qualityAnalysis?: QualityResult;
  pricing: {
    basePrice: number;
    estimatedPrice: number;
    currency: string;
  };
  quantity: {
    available: number;
    unit: string;
    minimumOrder: number;
  };
  harvestDate: Date;
  expiryDate?: Date;
  status: 'available' | 'sold' | 'reserved' | 'expired';
  createdAt: Date;
  updatedAt: Date;
}

// Quality analysis types
export interface QualityResult {
  _id: string;
  productId: string;
  overallScore: number;
  visualQuality: {
    color: number;
    texture: number;
    size: number;
    uniformity: number;
  };
  defects: {
    type: string;
    severity: 'low' | 'medium' | 'high';
    confidence: number;
  }[];
  recommendations: Recommendation[];
  priceImpact: {
    adjustmentPercentage: number;
    adjustedPrice: number;
  };
  analysisDate: Date;
}

export interface Recommendation {
  id: string;
  type: 'quality_improvement' | 'pricing' | 'marketing' | 'storage';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
  estimatedImpact?: string;
}

// Order types
export interface Order {
  _id: string;
  farmerId: string;
  buyerId: string;
  productId: string;
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'in_transit' | 'delivered' | 'cancelled';
  deliveryDetails: {
    address: string;
    estimatedDate: Date;
    actualDate?: Date;
  };
  paymentDetails: {
    method: string;
    status: 'pending' | 'completed' | 'failed';
    transactionId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  PhoneVerification: { phoneNumber: string };
  ProfileSetup: { userId: string };
  Onboarding: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Products: undefined;
  Orders: undefined;
  Profile: undefined;
};

export type HomeStackParamList = {
  Dashboard: undefined;
  QualityAnalysis: { productId?: string };
  PriceRecommendations: { productId: string };
};

export type ProductStackParamList = {
  ProductList: undefined;
  ProductDetails: { productId: string };
  AddProduct: undefined;
  EditProduct: { productId: string };
};

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Form types
export interface LoginForm {
  phone: string;
  verificationCode?: string;
}

export interface RegisterForm {
  name: string;
  phone: string;
  userType: 'farmer' | 'buyer';
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  language: string;
}

// State types
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface ProductsState {
  items: Product[];
  categories: string[];
  filters: ProductFilters;
  searchQuery: string;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  isLoading: boolean;
}

export interface ProductFilters {
  category?: string;
  location?: {
    latitude: number;
    longitude: number;
    radius: number;
  };
  priceRange?: {
    min: number;
    max: number;
  };
  qualityScore?: {
    min: number;
    max: number;
  };
  sortBy?: 'price' | 'quality' | 'distance' | 'date';
  sortOrder?: 'asc' | 'desc';
}

export interface QualityAnalysisState {
  currentAnalysis: AnalysisSession | null;
  results: QualityResult[];
  recommendations: Recommendation[];
  isAnalyzing: boolean;
  progress: number;
}

export interface AnalysisSession {
  id: string;
  productId?: string;
  images: ImageData[];
  metadata: ProductMetadata;
  status: 'uploading' | 'analyzing' | 'completed' | 'failed';
  progress: number;
}

export interface ImageData {
  uri: string;
  type: string;
  name: string;
  size: number;
}

export interface ProductMetadata {
  category: string;
  subcategory?: string;
  estimatedQuantity?: number;
  harvestDate?: Date;
  location?: {
    latitude: number;
    longitude: number;
  };
}

// Component prop types
export interface ProductCardProps {
  product: Product;
  onPress: (productId: string) => void;
  showActions?: boolean;
  compact?: boolean;
}

export interface ImageUploaderProps {
  onImagesSelected: (images: ImageData[]) => void;
  maxImages?: number;
  aspectRatio?: number;
  quality?: number;
}

export interface QualityIndicatorProps {
  score: number;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  animated?: boolean;
}

// Utility types
export type Theme = 'light' | 'dark';
export type Language = 'en' | 'fr' | 'sw' | 'ar';
export type Currency = 'USD' | 'XOF' | 'KES' | 'TZS' | 'UGX';

export interface AppConfig {
  apiBaseUrl: string;
  wsUrl: string;
  supportedLanguages: Language[];
  defaultCurrency: Currency;
  theme: Theme;
}