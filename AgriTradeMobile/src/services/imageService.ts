import { Platform, Alert } from 'react-native';
import { 
  launchImageLibrary, 
  launchCamera, 
  ImagePickerResponse,
  MediaType,
  ImagePickerOptions 
} from 'react-native-image-picker';
import { 
  request, 
  PERMISSIONS, 
  RESULTS, 
  Permission 
} from 'react-native-permissions';
import ImageResizer from 'react-native-image-resizer';
import { ImageData } from '@/types';

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'JPEG' | 'PNG';
  rotation?: number;
  outputPath?: string;
}

export interface CameraOptions {
  mediaType?: MediaType;
  includeBase64?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  videoQuality?: 'low' | 'medium' | 'high';
  durationLimit?: number;
  saveToPhotos?: boolean;
  cameraType?: 'front' | 'back';
  includeExtra?: boolean;
  presentationStyle?: 'fullScreen' | 'pageSheet' | 'formSheet' | 'overFullScreen';
}

class ImageService {
  private defaultCompressionOptions: ImageCompressionOptions = {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.8,
    format: 'JPEG',
    rotation: 0,
  };

  private defaultCameraOptions: CameraOptions = {
    mediaType: 'photo',
    includeBase64: false,
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.8,
    saveToPhotos: false,
    cameraType: 'back',
    includeExtra: false,
  };

  /**
   * Request camera permission
   */
  async requestCameraPermission(): Promise<boolean> {
    try {
      const permission: Permission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.CAMERA 
        : PERMISSIONS.ANDROID.CAMERA;
        
      const result = await request(permission);
      return result === RESULTS.GRANTED;
    } catch (error) {
      console.error('Camera permission error:', error);
      return false;
    }
  }

  /**
   * Request storage/photo library permission
   */
  async requestStoragePermission(): Promise<boolean> {
    try {
      let permission: Permission;
      
      if (Platform.OS === 'ios') {
        permission = PERMISSIONS.IOS.PHOTO_LIBRARY;
      } else {
        // For Android 13+ (API 33+), use READ_MEDIA_IMAGES
        permission = Platform.Version >= 33 
          ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES 
          : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
      }
        
      const result = await request(permission);
      return result === RESULTS.GRANTED;
    } catch (error) {
      console.error('Storage permission error:', error);
      return false;
    }
  }

