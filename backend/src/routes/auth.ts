import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User';
import { AppError, ValidationError, AuthenticationError, ConflictError } from '../middleware/errorHandler';
import { blacklistToken } from '../middleware/authentication';
import { cache, session } from '../config/redis';
import { LoginRequest, RegisterRequest, LoginResponse, JWTPayload } from '../types';

// SMS/Voice service integration (placeholder)
class NotificationService {
  static async sendSMSVerification(phone: string, code: string): Promise<boolean> {
    // TODO: Integrate with Africa's Talking or Twilio
    console.log(`SMS Verification: ${phone} - Code: ${code}`);
    return true;
  }

  static async sendVoiceVerification(phone: string, code: string, language: string = 'en'): Promise<boolean> {
    // TODO: Integrate with voice service
    console.log(`Voice Verification: ${phone} - Code: ${code} - Language: ${language}`);
    return true;
  }

  static async sendEmail(email: string, subject: string, body: string): Promise<boolean> {
    // TODO: Integrate with email service
    console.log(`Email: ${email} - Subject: ${subject}`);
    return true;
  }
}

// Generate verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate JWT tokens
function generateTokens(user: any): { token: string; refreshToken: string } {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId: user._id.toString(),
    email: user.email,
    userType: user.role // Use 'role' instead of 'userType'
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  } as jwt.SignOptions);

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  } as jwt.SignOptions);

  return { token, refreshToken };
}

