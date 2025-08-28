import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import multer from 'fastify-multer';
import { QualityAnalysisService } from '../services/qualityAnalysisService';
import { QualityAnalysis } from '../models/QualityAnalysis';
import { Product } from '../models/Product';
import { AppError, ValidationError, NotFoundError } from '../middleware/errorHandler';
import { getCurrentUser } from '../middleware/authentication';
import { QualityAnalysisRequest, QualityAnalysisResponse } from '../types';

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const qualityAnalysisService = new QualityAnalysisService();

export default async function aiRoutes(app: FastifyInstance) {
  
  // Analyze product quality from images
  app.post('/analyze-quality', {
    schema: {
      description: 'Analyze agricultural product quality using AI',
      tags: ['AI Analysis'],
      security: [{ Bearer: [] }],
      consumes: ['multipart/form-data'],
      body: {
        type: 'object',
        required: ['productType'],
        properties: {
          productType: { 
            type: 'string', 
            enum: ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'] 
          },
          productId: { type: 'string' },
          images: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 5
          },
          gpsCoordinates: {
            type: 'object',
            properties: {
              latitude: { type: 'number', minimum: -90, maximum: 90 },
              longitude: { type: 'number', minimum: -180, maximum: 180 }
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
                status: { type: 'string' },
                results: { type: 'object' },
                processingTime: { type: 'number' }
              }
            }
          }
        }
      }
    },
    preHandler: [app.authenticate, upload.array('imageFiles', 5)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      
      if (!user || user.userType !== 'farmer') {
        throw new AppError('Only farmers can analyze product quality', 403, 'FORBIDDEN');
      }

      const { productType, productId, images, gpsCoordinates } = request.body as any;
      const uploadedFiles = (request as any).files;

      // Collect image data from both form fields and file uploads
      const imageData: string[] = [];
      
      // Add base64 images if provided
      if (images && Array.isArray(images)) {
        imageData.push(...images);
      }

      // Add uploaded files
      if (uploadedFiles && uploadedFiles.length > 0) {
        for (const file of uploadedFiles) {
          const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
          imageData.push(base64);
        }
      }

      if (imageData.length === 0) {
        throw new ValidationError('At least one image is required for analysis');
      }

      // Validate product exists if productId is provided
      if (productId) {
        const product = await Product.findById(productId);
        if (!product) {
          throw new NotFoundError('Product not found');
        }
        if (product.farmerId.toString() !== user._id) {
          throw new AppError('You can only analyze your own products', 403, 'FORBIDDEN');
        }
        if (product.type !== productType) {
          throw new ValidationError('Product type mismatch');
        }
      }

      // Perform quality analysis
      const analysisResult = await qualityAnalysisService.analyzeProductQuality(
        imageData,
        productType,
        user._id,
        productId,
        {
          gpsCoordinates,
          // TODO: Add weather data integration
          weatherConditions: undefined
        }
      );

      // Save analysis to database
      const qualityAnalysis = new QualityAnalysis(analysisResult);
      await qualityAnalysis.save();

      // Update product quality metrics if productId provided
      if (productId && analysisResult.analysisResults) {
        await Product.findByIdAndUpdate(productId, {
          qualityMetrics: {
            grade: analysisResult.analysisResults.grade,
            moistureContent: analysisResult.analysisResults.metrics.moisture.estimatedMoisture,
            purity: Math.max(0, 100 - analysisResult.analysisResults.metrics.defects.defectRate),
            defectRate: analysisResult.analysisResults.metrics.defects.defectRate,
            colorScore: analysisResult.analysisResults.metrics.color.score,
            sizeScore: analysisResult.analysisResults.metrics.size.sizeVariability,
            aiAnalysisId: qualityAnalysis._id,
            overallScore: analysisResult.analysisResults.overallScore,
            confidence: analysisResult.analysisResults.confidence,
            lastAnalyzed: new Date()
          }
        });
      }

      const response: QualityAnalysisResponse = {
        analysisId: qualityAnalysis._id,
        results: analysisResult.analysisResults,
        status: 'completed',
        processingTime: analysisResult.metadata.processingTime
      };

      return reply.send({
        success: true,
        data: response
      });

    } catch (error) {
      console.error('Quality analysis error:', error);
      throw error;
    }
  });

  // Get analysis results by ID
  app.get<{ Params: { analysisId: string } }>('/analysis/:analysisId', {
    schema: {
      description: 'Get quality analysis results by ID',
      tags: ['AI Analysis'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        required: ['analysisId'],
        properties: {
          analysisId: { type: 'string' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest<{ Params: { analysisId: string } }>, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { analysisId } = request.params;

      const analysis = await QualityAnalysis.findById(analysisId)
        .populate('productId', 'name type quantity unit')
        .populate('farmerId', 'profile.firstName profile.lastName profile.farmName');

      if (!analysis) {
        throw new NotFoundError('Analysis not found');
      }

      // Check access permissions
      if (user.userType === 'farmer' && analysis.farmerId._id.toString() !== user._id) {
        throw new AppError('You can only view your own analyses', 403, 'FORBIDDEN');
      }

      return reply.send({
        success: true,
        data: analysis
      });

    } catch (error) {
      throw error;
    }
  });

  // Get analysis history for a farmer
  app.get('/history', {
    schema: {
      description: 'Get quality analysis history for the authenticated farmer',
      tags: ['AI Analysis'],
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          productType: { 
            type: 'string', 
            enum: ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'] 
          },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          sortBy: { type: 'string', enum: ['createdAt', 'overallScore', 'grade'], default: 'createdAt' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      
      if (!user || user.userType !== 'farmer') {
        throw new AppError('Only farmers can view analysis history', 403, 'FORBIDDEN');
      }

      const { productType, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = request.query as any;

      const query: any = { farmerId: user._id, status: 'completed' };
      if (productType) {
        query.productType = productType;
      }

      const sortOptions: any = {};
      if (sortBy === 'overallScore') {
        sortOptions['analysisResults.overallScore'] = sortOrder === 'asc' ? 1 : -1;
      } else if (sortBy === 'grade') {
        sortOptions['analysisResults.grade'] = sortOrder === 'asc' ? 1 : -1;
      } else {
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
      }

      const skip = (page - 1) * limit;

      const [analyses, total] = await Promise.all([
        QualityAnalysis.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .populate('productId', 'name type quantity unit'),
        QualityAnalysis.countDocuments(query)
      ]);

      const pages = Math.ceil(total / limit);

      return reply.send({
        success: true,
        data: analyses.map(analysis => analysis.getSummary()),
        pagination: {
          page,
          limit,
          total,
          pages,
          hasNext: page < pages,
          hasPrev: page > 1
        }
      });

    } catch (error) {
      throw error;
    }
  });

  // Get quality statistics
  app.get('/statistics', {
    schema: {
      description: 'Get quality analysis statistics',
      tags: ['AI Analysis'],
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          productType: { 
            type: 'string', 
            enum: ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'] 
          },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { productType, dateFrom, dateTo } = request.query as any;

      const farmerId = user.userType === 'farmer' ? user._id : undefined;
      const fromDate = dateFrom ? new Date(dateFrom) : undefined;
      const toDate = dateTo ? new Date(dateTo) : undefined;

      const stats = await QualityAnalysis.getQualityStats(
        productType,
        farmerId,
        fromDate,
        toDate
      );

      return reply.send({
        success: true,
        data: stats
      });

    } catch (error) {
      throw error;
    }
  });

  // Compare analysis with previous results
  app.get<{ Params: { analysisId: string } }>('/analysis/:analysisId/compare', {
    schema: {
      description: 'Compare analysis with previous results',
      tags: ['AI Analysis'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        required: ['analysisId'],
        properties: {
          analysisId: { type: 'string' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest<{ Params: { analysisId: string } }>, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { analysisId } = request.params;

      const analysis = await QualityAnalysis.findById(analysisId);

      if (!analysis) {
        throw new NotFoundError('Analysis not found');
      }

      // Check access permissions
      if (user.userType === 'farmer' && analysis.farmerId.toString() !== user._id) {
        throw new AppError('You can only compare your own analyses', 403, 'FORBIDDEN');
      }

      const comparison = await analysis.compareWithPrevious();

      return reply.send({
        success: true,
        data: {
          currentAnalysis: analysis.getSummary(),
          comparison
        }
      });

    } catch (error) {
      throw error;
    }
  });

  // Get analysis trends
  app.get('/trends', {
    schema: {
      description: 'Get quality analysis trends over time',
      tags: ['AI Analysis'],
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          productType: { 
            type: 'string', 
            enum: ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'] 
          },
          period: { type: 'string', enum: ['week', 'month', 'quarter', 'year'], default: 'month' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      
      if (!user || user.userType !== 'farmer') {
        throw new AppError('Only farmers can view analysis trends', 403, 'FORBIDDEN');
      }

      const { productType, period = 'month' } = request.query as any;

      // Calculate date range based on period
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      const matchStage: any = {
        farmerId: new mongoose.Types.ObjectId(user._id),
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate }
      };

      if (productType) {
        matchStage.productType = productType;
      }

      const trends = await QualityAnalysis.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              week: { $week: '$createdAt' }
            },
            averageScore: { $avg: '$analysisResults.overallScore' },
            analysisCount: { $sum: 1 },
            gradeDistribution: { $push: '$analysisResults.grade' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 } }
      ]);

      return reply.send({
        success: true,
        data: trends
      });

    } catch (error) {
      throw error;
    }
  });

  // Delete analysis (soft delete)
  app.delete<{ Params: { analysisId: string } }>('/analysis/:analysisId', {
    schema: {
      description: 'Delete quality analysis',
      tags: ['AI Analysis'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        required: ['analysisId'],
        properties: {
          analysisId: { type: 'string' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest<{ Params: { analysisId: string } }>, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { analysisId } = request.params;

      const analysis = await QualityAnalysis.findById(analysisId);

      if (!analysis) {
        throw new NotFoundError('Analysis not found');
      }

      // Check access permissions
      if (user.userType !== 'farmer' || analysis.farmerId.toString() !== user._id) {
        throw new AppError('You can only delete your own analyses', 403, 'FORBIDDEN');
      }

      // Soft delete by updating status
      analysis.status = 'failed';
      await analysis.save();

      return reply.send({
        success: true,
        message: 'Analysis deleted successfully'
      });

    } catch (error) {
      throw error;
    }
  });
}

// Note: Import mongoose for aggregation
import mongoose from 'mongoose';