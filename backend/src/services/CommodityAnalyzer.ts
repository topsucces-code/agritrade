import { GoogleVisionClient } from '@google-cloud/vision';
import { 
  QualityMetrics, 
  QualityGrade, 
  PriceEstimate, 
  IProduct 
} from '../types';

// Product metadata for analysis
export interface ProductMetadata {
  productType: string;
  farmerId: string;
  location: {
    latitude: number;
    longitude: number;
  };
  harvestDate: Date;
  storageConditions?: {
    temperature: number;
    humidity: number;
    duration: number;
  };
  certifications?: string[];
}

// Vision API analysis result structure
export interface VisionAnalysisResult {
  objects: Array<{
    name: string;
    confidence: number;
    boundingBox?: any;
  }>;
  colors: Array<{
    red: number;
    green: number;
    blue: number;
    score: number;
    pixelFraction?: number;
  }>;
  labels: Array<{
    description: string;
    score: number;
  }>;
  textAnnotations?: Array<{
    description: string;
    boundingPoly?: any;
  }>;
  faceAnnotations?: any[];
  imageProperties?: {
    dominantColors?: any;
  };
}

// Quality analysis result
export interface QualityResult {
  overallScore: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  confidence: number;
  detailedMetrics: QualityMetrics;
  recommendations: Recommendation[];
  priceEstimate?: number;
  marketPosition?: {
    percentile: number;
    competitive: boolean;
  };
}

export interface Recommendation {
  type: 'improvement' | 'storage' | 'processing' | 'marketing';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expectedImpact: string;
  timeframe: string;
}

/**
 * Abstract base class for commodity-specific quality analyzers
 */
export abstract class CommodityAnalyzer {
  protected googleVisionClient: GoogleVisionClient;
  protected commodityType: string;

  constructor(visionClient: GoogleVisionClient, commodityType: string) {
    this.googleVisionClient = visionClient;
    this.commodityType = commodityType;
  }

  /**
   * Main analysis method that orchestrates the quality assessment
   */
  async analyzeQuality(imageData: Buffer, metadata: ProductMetadata): Promise<QualityResult> {
    try {
      // Step 1: Get Google Vision API results
      const visionResults = await this.analyzeWithVision(imageData);
      
      // Step 2: Extract commodity-specific metrics
      const metrics = await this.extractMetrics(visionResults, metadata);
      
      // Step 3: Calculate overall score and grade
      const overallScore = this.calculateWeightedScore(metrics);
      const grade = this.calculateGrade(metrics);
      const confidence = this.calculateConfidence(visionResults, metrics);
      
      // Step 4: Generate recommendations
      const recommendations = this.generateRecommendations({ 
        overallScore, 
        grade, 
        confidence, 
        detailedMetrics: metrics,
        recommendations: [] 
      });
      
      return {
        overallScore,
        grade,
        confidence,
        detailedMetrics: metrics,
        recommendations
      };
    } catch (error) {
      throw new Error(`Quality analysis failed for ${this.commodityType}: ${error.message}`);
    }
  }

  /**
   * Analyze image using Google Vision API
   */
  protected async analyzeWithVision(imageData: Buffer): Promise<VisionAnalysisResult> {
    const [result] = await this.googleVisionClient.annotateImage({
      image: { content: imageData },
      features: [
        { type: 'OBJECT_LOCALIZATION', maxResults: 50 },
        { type: 'IMAGE_PROPERTIES' },
        { type: 'LABEL_DETECTION', maxResults: 50 },
        { type: 'TEXT_DETECTION' }
      ]
    });

    return {
      objects: result.localizedObjectAnnotations || [],
      colors: result.imagePropertiesAnnotation?.dominantColors?.colors || [],
      labels: result.labelAnnotations || [],
      textAnnotations: result.textAnnotations || [],
      faceAnnotations: result.faceAnnotations || [],
      imageProperties: result.imagePropertiesAnnotation || {}
    };
  }

  /**
   * Abstract methods to be implemented by specific commodity analyzers
   */
  abstract extractMetrics(visionResults: VisionAnalysisResult, metadata: ProductMetadata): Promise<QualityMetrics>;
  abstract calculateGrade(metrics: QualityMetrics): 'A+' | 'A' | 'B' | 'C' | 'D';
  abstract generateRecommendations(analysis: QualityResult): Recommendation[];

  /**
   * Calculate weighted score based on commodity-specific weights
   */
  protected abstract calculateWeightedScore(metrics: QualityMetrics): number;

