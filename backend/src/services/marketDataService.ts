import axios from 'axios';
import { cache } from '../config/redis';
import { MarketConditions } from './PricingEngine';
import { IMarketPrice, IWeatherData } from '../types';

/**
 * Market Data Service - Aggregates market intelligence from multiple sources
 */
export class MarketDataService {
  private cachePrefix = 'market_data:';
  private weatherApiKey: string;
  private exchangeApiKey: string;

  constructor() {
    this.weatherApiKey = process.env.OPENWEATHER_API_KEY || '';
    this.exchangeApiKey = process.env.EXCHANGE_API_KEY || '';
  }

  /**
   * Get comprehensive market conditions for a commodity and region
   */
  async getMarketConditions(
    commodity: string, 
    country: string, 
    region: string
  ): Promise<MarketConditions> {
    const cacheKey = `${this.cachePrefix}conditions:${commodity}:${country}:${region}`;
    const cached = await cache.getJSON(cacheKey);
    
    if (cached) {
      return cached as MarketConditions;
    }

    try {
      // Fetch data from multiple sources in parallel
      const [
        supplyDemandData,
        globalPriceData,
        localMarketData,
        seasonalData,
        weatherData
      ] = await Promise.allSettled([
        this.getSupplyDemandAnalysis(commodity, country),
        this.getGlobalPriceData(commodity),
        this.getLocalMarketData(commodity, country, region),
        this.getSeasonalFactors(commodity),
        this.getWeatherImpact(country, region)
      ]);

      // Combine all data into market conditions
      const marketConditions: MarketConditions = {
        commodity,
        region,
        country,
        supplyLevel: this.extractValue(supplyDemandData, 'supply', 'medium'),
        demandLevel: this.extractValue(supplyDemandData, 'demand', 'medium'),
        seasonalFactor: this.extractValue(seasonalData, 'factor', 1.0),
        weatherImpact: this.extractValue(weatherData, 'impact', 0),
        globalPrices: this.extractValue(globalPriceData, 'prices', {
          current: 1000,
          trend: 'stable',
          volatility: 0.1
        }),
        localMarketData: this.extractValue(localMarketData, 'data', {
          averagePrice: 1000,
          priceRange: { min: 900, max: 1100 },
          tradingVolume: 500
        })
      };

      // Cache for 2 hours
      await cache.setJSON(cacheKey, marketConditions, 7200);
      
      return marketConditions;
      
    } catch (error) {
      throw new Error(`Failed to get market conditions: ${error.message}`);
    }
  }

  /**
   * Analyze supply and demand levels
   */
  private async getSupplyDemandAnalysis(commodity: string, country: string) {
    try {
      // This would integrate with FAO GIEWS, agricultural statistics APIs
      // Simplified implementation using historical patterns and indicators
      
      const currentMonth = new Date().getMonth();
      const harvestMonths = this.getHarvestMonths(commodity, country);
      
      // Supply analysis based on harvest timing
      let supplyLevel: 'low' | 'medium' | 'high' = 'medium';
      if (harvestMonths.includes(currentMonth) || harvestMonths.includes(currentMonth - 1)) {
        supplyLevel = 'high'; // Fresh harvest period
      } else if (this.isPreHarvestPeriod(currentMonth, harvestMonths)) {
        supplyLevel = 'low'; // Before new harvest
      }

      // Demand analysis based on global consumption patterns
      const demandLevel = await this.analyzeDemandLevel(commodity, country);
      
      return { supply: supplyLevel, demand: demandLevel };
      
    } catch (error) {
      return { supply: 'medium', demand: 'medium' };
    }
  }

  /**
   * Get global price data and trends
   */
  private async getGlobalPriceData(commodity: string) {
    try {
      // Integrate with commodity exchanges (ICE, CBOT, etc.)
      const response = await axios.get(`https://api.exchangerates.host/commodities`, {
        timeout: 10000
      });

      // Simplified price data - would use actual commodity exchange APIs
      const priceData = {
        current: this.getSimulatedPrice(commodity),
        trend: this.analyzeGlobalTrend(commodity),
        volatility: Math.random() * 0.3 + 0.1 // 0.1-0.4
      };

      return { prices: priceData };
      
    } catch (error) {
      return {
        prices: {
          current: this.getDefaultPrice(commodity),
          trend: 'stable' as const,
          volatility: 0.15
        }
      };
    }
  }

