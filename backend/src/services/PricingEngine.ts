import axios from 'axios';
import { cache } from '../config/redis';
import { IProduct, PricingFactors, PriceEstimate } from '../types';
import { MarketDataService } from './marketDataService';
import { WeatherService } from './externalApiService';
import { LogisticsService } from './externalApiService';

// Enhanced market condition data structure
export interface MarketConditions {
  commodity: string;
  region: string;
  country: string;
  supplyLevel: 'low' | 'medium' | 'high';
  demandLevel: 'low' | 'medium' | 'high';
  seasonalFactor: number; // 0.5 to 2.0
  weatherImpact: number; // -0.5 to 0.5
  globalPrices: {
    current: number;
    trend: 'rising' | 'falling' | 'stable';
    volatility: number;
    historicalData: PricePoint[];
  };
  localMarketData: {
    averagePrice: number;
    priceRange: { min: number; max: number };
    tradingVolume: number;
    competitorCount: number;
    marketShare: number;
  };
  economicIndicators: {
    exchangeRate: number;
    inflation: number;
    gdpGrowth: number;
    agriculturalIndex: number;
  };
}

// Buyer profile for personalized pricing
export interface BuyerProfile {
  _id: string;
  buyerType: 'trader' | 'processor' | 'exporter' | 'retailer';
  location: {
    coordinates: [number, number];
    region: string;
    country: string;
  };
  orderVolume?: number;
  deliveryDate?: Date;
  paymentTerms: 'immediate' | 'net30' | 'net60' | 'credit';
  reputation: {
    score: number;
    transactionHistory: number;
  };
  preferences: {
    qualityGrades: string[];
    certifications: string[];
    maxPrice: number;
  };
}

// Enhanced pricing factors interface
export interface EnhancedPricingFactors extends PricingFactors {
  urgencyFactor: number;        // Time-sensitive delivery needs
  volumeDiscount: number;       // Bulk purchase incentives
  reputationAdjustment: number; // Farmer/buyer reputation impact
  competitionLevel: number;     // Local competition intensity
  processingPremium: number;    // Value-added processing bonus
  riskAdjustment: number;       // Political/economic risk factor
  sustainabilityBonus: number;  // Environmental impact premium
}

// Price point for historical data
interface PricePoint {
  date: Date;
  price: number;
  volume: number;
  source: string;
}

// Enhanced price estimate with comprehensive analysis
export interface ComprehensivePriceEstimate extends PriceEstimate {
  priceRange: {
    minimum: number;
    maximum: number;
    recommended: number;
  };
  marketTrend: {
    shortTerm: 'bullish' | 'bearish' | 'neutral';
    mediumTerm: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
  };
  competitorPrices: {
    average: number;
    range: { min: number; max: number };
    count: number;
  };
  recommendations: PricingRecommendation[];
  riskAssessment: {
    priceVolatility: number;
    marketRisk: 'low' | 'medium' | 'high';
    liquidityRisk: 'low' | 'medium' | 'high';
  };
}

interface PricingRecommendation {
  type: 'immediate_sale' | 'wait_for_better_price' | 'negotiate' | 'premium_positioning';
  confidence: number;
  reasoning: string;
  timeframe: string;
  expectedImpact: string;
}

// Base price sources and their reliability
export interface PriceSource {
  source: 'fao' | 'worldbank' | 'ice' | 'local_market' | 'exchange';
  price: number;
  currency: string;
  date: Date;
  reliability: number; // 0-1
  unit: string;
}

/**
 * Advanced Pricing Engine - Multi-factor pricing model with AI-driven insights
 * Considers quality, market conditions, seasonality, location, certifications, and buyer behavior
 */
export class AdvancedPricingEngine {
  private faoApiUrl: string;
  private worldBankApiUrl: string;
  private cachePrefix = 'pricing:';
  private marketDataService: MarketDataService;
  private weatherService: WeatherService;
  private logisticsService: LogisticsService;

