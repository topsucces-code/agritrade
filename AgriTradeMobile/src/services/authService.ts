import apiClient, { handleApiResponse, handleApiError } from './apiClient';
import { User, LoginForm, RegisterForm, ApiResponse } from '@/types';

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken?: string;
}

export interface VerificationResponse {
  success: boolean;
  message: string;
  verificationId?: string;
}

class AuthService {
  /**
   * Send SMS verification code to phone number
   */
  async sendVerificationCode(phone: string): Promise<ApiResponse<VerificationResponse>> {
    try {
      const response = await apiClient.post('/auth/send-verification', { phone });
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Verify phone number with SMS code
   */
  async verifyPhone(phone: string, code: string): Promise<ApiResponse<AuthResponse>> {
    try {
      const response = await apiClient.post('/auth/verify-phone', { phone, code });
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Login user with phone and verification code
   */
  async login(credentials: LoginForm): Promise<ApiResponse<AuthResponse>> {
    try {
      const response = await apiClient.post('/auth/login', credentials);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Register new user
   */
  async register(userData: RegisterForm): Promise<ApiResponse<AuthResponse>> {
    try {
      const response = await apiClient.post('/auth/register', userData);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<ApiResponse<AuthResponse>> {
    try {
      const response = await apiClient.post('/auth/refresh');
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await apiClient.post('/auth/logout');
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    try {
      const response = await apiClient.get('/auth/me');
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(profileData: Partial<User>): Promise<ApiResponse<User>> {
    try {
      const response = await apiClient.put('/auth/profile', profileData);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Update user location
   */
  async updateLocation(location: {
    latitude: number;
    longitude: number;
    address?: string;
  }): Promise<ApiResponse<User>> {
    try {
      const response = await apiClient.put('/auth/location', location);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Change user language preference
   */
  async updateLanguage(language: string): Promise<ApiResponse<User>> {
    try {
      const response = await apiClient.put('/auth/language', { language });
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Upload user avatar
   */
  async uploadAvatar(imageData: {
    uri: string;
    type: string;
    name: string;
  }): Promise<ApiResponse<{ avatarUrl: string }>> {
    try {
      const formData = new FormData();
      formData.append('avatar', {
        uri: imageData.uri,
        type: imageData.type,
        name: imageData.name,
      } as any);

      const response = await apiClient.post('/auth/avatar', formData, {
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
   * Delete user account
   */
  async deleteAccount(): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await apiClient.delete('/auth/account');
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Request password reset (for email-based accounts)
   */
  async requestPasswordReset(email: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await apiClient.post('/auth/forgot-password', { email });
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await apiClient.post('/auth/reset-password', { token, newPassword });
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }

  /**
   * Check if phone number is available
   */
  async checkPhoneAvailability(phone: string): Promise<ApiResponse<{ available: boolean }>> {
    try {
      const response = await apiClient.get(`/auth/check-phone?phone=${encodeURIComponent(phone)}`);
      return handleApiResponse(response);
    } catch (error: any) {
      handleApiError(error);
    }
  }
}

export const authService = new AuthService();
export default authService;