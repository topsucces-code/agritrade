import { Types } from 'mongoose';
import { IProduct, IUser, MatchingCriteria, MatchResult, BuyOrder, QualityRequirements } from '../types';
import { User } from '../models/User';
import { Product } from '../models/Product';
import { cache } from '../config/redis';

/**
 * Intelligent Matching Engine for connecting farmers with buyers
 * Uses multi-factor scoring algorithm considering location, quality, price, timing, and reputation
 */
export class MatchingEngine {
  private cachePrefix = 'matching:';
  private defaultCriteria: MatchingCriteria = {
    location: { proximity: 100, weight: 0.3 },
    quality: { minGrade: 'C', scoreRange: [60, 100], weight: 0.25 },
    price: { range: [0, 10000], flexibility: 0.2, weight: 0.2 },
    timing: { deliveryWindow: 30, urgency: 'medium', weight: 0.15 },
    reputation: { minScore: 30, weight: 0.1 }
  };

  /**
   * Find matching products for a buy order
   */
  async findMatches(order: BuyOrder): Promise<MatchResult[]> {
    try {
      const cacheKey = `${this.cachePrefix}buyorder:${order._id}`;
      const cached = await cache.getJSON(cacheKey);
      
      if (cached) {
        return cached as MatchResult[];
      }

      // Step 1: Find candidate products based on basic criteria
      const candidates = await this.findCandidateProducts(order);
      
      // Step 2: Score each candidate against matching criteria
      const scoredMatches = await Promise.all(
        candidates.map(product => this.scoreMatch(order, product))
      );
      
      // Step 3: Filter and sort by score
      const qualifiedMatches = scoredMatches
        .filter(match => match.score >= 0.6) // Minimum threshold
        .sort((a, b) => b.score - a.score)
        .slice(0, 20); // Top 20 matches
      
      // Step 4: Add delivery estimates
      for (const match of qualifiedMatches) {
        match.estimatedDelivery = await this.calculateDeliveryEstimate(order, match.productId);
      }
      
      // Cache results for 30 minutes
      await cache.setJSON(cacheKey, qualifiedMatches, 1800);
      
      return qualifiedMatches;
      
    } catch (error) {
      throw new Error(`Match finding failed: ${error.message}`);
    }
  }

  /**
   * Find matching buyers for a farmer's product
   */
  async findBuyersForProduct(productId: Types.ObjectId): Promise<MatchResult[]> {
    try {
      const product = await Product.findById(productId).populate('farmerId');
      if (!product) {
        throw new Error('Product not found');
      }

      const cacheKey = `${this.cachePrefix}product:${productId}`;
      const cached = await cache.getJSON(cacheKey);
      
      if (cached) {
        return cached as MatchResult[];
      }

      // Find buyers interested in this commodity
      const potentialBuyers = await this.findPotentialBuyers(product);
      
      // Score each buyer
      const scoredMatches = await Promise.all(
        potentialBuyers.map(buyer => this.scoreBuyerMatch(product, buyer))
      );
      
      const qualifiedMatches = scoredMatches
        .filter(match => match.score >= 0.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, 15);
      
      // Cache for 1 hour
      await cache.setJSON(cacheKey, qualifiedMatches, 3600);
      
      return qualifiedMatches;
      
    } catch (error) {
      throw new Error(`Buyer matching failed: ${error.message}`);
    }
  }

  /**
   * Find candidate products based on buy order criteria
   */
  private async findCandidateProducts(order: BuyOrder) {
    const query: any = {
      commodity: order.commodity,
      status: 'available',
      'quantity.available': { $gte: order.quantity.min }
    };

    // Location-based filtering using geospatial query
    if (order.deliveryLocation?.geometry) {
      query['location.geometry'] = {
        $nearSphere: {
          $geometry: order.deliveryLocation.geometry,
          $maxDistance: order.matchingCriteria?.location?.proximity * 1000 || 100000 // Convert km to meters
        }
      };
    }

    // Quality filtering
    if (order.qualityRequirements) {
      const gradeOrder = { 'A+': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1 };
      const minGradeValue = gradeOrder[order.qualityRequirements.minGrade] || 2;
      
      query['qualityAssessment.grade'] = {
        $in: Object.keys(gradeOrder).filter(grade => gradeOrder[grade] >= minGradeValue)
      };
    }

    // Price range filtering
    if (order.priceRange) {
      query['pricing.finalPrice'] = {
        $gte: order.priceRange.min,
        $lte: order.priceRange.max
      };
    }

    return await Product.find(query)
      .populate('farmerId')
      .limit(50)
      .exec();
  }

