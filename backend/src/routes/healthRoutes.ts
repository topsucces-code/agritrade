import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { healthCheckService } from '../services/healthCheckService';
import { metricsService } from '../services/metricsService';
import { getCircuitBreakerHealthCheck } from '../middleware/circuitBreaker';

// Request interfaces
interface ComponentHealthRequest extends FastifyRequest {
  Params: {
    component: string;
  };
}

interface MetricsRequest extends FastifyRequest {
  Querystring: {
    start?: string;
    end?: string;
    interval?: string;
    metric?: string;
  };
}

/**
 * Health Check and Monitoring Routes
 * Provides endpoints for system health monitoring and metrics
 */
const healthRoutes: FastifyPluginAsync = async (fastify) => {
  
  /**
   * @route GET /health
   * @desc Get basic health check
   * @access Public
   */
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const healthCheck = await healthCheckService.getBasicHealthCheck();
      
      const statusCode = healthCheck.status === 'healthy' ? 200 : 
                        healthCheck.status === 'degraded' ? 200 : 503;
      
      reply.code(statusCode).send({
        success: true,
        data: healthCheck
      });
    } catch (error) {
      reply.code(503).send({
        success: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Health check failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });

  /**
   * @route GET /health/full
   * @desc Get comprehensive health check
   * @access Public
   */
  fastify.get('/health/full', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const healthCheck = await healthCheckService.getFullHealthCheck();
      
      const statusCode = healthCheck.status === 'healthy' ? 200 : 
                        healthCheck.status === 'degraded' ? 200 : 503;
      
      reply.code(statusCode).send({
        success: true,
        data: healthCheck
      });
    } catch (error) {
      reply.code(503).send({
        success: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Comprehensive health check failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });

  /**
   * @route GET /health/component/:component
   * @desc Get health check for specific component
   * @access Public
   */
  fastify.get<ComponentHealthRequest>('/health/component/:component', async (request, reply) => {
    try {
      const { component } = request.params;
      const componentHealth = await healthCheckService.checkComponentHealth(component);
      
      const statusCode = componentHealth.status === 'healthy' ? 200 : 503;
      
      reply.code(statusCode).send({
        success: true,
        data: componentHealth
      });
    } catch (error) {
      reply.code(400).send({
        success: false,
        error: {
          code: 'INVALID_COMPONENT',
          message: 'Invalid component specified',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });

  /**
   * @route GET /health/ready
   * @desc Readiness probe for Kubernetes
   * @access Public
   */
  fastify.get('/health/ready', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const readiness = await healthCheckService.getReadinessProbe();
      
      const statusCode = readiness.status === 'ready' ? 200 : 503;
      
      reply.code(statusCode).send(readiness);
    } catch (error) {
      reply.code(503).send({
        status: 'not-ready',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * @route GET /health/live
   * @desc Liveness probe for Kubernetes
   * @access Public
   */
  fastify.get('/health/live', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const liveness = await healthCheckService.getLivenessProbe();
      
      const statusCode = liveness.status === 'alive' ? 200 : 503;
      
      reply.code(statusCode).send(liveness);
    } catch (error) {
      reply.code(503).send({
        status: 'dead',
        timestamp: new Date().toISOString(),
        uptime: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * @route GET /metrics
   * @desc Get current metrics
   * @access Public
   */
  fastify.get<MetricsRequest>('/metrics', async (request, reply) => {
    try {
      const currentMetrics = await metricsService.getCurrentMetrics();
      const healthMetrics = await metricsService.getHealthMetrics();
      
      reply.send({
        success: true,
        data: {
          current: currentMetrics,
          health: healthMetrics,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: {
          code: 'METRICS_FETCH_FAILED',
          message: 'Failed to fetch metrics',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });

  /**
   * @route GET /metrics/timeseries
   * @desc Get time series data for a metric
   * @access Public
   */
  fastify.get<MetricsRequest>('/metrics/timeseries', async (request, reply) => {
    try {
      const { start, end, interval = '60000', metric } = request.query;
      
      if (!metric) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'MISSING_METRIC',
            message: 'Metric name is required'
          }
        });
      }
      
      const startTime = start ? new Date(start) : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: 24 hours ago
      const endTime = end ? new Date(end) : new Date();
      const intervalMs = parseInt(interval);
      
      const timeSeriesData = await metricsService.getTimeSeriesData(metric, startTime, endTime, intervalMs);
      
      reply.send({
        success: true,
        data: {
          metric,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          interval: intervalMs,
          data: timeSeriesData
        }
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: {
          code: 'TIMESERIES_FETCH_FAILED',
          message: 'Failed to fetch time series data',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });

  /**
   * @route GET /metrics/aggregated
   * @desc Get aggregated metrics for a time period
   * @access Public
   */
  fastify.get<MetricsRequest>('/metrics/aggregated', async (request, reply) => {
    try {
      const { start, end } = request.query;
      
      const startTime = start ? new Date(start) : new Date(Date.now() - 60 * 60 * 1000); // Default: 1 hour ago
      const endTime = end ? new Date(end) : new Date();
      
      const aggregatedMetrics = await metricsService.getAggregatedMetrics(startTime, endTime);
      
      reply.send({
        success: true,
        data: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          metrics: aggregatedMetrics
        }
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: {
          code: 'AGGREGATED_METRICS_FAILED',
          message: 'Failed to fetch aggregated metrics',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });

  /**
   * @route GET /circuit-breakers
   * @desc Get circuit breaker status
   * @access Public
   */
  fastify.get('/circuit-breakers', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const circuitBreakerHealth = await getCircuitBreakerHealthCheck();
      
      reply.send({
        success: true,
        data: circuitBreakerHealth
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: {
          code: 'CIRCUIT_BREAKER_STATUS_FAILED',
          message: 'Failed to get circuit breaker status',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });

  /**
   * @route GET /info
   * @desc Get system information
   * @access Public
   */
  fastify.get('/info', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const info = {
        name: 'AgriTrade API',
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        uptime: process.uptime(),
        startTime: process.env.START_TIME || new Date().toISOString(),
        pid: process.pid,
        memory: process.memoryUsage(),
        features: {
          qualityAnalysis: true,
          dynamicPricing: true,
          intelligentMatching: true,
          smsNotifications: true,
          whatsappIntegration: true,
          weatherIntegration: true,
          geospatialSearch: true,
          circuitBreakers: true,
          healthChecks: true,
          metrics: true
        }
      };
      
      reply.send({
        success: true,
        data: info
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: {
          code: 'INFO_FETCH_FAILED',
          message: 'Failed to fetch system information',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });

  /**
   * @route POST /metrics/record
   * @desc Record a custom metric (for debugging/testing)
   * @access Public (should be restricted in production)
   */
  fastify.post('/metrics/record', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { type, name, value, unit, tags } = request.body as any;
      
      if (!type || !name || value === undefined) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_METRIC_DATA',
            message: 'type, name, and value are required'
          }
        });
      }
      
      switch (type) {
        case 'counter':
          await metricsService.counter(name, value, tags);
          break;
        case 'gauge':
          await metricsService.gauge(name, value, unit, tags);
          break;
        case 'histogram':
          await metricsService.histogram(name, value, unit, undefined, tags);
          break;
        case 'timing':
          await metricsService.timing(name, value, tags);
          break;
        default:
          return reply.code(400).send({
            success: false,
            error: {
              code: 'INVALID_METRIC_TYPE',
              message: 'type must be one of: counter, gauge, histogram, timing'
            }
          });
      }
      
      reply.send({
        success: true,
        message: 'Metric recorded successfully'
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: {
          code: 'METRIC_RECORD_FAILED',
          message: 'Failed to record metric',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });

  /**
   * @route GET /status
   * @desc Simple status endpoint
   * @access Public
   */
  fastify.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'AgriTrade API'
    });
  });
};

export default healthRoutes;