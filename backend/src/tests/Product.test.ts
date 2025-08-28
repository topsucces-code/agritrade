import { Product } from '../models/Product';
import { IProduct, QualityMetrics, ILocation } from '../types';

/**
 * Test file for Product model
 * This tests the TypeScript types and basic functionality
 */

// Example test data (kept for reference but not used in the main test)
const sampleLocation: ILocation = {
  country: 'Côte d\'Ivoire',
  region: 'Sud-Comoé',
  city: 'Aboisso',
  coordinates: {
    latitude: 5.4667,
    longitude: -3.2067
  },
  address: 'Plantation Road, Aboisso'
};

const sampleQualityMetrics: QualityMetrics = {
  // Cocoa-specific metrics
  beanSizeUniformity: 85,
  colorConsistency: 88,
  moistureContent: 7.2,
  defectCount: 3,
  shellToBeanRatio: 12.5,
  
  // Common metrics
  overallAppearance: 89,
  processingQuality: 92,
  storageCondition: 88,
  
  // AI Analysis metadata
  analysisConfidence: 0.94,
  imageQuality: 85,
  processingTime: 2.3
};

// Test function to create a sample product
export async function createSampleProduct(farmerId: string): Promise<IProduct> {
  try {
    const productData = {
      farmerId,
      commodity: 'cocoa' as const,
      variety: 'Trinitario',
      quantity: {
        available: 500,
        reserved: 0,
        sold: 0,
        unit: 'kg' as const,
        measurementDate: new Date()
      },
      qualityAssessment: {
        overallScore: 89,
        grade: 'A' as const,
        confidence: 0.94,
        analysisDate: new Date(),
        imageUrls: [
          'https://example.com/cocoa1.jpg',
          'https://example.com/cocoa2.jpg'
        ],
        detailedMetrics: {
          beanSize: 85,
          colorConsistency: 88,
          moistureContent: 7.2,
          defectCount: 3,
          uniformity: 92
        },
        recommendations: ['Maintain current storage conditions', 'Consider premium market positioning'],
        validityPeriod: 7
      },
      pricing: {
        basePrice: 2.5,
        currency: 'USD',
        pricePerUnit: 2.5,
        qualityMultiplier: 1.1,
        marketAdjustment: 0.1,
        finalPrice: 2.75,
        priceHistory: [{
          date: new Date(),
          price: 2.5,
          reason: 'Initial listing'
        }],
        negotiable: true,
        minimumOrder: 50
      },
      location: {
        coordinates: [-3.2067, 5.4667], // [longitude, latitude]
        address: 'Plantation Road, Aboisso',
        region: 'Sud-Comoé',
        country: 'Côte d\'Ivoire',
        farm: {
          name: 'Premium Cocoa Farm',
          size: 15.5,
          coordinates: {
            type: 'Polygon',
            coordinates: [[[
              [-3.2067, 5.4667],
              [-3.2077, 5.4667],
              [-3.2077, 5.4677],
              [-3.2067, 5.4677],
              [-3.2067, 5.4667]
            ]]]
          }
        },
        harvestRegion: 'Sud-Comoé',
        proximityToPorts: 85
      },
      harvestDate: new Date('2024-01-15'),
      status: 'available' as const,
      certifications: {
        organic: {
          certified: true,
          certifier: 'ECOCERT',
          expiryDate: new Date('2025-01-15')
        },
        fairTrade: {
          certified: true,
          certifier: 'FLO-CERT',
          expiryDate: new Date('2025-01-15')
        },
        rainforestAlliance: {
          certified: false
        },
        customCertifications: []
      },
      storageConditions: {
        temperature: 22,
        humidity: 60,
        duration: 45,
        facility: 'modern',
        qualityMaintained: true
      },
      logistics: {
        packagingType: 'Jute bags',
        packagesCount: 10,
        weightPerPackage: 50,
        pickupAvailability: [new Date(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)],
        deliveryOptions: ['pickup', 'local_delivery'],
        transportationCost: 25
      },
      marketData: {
        demandScore: 85,
        seasonalityFactor: 1.2,
        competitivePrice: 2.6,
        marketTrend: 'rising' as const
      }
    };

    const product = new Product(productData);
    return await product.save();
  } catch (error) {
    console.error('Error creating sample product:', error);
    throw error;
  }
}

// Test function to validate product methods
export function testProductMethods(product: IProduct): void {
  try {
    // Test instance methods
    console.log('Product is available:', product.isAvailable());
    console.log('Total value:', product.getTotalValue());
    console.log('Price in EUR:', product.getPriceInCurrency('EUR'));
    
    // Test quality summary and access its properties
    const qualitySummary = product.getQualitySummary();
    console.log('Quality summary:', qualitySummary);
    console.log('Quality strengths:', qualitySummary.strengths);
    console.log('Quality improvements:', qualitySummary.improvements);
    
    // Test market position
    const marketPosition = product.calculateMarketPosition();
    console.log('Market position:', marketPosition);
    
    // Test actual properties from the interface
    console.log('Product status:', product.status);
    console.log('Created at:', product.createdAt);
    
    console.log('✅ All product methods work correctly');
  } catch (error) {
    console.error('❌ Error testing product methods:', error);
    throw error;
  }
}

// Test function for static methods
export async function testStaticMethods(): Promise<void> {
  try {
    // Test static methods
    const cocoaProducts = await Product.findByTypeAndLocation('cocoa', 'Côte d\'Ivoire');
    console.log('Found cocoa products:', cocoaProducts.length);
    
    const nearbyProducts = await Product.findNearLocation(-3.2067, 5.4667, 50);
    console.log('Found nearby products:', nearbyProducts.length);
    
    const searchResults = await Product.searchProducts('premium cocoa', {
      type: 'cocoa',
      grade: 'A'
    });
    console.log('Search results:', searchResults.length);
    
    console.log('✅ All static methods work correctly');
  } catch (error) {
    console.error('❌ Error testing static methods:', error);
    throw error;
  }
}

// Comprehensive test function
export async function runProductTests(farmerId: string): Promise<void> {
  try {
    console.log('🧪 Starting Product model tests...');
    
    // Create a sample product
    const product = await createSampleProduct(farmerId);
    console.log('✅ Product created successfully:', product._id);
    
    // Test instance methods
    testProductMethods(product);
    
    // Test static methods
    await testStaticMethods();
    
    console.log('🎉 All Product model tests passed!');
  } catch (error) {
    console.error('💥 Product model tests failed:', error);
    throw error;
  }
}

// Example usage function
export async function exampleUsage(): Promise<void> {
  try {
    // This would typically come from authentication
    const farmerId = '65a1b2c3d4e5f6789abcdef0'; // Example ObjectId
    
    await runProductTests(farmerId);
  } catch (error) {
    console.error('Example usage failed:', error);
  }
}

// Export for external testing
export {
  sampleLocation,
  sampleQualityMetrics
};