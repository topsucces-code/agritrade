import { AdvancedPricingEngine } from '../services/AdvancedPricingEngine';
import { MarketDataService } from '../services/marketDataService';
import { WeatherService } from '../services/externalApiService';
import { MarketConditions, BuyerProfile } from '../services/AdvancedPricingEngine';

// Mock external services
jest.mock('../services/marketDataService');
jest.mock('../services/externalApiService');

describe('AdvancedPricingEngine', () => {
  let pricingEngine: AdvancedPricingEngine;
  let mockMarketDataService: jest.Mocked<MarketDataService>;
  let mockWeatherService: jest.Mocked<WeatherService>;
  let sampleProduct: any;
  let sampleMarketConditions: MarketConditions;
  let sampleBuyerProfile: BuyerProfile;

  beforeEach(() => {
    // Create mock services
    mockMarketDataService = {
      getCurrentWeather: jest.fn(),
      getWeatherForecast: jest.fn(),
      getMarketPrices: jest.fn(),
      getSupplyDemandData: jest.fn()
    } as any;

    mockWeatherService = {
      getCurrentWeather: jest.fn(),
      getWeatherForecast: jest.fn(),
      getClimateData: jest.fn()
    } as any;

    // Initialize pricing engine
    pricingEngine = new AdvancedPricingEngine(mockMarketDataService, mockWeatherService);

    // Sample product data
    sampleProduct = {
      _id: 'product123',
      farmerId: 'farmer123',
      commodity: 'cocoa',
      quantity: {
        available: 1000,
        reserved: 0,
        sold: 0,
        unit: 'kg'
      },
      qualityAssessment: {
        overallScore: 85,
        grade: 'A',
        confidence: 0.9,
        detailedMetrics: {
          beanSizeUniformity: 88,
          colorConsistency: 85,
          moistureContent: 7.2,
          defectCount: 2
        }
      },
      location: {
        coordinates: [-0.2057, 5.5600], // Accra, Ghana
        country: 'Ghana',
        region: 'Greater Accra'
      },
      harvest: {
        date: new Date('2024-01-15'),
        season: 'main',
        processingMethod: 'fermented'
      },
      certifications: {
        organic: { certified: true, expiryDate: new Date('2025-01-01') },
        fairTrade: { certified: false },
        rainforestAlliance: { certified: true, expiryDate: new Date('2024-12-01') }
      },
      logistics: {
        packagingType: 'jute_bags',
        packagesCount: 20,
        weightPerPackage: 50
      }
    };

    // Sample market conditions
    sampleMarketConditions = {
      commodity: 'cocoa',
      region: 'West Africa',
      country: 'Ghana',
      supplyLevel: 'medium',
      demandLevel: 'high',
      seasonalFactor: 1.15,
      weatherImpact: 0.08,
      globalPrices: {
        current: 2400,
        trend: 'rising',
        volatility: 0.12,
        historicalData: []
      },
      localMarketData: {
        averagePrice: 2200,
        priceRange: { min: 1900, max: 2600 },
        tradingVolume: 1200,
        competitorCount: 8,
        marketShare: 0.12
      },
      economicIndicators: {
        exchangeRate: 12.5,
        inflation: 8.2,
        gdpGrowth: 3.8,
        agriculturalIndex: 112
      }
    };

    // Sample buyer profile
    sampleBuyerProfile = {
      _id: 'buyer123',
      buyerType: 'processor',
      location: {
        coordinates: [-0.1870, 5.6037],
        region: 'Greater Accra',
        country: 'Ghana'
      },
      orderVolume: 500,
      deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      paymentTerms: 'net30',
      reputation: {
        score: 88,
        transactionHistory: 45
      },
      preferences: {
        qualityGrades: ['A+', 'A'],
        certifications: ['organic', 'fairtrade'],
        maxPrice: 2800
      }
    };

    // Mock weather service responses
    mockWeatherService.getCurrentWeather.mockResolvedValue({
      temperature: 28,
      humidity: 75,
      precipitation: 2.5,
      windSpeed: 12
    });

    mockWeatherService.getWeatherForecast.mockResolvedValue(
      Array(30).fill(null).map((_, i) => ({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
        temperature: 26 + Math.random() * 6,
        humidity: 70 + Math.random() * 20,
        precipitation: Math.random() * 10
      }))
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Price Calculation', () => {
    it('should calculate comprehensive price estimate', async () => {
      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        sampleMarketConditions,
        sampleBuyerProfile
      );

      expect(result).toHaveProperty('basePrice');
      expect(result).toHaveProperty('adjustedPrice');
      expect(result).toHaveProperty('priceRange');
      expect(result).toHaveProperty('factors');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('recommendations');

      expect(result.basePrice).toBeGreaterThan(0);
      expect(result.adjustedPrice).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should apply quality multiplier correctly for high-grade products', async () => {
      const highGradeProduct = {
        ...sampleProduct,
        qualityAssessment: {
          overallScore: 95,
          grade: 'A+',
          confidence: 0.95
        }
      };

      const result = await pricingEngine.calculatePrice(
        highGradeProduct,
        sampleMarketConditions,
        sampleBuyerProfile
      );

      expect(result.factors.qualityMultiplier).toBeGreaterThan(1.2);
      expect(result.adjustedPrice).toBeGreaterThan(result.basePrice * 1.2);
    });

    it('should apply quality penalty for low-grade products', async () => {
      const lowGradeProduct = {
        ...sampleProduct,
        qualityAssessment: {
          overallScore: 55,
          grade: 'D',
          confidence: 0.7
        }
      };

      const result = await pricingEngine.calculatePrice(
        lowGradeProduct,
        sampleMarketConditions
      );

      expect(result.factors.qualityMultiplier).toBeLessThan(1.0);
      expect(result.adjustedPrice).toBeLessThan(result.basePrice);
    });

    it('should consider market demand in pricing', async () => {
      const highDemandMarket = {
        ...sampleMarketConditions,
        demandLevel: 'high' as const,
        supplyLevel: 'low' as const
      };

      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        highDemandMarket
      );

      expect(result.factors.marketDemand).toBeGreaterThan(1.0);
    });

    it('should apply seasonal adjustments', async () => {
      const peakSeasonMarket = {
        ...sampleMarketConditions,
        seasonalFactor: 1.3 // Peak season
      };

      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        peakSeasonMarket
      );

      expect(result.factors.seasonalAdjustment).toBeGreaterThan(1.0);
    });

    it('should factor in weather impact', async () => {
      const adverseWeatherMarket = {
        ...sampleMarketConditions,
        weatherImpact: 0.15 // Positive weather impact
      };

      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        adverseWeatherMarket
      );

      expect(result.factors.weatherImpact).toBeGreaterThan(0);
    });
  });

  describe('Buyer-Specific Pricing', () => {
    it('should apply urgency factor for quick delivery', async () => {
      const urgentBuyer = {
        ...sampleBuyerProfile,
        deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days
      };

      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        sampleMarketConditions,
        urgentBuyer
      );

      expect(result.factors.urgencyFactor).toBeGreaterThan(1.0);
    });

    it('should apply volume discount for large orders', async () => {
      const largeBuyer = {
        ...sampleBuyerProfile,
        orderVolume: 900 // 90% of available quantity
      };

      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        sampleMarketConditions,
        largeBuyer
      );

      expect(result.factors.volumeDiscount).toBeGreaterThan(0);
    });

    it('should consider buyer reputation in pricing', async () => {
      const highReputationBuyer = {
        ...sampleBuyerProfile,
        reputation: {
          score: 95,
          transactionHistory: 100
        }
      };

      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        sampleMarketConditions,
        highReputationBuyer
      );

      expect(result.factors.reputationAdjustment).toBeGreaterThan(0.95);
    });

    it('should handle buyers without specific preferences', async () => {
      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        sampleMarketConditions
      );

      expect(result).toHaveProperty('adjustedPrice');
      expect(result.factors.urgencyFactor).toBe(1.0);
      expect(result.factors.volumeDiscount).toBe(0);
    });
  });

  describe('Certification Premiums', () => {
    it('should apply organic certification bonus', async () => {
      const organicProduct = {
        ...sampleProduct,
        certifications: {
          organic: { certified: true, expiryDate: new Date('2025-01-01') },
          fairTrade: { certified: false },
          rainforestAlliance: { certified: false }
        }
      };

      const result = await pricingEngine.calculatePrice(
        organicProduct,
        sampleMarketConditions
      );

      expect(result.factors.certificationBonus).toBeGreaterThan(0.1);
    });

    it('should apply multiple certification bonuses', async () => {
      const multiCertifiedProduct = {
        ...sampleProduct,
        certifications: {
          organic: { certified: true, expiryDate: new Date('2025-01-01') },
          fairTrade: { certified: true, expiryDate: new Date('2025-01-01') },
          rainforestAlliance: { certified: true, expiryDate: new Date('2025-01-01') }
        }
      };

      const result = await pricingEngine.calculatePrice(
        multiCertifiedProduct,
        sampleMarketConditions
      );

      expect(result.factors.certificationBonus).toBeGreaterThan(0.3);
    });

    it('should cap certification bonus at maximum', async () => {
      const overCertifiedProduct = {
        ...sampleProduct,
        certifications: {
          organic: { certified: true, expiryDate: new Date('2025-01-01') },
          fairTrade: { certified: true, expiryDate: new Date('2025-01-01') },
          rainforestAlliance: { certified: true, expiryDate: new Date('2025-01-01') },
          customCertifications: [
            { name: 'Custom1', certifier: 'Cert1', issuedDate: new Date(), expiryDate: new Date('2025-01-01') },
            { name: 'Custom2', certifier: 'Cert2', issuedDate: new Date(), expiryDate: new Date('2025-01-01') },
            { name: 'Custom3', certifier: 'Cert3', issuedDate: new Date(), expiryDate: new Date('2025-01-01') }
          ]
        }
      };

      const result = await pricingEngine.calculatePrice(
        overCertifiedProduct,
        sampleMarketConditions
      );

      expect(result.factors.certificationBonus).toBeLessThanOrEqual(0.35);
    });
  });

  describe('Location and Transport Costs', () => {
    it('should apply location premium for distant buyers', async () => {
      const distantBuyer = {
        ...sampleBuyerProfile,
        location: {
          coordinates: [2.3522, 48.8566], // Paris, France
          region: 'Île-de-France',
          country: 'France'
        }
      };

      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        sampleMarketConditions,
        distantBuyer
      );

      expect(result.factors.locationPremium).toBeGreaterThan(0);
    });

    it('should minimize location premium for local buyers', async () => {
      const localBuyer = {
        ...sampleBuyerProfile,
        location: {
          coordinates: [-0.1870, 5.6037], // Same region
          region: 'Greater Accra',
          country: 'Ghana'
        }
      };

      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        sampleMarketConditions,
        localBuyer
      );

      expect(Math.abs(result.factors.locationPremium)).toBeLessThan(0.05);
    });
  });

  describe('Risk Assessment and Adjustments', () => {
    it('should apply risk adjustment for high inflation', async () => {
      const highInflationMarket = {
        ...sampleMarketConditions,
        economicIndicators: {
          ...sampleMarketConditions.economicIndicators,
          inflation: 15.0 // High inflation
        }
      };

      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        highInflationMarket
      );

      expect(result.factors.riskAdjustment).toBeGreaterThan(0);
    });

    it('should apply risk adjustment for high volatility', async () => {
      const volatileMarket = {
        ...sampleMarketConditions,
        globalPrices: {
          ...sampleMarketConditions.globalPrices,
          volatility: 0.4 // High volatility
        }
      };

      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        volatileMarket
      );

      expect(result.factors.riskAdjustment).toBeGreaterThan(0);
    });

    it('should apply minimal risk adjustment for stable conditions', async () => {
      const stableMarket = {
        ...sampleMarketConditions,
        economicIndicators: {
          ...sampleMarketConditions.economicIndicators,
          inflation: 2.0,
          gdpGrowth: 5.0
        },
        globalPrices: {
          ...sampleMarketConditions.globalPrices,
          volatility: 0.05
        }
      };

      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        stableMarket
      );

      expect(result.factors.riskAdjustment).toBeLessThan(0.05);
    });
  });

  describe('Competition and Market Share', () => {
    it('should apply competition adjustment for crowded markets', async () => {
      const competitiveMarket = {
        ...sampleMarketConditions,
        localMarketData: {
          ...sampleMarketConditions.localMarketData,
          competitorCount: 25,
          marketShare: 0.03
        }
      };

      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        competitiveMarket
      );

      expect(result.factors.competitionLevel).toBeGreaterThan(0.1);
    });

    it('should minimize competition effect in less crowded markets', async () => {
      const lessCompetitiveMarket = {
        ...sampleMarketConditions,
        localMarketData: {
          ...sampleMarketConditions.localMarketData,
          competitorCount: 3,
          marketShare: 0.25
        }
      };

      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        lessCompetitiveMarket
      );

      expect(result.factors.competitionLevel).toBeLessThan(0.05);
    });
  });

  describe('Price Range and Negotiation', () => {
    it('should provide realistic price range for negotiation', async () => {
      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        sampleMarketConditions,
        sampleBuyerProfile
      );

      expect(result.priceRange.minimum).toBeLessThan(result.adjustedPrice);
      expect(result.priceRange.maximum).toBeGreaterThan(result.adjustedPrice);
      expect(result.priceRange.recommended).toBe(result.adjustedPrice);

      const range = result.priceRange.maximum - result.priceRange.minimum;
      expect(range).toBeGreaterThan(result.adjustedPrice * 0.1); // At least 10% range
      expect(range).toBeLessThan(result.adjustedPrice * 0.5); // Not more than 50% range
    });

    it('should adjust price range based on market volatility', async () => {
      const volatileMarket = {
        ...sampleMarketConditions,
        globalPrices: {
          ...sampleMarketConditions.globalPrices,
          volatility: 0.3
        }
      };

      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        volatileMarket
      );

      const range = result.priceRange.maximum - result.priceRange.minimum;
      const rangePercentage = range / result.adjustedPrice;

      expect(rangePercentage).toBeGreaterThan(0.2); // Wider range for volatile markets
    });
  });

  describe('Sustainability and Processing Premiums', () => {
    it('should apply sustainability bonus for eco-friendly practices', async () => {
      const sustainableProduct = {
        ...sampleProduct,
        harvest: {
          ...sampleProduct.harvest,
          processingMethod: 'organic'
        },
        location: {
          ...sampleProduct.location,
          farm: {
            name: 'Eco Farm',
            size: 3 // Small-scale farming
          }
        }
      };

      const result = await pricingEngine.calculatePrice(
        sustainableProduct,
        sampleMarketConditions
      );

      expect(result.factors.sustainabilityBonus).toBeGreaterThan(0);
    });

    it('should apply processing premium for value-added products', async () => {
      const processedProduct = {
        ...sampleProduct,
        harvest: {
          ...sampleProduct.harvest,
          processingMethod: 'washed',
          dryingMethod: 'sun_dried'
        },
        logistics: {
          ...sampleProduct.logistics,
          packagingType: 'premium'
        }
      };

      const result = await pricingEngine.calculatePrice(
        processedProduct,
        sampleMarketConditions
      );

      expect(result.factors.processingPremium).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing buyer profile gracefully', async () => {
      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        sampleMarketConditions
      );

      expect(result).toHaveProperty('adjustedPrice');
      expect(result.factors.urgencyFactor).toBe(1.0);
      expect(result.factors.volumeDiscount).toBe(0);
    });

    it('should handle incomplete market conditions', async () => {
      const incompleteMarket = {
        ...sampleMarketConditions,
        economicIndicators: undefined
      } as any;

      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        incompleteMarket
      );

      expect(result).toHaveProperty('adjustedPrice');
      expect(result.adjustedPrice).toBeGreaterThan(0);
    });

    it('should handle weather service failures', async () => {
      mockWeatherService.getCurrentWeather.mockRejectedValue(new Error('Weather service unavailable'));
      mockWeatherService.getWeatherForecast.mockRejectedValue(new Error('Weather service unavailable'));

      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        sampleMarketConditions,
        sampleBuyerProfile
      );

      expect(result).toHaveProperty('adjustedPrice');
      expect(result.factors.weatherImpact).toBe(0); // Should default to 0 on service failure
    });

    it('should validate pricing factors are within reasonable ranges', async () => {
      const result = await pricingEngine.calculatePrice(
        sampleProduct,
        sampleMarketConditions,
        sampleBuyerProfile
      );

      // Validate all factors are within reasonable ranges
      expect(result.factors.qualityMultiplier).toBeGreaterThan(0.5);
      expect(result.factors.qualityMultiplier).toBeLessThan(2.0);
      expect(result.factors.marketDemand).toBeGreaterThan(0.5);
      expect(result.factors.marketDemand).toBeLessThan(2.0);
      expect(result.factors.certificationBonus).toBeGreaterThanOrEqual(0);
      expect(result.factors.certificationBonus).toBeLessThanOrEqual(0.35);
    });
  });

  describe('Performance and Reliability', () => {
    it('should complete pricing calculation within reasonable time', async () => {
      const startTime = Date.now();
      
      await pricingEngine.calculatePrice(
        sampleProduct,
        sampleMarketConditions,
        sampleBuyerProfile
      );
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should produce consistent results for identical inputs', async () => {
      const result1 = await pricingEngine.calculatePrice(
        sampleProduct,
        sampleMarketConditions,
        sampleBuyerProfile
      );
      
      const result2 = await pricingEngine.calculatePrice(
        sampleProduct,
        sampleMarketConditions,
        sampleBuyerProfile
      );

      expect(result1.adjustedPrice).toBeCloseTo(result2.adjustedPrice, 2);
      expect(result1.factors.qualityMultiplier).toBeCloseTo(result2.factors.qualityMultiplier, 3);
    });

    it('should handle concurrent pricing requests', async () => {
      const promises = Array(10).fill(null).map(() =>
        pricingEngine.calculatePrice(sampleProduct, sampleMarketConditions, sampleBuyerProfile)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toHaveProperty('adjustedPrice');
        expect(result.adjustedPrice).toBeGreaterThan(0);
      });
    });
  });
});