import { CoffeeAnalyzer } from '../services/CoffeeAnalyzer';
import { GoogleVisionClient } from '@google-cloud/vision';
import { VisionAnalysisResult, ProductMetadata } from '../services/CommodityAnalyzer';

jest.mock('@google-cloud/vision');

describe('CoffeeAnalyzer', () => {
  let coffeeAnalyzer: CoffeeAnalyzer;
  let mockVisionClient: jest.Mocked<GoogleVisionClient>;
  let sampleImageBuffer: Buffer;
  let mockVisionResults: VisionAnalysisResult;
  let sampleMetadata: ProductMetadata;

  beforeEach(() => {
    mockVisionClient = {
      annotateImage: jest.fn(),
    } as any;

    coffeeAnalyzer = new CoffeeAnalyzer(mockVisionClient);
    sampleImageBuffer = Buffer.from('sample-coffee-image-data');

    mockVisionResults = {
      objects: [
        {
          name: 'coffee_bean',
          confidence: 0.96,
          boundingBox: {
            normalizedVertices: [
              { x: 0.1, y: 0.1 },
              { x: 0.2, y: 0.1 },
              { x: 0.2, y: 0.25 },
              { x: 0.1, y: 0.25 }
            ]
          }
        },
        {
          name: 'coffee_bean',
          confidence: 0.94,
          boundingBox: {
            normalizedVertices: [
              { x: 0.3, y: 0.2 },
              { x: 0.4, y: 0.2 },
              { x: 0.4, y: 0.35 },
              { x: 0.3, y: 0.35 }
            ]
          }
        }
      ],
      colors: [
        { red: 139, green: 120, blue: 80, score: 0.85, pixelFraction: 0.5 },
        { red: 125, green: 110, blue: 75, score: 0.75, pixelFraction: 0.3 }
      ],
      labels: [
        { description: 'coffee', score: 0.97 },
        { description: 'bean', score: 0.93 },
        { description: 'washed', score: 0.80 },
        { description: 'uniform', score: 0.75 }
      ],
      textAnnotations: [
        { description: 'AA Grade', boundingPoly: {} }
      ],
      imageProperties: {
        dominantColors: {
          colors: [
            { red: 139, green: 120, blue: 80, score: 0.85 },
            { red: 125, green: 110, blue: 75, score: 0.75 }
          ]
        }
      }
    };

    sampleMetadata = {
      productType: 'coffee',
      farmerId: 'farmer456',
      location: {
        latitude: -1.2921,
        longitude: 36.8219
      },
      harvestDate: new Date('2024-02-10'),
      storageConditions: {
        temperature: 22,
        humidity: 60,
        duration: 20
      }
    };

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

  describe('Coffee Quality Analysis', () => {
    it('should analyze coffee bean quality accurately', async () => {
      const result = await coffeeAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);

      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('grade');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('detailedMetrics');

      expect(result.overallScore).toBeGreaterThan(60);
      expect(['A+', 'A', 'B', 'C', 'D']).toContain(result.grade);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should calculate bean size uniformity for coffee', async () => {
      const result = await coffeeAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);

      expect(result.detailedMetrics).toHaveProperty('beanSizeUniformity');
      expect(result.detailedMetrics.beanSizeUniformity).toBeGreaterThanOrEqual(0);
      expect(result.detailedMetrics.beanSizeUniformity).toBeLessThanOrEqual(100);
    });

    it('should assess color consistency for coffee processing', async () => {
      const result = await coffeeAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);

      expect(result.detailedMetrics).toHaveProperty('colorConsistency');
      expect(result.detailedMetrics.colorConsistency).toBeGreaterThanOrEqual(0);
      expect(result.detailedMetrics.colorConsistency).toBeLessThanOrEqual(100);
    });

    it('should calculate bean density estimation', async () => {
      const result = await coffeeAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);

      expect(result.detailedMetrics).toHaveProperty('beanDensity');
      expect(result.detailedMetrics.beanDensity).toBeGreaterThanOrEqual(0);
      expect(result.detailedMetrics.beanDensity).toBeLessThanOrEqual(100);
    });

    it('should determine screen size grade correctly', async () => {
      const result = await coffeeAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);

      expect(result.detailedMetrics).toHaveProperty('screenSize');
      expect([17, 15, 12, 10, 8]).toContain(result.detailedMetrics.screenSize);
    });

    it('should estimate aroma indicators', async () => {
      const result = await coffeeAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);

      expect(result.detailedMetrics).toHaveProperty('aroma');
      expect(result.detailedMetrics.aroma).toBeGreaterThanOrEqual(30);
      expect(result.detailedMetrics.aroma).toBeLessThanOrEqual(100);
    });
  });

  describe('Coffee Grading System', () => {
    it('should assign AA grade for large, high-quality beans', async () => {
      const highQualityMetrics = {
        beanSizeUniformity: 90,
        colorConsistency: 88,
        moistureContent: 85,
        defectCount: 1,
        beanDensity: 92,
        screenSize: 17, // AA grade
        processingQuality: 88
      };

      const grade = coffeeAnalyzer.calculateGrade(highQualityMetrics as any);
      expect(['A+', 'A']).toContain(grade);
    });

    it('should assign AB grade for medium-large beans', async () => {
      const mediumQualityMetrics = {
        beanSizeUniformity: 80,
        colorConsistency: 75,
        moistureContent: 78,
        defectCount: 3,
        beanDensity: 80,
        screenSize: 15, // AB grade
        processingQuality: 75
      };

      const grade = coffeeAnalyzer.calculateGrade(mediumQualityMetrics as any);
      expect(['A', 'B']).toContain(grade);
    });

    it('should assign lower grades for smaller or lower quality beans', async () => {
      const lowerQualityMetrics = {
        beanSizeUniformity: 60,
        colorConsistency: 55,
        moistureContent: 65,
        defectCount: 6,
        beanDensity: 65,
        screenSize: 12, // C grade
        processingQuality: 60
      };

      const grade = coffeeAnalyzer.calculateGrade(lowerQualityMetrics as any);
      expect(['B', 'C', 'D']).toContain(grade);
    });
  });

  describe('Processing Method Detection', () => {
    it('should detect washed processing method', async () => {
      mockVisionResults.colors = [
        { red: 120, green: 140, blue: 90, score: 0.8 }, // Green tint
        { red: 115, green: 135, blue: 85, score: 0.7 }
      ];

      const result = await coffeeAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);
      expect(result.detailedMetrics).toHaveProperty('processingQuality');
    });

    it('should detect natural processing method', async () => {
      mockVisionResults.colors = [
        { red: 150, green: 110, blue: 80, score: 0.8 }, // Red/brown tint
        { red: 145, green: 105, blue: 75, score: 0.7 }
      ];

      const result = await coffeeAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);
      expect(result.detailedMetrics).toHaveProperty('processingQuality');
    });

    it('should detect honey processing method', async () => {
      mockVisionResults.colors = [
        { red: 135, green: 125, blue: 95, score: 0.8 }, // Balanced colors
        { red: 130, green: 120, blue: 90, score: 0.7 }
      ];

      const result = await coffeeAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);
      expect(result.detailedMetrics).toHaveProperty('processingQuality');
    });
  });

  describe('Coffee-Specific Recommendations', () => {
    it('should recommend better screening for poor size uniformity', async () => {
      const analysis = {
        overallScore: 65,
        grade: 'C' as const,
        confidence: 0.8,
        detailedMetrics: {
          beanSizeUniformity: 60, // Poor uniformity
          colorConsistency: 75,
          moistureContent: 70,
          defectCount: 2,
          beanDensity: 75,
          screenSize: 12,
          processingQuality: 70,
          aroma: 70
        },
        recommendations: []
      };

      const recommendations = coffeeAnalyzer.generateRecommendations(analysis);

      expect(recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'processing',
            priority: 'high',
            title: expect.stringContaining('Sorting')
          })
        ])
      );
    });

    it('should recommend defect reduction for specialty coffee', async () => {
      const analysis = {
        overallScore: 70,
        grade: 'B' as const,
        confidence: 0.8,
        detailedMetrics: {
          beanSizeUniformity: 80,
          colorConsistency: 75,
          moistureContent: 75,
          defectCount: 8, // High defect count
          beanDensity: 80,
          screenSize: 15,
          processingQuality: 75,
          aroma: 75
        },
        recommendations: []
      };

      const recommendations = coffeeAnalyzer.generateRecommendations(analysis);

      expect(recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'improvement',
            priority: 'high',
            title: expect.stringContaining('Defect')
          })
        ])
      );
    });

    it('should recommend moisture optimization for coffee storage', async () => {
      const analysis = {
        overallScore: 72,
        grade: 'B' as const,
        confidence: 0.8,
        detailedMetrics: {
          beanSizeUniformity: 75,
          colorConsistency: 70,
          moistureContent: 85, // High moisture
          defectCount: 3,
          beanDensity: 75,
          screenSize: 15,
          processingQuality: 75,
          aroma: 70
        },
        recommendations: []
      };

      const recommendations = coffeeAnalyzer.generateRecommendations(analysis);

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

    it('should recommend processing improvements for low quality', async () => {
      const analysis = {
        overallScore: 65,
        grade: 'C' as const,
        confidence: 0.8,
        detailedMetrics: {
          beanSizeUniformity: 70,
          colorConsistency: 65,
          moistureContent: 70,
          defectCount: 4,
          beanDensity: 70,
          screenSize: 12,
          processingQuality: 60, // Low processing quality
          aroma: 65
        },
        recommendations: []
      };

      const recommendations = coffeeAnalyzer.generateRecommendations(analysis);

      expect(recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'processing',
            priority: 'medium',
            title: expect.stringContaining('Processing')
          })
        ])
      );
    });
  });

  describe('Coffee-Specific Edge Cases', () => {
    it('should handle peaberry coffee beans', async () => {
      // Mock peaberry (round) beans with different aspect ratio
      mockVisionResults.objects = [
        {
          name: 'coffee_bean',
          confidence: 0.95,
          boundingBox: {
            normalizedVertices: [
              { x: 0.1, y: 0.1 },
              { x: 0.2, y: 0.1 },
              { x: 0.2, y: 0.2 }, // Square aspect ratio for peaberry
              { x: 0.1, y: 0.2 }
            ]
          }
        }
      ];

      const result = await coffeeAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);
      expect(result).toHaveProperty('overallScore');
    });

    it('should handle elephant beans (large, flat)', async () => {
      mockVisionResults.objects = [
        {
          name: 'coffee_bean',
          confidence: 0.90,
          boundingBox: {
            normalizedVertices: [
              { x: 0.1, y: 0.1 },
              { x: 0.4, y: 0.1 }, // Very wide aspect ratio
              { x: 0.4, y: 0.25 },
              { x: 0.1, y: 0.25 }
            ]
          }
        }
      ];

      const result = await coffeeAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);
      expect(result).toHaveProperty('overallScore');
    });

    it('should handle mixed coffee bean shapes', async () => {
      mockVisionResults.objects = [
        {
          name: 'coffee_bean',
          confidence: 0.95,
          boundingBox: {
            normalizedVertices: [
              { x: 0.1, y: 0.1 },
              { x: 0.2, y: 0.1 },
              { x: 0.2, y: 0.25 },
              { x: 0.1, y: 0.25 }
            ]
          }
        },
        {
          name: 'coffee_bean',
          confidence: 0.90,
          boundingBox: {
            normalizedVertices: [
              { x: 0.3, y: 0.2 },
              { x: 0.5, y: 0.2 },
              { x: 0.5, y: 0.3 },
              { x: 0.3, y: 0.3 }
            ]
          }
        }
      ];

      const result = await coffeeAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);
      expect(result.detailedMetrics.beanSizeUniformity).toBeLessThan(95); // Should reflect variation
    });
  });

  describe('Performance and Reliability', () => {
    it('should complete coffee analysis within reasonable time', async () => {
      const startTime = Date.now();
      
      await coffeeAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(8000); // Should complete within 8 seconds
    });

    it('should produce consistent grading for similar quality coffee', async () => {
      const result1 = await coffeeAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);
      const result2 = await coffeeAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);

      expect(result1.grade).toBe(result2.grade);
      expect(Math.abs(result1.overallScore - result2.overallScore)).toBeLessThan(5);
    });

    it('should handle various storage conditions for aroma estimation', async () => {
      const freshStorageMetadata = {
        ...sampleMetadata,
        storageConditions: {
          temperature: 20,
          humidity: 55,
          duration: 5 // Fresh
        }
      };

      const result = await coffeeAnalyzer.analyzeQuality(sampleImageBuffer, freshStorageMetadata);
      expect(result.detailedMetrics.aroma).toBeGreaterThan(70);
    });
  });

  describe('Integration with Coffee Industry Standards', () => {
    it('should respect Specialty Coffee Association standards', async () => {
      const result = await coffeeAnalyzer.analyzeQuality(sampleImageBuffer, sampleMetadata);

      // SCA standards compliance
      if (result.grade === 'A+' || result.grade === 'A') {
        expect(result.detailedMetrics.defectCount).toBeLessThan(5);
        expect(result.detailedMetrics.beanSizeUniformity).toBeGreaterThan(75);
      }
    });

    it('should differentiate between commercial and specialty grades', async () => {
      const commercialMetrics = {
        beanSizeUniformity: 65,
        colorConsistency: 60,
        moistureContent: 70,
        defectCount: 8,
        beanDensity: 70,
        screenSize: 12,
        processingQuality: 65
      };

      const specialtyMetrics = {
        beanSizeUniformity: 88,
        colorConsistency: 85,
        moistureContent: 82,
        defectCount: 2,
        beanDensity: 88,
        screenSize: 17,
        processingQuality: 85
      };

      const commercialGrade = coffeeAnalyzer.calculateGrade(commercialMetrics as any);
      const specialtyGrade = coffeeAnalyzer.calculateGrade(specialtyMetrics as any);

      expect(['C', 'D']).toContain(commercialGrade);
      expect(['A+', 'A']).toContain(specialtyGrade);
    });
  });
});