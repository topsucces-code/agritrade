import { GoogleVisionClient } from '@google-cloud/vision';
import CommodityAnalyzer, { 
  VisionAnalysisResult, 
  ProductMetadata, 
  QualityResult, 
  Recommendation 
} from './CommodityAnalyzer';
import { QualityMetrics } from '../types';
import { ObjectId } from 'mongodb';

/**
 * Cocoa-specific quality metrics interface
 */
interface CocoaQualityMetrics extends QualityMetrics {
  beanSizeUniformity: number;
  colorConsistency: number;
  moistureContent: number;
  defectCount: number;
  shellToBeanRatio: number;
  beanCount: number;
  averageBeanSize: number;
  colorProfile: ColorProfile;
  defectTypes: string[];
  visualQualityIndicators: VisualQualityIndicators;
}

interface ColorProfile {
  dominantHue: string;
  saturation: number;
  brightness: number;
  uniformityIndex: number;
}

interface VisualQualityIndicators {
  surfaceQuality: number;
  shapeRegularity: number;
  textureConsistency: number;
  contamination: number;
}

interface DetectedBean {
  boundingBox: any;
  confidence: number;
  size: number;
  position: { x: number; y: number };
}

/**
 * Specialized analyzer for cocoa beans
 * Implements industry-standard cocoa quality assessment criteria
 */
export class CocoaAnalyzer extends CommodityAnalyzer {
  private readonly QUALITY_WEIGHTS = {
    beanSizeUniformity: 0.25,
    colorConsistency: 0.20,
    moistureContent: 0.20,
    defectCount: 0.20,
    shellToBeanRatio: 0.15
  };

  constructor(visionClient: GoogleVisionClient) {
    super(visionClient, 'cocoa');
  }

  /**
   * Detect cocoa beans in the image
   */
  private detectCocoaBeans(objects: VisionAnalysisResult['objects']): DetectedBean[] {
    const cocoaBeans = objects.filter(obj => 
      obj.name.toLowerCase().includes('cocoa') || 
      obj.name.toLowerCase().includes('bean') ||
      obj.name.toLowerCase().includes('seed') ||
      obj.name.toLowerCase().includes('cacao')
    );

    return cocoaBeans.map(bean => {
      let size = 0.1; // Default size
      let position = { x: 0.5, y: 0.5 }; // Default position

      if (bean.boundingBox && bean.boundingBox.normalizedVertices) {
        const vertices = bean.boundingBox.normalizedVertices;
        const width = vertices[2]?.x - vertices[0]?.x || 0;
        const height = vertices[2]?.y - vertices[0]?.y || 0;
        size = width * height;
        position = {
          x: (vertices[0]?.x + vertices[2]?.x) / 2 || 0.5,
          y: (vertices[0]?.y + vertices[2]?.y) / 2 || 0.5
        };
      }

      return {
        boundingBox: bean.boundingBox,
        confidence: bean.confidence,
        size,
        position
      };
    });
  }

  /**
   * Extract cocoa-specific quality metrics from vision analysis
   */
  async extractMetrics(visionResults: VisionAnalysisResult, metadata: ProductMetadata): Promise<QualityMetrics> {
    // Validate image quality first
    if (!this.validateImageQuality(visionResults)) {
      throw new Error('Image quality too low for cocoa analysis');
    }

    // Extract cocoa-specific metrics
    const beanSizeUniformity = this.assessBeanSize(visionResults);
    const colorConsistency = this.assessColor(visionResults);
    const moistureAnalysis = this.estimateMoisture(visionResults, metadata);
    const defectAnalysis = this.detectDefects(visionResults);
    const shellToBeanRatio = this.calculateShellRatio(visionResults);

    // Calculate processing quality indicators
    const overallAppearance = this.assessOverallAppearance(visionResults);
    const processingQuality = this.assessProcessingQuality(visionResults, metadata);
    const storageCondition = this.assessStorageCondition(visionResults, metadata);

    return {
      // Cocoa-specific metrics
      beanSizeUniformity,
      colorConsistency,
      moistureContent: moistureAnalysis.estimated,
      defectCount: defectAnalysis.count,
      shellToBeanRatio,

      // Common metrics
      overallAppearance,
      processingQuality,
      storageCondition,

      // Analysis metadata
      analysisConfidence: moistureAnalysis.confidence,
      imageQuality: this.calculateImageQuality(visionResults),
      processingTime: Date.now() // This would be set by the calling service
    };
  }

