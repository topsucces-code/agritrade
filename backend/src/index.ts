import Fastify, { FastifyInstance } from 'fastify';
import { config } from 'dotenv';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import { connectToDatabase } from './config/database';
import { connectToRedis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
import { authenticationHook } from './middleware/authentication';
import { registerRoutes } from './routes';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Load environment variables
config();

interface BootstrapResult {
  app: ReturnType<typeof Fastify>;
  address: string;
}

class AgriTradeServer {
  private app: ReturnType<typeof Fastify>;
  private readonly port: number;
  private readonly host: string;

  constructor() {
    this.app = Fastify({
      logger: process.env.NODE_ENV === 'development' ? {
        level: process.env.LOG_LEVEL || 'info',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname'
          }
        }
      } : {
        level: process.env.LOG_LEVEL || 'info'
      }
    });
    this.port = parseInt(process.env.PORT || '3000', 10);
    this.host = process.env.HOST || '0.0.0.0';
  }

  async bootstrap(): Promise<BootstrapResult> {
    try {
      // Register plugins
      await this.registerPlugins();
      
      // Setup middleware
      await this.setupMiddleware();
      
      // Connect to databases
      await this.connectDatabases();
      
      // Register routes
      await this.registerAllRoutes();
      
      // Setup error handling
      this.setupErrorHandling();
      
      // Start server
      const address = await this.app.listen({ port: this.port, host: this.host });
      
      this.app.log.info(`🚀 AgriTrade AI Server is running on ${address}`);
      this.app.log.info(`📖 API Documentation available at ${address}/docs`);
      
      return { app: this.app, address };
    } catch (error) {
      this.app.log.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  private async registerPlugins(): Promise<void> {
    // CORS configuration
    await this.app.register(cors, {
      origin: process.env.NODE_ENV === 'production' 
        ? [process.env.FRONTEND_URL!, process.env.MOBILE_APP_URL!]
        : true,
      credentials: true,
    });

    // Security headers
    await this.app.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    });

    // Rate limiting
    await this.app.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
      errorResponseBuilder: function (request: FastifyRequest, context: any) {
        return {
          error: 'Too Many Requests',
          message: `Rate limit exceeded, retry in ${context.after}`,
          statusCode: 429,
        };
      },
    });

    // File upload support
    await this.app.register(multipart, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit for images
        files: 5,
      },
    });

    // JWT authentication
    await this.app.register(jwt, {
      secret: process.env.JWT_SECRET!,
      sign: {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      },
    });

    // API documentation (Swagger)
    await this.app.register(require('@fastify/swagger'), {
      swagger: {
        info: {
          title: 'AgriTrade AI API',
          description: 'Revolutionary AI-powered agricultural trading platform API',
          version: '1.0.0',
        },
        host: this.host + ':' + this.port,
        schemes: ['http', 'https'],
        consumes: ['application/json', 'multipart/form-data'],
        produces: ['application/json'],
        securityDefinitions: {
          Bearer: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header',
          },
        },
      },
    });

    await this.app.register(require('@fastify/swagger-ui'), {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
    });
  }

  private async setupMiddleware(): Promise<void> {
    // Register authentication decorator
    await this.app.register(async function authPlugin(fastify: any) {
      fastify.decorate('authenticate', authenticationHook);
    });
    
    // Request logging
    this.app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      request.log.info(`📝 ${request.method} ${request.url} - ${request.ip}`);
    });

    // Response time header
    this.app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
      const responseTime = reply.getResponseTime();
      reply.header('X-Response-Time', `${responseTime}ms`);
      return payload;
    });
  }

  private async connectDatabases(): Promise<void> {
    // Connect to MongoDB (optional for development)
    try {
      await connectToDatabase();
      this.app.log.info('✅ Connected to MongoDB Atlas');
    } catch (error) {
      this.app.log.warn('⚠️ Failed to connect to MongoDB, continuing without database:', error);
    }

    // Connect to Redis (optional - graceful degradation)
    try {
      await connectToRedis();
      this.app.log.info('✅ Connected to Redis');
    } catch (error) {
      this.app.log.warn('⚠️ Failed to connect to Redis, continuing without cache:', error);
    }
  }

  private async registerAllRoutes(): Promise<void> {
    await registerRoutes(this.app);
    this.app.log.info('✅ All routes registered');
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.setErrorHandler(errorHandler);

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        this.app.log.info(`🛑 Received ${signal}, shutting down gracefully`);
        await this.app.close();
        process.exit(0);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.app.log.fatal('💥 Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.app.log.fatal('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }

  // Health check endpoint
  async healthCheck(): Promise<void> {
    this.app.get('/health', {
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
            },
          },
        },
      },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.code(200).send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
      });
    });
  }

  public getApp(): ReturnType<typeof Fastify> {
    return this.app;
  }
}

// Bootstrap the application
async function startServer(): Promise<void> {
  const server = new AgriTradeServer();
  await server.bootstrap();
}

// Start the server if this file is executed directly
if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { AgriTradeServer, startServer };
export default AgriTradeServer;