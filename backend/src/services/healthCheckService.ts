import mongoose from 'mongoose';
import { cache } from '../config/redis';
import { getCircuitBreakerHealthCheck } from '../middleware/circuitBreaker';
import { loggingHealthCheck } from './loggingService';
import { metricsService } from './metricsService';

// Health check status types
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

// Individual health check result
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  responseTime: number;
  details?: any;
  error?: string;
}

// Overall health check response
export interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    [key: string]: HealthCheckResult;
  };
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  };
}

// Database connection health
interface DatabaseHealth {
  connected: boolean;
  readyState: number;
  host: string;
  name: string;
  collections: number;
}

// Redis connection health
interface RedisHealth {
  connected: boolean;
  responseTime: number;
  memory: any;
}

/**
 * Health Check Service
 * Monitors the health of various system components
 */
export class HealthCheckService {
  private readonly version: string;
  private readonly startTime: Date;
  
  constructor() {
    this.version = process.env.APP_VERSION || '1.0.0';
    this.startTime = new Date();
  }

  /**
   * Perform comprehensive health check
   */
  async getFullHealthCheck(): Promise<HealthCheckResponse> {
    const startTime = Date.now();
    
    // Run all health checks in parallel
    const [
      databaseHealth,
      redisHealth,
      circuitBreakerHealth,
      loggingHealth,
      metricsHealth,
      externalServicesHealth,
      systemHealth
    ] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkCircuitBreakers(),
      this.checkLogging(),
      this.checkMetrics(),
      this.checkExternalServices(),
      this.checkSystemResources()
    ]);

    // Collect results
    const checks: { [key: string]: HealthCheckResult } = {
      database: this.formatHealthResult(databaseHealth),
      redis: this.formatHealthResult(redisHealth),
      circuitBreakers: this.formatHealthResult(circuitBreakerHealth),
      logging: this.formatHealthResult(loggingHealth),
      metrics: this.formatHealthResult(metricsHealth),
      externalServices: this.formatHealthResult(externalServicesHealth),
      system: this.formatHealthResult(systemHealth)
    };

    // Calculate summary
    const summary = this.calculateSummary(checks);
    
    // Determine overall status
    const overallStatus = this.calculateOverallStatus(summary);

    const responseTime = Date.now() - startTime;

    // Record health check metrics
    await metricsService.timing('health_check.duration', responseTime);
    await metricsService.counter('health_check.requests', 1, { status: overallStatus });

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: this.version,
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      checks,
      summary
    };
  }

  /**
   * Get basic health check (lightweight)
   */
  async getBasicHealthCheck(): Promise<Omit<HealthCheckResponse, 'checks'>> {
    const startTime = Date.now();
    
    // Only check critical components
    const [databaseHealth, redisHealth] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis()
    ]);

    const checks = {
      database: this.formatHealthResult(databaseHealth),
      redis: this.formatHealthResult(redisHealth)
    };

    const summary = this.calculateSummary(checks);
    const overallStatus = this.calculateOverallStatus(summary);
    const responseTime = Date.now() - startTime;

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: this.version,
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      summary
    };
  }

  /**
   * Check individual component health
   */
  async checkComponentHealth(component: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      let result: any;
      
      switch (component) {
        case 'database':
          result = await this.checkDatabase();
          break;
        case 'redis':
          result = await this.checkRedis();
          break;
        case 'circuitBreakers':
          result = await this.checkCircuitBreakers();
          break;
        case 'logging':
          result = await this.checkLogging();
          break;
        case 'metrics':
          result = await this.checkMetrics();
          break;
        case 'externalServices':
          result = await this.checkExternalServices();
          break;
        case 'system':
          result = await this.checkSystemResources();
          break;
        default:
          throw new Error(`Unknown component: ${component}`);
      }

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        details: result
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Individual health check methods

  private async checkDatabase(): Promise<DatabaseHealth> {
    const startTime = Date.now();
    
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database not connected');
    }

    // Test database operation
    try {
      await mongoose.connection.db.admin().ping();
    } catch (error) {
      throw new Error(`Database ping failed: ${error}`);
    }

    const collections = await mongoose.connection.db.listCollections().toArray();

    const responseTime = Date.now() - startTime;
    
    return {
      connected: true,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      collections: collections.length
    };
  }

  private async checkRedis(): Promise<RedisHealth> {
    const startTime = Date.now();
    
    try {
      // Test Redis connection with ping
      await cache.ping();
      
      // Test set/get operation
      const testKey = 'health:check:test';
      await cache.set(testKey, 'test', 10);
      const testValue = await cache.get(testKey);
      
      if (testValue !== 'test') {
        throw new Error('Redis read/write test failed');
      }
      
      await cache.del(testKey);
      
      const responseTime = Date.now() - startTime;
      
      // Get Redis info
      const info = await cache.getClient().memory('usage', 'health:check');
      
      return {
        connected: true,
        responseTime,
        memory: info
      };
    } catch (error) {
      throw new Error(`Redis check failed: ${error}`);
    }
  }

  private async checkCircuitBreakers(): Promise<any> {
    try {
      return await getCircuitBreakerHealthCheck();
    } catch (error) {
      throw new Error(`Circuit breaker check failed: ${error}`);
    }
  }

  private async checkLogging(): Promise<any> {
    try {
      return loggingHealthCheck();
    } catch (error) {
      throw new Error(`Logging check failed: ${error}`);
    }
  }

  private async checkMetrics(): Promise<any> {
    try {
      const healthMetrics = await metricsService.getHealthMetrics();
      const currentMetrics = await metricsService.getCurrentMetrics();
      
      return {
        health: healthMetrics,
        current: currentMetrics,
        status: 'operational'
      };
    } catch (error) {
      throw new Error(`Metrics check failed: ${error}`);
    }
  }

  private async checkExternalServices(): Promise<any> {
    // This would check external service availability
    // For now, return circuit breaker status as proxy
    try {
      const circuitBreakerHealth = await getCircuitBreakerHealthCheck();
      
      const externalServicesStatus = {
        total: circuitBreakerHealth.summary.total,
        operational: circuitBreakerHealth.summary.closed,
        degraded: circuitBreakerHealth.summary.halfOpen,
        down: circuitBreakerHealth.summary.open,
        services: circuitBreakerHealth.services.map((service: any) => ({
          name: service.serviceName,
          status: service.state === 'CLOSED' ? 'operational' : 
                  service.state === 'HALF_OPEN' ? 'degraded' : 'down'
        }))
      };
      
      return externalServicesStatus;
    } catch (error) {
      throw new Error(`External services check failed: ${error}`);
    }
  }

  private async checkSystemResources(): Promise<any> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Check memory usage (warn if > 80% of heap)
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    // Check if we're running out of memory
    const memoryWarning = heapUsagePercent > 80;
    const memoryError = heapUsagePercent > 95;
    
    // Get event loop lag
    const eventLoopLag = await this.measureEventLoopLag();
    
    // Check event loop lag (warn if > 100ms)
    const eventLoopWarning = eventLoopLag > 100;
    const eventLoopError = eventLoopLag > 1000;
    
    const systemStatus = {
      memory: {
        usage: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external,
          arrayBuffers: memUsage.arrayBuffers
        },
        heapUsagePercent: Math.round(heapUsagePercent * 100) / 100,
        warning: memoryWarning,
        error: memoryError
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      eventLoop: {
        lag: eventLoopLag,
        warning: eventLoopWarning,
        error: eventLoopError
      },
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
    
    // Determine if system is unhealthy
    if (memoryError || eventLoopError) {
      throw new Error('System resources critically low');
    }
    
    if (memoryWarning || eventLoopWarning) {
      systemStatus.status = 'degraded';
    } else {
      systemStatus.status = 'healthy';
    }
    
    return systemStatus;
  }

  // Helper methods

  private formatHealthResult(result: PromiseSettledResult<any>): HealthCheckResult {
    const timestamp = new Date().toISOString();
    
    if (result.status === 'fulfilled') {
      return {
        status: 'healthy',
        timestamp,
        responseTime: 0, // This would be measured in actual implementations
        details: result.value
      };
    } else {
      return {
        status: 'unhealthy',
        timestamp,
        responseTime: 0,
        error: result.reason?.message || 'Unknown error'
      };
    }
  }

  private calculateSummary(checks: { [key: string]: HealthCheckResult }) {
    const summary = {
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      total: 0
    };

    Object.values(checks).forEach(check => {
      summary.total++;
      
      if (check.status === 'healthy') {
        summary.healthy++;
      } else if (check.status === 'degraded') {
        summary.degraded++;
      } else {
        summary.unhealthy++;
      }
    });

    return summary;
  }

  private calculateOverallStatus(summary: { healthy: number; degraded: number; unhealthy: number; total: number }): HealthStatus {
    // If any critical components are unhealthy, mark as unhealthy
    if (summary.unhealthy > 0) {
      return 'unhealthy';
    }
    
    // If some components are degraded, mark as degraded
    if (summary.degraded > 0) {
      return 'degraded';
    }
    
    // All components are healthy
    return 'healthy';
  }

  private measureEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        resolve(lag);
      });
    });
  }

  /**
   * Get readiness probe (for Kubernetes)
   */
  async getReadinessProbe(): Promise<{ status: 'ready' | 'not-ready'; timestamp: string }> {
    try {
      // Check only critical components for readiness
      const [dbCheck, redisCheck] = await Promise.allSettled([
        this.checkDatabase(),
        this.checkRedis()
      ]);

      const isReady = dbCheck.status === 'fulfilled' && redisCheck.status === 'fulfilled';

      return {
        status: isReady ? 'ready' : 'not-ready',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'not-ready',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get liveness probe (for Kubernetes)
   */
  async getLivenessProbe(): Promise<{ status: 'alive' | 'dead'; timestamp: string; uptime: number }> {
    try {
      // Simple check to ensure the process is responsive
      const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
      
      return {
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime
      };
    } catch (error) {
      return {
        status: 'dead',
        timestamp: new Date().toISOString(),
        uptime: 0
      };
    }
  }
}

// Export singleton instance
export const healthCheckService = new HealthCheckService();
export default healthCheckService;