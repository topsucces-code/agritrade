import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '@/store';
import { 
  startAnalysis, 
  updateAnalysisProgress, 
  clearCurrentAnalysis 
} from '@/store/slices/qualityAnalysisSlice';
import { ImageData, ProductMetadata, AnalysisSession } from '@/types';
import QualityIndicator from '@/components/product/QualityIndicator';
import ImageUploader from '@/components/product/ImageUploader';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface QualityAnalysisModalProps {
  visible: boolean;
  onClose: () => void;
  productId?: string;
  initialImages?: ImageData[];
}

const QualityAnalysisModal: React.FC<QualityAnalysisModalProps> = ({
  visible,
  onClose,
  productId,
  initialImages = [],
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { currentAnalysis, isAnalyzing, progress } = useSelector(
    (state: RootState) => state.qualityAnalysis
  );

  const [step, setStep] = useState<'upload' | 'metadata' | 'analyzing' | 'results'>('upload');
  const [images, setImages] = useState<ImageData[]>(initialImages);
  const [metadata, setMetadata] = useState<ProductMetadata>({
    category: '',
    subcategory: '',
    estimatedQuantity: 0,
    harvestDate: new Date(),
  });
  const [analysisResults, setAnalysisResults] = useState<any>(null);

  useEffect(() => {
    if (isAnalyzing && progress < 100) {
      setStep('analyzing');
    } else if (progress === 100 && currentAnalysis?.status === 'completed') {
      setStep('results');
      // Get the analysis results
      // This would come from the Redux store in a real implementation
    }
  }, [isAnalyzing, progress, currentAnalysis]);

  const handleClose = () => {
    if (isAnalyzing) {
      Alert.alert(
        'Analysis in Progress',
        'Analysis is currently running. Are you sure you want to cancel?',
        [
          { text: 'Continue', style: 'cancel' },
          { 
            text: 'Cancel Analysis', 
            style: 'destructive',
            onPress: () => {
              dispatch(clearCurrentAnalysis());
              onClose();
            }
          },
        ]
      );
    } else {
      onClose();
    }
  };

  const handleImagesSelected = (selectedImages: ImageData[]) => {
    setImages(selectedImages);
    if (selectedImages.length > 0) {
      setStep('metadata');
    }
  };

  const handleStartAnalysis = async () => {
    if (images.length === 0) {
      Alert.alert('Error', 'Please select at least one image to analyze.');
      return;
    }

    if (!metadata.category) {
      Alert.alert('Error', 'Please select a product category.');
      return;
    }

    try {
      setStep('analyzing');
      await dispatch(startAnalysis({ images, metadata })).unwrap();
    } catch (error) {
      Alert.alert('Error', 'Failed to start analysis. Please try again.');
      setStep('metadata');
    }
  };

  const renderUploadStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Icon name="camera-alt" size={32} color="#2E7D32" />
        <Text style={styles.stepTitle}>Upload Product Images</Text>
        <Text style={styles.stepDescription}>
          Take or select high-quality photos of your agricultural product for AI analysis
        </Text>
      </View>

      <ImageUploader
        onImagesSelected={handleImagesSelected}
        maxImages={5}
        aspectRatio={4/3}
        quality={0.8}
      />

      <View style={styles.tipBox}>
        <Icon name="lightbulb-outline" size={20} color="#FF8F00" />
        <Text style={styles.tipText}>
          Tip: Use good lighting and capture different angles for best results
        </Text>
      </View>
    </View>
  );

  const renderMetadataStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Icon name="info-outline" size={32} color="#2E7D32" />
        <Text style={styles.stepTitle}>Product Information</Text>
        <Text style={styles.stepDescription}>
          Provide additional details to improve analysis accuracy
        </Text>
      </View>

      <ScrollView style={styles.metadataForm}>
        {/* Category Selection */}
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Product Category *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['Coffee', 'Cocoa', 'Maize', 'Rice', 'Beans', 'Cassava'].map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  metadata.category === category && styles.categoryButtonSelected
                ]}
                onPress={() => setMetadata({ ...metadata, category })}
              >
                <Text style={[
                  styles.categoryButtonText,
                  metadata.category === category && styles.categoryButtonTextSelected
                ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Subcategory */}
        {metadata.category && (
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Variety (Optional)</Text>
            <TouchableOpacity style={styles.input}>
              <Text style={styles.inputPlaceholder}>Select variety</Text>
              <Icon name="arrow-drop-down" size={24} color="#757575" />
            </TouchableOpacity>
          </View>
        )}

        {/* Estimated Quantity */}
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Estimated Quantity (Optional)</Text>
          <View style={styles.quantityContainer}>
            <TouchableOpacity style={[styles.input, { flex: 1 }]}>
              <Text style={styles.inputPlaceholder}>Enter quantity</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.input, { width: 100, marginLeft: 8 }]}>
              <Text style={styles.inputPlaceholder}>Unit</Text>
              <Icon name="arrow-drop-down" size={24} color="#757575" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Harvest Date */}
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Harvest Date (Optional)</Text>
          <TouchableOpacity style={styles.input}>
            <Text style={styles.inputPlaceholder}>Select date</Text>
            <Icon name="date-range" size={24} color="#757575" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setStep('upload')}
        >
          <Text style={styles.secondaryButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleStartAnalysis}
        >
          <Text style={styles.primaryButtonText}>Start Analysis</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAnalyzingStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Icon name="analytics" size={32} color="#2E7D32" />
        <Text style={styles.stepTitle}>AI Analysis in Progress</Text>
        <Text style={styles.stepDescription}>
          Our AI is analyzing your product quality. This may take a few moments.
        </Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>{Math.round(progress)}% Complete</Text>
      </View>

      <View style={styles.analysisSteps}>
        <View style={[styles.analysisStep, progress > 20 && styles.analysisStepComplete]}>
          <Icon name="upload" size={20} color={progress > 20 ? "#4CAF50" : "#757575"} />
          <Text style={styles.analysisStepText}>Uploading images</Text>
        </View>
        <View style={[styles.analysisStep, progress > 40 && styles.analysisStepComplete]}>
          <Icon name="visibility" size={20} color={progress > 40 ? "#4CAF50" : "#757575"} />
          <Text style={styles.analysisStepText}>Processing with Google Vision</Text>
        </View>
        <View style={[styles.analysisStep, progress > 70 && styles.analysisStepComplete]}>
          <Icon name="psychology" size={20} color={progress > 70 ? "#4CAF50" : "#757575"} />
          <Text style={styles.analysisStepText}>AI quality assessment</Text>
        </View>
        <View style={[styles.analysisStep, progress > 90 && styles.analysisStepComplete]}>
          <Icon name="calculate" size={20} color={progress > 90 ? "#4CAF50" : "#757575"} />
          <Text style={styles.analysisStepText}>Generating recommendations</Text>
        </View>
      </View>
    </View>
  );

  const renderResultsStep = () => (
    <ScrollView style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Icon name="check-circle" size={32} color="#4CAF50" />
        <Text style={styles.stepTitle}>Analysis Complete!</Text>
        <Text style={styles.stepDescription}>
          Here are your quality analysis results and recommendations
        </Text>
      </View>

      {/* Mock Results - In real implementation, this would come from Redux store */}
      <View style={styles.resultCard}>
        <Text style={styles.resultCardTitle}>Overall Quality Score</Text>
        <View style={styles.qualityScoreContainer}>
          <QualityIndicator score={8.2} size="large" showLabel={true} animated={true} />
        </View>
      </View>

      <View style={styles.resultCard}>
        <Text style={styles.resultCardTitle}>Quality Breakdown</Text>
        <View style={styles.qualityBreakdown}>
          <View style={styles.qualityMetric}>
            <Text style={styles.qualityMetricLabel}>Color</Text>
            <View style={styles.qualityMetricBar}>
              <View style={[styles.qualityMetricFill, { width: '85%' }]} />
            </View>
            <Text style={styles.qualityMetricValue}>8.5</Text>
          </View>
          <View style={styles.qualityMetric}>
            <Text style={styles.qualityMetricLabel}>Size</Text>
            <View style={styles.qualityMetricBar}>
              <View style={[styles.qualityMetricFill, { width: '78%' }]} />
            </View>
            <Text style={styles.qualityMetricValue}>7.8</Text>
          </View>
          <View style={styles.qualityMetric}>
            <Text style={styles.qualityMetricLabel}>Texture</Text>
            <View style={styles.qualityMetricBar}>
              <View style={[styles.qualityMetricFill, { width: '82%' }]} />
            </View>
            <Text style={styles.qualityMetricValue}>8.2</Text>
          </View>
        </View>
      </View>

      <View style={styles.resultCard}>
        <Text style={styles.resultCardTitle}>Price Estimation</Text>
        <View style={styles.priceEstimation}>
          <Text style={styles.estimatedPrice}>$1,200 - $1,400</Text>
          <Text style={styles.priceUnit}>per tonne</Text>
          <Text style={styles.priceNote}>
            Based on current market conditions and quality score
          </Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleClose}
        >
          <Text style={styles.secondaryButtonText}>Close</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            // Navigate to recommendations screen
            handleClose();
          }}
        >
          <Text style={styles.primaryButtonText}>View Recommendations</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderStepContent = () => {
    switch (step) {
      case 'upload':
        return renderUploadStep();
      case 'metadata':
        return renderMetadataStep();
      case 'analyzing':
        return renderAnalyzingStep();
      case 'results':
        return renderResultsStep();
      default:
        return renderUploadStep();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Icon name="close" size={24} color="#757575" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quality Analysis</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressIndicator}>
          {['upload', 'metadata', 'analyzing', 'results'].map((stepName, index) => {
            const currentStepIndex = ['upload', 'metadata', 'analyzing', 'results'].indexOf(step);
            const isActive = index <= currentStepIndex;
            const isCompleted = index < currentStepIndex;

            return (
              <View key={stepName} style={styles.progressStep}>
                <View style={[
                  styles.progressStepCircle,
                  isActive && styles.progressStepCircleActive,
                  isCompleted && styles.progressStepCircleCompleted
                ]}>
                  {isCompleted ? (
                    <Icon name="check" size={16} color="#FFFFFF" />
                  ) : (
                    <Text style={[
                      styles.progressStepNumber,
                      isActive && styles.progressStepNumberActive
                    ]}>
                      {index + 1}
                    </Text>
                  )}
                </View>
                {index < 3 && (
                  <View style={[
                    styles.progressStepLine,
                    isCompleted && styles.progressStepLineCompleted
                  ]} />
                )}
              </View>
            );
          })}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {renderStepContent()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
  },
  placeholder: {
    width: 40,
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressStepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressStepCircleActive: {
    backgroundColor: '#2E7D32',
  },
  progressStepCircleCompleted: {
    backgroundColor: '#4CAF50',
  },
  progressStepNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#757575',
  },
  progressStepNumberActive: {
    color: '#FFFFFF',
  },
  progressStepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginLeft: 8,
  },
  progressStepLineCompleted: {
    backgroundColor: '#4CAF50',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    padding: 20,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212121',
    marginTop: 12,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 20,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  tipText: {
    fontSize: 12,
    color: '#E65100',
    marginLeft: 8,
    flex: 1,
  },
  metadataForm: {
    flex: 1,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 8,
  },
  categoryButtonSelected: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#757575',
  },
  categoryButtonTextSelected: {
    color: '#FFFFFF',
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  inputPlaceholder: {
    fontSize: 14,
    color: '#757575',
  },
  quantityContainer: {
    flexDirection: 'row',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#757575',
  },
  progressContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  progressBar: {
    width: screenWidth - 80,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2E7D32',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  analysisSteps: {
    marginTop: 32,
  },
  analysisStep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  analysisStepComplete: {
    opacity: 1,
  },
  analysisStepText: {
    fontSize: 14,
    color: '#757575',
    marginLeft: 12,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  resultCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },
  qualityScoreContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  qualityBreakdown: {
    gap: 12,
  },
  qualityMetric: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qualityMetricLabel: {
    fontSize: 14,
    color: '#757575',
    width: 60,
  },
  qualityMetricBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginHorizontal: 12,
  },
  qualityMetricFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  qualityMetricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    width: 30,
    textAlign: 'right',
  },
  priceEstimation: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  estimatedPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2E7D32',
  },
  priceUnit: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4,
  },
  priceNote: {
    fontSize: 12,
    color: '#757575',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default QualityAnalysisModal;