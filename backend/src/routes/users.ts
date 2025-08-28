import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { User } from '../models/User';
import { QualityAnalysis } from '../models/QualityAnalysis';
import { Product } from '../models/Product';
import { AppError, ValidationError, NotFoundError, ConflictError } from '../middleware/errorHandler';
import { getCurrentUser } from '../middleware/authentication';
import { cache } from '../config/redis';
import { IUser, IFarmerProfile, IBuyerProfile, PaginationOptions } from '../types';

export default async function userRoutes(app: FastifyInstance) {

  // Get current user profile
  app.get('/profile', {
    schema: {
      description: 'Get current user profile',
      tags: ['Users'],
      security: [{ Bearer: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Get additional stats for farmers
      let additionalStats = {};
      if (user.role === 'farmer') {
        const [productCount, analysisCount, latestAnalysis] = await Promise.all([
          Product.countDocuments({ farmerId: user._id }),
          QualityAnalysis.countDocuments({ farmerId: user._id, status: 'completed' }),
          QualityAnalysis.findOne({ farmerId: user._id, status: 'completed' })
            .sort({ createdAt: -1 })
            .select('analysisResults.grade analysisResults.overallScore createdAt')
        ]);

        additionalStats = {
          totalProducts: productCount,
          totalAnalyses: analysisCount,
          latestAnalysis: latestAnalysis ? {
            grade: (latestAnalysis as any).analysisResults?.grade || 'N/A',
            score: (latestAnalysis as any).analysisResults?.overallScore || 0,
            date: latestAnalysis.createdAt
          } : null
        };
      }

      return reply.send({
        success: true,
        data: {
          ...user.toJSON(),
          stats: additionalStats
        }
      });

    } catch (error) {
      throw error;
    }
  });

  // Update user profile
  app.put('/profile', {
    schema: {
      description: 'Update user profile',
      tags: ['Users'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        properties: {
          profile: { type: 'object' },
          location: {
            type: 'object',
            properties: {
              country: { type: 'string' },
              region: { type: 'string' },
              city: { type: 'string' },
              coordinates: {
                type: 'object',
                properties: {
                  latitude: { type: 'number', minimum: -90, maximum: 90 },
                  longitude: { type: 'number', minimum: -180, maximum: 180 }
                }
              },
              address: { type: 'string' }
            }
          },
          preferredLanguage: { type: 'string', enum: ['en', 'fr', 'sw', 'ha', 'yo', 'ig'] }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { profile, location, preferredLanguage } = request.body as any;

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const updateData: any = {};

      // Update profile data
      if (profile) {
        // Validate profile based on user type
        if (user.role === 'farmer') {
          updateData['profile'] = { ...user.profile, ...profile };
        } else if (user.role === 'buyer') {
          updateData['profile'] = { ...user.profile, ...profile };
        }
      }

      // Update location
      if (location) {
        updateData['profile.location'] = { ...user.profile.location, ...location };
      }

      // Update preferred language
      if (preferredLanguage) {
        updateData.preferredLanguage = preferredLanguage;
      }

      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        throw new AppError('Failed to update user profile', 500, 'UPDATE_FAILED');
      }

      // Clear user cache
      await cache.del(`user:${user._id}`);

      return reply.send({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser.toJSON()
      });

    } catch (error) {
      throw error;
    }
  });

  // Search users (farmers/buyers)
  app.get('/search', {
    schema: {
      description: 'Search for farmers or buyers',
      tags: ['Users'],
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          userType: { type: 'string', enum: ['farmer', 'buyer'] },
          crop: { type: 'string' },
          country: { type: 'string' },
          region: { type: 'string' },
          minRating: { type: 'number', minimum: 0, maximum: 5 },
          verified: { type: 'boolean' },
          search: { type: 'string' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          sortBy: { type: 'string', enum: ['rating', 'totalTransactions', 'createdAt'], default: 'rating' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const {
        userType,
        crop,
        country,
        region,
        minRating,
        verified,
        search,
        page = 1,
        limit = 20,
        sortBy = 'rating',
        sortOrder = 'desc'
      } = request.query as any;

      const query: any = { 'profile.verified': true };

      // Filter by user type
      if (userType) {
        query.role = userType;
      }

      // Filter by location
      if (country) {
        query['location.country'] = country;
      }
      if (region) {
        query['location.region'] = region;
      }

      // Filter by crop (for farmers and buyers)
      if (crop) {
        if (userType === 'farmer' || !userType) {
          query['$or'] = query['$or'] || [];
          query['$or'].push({ 
            userType: 'farmer',
            'profile.primaryCrops': crop 
          });
        }
        if (userType === 'buyer' || !userType) {
          query['$or'] = query['$or'] || [];
          query['$or'].push({ 
            userType: 'buyer',
            'profile.interestedCrops': crop 
          });
        }
      }

      // Filter by minimum rating
      if (minRating !== undefined) {
        query['$or'] = [
          { userType: 'farmer', 'profile.rating': { $gte: minRating } },
          { userType: 'buyer', 'profile.rating': { $gte: minRating } }
        ];
      }

      // Filter by verification status
      if (verified !== undefined) {
        if (verified) {
          query.isPhoneVerified = true;
          query.isEmailVerified = true;
        }
      }

      // Text search
      if (search) {
        query['$or'] = query['$or'] || [];
        query['$or'].push(
          { 'profile.firstName': { $regex: search, $options: 'i' } },
          { 'profile.lastName': { $regex: search, $options: 'i' } },
          { 'profile.farmName': { $regex: search, $options: 'i' } },
          { 'profile.companyName': { $regex: search, $options: 'i' } }
        );
      }

      // Sorting
      const sortOptions: any = {};
      if (sortBy === 'rating') {
        sortOptions['profile.rating'] = sortOrder === 'asc' ? 1 : -1;
      } else if (sortBy === 'totalTransactions') {
        sortOptions['profile.totalTransactions'] = sortOrder === 'asc' ? 1 : -1;
      } else {
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
      }

      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        User.find(query)
          .select('-password')
          .sort(sortOptions)
          .skip(skip)
          .limit(limit),
        User.countDocuments(query)
      ]);

      const pages = Math.ceil(total / limit);

      return reply.send({
        success: true,
        data: users.map(user => ({
          id: user._id,
          name: user.profile.name,
          role: user.role,
          location: {
            country: user.profile.location.country,
            region: user.profile.location.region,
            city: user.profile.location.city
          },
          reputation: {
            score: user.reputation.score,
            rating: user.reputation.rating,
            transactionCount: user.reputation.transactionCount
          },
          verified: user.profile.verified,
          memberSince: user.createdAt,
          lastActive: user.lastActive
        })),
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

  // Get user by ID (public profile)
  app.get<{ Params: { userId: string } }>('/:userId', {
    preHandler: app.authenticate
  }, async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
    try {
      const { userId } = request.params;
      
      const user = await User.findById(userId).select('-password');
      
      if (!user || !user.profile?.verified) {
        throw new NotFoundError('User not found');
      }

      // Get additional public stats
      let publicStats = {};
      if (user.role === 'farmer') {
        const [productCount, avgQualityScore] = await Promise.all([
          Product.countDocuments({ farmerId: userId, status: { $ne: 'expired' } }),
          QualityAnalysis.aggregate([
            { $match: { farmerId: new mongoose.Types.ObjectId(userId), status: 'completed' } },
            { $group: { _id: null, avgScore: { $avg: '$analysisResults.overallScore' } } }
          ])
        ]);

        publicStats = {
          activeProducts: productCount,
          averageQualityScore: avgQualityScore[0]?.avgScore ? Math.round(avgQualityScore[0].avgScore) : null
        };
      } else if (user.role === 'buyer') {
        // Add buyer-specific public stats if needed
        publicStats = {
          verificationStatus: user.profile?.kycStatus || 'pending',
          businessType: 'general' // Default business type
        };
      }

      return reply.send({
        success: true,
        data: {
          id: user._id,
          name: user.profile.name,
          role: user.role,
          location: {
            country: user.profile.location.country,
            region: user.profile.location.region,
            city: user.profile.location.city
          },
          reputation: {
            score: user.reputation.score,
            rating: user.reputation.rating,
            transactionCount: user.reputation.transactionCount
          },
          verified: user.profile.verified,
          memberSince: user.createdAt,
          lastActive: user.lastActive,
          stats: publicStats
        }
      });

    } catch (error) {
      throw error;
    }
  });

  // Update user settings
  app.put('/settings', {
    schema: {
      description: 'Update user settings',
      tags: ['Users'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        properties: {
          preferredLanguage: { type: 'string', enum: ['en', 'fr', 'sw', 'ha', 'yo', 'ig'] },
          emailNotifications: { type: 'boolean' },
          smsNotifications: { type: 'boolean' },
          pushNotifications: { type: 'boolean' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const settings = request.body as any;

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        settings,
        { new: true, runValidators: true }
      ).select('-password');

      if (!updatedUser) {
        throw new AppError('Failed to update settings', 500, 'UPDATE_FAILED');
      }

      // Clear user cache
      await cache.del(`user:${user._id}`);

      return reply.send({
        success: true,
        message: 'Settings updated successfully',
        data: updatedUser
      });

    } catch (error) {
      throw error;
    }
  });

  // Upload profile picture
  app.post('/upload-avatar', {
    preHandler: [app.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // TODO: Implement file upload to S3 and update user profile
      // This would require setting up multer and S3 upload logic
      
      return reply.send({
        success: true,
        message: 'Avatar upload functionality to be implemented'
      });

    } catch (error) {
      throw error;
    }
  });

  // Change password
  app.put('/change-password', {
    schema: {
      description: 'Change user password',
      tags: ['Users'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { currentPassword, newPassword } = request.body as any;

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Get user with password
      const userWithPassword = await User.findById(user._id);
      if (!userWithPassword) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Verify current password
      if (userWithPassword.comparePassword) {
        const isValidPassword = await userWithPassword.comparePassword(currentPassword);
        if (!isValidPassword) {
          throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD');
        }
      } else {
        throw new AppError('Password verification not available', 500, 'METHOD_NOT_AVAILABLE');
      }

      // Update password
      userWithPassword.password = newPassword;
      await userWithPassword.save();

      return reply.send({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      throw error;
    }
  });

  // Deactivate account
  app.put('/deactivate', {
    schema: {
      description: 'Deactivate user account',
      tags: ['Users'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['password'],
        properties: {
          password: { type: 'string' },
          reason: { type: 'string' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { password, reason } = request.body as any;

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Get user with password
      const userWithPassword = await User.findById(user._id);
      if (!userWithPassword) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Verify password
      if (userWithPassword.comparePassword) {
        const isValidPassword = await userWithPassword.comparePassword(password);
        if (!isValidPassword) {
          throw new AppError('Password is incorrect', 400, 'INVALID_PASSWORD');
        }
      } else {
        throw new AppError('Password verification not available', 500, 'METHOD_NOT_AVAILABLE');
      }

      // Deactivate account
      userWithPassword.profile.verified = false;
      await userWithPassword.save();

      // TODO: Log deactivation reason and perform cleanup tasks

      return reply.send({
        success: true,
        message: 'Account deactivated successfully'
      });

    } catch (error) {
      throw error;
    }
  });

  // Get user statistics (for farmers)
  app.get('/statistics', {
    schema: {
      description: 'Get user statistics and analytics',
      tags: ['Users'],
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['month', 'quarter', 'year'], default: 'month' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { period = 'month' } = request.query as any;

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
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

      let statistics = {};

      if (user.role === 'farmer') {
        const [
          totalProducts,
          totalAnalyses,
          avgQualityScore,
          recentProducts,
          qualityTrend
        ] = await Promise.all([
          Product.countDocuments({ farmerId: user._id }),
          QualityAnalysis.countDocuments({ farmerId: user._id, status: 'completed' }),
          QualityAnalysis.aggregate([
            { $match: { farmerId: new mongoose.Types.ObjectId(user._id), status: 'completed' } },
            { $group: { _id: null, avgScore: { $avg: '$analysisResults.overallScore' } } }
          ]),
          Product.countDocuments({
            farmerId: user._id,
            createdAt: { $gte: startDate, $lte: endDate }
          }),
          QualityAnalysis.aggregate([
            {
              $match: {
                farmerId: new mongoose.Types.ObjectId(user._id),
                status: 'completed',
                createdAt: { $gte: startDate, $lte: endDate }
              }
            },
            {
              $group: {
                _id: { $month: '$createdAt' },
                avgScore: { $avg: '$analysisResults.overallScore' },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id': 1 } }
          ])
        ]);

        statistics = {
          totalProducts,
          totalAnalyses,
          averageQualityScore: avgQualityScore[0]?.avgScore ? Math.round(avgQualityScore[0].avgScore) : 0,
          recentProducts,
          qualityTrend,
          period
        };
      }

      return reply.send({
        success: true,
        data: statistics
      });

    } catch (error) {
      throw error;
    }
  });
}

// Import mongoose for aggregation
import mongoose from 'mongoose';