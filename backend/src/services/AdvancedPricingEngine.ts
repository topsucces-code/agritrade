import axios from 'axios';
import { cache } from '../config/redis';
import { IProduct, PricingFactors, PriceEstimate } from '../types';
import { MarketDataService } from './marketDataService';
import { WeatherService } from './externalApiService';

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

// Enhanced market conditions
export interface MarketConditions {
  commodity: string;
  region: string;
  country: string;
  supplyLevel: 'low' | 'medium' | 'high';
  demandLevel: 'low' | 'medium' | 'high';
  seasonalFactor: number;
  weatherImpact: number;
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

interface PricePoint {
  date: Date;
  price: number;
  volume: number;
  source: string;
}

// Enhanced price estimate
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

/**
 * Advanced Pricing Engine with AI-driven market intelligence
 * Implements sophisticated pricing algorithms for agricultural commodities
 */
export class AdvancedPricingEngine {
  private marketDataService: MarketDataService;
  private weatherService: WeatherService;
  private cachePrefix = 'advanced_pricing:';

  constructor(
    marketDataService: MarketDataService,
    weatherService: WeatherService
  ) {
    this.marketDataService = marketDataService;
    this.weatherService = weatherService;
  }

  /**
   * Calculate comprehensive price estimate with advanced market analysis
   */
  async calculatePrice(
    product: IProduct, 
    market: MarketConditions,
    buyer?: BuyerProfile
  ): Promise<ComprehensivePriceEstimate> {
    try {
      // Get base commodity price from international markets
      const basePrice = await this.getBasePriceFromMultipleSources(
        product.commodity,
        product.location.coordinates
      );
      
      // Calculate all pricing factors
      const factors = await this.calculateComprehensivePricingFactors(
        product, 
        market, 
        buyer
      );
      
      // Apply sophisticated pricing algorithm
      const adjustedPrice = this.applyPricingModel(basePrice, factors);
      
      // Calculate price confidence and volatility
      const confidence = this.calculatePriceConfidence(factors, market);
      const volatility = this.assessPriceVolatility(product.commodity, market);
      
      // Generate price range for negotiation
      const priceRange = this.calculateNegotiationRange(adjustedPrice, volatility);
      
      return {
        basePrice,
        adjustedPrice,
        priceRange,
        factors,
        confidence,
        volatility,
        recommendations: this.generatePricingRecommendations(factors),
        validUntil: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
        marketTrend: this.analyzePriceTrend(product.commodity),
        competitorPrices: await this.getCompetitorPricing(product),
        riskAssessment: this.assessPricingRisks(market, volatility),
        marketComparison: this.analyzeMarketPosition(adjustedPrice, market)
      };
      
    } catch (error) {
      throw new Error(`Failed to calculate product price: ${error.message}`);
    }
  }

  /**
   * Calculate comprehensive pricing factors
   */
  private async calculateComprehensivePricingFactors(
    product: IProduct,
    market: MarketConditions,
    buyer?: BuyerProfile
  ): Promise<EnhancedPricingFactors> {
    const [
      qualityMultiplier,
      marketDemand,
      seasonalAdjustment,
      weatherImpact,
      locationPremium,
      certificationBonus
    ] = await Promise.all([
      this.calculateQualityMultiplier(product.qualityAssessment),
      this.assessMarketDemand(product.commodity, product.location),
      this.getSeasonalAdjustment(product.commodity, product.harvest.date),
      this.calculateWeatherImpact(product.location, product.commodity),
      this.calculateLocationPremium(product.location, buyer?.location),
      this.calculateCertificationBonus(product.certifications)
    ]);
    
    return {
      qualityMultiplier,
      marketDemand,
      seasonalAdjustment,
      weatherImpact,
      locationPremium,
      certificationBonus,
      urgencyFactor: buyer ? this.calculateUrgencyFactor(buyer.deliveryDate) : 1.0,
      volumeDiscount: this.calculateVolumeDiscount(product.quantity.available, buyer?.orderVolume),
      reputationAdjustment: this.calculateReputationAdjustment(product.farmerId, buyer?._id),
      competitionLevel: this.assessCompetitionLevel(market),
      processingPremium: this.calculateProcessingPremium(product),
      riskAdjustment: this.calculateRiskAdjustment(market),
      sustainabilityBonus: this.calculateSustainabilityBonus(product)
    };
  }

