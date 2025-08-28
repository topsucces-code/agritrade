import authService from '../authService';
import apiClient, { handleApiResponse, handleApiError } from '../apiClient';
import { User, LoginForm, RegisterForm } from '@/types';

// Mock the apiClient and its functions
jest.mock('../apiClient', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  handleApiResponse: jest.fn(),
  handleApiError: jest.fn(),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockHandleApiResponse = handleApiResponse as jest.MockedFunction<typeof handleApiResponse>;
const mockHandleApiError = handleApiError as jest.MockedFunction<typeof handleApiError>;

describe('AuthService', () => {
  const mockUser: User = {
    id: '1',
    phone: '+1234567890',
    name: 'John Doe',
    email: 'john@example.com',
    type: 'farmer',
    verified: true,
    avatar: 'https://example.com/avatar.jpg',
    location: {
      latitude: 40.7128,
      longitude: -74.0060,
      address: 'New York, NY',
    },
    language: 'en',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  };

  const mockLoginForm: LoginForm = {
    phone: '+1234567890',
    verificationCode: '123456',
  };

  const mockRegisterForm: RegisterForm = {
    phone: '+1234567890',
    name: 'John Doe',
    type: 'farmer',
    verificationCode: '123456',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendVerificationCode', () => {
    it('should send verification code successfully', async () => {
      const mockResponse = { data: { success: true, message: 'Code sent' } };
      const mockApiResponse = { success: true, data: { success: true, message: 'Code sent' } };
      
      mockApiClient.post.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await authService.sendVerificationCode('+1234567890');

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/send-verification', {
        phone: '+1234567890',
      });
      expect(mockHandleApiResponse).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle API error', async () => {
      const mockError = new Error('Network error');
      mockApiClient.post.mockRejectedValue(mockError);

      await authService.sendVerificationCode('+1234567890');

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('verifyPhone', () => {
    it('should verify phone number successfully', async () => {
      const mockResponse = { 
        data: { 
          user: mockUser, 
          token: 'jwt-token',
          refreshToken: 'refresh-token'
        } 
      };
      const mockApiResponse = { 
        success: true, 
        data: { 
          user: mockUser, 
          token: 'jwt-token',
          refreshToken: 'refresh-token'
        } 
      };
      
      mockApiClient.post.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await authService.verifyPhone('+1234567890', '123456');

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/verify-phone', {
        phone: '+1234567890',
        code: '123456',
      });
      expect(mockHandleApiResponse).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle verification error', async () => {
      const mockError = new Error('Invalid code');
      mockApiClient.post.mockRejectedValue(mockError);

      await authService.verifyPhone('+1234567890', '123456');

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const mockResponse = { 
        data: { 
          user: mockUser, 
          token: 'jwt-token',
          refreshToken: 'refresh-token'
        } 
      };
      const mockApiResponse = { 
        success: true, 
        data: { 
          user: mockUser, 
          token: 'jwt-token',
          refreshToken: 'refresh-token'
        } 
      };
      
      mockApiClient.post.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await authService.login(mockLoginForm);

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/login', mockLoginForm);
      expect(mockHandleApiResponse).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle login error', async () => {
      const mockError = new Error('Invalid credentials');
      mockApiClient.post.mockRejectedValue(mockError);

      await authService.login(mockLoginForm);

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('register', () => {
    it('should register user successfully', async () => {
      const mockResponse = { 
        data: { 
          user: mockUser, 
          token: 'jwt-token',
          refreshToken: 'refresh-token'
        } 
      };
      const mockApiResponse = { 
        success: true, 
        data: { 
          user: mockUser, 
          token: 'jwt-token',
          refreshToken: 'refresh-token'
        } 
      };
      
      mockApiClient.post.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await authService.register(mockRegisterForm);

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/register', mockRegisterForm);
      expect(mockHandleApiResponse).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle registration error', async () => {
      const mockError = new Error('Phone already exists');
      mockApiClient.post.mockRejectedValue(mockError);

      await authService.register(mockRegisterForm);

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockResponse = { 
        data: { 
          user: mockUser, 
          token: 'new-jwt-token',
          refreshToken: 'new-refresh-token'
        } 
      };
      const mockApiResponse = { 
        success: true, 
        data: { 
          user: mockUser, 
          token: 'new-jwt-token',
          refreshToken: 'new-refresh-token'
        } 
      };
      
      mockApiClient.post.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await authService.refreshToken();

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/refresh');
      expect(mockHandleApiResponse).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle token refresh error', async () => {
      const mockError = new Error('Token expired');
      mockApiClient.post.mockRejectedValue(mockError);

      await authService.refreshToken();

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const mockResponse = { data: { success: true } };
      const mockApiResponse = { success: true, data: { success: true } };
      
      mockApiClient.post.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await authService.logout();

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/logout');
      expect(mockHandleApiResponse).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle logout error', async () => {
      const mockError = new Error('Logout failed');
      mockApiClient.post.mockRejectedValue(mockError);

      await authService.logout();

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('getCurrentUser', () => {
    it('should get current user successfully', async () => {
      const mockResponse = { data: mockUser };
      const mockApiResponse = { success: true, data: mockUser };
      
      mockApiClient.get.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await authService.getCurrentUser();

      expect(mockApiClient.get).toHaveBeenCalledWith('/auth/me');
      expect(mockHandleApiResponse).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle get user error', async () => {
      const mockError = new Error('User not found');
      mockApiClient.get.mockRejectedValue(mockError);

      await authService.getCurrentUser();

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      const profileData = { name: 'Jane Doe', email: 'jane@example.com' };
      const updatedUser = { ...mockUser, ...profileData };
      const mockResponse = { data: updatedUser };
      const mockApiResponse = { success: true, data: updatedUser };
      
      mockApiClient.put.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await authService.updateProfile(profileData);

      expect(mockApiClient.put).toHaveBeenCalledWith('/auth/profile', profileData);
      expect(mockHandleApiResponse).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle profile update error', async () => {
      const mockError = new Error('Update failed');
      mockApiClient.put.mockRejectedValue(mockError);

      await authService.updateProfile({ name: 'Jane Doe' });

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('updateLocation', () => {
    it('should update location successfully', async () => {
      const locationData = {
        latitude: 40.7589,
        longitude: -73.9851,
        address: 'Times Square, New York',
      };
      const updatedUser = { ...mockUser, location: locationData };
      const mockResponse = { data: updatedUser };
      const mockApiResponse = { success: true, data: updatedUser };
      
      mockApiClient.put.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await authService.updateLocation(locationData);

      expect(mockApiClient.put).toHaveBeenCalledWith('/auth/location', locationData);
      expect(mockHandleApiResponse).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockApiResponse);
    });

    it('should update location without address', async () => {
      const locationData = {
        latitude: 40.7589,
        longitude: -73.9851,
      };
      
      mockApiClient.put.mockResolvedValue({ data: mockUser });
      mockHandleApiResponse.mockReturnValue({ success: true, data: mockUser });

      await authService.updateLocation(locationData);

      expect(mockApiClient.put).toHaveBeenCalledWith('/auth/location', locationData);
    });

    it('should handle location update error', async () => {
      const mockError = new Error('Location update failed');
      mockApiClient.put.mockRejectedValue(mockError);

      await authService.updateLocation({ latitude: 40.7589, longitude: -73.9851 });

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('updateLanguage', () => {
    it('should update language successfully', async () => {
      const updatedUser = { ...mockUser, language: 'fr' };
      const mockResponse = { data: updatedUser };
      const mockApiResponse = { success: true, data: updatedUser };
      
      mockApiClient.put.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await authService.updateLanguage('fr');

      expect(mockApiClient.put).toHaveBeenCalledWith('/auth/language', { language: 'fr' });
      expect(mockHandleApiResponse).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle language update error', async () => {
      const mockError = new Error('Language update failed');
      mockApiClient.put.mockRejectedValue(mockError);

      await authService.updateLanguage('fr');

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('uploadAvatar', () => {
    it('should upload avatar successfully', async () => {
      const imageData = {
        uri: 'file://avatar.jpg',
        type: 'image/jpeg',
        name: 'avatar.jpg',
      };
      const mockResponse = { data: { avatarUrl: 'https://example.com/new-avatar.jpg' } };
      const mockApiResponse = { success: true, data: { avatarUrl: 'https://example.com/new-avatar.jpg' } };
      
      mockApiClient.post.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await authService.uploadAvatar(imageData);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/auth/avatar',
        expect.any(FormData),
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      expect(mockHandleApiResponse).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle avatar upload error', async () => {
      const mockError = new Error('Upload failed');
      mockApiClient.post.mockRejectedValue(mockError);

      await authService.uploadAvatar({
        uri: 'file://avatar.jpg',
        type: 'image/jpeg',
        name: 'avatar.jpg',
      });

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('deleteAccount', () => {
    it('should delete account successfully', async () => {
      const mockResponse = { data: { success: true } };
      const mockApiResponse = { success: true, data: { success: true } };
      
      mockApiClient.delete.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await authService.deleteAccount();

      expect(mockApiClient.delete).toHaveBeenCalledWith('/auth/account');
      expect(mockHandleApiResponse).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle account deletion error', async () => {
      const mockError = new Error('Deletion failed');
      mockApiClient.delete.mockRejectedValue(mockError);

      await authService.deleteAccount();

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('requestPasswordReset', () => {
    it('should request password reset successfully', async () => {
      const mockResponse = { data: { success: true } };
      const mockApiResponse = { success: true, data: { success: true } };
      
      mockApiClient.post.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await authService.requestPasswordReset('john@example.com');

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/forgot-password', {
        email: 'john@example.com',
      });
      expect(mockHandleApiResponse).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle password reset request error', async () => {
      const mockError = new Error('Email not found');
      mockApiClient.post.mockRejectedValue(mockError);

      await authService.requestPasswordReset('john@example.com');

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const mockResponse = { data: { success: true } };
      const mockApiResponse = { success: true, data: { success: true } };
      
      mockApiClient.post.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await authService.resetPassword('reset-token', 'newpassword123');

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/reset-password', {
        token: 'reset-token',
        newPassword: 'newpassword123',
      });
      expect(mockHandleApiResponse).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle password reset error', async () => {
      const mockError = new Error('Invalid token');
      mockApiClient.post.mockRejectedValue(mockError);

      await authService.resetPassword('invalid-token', 'newpassword123');

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('checkPhoneAvailability', () => {
    it('should check phone availability successfully', async () => {
      const mockResponse = { data: { available: true } };
      const mockApiResponse = { success: true, data: { available: true } };
      
      mockApiClient.get.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      const result = await authService.checkPhoneAvailability('+1234567890');

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/auth/check-phone?phone=%2B1234567890'
      );
      expect(mockHandleApiResponse).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual(mockApiResponse);
    });

    it('should handle special characters in phone number', async () => {
      const mockResponse = { data: { available: false } };
      const mockApiResponse = { success: true, data: { available: false } };
      
      mockApiClient.get.mockResolvedValue(mockResponse);
      mockHandleApiResponse.mockReturnValue(mockApiResponse);

      await authService.checkPhoneAvailability('+33 1 23 45 67 89');

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/auth/check-phone?phone=%2B33%201%2023%2045%2067%2089'
      );
    });

    it('should handle phone availability check error', async () => {
      const mockError = new Error('Check failed');
      mockApiClient.get.mockRejectedValue(mockError);

      await authService.checkPhoneAvailability('+1234567890');

      expect(mockHandleApiError).toHaveBeenCalledWith(mockError);
    });
  });
});