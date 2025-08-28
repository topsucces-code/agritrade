import { GoogleVisionClient } from '@google-cloud/vision';
import CommodityAnalyzer, { ProductMetadata, QualityResult } from './CommodityAnalyzer';
import CocoaAnalyzer from './CocoaAnalyzer';
import CoffeeAnalyzer from './CoffeeAnalyzer';

/**
 * Quality Analysis Engine - Factory and orchestrator for commodity-specific analyzers
 */
export class QualityAnalysisEngine {
  private googleVisionClient: GoogleVisionClient;
  private analyzers: Map<string, CommodityAnalyzer>;

  constructor() {
    // Initialize Google Vision client
    this.googleVisionClient = new GoogleVisionClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    });

    // Initialize analyzer registry
    this.analyzers = new Map();
    this.registerAnalyzers();
  }

  /**
   * Register all available commodity analyzers
   */
  private registerAnalyzers(): void {
    this.analyzers.set('cocoa', new CocoaAnalyzer(this.googleVisionClient));
    this.analyzers.set('coffee', new CoffeeAnalyzer(this.googleVisionClient));
    // Add more analyzers as they are implemented
    // this.analyzers.set('cotton', new CottonAnalyzer(this.googleVisionClient));
    // this.analyzers.set('maize', new MaizeAnalyzer(this.googleVisionClient));
  }

  /**
   * Analyze product quality using appropriate commodity analyzer
   */
  async analyzeProductQuality(
    imageData: Buffer, 
    metadata: ProductMetadata
  ): Promise<QualityResult> {
    const analyzer = this.getAnalyzer(metadata.productType);
    
    if (!analyzer) {
      throw new Error(`No analyzer available for product type: ${metadata.productType}`);
    }

    try {
      const startTime = Date.now();
      const result = await analyzer.analyzeQuality(imageData, metadata);
      const processingTime = Date.now() - startTime;

      // Add processing time to result
      result.detailedMetrics.processingTime = processingTime;

      return result;
    } catch (error) {
      throw new Error(`Quality analysis failed: ${error.message}`);
    }
  }

  /**
   * Get appropriate analyzer for product type
   */
  private getAnalyzer(productType: string): CommodityAnalyzer | undefined {
    return this.analyzers.get(productType.toLowerCase());
  }

  /**
   * Get list of supported commodities
   */
  getSupportedCommodities(): string[] {
    return Array.from(this.analyzers.keys());
  }

  /**
   * Batch analyze multiple images
   */
  async batchAnalyze(
    imageDataArray: { imageData: Buffer; metadata: ProductMetadata }[]
  ): Promise<QualityResult[]> {
    const results = await Promise.allSettled(
      imageDataArray.map(({ imageData, metadata }) => 
        this.analyzeProductQuality(imageData, metadata)
      )
    );

    return results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        throw new Error(`Batch analysis failed: ${result.reason}`);
      }
    });
  }

  /**
   * Health check for the analysis engine
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    analyzers: string[];
    visionApiConnected: boolean;
  }> {
    try {
      // Test Google Vision API connection with a small test
      const testImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
      await this.googleVisionClient.annotateImage({
        image: { content: testImage },
        features: [{ type: 'LABEL_DETECTION', maxResults: 1 }]
      });

      return {
        status: 'healthy',
        analyzers: this.getSupportedCommodities(),
        visionApiConnected: true
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        analyzers: this.getSupportedCommodities(),
        visionApiConnected: false
      };
    }
  }
}

export default QualityAnalysisEngine;