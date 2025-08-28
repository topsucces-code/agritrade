import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { cache } from '../config/redis';
import { RateLimitError, ValidationError } from './errorHandler';

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (request: FastifyRequest) => string;
  onLimitReached?: (request: FastifyRequest) => void;
}

// Default rate limit configurations
const RATE_LIMIT_CONFIGS = {
  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },
  
  // General API endpoints
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  },
  
  // File upload endpoints
  upload: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  },
  
  // Quality analysis endpoints (resource intensive)
  analysis: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
  },
  
  // Public endpoints
  public: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200,
  }
};

/**
 * Advanced Rate Limiter with Redis backing
 */
export class RateLimiter {
  private config: RateLimitConfig;
  private keyPrefix: string;

  constructor(config: RateLimitConfig, keyPrefix: string = 'rate_limit') {
    this.config = config;
    this.keyPrefix = keyPrefix;
  }

  /**
   * Create rate limiting middleware
   */
  middleware() {
    return async (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): Promise<void> => {
      try {
        const key = this.generateKey(request);
        const current = await this.getCurrentCount(key);
        
        // Check if limit exceeded
        if (current >= this.config.maxRequests) {
          const resetTime = await this.getResetTime(key);
          
          // Set rate limit headers
          reply.header('X-RateLimit-Limit', this.config.maxRequests);
          reply.header('X-RateLimit-Remaining', 0);
          reply.header('X-RateLimit-Reset', resetTime);
          reply.header('Retry-After', Math.ceil((resetTime - Date.now()) / 1000));
          
          // Call custom handler if provided
          if (this.config.onLimitReached) {
            this.config.onLimitReached(request);
          }
          
          throw new RateLimitError(`Rate limit exceeded. Try again in ${Math.ceil((resetTime - Date.now()) / 1000)} seconds`);
        }
        
        // Increment counter
        await this.incrementCounter(key);
        
        // Set rate limit headers
        reply.header('X-RateLimit-Limit', this.config.maxRequests);
        reply.header('X-RateLimit-Remaining', Math.max(0, this.config.maxRequests - current - 1));
        
        done();
      } catch (error) {
        done(error instanceof Error ? error : new Error(String(error)));
      }
    };
  }

  /**
   * Generate rate limit key for the request
   */
  private generateKey(request: FastifyRequest): string {
    if (this.config.keyGenerator) {
      return `${this.keyPrefix}:${this.config.keyGenerator(request)}`;
    }
    
    // Default key generation: IP + User ID (if authenticated)
    const ip = this.getClientIP(request);
    const userId = (request as any).user?._id || 'anonymous';
    return `${this.keyPrefix}:${ip}:${userId}`;
  }

  /**
   * Get current request count
   */
  private async getCurrentCount(key: string): Promise<number> {
    try {
      const count = await cache.get(key);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      // If Redis fails, allow request (fail open)
      return 0;
    }
  }

  /**
   * Increment request counter
   */
  private async incrementCounter(key: string): Promise<void> {
    try {
      const ttl = Math.ceil(this.config.windowMs / 1000);
      const current = await cache.get(key);
      
      if (current) {
        await cache.increment(key);
      } else {
        await cache.set(key, '1', ttl);
      }
    } catch (error) {
      // Log error but don't fail the request
      console.error('Rate limiter increment error:', error);
    }
  }

  /**
   * Get reset time for the current window
   */
  private async getResetTime(key: string): Promise<number> {
    try {
      const exists = await cache.exists(key);
      if (exists) {
        return Date.now() + this.config.windowMs;
      }
      return Date.now() + this.config.windowMs;
    } catch (error) {
      return Date.now() + this.config.windowMs;
    }
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: FastifyRequest): string {
    return (
      request.headers['x-forwarded-for'] as string ||
      request.headers['x-real-ip'] as string ||
      request.ip ||
      'unknown'
    ).split(',')[0].trim();
  }
}

/**
 * Create rate limiter middleware for different endpoint types
 */
export const createRateLimit = (type: keyof typeof RATE_LIMIT_CONFIGS, customConfig?: Partial<RateLimitConfig>) => {
  const config = { ...RATE_LIMIT_CONFIGS[type], ...customConfig };
  const limiter = new RateLimiter(config, `rate_limit_${type}`);
  return limiter.middleware();
};

/**
 * IP-based rate limiting for suspicious activity
 */
export const createIPRateLimit = (maxRequests: number = 1000, windowMs: number = 60 * 60 * 1000) => {
  const limiter = new RateLimiter({
    windowMs,
    maxRequests,
    keyGenerator: (request: FastifyRequest) => {
      const ip = request.headers['x-forwarded-for'] as string || request.headers['x-real-ip'] as string || request.ip;
      return ip.split(',')[0].trim();
    }
  }, 'ip_rate_limit');
  
  return limiter.middleware();
};

/**
 * Security headers middleware
 */
export const securityHeaders = () => {
  return async (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): Promise<void> => {
    // Security headers
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('X-Download-Options', 'noopen');
    reply.header('X-Permitted-Cross-Domain-Policies', 'none');
    
    // Content Security Policy
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "media-src 'self'",
      "object-src 'none'",
      "child-src 'none'",
      "worker-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "upgrade-insecure-requests"
    ].join('; ');
    
    reply.header('Content-Security-Policy', csp);
    
    // HSTS (HTTP Strict Transport Security) for HTTPS
    if (request.headers['x-forwarded-proto'] === 'https' || request.protocol === 'https') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    
    done();
  };
};

/**
 * Request sanitization middleware
 */
export const sanitizeRequest = () => {
  return async (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): Promise<void> => {
    try {
      // Sanitize query parameters
      if (request.query) {
        request.query = sanitizeObject(request.query);
      }
      
      // Sanitize body (for non-multipart requests)
      if (request.body && !isMultipartRequest(request)) {
        request.body = sanitizeObject(request.body);
      }
      
      // Check for suspicious patterns
      const suspiciousPatterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /onload\s*=/gi,
        /onerror\s*=/gi,
        /onclick\s*=/gi,
        /%3Cscript/gi,
        /%3C%2Fscript%3E/gi
      ];
      
      const requestString = JSON.stringify({ query: request.query, body: request.body });
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(requestString)) {
          throw new ValidationError('Potentially malicious content detected in request');
        }
      }
      
      done();
    } catch (error) {
      done(error instanceof Error ? error : new Error(String(error)));
    }
  };
};

/**
 * Check if request is multipart/form-data
 */
function isMultipartRequest(request: FastifyRequest): boolean {
  const contentType = request.headers['content-type'];
  return contentType ? contentType.includes('multipart/form-data') : false;
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeValue(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Sanitize key
    const cleanKey = sanitizeValue(key);
    
    // Recursively sanitize value
    sanitized[cleanKey] = sanitizeObject(value);
  }
  
  return sanitized;
}

/**
 * Sanitize individual values
 */
function sanitizeValue(value: any): any {
  if (typeof value !== 'string') {
    return value;
  }
  
  return value
    // Remove script tags
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    // Remove iframe tags
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    // Remove javascript: and vbscript: protocols
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=/gi, '')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Trim whitespace
    .trim();
}

export default {
  createRateLimit,
  createIPRateLimit,
  securityHeaders,
  sanitizeRequest
};