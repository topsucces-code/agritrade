import winston from 'winston';
import path from 'path';
import { Request } from 'fastify';

// Define log levels
export const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define log colors
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

// Add colors to winston
winston.addColors(LOG_COLORS);

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return logMessage;
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    
    let logMessage = `${timestamp} ${level}: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    
    return logMessage;
  })
);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

// Winston logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: LOG_LEVELS,
  format: logFormat,
  defaultMeta: {
    service: 'agritrade-api',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    }),
    
    // HTTP requests log
    new winston.transports.File({
      filename: path.join(logsDir, 'http.log'),
      level: 'http',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    })
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 10485760,
      maxFiles: 3
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 10485760,
      maxFiles: 3
    })
  ],
  
  exitOnError: false
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Request logging middleware for Fastify
interface LoggedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export const requestLogger = {
  logRequest: (request: LoggedRequest, startTime: number) => {
    const duration = Date.now() - startTime;
    const userInfo = request.user ? { userId: request.user.id, userRole: request.user.role } : {};
    
    logger.http('HTTP Request', {
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      duration: `${duration}ms`,
      ...userInfo,
      requestId: request.id
    });
  },
  
  logError: (request: LoggedRequest, error: Error, statusCode?: number) => {
    const userInfo = request.user ? { userId: request.user.id, userRole: request.user.role } : {};
    
    logger.error('HTTP Error', {
      method: request.method,
      url: request.url,
      ip: request.ip,
      statusCode,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      ...userInfo,
      requestId: request.id
    });
  }
};

// Business logic logging helpers
export const businessLogger = {
  logUserAction: (userId: string, action: string, details?: any) => {
    logger.info('User Action', {
      userId,
      action,
      details,
      category: 'user_activity'
    });
  },
  
  logOrderActivity: (orderId: string, action: string, userId: string, details?: any) => {
    logger.info('Order Activity', {
      orderId,
      action,
      userId,
      details,
      category: 'order_management'
    });
  },
  
  logQualityAnalysis: (productId: string, farmerId: string, score: number, grade: string) => {
    logger.info('Quality Analysis', {
      productId,
      farmerId,
      score,
      grade,
      category: 'quality_analysis'
    });
  },
  
  logPriceCalculation: (productId: string, basePrice: number, finalPrice: number, factors: any) => {
    logger.info('Price Calculation', {
      productId,
      basePrice,
      finalPrice,
      factors,
      category: 'pricing'
    });
  },
  
  logMarketMatch: (farmerId: string, buyerId: string, productId: string, matchScore: number) => {
    logger.info('Market Match', {
      farmerId,
      buyerId,
      productId,
      matchScore,
      category: 'market_matching'
    });
  },
  
  logPaymentActivity: (orderId: string, amount: number, method: string, status: string, userId: string) => {
    logger.info('Payment Activity', {
      orderId,
      amount,
      method,
      status,
      userId,
      category: 'payments'
    });
  },
  
  logSecurityEvent: (event: string, userId?: string, ip?: string, details?: any) => {
    logger.warn('Security Event', {
      event,
      userId,
      ip,
      details,
      category: 'security'
    });
  },
  
  logExternalAPICall: (service: string, endpoint: string, duration: number, success: boolean, error?: string) => {
    const level = success ? 'info' : 'warn';
    logger.log(level, 'External API Call', {
      service,
      endpoint,
      duration: `${duration}ms`,
      success,
      error,
      category: 'external_api'
    });
  },
  
  logSMSActivity: (phoneNumber: string, type: string, success: boolean, error?: string) => {
    logger.info('SMS Activity', {
      phoneNumber: phoneNumber.substring(0, 6) + '****', // Mask phone number
      type,
      success,
      error,
      category: 'communication'
    });
  },
  
  logPerformanceMetric: (metric: string, value: number, unit: string, context?: any) => {
    logger.info('Performance Metric', {
      metric,
      value,
      unit,
      context,
      category: 'performance'
    });
  }
};

// System monitoring logger
export const systemLogger = {
  logSystemStart: () => {
    logger.info('System Started', {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      environment: process.env.NODE_ENV,
      category: 'system'
    });
  },
  
  logSystemShutdown: () => {
    logger.info('System Shutdown', {
      uptime: process.uptime(),
      category: 'system'
    });
  },
  
  logDatabaseConnection: (status: 'connected' | 'disconnected' | 'error', details?: any) => {
    const level = status === 'error' ? 'error' : 'info';
    logger.log(level, 'Database Connection', {
      status,
      details,
      category: 'database'
    });
  },
  
  logRedisConnection: (status: 'connected' | 'disconnected' | 'error', details?: any) => {
    const level = status === 'error' ? 'error' : 'info';
    logger.log(level, 'Redis Connection', {
      status,
      details,
      category: 'cache'
    });
  },
  
  logCircuitBreakerEvent: (service: string, state: string, details?: any) => {
    logger.warn('Circuit Breaker Event', {
      service,
      state,
      details,
      category: 'circuit_breaker'
    });
  },
  
  logMemoryUsage: () => {
    const memUsage = process.memoryUsage();
    logger.debug('Memory Usage', {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      category: 'system_metrics'
    });
  },
  
  logCPUUsage: (cpuUsage: number) => {
    logger.debug('CPU Usage', {
      usage: `${cpuUsage.toFixed(2)}%`,
      category: 'system_metrics'
    });
  },
  
  logCustomMetric: (name: string, value: any, tags?: Record<string, string>) => {
    logger.info('Custom Metric', {
      metric: name,
      value,
      tags,
      category: 'custom_metrics'
    });
  }
};

// Error logging with context
export const errorLogger = {
  logError: (error: Error, context?: any) => {
    logger.error('Application Error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      category: 'application_error'
    });
  },
  
  logValidationError: (field: string, value: any, rule: string, userId?: string) => {
    logger.warn('Validation Error', {
      field,
      value,
      rule,
      userId,
      category: 'validation'
    });
  },
  
  logAuthenticationError: (attempt: string, ip: string, details?: any) => {
    logger.warn('Authentication Error', {
      attempt,
      ip,
      details,
      category: 'authentication'
    });
  },
  
  logBusinessLogicError: (operation: string, userId?: string, details?: any) => {
    logger.error('Business Logic Error', {
      operation,
      userId,
      details,
      category: 'business_logic'
    });
  }
};

// Log rotation and cleanup
export const logMaintenance = {
  cleanupOldLogs: () => {
    // This would typically be handled by the winston transports
    // but can be extended for custom cleanup logic
    logger.info('Log cleanup initiated', { category: 'maintenance' });
  },
  
  archiveLogs: () => {
    logger.info('Log archival initiated', { category: 'maintenance' });
  }
};

// Health check for logging system
export const loggingHealthCheck = () => {
  try {
    logger.info('Logging health check', { category: 'health_check' });
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      transports: logger.transports.length
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Export the main logger
export default logger;
export { logger };