  constructor(
    marketDataService: MarketDataService,
    weatherService: WeatherService,
    logisticsService: LogisticsService
  ) {
    this.faoApiUrl = process.env.FAO_API_URL || 'http://www.fao.org/faostat/api/v1';
    this.worldBankApiUrl = process.env.WORLDBANK_API_URL || 'https://api.worldbank.org/v2';
    this.marketDataService = marketDataService;
    this.weatherService = weatherService;
    this.logisticsService = logisticsService;
  }

  /**
   * Calculate comprehensive price estimate with advanced market analysis
   */
  async calculatePrice(
    product: IProduct, 
    marketConditions: MarketConditions,
    buyer?: BuyerProfile
  ): Promise<ComprehensivePriceEstimate> {
    try {
      // Step 1: Get base commodity price from multiple sources
      const basePrice = await this.getBasePriceFromMultipleSources(
        product.commodity,
        product.location.coordinates
      );
      
      // Step 2: Calculate comprehensive pricing factors
      const factors = await this.calculateComprehensivePricingFactors(
        product, 
        marketConditions, 
        buyer
      );
      
      // Step 3: Apply sophisticated pricing algorithm
      const adjustedPrice = this.applyAdvancedPricingModel(basePrice, factors);
      
      // Step 4: Calculate price confidence and volatility
      const confidence = this.calculatePriceConfidence(factors, marketConditions);
      const volatility = this.assessPriceVolatility(product.commodity, marketConditions);
      
      // Step 5: Generate price range for negotiation
      const priceRange = this.calculateNegotiationRange(adjustedPrice, volatility);
      
      // Step 6: Analyze market trends and competition
      const marketTrend = await this.analyzePriceTrend(product.commodity);
      const competitorPrices = await this.getCompetitorPricing(product);
      
      // Step 7: Generate pricing recommendations
      const recommendations = this.generatePricingRecommendations(factors, marketConditions);
      
      // Step 8: Assess market and liquidity risks
      const riskAssessment = this.assessPricingRisks(marketConditions, volatility);
      
      return {
        basePrice,
        adjustedPrice,
        priceRange,
        factors,
        confidence,
        validUntil: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
        marketTrend,
        competitorPrices,
        recommendations,
        riskAssessment,
        marketComparison: await this.analyzeMarketPosition(adjustedPrice, product, marketConditions)
      };
      
    } catch (error) {
      throw new Error(`Advanced price calculation failed: ${error.message}`);
    }
  }