  /**
   * Show image picker options
   */
  showImagePickerOptions(
    onImageSelected: (images: ImageData[]) => void,
    options: {
      allowMultiple?: boolean;
      maxImages?: number;
      compressionOptions?: ImageCompressionOptions;
    } = {}
  ): void {
    const { allowMultiple = false, maxImages = 5, compressionOptions } = options;

    Alert.alert(
      'Select Image',
      'Choose how you want to add an image',
      [
        {
          text: 'Camera',
          onPress: () => this.openCamera(onImageSelected, compressionOptions),
          style: 'default',
        },
        {
          text: 'Gallery',
          onPress: () => this.openGallery(onImageSelected, { 
            allowMultiple, 
            maxImages, 
            compressionOptions 
          }),
          style: 'default',
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  }

  /**
   * Open camera to take photo
   */
  async openCamera(
    onImageSelected: (images: ImageData[]) => void,
    compressionOptions?: ImageCompressionOptions,
    cameraOptions?: CameraOptions
  ): Promise<void> {
    const hasPermission = await this.requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(
        'Camera Permission Required',
        'Please grant camera permission to take photos.',
        [
          {
            text: 'Settings',
            onPress: () => {
              // Open app settings - platform specific implementation needed
              console.log('Open app settings');
            },
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    const options: ImagePickerOptions = {
      ...this.defaultCameraOptions,
      ...cameraOptions,
    };

    launchCamera(options, (response) => {
      this.handleImageResponse(response, onImageSelected, compressionOptions);
    });
  }

  /**
   * Open gallery to select photo(s)
   */
  async openGallery(
    onImageSelected: (images: ImageData[]) => void,
    options: {
      allowMultiple?: boolean;
      maxImages?: number;
      compressionOptions?: ImageCompressionOptions;
    } = {}
  ): Promise<void> {
    const hasPermission = await this.requestStoragePermission();
    if (!hasPermission) {
      Alert.alert(
        'Storage Permission Required',
        'Please grant storage permission to access photos.',
        [
          {
            text: 'Settings',
            onPress: () => {
              // Open app settings - platform specific implementation needed
              console.log('Open app settings');
            },
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    const { allowMultiple = false, maxImages = 5, compressionOptions } = options;

    const pickerOptions: ImagePickerOptions = {
      ...this.defaultCameraOptions,
      selectionLimit: allowMultiple ? maxImages : 1,
    };

    launchImageLibrary(pickerOptions, (response) => {
      this.handleImageResponse(response, onImageSelected, compressionOptions);
    });
  }

  /**
   * Handle image picker response
   */
  private async handleImageResponse(
    response: ImagePickerResponse,
    onImageSelected: (images: ImageData[]) => void,
    compressionOptions?: ImageCompressionOptions
  ): Promise<void> {
    if (response.didCancel || response.errorMessage) {
      if (response.errorMessage) {
        console.error('Image picker error:', response.errorMessage);
        Alert.alert('Error', 'Failed to select image. Please try again.');
      }
      return;
    }

    if (!response.assets || response.assets.length === 0) {
      return;
    }

    try {
      const processedImages: ImageData[] = [];

      for (const asset of response.assets) {
        if (!asset.uri) continue;

        let processedUri = asset.uri;
        let fileSize = asset.fileSize || 0;

        // Compress image if options provided
        if (compressionOptions || fileSize > 5 * 1024 * 1024) { // 5MB
          try {
            const compressed = await this.compressImage(asset.uri, compressionOptions);
            processedUri = compressed.uri;
            fileSize = compressed.size;
          } catch (compressionError) {
            console.warn('Image compression failed, using original:', compressionError);
            // Continue with original image if compression fails
          }
        }

        processedImages.push({
          uri: processedUri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || `image_${Date.now()}.jpg`,
          size: fileSize,
        });
      }

      onImageSelected(processedImages);
    } catch (error) {
      console.error('Error processing images:', error);
      Alert.alert('Error', 'Failed to process selected images.');
    }
  }

  /**
   * Compress image using react-native-image-resizer
   */
  async compressImage(
    uri: string, 
    options?: ImageCompressionOptions
  ): Promise<{ uri: string; size: number }> {
    const compressionOptions = {
      ...this.defaultCompressionOptions,
      ...options,
    };

    try {
      const result = await ImageResizer.createResizedImage(
        uri,
        compressionOptions.maxWidth || 1920,
        compressionOptions.maxHeight || 1920,
        compressionOptions.format || 'JPEG',
        compressionOptions.quality || 0.8,
        compressionOptions.rotation || 0,
        compressionOptions.outputPath,
        false, // keepMeta
        {
          mode: 'contain',
          onlyScaleDown: true,
        }
      );

      return {
        uri: result.uri,
        size: result.size || 0,
      };
    } catch (error) {
      console.error('Image compression error:', error);
      throw new Error('Failed to compress image');
    }
  }

  /**
   * Validate image file
   */
  validateImage(image: ImageData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!image.uri) {
      errors.push('Image URI is required');
    }

    if (!allowedTypes.includes(image.type.toLowerCase())) {
      errors.push('Unsupported image format. Please use JPEG, PNG, or WebP');
    }

    if (image.size > maxSize) {
      errors.push('Image size too large. Maximum size is 10MB');
    }

    if (image.size < 1024) { // 1KB
      errors.push('Image size too small. Minimum size is 1KB');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get image dimensions
   */
  async getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const Image = require('react-native').Image;
      Image.getSize(
        uri,
        (width: number, height: number) => resolve({ width, height }),
        (error: any) => reject(error)
      );
    });
  }

  /**
   * Create image thumbnail
   */
  async createThumbnail(
    uri: string,
    size: number = 200
  ): Promise<string> {
    try {
      const result = await ImageResizer.createResizedImage(
        uri,
        size,
        size,
        'JPEG',
        0.7, // Lower quality for thumbnails
        0,
        undefined,
        false,
        {
          mode: 'cover',
          onlyScaleDown: false,
        }
      );

      return result.uri;
    } catch (error) {
      console.error('Thumbnail creation error:', error);
      throw new Error('Failed to create thumbnail');
    }
  }

  /**
   * Batch process multiple images
   */
  async batchCompressImages(
    images: ImageData[],
    options?: ImageCompressionOptions,
    onProgress?: (completed: number, total: number) => void
  ): Promise<ImageData[]> {
    const processedImages: ImageData[] = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      
      try {
        const compressed = await this.compressImage(image.uri, options);
        processedImages.push({
          ...image,
          uri: compressed.uri,
          size: compressed.size,
        });
      } catch (error) {
        console.warn(`Failed to compress image ${i + 1}:`, error);
        // Include original image if compression fails
        processedImages.push(image);
      }

      onProgress?.(i + 1, images.length);
    }

    return processedImages;
  }

  /**
   * Clear image cache (platform specific implementation needed)
   */
  async clearImageCache(): Promise<void> {
    try {
      // Implementation would depend on caching strategy
      // Could integrate with react-native-fast-image cache clearing
      console.log('Image cache cleared');
    } catch (error) {
      console.error('Failed to clear image cache:', error);
    }
  }
}

export const imageService = new ImageService();
export default imageService;