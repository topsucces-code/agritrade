import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import Joi from 'joi';
import { ValidationError } from './errorHandler';

// Common validation schemas
const locationSchema = Joi.object({
  country: Joi.string().required().max(100),
  region: Joi.string().required().max(100),
  city: Joi.string().required().max(100),
  coordinates: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required()
  }).required(),
  address: Joi.string().optional().max(500),
  postalCode: Joi.string().optional().max(20)
});

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc')
});

// Authentication validation schemas
export const authSchemas = {
  register: Joi.object({
    phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required()
      .messages({
        'string.pattern.base': 'Phone number must be in international format (e.g., +1234567890)'
      }),
    email: Joi.string().email().optional(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/).optional()
      .messages({
        'string.pattern.base': 'Password must contain at least 8 characters with uppercase, lowercase, and number'
      }),
    role: Joi.string().valid('farmer', 'buyer', 'transporter').required(),
    profile: Joi.object({
      name: Joi.string().required().max(255),
      location: locationSchema.required(),
      languages: Joi.array().items(Joi.string().valid('en', 'fr', 'sw', 'ha', 'yo', 'ig', 'tw', 'ee', 'ak')).min(1)
    }).required(),
    preferences: Joi.object({
      currency: Joi.string().valid('XOF', 'GHS', 'NGN', 'USD').default('XOF'),
      units: Joi.string().valid('metric', 'imperial').default('metric'),
      notifications: Joi.object({
        sms: Joi.boolean().default(true),
        email: Joi.boolean().default(false),
        whatsapp: Joi.boolean().default(true),
        push: Joi.boolean().default(true),
        priceAlerts: Joi.boolean().default(true),
        orderUpdates: Joi.boolean().default(true),
        weatherAlerts: Joi.boolean().default(true),
        marketNews: Joi.boolean().default(false)
      }).default({})
    }).default({})
  }),

  login: Joi.object({
    phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
    password: Joi.string().optional(),
    otp: Joi.string().length(6).pattern(/^\d{6}$/).optional()
  }).xor('password', 'otp'), // Either password or OTP required

  verifySMS: Joi.object({
    phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
    otp: Joi.string().length(6).pattern(/^\d{6}$/).required()
  }),

  resendOTP: Joi.object({
    phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required()
  }),

  resetPassword: Joi.object({
    phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
    otp: Joi.string().length(6).pattern(/^\d{6}$/).required(),
    newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/).required()
  })
};

// Product validation schemas
export const productSchemas = {
  create: Joi.object({
    commodity: Joi.string().valid('cocoa', 'coffee', 'cotton', 'maize', 'rice', 'peanuts', 'cashew', 'palm_oil').required(),
    variety: Joi.string().required().max(100),
    quantity: Joi.object({
      available: Joi.number().positive().required(),
      unit: Joi.string().valid('kg', 'tons', 'bags').required()
    }).required(),
    location: locationSchema.required(),
    harvestDate: Joi.date().max('now').required(),
    certifications: Joi.object({
      organic: Joi.boolean().default(false),
      fairTrade: Joi.boolean().default(false),
      rainforest: Joi.boolean().default(false),
      custom: Joi.array().items(Joi.string().max(100)).default([])
    }).default({}),
    storageConditions: Joi.object({
      temperature: Joi.number().min(-10).max(50).required(),
      humidity: Joi.number().min(0).max(100).required(),
      facility: Joi.string().max(200).required(),
      duration: Joi.number().min(0).max(365).default(0)
    }).optional(),
    logistics: Joi.object({
      pickupLocation: locationSchema.optional(),
      transportOptions: Joi.array().items(Joi.string().valid('pickup', 'delivery', 'shipping')).min(1).required(),
      packagingType: Joi.string().max(100).required(),
      minimumOrder: Joi.number().positive().required()
    }).optional()
  }),

  update: Joi.object({
    quantity: Joi.object({
      available: Joi.number().positive(),
      unit: Joi.string().valid('kg', 'tons', 'bags')
    }).optional(),
    status: Joi.string().valid('available', 'reserved', 'sold', 'processing').optional(),
    pricing: Joi.object({
      basePrice: Joi.number().positive(),
      currency: Joi.string().valid('XOF', 'GHS', 'NGN', 'USD')
    }).optional(),
    storageConditions: Joi.object({
      temperature: Joi.number().min(-10).max(50),
      humidity: Joi.number().min(0).max(100),
      facility: Joi.string().max(200),
      duration: Joi.number().min(0).max(365)
    }).optional()
  }),

  search: Joi.object({
    commodity: Joi.string().valid('cocoa', 'coffee', 'cotton', 'maize', 'rice', 'peanuts', 'cashew', 'palm_oil').optional(),
    grade: Joi.string().valid('A+', 'A', 'B', 'C', 'D').optional(),
    location: Joi.object({
      country: Joi.string().optional(),
      region: Joi.string().optional(),
      radius: Joi.number().positive().max(1000).optional() // km
    }).optional(),
    priceRange: Joi.object({
      min: Joi.number().positive(),
      max: Joi.number().positive().greater(Joi.ref('min'))
    }).optional(),
    quantityRange: Joi.object({
      min: Joi.number().positive(),
      max: Joi.number().positive().greater(Joi.ref('min'))
    }).optional(),
    harvestDate: Joi.object({
      from: Joi.date(),
      to: Joi.date().greater(Joi.ref('from'))
    }).optional(),
    status: Joi.string().valid('available', 'reserved', 'sold', 'processing').optional(),
    certifications: Joi.array().items(Joi.string().valid('organic', 'fairTrade', 'rainforest')).optional(),
    ...paginationSchema.describe().keys
  })
};

