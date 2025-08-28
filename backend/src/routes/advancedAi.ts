import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import multer from 'fastify-multer';
import { QualityAnalysisService } from '../services/qualityAnalysisService';
import { QualityAnalysis } from '../models/QualityAnalysis';
import { Product } from '../models/Product';
import { CocoaAnalyzer } from '../services/CocoaAnalyzer';
import { CoffeeAnalyzer } from '../services/CoffeeAnalyzer';
import { AdvancedPricingEngine } from '../services/AdvancedPricingEngine';
import { AppError, ValidationError, NotFoundError } from '../middleware/errorHandler';
import { getCurrentUser } from '../middleware/authentication';
import { GoogleVisionClient } from '@google-cloud/vision';
import { MarketDataService } from '../services/marketDataService';
import { WeatherService } from '../services/externalApiService';
import Bull from 'bull';
import Redis from 'ioredis';

// Initialize services
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const visionClient = new GoogleVisionClient();
const marketDataService = new MarketDataService();
const weatherService = new WeatherService();
const pricingEngine = new AdvancedPricingEngine(marketDataService, weatherService);

// Initialize job queues for batch processing
const qualityAnalysisQueue = new Bull('quality analysis', {
  redis: { host: 'localhost', port: 6379 }
});

const batchAnalysisQueue = new Bull('batch analysis', {
  redis: { host: 'localhost', port: 6379 }
});

// Configure multer for enhanced file uploads
const upload = multer({
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for high-res images
    files: 10 // Support batch uploads
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP image files are allowed'), false);
    }
  }
});

// Interface definitions for enhanced API
interface BatchAnalysisRequest {
  products: Array<{
    productId?: string;
    commodity: string;
    variety?: string;
    images: string[];
    metadata?: {
      harvestDate?: string;
      processingMethod?: string;
      storageConditions?: any;
      gpsCoordinates?: {
        latitude: number;
        longitude: number;
      };
    };
  }>;
  analysisOptions?: {
    includeRecommendations: boolean;
    includePricing: boolean;
    includeMarketAnalysis: boolean;
    detailedMetrics: boolean;
  };
}

interface ComprehensiveAnalysisResponse {
  batchId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  totalProducts: number;
  completedCount: number;
  failedCount: number;
  results: Array<{
    productId?: string;
    analysisId: string;
    status: string;
    qualityResults?: any;
    pricingAnalysis?: any;
    marketPosition?: any;
    recommendations?: any[];
    errors?: string[];
  }>;
  summary?: {
    averageQualityScore: number;
    gradeDistribution: Record<string, number>;
    totalEstimatedValue: number;
    topRecommendations: string[];
  };
  processingTime: number;
  estimatedCompletion?: Date;
}