  /**
   * Find potential buyers for a product
   */
  private async findPotentialBuyers(product: IProduct) {
    const query: any = {
      role: 'buyer',
      'profile.verified': true,
      'authentication.smsVerified': true
    };

    // Location-based query
    if (product.location?.geometry) {
      query['profile.location.geometry'] = {
        $nearSphere: {
          $geometry: product.location.geometry,
          $maxDistance: 200000 // 200km radius
        }
      };
    }

    return await User.find(query)
      .sort({ 'reputation.score': -1 })
      .limit(30)
      .exec();
  }

  /**
   * Score a product match against buy order criteria
   */
  private async scoreMatch(order: BuyOrder, product: IProduct): Promise<MatchResult> {
    const criteria = order.matchingCriteria || this.defaultCriteria;
    
    const scores = {
      location: await this.calculateLocationScore(order.deliveryLocation, product.location, criteria.location),
      quality: this.calculateQualityScore(order.qualityRequirements, product.qualityAssessment, criteria.quality),
      price: this.calculatePriceScore(order.priceRange, product.pricing, criteria.price),
      timing: this.calculateTimingScore(order.deliveryDate, product.createdAt, criteria.timing),
      reputation: await this.calculateReputationScore(product.farmerId, criteria.reputation)
    };

    // Calculate weighted score
    const weightedScore = Object.entries(criteria).reduce((total, [key, config]) => {
      return total + (scores[key] * config.weight);
    }, 0);

    // Calculate confidence based on data quality
    const confidence = this.calculateMatchConfidence(scores, product);

    return {
      productId: product._id,
      farmerId: product.farmerId,
      score: Math.round(weightedScore * 100) / 100,
      breakdown: scores,
      estimatedDelivery: new Date(), // Will be calculated separately
      confidence
    };
  }

  /**
   * Score a buyer match for a product
   */
  private async scoreBuyerMatch(product: IProduct, buyer: IUser): Promise<MatchResult> {
    const scores = {
      location: await this.calculateLocationScore(buyer.profile.location, product.location, { proximity: 200, weight: 0.3 }),
      quality: 0.8, // Assume buyers can handle the quality
      price: 0.8, // Simplified price matching
      timing: 0.7, // Timing flexibility
      reputation: buyer.reputation.score / 100
    };

    const weightedScore = (scores.location * 0.3) + 
                         (scores.quality * 0.2) + 
                         (scores.price * 0.2) + 
                         (scores.timing * 0.15) + 
                         (scores.reputation * 0.15);

    return {
      productId: product._id,
      farmerId: buyer._id, // In this case, it's the buyer ID
      score: Math.round(weightedScore * 100) / 100,
      breakdown: scores,
      estimatedDelivery: new Date(),
      confidence: 0.8
    };
  }

  /**
   * Calculate location compatibility score
   */
  private async calculateLocationScore(
    location1: any, 
    location2: any, 
    criteria: { proximity: number; weight: number }
  ): Promise<number> {
    if (!location1 || !location2) return 0.5;

    // Calculate distance using Haversine formula
    const distance = this.calculateDistance(
      location1.coordinates || location1.coordinates,
      location2.coordinates || location2.coordinates
    );

    // Score based on proximity preference
    if (distance <= criteria.proximity * 0.5) {
      return 1.0; // Very close
    } else if (distance <= criteria.proximity) {
      return 0.8; // Within preferred range
    } else if (distance <= criteria.proximity * 1.5) {
      return 0.6; // Slightly beyond preference
    } else if (distance <= criteria.proximity * 2) {
      return 0.4; // Far but manageable
    } else {
      return 0.2; // Very far
    }
  }

  /**
   * Calculate quality compatibility score
   */
  private calculateQualityScore(
    requirements: QualityRequirements | undefined,
    assessment: any,
    criteria: any
  ): number {
    if (!requirements || !assessment) return 0.7;

    let score = 0.5;

    // Grade matching
    const gradeOrder = { 'A+': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1 };
    const requiredGrade = gradeOrder[requirements.minGrade] || 2;
    const productGrade = gradeOrder[assessment.grade] || 1;
    
    if (productGrade >= requiredGrade) {
      score += 0.3;
      // Bonus for exceeding requirements
      if (productGrade > requiredGrade) {
        score += (productGrade - requiredGrade) * 0.1;
      }
    }

    // Overall score matching
    if (assessment.overallScore >= criteria.scoreRange[0]) {
      score += 0.2;
      if (assessment.overallScore >= criteria.scoreRange[1] * 0.9) {
        score += 0.1;
      }
    }

    // Certification matching
    if (requirements.certificationRequired?.length > 0) {
      // This would check against product certifications
      score += 0.1; // Simplified
    }

    return Math.min(1.0, score);
  }