// Quality analysis validation schemas
export const qualitySchemas = {
  analyze: Joi.object({
    productType: Joi.string().valid('cocoa', 'coffee', 'cotton', 'maize', 'rice', 'peanuts', 'cashew', 'palm_oil').required(),
    location: Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required()
    }).optional(),
    harvestDate: Joi.date().max('now').optional(),
    storageConditions: Joi.object({
      temperature: Joi.number().min(-10).max(50),
      humidity: Joi.number().min(0).max(100),
      duration: Joi.number().min(0).max(365)
    }).optional()
  }),

  batchAnalyze: Joi.object({
    images: Joi.array().items(Joi.object({
      productType: Joi.string().valid('cocoa', 'coffee', 'cotton', 'maize', 'rice', 'peanuts').required(),
      location: Joi.object({
        latitude: Joi.number().min(-90).max(90).required(),
        longitude: Joi.number().min(-180).max(180).required()
      }).optional()
    })).min(1).max(10).required(),
    batchId: Joi.string().alphanum().required()
  })
};

// Order validation schemas
export const orderSchemas = {
  create: Joi.object({
    productId: Joi.string().hex().length(24).required(), // MongoDB ObjectId
    quantity: Joi.object({
      requested: Joi.number().positive().required(),
      unit: Joi.string().valid('kg', 'tons', 'bags').required()
    }).required(),
    pricing: Joi.object({
      proposedPricePerUnit: Joi.number().positive().required(),
      currency: Joi.string().valid('XOF', 'GHS', 'NGN', 'USD').required()
    }).required(),
    deliveryDetails: Joi.object({
      method: Joi.string().valid('pickup', 'delivery', 'shipping').required(),
      address: locationSchema.when('method', {
        is: Joi.valid('delivery', 'shipping'),
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      scheduledDate: Joi.date().greater('now').required(),
      instructions: Joi.string().max(1000).optional()
    }).required(),
    qualityRequirements: Joi.object({
      minGrade: Joi.string().valid('A+', 'A', 'B', 'C', 'D').required(),
      maxMoistureContent: Joi.number().positive().max(20).optional(),
      maxDefectRate: Joi.number().min(0).max(100).optional(),
      certificationRequired: Joi.array().items(Joi.string().valid('organic', 'fairTrade', 'rainforest')).default([]),
      inspectionRequired: Joi.boolean().default(false)
    }).optional(),
    specialRequirements: Joi.array().items(Joi.string().max(200)).max(5).default([]),
    paymentMethod: Joi.string().valid('bank_transfer', 'mobile_money', 'cash', 'escrow', 'credit').required()
  }),

  update: Joi.object({
    quantity: Joi.object({
      requested: Joi.number().positive(),
      unit: Joi.string().valid('kg', 'tons', 'bags')
    }).optional(),
    pricing: Joi.object({
      proposedPricePerUnit: Joi.number().positive(),
      currency: Joi.string().valid('XOF', 'GHS', 'NGN', 'USD')
    }).optional(),
    deliveryDetails: Joi.object({
      method: Joi.string().valid('pickup', 'delivery', 'shipping'),
      scheduledDate: Joi.date().greater('now'),
      instructions: Joi.string().max(1000)
    }).optional(),
    status: Joi.string().valid('pending', 'negotiating', 'accepted', 'rejected', 'cancelled').optional()
  }),

  negotiate: Joi.object({
    type: Joi.string().valid('price', 'quantity', 'delivery', 'terms').required(),
    proposedValue: Joi.any().required(), // Type depends on negotiation type
    message: Joi.string().max(500).optional()
  }),

  search: Joi.object({
    status: Joi.array().items(Joi.string().valid('pending', 'accepted', 'rejected', 'paid', 'shipped', 'delivered', 'completed', 'cancelled')).optional(),
    dateRange: Joi.object({
      from: Joi.date(),
      to: Joi.date().greater(Joi.ref('from'))
    }).optional(),
    commodities: Joi.array().items(Joi.string().valid('cocoa', 'coffee', 'cotton', 'maize', 'rice', 'peanuts')).optional(),
    priceRange: Joi.object({
      min: Joi.number().positive(),
      max: Joi.number().positive().greater(Joi.ref('min'))
    }).optional(),
    ...paginationSchema.describe().keys
  })
};

// Market data validation schemas
export const marketSchemas = {
  getPrices: Joi.object({
    commodity: Joi.string().valid('cocoa', 'coffee', 'cotton', 'maize', 'rice', 'peanuts', 'cashew', 'palm_oil').required(),
    location: Joi.object({
      country: Joi.string().optional(),
      region: Joi.string().optional()
    }).optional(),
    timeframe: Joi.string().valid('day', 'week', 'month', 'year').default('week'),
    currency: Joi.string().valid('XOF', 'GHS', 'NGN', 'USD').default('USD')
  }),

  getForecast: Joi.object({
    commodity: Joi.string().valid('cocoa', 'coffee', 'cotton', 'maize', 'rice', 'peanuts').required(),
    location: locationSchema.required(),
    horizon: Joi.number().integer().min(1).max(365).default(30) // days
  }),

  getConditions: Joi.object({
    commodity: Joi.string().valid('cocoa', 'coffee', 'cotton', 'maize', 'rice', 'peanuts').required(),
    region: Joi.string().required(),
    country: Joi.string().required()
  })
};

// User profile validation schemas
export const userSchemas = {
  updateProfile: Joi.object({
    profile: Joi.object({
      name: Joi.string().max(255),
      location: locationSchema,
      languages: Joi.array().items(Joi.string().valid('en', 'fr', 'sw', 'ha', 'yo', 'ig', 'tw', 'ee', 'ak'))
    }).optional(),
    preferences: Joi.object({
      currency: Joi.string().valid('XOF', 'GHS', 'NGN', 'USD'),
      units: Joi.string().valid('metric', 'imperial'),
      notifications: Joi.object({
        sms: Joi.boolean(),
        email: Joi.boolean(),
        whatsapp: Joi.boolean(),
        push: Joi.boolean(),
        priceAlerts: Joi.boolean(),
        orderUpdates: Joi.boolean(),
        weatherAlerts: Joi.boolean(),
        marketNews: Joi.boolean()
      })
    }).optional()
  }),

  updatePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/).required()
  })
};