  /**
   * Apply advanced non-linear pricing model
   */
  private applyPricingModel(basePrice: number, factors: EnhancedPricingFactors): number {
    // Advanced non-linear pricing model
    const qualityAdjustedPrice = basePrice * factors.qualityMultiplier;
    const marketAdjustedPrice = qualityAdjustedPrice * factors.marketDemand;
    const seasonalPrice = marketAdjustedPrice * factors.seasonalAdjustment;
    const weatherAdjustedPrice = seasonalPrice * (1 + factors.weatherImpact);
    const locationAdjustedPrice = weatherAdjustedPrice * (1 + factors.locationPremium);
    const certifiedPrice = locationAdjustedPrice * (1 + factors.certificationBonus);
    const urgencyAdjustedPrice = certifiedPrice * factors.urgencyFactor;
    const volumeAdjustedPrice = urgencyAdjustedPrice * (1 - factors.volumeDiscount);
    const reputationAdjustedPrice = volumeAdjustedPrice * factors.reputationAdjustment;
    const competitionAdjustedPrice = reputationAdjustedPrice * (1 - factors.competitionLevel * 0.1);
    const processingAdjustedPrice = competitionAdjustedPrice * (1 + factors.processingPremium);
    const riskAdjustedPrice = processingAdjustedPrice * (1 + factors.riskAdjustment);
    const finalPrice = riskAdjustedPrice * (1 + factors.sustainabilityBonus);
    
    return Math.round(finalPrice * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate quality multiplier based on AI analysis
   */
  private async calculateQualityMultiplier(qualityAssessment: any): Promise<number> {
    const gradeMultipliers = {
      'A+': 1.30,
      'A': 1.20,
      'B': 1.10,
      'C': 0.95,
      'D': 0.80
    };

    const baseMultiplier = gradeMultipliers[qualityAssessment.grade] || 1.0;
    
    // Fine-tune based on confidence and detailed metrics
    const confidenceAdjustment = (qualityAssessment.confidence - 0.7) * 0.15;
    const scoreAdjustment = (qualityAssessment.overallScore - 75) * 0.003;
    
    return Math.max(0.75, Math.min(1.45, baseMultiplier + confidenceAdjustment + scoreAdjustment));
  }

  /**
   * Assess market demand based on location and commodity
   */
  private async assessMarketDemand(commodity: string, location: any): Promise<number> {
    // Simulate market demand based on commodity and region
    const demandFactors = {
      'cocoa': { base: 1.15, regional: this.getRegionalDemand(location, 'cocoa') },
      'coffee': { base: 1.20, regional: this.getRegionalDemand(location, 'coffee') },
      'cotton': { base: 1.05, regional: this.getRegionalDemand(location, 'cotton') }
    };

    const commodityFactor = demandFactors[commodity] || { base: 1.0, regional: 1.0 };
    return commodityFactor.base * commodityFactor.regional;
  }

  /**
   * Calculate seasonal adjustment factor
   */
  private async getSeasonalAdjustment(commodity: string, harvestDate: Date): Promise<number> {
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
    
    // Apply harvest timing adjustment
    const harvestAdjustment = Math.max(0.85, 1.15 - (monthsSinceHarvest * 0.025));
    
    return baseSeasonalMultiplier * harvestAdjustment;
  }

  /**
   * Calculate weather impact on pricing
   */
  private async calculateWeatherImpact(location: any, commodity: string): Promise<number> {
    try {
      const weatherData = await this.weatherService.getCurrentWeather(location.coordinates);
      const forecastData = await this.weatherService.getWeatherForecast(location.coordinates, 30);
      
      let weatherImpact = 0;
      
      // Analyze current conditions
      if (weatherData.precipitation > 50) weatherImpact -= 0.05; // Heavy rain can delay drying
      if (weatherData.humidity > 80) weatherImpact -= 0.03; // High humidity affects quality
      if (weatherData.temperature > 35) weatherImpact -= 0.02; // Extreme heat
      
      // Analyze forecast trends
      const avgPrecipitation = forecastData.reduce((sum, day) => sum + day.precipitation, 0) / forecastData.length;
      if (avgPrecipitation > 30) weatherImpact -= 0.08; // Poor drying conditions expected
      
      return Math.max(-0.2, Math.min(0.1, weatherImpact));
    } catch (error) {
      return 0; // Default to no weather impact if service fails
    }
  }

  /**
   * Calculate location premium based on transport costs and market access
   */
  private async calculateLocationPremium(productLocation: any, buyerLocation?: any): Promise<number> {
    if (!buyerLocation) return 0;
    
    // Calculate distance and transport cost
    const distance = this.calculateDistance(
      productLocation.coordinates,
      buyerLocation.coordinates
    );
    
    const transportCostPerKm = 0.8; // USD per MT per km
    const locationPremium = (distance * transportCostPerKm) / 1500; // As percentage
    
    // Factor in infrastructure quality
    const infrastructureAdjustment = this.getInfrastructureQuality(productLocation);
    
    return Math.min(0.25, Math.max(-0.15, locationPremium * infrastructureAdjustment));
  }

  /**
   * Calculate certification bonus
   */
  private async calculateCertificationBonus(certifications: any): Promise<number> {
    let bonus = 0;
    
    if (certifications?.organic?.certified) bonus += 0.18;
    if (certifications?.fairTrade?.certified) bonus += 0.15;
    if (certifications?.rainforestAlliance?.certified) bonus += 0.10;
    
    // Custom certifications
    if (certifications?.customCertifications?.length > 0) {
      bonus += certifications.customCertifications.length * 0.04;
    }
    
    return Math.min(0.35, bonus); // Cap at 35% bonus
  }

  /**
   * Calculate urgency factor based on delivery timeline
   */
  private calculateUrgencyFactor(deliveryDate?: Date): number {
    if (!deliveryDate) return 1.0;
    
    const daysUntilDelivery = Math.ceil(
      (deliveryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysUntilDelivery <= 7) return 1.15; // Urgent delivery premium
    if (daysUntilDelivery <= 14) return 1.08; // Moderate urgency
    if (daysUntilDelivery <= 30) return 1.03; // Slight premium
    return 1.0; // No urgency premium
  }

  /**
   * Calculate volume discount
   */
  private calculateVolumeDiscount(availableQuantity: number, orderVolume?: number): number {
    if (!orderVolume) return 0;
    
    const volumeRatio = orderVolume / availableQuantity;
    
    if (volumeRatio >= 1.0) return 0.08; // Full purchase discount
    if (volumeRatio >= 0.7) return 0.05; // Large volume discount
    if (volumeRatio >= 0.5) return 0.03; // Medium volume discount
    if (volumeRatio >= 0.3) return 0.01; // Small volume discount
    return 0; // No discount
  }

  /**
   * Calculate reputation adjustment
   */
  private calculateReputationAdjustment(farmerId: string, buyerId?: string): number {
    // This would query actual reputation data from the database
    // For now, return a simulated adjustment
    const farmerReputation = 0.8; // Simulated farmer reputation (0-1)
    const buyerReputation = buyerId ? 0.85 : 0.75; // Simulated buyer reputation
    
    const combinedReputation = (farmerReputation + buyerReputation) / 2;
    
    // Convert to price adjustment (-5% to +10%)
    return 0.95 + (combinedReputation * 0.15);
  }

  /**
   * Assess competition level in the market
   */
  private assessCompetitionLevel(market: MarketConditions): number {
    const competitorCount = market.localMarketData.competitorCount;
    const marketShare = market.localMarketData.marketShare;
    
    // Higher competition = lower prices
    let competitionLevel = 0;
    
    if (competitorCount > 10) competitionLevel = 0.15;
    else if (competitorCount > 5) competitionLevel = 0.10;
    else if (competitorCount > 2) competitionLevel = 0.05;
    
    // Adjust based on market share
    if (marketShare < 0.1) competitionLevel += 0.05; // Low market share = more competition
    
    return Math.min(0.25, competitionLevel);
  }

  /**
   * Calculate processing premium for value-added products
   */
  private calculateProcessingPremium(product: IProduct): number {
    // Check for value-added processing indicators
    let premium = 0;
    
    if (product.harvest?.processingMethod === 'washed') premium += 0.08;
    if (product.harvest?.dryingMethod === 'sun_dried') premium += 0.05;
    if (product.logistics?.packagingType === 'premium') premium += 0.03;
    
    return Math.min(0.15, premium);
  }

  /**
   * Calculate risk adjustment based on market conditions
   */
  private calculateRiskAdjustment(market: MarketConditions): number {
    let riskAdjustment = 0;
    
    // Economic indicators
    if (market.economicIndicators.inflation > 10) riskAdjustment += 0.05;
    if (market.economicIndicators.gdpGrowth < 0) riskAdjustment += 0.03;
    if (market.globalPrices.volatility > 0.3) riskAdjustment += 0.04;
    
    return Math.min(0.15, riskAdjustment);
  }

  /**
   * Calculate sustainability bonus
   */
  private calculateSustainabilityBonus(product: IProduct): number {
    let bonus = 0;
    
    // Sustainable farming practices
    if (product.harvest?.processingMethod === 'organic') bonus += 0.12;
    if (product.location?.farm?.size < 5) bonus += 0.05; // Small-scale farming support
    
    return Math.min(0.20, bonus);
  }

  // Helper methods
  private getRegionalDemand(location: any, commodity: string): number {
    // Simulate regional demand factors
    return 1.0 + Math.random() * 0.2 - 0.1; // ±10% variation
  }

  private calculateDistance(coord1: [number, number], coord2: [number, number]): number {
    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(coord2[1] - coord1[1]);
    const dLon = this.toRadians(coord2[0] - coord1[0]);
    const lat1 = this.toRadians(coord1[1]);
    const lat2 = this.toRadians(coord2[1]);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI/180);
  }

  private getInfrastructureQuality(location: any): number {
    // Simulate infrastructure quality assessment
    return 0.8 + Math.random() * 0.4; // 0.8 to 1.2 multiplier
  }

  private async getBasePriceFromMultipleSources(commodity: string, coordinates: [number, number]): Promise<number> {
    // Simplified base price calculation
    const basePrices = {
      'cocoa': 2400,
      'coffee': 3200,
      'cotton': 1600,
      'maize': 280,
      'rice': 450
    };
    
    return basePrices[commodity] || 1000;
  }

  private calculatePriceConfidence(factors: EnhancedPricingFactors, market: MarketConditions): number {
    let confidence = 0.8; // Base confidence
    
    // Adjust based on market volatility
    confidence -= market.globalPrices.volatility * 0.3;
    
    // Adjust based on data quality
    if (market.globalPrices.trend === 'stable') confidence += 0.1;
    if (market.localMarketData.tradingVolume > 1000) confidence += 0.05;
    
    return Math.max(0.4, Math.min(1.0, confidence));
  }

  private assessPriceVolatility(commodity: string, market: MarketConditions): number {
    return market.globalPrices.volatility;
  }

  private calculateNegotiationRange(adjustedPrice: number, volatility: number): any {
    const margin = adjustedPrice * (0.1 + volatility * 0.2);
    
    return {
      minimum: Math.round((adjustedPrice - margin) * 100) / 100,
      maximum: Math.round((adjustedPrice + margin) * 100) / 100,
      recommended: adjustedPrice
    };
  }

  private generatePricingRecommendations(factors: EnhancedPricingFactors): PricingRecommendation[] {
    const recommendations: PricingRecommendation[] = [];
    
    if (factors.qualityMultiplier > 1.2) {
      recommendations.push({
        type: 'premium_positioning',
        confidence: 0.85,
        reasoning: 'High quality grade supports premium pricing',
        timeframe: 'Immediate',
        expectedImpact: 'Price premium of 15-25%'
      });
    }
    
    if (factors.urgencyFactor > 1.1) {
      recommendations.push({
        type: 'immediate_sale',
        confidence: 0.75,
        reasoning: 'Buyer urgency allows for premium pricing',
        timeframe: '1-2 days',
        expectedImpact: 'Additional 8-15% premium'
      });
    }
    
    return recommendations;
  }

  private analyzePriceTrend(commodity: string): any {
    // Simulate trend analysis
    return {
      shortTerm: 'bullish' as const,
      mediumTerm: 'neutral' as const,
      confidence: 0.75
    };
  }

  private async getCompetitorPricing(product: IProduct): Promise<any> {
    // Simulate competitor pricing analysis
    return {
      average: 2200,
      range: { min: 1800, max: 2600 },
      count: 8
    };
  }

  private assessPricingRisks(market: MarketConditions, volatility: number): any {
    return {
      priceVolatility: volatility,
      marketRisk: volatility > 0.3 ? 'high' : volatility > 0.15 ? 'medium' : 'low',
      liquidityRisk: market.localMarketData.tradingVolume < 500 ? 'high' : 'low'
    };
  }

  private analyzeMarketPosition(adjustedPrice: number, market: MarketConditions): any {
    const { min, max } = market.localMarketData.priceRange;
    const percentile = ((adjustedPrice - min) / (max - min)) * 100;
    
    return {
      percentile: Math.round(percentile),
      competitive: percentile >= 40 && percentile <= 70,
      suggestions: percentile > 80 ? 
        ['Consider if quality justifies premium pricing'] : 
        ['Potential for higher pricing based on market position']
    };
  }
}

export default AdvancedPricingEngine;