  /**
   * Calculate confidence score based on vision results and metrics
   */
  protected calculateConfidence(visionResults: VisionAnalysisResult, metrics: QualityMetrics): number {
    // Base confidence on image quality and detection reliability
    const objectConfidence = visionResults.objects.reduce(
      (avg, obj) => avg + obj.confidence, 0
    ) / Math.max(visionResults.objects.length, 1);

    const labelConfidence = visionResults.labels.reduce(
      (avg, label) => avg + label.score, 0
    ) / Math.max(visionResults.labels.length, 1);

    const colorAnalysisQuality = visionResults.colors.length > 0 ? 0.8 : 0.4;
    
    // Combine different confidence factors
    const overallConfidence = (
      objectConfidence * 0.4 +
      labelConfidence * 0.3 +
      colorAnalysisQuality * 0.2 +
      metrics.analysisConfidence * 0.1
    );

    return Math.round(overallConfidence * 100) / 100;
  }

  /**
   * Validate image quality before analysis
   */
  protected validateImageQuality(visionResults: VisionAnalysisResult): boolean {
    // Check if image has sufficient objects detected
    if (visionResults.objects.length === 0) {
      return false;
    }

    // Check if primary objects have good confidence
    const primaryObjects = visionResults.objects.filter(obj => 
      obj.confidence > 0.5
    );

    return primaryObjects.length > 0;
  }

  /**
   * Extract color-based metrics
   */
  protected analyzeColors(colors: VisionAnalysisResult['colors']): {
    uniformity: number;
    dominantColors: string[];
    brightness: number;
  } {
    if (colors.length === 0) {
      return { uniformity: 0, dominantColors: [], brightness: 0 };
    }

    // Calculate color uniformity
    const totalScore = colors.reduce((sum, color) => sum + color.score, 0);
    const uniformity = totalScore / colors.length;

    // Extract dominant colors
    const dominantColors = colors
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(color => `rgb(${color.red}, ${color.green}, ${color.blue})`);

    // Calculate brightness
    const brightness = colors.reduce((avg, color) => {
      const luminance = 0.299 * color.red + 0.587 * color.green + 0.114 * color.blue;
      return avg + luminance;
    }, 0) / colors.length / 255;

    return {
      uniformity: Math.round(uniformity * 100) / 100,
      dominantColors,
      brightness: Math.round(brightness * 100) / 100
    };
  }

  /**
   * Detect and count defects based on objects and labels
   */
  protected detectDefects(visionResults: VisionAnalysisResult): {
    count: number;
    types: string[];
    severity: 'low' | 'medium' | 'high';
  } {
    const defectKeywords = [
      'damage', 'crack', 'hole', 'spot', 'discoloration', 
      'mold', 'insect', 'foreign', 'broken', 'split'
    ];

    const detectedDefects = visionResults.labels.filter(label =>
      defectKeywords.some(keyword => 
        label.description.toLowerCase().includes(keyword)
      )
    );

    const defectCount = detectedDefects.length;
    const defectTypes = detectedDefects.map(defect => defect.description);

    // Determine severity based on count and confidence
    let severity: 'low' | 'medium' | 'high' = 'low';
    if (defectCount > 5 || detectedDefects.some(d => d.score > 0.8)) {
      severity = 'high';
    } else if (defectCount > 2 || detectedDefects.some(d => d.score > 0.6)) {
      severity = 'medium';
    }

    return {
      count: defectCount,
      types: defectTypes,
      severity
    };
  }

  /**
   * Estimate moisture content based on visual cues
   */
  protected estimateMoisture(visionResults: VisionAnalysisResult, metadata: ProductMetadata): {
    estimated: number;
    confidence: number;
    recommendation: string;
  } {
    // This is a simplified estimation based on visual cues
    // In a real implementation, this would use more sophisticated algorithms
    
    const colorAnalysis = this.analyzeColors(visionResults.colors);
    const storageConditions = metadata.storageConditions;
    
    // Base estimation on color brightness and storage conditions
    let moistureEstimate = 12; // Default moisture content
    let confidence = 0.6;

    if (colorAnalysis.brightness < 0.3) {
      moistureEstimate += 2; // Darker colors might indicate higher moisture
      confidence += 0.1;
    }

    if (storageConditions) {
      if (storageConditions.humidity > 70) {
        moistureEstimate += 1;
        confidence += 0.1;
      }
      if (storageConditions.duration > 30) {
        moistureEstimate -= 1; // Longer storage might reduce moisture
        confidence += 0.1;
      }
    }

    let recommendation = 'Moisture content appears normal';
    if (moistureEstimate > 14) {
      recommendation = 'Consider additional drying to reduce moisture content';
    } else if (moistureEstimate < 8) {
      recommendation = 'Moisture content might be too low, check storage conditions';
    }

    return {
      estimated: Math.round(moistureEstimate * 10) / 10,
      confidence: Math.min(confidence, 1),
      recommendation
    };
  }
}

export default CommodityAnalyzer;