  /**
   * Calculate price compatibility score
   */
  private calculatePriceScore(
    priceRange: any,
    pricing: any,
    criteria: any
  ): number {
    if (!priceRange || !pricing) return 0.7;

    const productPrice = pricing.finalPrice;
    const { min, max } = priceRange;
    
    if (productPrice >= min && productPrice <= max) {
      // Perfect match within range
      const position = (productPrice - min) / (max - min);
      // Prefer prices closer to target (middle of range)
      return 1.0 - Math.abs(0.5 - position) * 0.4;
    }
    
    // Outside range but within flexibility
    const flexibility = criteria.flexibility || 0.2;
    const flexibleMin = min * (1 - flexibility);
    const flexibleMax = max * (1 + flexibility);
    
    if (productPrice >= flexibleMin && productPrice <= flexibleMax) {
      return 0.6; // Acceptable with flexibility
    }
    
    return 0.2; // Poor price match
  }

  /**
   * Calculate timing compatibility score
   */
  private calculateTimingScore(
    deliveryDate: any,
    productDate: Date,
    criteria: any
  ): number {
    if (!deliveryDate) return 0.7;

    const now = new Date();
    const earliest = deliveryDate.earliest || now;
    const latest = deliveryDate.latest || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // Product availability (how fresh/recently harvested)
    const daysSinceHarvest = (now.getTime() - productDate.getTime()) / (1000 * 60 * 60 * 24);
    let freshnessScore = 1.0;
    if (daysSinceHarvest > 30) {
      freshnessScore = Math.max(0.5, 1.0 - (daysSinceHarvest - 30) / 60);
    }

    // Delivery window compatibility
    const deliveryWindow = criteria.deliveryWindow || 30; // days
    const windowScore = Math.min(1.0, deliveryWindow / 30);

    // Urgency factor
    const urgencyMultiplier = {
      'low': 0.8,
      'medium': 1.0,
      'high': 1.2
    };
    
    return Math.min(1.0, (freshnessScore + windowScore) / 2 * urgencyMultiplier[criteria.urgency || 'medium']);
  }

  /**
   * Calculate reputation score
   */
  private async calculateReputationScore(
    userId: Types.ObjectId,
    criteria: { minScore: number; weight: number }
  ): Promise<number> {
    try {
      const user = await User.findById(userId);
      if (!user) return 0.3;

      const reputationScore = user.reputation.score / 100;
      
      // Meet minimum requirement
      if (user.reputation.score < criteria.minScore) {
        return reputationScore * 0.5; // Penalty for not meeting minimum
      }

      // Bonus for high reputation
      if (user.reputation.score > 80) {
        return Math.min(1.0, reputationScore + 0.1);
      }

      return reputationScore;
      
    } catch (error) {
      return 0.5; // Default if unable to fetch
    }
  }

  /**
   * Calculate match confidence
   */
  private calculateMatchConfidence(scores: any, product: IProduct): number {
    let confidence = 0.7; // Base confidence

    // Higher confidence for products with complete data
    if (product.qualityAssessment?.confidence > 0.8) confidence += 0.1;
    if (product.pricing?.finalPrice > 0) confidence += 0.05;
    if (product.location?.coordinates) confidence += 0.05;
    
    // Lower confidence for very new or old products
    const daysSinceCreated = (Date.now() - product.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated > 60) confidence -= 0.1;
    if (daysSinceCreated < 1) confidence -= 0.05;

    // Confidence based on score distribution
    const scoreVariance = Object.values(scores).reduce((variance, score) => {
      return variance + Math.pow(score - 0.7, 2);
    }, 0) / Object.keys(scores).length;
    
    confidence -= scoreVariance * 0.2;

    return Math.max(0.3, Math.min(1.0, confidence));
  }

  /**
   * Calculate delivery estimate
   */
  private async calculateDeliveryEstimate(order: BuyOrder, productId: Types.ObjectId): Promise<Date> {
    // Simplified delivery estimation
    // In a real system, this would consider logistics, distance, transportation options
    
    const baseDays = 3; // Base processing time
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + baseDays);
    
    return deliveryDate;
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(coords1: { latitude: number; longitude: number }, coords2: { latitude: number; longitude: number }): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(coords2.latitude - coords1.latitude);
    const dLon = this.toRadians(coords2.longitude - coords1.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(coords1.latitude)) * Math.cos(this.toRadians(coords2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get matching statistics
   */
  async getMatchingStats() {
    try {
      const [productCount, buyerCount, recentMatches] = await Promise.all([
        Product.countDocuments({ status: 'available' }),
        User.countDocuments({ role: 'buyer', 'profile.verified': true }),
        this.getRecentMatchingActivity()
      ]);

      return {
        availableProducts: productCount,
        activeBuyers: buyerCount,
        recentMatches,
        averageMatchScore: 0.75, // Would calculate from actual data
        successRate: 0.68 // Would calculate from completed transactions
      };
    } catch (error) {
      throw new Error(`Failed to get matching stats: ${error.message}`);
    }
  }

  private async getRecentMatchingActivity() {
    // This would query actual matching logs
    return {
      last24Hours: 45,
      last7Days: 280,
      last30Days: 1150
    };
  }
}

export default MatchingEngine;