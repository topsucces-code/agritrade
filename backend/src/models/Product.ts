import mongoose, { Schema, Model, Types } from 'mongoose';
import { IProduct, QualityMetrics, ILocation } from '../types';

// Enhanced Product Model Interface with static methods
interface IProductModel extends Model<IProduct> {
  findByTypeAndLocation(
    type: string,
    country: string,
    region?: string
  ): Promise<IProduct[]>;
  
  findNearLocation(
    longitude: number,
    latitude: number,
    radiusKm?: number
  ): Promise<IProduct[]>;
  
  searchProducts(
    searchText: string,
    filters?: {
      type?: string;
      grade?: string;
      minPrice?: number;
      maxPrice?: number;
      country?: string;
      region?: string;
    }
  ): Promise<IProduct[]>;
  
  findByQualityGrade(grade: string): Promise<IProduct[]>;
  findExpiringSoon(days?: number): Promise<IProduct[]>;
  getMarketAnalytics(commodity: string, region: string): Promise<any>;
}

// Enhanced Location Schema with farm details
const FarmLocationSchema = new Schema({
  coordinates: {
    type: [Number], // [longitude, latitude]
    required: true,
    validate: {
      validator: function(v: number[]) {
        return v.length === 2 && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90;
      },
      message: 'Coordinates must be [longitude, latitude] with valid ranges'
    }
  },
  address: { type: String, required: true },
  region: { type: String, required: true },
  country: { type: String, required: true },
  farm: {
    name: { type: String, required: true },
    size: { type: Number, required: true, min: 0 }, // hectares
    coordinates: {
      type: {
        type: String,
        enum: ['Polygon'],
        required: true
      },
      coordinates: {
        type: [[[Number]]], // GeoJSON Polygon
        required: true
      }
    }
  },
  harvestRegion: { type: String, required: true },
  proximityToPorts: { type: Number, default: 0 } // km
});

// Quantity Schema with enhanced tracking
const QuantitySchema = new Schema({
  available: { type: Number, required: true, min: 0 },
  reserved: { type: Number, default: 0, min: 0 },
  sold: { type: Number, default: 0, min: 0 },
  unit: {
    type: String,
    required: true,
    enum: ['kg', 'tons', 'bags', 'sacks']
  },
  measurementDate: { type: Date, default: Date.now }
});

// Enhanced Quality Assessment Schema
const QualityAssessmentSchema = new Schema({
  overallScore: { type: Number, required: true, min: 0, max: 100 },
  grade: {
    type: String,
    required: true,
    enum: ['A+', 'A', 'B', 'C', 'D']
  },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  analysisDate: { type: Date, default: Date.now },
  analysisId: { type: Schema.Types.ObjectId, ref: 'QualityAnalysis' },
  imageUrls: [{ type: String }],
  detailedMetrics: {
    beanSize: { type: Number, min: 0, max: 100 },
    colorConsistency: { type: Number, min: 0, max: 100 },
    moistureContent: { type: Number, min: 0, max: 100 },
    defectCount: { type: Number, min: 0 },
    uniformity: { type: Number, min: 0, max: 100 }
  },
  recommendations: [{ type: String }],
  validityPeriod: { type: Number, default: 7 } // days
});

// Pricing Schema with market intelligence
const PricingSchema = new Schema({
  basePrice: { type: Number, required: true, min: 0 },
  currency: {
    type: String,
    required: true,
    enum: ['XOF', 'GHS', 'NGN', 'USD', 'EUR']
  },
  pricePerUnit: { type: Number, required: true, min: 0 },
  qualityMultiplier: { type: Number, default: 1.0 },
  marketAdjustment: { type: Number, default: 0 },
  finalPrice: { type: Number, required: true, min: 0 },
  priceHistory: [{
    date: { type: Date, default: Date.now },
    price: { type: Number, required: true },
    reason: { type: String }
  }],
  negotiable: { type: Boolean, default: true },
  minimumOrder: { type: Number, default: 0 }
});

