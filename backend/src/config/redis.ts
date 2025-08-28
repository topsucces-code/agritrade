import { createClient, RedisClientType, RedisDefaultModules, RedisFunctions, RedisModules, RedisScripts } from 'redis';
import { config } from 'dotenv';

config();

type RedisClient = RedisClientType<RedisDefaultModules & RedisModules, RedisFunctions, RedisScripts>;

interface RedisConfig {
  url: string;
  password?: string;
  database?: number;
  retryDelayOnFailover?: number;
  enableReadyCheck?: boolean;
  maxRetriesPerRequest?: number;
}

class RedisManager {
  private static instance: RedisManager;
  private client: RedisClient | null = null;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      console.log('🔄 Redis already connected');
      return;
    }

    try {
      const config = this.getConfig();
      
      this.client = createClient({
        url: config.url,
        password: config.password,
        database: config.database,
        socket: {
          connectTimeout: 10000,
          reconnectStrategy: (retries: number) => {
            if (retries > 10) {
              console.error('❌ Redis: Too many reconnection attempts, giving up');
              return false;
            }
            const delay = Math.min(retries * 100, 3000);
            console.log(`🔄 Redis: Reconnecting in ${delay}ms... (attempt ${retries})`);
            return delay;
          },
        },
      });

      // Set up event listeners
      this.setupEventListeners();

      // Connect to Redis
      await this.client.connect();
      
      this.isConnected = true;
      console.log('✅ Successfully connected to Redis');
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      await this.client.quit();
      this.isConnected = false;
      this.client = null;
      console.log('🔌 Disconnected from Redis');
    } catch (error) {
      console.error('❌ Error disconnecting from Redis:', error);
      throw error;
    }
  }

  public getClient(): RedisClient {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client is not connected. Call connect() first.');
    }
    return this.client;
  }

  public isRedisConnected(): boolean {
    return this.isConnected && this.client !== null;
  }

  // Cache operations
  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const client = this.getClient();
    if (ttlSeconds) {
      await client.setEx(key, ttlSeconds, value);
    } else {
      await client.set(key, value);
    }
  }

  public async get(key: string): Promise<string | null> {
    const client = this.getClient();
    return await client.get(key);
  }

  public async del(key: string): Promise<number> {
    const client = this.getClient();
    return await client.del(key);
  }

  public async exists(key: string): Promise<number> {
    const client = this.getClient();
    return await client.exists(key);
  }

  public async setJSON(key: string, value: any, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  public async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    return value ? JSON.parse(value) : null;
  }

  // Session management
  public async setSession(sessionId: string, sessionData: any, ttlSeconds: number = 86400): Promise<void> {
    const key = `session:${sessionId}`;
    await this.setJSON(key, sessionData, ttlSeconds);
  }

  public async getSession<T>(sessionId: string): Promise<T | null> {
    const key = `session:${sessionId}`;
    return await this.getJSON<T>(key);
  }

  public async deleteSession(sessionId: string): Promise<number> {
    const key = `session:${sessionId}`;
    return await this.del(key);
  }

  // Rate limiting support
  public async increment(key: string, ttlSeconds?: number): Promise<number> {
    const client = this.getClient();
    const count = await client.incr(key);
    
    if (count === 1 && ttlSeconds) {
      await client.expire(key, ttlSeconds);
    }
    
    return count;
  }

  // Cache invalidation patterns
  public async invalidatePattern(pattern: string): Promise<number> {
    const client = this.getClient();
    const keys = await client.keys(pattern);
    
    if (keys.length === 0) {
      return 0;
    }
    
    return await client.del(keys);
  }

  private getConfig(): RedisConfig {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    const password = process.env.REDIS_PASSWORD;
    const database = process.env.REDIS_DATABASE ? parseInt(process.env.REDIS_DATABASE, 10) : 0;

    return {
      url,
      password,
      database,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
    };
  }

  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      console.log('🔗 Redis client connected');
    });

    this.client.on('ready', () => {
      console.log('✅ Redis client ready to receive commands');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      console.error('❌ Redis client error:', error);
      this.isConnected = false;
    });

    this.client.on('end', () => {
      console.log('🔌 Redis client connection ended');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Redis client reconnecting...');
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      try {
        await this.disconnect();
        console.log('🛑 Redis connection closed through app termination');
      } catch (error) {
        console.error('❌ Error during Redis graceful shutdown:', error);
      }
    });

    process.on('SIGTERM', async () => {
      try {
        await this.disconnect();
        console.log('🛑 Redis connection closed through app termination');
      } catch (error) {
        console.error('❌ Error during Redis graceful shutdown:', error);
      }
    });
  }
}

// Export the singleton instance methods
const redisManager = RedisManager.getInstance();

export const connectToRedis = (): Promise<void> => redisManager.connect();
export const disconnectFromRedis = (): Promise<void> => redisManager.disconnect();
export const getRedisClient = (): RedisClient => redisManager.getClient();
export const isRedisConnected = (): boolean => redisManager.isRedisConnected();

// Export cache operations
export const cache = {
  set: (key: string, value: string, ttl?: number) => redisManager.set(key, value, ttl),
  get: (key: string) => redisManager.get(key),
  del: (key: string) => redisManager.del(key),
  exists: (key: string) => redisManager.exists(key),
  setJSON: (key: string, value: any, ttl?: number) => redisManager.setJSON(key, value, ttl),
  getJSON: <T>(key: string) => redisManager.getJSON<T>(key),
  increment: (key: string, ttl?: number) => redisManager.increment(key, ttl),
  invalidatePattern: (pattern: string) => redisManager.invalidatePattern(pattern),
};

// Export session operations
export const session = {
  set: (sessionId: string, data: any, ttl?: number) => redisManager.setSession(sessionId, data, ttl),
  get: <T>(sessionId: string) => redisManager.getSession<T>(sessionId),
  delete: (sessionId: string) => redisManager.deleteSession(sessionId),
};

export default redisManager;