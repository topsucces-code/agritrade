import { FastifyRequest, FastifyReply } from 'fastify';
// import Redis from 'ioredis';
import { EventEmitter } from 'events';

// Temporary Redis interface to avoid dependency issues
interface RedisClient {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<void>;
}

// Circuit Breaker States
enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

// Circuit Breaker Configuration
interface CircuitBreakerConfig {
  failureThreshold: number;           // Number of failures before opening
  successThreshold: number;           // Number of successes needed to close
  timeout: number;                    // Timeout in milliseconds for half-open state
  resetTimeout: number;               // Time to wait before trying half-open
  monitoringPeriod: number;          // Period to monitor for failures
  volumeThreshold: number;            // Minimum number of requests before evaluating
  errorThresholdPercentage: number;   // Percentage of errors to trigger opening
  maxRetries: number;                 // Maximum retry attempts
  retryDelay: number;                 // Delay between retries
}

// Default configurations for different services
const DEFAULT_CONFIGS: Record<string, CircuitBreakerConfig> = {
  'google-vision': {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 30000,
    resetTimeout: 60000,
    monitoringPeriod: 60000,
    volumeThreshold: 10,
    errorThresholdPercentage: 50,
    maxRetries: 3,
    retryDelay: 1000
  },
  'weather-api': {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 15000,
    resetTimeout: 30000,
    monitoringPeriod: 30000,
    volumeThreshold: 5,
    errorThresholdPercentage: 40,
    maxRetries: 2,
    retryDelay: 500
  },
  'market-data': {
    failureThreshold: 4,
    successThreshold: 2,
    timeout: 20000,
    resetTimeout: 45000,
    monitoringPeriod: 45000,
    volumeThreshold: 8,
    errorThresholdPercentage: 45,
    maxRetries: 3,
    retryDelay: 750
  },
  'africa-talking': {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 10000,
    resetTimeout: 20000,
    monitoringPeriod: 20000,
    volumeThreshold: 5,
    errorThresholdPercentage: 35,
    maxRetries: 2,
    retryDelay: 300
  },
  'pricing-service': {
    failureThreshold: 4,
    successThreshold: 3,
    timeout: 25000,
    resetTimeout: 50000,
    monitoringPeriod: 50000,
    volumeThreshold: 6,
    errorThresholdPercentage: 40,
    maxRetries: 3,
    retryDelay: 800
  }
};

// Circuit Breaker Metrics
interface CircuitBreakerMetrics {
  requestCount: number;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  state: CircuitBreakerState;
  lastStateChange: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  averageResponseTime: number;
  lastRequestTime: number;
}

// Circuit Breaker Error Types
export class CircuitBreakerError extends Error {
  constructor(message: string, public serviceName: string, public state: CircuitBreakerState) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class ServiceTimeoutError extends Error {
  constructor(message: string, public serviceName: string, public timeout: number) {
    super(message);
    this.name = 'ServiceTimeoutError';
  }
}

export class ServiceUnavailableError extends Error {
  constructor(message: string, public serviceName: string) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

// Advanced Circuit Breaker Implementation
export class AdvancedCircuitBreaker extends EventEmitter {
  private config: CircuitBreakerConfig;
  private metrics: CircuitBreakerMetrics;
  private redis?: RedisClient;
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private slidingWindow: Array<{ timestamp: number; success: boolean; responseTime: number }> = [];