// Harvest Information Schema
const HarvestSchema = new Schema({
  date: { type: Date, required: true },
  season: {
    type: String,
    enum: ['main', 'secondary'],
    required: true
  },
  processingMethod: { type: String, required: true },
  dryingMethod: { type: String, required: true },
  storageConditions: {
    temperature: { type: Number },
    humidity: { type: Number },
    duration: { type: Number }, // days since harvest
    facility: {
      type: String,
      enum: ['traditional', 'modern', 'cooperative'],
      default: 'traditional'
    }
  }
});

// Certifications Schema
const CertificationsSchema = new Schema({
  organic: {
    certified: { type: Boolean, default: false },
    certifier: { type: String },
    expiryDate: { type: Date }
  },
  fairTrade: {
    certified: { type: Boolean, default: false },
    certifier: { type: String },
    expiryDate: { type: Date }
  },
  rainforestAlliance: {
    certified: { type: Boolean, default: false },
    certifier: { type: String },
    expiryDate: { type: Date }
  },
  customCertifications: [{
    name: { type: String, required: true },
    certifier: { type: String, required: true },
    issuedDate: { type: Date, required: true },
    expiryDate: { type: Date }
  }]
});

// Logistics Schema
const LogisticsSchema = new Schema({
  packagingType: { type: String, required: true },
  packagesCount: { type: Number, required: true, min: 1 },
  weightPerPackage: { type: Number, required: true, min: 0 },
  pickupAvailability: [{ type: Date }],
  deliveryOptions: [{ type: String }],
  transportationCost: { type: Number, default: 0 }
});

// Market Information Schema
const MarketSchema = new Schema({
  status: {
    type: String,
    enum: ['available', 'reserved', 'sold', 'processing', 'quality_check'],
    default: 'available'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'restricted'],
    default: 'public'
  },
  targetBuyers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  promoted: { type: Boolean, default: false },
  listingDate: { type: Date, default: Date.now },
  expiryDate: { type: Date, required: true }
});

// Analytics Schema
const AnalyticsSchema = new Schema({
  views: { type: Number, default: 0 },
  inquiries: { type: Number, default: 0 },
  favorites: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  conversionRate: { type: Number, default: 0 }
});

// Metadata Schema
const MetadataSchema = new Schema({
  version: { type: Number, default: 1 },
  tags: [{ type: String }],
  notes: { type: String }
});

