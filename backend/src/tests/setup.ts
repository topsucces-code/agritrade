import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { FastifyInstance } from 'fastify';
import { cache } from '../config/redis';

// Global test variables
let mongoServer: MongoMemoryServer;
let fastifyApp: FastifyInstance;

/**
 * Setup test environment before all tests
 */
beforeAll(async () => {
  try {
    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'agritrade-test'
      }
    });
    
    const mongoUri = mongoServer.getUri();
    
    // Connect to test database
    await mongoose.connect(mongoUri);
    
    // Setup Redis mock for tests
    if (process.env.NODE_ENV === 'test') {
      // Mock Redis operations for tests
      jest.mock('../config/redis', () => ({
        cache: {
          get: jest.fn(),
          set: jest.fn(),
          setJSON: jest.fn(),
          getJSON: jest.fn(),
          del: jest.fn(),
          exists: jest.fn(),
          expire: jest.fn(),
          keys: jest.fn(),
          flushall: jest.fn(),
          disconnect: jest.fn()
        }
      }));
    }
    
    console.log('Test environment setup completed');
    
  } catch (error) {
    console.error('Test setup failed:', error);
    throw error;
  }
});

/**
 * Cleanup after each test
 */
afterEach(async () => {
  try {
    // Clear all collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
    
    // Clear Redis cache if not mocked
    if (process.env.NODE_ENV !== 'test') {
      try {
        await cache.flushall();
      } catch (error) {
        // Ignore Redis errors in tests
      }
    }
    
  } catch (error) {
    console.error('Test cleanup failed:', error);
  }
});

/**
 * Cleanup test environment after all tests
 */
afterAll(async () => {
  try {
    // Close database connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    
    // Stop in-memory MongoDB server
    if (mongoServer) {
      await mongoServer.stop();
    }
    
    // Close Fastify app if exists
    if (fastifyApp) {
      await fastifyApp.close();
    }
    
    // Close Redis connection
    if (process.env.NODE_ENV !== 'test') {
      try {
        await cache.disconnect();
      } catch (error) {
        // Ignore Redis errors in tests
      }
    }
    
    console.log('Test environment cleanup completed');
    
  } catch (error) {
    console.error('Test cleanup failed:', error);
  }
});

/**
 * Test utilities and helpers
 */
export const testUtils = {
  /**
   * Create test database connection
   */
  async createTestConnection() {
    const uri = mongoServer?.getUri();
    if (uri && mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
    }
    return mongoose.connection;
  },
  
  /**
   * Get test database URI
   */
  getTestDatabaseUri() {
    return mongoServer?.getUri();
  },
  
  /**
   * Clear specific collection
   */
  async clearCollection(collectionName: string) {
    const collection = mongoose.connection.collections[collectionName];
    if (collection) {
      await collection.deleteMany({});
    }
  },
  
  /**
   * Create mock user for testing
   */
  createMockUser(overrides: any = {}) {
    return {
      _id: new mongoose.Types.ObjectId(),
      email: 'test@example.com',
      phoneNumber: '+254123456789',
      password: 'hashedPassword123',
      role: 'farmer',
      profile: {
        firstName: 'Test',
        lastName: 'User',
        languages: ['en'],
        timezone: 'UTC'
      },
      preferences: {
        notifications: {
          email: true,
          sms: true,
          whatsapp: false
        },
        currency: 'USD',
        units: 'metric'
      },
      location: {
        country: 'Kenya',
        region: 'Central',
        city: 'Nairobi',
        coordinates: {
          latitude: -1.2921,
          longitude: 36.8219
        }
      },
      verification: {
        email: { verified: true, verifiedAt: new Date() },
        phone: { verified: true, verifiedAt: new Date() }
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  },
  
  /**
   * Create mock product for testing
   */
  createMockProduct(farmerId: string, overrides: any = {}) {
    return {
      _id: new mongoose.Types.ObjectId(),
      farmerId: new mongoose.Types.ObjectId(farmerId),
      name: 'Test Cocoa Beans',
      type: 'cocoa',
      variety: 'Trinitario',
      description: 'High quality test cocoa',
      quantity: 100,
      unit: 'kg',
      pricePerUnit: 2.5,
      currency: 'USD',
      harvestDate: new Date(),
      availableFrom: new Date(),
      availableUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      qualityMetrics: {
        grade: 'A',
        moistureContent: 7.0,
        purity: 95.0,
        defectRate: 2.0,
        colorScore: 90,
        sizeScore: 88,
        overallScore: 92,
        confidence: 0.95,
        lastAnalyzed: new Date()
      },
      location: {
        country: 'Ghana',
        region: 'Ashanti',
        city: 'Kumasi',
        coordinates: {
          latitude: 6.6885,
          longitude: -1.6244
        }
      },
      status: 'available',
      images: [],
      certifications: ['organic'],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  },
  
  /**
   * Wait for async operations
   */
  async wait(ms: number = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  /**
   * Generate random test data
   */
  randomString(length: number = 10) {
    return Math.random().toString(36).substring(2, length + 2);
  },
  
  randomNumber(min: number = 1, max: number = 100) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  
  randomEmail() {
    return `test${this.randomString(6)}@example.com`;
  },
  
  randomPhoneNumber() {
    return `+254${this.randomNumber(100000000, 999999999)}`;
  }
};

// Environment setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/agritrade-test';

// Increase timeout for database operations
jest.setTimeout(30000);

export { mongoServer, fastifyApp };