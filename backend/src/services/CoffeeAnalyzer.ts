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
 * Coffee-specific quality metrics interface
 */
interface CoffeeQualityMetrics extends QualityMetrics {
  beanSizeUniformity: number;
  colorConsistency: number;
  moistureContent: number;
  defectCount: number;
  beanDensity: number;
  screenSize: number;
  beanCount: number;
  averageBeanSize: number;
  processingQuality: number;
  aroma: number;
}

interface DetectedCoffeeBean {
  boundingBox: any;
  confidence: number;
  size: number;
  position: { x: number; y: number };
  shape: 'flat' | 'peaberry' | 'elephant' | 'normal';
  color: { red: number; green: number; blue: number };
}

/**
 * Specialized analyzer for coffee beans
 * Implements specialty coffee quality assessment criteria
 */
export class CoffeeAnalyzer extends CommodityAnalyzer {
  private readonly QUALITY_WEIGHTS = {
    beanSizeUniformity: 0.20,
    colorConsistency: 0.18,
    moistureContent: 0.15,
    defectCount: 0.25,
    beanDensity: 0.12,
    processingQuality: 0.10
  };

  // Coffee grading standards
  private readonly SCREEN_SIZES = {
    'AA': 17, // 6.8mm
    'AB': 15, // 6.0mm 
    'C': 12,  // 4.8mm
    'PB': 10, // Peaberry
    'TT': 8   // Triage
  };

  constructor(visionClient: GoogleVisionClient) {
    super(visionClient, 'coffee');
  }

