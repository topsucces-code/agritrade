import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  ScrollView,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary, launchCamera, ImagePickerResponse } from 'react-native-image-picker';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { ImageUploaderProps, ImageData } from '@/types';

const { width: screenWidth } = Dimensions.get('window');
const imageSize = (screenWidth - 60) / 3; // 3 columns with margins

const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImagesSelected,
  maxImages = 5,
  aspectRatio = 1,
  quality = 0.8,
}) => {
  const [selectedImages, setSelectedImages] = useState<ImageData[]>([]);

  const requestCameraPermission = async (): Promise<boolean> => {
    try {
      const result = await request(PERMISSIONS.ANDROID.CAMERA);
      return result === RESULTS.GRANTED;
    } catch (error) {
      console.error('Camera permission error:', error);
      return false;
    }
  };

  const requestStoragePermission = async (): Promise<boolean> => {
    try {
      const result = await request(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
      return result === RESULTS.GRANTED;
    } catch (error) {
      console.error('Storage permission error:', error);
      return false;
    }
  };

  const showImagePicker = () => {
    Alert.alert(
      'Select Image',
      'Choose how you want to add an image',
      [
        {
          text: 'Camera',
          onPress: openCamera,
          style: 'default',
        },
        {
          text: 'Gallery',
          onPress: openGallery,
          style: 'default',
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const openCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(
        'Camera Permission Required',
        'Please grant camera permission to take photos.',
        [{ text: 'OK' }]
      );
      return;
    }

    launchCamera(
      {
        mediaType: 'photo',
        quality: quality,
        maxWidth: 1920,
        maxHeight: 1920,
        includeBase64: false,
      },
      handleImageResponse
    );
  };

  const openGallery = async () => {
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert(
        'Storage Permission Required',
        'Please grant storage permission to access photos.',
        [{ text: 'OK' }]
      );
      return;
    }

    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: quality,
        maxWidth: 1920,
        maxHeight: 1920,
        includeBase64: false,
        selectionLimit: maxImages - selectedImages.length,
      },
      handleImageResponse
    );
  };

  const handleImageResponse = (response: ImagePickerResponse) => {
    if (response.didCancel || response.errorMessage) {
      return;
    }

    if (response.assets) {
      const newImages: ImageData[] = response.assets.map((asset) => ({
        uri: asset.uri || '',
        type: asset.type || 'image/jpeg',
        name: asset.fileName || `image_${Date.now()}.jpg`,
        size: asset.fileSize || 0,
      }));

      const updatedImages = [...selectedImages, ...newImages];
      
      if (updatedImages.length > maxImages) {
        Alert.alert(
          'Too Many Images',
          `You can only select up to ${maxImages} images.`,
          [{ text: 'OK' }]
        );
        return;
      }

      setSelectedImages(updatedImages);
      onImagesSelected(updatedImages);
    }
  };

  const removeImage = (index: number) => {
    const updatedImages = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(updatedImages);
    onImagesSelected(updatedImages);
  };

  const canAddMore = selectedImages.length < maxImages;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Product Images</Text>
      <Text style={styles.subtitle}>
        Add up to {maxImages} high-quality images ({selectedImages.length}/{maxImages})
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageList}>
        {/* Selected Images */}
        {selectedImages.map((image, index) => (
          <View key={index} style={styles.imageContainer}>
            <Image source={{ uri: image.uri }} style={styles.selectedImage} />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeImage(index)}
              activeOpacity={0.7}
            >
              <Icon name="close" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ))}

        {/* Add Image Button */}
        {canAddMore && (
          <TouchableOpacity
            style={styles.addImageButton}
            onPress={showImagePicker}
            activeOpacity={0.7}
          >
            <Icon name="add-a-photo" size={32} color="#757575" />
            <Text style={styles.addImageText}>Add Image</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Image Guidelines */}
      <View style={styles.guidelines}>
        <Text style={styles.guidelinesTitle}>📸 Photo Guidelines</Text>
        <View style={styles.guidelinesList}>
          <View style={styles.guidelineItem}>
            <Icon name="check-circle" size={16} color="#4CAF50" />
            <Text style={styles.guidelineText}>Use good natural lighting</Text>
          </View>
          <View style={styles.guidelineItem}>
            <Icon name="check-circle" size={16} color="#4CAF50" />
            <Text style={styles.guidelineText}>Capture different angles</Text>
          </View>
          <View style={styles.guidelineItem}>
            <Icon name="check-circle" size={16} color="#4CAF50" />
            <Text style={styles.guidelineText}>Show product clearly</Text>
          </View>
          <View style={styles.guidelineItem}>
            <Icon name="check-circle" size={16} color="#4CAF50" />
            <Text style={styles.guidelineText}>Avoid blurry images</Text>
          </View>
        </View>
      </View>

      {/* Quick Tips */}
      {selectedImages.length === 0 && (
        <View style={styles.emptyState}>
          <Icon name="photo-camera" size={48} color="#E0E0E0" />
          <Text style={styles.emptyStateTitle}>No images selected</Text>
          <Text style={styles.emptyStateText}>
            Tap "Add Image" to start uploading product photos
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 16,
  },
  imageList: {
    marginBottom: 16,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  selectedImage: {
    width: imageSize,
    height: imageSize,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#F44336',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addImageButton: {
    width: imageSize,
    height: imageSize,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  addImageText: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
    textAlign: 'center',
  },
  guidelines: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  guidelinesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  guidelinesList: {
    gap: 6,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guidelineText: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#757575',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'center',
  },
});

export default ImageUploader;