  /**
   * Get local market data
   */
  private async getLocalMarketData(commodity: string, country: string, region: string) {
    try {
      // This would integrate with local market APIs, agricultural marketing boards
      // For now, simulate based on country and regional factors
      
      const basePrice = this.getDefaultPrice(commodity);
      const regionalMultiplier = this.getRegionalMultiplier(country, region);
      
      const averagePrice = basePrice * regionalMultiplier;
      const priceVariation = averagePrice * 0.15; // ±15% variation
      
      return {
        data: {
          averagePrice,
          priceRange: {
            min: averagePrice - priceVariation,
            max: averagePrice + priceVariation
          },
          tradingVolume: Math.floor(Math.random() * 2000) + 500 // 500-2500 MT
        }
      };
      
    } catch (error) {
      return {
        data: {
          averagePrice: this.getDefaultPrice(commodity),
          priceRange: { min: 900, max: 1100 },
          tradingVolume: 1000
        }
      };
    }
  }

  /**
   * Calculate seasonal factors
   */
  private async getSeasonalFactors(commodity: string) {
    const currentMonth = new Date().getMonth();
    
    // Seasonal price patterns by commodity (simplified)
    const seasonalPatterns = {
      cocoa: [1.1, 1.05, 1.0, 0.95, 0.9, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15],
      coffee: [1.2, 1.15, 1.1, 1.05, 1.0, 0.95, 0.9, 0.85, 0.9, 0.95, 1.05, 1.15],
      cotton: [1.0, 1.0, 1.05, 1.1, 1.15, 1.2, 1.15, 1.1, 1.05, 1.0, 0.95, 0.95],
      maize: [0.9, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15, 1.2, 1.15, 1.05, 0.95, 0.9],
      rice: [1.0, 1.0, 1.0, 1.05, 1.1, 1.15, 1.1, 1.05, 1.0, 0.95, 0.95, 1.0]
    };

    const pattern = seasonalPatterns[commodity] || Array(12).fill(1.0);
    return { factor: pattern[currentMonth] };
  }

  /**
   * Analyze weather impact on prices
   */
  private async getWeatherImpact(country: string, region: string) {
    try {
      if (!this.weatherApiKey) {
        return { impact: 0 };
      }

      // Get recent weather data
      const weatherData = await this.getWeatherData(country, region);
      
      // Analyze weather impact on agriculture
      let impact = 0;
      
      // Drought conditions
      if (weatherData.rainfall < 50) { // mm in last month
        impact += 0.15; // Price increase due to drought
      }
      
      // Excessive rainfall
      if (weatherData.rainfall > 300) {
        impact += 0.1; // Price increase due to flooding/harvest issues
      }
      
      // Temperature extremes
      if (weatherData.temperature > 35 || weatherData.temperature < 15) {
        impact += 0.05;
      }
      
      return { impact: Math.min(0.5, impact) };
      
    } catch (error) {
      return { impact: 0 };
    }
  }

  /**
   * Get weather data for impact analysis
   */
  private async getWeatherData(country: string, region: string): Promise<IWeatherData> {
    const coordinates = this.getRegionCoordinates(country, region);
    
    try {
      const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
        params: {
          lat: coordinates.lat,
          lon: coordinates.lon,
          appid: this.weatherApiKey,
          units: 'metric'
        },
        timeout: 5000
      });