  /**
   * Extract coffee-specific quality metrics from vision analysis
   */
  async extractMetrics(visionResults: VisionAnalysisResult, metadata: ProductMetadata): Promise<QualityMetrics> {
    const startTime = Date.now();
    
    // Validate image quality first
    if (!this.validateImageQuality(visionResults)) {
      throw new Error('Image quality insufficient for accurate coffee analysis');
    }

    // Detect and analyze coffee beans
    const beans = this.detectCoffeeBeans(visionResults.objects);
    const colorAnalysis = this.analyzeColor(visionResults.imageProperties);
    const defects = this.detectDefects(visionResults);

    // Extract coffee-specific metrics
    const beanSizeUniformity = this.calculateSizeUniformity(beans);
    const colorConsistency = this.calculateColorConsistency(colorAnalysis);
    const moistureAnalysis = this.estimateMoisture(colorAnalysis, metadata);
    const defectCount = this.quantifyDefects(defects);
    const beanDensity = this.calculateBeanDensity(beans);
    const screenSize = this.determineScreenSize(beans);
    const beanCount = beans.length;
    const averageBeanSize = this.calculateAverageBeanSize(beans);
    const processingQuality = this.assessProcessingQuality(visionResults, metadata);
    const aroma = this.estimateAromaIndicators(visionResults, metadata);

    // Calculate common quality indicators
    const overallAppearance = this.assessOverallAppearance(visionResults);
    const storageCondition = this.assessStorageCondition(visionResults, metadata);

    return {
      // Coffee-specific metrics
      beanSizeUniformity,
      colorConsistency,
      moistureContent: moistureAnalysis.estimated,
      defectCount,
      beanDensity,
      screenSize,
      beanCount,
      averageBeanSize,
      processingQuality,
      aroma,

      // Common metrics
      overallAppearance,
      storageCondition,

      // Analysis metadata
      analysisConfidence: moistureAnalysis.confidence,
      imageQuality: this.calculateImageQuality(visionResults),
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Detect coffee beans in the image
   */
  private detectCoffeeBeans(objects: VisionAnalysisResult['objects']): DetectedCoffeeBean[] {
    const coffeeBeans = objects.filter(obj => 
      obj.name.toLowerCase().includes('coffee') || 
      obj.name.toLowerCase().includes('bean') ||
      obj.name.toLowerCase().includes('seed') ||
      obj.name.toLowerCase().includes('cherry')
    );

    return coffeeBeans.map(bean => {
      let size = 0.1; // Default size
      let position = { x: 0.5, y: 0.5 }; // Default position
      let shape: 'flat' | 'peaberry' | 'elephant' | 'normal' = 'normal';

      if (bean.boundingBox && bean.boundingBox.normalizedVertices) {
        const vertices = bean.boundingBox.normalizedVertices;
        const width = vertices[2]?.x - vertices[0]?.x || 0;
        const height = vertices[2]?.y - vertices[0]?.y || 0;
        size = width * height;
        position = {
          x: (vertices[0]?.x + vertices[2]?.x) / 2 || 0.5,
          y: (vertices[0]?.y + vertices[2]?.y) / 2 || 0.5
        };

        // Determine bean shape based on aspect ratio
        const aspectRatio = width / height;
        if (aspectRatio > 1.8) shape = 'flat';
        else if (aspectRatio < 1.2) shape = 'peaberry';
        else if (size > 0.3) shape = 'elephant';
        else shape = 'normal';
      }

      return {
        boundingBox: bean.boundingBox,
        confidence: bean.confidence,
        size,
        position,
        shape,
        color: { red: 139, green: 120, blue: 80 } // Default coffee color
      };
    });
  }

  /**
   * Calculate size uniformity for coffee beans
   */
  private calculateSizeUniformity(beans: DetectedCoffeeBean[]): number {
    if (beans.length === 0) return 40;

    const sizes = beans.map(bean => bean.size);
    const meanSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    const variance = sizes.reduce((sum, size) => sum + Math.pow(size - meanSize, 2), 0) / sizes.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / meanSize;

    // Coffee industry standard: CV < 0.15 is excellent
    const uniformityScore = Math.max(0, 100 - (coefficientOfVariation * 300));
    return Math.round(uniformityScore * 10) / 10;
  }

  /**
   * Analyze color properties specific to coffee processing
   */
  private analyzeColor(imageProperties: any): any {
    const colors = imageProperties?.dominantColors?.colors || [];
    
    return {
      colors,
      dominantColor: colors[0] || { red: 139, green: 120, blue: 80 },
      uniformity: this.calculateColorUniformity(colors),
      brightness: this.calculateBrightness(colors),
      processingIndicator: this.assessProcessingFromColor(colors)
    };
  }

  /**
   * Assess processing quality from color analysis
   */
  private assessProcessingFromColor(colors: any[]): string {
    if (colors.length === 0) return 'unknown';

    const avgColor = colors.reduce((acc, color) => ({
      red: acc.red + color.red,
      green: acc.green + color.green,
      blue: acc.blue + color.blue
    }), { red: 0, green: 0, blue: 0 });

    avgColor.red /= colors.length;
    avgColor.green /= colors.length;
    avgColor.blue /= colors.length;

    // Determine processing method based on color
    if (avgColor.green > avgColor.red && avgColor.green > avgColor.blue) {
      return 'washed'; // Green tint indicates washed processing
    } else if (avgColor.red > avgColor.green) {
      return 'natural'; // Red/brown indicates natural processing
    } else {
      return 'honey'; // Balanced colors indicate honey processing
    }
  }

  /**
   * Calculate color uniformity for coffee
   */
  private calculateColorUniformity(colors: any[]): number {
    if (colors.length < 2) return 0.8;
    
    const variations = colors.slice(1).map(color => {
      const baseColor = colors[0];
      const rDiff = Math.abs(color.red - baseColor.red);
      const gDiff = Math.abs(color.green - baseColor.green);
      const bDiff = Math.abs(color.blue - baseColor.blue);
      return (rDiff + gDiff + bDiff) / 3;
    });
    
    const avgVariation = variations.reduce((sum, v) => sum + v, 0) / variations.length;
    return Math.max(0, 1 - (avgVariation / 128));
  }

  /**
   * Calculate brightness for coffee analysis
   */
  private calculateBrightness(colors: any[]): number {
    if (colors.length === 0) return 0.5;
    
    const avgBrightness = colors.reduce((sum, color) => {
      const luminance = 0.299 * color.red + 0.587 * color.green + 0.114 * color.blue;
      return sum + luminance;
    }, 0) / colors.length;
    
    return avgBrightness / 255;
  }

  /**
   * Calculate color consistency specific to coffee
   */
  private calculateColorConsistency(colorAnalysis: any): number {
    const processingScore = this.getProcessingScore(colorAnalysis.processingIndicator);
    const uniformityScore = colorAnalysis.uniformity * 100;
    const brightnessScore = this.getBrightnessScore(colorAnalysis.brightness);
    
    const finalScore = (processingScore * 0.4 + uniformityScore * 0.4 + brightnessScore * 0.2);
    return Math.round(finalScore * 10) / 10;
  }

  /**
   * Get processing quality score
   */
  private getProcessingScore(processingType: string): number {
    const scores = {
      'washed': 85,    // High quality
      'honey': 80,     // Good quality
      'natural': 75,   // Variable quality
      'unknown': 60    // Cannot determine
    };
    return scores[processingType] || 60;
  }

  /**
   * Get brightness quality score
   */
  private getBrightnessScore(brightness: number): number {
    // Optimal brightness for coffee beans: 0.3-0.6
    if (brightness >= 0.3 && brightness <= 0.6) return 90;
    if (brightness >= 0.2 && brightness <= 0.7) return 75;
    return 50;
  }

  /**
   * Calculate bean density estimation
   */
  private calculateBeanDensity(beans: DetectedCoffeeBean[]): number {
    if (beans.length === 0) return 70;

    // Estimate density based on bean distribution and overlap
    const totalArea = beans.reduce((sum, bean) => sum + bean.size, 0);
    const imageArea = 1.0; // Normalized image area
    const packingDensity = totalArea / imageArea;

    // Coffee density indicators
    let densityScore = 60; // Base score
    
    if (packingDensity > 0.7) densityScore = 90; // High density
    else if (packingDensity > 0.5) densityScore = 80; // Good density
    else if (packingDensity > 0.3) densityScore = 70; // Average density
    else densityScore = 50; // Low density

    return Math.round(densityScore);
  }

  /**
   * Determine screen size grade
   */
  private determineScreenSize(beans: DetectedCoffeeBean[]): number {
    if (beans.length === 0) return 12; // Default C grade

    const avgSize = beans.reduce((sum, bean) => sum + bean.size, 0) / beans.length;
    
    // Convert normalized size to screen size estimate
    if (avgSize > 0.25) return 17; // AA
    if (avgSize > 0.20) return 15; // AB
    if (avgSize > 0.15) return 12; // C
    if (avgSize > 0.10) return 10; // PB
    return 8; // TT
  }

  /**
   * Calculate average bean size
   */
  private calculateAverageBeanSize(beans: DetectedCoffeeBean[]): number {
    if (beans.length === 0) return 0;
    
    const totalSize = beans.reduce((sum, bean) => sum + bean.size, 0);
    return Math.round((totalSize / beans.length) * 10000) / 10000;
  }

  /**
   * Quantify defects specific to coffee
   */
  private quantifyDefects(defects: any): number {
    return defects.count || 0;
  }

  /**
   * Estimate aroma indicators from visual cues
   */
  private estimateAromaIndicators(visionResults: VisionAnalysisResult, metadata: ProductMetadata): number {
    // This is an estimation based on visual processing quality indicators
    let aromaScore = 70; // Base score

    // Check for processing quality indicators
    const qualityLabels = visionResults.labels.filter(label =>
      ['fresh', 'clean', 'bright', 'aromatic'].some(keyword =>
        label.description.toLowerCase().includes(keyword)
      )
    );

    aromaScore += qualityLabels.length * 5;

    // Consider storage conditions
    if (metadata.storageConditions) {
      const { temperature, humidity, duration } = metadata.storageConditions;
      
      // Ideal storage for aroma retention: 15-25°C, <65% humidity
      if (temperature >= 15 && temperature <= 25) aromaScore += 5;
      if (humidity < 65) aromaScore += 5;
      if (duration < 30) aromaScore += 5; // Fresher is better for aroma
    }

    return Math.round(Math.max(30, Math.min(100, aromaScore)));
  }

  /**
   * Calculate weighted score using coffee industry standards
   */
  protected calculateWeightedScore(metrics: any): number {
    const coffeeMetrics = metrics as CoffeeQualityMetrics;
    
    // Convert defect count to score (inverse relationship)
    const defectScore = Math.max(0, 100 - (coffeeMetrics.defectCount * 8));

    const weightedScore = 
      (coffeeMetrics.beanSizeUniformity * this.QUALITY_WEIGHTS.beanSizeUniformity) +
      (coffeeMetrics.colorConsistency * this.QUALITY_WEIGHTS.colorConsistency) +
      (coffeeMetrics.moistureContent * this.QUALITY_WEIGHTS.moistureContent) +
      (defectScore * this.QUALITY_WEIGHTS.defectCount) +
      (coffeeMetrics.beanDensity * this.QUALITY_WEIGHTS.beanDensity) +
      (coffeeMetrics.processingQuality * this.QUALITY_WEIGHTS.processingQuality);

    return Math.round(weightedScore * 10) / 10;
  }

  /**
   * Calculate grade based on coffee grading standards
   */
  calculateGrade(metrics: QualityMetrics): 'A+' | 'A' | 'B' | 'C' | 'D' {
    const score = this.calculateWeightedScore(metrics);
    const coffeeMetrics = metrics as CoffeeQualityMetrics;

    // Special consideration for screen size in coffee grading
    if (coffeeMetrics.screenSize >= 17 && score >= 85) return 'A+'; // AA grade
    if (coffeeMetrics.screenSize >= 15 && score >= 75) return 'A';  // AB grade
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  }

  /**
   * Generate coffee-specific recommendations
   */
  generateRecommendations(analysis: QualityResult): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const metrics = analysis.detailedMetrics as CoffeeQualityMetrics;

    // Bean size uniformity recommendations
    if (metrics.beanSizeUniformity < 70) {
      recommendations.push({
        type: 'processing',
        priority: 'high',
        title: 'Improve Bean Sorting',
        description: 'Implement better screening and sorting to achieve uniform bean sizes for higher grades.',
        expectedImpact: 'Can upgrade from C to AB grade, increasing price by 20-30%',
        timeframe: 'Next processing cycle'
      });
    }

    // Defect recommendations
    if (metrics.defectCount > 5) {
      recommendations.push({
        type: 'improvement',
        priority: 'high',
        title: 'Reduce Defect Rate',
        description: 'Focus on better picking, processing, and storage to minimize defects.',
        expectedImpact: 'Can achieve specialty grade pricing',
        timeframe: 'Immediate action needed'
      });
    }

    // Moisture content recommendations
    if (metrics.moistureContent > 12) {
      recommendations.push({
        type: 'storage',
        priority: 'medium',
        title: 'Optimize Drying Process',
        description: 'Reduce moisture content to 10-12% for optimal storage and quality retention.',
        expectedImpact: 'Prevents quality deterioration and mold development',
        timeframe: '1-2 weeks'
      });
    }

    // Processing quality recommendations
    if (metrics.processingQuality < 70) {
      recommendations.push({
        type: 'processing',
        priority: 'medium',
        title: 'Improve Processing Method',
        description: 'Consider upgrading to washed processing for better quality and market acceptance.',
        expectedImpact: 'Can improve cup quality and marketability',
        timeframe: 'Next harvest season'
      });
    }

    return recommendations;
  }
}

export default CoffeeAnalyzer;