// Enhanced Product Schema with comprehensive design
const ProductSchema = new Schema<IProduct>({
  farmerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  commodity: {
    type: String,
    required: true,
    enum: ['cocoa', 'coffee', 'cotton', 'maize', 'rice', 'peanuts', 'cashew', 'palm_oil']
  },
  variety: {
    type: String,
    trim: true,
    maxlength: 50
  },
  quantity: {
    type: QuantitySchema,
    required: true
  },
  qualityAssessment: {
    type: QualityAssessmentSchema,
    required: true
  },
  pricing: {
    type: PricingSchema,
    required: true
  },
  location: {
    type: FarmLocationSchema,
    required: true
  },
  harvestDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['available', 'reserved', 'sold', 'processing'],
    default: 'available'
  },
  certifications: {
    type: CertificationsSchema,
    default: {}
  },
  storageConditions: {
    temperature: { type: Number },
    humidity: { type: Number },
    duration: { type: Number },
    facility: { type: String },
    qualityMaintained: { type: Boolean, default: true }
  },
  logistics: {
    type: LogisticsSchema,
    required: true
  },
  marketData: {
    demandScore: { type: Number, default: 50 },
    seasonalityFactor: { type: Number, default: 1.0 },
    competitivePrice: { type: Number, default: 0 },
    marketTrend: { type: String, enum: ['rising', 'falling', 'stable'], default: 'stable' }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Enhanced indexes for performance
ProductSchema.index({ farmerId: 1 });
ProductSchema.index({ commodity: 1 });
ProductSchema.index({ 'market.status': 1 });
ProductSchema.index({ 'market.listingDate': 1, 'market.expiryDate': 1 });
ProductSchema.index({ 'location.country': 1, 'location.region': 1 });
ProductSchema.index({ 'pricing.finalPrice': 1 });
ProductSchema.index({ 'qualityAssessment.grade': 1 });
ProductSchema.index({ 'qualityAssessment.overallScore': -1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ 'quantity.available': 1 });
ProductSchema.index({ 'certifications.organic.certified': 1 });
ProductSchema.index({ 'certifications.fairTrade.certified': 1 });

// Compound indexes for common queries
ProductSchema.index({ commodity: 1, 'market.status': 1 });
ProductSchema.index({ commodity: 1, 'location.country': 1, 'market.status': 1 });
ProductSchema.index({ farmerId: 1, 'market.status': 1, createdAt: -1 });
ProductSchema.index({ 
  commodity: 1, 
  'qualityAssessment.grade': 1, 
  'pricing.finalPrice': 1, 
  'market.status': 1 
});
ProductSchema.index({
  'location.country': 1,
  'location.region': 1,
  commodity: 1,
  'market.status': 1
});

// Text index for search functionality
ProductSchema.index({
  variety: 'text',
  'metadata.tags': 'text',
  'metadata.notes': 'text'
}, {
  weights: {
    variety: 10,
    'metadata.tags': 5,
    'metadata.notes': 1
  }
});

// Geospatial index for location-based queries
ProductSchema.index({ 'location.coordinates': '2dsphere' });
ProductSchema.index({ 'location.farm.coordinates': '2dsphere' });

// Pre-save middleware to validate dates
ProductSchema.pre('save', function(this: IProduct, next) {
  const now = new Date();
  
  // Check if harvest date is not too far in the past (1 year)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  if (this.harvestDate < oneYearAgo) {
    return next(new Error('Harvest date cannot be more than 1 year ago'));
  }

  next();
});

// Pre-save middleware to update status based on availability
ProductSchema.pre('save', function(this: IProduct, next) {
  // Status validation logic can be added here
  next();
});

// Pre-save middleware to validate quality metrics
ProductSchema.pre('save', function(this: IProduct, next) {
  const assessment = this.qualityAssessment;
  
  // Calculate overall score based on individual metrics if not provided
  if (!assessment.overallScore || assessment.overallScore === 0) {
    const metrics = assessment.detailedMetrics;
    const weightedScore = (
      (metrics.colorConsistency || 80) * 0.3 +
      (100 - (metrics.defectCount || 5)) * 0.3 +
      (metrics.colorConsistency || 75) * 0.2 +
      (metrics.beanSizeUniformity || 75) * 0.2
    );
    
    assessment.overallScore = Math.round(weightedScore);
  }

  // Determine grade based on overall score
  if (assessment.overallScore >= 85) {
    assessment.grade = 'A+';
  } else if (assessment.overallScore >= 75) {
    assessment.grade = 'A';
  } else if (assessment.overallScore >= 65) {
    assessment.grade = 'B';
  } else if (assessment.overallScore >= 55) {
    assessment.grade = 'C';
  } else {
    assessment.grade = 'D';
  }

  next();
});

// Static method to find products by type and location
ProductSchema.statics.findByTypeAndLocation = function(
  type: string, 
  country: string, 
  region?: string
) {
  const query: any = {
    commodity: type,
    'location.country': country,
    status: 'available'
  };
  
  if (region) {
    query['location.region'] = region;
  }
  
  return this.find(query).populate('farmerId', 'profile.name');
};

// Static method to find products within a radius
ProductSchema.statics.findNearLocation = function(
  longitude: number,
  latitude: number,
  radiusKm: number = 50
) {
  return this.find({
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: radiusKm * 1000 // Convert km to meters
      }
    },
    status: 'available'
  }).populate('farmerId', 'profile.name');
};

// Static method to search products
ProductSchema.statics.searchProducts = function(
  searchText: string,
  filters?: {
    type?: string;
    grade?: string;
    minPrice?: number;
    maxPrice?: number;
    country?: string;
    region?: string;
  }
) {
  const query: any = {
    status: 'available'
  };

  // Text search
  if (searchText) {
    query.$text = { $search: searchText };
  }

  // Apply filters
  if (filters) {
    if (filters.type) query.commodity = filters.type;
    if (filters.grade) query['qualityAssessment.grade'] = filters.grade;
    if (filters.minPrice) query['pricing.finalPrice'] = { ...query['pricing.finalPrice'], $gte: filters.minPrice };
    if (filters.maxPrice) query['pricing.finalPrice'] = { ...query['pricing.finalPrice'], $lte: filters.maxPrice };
    if (filters.country) query['location.country'] = filters.country;
    if (filters.region) query['location.region'] = filters.region;
  }

  return this.find(query)
    .populate('farmerId', 'profile.name reputation.rating')
    .sort({ score: { $meta: 'textScore' }, 'qualityAssessment.overallScore': -1 });
};