  /**
   * Assess bean size uniformity for cocoa
   */
  private assessBeanSize(visionResults: VisionAnalysisResult): number {
    const cocoaBeans = visionResults.objects.filter(obj => 
      obj.name.toLowerCase().includes('cocoa') || 
      obj.name.toLowerCase().includes('bean') ||
      obj.name.toLowerCase().includes('seed')
    );

    if (cocoaBeans.length === 0) {
      return 40; // Default score if no beans detected
    }

    // Calculate size variance based on bounding boxes
    const sizes = cocoaBeans.map(bean => {
      if (bean.boundingBox) {
        const width = bean.boundingBox.normalizedVertices?.[2]?.x - bean.boundingBox.normalizedVertices?.[0]?.x || 0;
        const height = bean.boundingBox.normalizedVertices?.[2]?.y - bean.boundingBox.normalizedVertices?.[0]?.y || 0;
        return width * height;
      }
      return 0.1; // Default size
    });

    // Calculate coefficient of variation for uniformity
    const meanSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    const variance = sizes.reduce((sum, size) => sum + Math.pow(size - meanSize, 2), 0) / sizes.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / meanSize;

    // Convert to score (lower variation = higher score)
    const uniformityScore = Math.max(0, 100 - (coefficientOfVariation * 200));
    
    return Math.round(uniformityScore * 10) / 10;
  }

  /**
   * Assess color consistency for cocoa beans
   */
  private assessColor(visionResults: VisionAnalysisResult): number {
    const colorAnalysis = this.analyzeColors(visionResults.colors);
    
    // Ideal cocoa bean colors (brown spectrum)
    const idealBrownRange = {
      red: { min: 100, max: 160 },
      green: { min: 60, max: 120 },
      blue: { min: 30, max: 80 }
    };

    let colorScore = 0;
    let validColors = 0;

    visionResults.colors.forEach(color => {
      // Check if color falls within ideal brown range
      const inRedRange = color.red >= idealBrownRange.red.min && color.red <= idealBrownRange.red.max;
      const inGreenRange = color.green >= idealBrownRange.green.min && color.green <= idealBrownRange.green.max;
      const inBlueRange = color.blue >= idealBrownRange.blue.min && color.blue <= idealBrownRange.blue.max;

      if (inRedRange && inGreenRange && inBlueRange) {
        colorScore += color.score * 100;
        validColors++;
      }
    });

    if (validColors === 0) {
      return 30; // Poor color consistency
    }

    const averageColorScore = colorScore / validColors;
    
    // Factor in uniformity
    const finalScore = averageColorScore * colorAnalysis.uniformity;
    
    return Math.round(finalScore * 10) / 10;
  }

  /**
   * Calculate shell-to-bean ratio estimation
   */
  private calculateShellRatio(visionResults: VisionAnalysisResult): number {
    // Look for shell-related objects or fragments
    const shellIndicators = visionResults.objects.filter(obj =>
      obj.name.toLowerCase().includes('shell') ||
      obj.name.toLowerCase().includes('husk') ||
      obj.name.toLowerCase().includes('fragment')
    );

    const totalObjects = visionResults.objects.length;
    
    if (totalObjects === 0) {
      return 85; // Default good ratio
    }

    const shellRatio = (shellIndicators.length / totalObjects) * 100;
    
    // Good cocoa should have low shell content (< 12%)
    let score = 100;
    if (shellRatio > 12) {
      score = Math.max(20, 100 - ((shellRatio - 12) * 5));
    } else if (shellRatio > 8) {
      score = 90 - ((shellRatio - 8) * 2.5);
    }

    return Math.round(score * 10) / 10;
  }

