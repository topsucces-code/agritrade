import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ImageUploader from '../ImageUploader';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

// Mock dependencies
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
  launchCamera: jest.fn(),
}));

jest.mock('react-native-permissions', () => ({
  request: jest.fn(),
  PERMISSIONS: {
    ANDROID: {
      CAMERA: 'android.permission.CAMERA',
      READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
    },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
  },
}));

jest.mock('react-native', () => {
  const ReactNative = jest.requireActual('react-native');
  return {
    ...ReactNative,
    Alert: {
      alert: jest.fn(),
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 812 })),
    },
  };
});

const mockOnImagesSelected = jest.fn();

const mockImageAsset = {
  uri: 'file://test-image.jpg',
  type: 'image/jpeg',
  fileName: 'test-image.jpg',
  fileSize: 1024000,
};

const mockImageResponse = {
  didCancel: false,
  errorMessage: undefined,
  assets: [mockImageAsset],
};

describe('ImageUploader Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (request as jest.Mock).mockResolvedValue(RESULTS.GRANTED);
  });

  describe('Rendering', () => {
    it('should render with default props', () => {
      const { getByText } = render(
        <ImageUploader onImagesSelected={mockOnImagesSelected} />
      );

      expect(getByText('Product Images')).toBeTruthy();
      expect(getByText('Add up to 5 high-quality images (0/5)')).toBeTruthy();
      expect(getByText('Add Image')).toBeTruthy();
    });

    it('should render with custom maxImages', () => {
      const { getByText } = render(
        <ImageUploader onImagesSelected={mockOnImagesSelected} maxImages={3} />
      );

      expect(getByText('Add up to 3 high-quality images (0/3)')).toBeTruthy();
    });

    it('should render empty state when no images are selected', () => {
      const { getByText } = render(
        <ImageUploader onImagesSelected={mockOnImagesSelected} />
      );

      expect(getByText('No images selected')).toBeTruthy();
      expect(getByText('Tap "Add Image" to start uploading product photos')).toBeTruthy();
    });

    it('should render photo guidelines', () => {
      const { getByText } = render(
        <ImageUploader onImagesSelected={mockOnImagesSelected} />
      );

      expect(getByText('📸 Photo Guidelines')).toBeTruthy();
      expect(getByText('Use good natural lighting')).toBeTruthy();
      expect(getByText('Capture different angles')).toBeTruthy();
      expect(getByText('Show product clearly')).toBeTruthy();
      expect(getByText('Avoid blurry images')).toBeTruthy();
    });
  });

  describe('Image Selection Flow', () => {
    it('should show image picker alert when add button is pressed', () => {
      const { getByText } = render(
        <ImageUploader onImagesSelected={mockOnImagesSelected} />
      );

      fireEvent.press(getByText('Add Image'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Select Image',
        'Choose how you want to add an image',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Camera' }),
          expect.objectContaining({ text: 'Gallery' }),
          expect.objectContaining({ text: 'Cancel' }),
        ]),
        { cancelable: true }
      );
    });

    it('should handle camera selection with permission', async () => {
      (request as jest.Mock).mockResolvedValue(RESULTS.GRANTED);
      (launchCamera as jest.Mock).mockImplementation((options, callback) => {
        callback(mockImageResponse);
      });

      const { getByText } = render(
        <ImageUploader onImagesSelected={mockOnImagesSelected} />
      );

      fireEvent.press(getByText('Add Image'));

      // Simulate camera button press in alert
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const cameraButton = alertCall[2].find((button: any) => button.text === 'Camera');
      
      await cameraButton.onPress();

      expect(request).toHaveBeenCalledWith(PERMISSIONS.ANDROID.CAMERA);
      expect(launchCamera).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaType: 'photo',
          quality: 0.8,
          maxWidth: 1920,
          maxHeight: 1920,
          includeBase64: false,
        }),
        expect.any(Function)
      );
    });

    it('should handle gallery selection with permission', async () => {
      (request as jest.Mock).mockResolvedValue(RESULTS.GRANTED);
      (launchImageLibrary as jest.Mock).mockImplementation((options, callback) => {
        callback(mockImageResponse);
      });

      const { getByText } = render(
        <ImageUploader onImagesSelected={mockOnImagesSelected} maxImages={3} />
      );

      fireEvent.press(getByText('Add Image'));

      // Simulate gallery button press in alert
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const galleryButton = alertCall[2].find((button: any) => button.text === 'Gallery');
      
      await galleryButton.onPress();

      expect(request).toHaveBeenCalledWith(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
      expect(launchImageLibrary).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaType: 'photo',
          quality: 0.8,
          maxWidth: 1920,
          maxHeight: 1920,
          includeBase64: false,
          selectionLimit: 3,
        }),
        expect.any(Function)
      );
    });
  });

  describe('Permission Handling', () => {
    it('should show permission alert when camera permission is denied', async () => {
      (request as jest.Mock).mockResolvedValue(RESULTS.DENIED);

      const { getByText } = render(
        <ImageUploader onImagesSelected={mockOnImagesSelected} />
      );

      fireEvent.press(getByText('Add Image'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const cameraButton = alertCall[2].find((button: any) => button.text === 'Camera');
      
      await cameraButton.onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Camera Permission Required',
          'Please grant camera permission to take photos.',
          [{ text: 'OK' }]
        );
      });

      expect(launchCamera).not.toHaveBeenCalled();
    });

    it('should show permission alert when storage permission is denied', async () => {
      (request as jest.Mock).mockResolvedValue(RESULTS.DENIED);

      const { getByText } = render(
        <ImageUploader onImagesSelected={mockOnImagesSelected} />
      );

      fireEvent.press(getByText('Add Image'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const galleryButton = alertCall[2].find((button: any) => button.text === 'Gallery');
      
      await galleryButton.onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Storage Permission Required',
          'Please grant storage permission to access photos.',
          [{ text: 'OK' }]
        );
      });

      expect(launchImageLibrary).not.toHaveBeenCalled();
    });

    it('should handle permission request errors gracefully', async () => {
      (request as jest.Mock).mockRejectedValue(new Error('Permission error'));

      const { getByText } = render(
        <ImageUploader onImagesSelected={mockOnImagesSelected} />
      );

      fireEvent.press(getByText('Add Image'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const cameraButton = alertCall[2].find((button: any) => button.text === 'Camera');
      
      await cameraButton.onPress();

      expect(launchCamera).not.toHaveBeenCalled();
    });
  });

  describe('Image Management', () => {
    it('should call onImagesSelected when images are added', async () => {
      (launchImageLibrary as jest.Mock).mockImplementation((options, callback) => {
        callback(mockImageResponse);
      });

      const { getByText } = render(
        <ImageUploader onImagesSelected={mockOnImagesSelected} />
      );

      fireEvent.press(getByText('Add Image'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const galleryButton = alertCall[2].find((button: any) => button.text === 'Gallery');
      
      await galleryButton.onPress();

      await waitFor(() => {
        expect(mockOnImagesSelected).toHaveBeenCalledWith([
          {
            uri: 'file://test-image.jpg',
            type: 'image/jpeg',
            name: 'test-image.jpg',
            size: 1024000,
          },
        ]);
      });
    });

    it('should handle image picker cancellation', async () => {
      (launchImageLibrary as jest.Mock).mockImplementation((options, callback) => {
        callback({ didCancel: true });
      });

      const { getByText } = render(
        <ImageUploader onImagesSelected={mockOnImagesSelected} />
      );

      fireEvent.press(getByText('Add Image'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const galleryButton = alertCall[2].find((button: any) => button.text === 'Gallery');
      
      await galleryButton.onPress();

      expect(mockOnImagesSelected).not.toHaveBeenCalled();
    });

    it('should handle image picker errors', async () => {
      (launchImageLibrary as jest.Mock).mockImplementation((options, callback) => {
        callback({ errorMessage: 'Image picker error' });
      });

      const { getByText } = render(
        <ImageUploader onImagesSelected={mockOnImagesSelected} />
      );

      fireEvent.press(getByText('Add Image'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const galleryButton = alertCall[2].find((button: any) => button.text === 'Gallery');
      
      await galleryButton.onPress();

      expect(mockOnImagesSelected).not.toHaveBeenCalled();
    });

    it('should prevent adding more images than maxImages', async () => {
      const multipleImagesResponse = {
        didCancel: false,
        errorMessage: undefined,
        assets: [
          { ...mockImageAsset, fileName: 'image1.jpg' },
          { ...mockImageAsset, fileName: 'image2.jpg' },
          { ...mockImageAsset, fileName: 'image3.jpg' },
        ],
      };

      (launchImageLibrary as jest.Mock).mockImplementation((options, callback) => {
        callback(multipleImagesResponse);
      });

      const { getByText } = render(
        <ImageUploader onImagesSelected={mockOnImagesSelected} maxImages={2} />
      );

      fireEvent.press(getByText('Add Image'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const galleryButton = alertCall[2].find((button: any) => button.text === 'Gallery');
      
      await galleryButton.onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Too Many Images',
          'You can only select up to 2 images.',
          [{ text: 'OK' }]
        );
      });

      expect(mockOnImagesSelected).not.toHaveBeenCalled();
    });

    it('should handle images without fileName', async () => {
      const imageWithoutName = {
        ...mockImageResponse,
        assets: [{
          ...mockImageAsset,
          fileName: undefined,
        }],
      };

      (launchImageLibrary as jest.Mock).mockImplementation((options, callback) => {
        callback(imageWithoutName);
      });

      const { getByText } = render(
        <ImageUploader onImagesSelected={mockOnImagesSelected} />
      );

      fireEvent.press(getByText('Add Image'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const galleryButton = alertCall[2].find((button: any) => button.text === 'Gallery');
      
      await galleryButton.onPress();

      await waitFor(() => {
        expect(mockOnImagesSelected).toHaveBeenCalledWith([
          expect.objectContaining({
            name: expect.stringMatching(/^image_\d+\.jpg$/),
          }),
        ]);
      });
    });
  });

  describe('Custom Props', () => {
    it('should use custom quality setting', async () => {
      const { getByText } = render(
        <ImageUploader onImagesSelected={mockOnImagesSelected} quality={0.5} />
      );

      fireEvent.press(getByText('Add Image'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const cameraButton = alertCall[2].find((button: any) => button.text === 'Camera');
      
      await cameraButton.onPress();

      expect(launchCamera).toHaveBeenCalledWith(
        expect.objectContaining({
          quality: 0.5,
        }),
        expect.any(Function)
      );
    });

    it('should use custom aspectRatio (for future use)', () => {
      const { getByText } = render(
        <ImageUploader 
          onImagesSelected={mockOnImagesSelected} 
          aspectRatio={16/9} 
        />
      );

      // Component should render without errors
      expect(getByText('Product Images')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty assets array', async () => {
      (launchImageLibrary as jest.Mock).mockImplementation((options, callback) => {
        callback({ didCancel: false, assets: [] });
      });

      const { getByText } = render(
        <ImageUploader onImagesSelected={mockOnImagesSelected} />
      );

      fireEvent.press(getByText('Add Image'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const galleryButton = alertCall[2].find((button: any) => button.text === 'Gallery');
      
      await galleryButton.onPress();

      expect(mockOnImagesSelected).not.toHaveBeenCalled();
    });

    it('should handle missing asset properties', async () => {
      const incompleteAsset = {
        uri: 'file://test-image.jpg',
        // Missing type, fileName, fileSize
      };

      (launchImageLibrary as jest.Mock).mockImplementation((options, callback) => {
        callback({ didCancel: false, assets: [incompleteAsset] });
      });

      const { getByText } = render(
        <ImageUploader onImagesSelected={mockOnImagesSelected} />
      );

      fireEvent.press(getByText('Add Image'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const galleryButton = alertCall[2].find((button: any) => button.text === 'Gallery');
      
      await galleryButton.onPress();

      await waitFor(() => {
        expect(mockOnImagesSelected).toHaveBeenCalledWith([
          {
            uri: 'file://test-image.jpg',
            type: 'image/jpeg',
            name: expect.stringMatching(/^image_\d+\.jpg$/),
            size: 0,
          },
        ]);
      });
    });
  });
});