// Instance method to check if product is available
ProductSchema.methods.isAvailable = function(): boolean {
  return this.status === 'available';
};

// Instance method to get price in different currency (placeholder for currency conversion)
ProductSchema.methods.getPriceInCurrency = function(targetCurrency: string): number {
  // This would integrate with a currency conversion service
  // For now, return the same price
  if (this.pricing.currency === targetCurrency) {
    return this.pricing.finalPrice;
  }
  
  // Placeholder conversion rates (should be fetched from external service)
  const conversionRates: { [key: string]: { [key: string]: number } } = {
    'USD': { 'EUR': 0.85, 'XOF': 600, 'GHS': 12, 'NGN': 460 },
    'EUR': { 'USD': 1.18, 'XOF': 656, 'GHS': 14, 'NGN': 542 }
  };
  
  const rate = conversionRates[this.pricing.currency]?.[targetCurrency];
  return rate ? this.pricing.finalPrice * rate : this.pricing.finalPrice;
};

// Instance method to calculate total value
ProductSchema.methods.getTotalValue = function(): number {
  return this.quantity.available * this.pricing.finalPrice;
};

// Instance method to get quality summary
ProductSchema.methods.getQualitySummary = function() {
  const assessment = this.qualityAssessment;
  return {
    grade: assessment.grade,
    score: assessment.overallScore,
    confidence: assessment.confidence,
    strengths: this.getQualityStrengths(),
    improvements: this.getQualityImprovements()
  };
};

// Instance method to get quality strengths
ProductSchema.methods.getQualityStrengths = function(): string[] {
  const metrics = this.qualityAssessment.detailedMetrics;
  const strengths: string[] = [];
  
  if (metrics.colorConsistency && metrics.colorConsistency >= 90) strengths.push('High purity');
  if (metrics.defectCount && metrics.defectCount <= 5) strengths.push('Low defect rate');
  if (metrics.colorConsistency && metrics.colorConsistency >= 80) strengths.push('Excellent color');
  if (metrics.beanSizeUniformity && metrics.beanSizeUniformity >= 80) strengths.push('Consistent size');
  if (metrics.moistureContent && metrics.moistureContent >= 6 && metrics.moistureContent <= 7.5) {
    strengths.push('Optimal moisture content');
  }
  
  return strengths;
};

// Instance method to get quality improvement suggestions
ProductSchema.methods.getQualityImprovements = function(): string[] {
  const metrics = this.qualityAssessment.detailedMetrics;
  const improvements: string[] = [];
  
  if (metrics.colorConsistency && metrics.colorConsistency < 85) improvements.push('Improve sorting to increase purity');
  if (metrics.defectCount && metrics.defectCount > 10) improvements.push('Better post-harvest handling to reduce defects');
  if (metrics.moistureContent && metrics.moistureContent > 8) improvements.push('Improve drying process');
  if (metrics.moistureContent && metrics.moistureContent < 6) improvements.push('Avoid over-drying');
  if (metrics.colorConsistency && metrics.colorConsistency < 70) improvements.push('Optimize fermentation process');
  
  return improvements;
};

// Virtual for formatted price
ProductSchema.virtual('formattedPrice').get(function(this: IProduct) {
  const currencySymbols: { [key: string]: string } = {
    'USD': '$',
    'EUR': '€',
    'XOF': 'CFA',
    'GHS': '₵',
    'NGN': '₦'
  };
  
  const symbol = currencySymbols[this.pricing.currency] || this.pricing.currency;
  return `${symbol}${this.pricing.finalPrice.toLocaleString()}/${this.quantity.unit}`;
});

// Virtual for days until expiry - removed since availableUntil doesn't exist in IProduct

// Create and export the model
export const Product: IProductModel = mongoose.model<IProduct, IProductModel>('Product', ProductSchema);
export default Product;