export default async function authRoutes(app: FastifyInstance) {
  // Registration endpoint
  app.post<{ Body: RegisterRequest }>('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'phone', 'password', 'userType', 'profile', 'location'],
        properties: {
          email: { type: 'string', format: 'email' },
          phone: { type: 'string', pattern: '^\\+[1-9]\\d{1,14}$' },
          password: { type: 'string', minLength: 8 },
          userType: { type: 'string', enum: ['farmer', 'buyer'] },
          profile: { type: 'object' },
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
              }
            }
          },
          preferredLanguage: { type: 'string', enum: ['en', 'fr', 'sw', 'ha', 'yo', 'ig'] }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                phone: { type: 'string' },
                userType: { type: 'string' },
                isPhoneVerified: { type: 'boolean' },
                isEmailVerified: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: RegisterRequest }>, reply: FastifyReply) => {
    try {
      const { email, phone, password, userType, profile, location, preferredLanguage } = request.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { phoneNumber: phone }]
      });

      if (existingUser) {
        if (existingUser.email === email) {
          throw new ConflictError('User with this email already exists');
        }
        if (existingUser.phoneNumber === phone) {
          throw new ConflictError('User with this phone number already exists');
        }
      }

      // Create new user
      const user = new User({
        email,
        phoneNumber: phone,
        password,
        role: userType, // Use 'role' instead of 'userType'
        profile: {
          name: (profile as any).firstName || (profile as any).contactPerson || (profile as any).name || 'User',
          location,
          languages: [preferredLanguage || 'en'],
          verified: false,
          kycStatus: 'pending',
          documentation: []
        },
        preferences: {
          notifications: {},
          currency: 'XOF',
          units: 'metric'
        }
      });

      await user.save();

      // Generate and send phone verification code
      const verificationCode = generateVerificationCode();
      const cacheKey = `phone_verification:${phone}`;
      await cache.setJSON(cacheKey, {
        code: verificationCode,
        userId: user._id.toString(),
        attempts: 0
      }, 600); // 10 minutes expiry

      // Send verification SMS
      await NotificationService.sendSMSVerification(phone, verificationCode);

      // Send welcome email
      await NotificationService.sendEmail(
        email,
        'Welcome to AgriTrade AI',
        `Welcome ${(profile as any).firstName || (profile as any).contactPerson || 'User'}! Please verify your phone number to complete registration.`
      );

      return reply.code(201).send({
        success: true,
        message: 'User registered successfully. Please verify your phone number.',
        user: {
          id: user._id,
          email: user.email,
          phone: user.phoneNumber,
          userType: user.role,
          isPhoneVerified: user.authentication.smsVerified,
          isEmailVerified: user.authentication.emailVerified
        }
      });
    } catch (error) {
      throw error;
    }
  });

  // Login endpoint
  app.post<{ Body: LoginRequest }>('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['password'],
        properties: {
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          password: { type: 'string' }
        },
        anyOf: [
          { required: ['email'] },
          { required: ['phone'] }
        ]
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: { type: 'object' },
            token: { type: 'string' },
            refreshToken: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: LoginRequest }>, reply: FastifyReply) => {
    try {
      const { email, phone, password } = request.body;

      if (!email && !phone) {
        throw new ValidationError('Either email or phone is required');
      }

      // Find user by email or phone
      const query = email ? { email } : { phoneNumber: phone };
      const user = await User.findOne(query);

      if (!user || !user.comparePassword || !await user.comparePassword(password)) {
        throw new AuthenticationError('Invalid credentials');
      }

      if (!user.profile?.verified) {
        throw new AuthenticationError('Account has been deactivated');
      }

      // Generate tokens
      const { token, refreshToken } = generateTokens(user);

      // Update last login
      user.lastActive = new Date();
      await user.save();

      // Store refresh token in session
      const decoded = jwt.decode(refreshToken) as any;
      await session.set(user._id.toString(), {
        refreshToken,
        lastLogin: new Date(),
        userAgent: request.headers['user-agent'],
        ip: request.ip
      }, decoded.exp - Math.floor(Date.now() / 1000));

      const response: LoginResponse = {
        user: user.toJSON(),
        token,
        refreshToken
      };

      return reply.send({
        success: true,
        ...response
      });
    } catch (error) {
      throw error;
    }
  });

  // Phone verification endpoint
  app.post<{ Body: { phone: string; code: string } }>('/verify-phone', {
    schema: {
      body: {
        type: 'object',
        required: ['phone', 'code'],
        properties: {
          phone: { type: 'string' },
          code: { type: 'string', minLength: 6, maxLength: 6 }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: { phone: string; code: string } }>, reply: FastifyReply) => {
    try {
      const { phone, code } = request.body;

      const cacheKey = `phone_verification:${phone}`;
      const verificationData = await cache.getJSON<{
        code: string;
        userId: string;
        attempts: number;
      }>(cacheKey);

      if (!verificationData) {
        throw new AppError('Verification code expired or not found', 400, 'VERIFICATION_EXPIRED');
      }

      if (verificationData.attempts >= 3) {
        await cache.del(cacheKey);
        throw new AppError('Too many verification attempts. Please request a new code.', 429, 'TOO_MANY_ATTEMPTS');
      }

      if (verificationData.code !== code) {
        verificationData.attempts++;
        await cache.setJSON(cacheKey, verificationData, 600);
        throw new AppError('Invalid verification code', 400, 'INVALID_CODE');
      }

      // Update user verification status
      const user = await User.findByIdAndUpdate(
        verificationData.userId,
        { 'authentication.smsVerified': true },
        { new: true }
      );

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Clean up verification data
      await cache.del(cacheKey);

      return reply.send({
        success: true,
        message: 'Phone number verified successfully',
        user: {
          id: user._id,
          isPhoneVerified: user.authentication.smsVerified,
          isEmailVerified: user.authentication.emailVerified
        }
      });
    } catch (error) {
      throw error;
    }
  });

  // Resend verification code
  app.post<{ Body: { phone: string; method?: 'sms' | 'voice' } }>('/resend-verification', {
    schema: {
      body: {
        type: 'object',
        required: ['phone'],
        properties: {
          phone: { type: 'string' },
          method: { type: 'string', enum: ['sms', 'voice'], default: 'sms' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: { phone: string; method?: 'sms' | 'voice' } }>, reply: FastifyReply) => {
    try {
      const { phone, method = 'sms' } = request.body;

      // Check if user exists
      const user = await User.findOne({ phoneNumber: phone });
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (user.authentication.smsVerified) {
        throw new AppError('Phone number is already verified', 400, 'ALREADY_VERIFIED');
      }

      // Check rate limiting
      const rateLimitKey = `resend_limit:${phone}`;
      const attempts = await cache.increment(rateLimitKey, 3600); // 1 hour window
      
      if (attempts > 5) {
        throw new AppError('Too many resend attempts. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED');
      }

      // Generate new verification code
      const verificationCode = generateVerificationCode();
      const cacheKey = `phone_verification:${phone}`;
      await cache.setJSON(cacheKey, {
        code: verificationCode,
        userId: user._id.toString(),
        attempts: 0
      }, 600); // 10 minutes expiry

      // Send verification code
      if (method === 'voice') {
        const userLanguage = user.profile?.languages?.[0] || 'en';
        await NotificationService.sendVoiceVerification(phone, verificationCode, userLanguage);
      } else {
        await NotificationService.sendSMSVerification(phone, verificationCode);
      }

      return reply.send({
        success: true,
        message: `Verification code sent via ${method}`,
        method
      });
    } catch (error) {
      throw error;
    }
  });

  // Refresh token endpoint
  app.post<{ Body: { refreshToken: string } }>('/refresh', {
    schema: {
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: { refreshToken: string } }>, reply: FastifyReply) => {
    try {
      const { refreshToken } = request.body;

      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken, 
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!
      ) as JWTPayload;

      // Check if refresh token exists in session
      const sessionData = await session.get(decoded.userId) as any;
      if (!sessionData || sessionData.refreshToken !== refreshToken) {
        throw new AuthenticationError('Invalid refresh token');
      }

      // Get user
      const user = await User.findById(decoded.userId);
      if (!user || !user.profile?.verified) {
        throw new AuthenticationError('User not found or inactive');
      }

      // Generate new tokens
      const { token, refreshToken: newRefreshToken } = generateTokens(user);

      // Update session with new refresh token
      const newDecoded = jwt.decode(newRefreshToken) as any;
      await session.set(user._id.toString(), {
        ...sessionData,
        refreshToken: newRefreshToken,
        lastRefresh: new Date()
      }, newDecoded.exp - Math.floor(Date.now() / 1000));

      return reply.send({
        success: true,
        token,
        refreshToken: newRefreshToken
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid refresh token');
      }
      throw error;
    }
  });

  // Logout endpoint
  app.post('/logout', {
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const authHeader = request.headers.authorization;
      
      if (authHeader) {
        const token = authHeader.split(' ')[1];
        
        // Blacklist the current token
        const decoded = jwt.decode(token) as any;
        if (decoded && decoded.exp) {
          await blacklistToken(token, decoded.exp);
        }
      }

      // Remove refresh token from session
      await session.delete(user._id.toString());

      return reply.send({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      throw error;
    }
  });

  // Forgot password endpoint
  app.post<{ Body: { email: string } }>('/forgot-password', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: { email: string } }>, reply: FastifyReply) => {
    try {
      const { email } = request.body;

      const user = await User.findOne({ email });
      if (!user) {
        // Don't reveal if email exists or not for security
        return reply.send({
          success: true,
          message: 'If the email exists, a password reset link has been sent.'
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

      // Store reset token in cache for 1 hour
      const cacheKey = `password_reset:${user._id}`;
      await cache.setJSON(cacheKey, {
        resetTokenHash,
        email: user.email,
        createdAt: new Date()
      }, 3600); // 1 hour expiry

      // Send reset email
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&id=${user._id}`;
      await NotificationService.sendEmail(
        email,
        'Password Reset - AgriTrade AI',
        `Click here to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`
      );

      return reply.send({
        success: true,
        message: 'If the email exists, a password reset link has been sent.'
      });
    } catch (error) {
      throw error;
    }
  });

  // Reset password endpoint
  app.post<{ Body: { token: string; userId: string; newPassword: string } }>('/reset-password', {
    schema: {
      body: {
        type: 'object',
        required: ['token', 'userId', 'newPassword'],
        properties: {
          token: { type: 'string' },
          userId: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: { token: string; userId: string; newPassword: string } }>, reply: FastifyReply) => {
    try {
      const { token, userId, newPassword } = request.body;

      // Get reset data from cache
      const cacheKey = `password_reset:${userId}`;
      const resetData = await cache.getJSON<{
        resetTokenHash: string;
        email: string;
        createdAt: string;
      }>(cacheKey);

      if (!resetData) {
        throw new AppError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
      }

      // Verify token
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      if (tokenHash !== resetData.resetTokenHash) {
        throw new AppError('Invalid reset token', 400, 'INVALID_RESET_TOKEN');
      }

      // Update user password
      const user = await User.findById(userId);
      if (!user || user.email !== resetData.email) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      user.password = newPassword;
      await user.save();

      // Clear reset token
      await cache.del(cacheKey);

      // Clear all user sessions (logout from all devices)
      await session.delete(userId);

      return reply.send({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      throw error;
    }
  });
}