  constructor(
    public serviceName: string,
    config?: Partial<CircuitBreakerConfig>,
    redis?: RedisClient
  ) {
    super();
    this.config = { ...DEFAULT_CONFIGS[serviceName] || DEFAULT_CONFIGS['market-data'], ...config };
    this.redis = redis; // Simplified Redis handling
    
    this.metrics = {
      requestCount: 0,
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      state: CircuitBreakerState.CLOSED,
      lastStateChange: Date.now(),
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      averageResponseTime: 0,
      lastRequestTime: 0
    };

    this.loadMetricsFromRedis();
    this.startMetricsCleanup();
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    
    // Check if circuit breaker should block the request
    if (this.shouldRejectRequest()) {
      this.emit('request_rejected', { serviceName: this.serviceName, state: this.metrics.state });
      
      if (fallback) {
        return await fallback();
      }
      
      throw new CircuitBreakerError(
        `Circuit breaker is ${this.metrics.state} for service ${this.serviceName}`,
        this.serviceName,
        this.metrics.state
      );
    }

    this.metrics.requestCount++;
    this.metrics.totalRequests++;
    this.metrics.lastRequestTime = startTime;

    let attempt = 0;
    let lastError: Error;

    while (attempt <= this.config.maxRetries) {
      try {
        // Add timeout protection
        const result = await this.executeWithTimeout(operation, this.config.timeout);
        
        const responseTime = Date.now() - startTime;
        this.onSuccess(responseTime);
        
        return result;
        
      } catch (error) {
        lastError = error as Error;
        attempt++;
        
        if (attempt <= this.config.maxRetries) {
          await this.delay(this.config.retryDelay * attempt);
          this.emit('retry_attempt', { 
            serviceName: this.serviceName, 
            attempt, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }
    }

    // All retries failed
    this.onFailure(lastError!);
    
    if (fallback) {
      try {
        return await fallback();
      } catch (fallbackError) {
        throw lastError!;
      }
    }
    
    throw lastError!;
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(operation: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ServiceTimeoutError(
          `Operation timed out after ${timeout}ms`,
          this.serviceName,
          timeout
        ));
      }, timeout);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Check if request should be rejected based on circuit breaker state
   */
  private shouldRejectRequest(): boolean {
    const now = Date.now();
    
    switch (this.metrics.state) {
      case CircuitBreakerState.CLOSED:
        return false;
        
      case CircuitBreakerState.OPEN:
        if (now - this.metrics.lastStateChange >= this.config.resetTimeout) {
          this.setState(CircuitBreakerState.HALF_OPEN);
          return false;
        }
        return true;
        
      case CircuitBreakerState.HALF_OPEN:
        // Allow limited requests in half-open state
        return this.metrics.consecutiveSuccesses >= this.config.successThreshold;
        
      default:
        return false;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(responseTime: number): void {
    this.metrics.successCount++;
    this.metrics.totalSuccesses++;
    this.metrics.consecutiveSuccesses++;
    this.metrics.consecutiveFailures = 0;
    this.metrics.lastSuccessTime = Date.now();
    
    // Update sliding window
    this.updateSlidingWindow(true, responseTime);
    
    // Update average response time
    this.updateAverageResponseTime(responseTime);

    // Transition to CLOSED if in HALF_OPEN and enough successes
    if (this.metrics.state === CircuitBreakerState.HALF_OPEN &&
        this.metrics.consecutiveSuccesses >= this.config.successThreshold) {
      this.setState(CircuitBreakerState.CLOSED);
    }

    this.emit('success', {
      serviceName: this.serviceName,
      responseTime,
      consecutiveSuccesses: this.metrics.consecutiveSuccesses
    });

    this.saveMetricsToRedis();
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: Error): void {
    this.metrics.failureCount++;
    this.metrics.totalFailures++;
    this.metrics.consecutiveFailures++;
    this.metrics.consecutiveSuccesses = 0;
    this.metrics.lastFailureTime = Date.now();
    
    // Update sliding window
    this.updateSlidingWindow(false, 0);

    // Check if circuit breaker should open
    if (this.shouldOpenCircuit()) {
      this.setState(CircuitBreakerState.OPEN);
    }

    this.emit('failure', {
      serviceName: this.serviceName,
      error: error.message,
      consecutiveFailures: this.metrics.consecutiveFailures,
      state: this.metrics.state
    });

    this.saveMetricsToRedis();
  }

  /**
   * Determine if circuit should open based on failure patterns
   */
  private shouldOpenCircuit(): boolean {
    const now = Date.now();
    const monitoringPeriod = this.config.monitoringPeriod;
    
    // Check consecutive failures threshold
    if (this.metrics.consecutiveFailures >= this.config.failureThreshold) {
      return true;
    }

    // Check error percentage in monitoring period
    const recentRequests = this.slidingWindow.filter(
      request => now - request.timestamp <= monitoringPeriod
    );

    if (recentRequests.length >= this.config.volumeThreshold) {
      const failures = recentRequests.filter(request => !request.success).length;
      const errorPercentage = (failures / recentRequests.length) * 100;
      
      if (errorPercentage >= this.config.errorThresholdPercentage) {
        return true;
      }
    }

    return false;
  }

  /**
   * Set circuit breaker state
   */
  private setState(newState: CircuitBreakerState): void {
    const oldState = this.metrics.state;
    this.metrics.state = newState;
    this.metrics.lastStateChange = Date.now();

    if (newState === CircuitBreakerState.CLOSED) {
      this.metrics.consecutiveFailures = 0;
      this.metrics.failureCount = 0;
      this.metrics.successCount = 0;
    }

    this.emit('state_change', {
      serviceName: this.serviceName,
      oldState,
      newState,
      timestamp: this.metrics.lastStateChange
    });

    this.saveMetricsToRedis();
  }

  /**
   * Update sliding window for monitoring
   */
  private updateSlidingWindow(success: boolean, responseTime: number): void {
    const now = Date.now();
    
    this.slidingWindow.push({
      timestamp: now,
      success,
      responseTime
    });

    // Clean old entries outside monitoring period
    const cutoff = now - this.config.monitoringPeriod;
    this.slidingWindow = this.slidingWindow.filter(entry => entry.timestamp > cutoff);

    // Limit sliding window size to prevent memory issues
    if (this.slidingWindow.length > 1000) {
      this.slidingWindow = this.slidingWindow.slice(-500);
    }
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(responseTime: number): void {
    const totalResponseTime = this.metrics.averageResponseTime * (this.metrics.totalSuccesses - 1);
    this.metrics.averageResponseTime = (totalResponseTime + responseTime) / this.metrics.totalSuccesses;
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics & { 
    errorRate: number; 
    successRate: number;
    uptime: number;
    recentPerformance: any;
  } {
    const now = Date.now();
    const totalRequests = this.metrics.totalRequests;
    const errorRate = totalRequests > 0 ? (this.metrics.totalFailures / totalRequests) * 100 : 0;
    const successRate = totalRequests > 0 ? (this.metrics.totalSuccesses / totalRequests) * 100 : 0;
    const uptime = this.metrics.state === CircuitBreakerState.CLOSED ? 100 : 
                   this.metrics.state === CircuitBreakerState.HALF_OPEN ? 50 : 0;

    // Recent performance analysis
    const recentRequests = this.slidingWindow.filter(
      request => now - request.timestamp <= 60000 // Last minute
    );
    
    const recentSuccesses = recentRequests.filter(r => r.success);
    const recentFailures = recentRequests.filter(r => !r.success);
    
    const recentPerformance = {
      requestCount: recentRequests.length,
      successCount: recentSuccesses.length,
      failureCount: recentFailures.length,
      averageResponseTime: recentSuccesses.length > 0 ?
        recentSuccesses.reduce((sum, r) => sum + r.responseTime, 0) / recentSuccesses.length : 0,
      errorRate: recentRequests.length > 0 ? (recentFailures.length / recentRequests.length) * 100 : 0
    };

    return {
      ...this.metrics,
      errorRate,
      successRate,
      uptime,
      recentPerformance
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.metrics = {
      requestCount: 0,
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      state: CircuitBreakerState.CLOSED,
      lastStateChange: Date.now(),
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      averageResponseTime: 0,
      lastRequestTime: 0
    };

    this.slidingWindow = [];
    this.saveMetricsToRedis();

    this.emit('reset', { serviceName: this.serviceName });
  }

  /**
   * Force circuit breaker to specific state
   */
  forceState(state: CircuitBreakerState): void {
    this.setState(state);
    this.emit('force_state', { serviceName: this.serviceName, state });
  }

  /**
   * Check if service is healthy
   */
  isHealthy(): boolean {
    return this.metrics.state === CircuitBreakerState.CLOSED;
  }

  /**
   * Load metrics from Redis for persistence
   */
  private async loadMetricsFromRedis(): Promise<void> {
    if (!this.redis) return;
    
    try {
      const key = `circuit_breaker:${this.serviceName}`;
      const data = await this.redis.get(key);
      
      if (data) {
        const savedMetrics = JSON.parse(data);
        this.metrics = { ...this.metrics, ...savedMetrics };
        
        // If circuit was open and enough time passed, set to half-open
        if (this.metrics.state === CircuitBreakerState.OPEN &&
            Date.now() - this.metrics.lastStateChange >= this.config.resetTimeout) {
          this.setState(CircuitBreakerState.HALF_OPEN);
        }
      }
    } catch (error) {
      console.error(`Failed to load circuit breaker metrics for ${this.serviceName}:`, error);
    }
  }

  /**
   * Save metrics to Redis for persistence
   */
  private async saveMetricsToRedis(): Promise<void> {
    if (!this.redis) return;
    
    try {
      const key = `circuit_breaker:${this.serviceName}`;
      await this.redis.setex(key, 3600, JSON.stringify(this.metrics)); // 1 hour TTL
    } catch (error) {
      console.error(`Failed to save circuit breaker metrics for ${this.serviceName}:`, error);
    }
  }

  /**
   * Start cleanup timer for old metrics
   */
  private startMetricsCleanup(): void {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const cutoff = now - this.config.monitoringPeriod * 2;
      
      this.slidingWindow = this.slidingWindow.filter(entry => entry.timestamp > cutoff);
      
      // Reset counters periodically if circuit is healthy
      if (this.metrics.state === CircuitBreakerState.CLOSED && 
          now - this.metrics.lastStateChange > this.config.monitoringPeriod * 3) {
        this.metrics.requestCount = 0;
        this.metrics.failureCount = 0;
        this.metrics.successCount = 0;
      }
    }, this.config.monitoringPeriod);

    this.timers.set('cleanup', cleanupInterval);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Public method to record failure
   */
  public recordFailure(error: Error): void {
    this.onFailure(error);
  }

  /**
   * Public method to record success
   */
  public recordSuccess(responseTime?: number): void {
    this.onSuccess(responseTime || 0);
  }
  destroy(): void {
    this.timers.forEach(timer => clearInterval(timer));
    this.timers.clear();
    this.removeAllListeners();
  }
}

// Circuit Breaker Manager for multiple services
export class CircuitBreakerManager {
  private breakers: Map<string, AdvancedCircuitBreaker> = new Map();
  private redis?: RedisClient;

  constructor(redis?: RedisClient) {
    this.redis = redis; // Simplified Redis handling
  }

  /**
   * Get or create circuit breaker for service
   */
  getBreaker(serviceName: string, config?: Partial<CircuitBreakerConfig>): AdvancedCircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      const breaker = new AdvancedCircuitBreaker(serviceName, config, this.redis);
      this.breakers.set(serviceName, breaker);
      
      // Set up event forwarding for monitoring
      breaker.on('state_change', (event) => {
        console.log(`Circuit breaker state changed for ${event.serviceName}: ${event.oldState} -> ${event.newState}`);
      });
      
      breaker.on('failure', (event) => {
        console.warn(`Service failure detected for ${event.serviceName}: ${event.error}`);
      });
    }
    
    return this.breakers.get(serviceName)!;
  }

  /**
   * Get all circuit breaker metrics
   */
  getAllMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    this.breakers.forEach((breaker, serviceName) => {
      metrics[serviceName] = breaker.getMetrics();
    });
    
    return metrics;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }

  /**
   * Get system health status
   */
  getSystemHealth(): {
    healthy: boolean;
    services: Record<string, boolean>;
    unhealthyCount: number;
    totalServices: number;
  } {
    const services: Record<string, boolean> = {};
    let unhealthyCount = 0;
    
    this.breakers.forEach((breaker, serviceName) => {
      const isHealthy = breaker.isHealthy();
      services[serviceName] = isHealthy;
      if (!isHealthy) unhealthyCount++;
    });
    
    return {
      healthy: unhealthyCount === 0,
      services,
      unhealthyCount,
      totalServices: this.breakers.size
    };
  }

  /**
   * Cleanup all circuit breakers
   */
  destroy(): void {
    this.breakers.forEach(breaker => breaker.destroy());
    this.breakers.clear();
  }
}

// Global circuit breaker manager instance
export const circuitBreakerManager = new CircuitBreakerManager();

// Pre-configured service circuit breakers
export const serviceCircuitBreakers = {
  africasTalking: circuitBreakerManager.getBreaker('africa-talking'),
  whatsApp: circuitBreakerManager.getBreaker('whatsapp'),
  openWeather: circuitBreakerManager.getBreaker('weather-api'),
  nasaPower: circuitBreakerManager.getBreaker('weather-api'),
  faoGiews: circuitBreakerManager.getBreaker('market-data'),
  mapbox: circuitBreakerManager.getBreaker('market-data'),
  googleVision: circuitBreakerManager.getBreaker('google-vision'),
  pricingService: circuitBreakerManager.getBreaker('pricing-service')
};

// Fastify plugin for circuit breaker middleware
export default async function circuitBreakerPlugin(app: any) {
  // Add circuit breaker manager to Fastify instance
  app.decorate('circuitBreakers', circuitBreakerManager);

  // Add middleware to track API response patterns
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const serviceName = 'api-server';
    const breaker = circuitBreakerManager.getBreaker(serviceName);
    
    // Track API response patterns for internal monitoring
    if (reply.statusCode >= 500) {
      breaker.recordFailure(new Error(`HTTP ${reply.statusCode}`));
    } else {
      const responseTime = Date.now() - (request as any).startTime;
      breaker.recordSuccess(responseTime);
    }
  });

  // Health check endpoint for circuit breakers
  app.get('/health/circuit-breakers', async (request: FastifyRequest, reply: FastifyReply) => {
    const health = circuitBreakerManager.getSystemHealth();
    const metrics = circuitBreakerManager.getAllMetrics();
    
    return reply.send({
      timestamp: new Date().toISOString(),
      status: health.healthy ? 'healthy' : 'degraded',
      summary: health,
      details: metrics
    });
  });
}