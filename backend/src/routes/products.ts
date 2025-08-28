import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { QualityAnalysis } from '../models/QualityAnalysis';
import { AppError, ValidationError, NotFoundError, AuthorizationError } from '../middleware/errorHandler';
import { getCurrentUser } from '../middleware/authentication';
import { cache } from '../config/redis';
import { IProduct, PaginationOptions } from '../types';

export default async function productRoutes(app: FastifyInstance) {

  // Create a new product listing
  app.post('/', {
    schema: {
      tags: ['Products'],
      security: [{ Bearer: [] }],
      consumes: ['multipart/form-data'],
      body: {
        type: 'object',
        required: ['name', 'type', 'description', 'quantity', 'unit', 'pricePerUnit', 'currency', 'harvestDate', 'availableFrom', 'qualityMetrics', 'location', 'storageConditions'],
        properties: {
          name: { type: 'string', maxLength: 100 },
          type: { type: 'string', enum: ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'] },
          variety: { type: 'string', maxLength: 50 },
          description: { type: 'string', maxLength: 1000 },
          quantity: { type: 'number', minimum: 1 },
          unit: { type: 'string', enum: ['kg', 'tons', 'bags'] },
          pricePerUnit: { type: 'number', minimum: 0.01 },
          currency: { type: 'string', enum: ['USD', 'EUR', 'XOF', 'GHS', 'NGN', 'KES', 'TZS', 'UGX'] },
          harvestDate: { type: 'string', format: 'date' },
          availableFrom: { type: 'string', format: 'date' },
          availableUntil: { type: 'string', format: 'date' },
          qualityMetrics: {
            type: 'object',
            required: ['moistureContent', 'purity'],
            properties: {
              moistureContent: { type: 'number', minimum: 0, maximum: 100 },
              purity: { type: 'number', minimum: 0, maximum: 100 },
              defectRate: { type: 'number', minimum: 0, maximum: 100 },
              colorScore: { type: 'number', minimum: 0, maximum: 100 },
              sizeScore: { type: 'number', minimum: 0, maximum: 100 }
            }
          },
          location: {
            type: 'object',
            required: ['country', 'region', 'city', 'coordinates'],
            properties: {
              country: { type: 'string' },
              region: { type: 'string' },
              city: { type: 'string' },
              coordinates: {
                type: 'object',
                required: ['latitude', 'longitude'],
                properties: {
                  latitude: { type: 'number', minimum: -90, maximum: 90 },
                  longitude: { type: 'number', minimum: -180, maximum: 180 }
                }
              },
              address: { type: 'string' }
            }
          },
          certifications: {
            type: 'array',
            items: { type: 'string', enum: ['organic', 'fairtrade', 'rainforest_alliance', 'utz', 'global_gap', 'iso22000', 'haccp'] }
          },
          storageConditions: { type: 'string', maxLength: 500 }
        }
      }
    },
    preHandler: [app.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      
      if (!user || user.role !== 'farmer') {
        throw new AuthorizationError('Only farmers can create product listings');
      }

      const productData = request.body as any;
      
      // For now, use placeholder images until we implement proper file upload
      const images: string[] = [
        `https://agritrade-images.s3.amazonaws.com/products/placeholder-${Date.now()}.jpg`
      ];

      // Create product
      const product = new Product({
        ...productData,
        farmerId: user._id,
        images,
        harvestDate: new Date(productData.harvestDate),
        availableFrom: new Date(productData.availableFrom),
        availableUntil: productData.availableUntil ? new Date(productData.availableUntil) : undefined
      });

      await product.save();

      return reply.code(201).send({
        success: true,
        message: 'Product listing created successfully',
        data: product
      });

    } catch (error) {
      throw error;
    }
  });

  // Get all products with filtering and pagination
  app.get('/', {
    schema: {
      tags: ['Products'],
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'] },
          country: { type: 'string' },
          region: { type: 'string' },
          grade: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
          minPrice: { type: 'number', minimum: 0 },
          maxPrice: { type: 'number', minimum: 0 },
          minQuantity: { type: 'number', minimum: 0 },
          currency: { type: 'string' },
          certifications: { type: 'string' },
          search: { type: 'string' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          sortBy: { type: 'string', enum: ['createdAt', 'pricePerUnit', 'qualityScore', 'quantity'], default: 'createdAt' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          latitude: { type: 'number', minimum: -90, maximum: 90 },
          longitude: { type: 'number', minimum: -180, maximum: 180 },
          radius: { type: 'number', minimum: 1, maximum: 500, default: 50 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const {
        type,
        country,
        region,
        grade,
        minPrice,
        maxPrice,
        minQuantity,
        currency,
        certifications,
        search,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        latitude,
        longitude,
        radius = 50
      } = request.query as any;

      // Build query
      const query: any = {
        status: 'available',
        availableUntil: { $gte: new Date() }
      };

      // Apply filters
      if (type) query.type = type;
      if (country) query['location.country'] = country;
      if (region) query['location.region'] = region;
      if (grade) query['qualityMetrics.grade'] = grade;
      if (minPrice !== undefined) query.pricePerUnit = { ...query.pricePerUnit, $gte: minPrice };
      if (maxPrice !== undefined) query.pricePerUnit = { ...query.pricePerUnit, $lte: maxPrice };
      if (minQuantity !== undefined) query.quantity = { $gte: minQuantity };
      if (currency) query.currency = currency;
      if (certifications) {
        const certArray = certifications.split(',');
        query.certifications = { $in: certArray };
      }

      // Text search
      if (search) {
        query.$text = { $search: search };
      }

      // Location-based search
      if (latitude !== undefined && longitude !== undefined) {
        query['location.coordinates'] = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            $maxDistance: radius * 1000 // Convert km to meters
          }
        };
      }

      // Sorting
      const sortOptions: any = {};
      if (sortBy === 'qualityScore') {
        sortOptions['qualityMetrics.overallScore'] = sortOrder === 'asc' ? 1 : -1;
      } else {
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
      }

      // Add text score for search relevance
      if (search) {
        sortOptions.score = { $meta: 'textScore' };
      }

      const skip = (page - 1) * limit;

      const [products, total] = await Promise.all([
        Product.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .populate('farmerId', 'profile.firstName profile.lastName profile.farmName profile.rating location'),
        Product.countDocuments(query)
      ]);

      const pages = Math.ceil(total / limit);

      // Cache popular searches
      if (search || type) {
        const cacheKey = `products:${JSON.stringify({ type, search, country, region })}`;
        await cache.setJSON(cacheKey, { products: products.slice(0, 10), total }, 300); // Cache for 5 minutes
      }

      return reply.send({
        success: true,
        data: products,
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

  // Get product by ID
  app.get<{ Params: { productId: string } }>('/:productId', {
    schema: {
      params: {
        type: 'object',
        required: ['productId'],
        properties: {
          productId: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { productId: string } }>, reply: FastifyReply) => {
    try {
      const { productId } = request.params;

      const product = await Product.findById(productId)
        .populate('farmerId', 'profile.firstName profile.lastName profile.farmName profile.rating profile.totalTransactions location isPhoneVerified isEmailVerified')
        .populate({
          path: 'qualityMetrics.aiAnalysisId',
          select: 'analysisResults.recommendations metadata.processingTime'
        });

      if (!product) {
        throw new NotFoundError('Product not found');
      }

      // Get similar products
      const similarProducts = await Product.find({
        commodity: product.commodity,
        'location.country': product.location.country,
        _id: { $ne: product._id },
        status: 'available',
        availableUntil: { $gte: new Date() }
      })
      .limit(5)
      .select('name pricePerUnit currency qualityMetrics.grade images')
      .populate('farmerId', 'profile.farmName');

      return reply.send({
        success: true,
        data: {
          product,
          similarProducts
        }
      });

    } catch (error) {
      throw error;
    }
  });

  // Update product listing
  app.put<{ Params: { productId: string } }>('/:productId', {
    preHandler: app.authenticate
  }, async (request: FastifyRequest<{ Params: { productId: string } }>, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { productId } = request.params;
      const updateData = request.body as any;

      if (!user || user.role !== 'farmer') {
        throw new AuthorizationError('Only farmers can update product listings');
      }

      const product = await Product.findById(productId);

      if (!product) {
        throw new NotFoundError('Product not found');
      }

      if (product.farmerId.toString() !== user._id.toString()) {
        throw new AuthorizationError('You can only update your own products');
      }

      // Update product
      const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        updateData,
        { new: true, runValidators: true }
      ).populate('farmerId', 'profile.firstName profile.lastName profile.farmName');

      return reply.send({
        success: true,
        message: 'Product updated successfully',
        data: updatedProduct
      });

    } catch (error) {
      throw error;
    }
  });

  // Delete product listing
  app.delete<{ Params: { productId: string } }>('/:productId', {
    preHandler: app.authenticate
  }, async (request: FastifyRequest<{ Params: { productId: string } }>, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { productId } = request.params;

      if (!user || user.role !== 'farmer') {
        throw new AuthorizationError('Only farmers can delete product listings');
      }

      const product = await Product.findById(productId);

      if (!product) {
        throw new NotFoundError('Product not found');
      }

      if (product.farmerId.toString() !== user._id.toString()) {
        throw new AuthorizationError('You can only delete your own products');
      }

      await Product.findByIdAndDelete(productId);

      return reply.send({
        success: true,
        message: 'Product deleted successfully'
      });

    } catch (error) {
      throw error;
    }
  });

  // Get farmer's products
  app.get('/farmer/my-products', {
    schema: {
      description: 'Get authenticated farmer\'s products',
      tags: ['Products'],
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['available', 'sold', 'reserved', 'expired'] },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { status, page = 1, limit = 20 } = request.query as any;

      if (!user || user.role !== 'farmer') {
        throw new AuthorizationError('Only farmers can access this endpoint');
      }

      const query: any = { farmerId: user._id };
      if (status) {
        query.status = status;
      }

      const skip = (page - 1) * limit;

      const [products, total] = await Promise.all([
        Product.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Product.countDocuments(query)
      ]);

      const pages = Math.ceil(total / limit);

      return reply.send({
        success: true,
        data: products,
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

  // Get products by farmer ID
  app.get<{ Params: { farmerId: string } }>('/farmer/:farmerId', {
    schema: {
      params: {
        type: 'object',
        required: ['farmerId'],
        properties: {
          farmerId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { farmerId: string } }>, reply: FastifyReply) => {
    try {
      const { farmerId } = request.params;
      const { page = 1, limit = 20 } = request.query as any;

      // Verify farmer exists
      const farmer = await User.findById(farmerId);
      if (!farmer || farmer.role !== 'farmer') {
        throw new NotFoundError('Farmer not found');
      }

      const query = {
        farmerId,
        status: 'available',
        availableUntil: { $gte: new Date() }
      };

      const skip = (page - 1) * limit;

      const [products, total] = await Promise.all([
        Product.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Product.countDocuments(query)
      ]);

      const pages = Math.ceil(total / limit);

      return reply.send({
        success: true,
        data: {
          farmer: {
            id: farmer._id,
            name: farmer.profile?.name || 'Unknown Farmer',
            rating: farmer.reputation?.rating || 0,
            verified: farmer.profile?.verified || false
          },
          products
        },
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

  // Get product recommendations for buyers
  app.get('/recommendations', {
    schema: {
      tags: ['Products'],
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { limit = 10 } = request.query as any;

      if (!user) {
        throw new AuthorizationError('Authentication required');
      }

      let query: any = {
        status: 'available',
        availableUntil: { $gte: new Date() }
      };

      // For buyers, recommend products based on their interests
      if (user.role === 'buyer') {
        const buyerProfile = user.profile as any;
        if (buyerProfile.interestedCrops && buyerProfile.interestedCrops.length > 0) {
          query.type = { $in: buyerProfile.interestedCrops };
        }

        // Prefer products from same country/region
        if (user.profile?.location) {
          query['location.country'] = user.profile.location.country;
        }
      }

      const recommendations = await Product.find(query)
        .sort({ 'qualityMetrics.overallScore': -1, createdAt: -1 })
        .limit(limit)
        .populate('farmerId', 'profile.firstName profile.lastName profile.farmName profile.rating');

      return reply.send({
        success: true,
        data: recommendations
      });

    } catch (error) {
      throw error;
    }
  });

  // Get marketplace statistics
  app.get('/statistics', {
    schema: {
      tags: ['Products'],
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'] },
          country: { type: 'string' },
          period: { type: 'string', enum: ['week', 'month', 'quarter'], default: 'month' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { type, country, period = 'month' } = request.query as any;

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
      }

      const matchStage: any = {
        status: 'available',
        createdAt: { $gte: startDate, $lte: endDate }
      };

      if (type) matchStage.type = type;
      if (country) matchStage['location.country'] = country;

      const stats = await Product.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalQuantity: { $sum: '$quantity' },
            avgPrice: { $avg: '$pricePerUnit' },
            avgQuality: { $avg: '$qualityMetrics.overallScore' },
            typeDistribution: { $push: '$type' },
            gradeDistribution: { $push: '$qualityMetrics.grade' }
          }
        }
      ]);

      const result = stats[0] || {
        totalProducts: 0,
        totalQuantity: 0,
        avgPrice: 0,
        avgQuality: 0,
        typeDistribution: [],
        gradeDistribution: []
      };

      return reply.send({
        success: true,
        data: {
          ...result,
          period,
          filters: { type, country }
        }
      });

    } catch (error) {
      throw error;
    }
  });
}

// Import mongoose for aggregation
import mongoose from 'mongoose';