  /**
   * Get base price from multiple international and local sources
   */
  private async getBasePriceFromMultipleSources(
    commodity: string, 
    coordinates: [number, number]
  ): Promise<number> {
    const cacheKey = `${this.cachePrefix}base:${commodity}:${coordinates[0]},${coordinates[1]}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return parseFloat(cached);
    }

    try {
      // Fetch from multiple sources in parallel
      const sources = await Promise.allSettled([
        this.getFAOPrice(commodity, this.getCountryFromCoordinates(coordinates)),
        this.getWorldBankPrice(commodity),
        this.getLocalMarketPrice(commodity, coordinates),
        this.getExchangePrice(commodity),
        this.getCommodityFuturesPrice(commodity)
      ]);

      const validSources: PriceSource[] = sources
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<PriceSource>).value)
        .filter(source => source.price > 0);

      if (validSources.length === 0) {
        throw new Error('No valid price sources available');
      }

      // Calculate weighted average based on reliability
      const totalWeight = validSources.reduce((sum, source) => sum + source.reliability, 0);
      const weightedPrice = validSources.reduce((sum, source) => 
        sum + (source.price * source.reliability), 0
      ) / totalWeight;

      // Cache for 6 hours
      await cache.setex(cacheKey, 21600, weightedPrice.toString());
      
      return weightedPrice;
      
    } catch (error) {
      // Fallback to default prices if external sources fail
      return this.getDefaultPrice(commodity);
    }
  }

  /**
   * Fetch price data from FAO GIEWS
   */
  private async getFAOPrice(commodity: string, country: string): Promise<PriceSource> {
    try {
      const commodityCode = this.getCommodityCode(commodity);
      const countryCode = this.getCountryCode(country);
      
      const response = await axios.get(`${this.faoApiUrl}/en/data/CP`, {
        params: {
          area: countryCode,
          item: commodityCode,
          year: new Date().getFullYear(),
          format: 'json'
        },
        timeout: 10000
      });

      const data = response.data?.data?.[0];
      if (!data || !data.Value) {
        throw new Error('No FAO price data available');
      }

      return {
        source: 'fao',
        price: parseFloat(data.Value),
        currency: 'USD',
        date: new Date(data.Year, 0, 1),
        reliability: 0.9,
        unit: data.Unit || 'USD/MT'
      };
    } catch (error) {
      throw new Error(`FAO price fetch failed: ${error.message}`);
    }
  }

  /**
   * Fetch price data from World Bank
   */
  private async getWorldBankPrice(commodity: string): Promise<PriceSource> {
    try {
      const commodityId = this.getWorldBankCommodityId(commodity);
      const currentYear = new Date().getFullYear();
      
      const response = await axios.get(
        `${this.worldBankApiUrl}/country/WLD/indicator/${commodityId}`,
        {
          params: {
            date: `${currentYear-1}:${currentYear}`,
            format: 'json',
            per_page: 1
          },
          timeout: 10000
        }
      );

      const data = response.data?.[1]?.[0];
      if (!data || !data.value) {
        throw new Error('No World Bank price data available');
      }

      return {
        source: 'worldbank',
        price: data.value,
        currency: 'USD',
        date: new Date(data.date, 0, 1),
        reliability: 0.85,
        unit: 'USD/MT'
      };
    } catch (error) {
      throw new Error(`World Bank price fetch failed: ${error.message}`);
    }
  }

  /**
   * Get local market price (simplified - would integrate with local APIs)
   */
  private async getLocalMarketPrice(commodity: string, country: string): Promise<PriceSource> {
    // This would integrate with local market APIs in a real implementation
    // For now, return a simulated local price
    const basePrice = this.getDefaultPrice(commodity);
    const localAdjustment = this.getLocalPriceAdjustment(country);
    
    return {
      source: 'local_market',
      price: basePrice * localAdjustment,
      currency: this.getLocalCurrency(country),
      date: new Date(),
      reliability: 0.7,
      unit: 'Local/MT'
    };
  }

  /**
   * Calculate comprehensive pricing factors
   */
  private async calculatePricingFactors(
    product: IProduct, 
    marketConditions: MarketConditions
  ): Promise<PricingFactors> {
    // Quality multiplier based on grade and metrics
    const qualityMultiplier = this.calculateQualityMultiplier(product.qualityAssessment);
    
    // Market demand factor
    const marketDemand = this.calculateMarketDemandFactor(marketConditions);
    
    // Seasonal adjustment
    const seasonalAdjustment = this.calculateSeasonalAdjustment(
      product.commodity, 
      product.harvestDate,
      marketConditions.seasonalFactor
    );
    
    // Weather impact
    const weatherImpact = marketConditions.weatherImpact;
    
    // Location premium (transport costs)
    const locationPremium = await this.calculateLocationPremium(
      product.location, 
      marketConditions.region
    );
    
    // Certification bonus
    const certificationBonus = this.calculateCertificationBonus(product.certifications);

    return {
      qualityMultiplier,
      marketDemand,
      seasonalAdjustment,
      weatherImpact,
      locationPremium,
      certificationBonus
    };
  }

  /**
   * Calculate quality multiplier based on AI analysis results
   */
  private calculateQualityMultiplier(qualityAssessment: any): number {
    const gradeMultipliers = {
      'A+': 1.25,
      'A': 1.15,
      'B': 1.05,
      'C': 0.95,
      'D': 0.80
    };

    const baseMultiplier = gradeMultipliers[qualityAssessment.grade] || 1.0;
    
    // Fine-tune based on confidence and overall score
    const confidenceAdjustment = (qualityAssessment.confidence - 0.5) * 0.1;
    const scoreAdjustment = (qualityAssessment.overallScore - 70) * 0.002;
    
    return Math.max(0.7, Math.min(1.4, baseMultiplier + confidenceAdjustment + scoreAdjustment));
  }

  /**
   * Calculate market demand factor
   */
  private calculateMarketDemandFactor(marketConditions: MarketConditions): number {
    const demandFactors = {
      'low': 0.85,
      'medium': 1.0,
      'high': 1.2
    };

    const supplyFactors = {
      'low': 1.15,   // Low supply = higher prices
      'medium': 1.0,
      'high': 0.9    // High supply = lower prices
    };

    const demandFactor = demandFactors[marketConditions.demandLevel];
    const supplyFactor = supplyFactors[marketConditions.supplyLevel];
    
    return (demandFactor * supplyFactor + marketConditions.globalPrices.current) / 2;
  }

  /**
   * Calculate seasonal price adjustment
   */
  private calculateSeasonalAdjustment(
    commodity: string, 
    harvestDate: Date, 
    seasonalFactor: number
  ): number {
    const currentMonth = new Date().getMonth();
    const harvestMonth = harvestDate.getMonth();
    
    // Months since harvest affects price
    let monthsSinceHarvest = currentMonth - harvestMonth;
    if (monthsSinceHarvest < 0) monthsSinceHarvest += 12;
    
    // Commodity-specific seasonal patterns
    const seasonalPatterns = {
      cocoa: [1.1, 1.05, 1.0, 0.95, 0.9, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15],
      coffee: [1.2, 1.15, 1.1, 1.05, 1.0, 0.95, 0.9, 0.85, 0.9, 0.95, 1.05, 1.15],
      cotton: [1.0, 1.0, 1.05, 1.1, 1.15, 1.2, 1.15, 1.1, 1.05, 1.0, 0.95, 0.95]
    };

    const pattern = seasonalPatterns[commodity] || Array(12).fill(1.0);
    const baseSeasonalMultiplier = pattern[currentMonth];
    
    // Apply harvest timing
    const harvestAdjustment = Math.max(0.9, 1.1 - (monthsSinceHarvest * 0.02));
    
    return baseSeasonalMultiplier * harvestAdjustment * seasonalFactor;
  }

  /**
   * Calculate location premium based on transport costs
   */
  private async calculateLocationPremium(
    productLocation: any, 
    marketRegion: string
  ): Promise<number> {
    // Simplified calculation - would use actual routing APIs
    const distanceToMarket = this.estimateDistanceToMarket(productLocation, marketRegion);
    const transportCostPerKm = 0.5; // USD per MT per km
    const locationPremium = (distanceToMarket * transportCostPerKm) / 1000; // As percentage
    
    return Math.min(0.2, Math.max(-0.1, locationPremium));
  }

  /**
   * Calculate certification bonus
   */
  private calculateCertificationBonus(certifications: any): number {
    let bonus = 0;
    
    if (certifications.organic) bonus += 0.15;
    if (certifications.fairTrade) bonus += 0.12;
    if (certifications.rainforest) bonus += 0.08;
    
    // Additional custom certifications
    if (certifications.custom?.length > 0) {
      bonus += certifications.custom.length * 0.03;
    }
    
    return Math.min(0.3, bonus); // Cap at 30% bonus
  }

  /**
   * Apply the complete pricing formula
   */
  private applyPricingFormula(basePrice: number, factors: PricingFactors): number {
    return basePrice * 
      factors.qualityMultiplier * 
      factors.marketDemand * 
      factors.seasonalAdjustment * 
      (1 + factors.weatherImpact) * 
      (1 + factors.locationPremium) * 
      (1 + factors.certificationBonus);
  }

  /**
   * Calculate price confidence based on data quality
   */
  private calculatePriceConfidence(
    factors: PricingFactors, 
    marketConditions: MarketConditions
  ): number {
    let confidence = 0.8; // Base confidence
    
    // Adjust based on market volatility
    confidence -= marketConditions.globalPrices.volatility * 0.2;
    
    // Adjust based on data freshness and quality
    if (marketConditions.globalPrices.trend === 'stable') confidence += 0.1;
    if (marketConditions.localMarketData.tradingVolume > 1000) confidence += 0.05;
    
    return Math.max(0.3, Math.min(1.0, confidence));
  }

  /**
   * Helper methods for data mapping and calculations
   */
  private getCommodityCode(commodity: string): string {
    const codes = {
      'cocoa': '0661',
      'coffee': '0656',
      'cotton': '0328',
      'maize': '0056',
      'rice': '0027'
    };
    return codes[commodity] || '0000';
  }

  private getCountryCode(country: string): string {
    const codes = {
      'Ghana': 'GH',
      'Côte d\'Ivoire': 'CI',
      'Nigeria': 'NG',
      'Senegal': 'SN'
    };
    return codes[country] || 'WLD';
  }

  private getWorldBankCommodityId(commodity: string): string {
    const ids = {
      'cocoa': 'PCOCOA',
      'coffee': 'PCOFFOTM',
      'cotton': 'PCOTTIND'
    };
    return ids[commodity] || 'PMAIZMT';
  }

  private getDefaultPrice(commodity: string): number {
    const defaults = {
      'cocoa': 2400,  // USD/MT
      'coffee': 3200,
      'cotton': 1600,
      'maize': 280,
      'rice': 450
    };
    return defaults[commodity] || 1000;
  }

  private getLocalCurrency(country: string): string {
    const currencies = {
      'Ghana': 'GHS',
      'Côte d\'Ivoire': 'XOF',
      'Nigeria': 'NGN',
      'Senegal': 'XOF'
    };
    return currencies[country] || 'USD';
  }

  private getLocalPriceAdjustment(country: string): number {
    const adjustments = {
      'Ghana': 0.95,
      'Côte d\'Ivoire': 0.98,
      'Nigeria': 0.92,
      'Senegal': 0.96
    };
    return adjustments[country] || 1.0;
  }

  private estimateDistanceToMarket(productLocation: any, marketRegion: string): number {
    // Simplified distance calculation - would use actual mapping APIs
    return Math.random() * 500 + 50; // 50-550 km
  }

  private calculateValidityPeriod(volatility: number): number {
    // Higher volatility = shorter validity period
    return Math.max(6, 48 - (volatility * 24)); // 6-48 hours
  }

  private async analyzeMarketPosition(
    price: number, 
    product: IProduct, 
    marketConditions: MarketConditions
  ) {
    const { min, max } = marketConditions.localMarketData.priceRange;
    const percentile = ((price - min) / (max - min)) * 100;
    
    return {
      percentile: Math.round(percentile),
      competitive: percentile >= 40 && percentile <= 70,
      suggestions: this.generatePricingSuggestions(percentile, marketConditions)
    };
  }

  private generatePricingSuggestions(percentile: number, marketConditions: MarketConditions): string[] {
    const suggestions = [];
    
    if (percentile > 80) {
      suggestions.push('Price is above market average - consider if quality justifies premium');
    } else if (percentile < 30) {
      suggestions.push('Price is below market average - potential for higher pricing');
    }
    
    if (marketConditions.globalPrices.trend === 'rising') {
      suggestions.push('Global prices are rising - consider timing of sale');
    }
    
    return suggestions;
  }

  private async cachePriceEstimate(product: IProduct, estimate: PriceEstimate): Promise<void> {
    const cacheKey = `${this.cachePrefix}estimate:${product._id}:${Date.now()}`;
    await cache.setJSON(cacheKey, estimate, 3600); // Cache for 1 hour
  }
}

export default PricingEngine;