export default async function advancedAiRoutes(app: FastifyInstance) {

  // Enhanced single product quality analysis
  app.post('/v2/analyze-quality', {
    schema: {
      description: 'Advanced AI quality analysis with comprehensive insights',
      tags: ['AI Analysis v2'],
      security: [{ Bearer: [] }],
      consumes: ['multipart/form-data'],
      body: {
        type: 'object',
        required: ['commodity'],
        properties: {
          commodity: { 
            type: 'string', 
            enum: ['cocoa', 'coffee', 'cotton', 'maize', 'rice', 'peanuts', 'cashew', 'palm_oil'] 
          },
          productId: { type: 'string' },
          variety: { type: 'string' },
          harvestDate: { type: 'string', format: 'date' },
          processingMethod: { type: 'string' },
          storageConditions: { type: 'object' },
          gpsCoordinates: {
            type: 'object',
            properties: {
              latitude: { type: 'number', minimum: -90, maximum: 90 },
              longitude: { type: 'number', minimum: -180, maximum: 180 }
            }
          },
          analysisOptions: {
            type: 'object',
            properties: {
              includeRecommendations: { type: 'boolean', default: true },
              includePricing: { type: 'boolean', default: true },
              includeMarketAnalysis: { type: 'boolean', default: false },
              detailedMetrics: { type: 'boolean', default: true }
            }
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                analysisId: { type: 'string' },
                qualityResults: { type: 'object' },
                pricingAnalysis: { type: 'object' },
                marketPosition: { type: 'object' },
                recommendations: { type: 'array' },
                benchmarking: { type: 'object' },
                processingTime: { type: 'number' }
              }
            }
          }
        }
      }
    },
    preHandler: [app.authenticate, upload.array('images', 5)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const requestData = request.body as any;
      const uploadedFiles = (request as any).files;

      // Validate user permissions
      if (!user || !['farmer', 'buyer', 'admin'].includes(user.role)) {
        throw new AppError('Insufficient permissions for quality analysis', 403, 'FORBIDDEN');
      }

      // Process uploaded images
      const images: string[] = [];
      if (uploadedFiles && uploadedFiles.length > 0) {
        for (const file of uploadedFiles) {
          const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
          images.push(base64);
        }
      }

      if (images.length === 0) {
        throw new ValidationError('At least one image is required for analysis');
      }

      // Initialize appropriate analyzer
      let analyzer;
      switch (requestData.commodity) {
        case 'cocoa':
          analyzer = new CocoaAnalyzer(visionClient);
          break;
        case 'coffee':
          analyzer = new CoffeeAnalyzer(visionClient);
          break;
        default:
          throw new ValidationError(`Commodity ${requestData.commodity} not yet supported`);
      }

      // Prepare metadata
      const metadata = {
        productType: requestData.commodity,
        farmerId: user._id,
        location: requestData.gpsCoordinates,
        harvestDate: requestData.harvestDate ? new Date(requestData.harvestDate) : new Date(),
        processingMethod: requestData.processingMethod,
        storageConditions: requestData.storageConditions
      };

      const startTime = Date.now();

      // Perform quality analysis
      const imageBuffer = Buffer.from(images[0].split(',')[1], 'base64');
      const qualityResults = await analyzer.analyzeQuality(imageBuffer, metadata);

      // Create quality analysis record
      const analysisRecord = new QualityAnalysis({
        productId: requestData.productId,
        farmerId: user._id,
        commodity: requestData.commodity,
        imageData: {
          originalUrl: 'temp_url', // Would be S3 URL in production
          imageSize: imageBuffer.length,
          dimensions: { width: 1920, height: 1080 }, // Would extract from image
          format: 'jpeg',
          uploadedAt: new Date()
        },
        visionApiResults: {
          objects: [],
          colors: [],
          labels: [],
          imageProperties: {}
        },
        qualityResults: {
          overallScore: qualityResults.overallScore,
          grade: qualityResults.grade,
          confidence: qualityResults.confidence,
          detailedMetrics: qualityResults.detailedMetrics,
          visualQualityIndicators: {
            surfaceQuality: 85,
            shapeRegularity: 80,
            textureConsistency: 82,
            contamination: 5,
            overallAppearance: 83
          },
          processingQuality: {
            score: 85,
            processingMethod: requestData.processingMethod || 'traditional'
          }
        },
        recommendations: qualityResults.recommendations,
        analysisMetadata: {
          processingTime: Date.now() - startTime,
          algorithmVersion: '2.0.0',
          modelConfidence: qualityResults.confidence,
          imageQuality: {
            score: 88,
            issues: [],
            recommendations: []
          },
          validityPeriod: 7,
          analysisDate: new Date(),
          lastUpdated: new Date()
        },
        pricingImpact: {
          qualityMultiplier: 1.0,
          estimatedPriceRange: {
            minimum: 2000,
            maximum: 2500,
            currency: 'XOF'
          },
          marketPositioning: 'standard'
        },
        status: 'completed'
      });

      await analysisRecord.save();

      let response: any = {
        analysisId: analysisRecord._id,
        qualityResults: {
          overallScore: qualityResults.overallScore,
          grade: qualityResults.grade,
          confidence: qualityResults.confidence,
          detailedMetrics: requestData.analysisOptions?.detailedMetrics ? 
            qualityResults.detailedMetrics : 
            {
              moistureContent: qualityResults.detailedMetrics.moistureContent,
              defectCount: qualityResults.detailedMetrics.defectCount
            }
        },
        processingTime: Date.now() - startTime
      };

      // Add pricing analysis if requested
      if (requestData.analysisOptions?.includePricing && requestData.productId) {
        try {
          const product = await Product.findById(requestData.productId);
          if (product) {
            const marketConditions = {
              commodity: requestData.commodity,
              region: 'West Africa',
              country: 'Côte d\'Ivoire',
              supplyLevel: 'medium' as const,
              demandLevel: 'high' as const,
              seasonalFactor: 1.1,
              weatherImpact: 0.05,
              globalPrices: {
                current: 2200,
                trend: 'rising' as const,
                volatility: 0.15,
                historicalData: []
              },
              localMarketData: {
                averagePrice: 2100,
                priceRange: { min: 1800, max: 2400 },
                tradingVolume: 1500,
                competitorCount: 12,
                marketShare: 0.08
              },
              economicIndicators: {
                exchangeRate: 655,
                inflation: 3.2,
                gdpGrowth: 4.1,
                agriculturalIndex: 108
              }
            };

            const pricingAnalysis = await pricingEngine.calculatePrice(
              product,
              marketConditions
            );

            response.pricingAnalysis = pricingAnalysis;
          }
        } catch (pricingError) {
          console.error('Pricing analysis failed:', pricingError);
          response.pricingAnalysis = { error: 'Pricing analysis unavailable' };
        }
      }

      // Add recommendations if requested
      if (requestData.analysisOptions?.includeRecommendations) {
        response.recommendations = qualityResults.recommendations;
      }

      // Add market analysis if requested
      if (requestData.analysisOptions?.includeMarketAnalysis) {
        response.marketPosition = {
          percentile: 75,
          competitive: true,
          suggestions: ['Consider premium positioning', 'Focus on quality certifications']
        };
      }

      // Add benchmarking
      response.benchmarking = {
        regionalAverage: 72,
        seasonalAverage: 78,
        farmerHistorical: 76,
        percentileRank: 82
      };

      return reply.send({
        success: true,
        data: response
      });

    } catch (error) {
      console.error('Enhanced quality analysis error:', error);
      throw error;
    }
  });

  // Batch quality analysis endpoint
  app.post('/v2/analyze-batch', {
    schema: {
      description: 'Batch process multiple products for quality analysis',
      tags: ['AI Analysis v2'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['products'],
        properties: {
          products: {
            type: 'array',
            minItems: 1,
            maxItems: 50,
            items: {
              type: 'object',
              required: ['commodity'],
              properties: {
                productId: { type: 'string' },
                commodity: { type: 'string' },
                variety: { type: 'string' },
                images: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1,
                  maxItems: 3
                },
                metadata: { type: 'object' }
              }
            }
          },
          analysisOptions: { type: 'object' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { products, analysisOptions } = request.body as BatchAnalysisRequest;

      if (!user || !['farmer', 'buyer', 'admin'].includes(user.role)) {
        throw new AppError('Insufficient permissions for batch analysis', 403, 'FORBIDDEN');
      }

      if (products.length > 50) {
        throw new ValidationError('Maximum 50 products per batch');
      }

      // Generate batch ID
      const batchId = `BATCH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Queue batch analysis job
      const job = await batchAnalysisQueue.add('process-batch', {
        batchId,
        userId: user._id,
        products,
        analysisOptions: analysisOptions || {
          includeRecommendations: true,
          includePricing: false,
          includeMarketAnalysis: false,
          detailedMetrics: true
        }
      }, {
        priority: user.role === 'admin' ? 1 : 5,
        attempts: 3,
        backoff: 'exponential'
      });

      // Store batch metadata in Redis
      await redis.setex(`batch:${batchId}`, 3600, JSON.stringify({
        status: 'queued',
        totalProducts: products.length,
        completedCount: 0,
        failedCount: 0,
        createdAt: new Date(),
        estimatedCompletion: new Date(Date.now() + products.length * 30000) // 30s per product
      }));

      const response: ComprehensiveAnalysisResponse = {
        batchId,
        status: 'queued',
        totalProducts: products.length,
        completedCount: 0,
        failedCount: 0,
        results: [],
        processingTime: 0,
        estimatedCompletion: new Date(Date.now() + products.length * 30000)
      };

      return reply.send({
        success: true,
        data: response
      });

    } catch (error) {
      console.error('Batch analysis error:', error);
      throw error;
    }
  });

  // Get batch analysis status and results
  app.get<{ Params: { batchId: string } }>('/v2/batch/:batchId', {
    schema: {
      description: 'Get batch analysis status and results',
      tags: ['AI Analysis v2'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        required: ['batchId'],
        properties: {
          batchId: { type: 'string' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest<{ Params: { batchId: string } }>, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { batchId } = request.params;

      // Get batch metadata from Redis
      const batchDataStr = await redis.get(`batch:${batchId}`);
      if (!batchDataStr) {
        throw new NotFoundError('Batch analysis not found');
      }

      const batchData = JSON.parse(batchDataStr);

      // Get completed analyses for this batch
      const analyses = await QualityAnalysis.find({
        analysisId: { $regex: `^${batchId}_` }
      }).populate('productId', 'commodity variety quantity');

      const response: ComprehensiveAnalysisResponse = {
        batchId,
        status: batchData.status,
        totalProducts: batchData.totalProducts,
        completedCount: analyses.length,
        failedCount: batchData.failedCount || 0,
        results: analyses.map(analysis => ({
          productId: analysis.productId,
          analysisId: analysis.analysisId,
          status: analysis.status,
          qualityResults: {
            overallScore: analysis.qualityResults.overallScore,
            grade: analysis.qualityResults.grade,
            confidence: analysis.qualityResults.confidence
          }
        })),
        processingTime: batchData.processingTime || 0
      };

      // Add summary if batch is completed
      if (batchData.status === 'completed' && analyses.length > 0) {
        const scores = analyses.map(a => a.qualityResults.overallScore);
        const grades = analyses.reduce((acc, a) => {
          acc[a.qualityResults.grade] = (acc[a.qualityResults.grade] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        response.summary = {
          averageQualityScore: scores.reduce((a, b) => a + b, 0) / scores.length,
          gradeDistribution: grades,
          totalEstimatedValue: 0, // Would calculate based on pricing
          topRecommendations: []
        };
      }

      return reply.send({
        success: true,
        data: response
      });

    } catch (error) {
      console.error('Batch status error:', error);
      throw error;
    }
  });

  // Get quality analysis history with advanced filtering
  app.get('/v2/analysis/history', {
    schema: {
      description: 'Get quality analysis history with advanced filtering',
      tags: ['AI Analysis v2'],
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          commodity: { type: 'string' },
          grade: { type: 'string' },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
          minScore: { type: 'number', minimum: 0, maximum: 100 },
          maxScore: { type: 'number', minimum: 0, maximum: 100 },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          sortBy: { type: 'string', enum: ['date', 'score', 'grade'], default: 'date' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const query = request.query as any;

      // Build MongoDB query
      const filter: any = { farmerId: user._id, status: 'completed' };

      if (query.commodity) filter.commodity = query.commodity;
      if (query.grade) filter['qualityResults.grade'] = query.grade;
      if (query.minScore || query.maxScore) {
        filter['qualityResults.overallScore'] = {};
        if (query.minScore) filter['qualityResults.overallScore'].$gte = query.minScore;
        if (query.maxScore) filter['qualityResults.overallScore'].$lte = query.maxScore;
      }
      if (query.dateFrom || query.dateTo) {
        filter['analysisMetadata.analysisDate'] = {};
        if (query.dateFrom) filter['analysisMetadata.analysisDate'].$gte = new Date(query.dateFrom);
        if (query.dateTo) filter['analysisMetadata.analysisDate'].$lte = new Date(query.dateTo);
      }

      // Build sort criteria
      const sortField = query.sortBy === 'score' ? 'qualityResults.overallScore' :
                       query.sortBy === 'grade' ? 'qualityResults.grade' :
                       'analysisMetadata.analysisDate';
      const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

      // Execute query with pagination
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 20;
      const skip = (page - 1) * limit;

      const [analyses, total] = await Promise.all([
        QualityAnalysis.find(filter)
          .sort({ [sortField]: sortOrder })
          .skip(skip)
          .limit(limit)
          .populate('productId', 'commodity variety quantity')
          .lean(),
        QualityAnalysis.countDocuments(filter)
      ]);

      return reply.send({
        success: true,
        data: {
          analyses: analyses.map(analysis => ({
            analysisId: analysis.analysisId,
            commodity: analysis.commodity,
            qualityResults: {
              overallScore: analysis.qualityResults.overallScore,
              grade: analysis.qualityResults.grade,
              confidence: analysis.qualityResults.confidence
            },
            analysisDate: analysis.analysisMetadata.analysisDate,
            recommendations: analysis.recommendations.filter(r => r.priority === 'high').slice(0, 3)
          })),
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      console.error('Analysis history error:', error);
      throw error;
    }
  });

  // Quality trends and analytics endpoint
  app.get('/v2/analytics/trends', {
    schema: {
      description: 'Get quality trends and analytics for farmer',
      tags: ['AI Analysis v2'],
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          commodity: { type: 'string' },
          period: { type: 'string', enum: ['7d', '30d', '90d', '1y'], default: '30d' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { commodity, period } = request.query as any;

      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const filter: any = {
        farmerId: user._id,
        status: 'completed',
        'analysisMetadata.analysisDate': { $gte: startDate }
      };

      if (commodity) filter.commodity = commodity;

      const analyses = await QualityAnalysis.find(filter)
        .sort({ 'analysisMetadata.analysisDate': 1 })
        .lean();

      if (analyses.length === 0) {
        return reply.send({
          success: true,
          data: {
            trend: 'insufficient_data',
            analytics: {}
          }
        });
      }

      // Calculate trends
      const scores = analyses.map(a => a.qualityResults.overallScore);
      const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
      const secondHalf = scores.slice(Math.floor(scores.length / 2));

      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      let trend = 'stable';
      if (secondAvg > firstAvg + 5) trend = 'improving';
      else if (secondAvg < firstAvg - 5) trend = 'declining';

      // Grade distribution
      const gradeDistribution = analyses.reduce((acc, a) => {
        acc[a.qualityResults.grade] = (acc[a.qualityResults.grade] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return reply.send({
        success: true,
        data: {
          trend,
          analytics: {
            totalAnalyses: analyses.length,
            averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
            improvementRate: ((secondAvg - firstAvg) / firstAvg) * 100,
            gradeDistribution,
            scoreHistory: analyses.map(a => ({
              date: a.analysisMetadata.analysisDate,
              score: a.qualityResults.overallScore,
              grade: a.qualityResults.grade
            }))
          }
        }
      });

    } catch (error) {
      console.error('Analytics trends error:', error);
      throw error;
    }
  });
}

// Process batch analysis jobs
batchAnalysisQueue.process('process-batch', async (job) => {
  const { batchId, userId, products, analysisOptions } = job.data;
  
  try {
    // Update batch status to processing
    await redis.setex(`batch:${batchId}`, 3600, JSON.stringify({
      status: 'processing',
      totalProducts: products.length,
      completedCount: 0,
      failedCount: 0,
      startedAt: new Date()
    }));

    let completedCount = 0;
    let failedCount = 0;
    const startTime = Date.now();

    // Process each product
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      try {
        // Simulate analysis processing
        const analysisRecord = new QualityAnalysis({
          analysisId: `${batchId}_${i + 1}`,
          productId: product.productId,
          farmerId: userId,
          commodity: product.commodity,
          imageData: {
            originalUrl: 'batch_temp_url',
            imageSize: 1024000,
            dimensions: { width: 1920, height: 1080 },
            format: 'jpeg',
            uploadedAt: new Date()
          },
          visionApiResults: {
            objects: [],
            colors: [],
            labels: [],
            imageProperties: {}
          },
          qualityResults: {
            overallScore: 70 + Math.random() * 30, // Simulated score
            grade: ['A', 'B', 'C'][Math.floor(Math.random() * 3)] as any,
            confidence: 0.7 + Math.random() * 0.3,
            detailedMetrics: {},
            visualQualityIndicators: {
              surfaceQuality: 80,
              shapeRegularity: 75,
              textureConsistency: 82,
              contamination: 8,
              overallAppearance: 79
            },
            processingQuality: {
              score: 78
            }
          },
          recommendations: [],
          analysisMetadata: {
            processingTime: 2000 + Math.random() * 3000,
            algorithmVersion: '2.0.0',
            modelConfidence: 0.85,
            imageQuality: { score: 85 },
            validityPeriod: 7,
            analysisDate: new Date(),
            lastUpdated: new Date()
          },
          pricingImpact: {
            qualityMultiplier: 1.0,
            estimatedPriceRange: {
              minimum: 2000,
              maximum: 2500,
              currency: 'XOF'
            },
            marketPositioning: 'standard'
          },
          status: 'completed'
        });

        await analysisRecord.save();
        completedCount++;

        // Update progress
        job.progress((completedCount / products.length) * 100);
        
      } catch (error) {
        console.error(`Failed to process product ${i + 1}:`, error);
        failedCount++;
      }
    }

    const processingTime = Date.now() - startTime;

    // Update final batch status
    await redis.setex(`batch:${batchId}`, 3600, JSON.stringify({
      status: 'completed',
      totalProducts: products.length,
      completedCount,
      failedCount,
      processingTime,
      completedAt: new Date()
    }));

    return { success: true, completedCount, failedCount };

  } catch (error) {
    console.error('Batch processing failed:', error);
    
    await redis.setex(`batch:${batchId}`, 3600, JSON.stringify({
      status: 'failed',
      error: error.message,
      failedAt: new Date()
    }));

    throw error;
  }
});