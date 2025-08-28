import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MarketDataService } from '../services/marketDataService';
import { WeatherService } from '../services/weatherService';
import { AppError, ValidationError } from '../middleware/errorHandler';
import { getCurrentUser } from '../middleware/authentication';
import { cache } from '../config/redis';

const marketDataService = new MarketDataService();
const weatherService = new WeatherService();

export default async function marketRoutes(app: FastifyInstance) {

  // Get current market prices
  app.get('/prices', {
    schema: {
      description: 'Get current market prices for commodities',
      tags: ['Market Data'],
      querystring: {
        type: 'object',
        properties: {
          commodity: { 
            type: 'string', 
            enum: ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'] 
          },
          country: { type: 'string' },
          region: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              oneOf: [
                { type: 'object' }, // Single commodity price
                { type: 'array' }   // Multiple commodity prices
              ]
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { commodity, country, region } = request.query as any;

      if (commodity) {
        // Get price for specific commodity
        const price = await marketDataService.getCurrentPrice(commodity, country, region);
        
        return reply.send({
          success: true,
          data: price
        });
      } else {
        // Get prices for all commodities
        const commodities = ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'];
        const pricePromises = commodities.map(c => 
          marketDataService.getCurrentPrice(c, country, region)
        );
        
        const prices = await Promise.all(pricePromises);
        
        return reply.send({
          success: true,
          data: prices
        });
      }

    } catch (error) {
      throw error;
    }
  });

  // Get historical price data
  app.get('/prices/history', {
    schema: {
      description: 'Get historical price data for trend analysis',
      tags: ['Market Data'],
      querystring: {
        type: 'object',
        required: ['commodity'],
        properties: {
          commodity: { 
            type: 'string', 
            enum: ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'] 
          },
          days: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
          country: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { commodity, days = 30, country } = request.query as any;

      const historicalData = await marketDataService.getHistoricalPrices(
        commodity,
        days,
        country
      );

      return reply.send({
        success: true,
        data: historicalData
      });

    } catch (error) {
      throw error;
    }
  });

  // Get market trends and forecasts
  app.get('/trends', {
    schema: {
      description: 'Get market trends and price forecasts',
      tags: ['Market Data'],
      querystring: {
        type: 'object',
        required: ['commodity'],
        properties: {
          commodity: { 
            type: 'string', 
            enum: ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'] 
          },
          period: { 
            type: 'string', 
            enum: ['week', 'month', 'quarter', 'year'], 
            default: 'month' 
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { commodity, period = 'month' } = request.query as any;

      const trends = await marketDataService.getMarketTrends(commodity, period);

      return reply.send({
        success: true,
        data: trends
      });

    } catch (error) {
      throw error;
    }
  });

  // Get price comparison across markets/regions
  app.get('/prices/compare', {
    schema: {
      description: 'Compare prices across different markets or regions',
      tags: ['Market Data'],
      querystring: {
        type: 'object',
        required: ['commodity', 'countries'],
        properties: {
          commodity: { 
            type: 'string', 
            enum: ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'] 
          },
          countries: { type: 'string' } // Comma-separated list
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { commodity, countries } = request.query as any;

      if (!countries) {
        throw new ValidationError('Countries parameter is required');
      }

      const countryList = countries.split(',').map((c: string) => c.trim());
      
      if (countryList.length > 10) {
        throw new ValidationError('Maximum 10 countries allowed for comparison');
      }

      const comparison = await marketDataService.getPriceComparison(commodity, countryList);

      return reply.send({
        success: true,
        data: comparison
      });

    } catch (error) {
      throw error;
    }
  });

  // Get regional market insights
  app.get('/insights', {
    schema: {
      description: 'Get market insights and recommendations for a region',
      tags: ['Market Data'],
      querystring: {
        type: 'object',
        required: ['region'],
        properties: {
          region: { type: 'string' },
          commodities: { type: 'string' } // Comma-separated list, optional
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { region, commodities } = request.query as any;

      const commodityList = commodities 
        ? commodities.split(',').map((c: string) => c.trim())
        : ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'];

      const insights = await marketDataService.getRegionalInsights(region, commodityList);

      return reply.send({
        success: true,
        data: insights
      });

    } catch (error) {
      throw error;
    }
  });

  // Get seasonal market calendar
  app.get('/calendar', {
    schema: {
      description: 'Get seasonal market patterns and calendar',
      tags: ['Market Data'],
      querystring: {
        type: 'object',
        required: ['commodity'],
        properties: {
          commodity: { 
            type: 'string', 
            enum: ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'] 
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { commodity } = request.query as any;

      const calendar = await marketDataService.getMarketCalendar(commodity);

      return reply.send({
        success: true,
        data: calendar
      });

    } catch (error) {
      throw error;
    }
  });

  // Create price alert (requires authentication)
  app.post('/alerts', {
    schema: {
      description: 'Create a price alert for a commodity',
      tags: ['Market Data'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['commodity', 'targetPrice', 'alertType'],
        properties: {
          commodity: { 
            type: 'string', 
            enum: ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'] 
          },
          targetPrice: { type: 'number', minimum: 0.01 },
          alertType: { type: 'string', enum: ['above', 'below'] }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { commodity, targetPrice, alertType } = request.body as any;

      if (!user) {
        throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
      }

      await marketDataService.createPriceAlert(
        user._id,
        commodity,
        targetPrice,
        alertType
      );

      return reply.code(201).send({
        success: true,
        message: 'Price alert created successfully',
        data: {
          commodity,
          targetPrice,
          alertType
        }
      });

    } catch (error) {
      throw error;
    }
  });

  // Get user's price alerts (requires authentication)
  app.get('/alerts', {
    schema: {
      description: 'Get user\'s active price alerts',
      tags: ['Market Data'],
      security: [{ Bearer: [] }]
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);

      if (!user) {
        throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
      }

      const alerts = await marketDataService.checkPriceAlerts(user._id);

      return reply.send({
        success: true,
        data: alerts
      });

    } catch (error) {
      throw error;
    }
  });

  // Get integrated market and weather data
  app.get('/market-weather', {
    schema: {
      description: 'Get combined market prices and weather data for informed decision making',
      tags: ['Market Data'],
      querystring: {
        type: 'object',
        required: ['commodity', 'latitude', 'longitude'],
        properties: {
          commodity: { 
            type: 'string', 
            enum: ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'] 
          },
          latitude: { type: 'number', minimum: -90, maximum: 90 },
          longitude: { type: 'number', minimum: -180, maximum: 180 },
          country: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { commodity, latitude, longitude, country } = request.query as any;

      const location = {
        country: country || 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        coordinates: { latitude, longitude }
      };

      // Fetch market and weather data in parallel
      const [marketPrice, currentWeather, weatherForecast, marketTrends, cropRecommendations] = await Promise.all([
        marketDataService.getCurrentPrice(commodity, country),
        weatherService.getCurrentWeather(location),
        weatherService.getWeatherForecast(location),
        marketDataService.getMarketTrends(commodity),
        weatherService.getCropWeatherRecommendations(location, commodity)
      ]);

      // Generate integrated recommendations
      const integratedRecommendations = [
        ...cropRecommendations,
        `Current ${commodity} price: ${marketPrice.price} ${marketPrice.currency}/${marketPrice.unit} (${marketTrends.trend})`,
        marketTrends.trend === 'up' ? 'Favorable market conditions for selling' : 
        marketTrends.trend === 'down' ? 'Consider storage or value addition' : 
        'Stable market conditions'
      ];

      return reply.send({
        success: true,
        data: {
          market: {
            price: marketPrice,
            trends: marketTrends
          },
          weather: {
            current: currentWeather,
            forecast: weatherForecast.slice(0, 3) // Next 3 days
          },
          recommendations: integratedRecommendations,
          lastUpdated: new Date()
        }
      });

    } catch (error) {
      throw error;
    }
  });

  // Get market dashboard data
  app.get('/dashboard', {
    schema: {
      description: 'Get comprehensive market dashboard data',
      tags: ['Market Data'],
      querystring: {
        type: 'object',
        properties: {
          country: { type: 'string' },
          userType: { type: 'string', enum: ['farmer', 'buyer'] }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { country, userType } = request.query as any;

      const cacheKey = `market:dashboard:${country || 'global'}:${userType || 'general'}`;
      
      // Check cache first (cache for 30 minutes)
      const cachedDashboard = await cache.getJSON<any>(cacheKey);
      if (cachedDashboard) {
        return reply.send({
          success: true,
          data: cachedDashboard
        });
      }

      // Get current prices for all commodities
      const commodities = ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'];
      const pricePromises = commodities.map(commodity => 
        marketDataService.getCurrentPrice(commodity, country)
      );
      
      const prices = await Promise.all(pricePromises);

      // Get trends for top commodities
      const trendPromises = commodities.slice(0, 3).map(commodity =>
        marketDataService.getMarketTrends(commodity)
      );
      
      const trends = await Promise.all(trendPromises);

      // Generate market summary
      const avgChange = prices.reduce((sum, price) => sum + price.changePercent, 0) / prices.length;
      const marketSentiment = avgChange > 2 ? 'bullish' : avgChange < -2 ? 'bearish' : 'neutral';

      const dashboard = {
        marketSummary: {
          sentiment: marketSentiment,
          averageChange: Math.round(avgChange * 100) / 100,
          topPerformers: prices
            .sort((a, b) => b.changePercent - a.changePercent)
            .slice(0, 3)
            .map(p => ({ commodity: p.commodity, change: p.changePercent })),
          lastUpdated: new Date()
        },
        prices: prices.map(price => ({
          commodity: price.commodity,
          price: price.price,
          currency: price.currency,
          trend: price.trend,
          changePercent: price.changePercent
        })),
        trends: trends,
        recommendations: userType === 'farmer' 
          ? [
              'Monitor weather forecasts for harvest timing',
              'Consider forward contracts for price stability',
              'Focus on quality improvement for premium prices'
            ]
          : [
              'Diversify supplier base across regions',
              'Monitor seasonal patterns for buying opportunities',
              'Build relationships with quality-focused farmers'
            ]
      };

      // Cache the result
      await cache.setJSON(cacheKey, dashboard, 1800); // 30 minutes

      return reply.send({
        success: true,
        data: dashboard
      });

    } catch (error) {
      throw error;
    }
  });

  // Get market news and updates (placeholder)
  app.get('/news', {
    schema: {
      description: 'Get market news and updates',
      tags: ['Market Data'],
      querystring: {
        type: 'object',
        properties: {
          commodity: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { commodity, limit = 10 } = request.query as any;

      // Placeholder news data
      const news = [
        {
          id: '1',
          title: 'Global Cocoa Prices Rise Amid Supply Concerns',
          summary: 'Cocoa futures hit multi-month highs as weather conditions in West Africa raise supply concerns.',
          date: new Date(),
          category: 'market',
          commodity: 'cocoa',
          impact: 'positive'
        },
        {
          id: '2',
          title: 'Coffee Harvest Season Begins in East Africa',
          summary: 'Farmers in Kenya and Ethiopia begin coffee harvest with optimistic yield expectations.',
          date: new Date(Date.now() - 86400000), // Yesterday
          category: 'production',
          commodity: 'coffee',
          impact: 'neutral'
        }
      ];

      const filteredNews = commodity 
        ? news.filter(item => item.commodity === commodity)
        : news;

      return reply.send({
        success: true,
        data: filteredNews.slice(0, limit)
      });

    } catch (error) {
      throw error;
    }
  });
}