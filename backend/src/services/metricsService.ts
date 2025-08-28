import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { FastifyRequest, FastifyReply } from 'fastify';

// Performance Metrics Interfaces
export interface AIServiceMetrics {
  serviceName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughputPerMinute: number;
  errorRate: number;
  lastUpdated: Date;
  uptimePercentage: number;
  
  // AI-specific metrics
  averageConfidence: number;
  averageQualityScore: number;
  analysisAccuracy?: number;
  modelVersion: string;
  
  // Resource utilization
  cpuUsage?: number;
  memoryUsage?: number;
  gpuUsage?: number;
  
  // Business metrics
  dailyAnalyses: number;
  monthlyAnalyses: number;
  uniqueUsers: number;
  revenueImpact?: number;
}

export interface SystemHealthMetrics {
  timestamp: Date;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  services: Record<string, ServiceHealthStatus>;
  alertsActive: Alert[];
  performanceSummary: {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
  };
  resourceUtilization: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
}

export interface ServiceHealthStatus {
  status: 'healthy' | 'degraded' | 'critical' | 'down';
  responseTime: number;
  errorRate: number;
  throughput: number;
  lastChecked: Date;
  uptime: number;
  issues: string[];
}

export interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  service: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: any;
}

export interface PerformanceThresholds {
  responseTimeWarning: number;    // ms
  responseTimeCritical: number;   // ms
  errorRateWarning: number;       // percentage
  errorRateCritical: number;      // percentage
  throughputMinimum: number;      // requests per minute
  confidenceMinimum: number;      // minimum AI confidence
  uptimeMinimum: number;          // percentage
}

// Performance data point for time series
interface MetricDataPoint {
  timestamp: Date;
  value: number;
  metadata?: any;
}

/**
 * Comprehensive metrics collection and performance monitoring service
 */
export class MetricsService extends EventEmitter {
  private redis: Redis;
  private metricsCache: Map<string, AIServiceMetrics> = new Map();
  private responseTimes: Map<string, number[]> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private isCollecting = false;
  
  private readonly DEFAULT_THRESHOLDS: PerformanceThresholds = {
    responseTimeWarning: 2000,     // 2 seconds
    responseTimeCritical: 5000,    // 5 seconds
    errorRateWarning: 5,           // 5%
    errorRateCritical: 15,         // 15%
    throughputMinimum: 10,         // 10 requests per minute
    confidenceMinimum: 0.7,        // 70% confidence
    uptimeMinimum: 99.5            // 99.5% uptime
  };

  constructor(redis?: Redis) {
    super();
    this.redis = redis || new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.startMetricsCollection();
  }

  /**
   * Start metrics collection and monitoring
   */
  private startMetricsCollection(): void {
    if (this.isCollecting) return;
    
    this.isCollecting = true;
    
    // Collect metrics every minute
    setInterval(() => {
      this.collectSystemMetrics();
    }, 60000);
    
    // Aggregate and store metrics every 5 minutes
    setInterval(() => {
      this.aggregateAndStoreMetrics();
    }, 300000);
    
    // Check health and alerts every 30 seconds
    setInterval(() => {
      this.checkHealthAndAlerts();
    }, 30000);
    
    console.log('Metrics collection started');
  }

  /**
   * Record AI service request metrics
   */
  async recordAIRequest(
    serviceName: string,
    responseTime: number,
    success: boolean,
    confidence?: number,
    qualityScore?: number,
    userId?: string,
    metadata?: any
  ): Promise<void> {
    const now = new Date();
    const key = `metrics:${serviceName}`;
    
    // Update in-memory cache
    let metrics = this.metricsCache.get(serviceName) || this.initializeMetrics(serviceName);
    
    metrics.totalRequests++;
    metrics.lastUpdated = now;
    
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }
    
    // Update response time statistics
    this.updateResponseTimeStats(serviceName, responseTime, metrics);
    
    // Update AI-specific metrics
    if (confidence !== undefined) {
      this.updateAverageMetric('confidence', confidence, metrics);
    }
    
    if (qualityScore !== undefined) {
      this.updateAverageMetric('qualityScore', qualityScore, metrics);
    }
    
    // Update error rate
    metrics.errorRate = (metrics.failedRequests / metrics.totalRequests) * 100;
    
    // Store updated metrics
    this.metricsCache.set(serviceName, metrics);
    
    // Store detailed request data in Redis
    await this.storeRequestData(serviceName, {
      timestamp: now,
      responseTime,
      success,
      confidence,
      qualityScore,
      userId,
      metadata
    });
    
