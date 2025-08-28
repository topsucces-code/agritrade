import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import CommunicationService from '../services/communicationService';
import OtpService from '../services/otpService';
import { getCurrentUser } from '../middleware/authentication';
import { AppError, ValidationError, NotFoundError, AuthorizationError } from '../middleware/errorHandler';
import { User } from '../models/User';
import { cache } from '../config/redis';

const communicationService = new CommunicationService();
const otpService = new OtpService();

export default async function communicationRoutes(app: FastifyInstance) {

  // Send SMS verification code
  app.post('/sms/verify', {
    schema: {
      description: 'Send SMS verification code',
      tags: ['Communication'],
      body: {
        type: 'object',
        required: ['phoneNumber'],
        properties: {
          phoneNumber: { type: 'string' },
          resend: { type: 'boolean', default: false }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { phoneNumber, resend = false } = request.body as any;
      // La logique de renvoi est maintenant gérée par le limiteur de débit à l'intérieur de OtpService
      await otpService.sendVerificationCode(phoneNumber);

      return reply.send({
        success: true,
        message: 'Verification code sent successfully',
        data: {
          phoneNumber: communicationService.formatPhoneNumber(phoneNumber),
          expiresIn: 600 // 10 minutes
        }
      });

    } catch (error) {
      throw error;
    }
  });

  // Verify SMS code
  app.post('/sms/verify/check', {
    schema: {
      description: 'Verify SMS code',
      tags: ['Communication'],
      body: {
        type: 'object',
        required: ['phoneNumber', 'code'],
        properties: {
          phoneNumber: { type: 'string' },
          code: { type: 'string', minLength: 6, maxLength: 6 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { phoneNumber, code } = request.body as any;

      const isValid = await otpService.verifyCode(phoneNumber, code);

      if (!isValid) {
        throw new ValidationError('Invalid or expired verification code');
      }

      return reply.send({
        success: true,
        message: 'Phone number verified successfully.',
        data: {
          phoneNumber: communicationService.formatPhoneNumber(phoneNumber),
          verified: true
        }
      });

    } catch (error) {
      throw error;
    }
  });

  // Send order notification SMS
  app.post('/sms/order-notification', {
    schema: {
      description: 'Send order notification SMS',
      tags: ['Communication'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['phoneNumber', 'orderNumber', 'status'],
        properties: {
          phoneNumber: { type: 'string' },
          orderNumber: { type: 'string' },
          status: { type: 'string', enum: ['received', 'accepted', 'rejected', 'paid', 'shipped', 'delivered', 'completed', 'cancelled'] },
          farmerId: { type: 'string' },
          buyerId: { type: 'string' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { phoneNumber, orderNumber, status, farmerId, buyerId } = request.body as any;

      if (!user) {
        throw new AuthorizationError('Authentication required');
      }

      // Utiliser la méthode générique sendNotificationToUser pour une meilleure flexibilité
      const targetUser = await User.findOne({ phoneNumber: communicationService.formatPhoneNumber(phoneNumber) });
      if (!targetUser) {
        throw new NotFoundError('User with the provided phone number not found.');
      }

      await communicationService.sendNotificationToUser(targetUser, 'orderReceived', {
        orderNumber,
        // Ajouter d'autres variables comme productName, amount, etc.
      });

      return reply.send({
        success: true,
        message: 'Order notification sent successfully'
      });

    } catch (error) {
      throw error;
    }
  });

  // Send price alert SMS
  app.post('/sms/price-alert', {
    schema: {
      description: 'Send price alert SMS',
      tags: ['Communication'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['phoneNumber', 'cropType', 'currentPrice', 'targetPrice'],
        properties: {
          phoneNumber: { type: 'string' },
          cropType: { type: 'string', enum: ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'] },
          currentPrice: { type: 'number', minimum: 0 },
          targetPrice: { type: 'number', minimum: 0 },
          currency: { type: 'string', default: 'USD' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { phoneNumber, cropType, currentPrice, targetPrice, currency = 'USD' } = request.body as any;

      if (!user) {
        throw new AuthorizationError('Authentication required');
      }

      await communicationService.sendSMS({
        to: [communicationService.formatPhoneNumber(phoneNumber)],
        template: 'priceAlert',
        variables: {
          productType: cropType,
          price: currentPrice.toString(),
          currency
        }
      });

      return reply.send({
        success: true,
        message: 'Price alert sent successfully'
      });

    } catch (error) {
      throw error;
    }
  });

  // Send weather alert SMS
  app.post('/sms/weather-alert', {
    schema: {
      description: 'Send weather alert SMS',
      tags: ['Communication'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['phoneNumber', 'alertType', 'message'],
        properties: {
          phoneNumber: { type: 'string' },
          alertType: { type: 'string', enum: ['storm', 'drought', 'flood', 'temperature', 'wind', 'general'] },
          message: { type: 'string', maxLength: 500 }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { phoneNumber, alertType, message } = request.body as any;

      if (!user) {
        throw new AuthorizationError('Authentication required');
      }

      await communicationService.sendSMS({
        to: [communicationService.formatPhoneNumber(phoneNumber)],
        message: `Weather Alert (${alertType}): ${message} - AgriTrade`
        // Ou créer un template dédié pour cela
      });

      return reply.send({
        success: true,
        message: 'Weather alert sent successfully'
      });

    } catch (error) {
      throw error;
    }
  });

  // Send bulk SMS (admin only)
  app.post('/sms/bulk', {
    schema: {
      description: 'Send bulk SMS notifications',
      tags: ['Communication'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['phoneNumbers', 'message'],
        properties: {
          phoneNumbers: { type: 'array', items: { type: 'string' }, maxItems: 1000 },
          message: { type: 'string', maxLength: 1600 },
          userType: { type: 'string', enum: ['farmer', 'buyer'] },
          cropTypes: { type: 'array', items: { type: 'string', enum: ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'] } },
          country: { type: 'string' },
          region: { type: 'string' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { 
        phoneNumbers, 
        message, 
        userType, 
        cropTypes, 
        country, 
        region 
      } = request.body as any;

      if (!user) {
        throw new AuthorizationError('Authentication required');
      }

      // For now, allow any authenticated user. In production, restrict to admin roles
      // if (user.role !== 'admin') {
      //   throw new AuthorizationError('Admin access required');
      // }

      let targetNumbers = phoneNumbers;

      // If filtering criteria provided, get phone numbers from database
      if (userType || cropTypes || country || region) {
        const query: any = { isActive: true, isPhoneVerified: true };
        
        if (userType) query.userType = userType;
        if (country) query['location.country'] = country;
        if (region) query['location.region'] = region;
        
        if (cropTypes && userType === 'farmer') {
          // Note: primaryCrops would be in a separate farmer profile collection or as a subdocument
          // For now, we'll skip this filter or implement it based on the actual data structure
          // query['profile.primaryCrops'] = { $in: cropTypes };
        } else if (cropTypes && userType === 'buyer') {
          query['profile.interestedCrops'] = { $in: cropTypes };
        }

        const users = await User.find(query, 'phone');
        targetNumbers = users.map(u => u.phoneNumber);
      }

      if (targetNumbers.length === 0) {
        throw new ValidationError('No valid phone numbers found');
      }

      await communicationService.sendBulkSMS(targetNumbers, message);

      return reply.send({
        success: true,
        message: `Bulk SMS sent to ${targetNumbers.length} recipients`,
        data: {
          recipientCount: targetNumbers.length
        }
      });

    } catch (error) {
      throw error;
    }
  });

  // Make voice call
  app.post('/voice/call', {
    schema: {
      description: 'Make voice call notification',
      tags: ['Communication'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['phoneNumber'],
        properties: {
          phoneNumber: { type: 'string' },
          message: { type: 'string', maxLength: 1000 },
          audioUrl: { type: 'string', format: 'uri' },
          language: { type: 'string', enum: ['en', 'fr', 'sw', 'ha', 'yo', 'ig'], default: 'en' },
          messageKey: { type: 'string', enum: ['order_received', 'price_alert', 'weather_alert'] }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { 
        phoneNumber, 
        message, 
        audioUrl, 
        language = 'en', 
        messageKey 
      } = request.body as any;

      if (!user) {
        throw new AuthorizationError('Authentication required');
      }

      const formattedPhone = communicationService.formatPhoneNumber(phoneNumber);

      let callResponse;

      if (messageKey) {
        // Use predefined localized message
        await communicationService.sendVoiceNotification(
          formattedPhone,
          messageKey,
          language
        );
      } else {
        // Direct voice call
        callResponse = await communicationService.makeVoiceCall({
          to: formattedPhone,
          from: process.env.AFRICASTALKING_SHORT_CODE || '2020',
          message,
          audioUrl
        });
      }

      return reply.send({
        success: true,
        message: 'Voice call initiated successfully',
        data: callResponse
      });

    } catch (error) {
      throw error;
    }
  });

  // Send market update SMS to subscribers
  app.post('/sms/market-update', {
    schema: {
      description: 'Send market update SMS to subscribers',
      tags: ['Communication'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['marketData'],
        properties: {
          marketData: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              required: ['price', 'change', 'currency'],
              properties: {
                price: { type: 'number', minimum: 0 },
                change: { type: 'number' },
                currency: { type: 'string', default: 'USD' }
              }
            }
          },
          cropTypes: { type: 'array', items: { type: 'string' } },
          country: { type: 'string' },
          region: { type: 'string' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { marketData, cropTypes, country, region } = request.body as any;

      if (!user) {
        throw new AuthorizationError('Authentication required');
      }

      // Get subscribers based on criteria
      const query: any = { 
        userType: 'farmer', 
        isActive: true, 
        isPhoneVerified: true 
      };
      
      if (country) query['location.country'] = country;
      if (region) query['location.region'] = region;
      if (cropTypes) {
        query['profile.primaryCrops'] = { $in: cropTypes };
      }

      const farmers = await User.find(query, 'phoneNumber profile');
      
      const subscribers = farmers.map(farmer => ({
        phone: farmer.phoneNumber,
        crops: [] // TODO: Implement crops based on actual farmer profile structure
      }));

      await communicationService.sendMarketUpdateSMS(subscribers, marketData);

      return reply.send({
        success: true,
        message: `Market update sent to ${subscribers.length} farmers`,
        data: {
          subscriberCount: subscribers.length
        }
      });

    } catch (error) {
      throw error;
    }
  });

  // Check SMS delivery status
  app.get<{ Params: { messageId: string } }>('/sms/status/:messageId', {
    schema: {
      params: {
        type: 'object',
        required: ['messageId'],
        properties: {
          messageId: { type: 'string' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest<{ Params: { messageId: string } }>, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { messageId } = request.params;

      if (!user) {
        throw new AuthorizationError('Authentication required');
      }

      const status = await communicationService.checkSMSStatus(messageId);

      return reply.send({
        success: true,
        data: status
      });

    } catch (error) {
      throw error;
    }
  });

  // Get account balance (admin only)
  app.get('/account/balance', {
    schema: {},
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);

      if (!user) {
        throw new AuthorizationError('Authentication required');
      }

      // In production, restrict to admin users
      // if (user.role !== 'admin') {
      //   throw new AuthorizationError('Admin access required');
      // }

      const balance = await communicationService.getAccountBalance();

      return reply.send({
        success: true,
        data: balance
      });

    } catch (error) {
      throw error;
    }
  });

  // Test SMS functionality
  app.post('/sms/test', {
    schema: {
      description: 'Test SMS functionality (development only)',
      tags: ['Communication'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['phoneNumber', 'message'],
        properties: {
          phoneNumber: { type: 'string' },
          message: { type: 'string', maxLength: 160 }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { phoneNumber, message } = request.body as any;

      if (!user) {
        throw new AuthorizationError('Authentication required');
      }

      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        throw new AuthorizationError('Test endpoints not available in production');
      }

      const formattedPhone = communicationService.formatPhoneNumber(phoneNumber);
      
      const result = await communicationService.sendSMS({
        to: [formattedPhone],
        message: `[TEST] ${message}`
      });

      return reply.send({
        success: true,
        message: 'Test SMS sent successfully',
        data: result
      });

    } catch (error) {
      throw error;
    }
  });
}