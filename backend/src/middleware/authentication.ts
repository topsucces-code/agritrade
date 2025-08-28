import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { AuthenticationError, AuthorizationError } from './errorHandler';
import { JWTPayload, IUser } from '../types';
import { cache } from '../config/redis';

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/health',
  '/docs',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/verify-sms',
  '/api/v1/auth/resend-otp',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/market/prices', // Allow public access to market prices
  '/api/v1/market/conditions'
];

// Routes that require specific user roles
const FARMER_ONLY_ROUTES = [
  '/api/v1/products',
  '/api/v1/ai/analyze-quality',
];

const BUYER_ONLY_ROUTES = [
  '/api/v1/orders/search',
  '/api/v1/orders/create'
];

const ADMIN_ONLY_ROUTES = [
  '/api/v1/admin',
  '/api/v1/users/manage'
];

// Routes with optional authentication
const OPTIONAL_AUTH_ROUTES = [
  '/api/v1/market',
  '/api/v1/weather',
];

interface AuthenticatedRequest extends FastifyRequest {
  user: IUser;
}

export const authenticationHook = async (
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): Promise<void> => {
  try {
    const { method, url } = request;
    
    // Skip authentication for public routes
    if (isPublicRoute(url)) {
      return done();
    }

    // Check if route requires optional authentication
    const isOptionalAuth = isOptionalAuthRoute(url);
    
    // Extract token from Authorization header
    const authHeader = request.headers.authorization;
    
    if (!authHeader && !isOptionalAuth) {
      throw new AuthenticationError('Authorization header is required');
    }

    if (!authHeader && isOptionalAuth) {
      return done();
    }

    const token = extractTokenFromHeader(authHeader!);
    
    if (!token && !isOptionalAuth) {
      throw new AuthenticationError('Token is required');
    }

    if (!token && isOptionalAuth) {
      return done();
    }

    // Verify and decode JWT token
    const decoded = await verifyToken(token!);
    
    // Check if token is blacklisted (for logout functionality)
    const isBlacklisted = await isTokenBlacklisted(token!);
    if (isBlacklisted) {
      throw new AuthenticationError('Token has been invalidated');
    }

    // Fetch user from database
    const user = await getUserById(decoded.userId);
    
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Check if user account is locked
    if (user.authentication?.lockoutUntil && user.authentication.lockoutUntil > new Date()) {
      throw new AuthenticationError('Account is temporarily locked due to security reasons');
    }

    // Attach user to request
    (request as AuthenticatedRequest).user = user;

    // Check route-specific permissions
    checkRoutePermissions(url, user.role);

    // Update last activity
    await updateUserLastActivity(user._id.toString());

    done();
  } catch (error) {
    done(error instanceof Error ? error : new Error(String(error)));
  }
};

// Extract JWT token from Authorization header
function extractTokenFromHeader(authHeader: string): string | null {
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new AuthenticationError('Invalid authorization header format. Use: Bearer <token>');
  }
  
  return parts[1];
}

// Verify JWT token
async function verifyToken(token: string): Promise<JWTPayload> {
  try {
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }

    const decoded = jwt.verify(token, secret) as JWTPayload;
    
    // Check token expiration
    if (decoded.exp < Date.now() / 1000) {
      throw new AuthenticationError('Token has expired');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid token');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Token has expired');
    }
    throw error;
  }
}

// Check if token is blacklisted
async function isTokenBlacklisted(token: string): Promise<boolean> {
  try {
    const result = await cache.get(`blacklist:${token}`);
    return result !== null;
  } catch (error) {
    // If Redis is down, assume token is not blacklisted
    console.error('Error checking token blacklist:', error);
    return false;
  }
}