    // Emit real-time event
    this.emit('request_recorded', {
      serviceName,
      responseTime,
      success,
      confidence,
      qualityScore,
      timestamp: now
    });
    
    // Check for immediate alerts
    this.checkServiceHealth(serviceName, metrics);
  }

  /**
   * Initialize metrics for a new service
   */
  private initializeMetrics(serviceName: string): AIServiceMetrics {
    return {
      serviceName,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      throughputPerMinute: 0,
      errorRate: 0,
      lastUpdated: new Date(),
      uptimePercentage: 100,
      averageConfidence: 0,
      averageQualityScore: 0,
      modelVersion: 'v1.0.0',
      dailyAnalyses: 0,
      monthlyAnalyses: 0,
      uniqueUsers: 0
    };
  }

  /**
   * Update response time statistics
   */
  private updateResponseTimeStats(serviceName: string, responseTime: number, metrics: AIServiceMetrics): void {
    // Add to response times array (keep last 1000 for percentile calculations)
    let responseTimes = this.responseTimes.get(serviceName) || [];
    responseTimes.push(responseTime);
    
    if (responseTimes.length > 1000) {
      responseTimes = responseTimes.slice(-1000);
    }
    
    this.responseTimes.set(serviceName, responseTimes);
    
    // Update basic stats
    metrics.minResponseTime = Math.min(metrics.minResponseTime, responseTime);
    metrics.maxResponseTime = Math.max(metrics.maxResponseTime, responseTime);
    
    // Calculate average (weighted)
    const totalTime = metrics.averageResponseTime * (metrics.totalRequests - 1) + responseTime;
    metrics.averageResponseTime = totalTime / metrics.totalRequests;
    
    // Calculate percentiles
    if (responseTimes.length >= 10) {
      const sorted = [...responseTimes].sort((a, b) => a - b);
      metrics.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)];
      metrics.p99ResponseTime = sorted[Math.floor(sorted.length * 0.99)];
    }
  }

  /**
   * Update average metric (confidence, quality score, etc.)
   */
  private updateAverageMetric(metricType: string, value: number, metrics: AIServiceMetrics): void {
    const currentAverage = metricType === 'confidence' ? metrics.averageConfidence : metrics.averageQualityScore;
    const newAverage = (currentAverage * (metrics.totalRequests - 1) + value) / metrics.totalRequests;
    
    if (metricType === 'confidence') {
      metrics.averageConfidence = newAverage;
    } else {
      metrics.averageQualityScore = newAverage;
    }
  }

  /**
   * Store detailed request data in Redis
   */
  private async storeRequestData(serviceName: string, data: any): Promise<void> {
    try {
      const key = `requests:${serviceName}:${data.timestamp.toISOString().split('T')[0]}`;
      await this.redis.lpush(key, JSON.stringify(data));
      await this.redis.expire(key, 86400 * 7); // Keep for 7 days
      
      // Store real-time data for dashboard
      const realtimeKey = `realtime:${serviceName}`;
      await this.redis.lpush(realtimeKey, JSON.stringify(data));
      await this.redis.ltrim(realtimeKey, 0, 99); // Keep last 100 requests
    } catch (error) {
      console.error('Failed to store request data:', error);
    }
  }

  /**
   * Get current metrics for a service
   */
  getServiceMetrics(serviceName: string): AIServiceMetrics | null {
    return this.metricsCache.get(serviceName) || null;
  }

  /**
   * Get metrics for all services
   */
  getAllServiceMetrics(): Record<string, AIServiceMetrics> {
    const metrics: Record<string, AIServiceMetrics> = {};
    this.metricsCache.forEach((value, key) => {
      metrics[key] = value;
    });
    return metrics;
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealthMetrics> {
    const now = new Date();
    const services: Record<string, ServiceHealthStatus> = {};
    let totalRequests = 0;
    let totalResponseTime = 0;
    let totalErrors = 0;
    let totalThroughput = 0;

    // Analyze each service
    for (const [serviceName, metrics] of this.metricsCache) {
      const status = this.determineServiceStatus(metrics);
      services[serviceName] = {
        status,
        responseTime: metrics.averageResponseTime,
        errorRate: metrics.errorRate,
        throughput: metrics.throughputPerMinute,
        lastChecked: metrics.lastUpdated,
        uptime: metrics.uptimePercentage,
        issues: this.getServiceIssues(serviceName, metrics)
      };

      totalRequests += metrics.totalRequests;
      totalResponseTime += metrics.averageResponseTime;
      totalErrors += metrics.failedRequests;
      totalThroughput += metrics.throughputPerMinute;
    }

    const serviceCount = this.metricsCache.size;
    const overallHealth = this.determineOverallHealth(services);
    
    // Get system resource utilization (mock data - would integrate with actual monitoring)
    const resourceUtilization = await this.getResourceUtilization();

    return {
      timestamp: now,
      overallHealth,
      services,
      alertsActive: Array.from(this.alerts.values()).filter(alert => !alert.resolved),
      performanceSummary: {
        totalRequests,
        averageResponseTime: serviceCount > 0 ? totalResponseTime / serviceCount : 0,
        errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
        throughput: totalThroughput
      },
      resourceUtilization
    };
  }

  /**
   * Determine service status based on metrics
   */
  private determineServiceStatus(metrics: AIServiceMetrics): ServiceHealthStatus['status'] {
    const thresholds = this.DEFAULT_THRESHOLDS;

    if (metrics.uptimePercentage < thresholds.uptimeMinimum) {
      return 'down';
    }

    if (metrics.errorRate >= thresholds.errorRateCritical ||
        metrics.averageResponseTime >= thresholds.responseTimeCritical ||
        metrics.averageConfidence < thresholds.confidenceMinimum) {
      return 'critical';
    }

    if (metrics.errorRate >= thresholds.errorRateWarning ||
        metrics.averageResponseTime >= thresholds.responseTimeWarning ||
        metrics.throughputPerMinute < thresholds.throughputMinimum) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Determine overall system health
   */
  private determineOverallHealth(services: Record<string, ServiceHealthStatus>): SystemHealthMetrics['overallHealth'] {
    const statuses = Object.values(services).map(s => s.status);
    
    if (statuses.includes('critical') || statuses.includes('down')) {
      return 'critical';
    }
    
    if (statuses.includes('degraded')) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Get service-specific issues
   */
  private getServiceIssues(serviceName: string, metrics: AIServiceMetrics): string[] {
    const issues: string[] = [];
    const thresholds = this.DEFAULT_THRESHOLDS;

    if (metrics.errorRate >= thresholds.errorRateWarning) {
      issues.push(`High error rate: ${metrics.errorRate.toFixed(2)}%`);
    }

    if (metrics.averageResponseTime >= thresholds.responseTimeWarning) {
      issues.push(`Slow response time: ${metrics.averageResponseTime.toFixed(0)}ms`);
    }

    if (metrics.throughputPerMinute < thresholds.throughputMinimum) {
      issues.push(`Low throughput: ${metrics.throughputPerMinute.toFixed(0)} req/min`);
    }

    if (metrics.averageConfidence < thresholds.confidenceMinimum) {
      issues.push(`Low AI confidence: ${(metrics.averageConfidence * 100).toFixed(1)}%`);
    }

    return issues;
  }

  /**
   * Check service health and generate alerts
   */
  private checkServiceHealth(serviceName: string, metrics: AIServiceMetrics): void {
    const status = this.determineServiceStatus(metrics);
    const issues = this.getServiceIssues(serviceName, metrics);

    if (status !== 'healthy' && issues.length > 0) {
      this.createAlert(serviceName, status, issues.join(', '), metrics);
    }
  }

  /**
   * Create an alert
   */
  private createAlert(serviceName: string, severity: string, message: string, metadata?: any): void {
    const alertId = `${serviceName}_${Date.now()}`;
    const alert: Alert = {
      id: alertId,
      severity: severity as Alert['severity'],
      service: serviceName,
      message,
      timestamp: new Date(),
      resolved: false,
      metadata
    };

    this.alerts.set(alertId, alert);
    
    this.emit('alert_created', alert);
    console.warn(`Alert created for ${serviceName}: ${message}`);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.emit('alert_resolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Get historical metrics for a service
   */
  async getHistoricalMetrics(
    serviceName: string,
    startDate: Date,
    endDate: Date,
    interval: '1h' | '1d' | '1w' = '1h'
  ): Promise<MetricDataPoint[]> {
    try {
      const key = `historical:${serviceName}:${interval}`;
      const start = startDate.getTime();
      const end = endDate.getTime();
      
      const data = await this.redis.zrangebyscore(key, start, end, 'WITHSCORES');
      
      const points: MetricDataPoint[] = [];
      for (let i = 0; i < data.length; i += 2) {
        const value = JSON.parse(data[i]);
        const timestamp = new Date(parseInt(data[i + 1]));
        points.push({ timestamp, value, metadata: value.metadata });
      }
      
      return points;
    } catch (error) {
      console.error('Failed to get historical metrics:', error);
      return [];
    }
  }

  /**
   * Collect system-wide metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      // Update throughput for all services
      for (const [serviceName, metrics] of this.metricsCache) {
        // Calculate requests per minute based on recent activity
        const recentRequests = await this.getRecentRequestCount(serviceName, 60000); // Last minute
        metrics.throughputPerMinute = recentRequests;
        
        // Update daily/monthly counters
        const today = new Date().toISOString().split('T')[0];
        const dailyCount = await this.getDailyRequestCount(serviceName, today);
        metrics.dailyAnalyses = dailyCount;
        
        // Update unique users (simplified - would use more sophisticated tracking)
        const uniqueUsers = await this.getUniqueUserCount(serviceName, today);
        metrics.uniqueUsers = uniqueUsers;
      }
    } catch (error) {
      console.error('Failed to collect system metrics:', error);
    }
  }

  /**
   * Get recent request count for throughput calculation
   */
  private async getRecentRequestCount(serviceName: string, timeWindow: number): Promise<number> {
    try {
      const key = `realtime:${serviceName}`;
      const requests = await this.redis.lrange(key, 0, -1);
      const cutoff = Date.now() - timeWindow;
      
      return requests.filter(req => {
        const data = JSON.parse(req);
        return new Date(data.timestamp).getTime() > cutoff;
      }).length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get daily request count
   */
  private async getDailyRequestCount(serviceName: string, date: string): Promise<number> {
    try {
      const key = `requests:${serviceName}:${date}`;
      return await this.redis.llen(key);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get unique user count (simplified implementation)
   */
  private async getUniqueUserCount(serviceName: string, date: string): Promise<number> {
    try {
      const key = `users:${serviceName}:${date}`;
      return await this.redis.scard(key);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Aggregate and store metrics for historical analysis
   */
  private async aggregateAndStoreMetrics(): Promise<void> {
    try {
      const now = Date.now();
      
      for (const [serviceName, metrics] of this.metricsCache) {
        // Store hourly aggregates
        const hourlyKey = `historical:${serviceName}:1h`;
        const hourlyData = {
          totalRequests: metrics.totalRequests,
          averageResponseTime: metrics.averageResponseTime,
          errorRate: metrics.errorRate,
          throughput: metrics.throughputPerMinute,
          confidence: metrics.averageConfidence,
          qualityScore: metrics.averageQualityScore
        };
        
        await this.redis.zadd(hourlyKey, now, JSON.stringify(hourlyData));
        await this.redis.expire(hourlyKey, 86400 * 30); // Keep for 30 days
      }
    } catch (error) {
      console.error('Failed to aggregate metrics:', error);
    }
  }

  /**
   * Check health and alerts across all services
   */
  private async checkHealthAndAlerts(): Promise<void> {
    for (const [serviceName, metrics] of this.metricsCache) {
      this.checkServiceHealth(serviceName, metrics);
    }
  }

  /**
   * Get resource utilization (mock implementation)
   */
  private async getResourceUtilization(): Promise<SystemHealthMetrics['resourceUtilization']> {
    // In a real implementation, this would integrate with system monitoring tools
    return {
      cpu: 65 + Math.random() * 20,
      memory: 70 + Math.random() * 15,
      disk: 45 + Math.random() * 10,
      network: 30 + Math.random() * 20
    };
  }

  /**
   * Export metrics data for external monitoring systems
   */
  async exportMetrics(format: 'prometheus' | 'json' | 'csv' = 'json'): Promise<string> {
    const metrics = this.getAllServiceMetrics();
    
    switch (format) {
      case 'prometheus':
        return this.exportPrometheusMetrics(metrics);
      case 'csv':
        return this.exportCSVMetrics(metrics);
      default:
        return JSON.stringify(metrics, null, 2);
    }
  }

  /**
   * Export metrics in Prometheus format
   */
  private exportPrometheusMetrics(metrics: Record<string, AIServiceMetrics>): string {
    let output = '';
    
    for (const [serviceName, serviceMetrics] of Object.entries(metrics)) {
      output += `# HELP ai_service_requests_total Total number of requests\n`;
      output += `# TYPE ai_service_requests_total counter\n`;
      output += `ai_service_requests_total{service="${serviceName}"} ${serviceMetrics.totalRequests}\n\n`;
      
      output += `# HELP ai_service_response_time_seconds Average response time in seconds\n`;
      output += `# TYPE ai_service_response_time_seconds gauge\n`;
      output += `ai_service_response_time_seconds{service="${serviceName}"} ${serviceMetrics.averageResponseTime / 1000}\n\n`;
      
      output += `# HELP ai_service_error_rate Error rate percentage\n`;
      output += `# TYPE ai_service_error_rate gauge\n`;
      output += `ai_service_error_rate{service="${serviceName}"} ${serviceMetrics.errorRate}\n\n`;
      
      output += `# HELP ai_service_confidence Average AI confidence\n`;
      output += `# TYPE ai_service_confidence gauge\n`;
      output += `ai_service_confidence{service="${serviceName}"} ${serviceMetrics.averageConfidence}\n\n`;
    }
    
    return output;
  }

  /**
   * Export metrics in CSV format
   */
  private exportCSVMetrics(metrics: Record<string, AIServiceMetrics>): string {
    const headers = [
      'service_name', 'total_requests', 'successful_requests', 'failed_requests',
      'average_response_time', 'error_rate', 'throughput_per_minute',
      'average_confidence', 'average_quality_score', 'uptime_percentage'
    ];
    
    let csv = headers.join(',') + '\n';
    
    for (const [serviceName, serviceMetrics] of Object.entries(metrics)) {
      const row = [
        serviceName,
        serviceMetrics.totalRequests,
        serviceMetrics.successfulRequests,
        serviceMetrics.failedRequests,
        serviceMetrics.averageResponseTime.toFixed(2),
        serviceMetrics.errorRate.toFixed(2),
        serviceMetrics.throughputPerMinute.toFixed(2),
        serviceMetrics.averageConfidence.toFixed(3),
        serviceMetrics.averageQualityScore.toFixed(2),
        serviceMetrics.uptimePercentage.toFixed(2)
      ];
      csv += row.join(',') + '\n';
    }
    
    return csv;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.isCollecting = false;
    this.removeAllListeners();
    console.log('Metrics service destroyed');
  }
}

// Singleton instance
export const metricsService = new MetricsService();

// Fastify plugin for automatic metrics collection
export default async function metricsPlugin(app: any) {
  // Add metrics service to Fastify instance
  app.decorate('metrics', metricsService);

  // Add request timing hook
  app.addHook('onRequest', async (request: FastifyRequest) => {
    (request as any).startTime = Date.now();
  });

  // Add response tracking hook
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const responseTime = Date.now() - (request as any).startTime;
    const success = reply.statusCode < 400;
    const routeName = request.routerPath || 'unknown';
    
    // Record API endpoint metrics
    await metricsService.recordAIRequest(
      `api_${routeName.replace(/[^a-zA-Z0-9]/g, '_')}`,
      responseTime,
      success,
      undefined,
      undefined,
      (request as any).user?.id,
      {
        method: request.method,
        statusCode: reply.statusCode,
        userAgent: request.headers['user-agent']
      }
    );
  });

  // Metrics endpoint
  app.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const format = (request.query as any)?.format || 'json';
    const metrics = await metricsService.exportMetrics(format);
    
    if (format === 'prometheus') {
      reply.type('text/plain');
    } else if (format === 'csv') {
      reply.type('text/csv');
    } else {
      reply.type('application/json');
    }
    
    return metrics;
  });

  // Health metrics endpoint
  app.get('/health/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const health = await metricsService.getSystemHealth();
    return reply.send(health);
  });

  // Service-specific metrics endpoint
  app.get('/metrics/:serviceName', async (request: FastifyRequest, reply: FastifyReply) => {
    const { serviceName } = request.params as { serviceName: string };
    const metrics = metricsService.getServiceMetrics(serviceName);
    
    if (!metrics) {
      return reply.code(404).send({ error: 'Service not found' });
    }
    
    return reply.send(metrics);
  });

  // Historical metrics endpoint
  app.get('/metrics/:serviceName/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const { serviceName } = request.params as { serviceName: string };
    const query = request.query as any;
    
    const startDate = new Date(query.start || Date.now() - 24 * 60 * 60 * 1000);
    const endDate = new Date(query.end || Date.now());
    const interval = query.interval || '1h';
    
    const history = await metricsService.getHistoricalMetrics(serviceName, startDate, endDate, interval);
    return reply.send(history);
  });
}