  /**
   * Assess overall appearance quality
   */
  private assessOverallAppearance(visionResults: VisionAnalysisResult): number {
    // Check for positive quality indicators
    const qualityIndicators = visionResults.labels.filter(label =>
      ['clean', 'uniform', 'consistent', 'quality', 'good'].some(keyword =>
        label.description.toLowerCase().includes(keyword)
      )
    );

    // Check for negative quality indicators
    const negativeIndicators = visionResults.labels.filter(label =>
      ['dirty', 'damaged', 'poor', 'inconsistent', 'mixed'].some(keyword =>
        label.description.toLowerCase().includes(keyword)
      )
    );

    const positiveScore = qualityIndicators.reduce((sum, indicator) => sum + indicator.score, 0) * 50;
    const negativeScore = negativeIndicators.reduce((sum, indicator) => sum + indicator.score, 0) * 30;

    const appearanceScore = Math.max(40, Math.min(100, 70 + positiveScore - negativeScore));
    
    return Math.round(appearanceScore * 10) / 10;
  }

  /**
   * Assess processing quality based on visual cues
   */
  private assessProcessingQuality(visionResults: VisionAnalysisResult, metadata: ProductMetadata): number {
    let processingScore = 70; // Base score

    // Check fermentation indicators (color development)
    const colorAnalysis = this.analyzeColors(visionResults.colors);
    if (colorAnalysis.brightness >= 0.3 && colorAnalysis.brightness <= 0.6) {
      processingScore += 15; // Good fermentation color
    }

    // Check drying indicators
    const defectAnalysis = this.detectDefects(visionResults);
    if (defectAnalysis.severity === 'low') {
      processingScore += 10; // Good drying
    } else if (defectAnalysis.severity === 'high') {
      processingScore -= 20; // Poor drying
    }

    // Consider harvest timing
    if (metadata.harvestDate) {
      const daysSinceHarvest = (Date.now() - metadata.harvestDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceHarvest > 14) {
        processingScore -= 5; // Prefer fresher beans
      }
    }

    return Math.round(Math.max(20, Math.min(100, processingScore)) * 10) / 10;
  }

  /**
   * Assess storage condition quality
   */
  private assessStorageCondition(visionResults: VisionAnalysisResult, metadata: ProductMetadata): number {
    let storageScore = 80; // Base score

    // Check for storage-related defects
    const storageDefects = visionResults.labels.filter(label =>
      ['mold', 'moisture', 'insect', 'contamination'].some(keyword =>
        label.description.toLowerCase().includes(keyword)
      )
    );

    storageScore -= storageDefects.length * 15;

    // Factor in storage conditions if available
    if (metadata.storageConditions) {
      const { temperature, humidity, duration } = metadata.storageConditions;
      
      // Ideal storage: 18-20°C, 60-65% humidity
      if (temperature >= 18 && temperature <= 20) {
        storageScore += 5;
      } else if (temperature > 25 || temperature < 15) {
        storageScore -= 10;
      }

      if (humidity >= 60 && humidity <= 65) {
        storageScore += 5;
      } else if (humidity > 70 || humidity < 55) {
        storageScore -= 10;
      }

      // Duration factor
      if (duration > 90) {
        storageScore -= 5; // Long storage periods
      }
    }

    return Math.round(Math.max(20, Math.min(100, storageScore)) * 10) / 10;
  }

  /**
   * Calculate image quality score
   */
  private calculateImageQuality(visionResults: VisionAnalysisResult): number {
    const objectCount = visionResults.objects.length;
    const labelCount = visionResults.labels.length;
    const colorCount = visionResults.colors.length;

    // Base score on detection richness
    let qualityScore = 50;

    if (objectCount > 5) qualityScore += 20;
    if (labelCount > 10) qualityScore += 15;
    if (colorCount > 3) qualityScore += 15;

    // Check average confidence
    const avgObjectConfidence = visionResults.objects.reduce(
      (sum, obj) => sum + obj.confidence, 0
    ) / Math.max(objectCount, 1);

    qualityScore += avgObjectConfidence * 30;

    return Math.round(Math.max(30, Math.min(100, qualityScore)) * 10) / 10;
  }

