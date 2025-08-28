import apiClient, { handleApiResponse, handleApiError } from './apiClient';
import { QualityResult, Recommendation, ApiResponse } from '@/types';

export interface AnalysisProgressResponse {
  analysisId: string;
  status: 'uploading' | 'analyzing' | 'completed' | 'failed';
  progress: number;
  message?: string;
}

export interface QualityAnalysisRequest {
  images: {
    uri: string;
    type: string;
    name: string;
  }[];
  metadata: {
    category: string;
    subcategory?: string;
    estimatedQuantity?: number;
    harvestDate?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
}

class QualityAnalysisService {
  /**
   * Start quality analysis for product images
   */
  async analyzeQuality(analysisData: FormData): Promise<ApiResponse<QualityResult>> {
    try {
      const response = await apiClient.post('/ai/quality/analyze', analysisData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60 seconds for analysis
      });
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Start async quality analysis and return analysis ID
   */
  async startAsyncAnalysis(analysisData: FormData): Promise<ApiResponse<{ analysisId: string }>> {
    try {
      const response = await apiClient.post('/ai/quality/analyze-async', analysisData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Get analysis progress
   */
  async getAnalysisProgress(analysisId: string): Promise<ApiResponse<AnalysisProgressResponse>> {
    try {
      const response = await apiClient.get(`/ai/quality/progress/${analysisId}`);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Get analysis result
   */
  async getAnalysisResult(analysisId: string): Promise<ApiResponse<QualityResult>> {
    try {
      const response = await apiClient.get(`/ai/quality/result/${analysisId}`);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Get recommendations for improving quality
   */
  async getRecommendations(productId: string): Promise<ApiResponse<Recommendation[]>> {
    try {
      const response = await apiClient.get(`/ai/quality/recommendations/${productId}`);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Save analysis result to product
   */
  async saveAnalysisResult(
    productId: string, 
    resultData: Partial<QualityResult>
  ): Promise<ApiResponse<QualityResult>> {
    try {
      const response = await apiClient.post(`/ai/quality/save/${productId}`, resultData);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Get analysis history for a product
   */
  async getAnalysisHistory(productId: string): Promise<ApiResponse<QualityResult[]>> {
    try {
      const response = await apiClient.get(`/ai/quality/history/${productId}`);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Get analysis statistics for farmer
   */
  async getAnalysisStats(): Promise<ApiResponse<{
    totalAnalyses: number;
    averageQuality: number;
    improvementTrends: {
      month: string;
      averageScore: number;
    }[];
    categoryBreakdown: {
      category: string;
      count: number;
      averageScore: number;
    }[];
  }>> {
    try {
      const response = await apiClient.get('/ai/quality/stats');
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Get price estimation based on quality
   */
  async getPriceEstimation(qualityData: {
    category: string;
    qualityScore: number;
    location: {
      latitude: number;
      longitude: number;
    };
    quantity: number;
  }): Promise<ApiResponse<{
    estimatedPrice: number;
    priceRange: {
      min: number;
      max: number;
    };
    factors: {
      quality: number;
      location: number;
      market: number;
      seasonal: number;
    };
    confidence: number;
  }>> {
    try {
      const response = await apiClient.post('/ai/pricing/estimate', qualityData);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Get market insights
   */
  async getMarketInsights(category: string): Promise<ApiResponse<{
    averagePrice: number;
    priceHistory: {
      date: string;
      price: number;
    }[];
    demandTrends: {
      month: string;
      demand: number;
    }[];
    topLocations: {
      location: string;
      averagePrice: number;
      volume: number;
    }[];
  }>> {
    try {
      const response = await apiClient.get(`/ai/market/insights/${category}`);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Validate image for quality analysis
   */
  async validateImage(imageData: FormData): Promise<ApiResponse<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
    confidence: number;
  }>> {
    try {
      const response = await apiClient.post('/ai/quality/validate-image', imageData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Get optimal harvest timing recommendations
   */
  async getHarvestRecommendations(cropData: {
    category: string;
    subcategory?: string;
    plantingDate: string;
    location: {
      latitude: number;
      longitude: number;
    };
    currentImages?: string[];
  }): Promise<ApiResponse<{
    recommendedHarvestDate: string;
    confidenceLevel: number;
    factors: {
      weather: string;
      maturity: string;
      market: string;
    };
    tips: string[];
  }>> {
    try {
      const response = await apiClient.post('/ai/harvest/recommendations', cropData);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Submit feedback on analysis accuracy
   */
  async submitAnalysisFeedback(
    analysisId: string,
    feedback: {
      accuracy: number; // 1-5 scale
      comments?: string;
      actualPrice?: number;
      actualQuality?: number;
    }
  ): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await apiClient.post(`/ai/quality/feedback/${analysisId}`, feedback);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }
}

export const qualityAnalysisService = new QualityAnalysisService();
export default qualityAnalysisService;