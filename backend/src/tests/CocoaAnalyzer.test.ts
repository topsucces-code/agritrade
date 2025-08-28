import { CocoaAnalyzer } from '../services/CocoaAnalyzer';
import { GoogleVisionClient } from '@google-cloud/vision';
import { VisionAnalysisResult, ProductMetadata, QualityResult } from '../services/CommodityAnalyzer';
import fs from 'fs';
import path from 'path';

// Mock Google Vision Client
jest.mock('@google-cloud/vision');

describe('CocoaAnalyzer', () => {
  let cocoaAnalyzer: CocoaAnalyzer;
  let mockVisionClient: jest.Mocked<GoogleVisionClient>;
  let sampleImageBuffer: Buffer;
  let mockVisionResults: VisionAnalysisResult;
  let sampleMetadata: ProductMetadata;

  beforeEach(() => {
    // Create mock vision client
    mockVisionClient = {
      annotateImage: jest.fn(),
    } as any;

    // Initialize analyzer with mock client
    cocoaAnalyzer = new CocoaAnalyzer(mockVisionClient);

    // Create sample image buffer (mock data)
    sampleImageBuffer = Buffer.from('sample-image-data');

    // Mock vision API results
    mockVisionResults = {
      objects: [
        {
          name: 'cocoa_bean',
          confidence: 0.95,
          boundingBox: {
            normalizedVertices: [
              { x: 0.1, y: 0.1 },
              { x: 0.3, y: 0.1 },
              { x: 0.3, y: 0.3 },
              { x: 0.1, y: 0.3 }
            ]
          }
        },
        {
          name: 'cocoa_bean',
          confidence: 0.92,
          boundingBox: {
            normalizedVertices: [
              { x: 0.5, y: 0.2 },
              { x: 0.7, y: 0.2 },
              { x: 0.7, y: 0.4 },
              { x: 0.5, y: 0.4 }
            ]
          }
        }
      ],
      colors: [
        { red: 139, green: 69, blue: 19, score: 0.8, pixelFraction: 0.4 },
        { red: 120, green: 60, blue: 20, score: 0.6, pixelFraction: 0.3 }
      ],
      labels: [
        { description: 'cocoa', score: 0.95 },
        { description: 'bean', score: 0.90 },
        { description: 'brown', score: 0.85 },
        { description: 'uniform', score: 0.70 }
      ],
      textAnnotations: [
        { description: 'Grade A', boundingPoly: {} }
      ],
      imageProperties: {
        dominantColors: {
          colors: [
            { red: 139, green: 69, blue: 19, score: 0.8 },
            { red: 120, green: 60, blue: 20, score: 0.6 }
          ]
        }
      }
    };

    // Sample metadata
    sampleMetadata = {
      productType: 'cocoa',
      farmerId: 'farmer123',
      location: {
        latitude: 5.5600,
        longitude: -0.2057
      },
      harvestDate: new Date('2024-01-15'),
      storageConditions: {
        temperature: 25,
        humidity: 65,
        duration: 30
      }
    };

    // Mock vision client response
    mockVisionClient.annotateImage.mockResolvedValue([{
      localizedObjectAnnotations: mockVisionResults.objects,
      imagePropertiesAnnotation: {
        dominantColors: mockVisionResults.imageProperties
      },
      labelAnnotations: mockVisionResults.labels,
      textAnnotations: mockVisionResults.textAnnotations
    }] as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Quality Analysis', () => {
    it('should analyze high-grade cocoa accurately', async () => {
      const result = await cocoaAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);

      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('grade');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('detailedMetrics');
      expect(result).toHaveProperty('recommendations');

      expect(result.overallScore).toBeGreaterThan(70);
      expect(['A+', 'A', 'B', 'C', 'D']).toContain(result.grade);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle low-quality images gracefully', async () => {
      // Mock poor quality image results
      mockVisionResults.objects = [];
      mockVisionResults.colors = [];
      mockVisionResults.labels = [];

      mockVisionClient.annotateImage.mockResolvedValue([{
        localizedObjectAnnotations: [],
        imagePropertiesAnnotation: { dominantColors: { colors: [] } },
        labelAnnotations: [],
        textAnnotations: []
      }] as any);

      await expect(
        cocoaAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata)
      ).rejects.toThrow('Image quality insufficient for accurate analysis');
    });

    it('should calculate bean size uniformity correctly', async () => {
      const result = await cocoaAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);

      expect(result.detailedMetrics).toHaveProperty('beanSizeUniformity');
      expect(result.detailedMetrics.beanSizeUniformity).toBeGreaterThanOrEqual(0);
      expect(result.detailedMetrics.beanSizeUniformity).toBeLessThanOrEqual(100);
    });

    it('should assess color consistency properly', async () => {
      const result = await cocoaAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);

      expect(result.detailedMetrics).toHaveProperty('colorConsistency');
      expect(result.detailedMetrics.colorConsistency).toBeGreaterThanOrEqual(0);
      expect(result.detailedMetrics.colorConsistency).toBeLessThanOrEqual(100);
    });

    it('should estimate moisture content within valid range', async () => {
      const result = await cocoaAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);

      expect(result.detailedMetrics).toHaveProperty('moistureContent');
      expect(result.detailedMetrics.moistureContent).toBeGreaterThanOrEqual(0);
      expect(result.detailedMetrics.moistureContent).toBeLessThanOrEqual(100);
    });

    it('should detect and count defects accurately', async () => {
      // Add defect indicators to mock results
      mockVisionResults.labels.push(
        { description: 'crack', score: 0.7 },
        { description: 'damage', score: 0.6 }
      );

      const result = await cocoaAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);

      expect(result.detailedMetrics).toHaveProperty('defectCount');
      expect(result.detailedMetrics.defectCount).toBeGreaterThanOrEqual(0);
    });

    it('should calculate shell-to-bean ratio', async () => {
      const result = await cocoaAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);

      expect(result.detailedMetrics).toHaveProperty('shellToBeanRatio');
      expect(result.detailedMetrics.shellToBeanRatio).toBeGreaterThanOrEqual(0);
      expect(result.detailedMetrics.shellToBeanRatio).toBeLessThanOrEqual(100);
    });
  });

  describe('Grading System', () => {
    it('should assign correct grade for high-quality cocoa', async () => {
      // Mock high-quality results
      const highQualityMetrics = {
        beanSizeUniformity: 95,
        colorConsistency: 90,
        moistureContent: 85,
        defectCount: 1,
        shellToBeanRatio: 92
      };

      const grade = cocoaAnalyzer.calculateGrade(highQualityMetrics as any);
      expect(['A+', 'A']).toContain(grade);
    });

    it('should assign correct grade for medium-quality cocoa', async () => {
      const mediumQualityMetrics = {
        beanSizeUniformity: 75,
        colorConsistency: 70,
        moistureContent: 75,
        defectCount: 3,
        shellToBeanRatio: 80
      };

      const grade = cocoaAnalyzer.calculateGrade(mediumQualityMetrics as any);
      expect(['B', 'C']).toContain(grade);
    });

    it('should assign correct grade for low-quality cocoa', async () => {
      const lowQualityMetrics = {
        beanSizeUniformity: 45,
        colorConsistency: 40,
        moistureContent: 50,
        defectCount: 8,
        shellToBeanRatio: 60
      };

      const grade = cocoaAnalyzer.calculateGrade(lowQualityMetrics as any);
      expect(['C', 'D']).toContain(grade);
    });
  });

  describe('Recommendations Generation', () => {
    it('should generate size uniformity recommendations for poor uniformity', async () => {
      const analysis: QualityResult = {
        overallScore: 65,
        grade: 'C',
        confidence: 0.8,
        detailedMetrics: {
          beanSizeUniformity: 60, // Poor uniformity
          colorConsistency: 75,
          moistureContent: 70,
          defectCount: 3,
          shellToBeanRatio: 80
        },
        recommendations: []
      };

      const recommendations = cocoaAnalyzer.generateRecommendations(analysis);

      expect(recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'processing',
            priority: 'high',
            title: expect.stringContaining('Bean Size Uniformity')
          })
        ])
      );
    });

    it('should generate moisture content recommendations for high moisture', async () => {
      const analysis: QualityResult = {
        overallScore: 70,
        grade: 'B',
        confidence: 0.8,
        detailedMetrics: {
          beanSizeUniformity: 80,
          colorConsistency: 75,
          moistureContent: 85, // High moisture
          defectCount: 2,
          shellToBeanRatio: 85
        },
        recommendations: []
      };

      const recommendations = cocoaAnalyzer.generateRecommendations(analysis);

      expect(recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'storage',
            priority: 'medium',
            title: expect.stringContaining('Drying')
          })
        ])
      );
    });

    it('should generate defect reduction recommendations for high defect count', async () => {
      const analysis: QualityResult = {
        overallScore: 60,
        grade: 'C',
        confidence: 0.8,
        detailedMetrics: {
          beanSizeUniformity: 75,
          colorConsistency: 70,
          moistureContent: 75,
          defectCount: 6, // High defect count
          shellToBeanRatio: 80
        },
        recommendations: []
      };

      const recommendations = cocoaAnalyzer.generateRecommendations(analysis);

      expect(recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'improvement',
            priority: 'high',
            title: expect.stringContaining('Reduce Defects')
          })
        ])
      );
    });

    it('should not generate unnecessary recommendations for high-quality cocoa', async () => {
      const analysis: QualityResult = {
        overallScore: 92,
        grade: 'A+',
        confidence: 0.95,
        detailedMetrics: {
          beanSizeUniformity: 95,
          colorConsistency: 90,
          moistureContent: 88,
          defectCount: 1,
          shellToBeanRatio: 90
        },
        recommendations: []
      };

      const recommendations = cocoaAnalyzer.generateRecommendations(analysis);

      // Should have minimal or no recommendations for high-quality cocoa
      const highPriorityRecommendations = recommendations.filter(r => r.priority === 'high');
      expect(highPriorityRecommendations).toHaveLength(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty vision results', async () => {
      mockVisionClient.annotateImage.mockResolvedValue([{
        localizedObjectAnnotations: undefined,
        imagePropertiesAnnotation: undefined,
        labelAnnotations: undefined,
        textAnnotations: undefined
      }] as any);

      await expect(
        cocoaAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata)
      ).rejects.toThrow();
    });

    it('should handle vision API errors', async () => {
      mockVisionClient.annotateImage.mockRejectedValue(new Error('Vision API error'));

      await expect(
        cocoaAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata)
      ).rejects.toThrow('Vision API error');
    });

    it('should handle invalid image data', async () => {
      const invalidBuffer = Buffer.from('invalid-image-data');

      await expect(
        cocoaAnalyzer.analyzeQuality(invalidBuffer, sampleMetadata)
      ).rejects.toThrow();
    });

    it('should handle missing metadata gracefully', async () => {
      const incompleteMetadata = {
        productType: 'cocoa',
        farmerId: 'farmer123',
        location: { latitude: 5.5600, longitude: -0.2057 },
        harvestDate: new Date()
      };

      const result = await cocoaAnalyzer.analyzeQuality(
        sampleImageBuffer, 
        incompleteMetadata as ProductMetadata
      );

      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('grade');
    });
  });

  describe('Performance and Reliability', () => {
    it('should complete analysis within reasonable time', async () => {
      const startTime = Date.now();
      
      await cocoaAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should produce consistent results for identical inputs', async () => {
      const result1 = await cocoaAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);
      const result2 = await cocoaAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);

      expect(result1.overallScore).toBeCloseTo(result2.overallScore, 1);
      expect(result1.grade).toBe(result2.grade);
      expect(result1.detailedMetrics.beanSizeUniformity)
        .toBeCloseTo(result2.detailedMetrics.beanSizeUniformity, 1);
    });

    it('should handle concurrent analysis requests', async () => {
      const promises = Array(5).fill(null).map(() =>
        cocoaAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toHaveProperty('overallScore');
        expect(result).toHaveProperty('grade');
        expect(result).toHaveProperty('confidence');
      });
    });

    it('should validate all quality metrics are within expected ranges', async () => {
      const result = await cocoaAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);

      // Validate all metrics are within 0-100 range
      Object.values(result.detailedMetrics).forEach(value => {
        if (typeof value === 'number') {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        }
      });

      // Validate confidence is between 0-1
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);

      // Validate overall score is between 0-100
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Integration with Vision API', () => {
    it('should call vision API with correct parameters', async () => {
      await cocoaAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);

      expect(mockVisionClient.annotateImage).toHaveBeenCalledWith({
        image: { content: sampleImageBuffer },
        features: [
          { type: 'OBJECT_LOCALIZATION', maxResults: 50 },
          { type: 'IMAGE_PROPERTIES' },
          { type: 'LABEL_DETECTION', maxResults: 50 },
          { type: 'TEXT_DETECTION' }
        ]
      });
    });

    it('should handle partial vision API responses', async () => {
      // Mock partial response
      mockVisionClient.annotateImage.mockResolvedValue([{
        localizedObjectAnnotations: mockVisionResults.objects,
        labelAnnotations: mockVisionResults.labels,
        // Missing imagePropertiesAnnotation and textAnnotations
      }] as any);

      const result = await cocoaAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);

      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('grade');
    });
  });
});