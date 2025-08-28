import { Types } from 'mongoose';
import MatchingEngine from './MatchingEngine';
import PricingEngine from './PricingEngine';
import MarketDataService from './MarketDataService';
import { IProduct, IUser, MatchResult } from '../types';
import { cache } from '../config/redis';

export interface FarmerRecommendation {
  type: 'pricing' | 'timing' | 'quality' | 'buyer' | 'market';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  expectedBenefit: string;
  data?: any;
}

export interface BuyerRecommendation {
  type: 'product' | 'pricing' | 'timing' | 'farmer' | 'quality';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  expectedBenefit: string;
  data?: any;
}

/**
 * Recommendation Service - Provides intelligent recommendations for platform users
 */
export class RecommendationService {
  private matchingEngine: MatchingEngine;
  private pricingEngine: PricingEngine;
  private marketDataService: MarketDataService;
  private cachePrefix = 'recommendations:';

  constructor() {
    this.matchingEngine = new MatchingEngine();
    this.pricingEngine = new PricingEngine();
    this.marketDataService = new MarketDataService();
  }

  /**
   * Get comprehensive recommendations for farmers
   */
  async getFarmerRecommendations(
    farmerId: Types.ObjectId, 
    products: IProduct[]
  ): Promise<FarmerRecommendation[]> {
    const cacheKey = `${this.cachePrefix}farmer:${farmerId}`;
    const cached = await cache.getJSON(cacheKey);
    
    if (cached) {
      return cached as FarmerRecommendation[];
    }

    const recommendations: FarmerRecommendation[] = [];

    try {
      // Parallel analysis of different recommendation types
      const [
        pricingRecommendations,
        timingRecommendations,
        qualityRecommendations,
        buyerRecommendations,
        marketRecommendations
      ] = await Promise.allSettled([
        this.generatePricingRecommendations(products),
        this.generateTimingRecommendations(products),
        this.generateQualityRecommendations(products),
        this.generateBuyerRecommendations(products),
        this.generateMarketRecommendations(products)
      ]);

      // Collect all successful recommendations
      [
        pricingRecommendations,
        timingRecommendations,
        qualityRecommendations,
        buyerRecommendations,
        marketRecommendations
      ].forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          recommendations.push(...result.value);
        }
      });

      // Sort by priority
      const sortedRecommendations = this.sortRecommendationsByPriority(recommendations);

      // Cache for 2 hours
      await cache.setJSON(cacheKey, sortedRecommendations, 7200);

      return sortedRecommendations;

    } catch (error) {
      throw new Error(`Failed to generate farmer recommendations: ${error.message}`);
    }
  }

  /**
   * Get recommendations for buyers
   */
  async getBuyerRecommendations(
    buyerId: Types.ObjectId,
    searchCriteria?: any
  ): Promise<BuyerRecommendation[]> {
    const cacheKey = `${this.cachePrefix}buyer:${buyerId}`;
    const cached = await cache.getJSON(cacheKey);
    
    if (cached) {
      return cached as BuyerRecommendation[];
    }

    const recommendations: BuyerRecommendation[] = [];

    try {
      // Generate different types of buyer recommendations
      const [
        productRecommendations,
        pricingRecommendations,
        timingRecommendations,
        farmerRecommendations
      ] = await Promise.allSettled([
        this.generateProductRecommendations(buyerId, searchCriteria),
        this.generateBuyerPricingRecommendations(searchCriteria),
        this.generateBuyerTimingRecommendations(searchCriteria),
        this.generateTopFarmerRecommendations(buyerId)
      ]);

      // Collect successful recommendations
      [productRecommendations, pricingRecommendations, timingRecommendations, farmerRecommendations]
        .forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            recommendations.push(...result.value);
          }
        });

      const sortedRecommendations = this.sortBuyerRecommendationsByPriority(recommendations);

      // Cache for 1 hour
      await cache.setJSON(cacheKey, sortedRecommendations, 3600);

      return sortedRecommendations;

    } catch (error) {
      throw new Error(`Failed to generate buyer recommendations: ${error.message}`);
    }
  }

  /**
   * Generate pricing recommendations for farmers
   */
  private async generatePricingRecommendations(products: IProduct[]): Promise<FarmerRecommendation[]> {
    const recommendations: FarmerRecommendation[] = [];

    for (const product of products) {
      try {
        const marketConditions = await this.marketDataService.getMarketConditions(
          product.commodity,
          product.location.country,
          product.location.region
        );

        const priceEstimate = await this.pricingEngine.calculatePrice(product, marketConditions);
        const currentPrice = product.pricing.finalPrice;
        const estimatedPrice = priceEstimate.adjustedPrice;

        // Price gap analysis
        const priceGap = ((estimatedPrice - currentPrice) / currentPrice) * 100;

        if (priceGap > 10) {
          recommendations.push({
            type: 'pricing',
            priority: 'high',
            title: 'Price Increase Opportunity',
            description: `Your ${product.commodity} could be priced ${priceGap.toFixed(1)}% higher based on current market conditions.`,
            action: `Consider increasing price from $${currentPrice} to $${estimatedPrice.toFixed(2)}`,
            expectedBenefit: `Potential additional revenue of $${((estimatedPrice - currentPrice) * product.quantity.available).toFixed(2)}`,
            data: { currentPrice, estimatedPrice, priceGap, product: product._id }
          });
        } else if (priceGap < -15) {
          recommendations.push({
            type: 'pricing',
            priority: 'medium',
            title: 'Price Adjustment Needed',
            description: `Your ${product.commodity} appears to be overpriced by ${Math.abs(priceGap).toFixed(1)}% compared to market rates.`,
            action: `Consider reducing price to $${estimatedPrice.toFixed(2)} to improve competitiveness`,
            expectedBenefit: 'Faster sales and better buyer interest',
            data: { currentPrice, estimatedPrice, priceGap, product: product._id }
          });
        }

        // Market trend recommendations
        if (marketConditions.globalPrices.trend === 'rising' && priceEstimate.confidence > 0.7) {
          recommendations.push({
            type: 'timing',
            priority: 'medium',
            title: 'Favorable Market Trend',
            description: `${product.commodity} prices are trending upward with ${(priceEstimate.confidence * 100).toFixed(0)}% confidence.`,
            action: 'Consider holding for better prices if storage permits',
            expectedBenefit: 'Potential 5-15% price increase in coming weeks',
            data: { trend: marketConditions.globalPrices.trend, confidence: priceEstimate.confidence }
          });
        }

      } catch (error) {
        console.error(`Pricing recommendation error for product ${product._id}:`, error);
      }
    }

    return recommendations;
  }

  /**
   * Generate timing recommendations
   */
  private async generateTimingRecommendations(products: IProduct[]): Promise<FarmerRecommendation[]> {
    const recommendations: FarmerRecommendation[] = [];

    for (const product of products) {
      // Harvest timing analysis
      const daysSinceHarvest = (Date.now() - product.harvestDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceHarvest > 60) {
        recommendations.push({
          type: 'timing',
          priority: 'high',
          title: 'Urgent Sale Recommended',
          description: `Your ${product.commodity} has been in storage for ${Math.floor(daysSinceHarvest)} days.`,
          action: 'Consider immediate sale to prevent quality deterioration',
          expectedBenefit: 'Maintain current quality grade and avoid storage losses',
          data: { daysSinceHarvest, product: product._id }
        });
      }

      // Seasonal timing
      const currentMonth = new Date().getMonth();
      const optimalSaleMonths = this.getOptimalSaleMonths(product.commodity);
      
      if (optimalSaleMonths.includes(currentMonth)) {
        recommendations.push({
          type: 'timing',
          priority: 'medium',
          title: 'Optimal Sale Period',
          description: `Current time is favorable for selling ${product.commodity} due to seasonal demand patterns.`,
          action: 'Consider listing for immediate sale',
          expectedBenefit: 'Take advantage of seasonal price premiums',
          data: { commodity: product.commodity, currentMonth }
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate quality improvement recommendations
   */
  private async generateQualityRecommendations(products: IProduct[]): Promise<FarmerRecommendation[]> {
    const recommendations: FarmerRecommendation[] = [];

    for (const product of products) {
      const qualityScore = product.qualityAssessment.overallScore;
      const grade = product.qualityAssessment.grade;

      if (qualityScore < 70 || grade === 'C' || grade === 'D') {
        recommendations.push({
          type: 'quality',
          priority: 'high',
          title: 'Quality Improvement Opportunity',
          description: `Your ${product.commodity} has a quality score of ${qualityScore}% (Grade ${grade}).`,
          action: 'Review post-harvest processing and storage practices',
          expectedBenefit: 'Potential 20-30% price increase with better quality',
          data: { qualityScore, grade, product: product._id }
        });
      }

      // Storage condition recommendations
      if (product.storageConditions.humidity > 70) {
        recommendations.push({
          type: 'quality',
          priority: 'medium',
          title: 'Storage Optimization',
          description: `Storage humidity (${product.storageConditions.humidity}%) is above optimal levels.`,
          action: 'Improve ventilation and consider dehumidification',
          expectedBenefit: 'Prevent quality degradation and maintain grade',
          data: { humidity: product.storageConditions.humidity, product: product._id }
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate buyer matching recommendations
   */
  private async generateBuyerRecommendations(products: IProduct[]): Promise<FarmerRecommendation[]> {
    const recommendations: FarmerRecommendation[] = [];

    for (const product of products) {
      try {
        const matches = await this.matchingEngine.findBuyersForProduct(product._id);
        
        if (matches.length > 0) {
          const topMatch = matches[0];
          recommendations.push({
            type: 'buyer',
            priority: topMatch.score > 0.8 ? 'high' : 'medium',
            title: 'High-Quality Buyer Match Found',
            description: `Found ${matches.length} potential buyers for your ${product.commodity}.`,
            action: `Contact top buyer (${(topMatch.score * 100).toFixed(0)}% compatibility)`,
            expectedBenefit: 'Quick sale with reliable buyer',
            data: { matches: matches.slice(0, 3), product: product._id }
          });
        } else {
          recommendations.push({
            type: 'buyer',
            priority: 'low',
            title: 'Limited Buyer Interest',
            description: `Few active buyers found for your ${product.commodity} in your region.`,
            action: 'Consider expanding delivery radius or adjusting price',
            expectedBenefit: 'Increased buyer pool and faster sales',
            data: { product: product._id }
          });
        }
      } catch (error) {
        console.error(`Buyer recommendation error for product ${product._id}:`, error);
      }
    }

    return recommendations;
  }

  /**
   * Generate market intelligence recommendations
   */
  private async generateMarketRecommendations(products: IProduct[]): Promise<FarmerRecommendation[]> {
    const recommendations: FarmerRecommendation[] = [];

    // Get commodity-wise market analysis
    const commodities = [...new Set(products.map(p => p.commodity))];
    
    for (const commodity of commodities) {
      try {
        const sampleProduct = products.find(p => p.commodity === commodity);
        if (!sampleProduct) continue;

        const marketConditions = await this.marketDataService.getMarketConditions(
          commodity,
          sampleProduct.location.country,
          sampleProduct.location.region
        );

        // Supply-demand imbalance opportunities
        if (marketConditions.demandLevel === 'high' && marketConditions.supplyLevel === 'low') {
          recommendations.push({
            type: 'market',
            priority: 'high',
            title: 'Market Opportunity Alert',
            description: `${commodity} market shows high demand and low supply conditions.`,
            action: 'Prioritize this commodity for immediate harvest and sale',
            expectedBenefit: 'Premium pricing due to supply shortage',
            data: { commodity, marketConditions }
          });
        }

        // Weather impact alerts
        if (Math.abs(marketConditions.weatherImpact) > 0.15) {
          recommendations.push({
            type: 'market',
            priority: 'medium',
            title: 'Weather Impact on Prices',
            description: `Weather conditions are ${marketConditions.weatherImpact > 0 ? 'positively' : 'negatively'} affecting ${commodity} prices.`,
            action: marketConditions.weatherImpact > 0 ? 'Consider accelerated sales' : 'Monitor market closely',
            expectedBenefit: 'Take advantage of weather-driven price movements',
            data: { commodity, weatherImpact: marketConditions.weatherImpact }
          });
        }

      } catch (error) {
        console.error(`Market recommendation error for ${commodity}:`, error);
      }
    }

    return recommendations;
  }

  /**
   * Generate product recommendations for buyers
   */
  private async generateProductRecommendations(
    buyerId: Types.ObjectId,
    searchCriteria: any
  ): Promise<BuyerRecommendation[]> {
    const recommendations: BuyerRecommendation[] = [];

    // This would analyze buyer's purchase history and preferences
    // For now, provide general recommendations
    
    recommendations.push({
      type: 'product',
      priority: 'medium',
      title: 'New Quality Products Available',
      description: 'High-grade cocoa beans from verified farmers in your preferred region.',
      action: 'Review available premium products',
      expectedBenefit: 'Access to premium quality commodities',
      data: { category: 'premium_products' }
    });

    return recommendations;
  }

  /**
   * Generate pricing recommendations for buyers
   */
  private async generateBuyerPricingRecommendations(searchCriteria: any): Promise<BuyerRecommendation[]> {
    return [
      {
        type: 'pricing',
        priority: 'low',
        title: 'Market Price Analysis',
        description: 'Current market prices are 5% below seasonal average.',
        action: 'Consider increasing purchase volume',
        expectedBenefit: 'Cost savings opportunity',
        data: { priceAnalysis: 'below_average' }
      }
    ];
  }

  /**
   * Generate timing recommendations for buyers
   */
  private async generateBuyerTimingRecommendations(searchCriteria: any): Promise<BuyerRecommendation[]> {
    return [
      {
        type: 'timing',
        priority: 'medium',
        title: 'Seasonal Purchase Opportunity',
        description: 'Peak harvest season approaching - increased supply expected.',
        action: 'Plan bulk purchases for next month',
        expectedBenefit: 'Better prices and quality selection',
        data: { timing: 'pre_harvest' }
      }
    ];
  }

  /**
   * Generate top farmer recommendations for buyers
   */
  private async generateTopFarmerRecommendations(buyerId: Types.ObjectId): Promise<BuyerRecommendation[]> {
    return [
      {
        type: 'farmer',
        priority: 'medium',
        title: 'Trusted Farmer Network',
        description: 'Connect with highly-rated farmers in your region.',
        action: 'Build relationships with top performers',
        expectedBenefit: 'Reliable supply chain partnerships',
        data: { category: 'trusted_farmers' }
      }
    ];
  }

  /**
   * Helper methods
   */
  private sortRecommendationsByPriority(recommendations: FarmerRecommendation[]): FarmerRecommendation[] {
    const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    return recommendations.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
  }

  private sortBuyerRecommendationsByPriority(recommendations: BuyerRecommendation[]): BuyerRecommendation[] {
    const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    return recommendations.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
  }

  private getOptimalSaleMonths(commodity: string): number[] {
    const patterns = {
      'cocoa': [10, 11, 0, 1], // Oct-Jan
      'coffee': [11, 0, 1, 2], // Nov-Feb
      'cotton': [0, 1, 2], // Jan-Mar
      'maize': [7, 8, 9], // Aug-Oct
      'rice': [8, 9, 10] // Sep-Nov
    };
    
    return patterns[commodity] || [0, 1, 2];
  }
}

export default RecommendationService;