/**
 * Generic validation middleware factory
 */
export const validateSchema = (schema: Joi.Schema, source: 'body' | 'query' | 'params' = 'body') => {
  return async (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): Promise<void> => {
    try {
      let dataToValidate;
      
      switch (source) {
        case 'body':
          dataToValidate = request.body;
          break;
        case 'query':
          dataToValidate = request.query;
          break;
        case 'params':
          dataToValidate = request.params;
          break;
        default:
          dataToValidate = request.body;
      }

      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        const details = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        throw new ValidationError('Validation failed', details);
      }

      // Replace the original data with validated and converted data
      switch (source) {
        case 'body':
          request.body = value;
          break;
        case 'query':
          request.query = value;
          break;
        case 'params':
          request.params = value;
          break;
      }

      done();
    } catch (error) {
      done(error);
    }
  };
};

/**
 * File upload validation middleware
 */
export const validateFileUpload = (options: {
  maxFiles?: number;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
}) => {
  return async (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): Promise<void> => {
    try {
      if (!request.isMultipart()) {
        throw new ValidationError('Content-Type must be multipart/form-data for file uploads');
      }

      // Additional file validation logic would go here
      // This is handled by the Fastify multipart plugin configuration
      
      done();
    } catch (error) {
      done(error);
    }
  };
};

/**
 * Sanitization middleware for text inputs
 */
export const sanitizeInput = () => {
  return async (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): Promise<void> => {
    try {
      if (request.body && typeof request.body === 'object') {
        request.body = sanitizeObject(request.body);
      }

      if (request.query && typeof request.query === 'object') {
        request.query = sanitizeObject(request.query);
      }

      done();
    } catch (error) {
      done(error);
    }
  };
};

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sanitized: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        // Basic XSS prevention
        sanitized[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

export default {
  validateSchema,
  validateFileUpload,
  sanitizeInput,
  authSchemas,
  productSchemas,
  qualitySchemas,
  orderSchemas,
  marketSchemas,
  userSchemas
};