// Get user by ID with caching
async function getUserById(userId: string): Promise<IUser | null> {
  try {
    // Try to get user from cache first
    const cacheKey = `user:${userId}`;
    const cachedUser = await cache.getJSON<IUser>(cacheKey);
    
    if (cachedUser) {
      return cachedUser;
    }

    // If not in cache, get from database
    const user = await User.findById(userId).select('-password').lean();
    
    if (user) {
      // Cache user for 15 minutes
      await cache.setJSON(cacheKey, user, 900);
    }

    return user;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

// Update user last activity
async function updateUserLastActivity(userId: string): Promise<void> {
  try {
    // Update in background without awaiting
    User.findByIdAndUpdate(
      userId,
      { lastLogin: new Date() },
      { new: false }
    ).exec().catch(error => {
      console.error('Error updating user last activity:', error);
    });

    // Invalidate user cache
    await cache.del(`user:${userId}`);
  } catch (error) {
    // Non-critical error, log and continue
    console.error('Error updating user activity:', error);
  }
}

// Check if route is public
function isPublicRoute(url: string): boolean {
  return PUBLIC_ROUTES.some(route => {
    if (route.includes('*')) {
      const pattern = route.replace('*', '');
      return url.startsWith(pattern);
    }
    return url === route || url.startsWith(route);
  });
}

// Check if route has optional authentication
function isOptionalAuthRoute(url: string): boolean {
  return OPTIONAL_AUTH_ROUTES.some(route => url.startsWith(route));
}

// Check route-specific permissions
function checkRoutePermissions(url: string, userRole: 'farmer' | 'buyer' | 'transporter' | 'admin'): void {
  // Check farmer-only routes
  const isFarmerOnlyRoute = FARMER_ONLY_ROUTES.some(route => url.startsWith(route));
  if (isFarmerOnlyRoute && userRole !== 'farmer') {
    throw new AuthorizationError('This endpoint is only accessible to farmers');
  }

  // Check buyer-only routes
  const isBuyerOnlyRoute = BUYER_ONLY_ROUTES.some(route => url.startsWith(route));
  if (isBuyerOnlyRoute && userRole !== 'buyer') {
    throw new AuthorizationError('This endpoint is only accessible to buyers');
  }

  // Check admin-only routes
  const isAdminOnlyRoute = ADMIN_ONLY_ROUTES.some(route => url.startsWith(route));
  if (isAdminOnlyRoute && userRole !== 'admin') {
    throw new AuthorizationError('This endpoint requires administrative privileges');
  }
}

// Middleware to require specific user role
export const requireUserRole = (role: 'farmer' | 'buyer' | 'transporter' | 'admin') => {
  return async (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    const user = (request as AuthenticatedRequest).user;
    
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    if (user.role !== role) {
      throw new AuthorizationError(`This endpoint requires ${role} access`);
    }

    done();
  };
};

// Middleware to require SMS verification
export const requireSMSVerification = async (
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): Promise<void> => {
  const user = (request as AuthenticatedRequest).user;
  
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  if (!user.authentication?.smsVerified) {
    throw new AuthorizationError('SMS verification required');
  }

  done();
};

// Middleware to require email verification (if email is provided)
export const requireEmailVerification = async (
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): Promise<void> => {
  const user = (request as AuthenticatedRequest).user;
  
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  if (user.email && !user.authentication?.emailVerified) {
    throw new AuthorizationError('Email verification required');
  }

  done();
};

// Middleware to require profile verification
export const requireProfileVerification = async (
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): Promise<void> => {
  const user = (request as AuthenticatedRequest).user;
  
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  if (!user.profile?.verified) {
    throw new AuthorizationError('Profile verification required');
  }

  done();
};

// Helper to blacklist token (for logout)
export const blacklistToken = async (token: string, expirationTime: number): Promise<void> => {
  try {
    const ttl = Math.max(0, expirationTime - Math.floor(Date.now() / 1000));
    if (ttl > 0) {
      await cache.set(`blacklist:${token}`, 'true', ttl);
    }
  } catch (error) {
    console.error('Error blacklisting token:', error);
    // Non-critical error, continue
  }
};

// Helper to get current user from request
export const getCurrentUser = (request: FastifyRequest): IUser | null => {
  return (request as AuthenticatedRequest).user || null;
};

export default authenticationHook;