      return {
        temperature: response.data.main.temp,
        humidity: response.data.main.humidity,
        rainfall: response.data.rain?.['1h'] || 0,
        windSpeed: response.data.wind.speed,
        pressure: response.data.main.pressure,
        uvIndex: 0, // Would need additional API call
        date: new Date(),
        location: {
          country,
          region,
          city: response.data.name,
          coordinates: {
            latitude: coordinates.lat,
            longitude: coordinates.lon
          }
        },
        source: 'openweather'
      };
      
    } catch (error) {
      // Return default weather data
      return {
        temperature: 28,
        humidity: 70,
        rainfall: 100,
        windSpeed: 5,
        pressure: 1013,
        uvIndex: 8,
        date: new Date(),
        location: {
          country,
          region,
          city: 'Unknown',
          coordinates: { latitude: 0, longitude: 0 }
        },
        source: 'local'
      };
    }
  }

  /**
   * Get historical market prices
   */
  async getHistoricalPrices(
    commodity: string,
    country: string,
    startDate: Date,
    endDate: Date
  ): Promise<IMarketPrice[]> {
    const cacheKey = `${this.cachePrefix}historical:${commodity}:${country}:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await cache.getJSON(cacheKey);
    
    if (cached) {
      return cached as IMarketPrice[];
    }

    // Generate simulated historical data (would be replaced with real data source)
    const prices = this.generateHistoricalPrices(commodity, startDate, endDate);
    
    // Cache for 24 hours
    await cache.setJSON(cacheKey, prices, 86400);
    
    return prices;
  }

  /**
   * Analyze demand level for commodity
   */
  private async analyzeDemandLevel(commodity: string, country: string): Promise<'low' | 'medium' | 'high'> {
    // Simplified demand analysis based on global consumption trends
    const globalDemandTrends = {
      cocoa: 'high',    // Growing chocolate consumption
      coffee: 'high',   // Steady global demand
      cotton: 'medium', // Stable textile demand
      maize: 'high',    // Food and feed demand
      rice: 'medium'    // Stable staple demand
    };

    return globalDemandTrends[commodity] as 'low' | 'medium' | 'high' || 'medium';
  }

  /**
   * Helper methods
   */
  private extractValue(result: PromiseSettledResult<any>, key: string, defaultValue: any): any {
    if (result.status === 'fulfilled' && result.value && result.value[key]) {
      return result.value[key];
    }
    return defaultValue;
  }

  private getHarvestMonths(commodity: string, country: string): number[] {
    const harvestCalendar = {
      'cocoa': {
        'Ghana': [9, 10, 11, 0, 1], // Oct-Feb
        'Côte d\'Ivoire': [9, 10, 11, 0, 1]
      },
      'coffee': {
        'Ghana': [10, 11, 0, 1], // Nov-Feb
        'Côte d\'Ivoire': [10, 11, 0]
      },
      'cotton': {
        'Ghana': [11, 0, 1], // Dec-Feb
        'Côte d\'Ivoire': [11, 0, 1]
      }
    };

    return harvestCalendar[commodity]?.[country] || [10, 11, 0];
  }

  private isPreHarvestPeriod(currentMonth: number, harvestMonths: number[]): boolean {
    const minHarvestMonth = Math.min(...harvestMonths);
    return currentMonth >= minHarvestMonth - 3 && currentMonth < minHarvestMonth;
  }

  private getSimulatedPrice(commodity: string): number {
    const basePrice = this.getDefaultPrice(commodity);
    const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
    return basePrice * (1 + variation);
  }

  private analyzeGlobalTrend(commodity: string): 'rising' | 'falling' | 'stable' {
    const trends = ['rising', 'falling', 'stable'];
    return trends[Math.floor(Math.random() * trends.length)] as any;
  }

  private getDefaultPrice(commodity: string): number {
    const defaults = {
      'cocoa': 2400,
      'coffee': 3200,
      'cotton': 1600,
      'maize': 280,
      'rice': 450
    };
    return defaults[commodity] || 1000;
  }

  private getRegionalMultiplier(country: string, region: string): number {
    const multipliers = {
      'Ghana': { 'Greater Accra': 1.05, 'Ashanti': 1.0, 'Western': 0.95 },
      'Côte d\'Ivoire': { 'Abidjan': 1.08, 'Yamoussoukro': 1.0, 'San-Pédro': 0.98 }
    };
    
    return multipliers[country]?.[region] || 1.0;
  }

  private getRegionCoordinates(country: string, region: string): { lat: number; lon: number } {
    const coordinates = {
      'Ghana': { lat: 7.9465, lon: -1.0232 },
      'Côte d\'Ivoire': { lat: 7.5399, lon: -5.5471 },
      'Nigeria': { lat: 9.0765, lon: 7.3986 },
      'Senegal': { lat: 14.4974, lon: -14.4524 }
    };
    
    return coordinates[country] || { lat: 0, lon: 0 };
  }

  private generateHistoricalPrices(commodity: string, startDate: Date, endDate: Date): IMarketPrice[] {
    const prices: IMarketPrice[] = [];
    const basePrice = this.getDefaultPrice(commodity);
    
    let currentDate = new Date(startDate);
    let price = basePrice;
    
    while (currentDate <= endDate) {
      // Add some randomness to simulate price movements
      const change = (Math.random() - 0.5) * 0.1; // ±5% daily change
      price = price * (1 + change);
      
      prices.push({
        _id: `${commodity}_${currentDate.toISOString()}`,
        productType: commodity,
        market: 'local',
        region: 'default',
        country: 'Ghana',
        price: Math.round(price * 100) / 100,
        currency: 'USD',
        unit: 'MT',
        date: new Date(currentDate),
        source: 'local_market',
        volume: Math.floor(Math.random() * 1000) + 100,
        trend: price > basePrice ? 'up' : price < basePrice ? 'down' : 'stable',
        createdAt: new Date()
      } as IMarketPrice);
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return prices;
  }
}

export default MarketDataService;