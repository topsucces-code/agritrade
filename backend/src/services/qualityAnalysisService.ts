import sharp from 'sharp';
import { S3 } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { IQualityAnalysis, IAnalysisMetadata } from '../types';
import { cache } from '../config/redis';
import QualityAnalysisEngine from './QualityAnalysisEngine';
import { ProductMetadata, QualityResult } from './CommodityAnalyzer';

// Initialize AWS S3 client
const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

interface ProcessedImage {
  buffer: Buffer;
  metadata: sharp.Metadata;
  filename: string;
  s3Key: string;
  s3Url: string;
}

export class QualityAnalysisService {
  private bucketName: string;
  private analysisEngine: QualityAnalysisEngine;

  constructor() {
    this.bucketName = process.env.AWS_S3_BUCKET || 'agritrade-images';
    this.analysisEngine = new QualityAnalysisEngine();
  }

  /**
   * Analyze product quality using the enhanced analysis engine
   */
  async analyzeProductQuality(
    images: string[], // Base64 or file paths
    productType: string,
    farmerId: string,
    location?: { latitude: number; longitude: number },
    productId?: string,
    harvestDate?: Date,
    storageConditions?: any
  ): Promise<IQualityAnalysis> {
    try {
      const startTime = Date.now();

      // Validate inputs
      if (!images || images.length === 0) {
        throw new Error('At least one image is required for analysis');
      }

      if (!this.analysisEngine.getSupportedCommodities().includes(productType)) {
        throw new Error(`Product type '${productType}' is not supported`);
      }

      // Process and upload images
      const processedImages = await this.processImages(images, productType, farmerId);

      // Use the primary image for analysis
      const primaryImage = processedImages[0];
      
      // Prepare metadata for analysis
      const metadata: ProductMetadata = {
        productType,
        farmerId,
        location: location || { latitude: 0, longitude: 0 },
        harvestDate: harvestDate || new Date(),
        storageConditions,
        certifications: []
      };

      // Perform quality analysis using the new engine
      const analysisResult = await this.analysisEngine.analyzeProductQuality(
        primaryImage.buffer,
        metadata
      );

      const processingTime = Date.now() - startTime;

      // Create analysis metadata
      const analysisMetadata: IAnalysisMetadata = {
        processingTime,
        imageCount: processedImages.length,
        imageResolution: `${primaryImage.metadata.width}x${primaryImage.metadata.height}`,
        aiModelVersion: '3.0.0', // Updated version with new engine
        gpsCoordinates: location
      };

      // Create quality analysis record
      const qualityAnalysis: Partial<IQualityAnalysis> = {
        productId,
        farmerId,
        productType,
        images: processedImages.map(img => img.s3Url),
        analysisResults: this.convertToLegacyFormat(analysisResult),
        metadata: analysisMetadata,
        status: 'completed'
      };

      // Cache the results
      const cacheKey = `quality_analysis:${farmerId}:${productType}:${Date.now()}`;
      await cache.setJSON(cacheKey, qualityAnalysis, 86400);

      return qualityAnalysis as IQualityAnalysis;

    } catch (error) {
      console.error('Quality analysis error:', error);
      throw new Error(`Quality analysis failed: ${error.message}`);
    }
  }

  /**
   * Convert new QualityResult format to legacy IAnalysisResult format
   */
  private convertToLegacyFormat(result: QualityResult): any {
    return {
      grade: result.grade,
      overallScore: result.overallScore,
      confidence: result.confidence,
      metrics: {
        color: {
          score: result.detailedMetrics.overallAppearance,
          uniformity: result.detailedMetrics.overallAppearance / 100,
          brightness: 0.5 // Default value
        },
        size: {
          averageSize: 10, // Default value
          sizeVariability: 0.2,
          distribution: result.detailedMetrics.beanSizeDistribution || {
            small: 20,
            medium: 60,
            large: 20
          }
        },
        defects: {
          totalDefects: result.detailedMetrics.defectCount || 0,
          defectTypes: [],
          defectRate: (result.detailedMetrics.defectCount || 0) / 100
        },
        moisture: {
          estimatedMoisture: result.detailedMetrics.moistureContent || 7,
          confidence: result.confidence,
          recommendation: 'Moisture level appears acceptable'
        }
      },
      recommendations: result.recommendations.map(rec => rec.description),
      marketPriceEstimate: result.priceEstimate || 0
    };
  }

