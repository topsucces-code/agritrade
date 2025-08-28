import { FastifyInstance } from 'fastify';
import authRoutes from './auth';
import userRoutes from './users';
import productRoutes from './products';
import orderRoutes from './orders';
import aiRoutes from './ai';
import marketRoutes from './market';
import communicationRoutes from './communication';
import webhookRoutes from './webhooks.js';

// API version prefix
const API_PREFIX = '/api/v1';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  try {
    // Health check route (no prefix)
    app.get('/health', {
      schema: {
        description: 'Health check endpoint',
        tags: ['Health'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
              uptime: { type: 'number' },
              environment: { type: 'string' },
              version: { type: 'string' },
              database: { type: 'string' },
              redis: { type: 'string' }
            }
          }
        }
      }
    }, async (request, reply) => {
      // Import database status checking functions
      const { getDatabaseConnectionStatus } = await import('../config/database');
      const { isRedisConnected } = await import('../config/redis');

      return reply.code(200).send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        database: getDatabaseConnectionStatus() ? 'connected' : 'disconnected',
        redis: isRedisConnected() ? 'connected' : 'disconnected'
      });
    });

    // Register API routes with version prefix
    await app.register(async function(app) {
      // Authentication routes
      await app.register(authRoutes, { prefix: '/auth' });
      
      // User management routes
      await app.register(userRoutes, { prefix: '/users' });
      
      // Product routes
      await app.register(productRoutes, { prefix: '/products' });
      
      // Order management routes
      await app.register(orderRoutes, { prefix: '/orders' });
      
      // AI analysis routes
      await app.register(aiRoutes, { prefix: '/ai' });
      
      // Market data routes
      await app.register(marketRoutes, { prefix: '/market' });
      
      // Communication routes (SMS/Voice)
      await app.register(communicationRoutes, { prefix: '/communication' });
      
      // Webhook routes (no auth required)
      await app.register(webhookRoutes, { prefix: '/webhooks' });
      
    }, { prefix: API_PREFIX });

    // API documentation route
    app.get('/api', async (request, reply) => {
      return reply.redirect('/docs');
    });

    // 404 handler for unmatched routes
    app.setNotFoundHandler(async (request, reply) => {
      return reply.code(404).send({
        success: false,
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: `Route ${request.method} ${request.url} not found`,
          statusCode: 404
        }
      });
    });

    app.log.info('✅ All routes registered successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    app.log.error(`❌ Failed to register routes: ${errorMessage}`);
    throw error;
  }
}

export default registerRoutes;