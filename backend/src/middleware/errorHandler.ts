import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
// import { MongoError } from 'mongodb'; // TODO: Install mongodb types
import { APIError, ValidationError as TypeValidationError } from '../types';

// Custom error classes
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: any
  ) {
    super(message);
    
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: TypeValidationError[]) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message?: string) {
    super(
      message || `External service ${service} is unavailable`,
      503,
      'EXTERNAL_SERVICE_ERROR',
      { service }
    );
  }
}

// Error handler function
export const errorHandler = async (
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const requestId = request.id;
  const timestamp = new Date().toISOString();
  
  // Log the error
  request.log.error({
    error: {
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
      statusCode: (error as any).statusCode,
    },
    request: {
      id: requestId,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      userId: (request as any).user?.id,
    },
    timestamp,
  }, 'API Error');

  // Handle different error types
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: any = undefined;

  // Custom application errors
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  }
  // Fastify validation errors
  else if ((error as any).statusCode === 400 && (error as any).validation) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid request data';
    details = (error as any).validation.map((err: any) => ({
      field: err.instancePath || err.dataPath,
      message: err.message,
      value: err.data,
    }));
  }
  // Fastify errors
  else if ((error as any).statusCode) {
    statusCode = (error as any).statusCode;
    code = (error as any).code || 'FASTIFY_ERROR';
    message = error.message;
  }
  // MongoDB errors
  else if (isMongoError(error)) {
    const mongoErrorInfo = handleMongoError(error as any);
    statusCode = mongoErrorInfo.statusCode;
    code = mongoErrorInfo.code;
    message = mongoErrorInfo.message;
    details = mongoErrorInfo.details;
  }
  // JWT errors
  else if (error.message.includes('jwt')) {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid or expired token';
  }
  // Multer/file upload errors
  else if (error.message.includes('File too large')) {
    statusCode = 413;
    code = 'FILE_TOO_LARGE';
    message = 'File size exceeds the allowed limit';
  }
  // Generic errors
  else {
    // In production, don't expose internal error details
    if (process.env.NODE_ENV === 'production') {
      message = 'An unexpected error occurred';
    } else {
      message = error.message;
    }
  }

  // Build error response
  const errorResponse: APIError = {
    code,
    message,
    statusCode,
    ...(details && { details }),
    ...(process.env.NODE_ENV !== 'production' && {
      requestId,
      timestamp,
      ...(error.stack && { stack: error.stack }),
    }),
  };

  // Send error response
  reply.code(statusCode).send({
    success: false,
    error: errorResponse,
  });
};

// Helper function to check if error is MongoDB error
function isMongoError(error: any): boolean {
  return error.name === 'MongoError' || 
         error.name === 'MongoServerError' ||
         error.name === 'MongoNetworkError' ||
         error.name === 'ValidationError' ||
         error.code?.toString().startsWith('11');
}

// Handle MongoDB specific errors
function handleMongoError(error: any): {
  statusCode: number;
  code: string;
  message: string;
  details?: any;
} {
  const mongoError = error as any;

  // Duplicate key error
  if (mongoError.code === 11000) {
    const field = Object.keys(mongoError.keyPattern || {})[0];
    return {
      statusCode: 409,
      code: 'DUPLICATE_KEY',
      message: `${field || 'Resource'} already exists`,
      details: { field, value: mongoError.keyValue?.[field] },
    };
  }

  // Validation error
  if (error.name === 'ValidationError') {
    const validationErrors = Object.values((error as any).errors).map((err: any) => ({
      field: err.path,
      message: err.message,
      value: err.value,
    }));

    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: validationErrors,
    };
  }

  // Connection errors
  if (error.name === 'MongoNetworkError') {
    return {
      statusCode: 503,
      code: 'DATABASE_CONNECTION_ERROR',
      message: 'Database connection failed',
    };
  }

  // Generic MongoDB error
  return {
    statusCode: 500,
    code: 'DATABASE_ERROR',
    message: 'Database operation failed',
  };
}

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (request: FastifyRequest, reply: FastifyReply, next?: Function) => {
    Promise.resolve(fn(request, reply, next)).catch((error) => {
      if (next) {
        next(error);
      } else {
        errorHandler(error, request, reply);
      }
    });
  };
};

// Global uncaught exception handler
export const setupGlobalErrorHandlers = (): void => {
  process.on('uncaughtException', (error: Error) => {
    console.error('💥 Uncaught Exception:', error);
    
    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Log to external monitoring service (DataDog, Sentry, etc.)
    }
    
    // Gracefully shutdown
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    
    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Log to external monitoring service
    }
    
    // Gracefully shutdown
    process.exit(1);
  });
};

export default AppError;