  /**
   * Calculate weighted score using cocoa industry standards
   */
  protected calculateWeightedScore(metrics: CocoaQualityMetrics): number {
    const weights = {
      beanSizeUniformity: 0.25,
      colorConsistency: 0.20,
      moistureContent: 0.20,
      defectCount: 0.20,
      shellToBeanRatio: 0.15
    };

    // Convert defect count to score (inverse relationship)
    const defectScore = Math.max(0, 100 - (metrics.defectCount * 10));

    const weightedScore = 
      (metrics.beanSizeUniformity * weights.beanSizeUniformity) +
      (metrics.colorConsistency * weights.colorConsistency) +
      (metrics.moistureContent * weights.moistureContent) +
      (defectScore * weights.defectCount) +
      (metrics.shellToBeanRatio * weights.shellToBeanRatio);

    return Math.round(weightedScore * 10) / 10;
  }

  /**
   * Calculate grade based on overall score
   */
  calculateGrade(metrics: QualityMetrics): 'A+' | 'A' | 'B' | 'C' | 'D' {
    const score = this.calculateWeightedScore(metrics as CocoaQualityMetrics);

    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  }

  /**
   * Generate cocoa-specific recommendations
   */
  generateRecommendations(analysis: QualityResult): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const metrics = analysis.detailedMetrics as CocoaQualityMetrics;

    // Bean size uniformity recommendations
    if (metrics.beanSizeUniformity < 70) {
      recommendations.push({
        type: 'processing',
        priority: 'high',
        title: 'Improve Bean Size Uniformity',
        description: 'Consider better sorting and grading during processing to achieve more uniform bean sizes.',
        expectedImpact: 'Can increase price by 8-12%',
        timeframe: 'Next harvest cycle'
      });
    }

    // Color consistency recommendations
    if (metrics.colorConsistency < 60) {
      recommendations.push({
        type: 'processing',
        priority: 'high',
        title: 'Optimize Fermentation Process',
        description: 'Improve fermentation timing and conditions to achieve better color consistency.',
        expectedImpact: 'Can improve grade by one level',
        timeframe: '2-3 weeks'
      });
    }

    // Moisture content recommendations
    if (metrics.moistureContent > 7.5) {
      recommendations.push({
        type: 'storage',
        priority: 'medium',
        title: 'Additional Drying Required',
        description: 'Extend drying period or improve drying conditions to reduce moisture content below 7%.',
        expectedImpact: 'Prevents quality deterioration',
        timeframe: '3-5 days'
      });
    }

    // Defect recommendations
    if (metrics.defectCount > 3) {
      recommendations.push({
        type: 'improvement',
        priority: 'high',
        title: 'Reduce Defects',
        description: 'Implement better quality control during harvesting and processing to minimize defects.',
        expectedImpact: 'Can increase price by 15-20%',
        timeframe: 'Immediate action needed'
      });
    }

    // Shell ratio recommendations
    if (metrics.shellToBeanRatio < 80) {
      recommendations.push({
        type: 'processing',
        priority: 'medium',
        title: 'Improve Winnowing Process',
        description: 'Enhance shell removal process to achieve better shell-to-bean ratio.',
        expectedImpact: 'Improves buyer acceptance',
        timeframe: '1-2 weeks'
      });
    }

    // Grade-based recommendations
    if (analysis.grade === 'C' || analysis.grade === 'D') {
      recommendations.push({
        type: 'marketing',
        priority: 'low',
        title: 'Consider Processing Options',
        description: 'Current quality may be better suited for processing rather than premium markets.',
        expectedImpact: 'Better market positioning',
        timeframe: 'Consider for next batch'
      });
    }

    return recommendations;
  }
}

export default CocoaAnalyzer;