  /**
   * Process and upload images to S3
   */
  private async processImages(
    images: string[], 
    productType: string, 
    farmerId: string
  ): Promise<ProcessedImage[]> {
    const processed: ProcessedImage[] = [];

    for (let i = 0; i < images.length; i++) {
      const imageData = images[i];
      let buffer: Buffer;

      // Handle base64 or file path
      if (imageData.startsWith('data:image/')) {
        const base64Data = imageData.split(',')[1];
        buffer = Buffer.from(base64Data, 'base64');
      } else if (imageData.startsWith('http')) {
        // Download from URL
        const response = await fetch(imageData);
        buffer = Buffer.from(await response.arrayBuffer());
      } else {
        throw new Error('Invalid image format. Expected base64 or URL');
      }

      // Process image with Sharp
      const processedBuffer = await sharp(buffer)
        .resize(1024, 1024, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .jpeg({ quality: 90 })
        .toBuffer();

      const metadata = await sharp(processedBuffer).metadata();

      // Generate S3 key
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${uuidv4()}.jpg`;
      const s3Key = `quality-analysis/${farmerId}/${productType}/${timestamp}/${filename}`;

      // Upload to S3
      const uploadResult = await s3.upload({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: processedBuffer,
        ContentType: 'image/jpeg',
        Metadata: {
          farmerId,
          productType,
          analysisDate: new Date().toISOString(),
          imageIndex: i.toString()
        }
      }).promise();

      processed.push({
        buffer: processedBuffer,
        metadata,
        filename,
        s3Key,
        s3Url: uploadResult.Location
      });
    }

    return processed;
  }

  /**
   * Perform Google Vision API analysis
   */
  private async performVisionAnalysis(images: ProcessedImage[]): Promise<VisionAnalysisResult[]> {
    const results: VisionAnalysisResult[] = [];

    for (const image of images) {
      try {
        const [labelResult] = await visionClient.labelDetection({
          image: { content: image.buffer }
        });

        const [colorResult] = await visionClient.imageProperties({
          image: { content: image.buffer }
        });

        const [objectResult] = await visionClient.objectLocalization({
          image: { content: image.buffer }
        });

        const [textResult] = await visionClient.textDetection({
          image: { content: image.buffer }
        });

        results.push({
          labels: labelResult.labelAnnotations || [],
          colors: colorResult.imagePropertiesAnnotation?.dominantColors?.colors || [],
          objects: objectResult.localizedObjectAnnotations || [],
          textAnnotations: textResult.textAnnotations || [],
          faceAnnotations: [] // Not needed for agricultural products
        });

      } catch (error) {
        console.error('Vision API error for image:', error);
        // Continue with other images
        results.push({
          labels: [],
          colors: [],
          objects: [],
          textAnnotations: [],
          faceAnnotations: []
        });
      }
    }

    return results;
  }

  /**
   * Analyze color properties
   */
  private async analyzeColor(
    visionResults: VisionAnalysisResult[], 
    productType: string
  ): Promise<IColorAnalysis> {
    const cropMetrics = CROP_METRICS[productType];
    const allColors: any[] = [];
    let totalPixelFraction = 0;

    // Collect all color data
    visionResults.forEach(result => {
      result.colors.forEach(color => {
        allColors.push(color);
        totalPixelFraction += color.pixelFraction || 0;
      });
    });

    if (allColors.length === 0) {
      return {
        score: 50,
        dominantColors: [],
        uniformity: 50,
        brightness: 50
      };
    }

    // Extract dominant colors
    const dominantColors = allColors
      .sort((a, b) => (b.pixelFraction || 0) - (a.pixelFraction || 0))
      .slice(0, 5)
      .map(color => {
        const rgb = color.color;
        return `rgb(${Math.round(rgb.red || 0)}, ${Math.round(rgb.green || 0)}, ${Math.round(rgb.blue || 0)})`;
      });

    // Calculate color score based on crop-specific color profile
    let colorScore = 0;
    const expectedColors = cropMetrics.colorProfile;
    
    // Simple color matching (in real implementation, use more sophisticated color space analysis)
    for (const expectedColor of expectedColors) {
      for (const dominantColor of dominantColors) {
        if (this.isColorSimilar(dominantColor, expectedColor)) {
          colorScore += 20;
          break;
        }
      }
    }
    colorScore = Math.min(colorScore, 100);

    // Calculate uniformity (less variation = higher uniformity)
    const uniformity = allColors.length > 0 
      ? Math.max(0, 100 - (allColors.length * 5))
      : 50;

    // Calculate average brightness
    const avgBrightness = allColors.reduce((sum, color) => {
      const rgb = color.color;
      const brightness = ((rgb.red || 0) + (rgb.green || 0) + (rgb.blue || 0)) / 3;
      return sum + brightness;
    }, 0) / allColors.length;

    const brightnessScore = Math.min(100, (avgBrightness / 255) * 100);

    return {
      score: Math.round((colorScore + uniformity + brightnessScore) / 3),
      dominantColors,
      uniformity: Math.round(uniformity),
      brightness: Math.round(brightnessScore)
    };
  }

  /**
   * Analyze size and shape properties
   */
  private async analyzeSize(
    visionResults: VisionAnalysisResult[], 
    productType: string
  ): Promise<ISizeAnalysis> {
    const cropMetrics = CROP_METRICS[productType];
    const detectedObjects: any[] = [];

    // Collect all detected objects
    visionResults.forEach(result => {
      detectedObjects.push(...result.objects);
    });

    if (detectedObjects.length === 0) {
      return {
        averageSize: cropMetrics.sizeRange.min + 
          (cropMetrics.sizeRange.max - cropMetrics.sizeRange.min) / 2,
        sizeVariability: 50,
        distribution: { small: 33, medium: 34, large: 33 }
      };
    }

    // Calculate size metrics from bounding boxes
    const sizes = detectedObjects.map(obj => {
      const vertices = obj.boundingPoly?.normalizedVertices || [];
      if (vertices.length >= 4) {
        const width = Math.abs(vertices[1].x - vertices[0].x);
        const height = Math.abs(vertices[2].y - vertices[1].y);
        return Math.sqrt(width * width + height * height) * 1000; // Rough size estimate
      }
      return cropMetrics.sizeRange.min;
    });

    const averageSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    
    // Calculate size variability (coefficient of variation)
    const variance = sizes.reduce((sum, size) => sum + Math.pow(size - averageSize, 2), 0) / sizes.length;
    const standardDeviation = Math.sqrt(variance);
    const sizeVariability = Math.min(100, (standardDeviation / averageSize) * 100);

    // Calculate size distribution
    const smallCount = sizes.filter(s => s < cropMetrics.sizeRange.min + 
      (cropMetrics.sizeRange.max - cropMetrics.sizeRange.min) * 0.33).length;
    const largeCount = sizes.filter(s => s > cropMetrics.sizeRange.min + 
      (cropMetrics.sizeRange.max - cropMetrics.sizeRange.min) * 0.67).length;
    const mediumCount = sizes.length - smallCount - largeCount;

    const total = sizes.length;
    
    return {
      averageSize: Math.round(averageSize * 100) / 100,
      sizeVariability: Math.round((100 - sizeVariability)), // Invert so higher = more uniform
      distribution: {
        small: Math.round((smallCount / total) * 100),
        medium: Math.round((mediumCount / total) * 100),
        large: Math.round((largeCount / total) * 100)
      }
    };
  }

  /**
   * Analyze defects and damage
   */
  private async analyzeDefects(
    visionResults: VisionAnalysisResult[], 
    productType: string
  ): Promise<IDefectAnalysis> {
    const cropMetrics = CROP_METRICS[productType];
    const allLabels: any[] = [];

    // Collect all labels
    visionResults.forEach(result => {
      allLabels.push(...result.labels);
    });

    const defectTypes: { type: string; count: number; severity: 'low' | 'medium' | 'high' }[] = [];
    let totalDefects = 0;

    // Check for crop-specific defects
    for (const defectType of cropMetrics.commonDefects) {
      const defectLabels = allLabels.filter(label => 
        label.description.toLowerCase().includes(defectType.toLowerCase()) ||
        this.isDefectRelated(label.description, defectType)
      );

      if (defectLabels.length > 0) {
        const averageConfidence = defectLabels.reduce((sum, label) => 
          sum + (label.score || 0), 0) / defectLabels.length;
        
        let severity: 'low' | 'medium' | 'high' = 'low';
        if (averageConfidence > 0.8) severity = 'high';
        else if (averageConfidence > 0.6) severity = 'medium';

        const defectCount = defectLabels.length;
        defectTypes.push({
          type: defectType,
          count: defectCount,
          severity
        });

        totalDefects += defectCount;
      }
    }

    // Calculate defect rate (assuming we can see ~100 items per image on average)
    const estimatedTotalItems = visionResults.length * 100;
    const defectRate = Math.min(100, (totalDefects / estimatedTotalItems) * 100);

    return {
      totalDefects,
      defectTypes,
      defectRate: Math.round(defectRate * 100) / 100
    };
  }

  /**
   * Estimate moisture content
   */
  private async estimateMoisture(
    visionResults: VisionAnalysisResult[], 
    productType: string
  ): Promise<IMoistureAnalysis> {
    const cropMetrics = CROP_METRICS[productType];
    
    // This is a simplified estimation based on visual cues
    // In practice, this would use more sophisticated analysis
    let moistureIndicators = 0;
    let totalIndicators = 0;

    visionResults.forEach(result => {
      result.labels.forEach(label => {
        totalIndicators++;
        
        // Look for moisture-related visual indicators
        const description = label.description.toLowerCase();
        if (description.includes('shiny') || description.includes('wet') || 
            description.includes('glossy')) {
          moistureIndicators += 2; // High moisture indicators
        } else if (description.includes('dry') || description.includes('brittle') ||
                   description.includes('cracked')) {
          moistureIndicators -= 1; // Low moisture indicators
        }
      });
    });

    // Calculate estimated moisture based on visual cues
    const moistureScore = totalIndicators > 0 ? (moistureIndicators / totalIndicators) : 0;
    const optimalRange = cropMetrics.optimalMoisture;
    const estimatedMoisture = optimalRange.min + 
      (optimalRange.max - optimalRange.min) * (0.5 + moistureScore * 0.3);

    // Determine confidence based on available visual cues
    const confidence = Math.min(1, Math.max(0.3, totalIndicators / 10));

    let recommendation = 'Moisture content appears optimal';
    if (estimatedMoisture < optimalRange.min) {
      recommendation = 'Consider reducing drying time or adding moisture';
    } else if (estimatedMoisture > optimalRange.max) {
      recommendation = 'Increase drying time to reduce moisture content';
    }

    return {
      estimatedMoisture: Math.round(estimatedMoisture * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      recommendation
    };
  }

  /**
   * Calculate overall quality score
   */
  private calculateOverallQuality(
    metrics: {
      color: IColorAnalysis;
      size: ISizeAnalysis;
      defects: IDefectAnalysis;
      moisture: IMoistureAnalysis;
    },
    productType: string
  ): IAnalysisResult {
    // Weighted scoring based on importance for each crop type
    const weights = {
      color: 0.25,
      size: 0.20,
      defects: 0.35, // Defects have highest weight
      moisture: 0.20
    };

    const colorScore = metrics.color.score;
    const sizeScore = metrics.size.sizeVariability;
    const defectScore = Math.max(0, 100 - (metrics.defects.defectRate * 2)); // Fewer defects = higher score
    const moistureScore = metrics.moisture.confidence * 100;

    const overallScore = Math.round(
      colorScore * weights.color +
      sizeScore * weights.size +
      defectScore * weights.defects +
      moistureScore * weights.moisture
    );

    // Determine grade based on overall score
    let grade: 'A' | 'B' | 'C' | 'D';
    if (overallScore >= 85) grade = 'A';
    else if (overallScore >= 70) grade = 'B';
    else if (overallScore >= 55) grade = 'C';
    else grade = 'D';

    // Calculate confidence based on analysis reliability
    const confidence = Math.min(1, (
      metrics.color.score / 100 +
      metrics.size.sizeVariability / 100 +
      (100 - metrics.defects.defectRate) / 100 +
      metrics.moisture.confidence
    ) / 4);

    return {
      grade,
      overallScore,
      confidence: Math.round(confidence * 100) / 100,
      metrics,
      recommendations: [], // Will be filled by generateRecommendations
      marketPriceEstimate: 0, // Will be filled by estimateMarketPrice
      expectedYield: undefined
    };
  }

  /**
   * Generate improvement recommendations
   */
  private generateRecommendations(
    result: IAnalysisResult, 
    productType: string
  ): string[] {
    const recommendations: string[] = [];
    const metrics = result.metrics;

    // Color recommendations
    if (metrics.color.score < 70) {
      if (productType === 'cocoa') {
        recommendations.push('Improve fermentation process to achieve better color development');
      } else if (productType === 'coffee') {
        recommendations.push('Check processing method and drying conditions for better color');
      }
    }

    // Size recommendations
    if (metrics.size.sizeVariability < 60) {
      recommendations.push('Improve sorting to achieve more uniform size distribution');
    }

    // Defect recommendations
    if (metrics.defects.defectRate > 10) {
      recommendations.push('Enhance post-harvest handling to reduce defects');
      recommendations.push('Implement better storage conditions to prevent damage');
    }

    // Moisture recommendations
    recommendations.push(metrics.moisture.recommendation);

    // Grade-specific recommendations
    if (result.grade === 'C' || result.grade === 'D') {
      recommendations.push('Consider additional processing or sorting to improve grade');
      recommendations.push('Review harvest timing and methods');
    }

    return recommendations;
  }

  /**
   * Estimate market price based on quality
   */
  private async estimateMarketPrice(
    qualityScore: number, 
    productType: string
  ): Promise<number> {
    try {
      // Get base market price from cache or external API
      const cacheKey = `market_price:${productType}`;
      let basePrice = await cache.getJSON<number>(cacheKey);

      if (!basePrice) {
        // Fallback base prices (USD per kg)
        const basePrices: { [key: string]: number } = {
          cocoa: 2.50,
          coffee: 3.00,
          cotton: 1.80,
          peanuts: 1.20,
          cashew: 8.00,
          palm_oil: 0.85
        };
        basePrice = basePrices[productType] || 2.00;
      }

      // Apply quality multiplier
      let qualityMultiplier = 1.0;
      if (qualityScore >= 85) qualityMultiplier = 1.25; // Grade A premium
      else if (qualityScore >= 70) qualityMultiplier = 1.10; // Grade B premium
      else if (qualityScore >= 55) qualityMultiplier = 1.00; // Grade C standard
      else qualityMultiplier = 0.85; // Grade D discount

      return Math.round(basePrice * qualityMultiplier * 100) / 100;

    } catch (error) {
      console.error('Error estimating market price:', error);
      return 0;
    }
  }

  /**
   * Helper method to check color similarity
   */
  private isColorSimilar(color1: string, color2: string): boolean {
    // Simplified color comparison
    // In practice, would use color space calculations
    const normalizedColor1 = color1.toLowerCase().replace(/[^a-z]/g, '');
    const normalizedColor2 = color2.toLowerCase().replace(/[^a-z]/g, '');
    
    return normalizedColor1.includes(normalizedColor2) || 
           normalizedColor2.includes(normalizedColor1);
  }

  /**
   * Helper method to check if label is defect-related
   */
  private isDefectRelated(labelDescription: string, defectType: string): boolean {
    const defectKeywords: { [key: string]: string[] } = {
      'mold': ['fungus', 'mildew', 'rot', 'decay'],
      'insect damage': ['hole', 'bore', 'pest', 'larva'],
      'broken': ['crack', 'split', 'fragment', 'piece'],
      'discolored': ['spot', 'stain', 'blemish', 'mark']
    };

    const keywords = defectKeywords[defectType] || [];
    const description = labelDescription.toLowerCase();
    
    return keywords.some(keyword => description.includes(keyword));
  }
}

export default QualityAnalysisService;