import mongoose, { Schema, Model, Types } from 'mongoose';

// Quality Analysis Interface
export interface IQualityAnalysis {
  _id: Types.ObjectId;
  analysisId: string;
  productId: Types.ObjectId;
  farmerId: Types.ObjectId;
  commodity: 'cocoa' | 'coffee' | 'cotton' | 'maize' | 'rice' | 'peanuts' | 'cashew' | 'palm_oil';
  
  // Image Information
  imageData: {
    originalUrl: string;
    optimizedUrl?: string;
    imageSize: number; // bytes
    dimensions: {
      width: number;
      height: number;
    };
    format: string;
    uploadedAt: Date;
  };
  
  // Vision API Results
  visionApiResults: {
    objects: Array<{
      name: string;
      confidence: number;
      boundingBox?: any;
      category?: string;
    }>;
    colors: Array<{
      red: number;
      green: number;
      blue: number;
      score: number;
      pixelFraction?: number;
    }>;
    labels: Array<{
      description: string;
      score: number;
      topicality?: number;
    }>;
    textAnnotations?: Array<{
      description: string;
      boundingPoly?: any;
      confidence?: number;
    }>;
    imageProperties: {
      dominantColors?: any;
      cropHints?: any[];
    };
    safeSearchAnnotation?: any;
    error?: string;
  };
  
  // Quality Assessment Results
  qualityResults: {
    overallScore: number; // 0-100
    grade: 'A+' | 'A' | 'B' | 'C' | 'D';
    confidence: number; // 0-1
    
    // Commodity-specific metrics
    detailedMetrics: {
      // Common metrics
      beanSizeUniformity?: number;
      colorConsistency?: number;
      moistureContent?: number;
      defectCount?: number;
      uniformity?: number;
      
      // Cocoa-specific
      shellToBeanRatio?: number;
      beanCount?: number;
      averageBeanSize?: number;
      
      // Coffee-specific
      beanDensity?: number;
      screenSize?: number;
      processingQuality?: number;
      aroma?: number;
      
      // Cotton-specific
      fiberLength?: number;
      fiberStrength?: number;
      micronaire?: number;
      
      // Additional metrics can be added as needed
      [key: string]: any;
    };
    
    // Visual quality indicators
    visualQualityIndicators: {
      surfaceQuality: number;
      shapeRegularity: number;
      textureConsistency: number;
      contamination: number;
      overallAppearance: number;
    };
    
    // Processing quality assessment
    processingQuality: {
      score: number;
      processingMethod?: string;
      dryingQuality?: number;
      fermentationQuality?: number;
      storageCondition?: number;
      handlingQuality?: number;
    };
  };
  
  // AI-generated recommendations
  recommendations: Array<{
    category: 'processing' | 'storage' | 'handling' | 'marketing' | 'improvement' | 'drying';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    expectedImpact: string;
    timeframe: string;
    actionItems?: string[];
    estimatedCost?: {
      amount: number;
      currency: string;
    };
    potentialROI?: number; // percentage
  }>;
  
  // Quality comparison and benchmarking
  benchmarking: {
    regionalAverage: number;
    seasonalAverage: number;
    farmerHistorical: number;
    commodityStandard: number;
    percentileRank: number; // 0-100
    improvementFromLast?: number; // percentage change
  };
  
  // Analysis metadata
  analysisMetadata: {
    processingTime: number; // milliseconds
    algorithmVersion: string;
    modelConfidence: number;
    imageQuality: {
      score: number; // 0-100
      issues?: string[];
      recommendations?: string[];
    };
    weatherConditions?: {
      temperature: number;
      humidity: number;
      precipitation: number;
      date: Date;
    };
    validityPeriod: number; // days
    analysisDate: Date;
    lastUpdated: Date;
  };
  
  // Quality tracking and trends
  qualityTrends: {
    trend: 'improving' | 'stable' | 'declining';
    trendConfidence: number;
    comparisonPeriod: number; // days
    previousAnalyses: Array<{
      date: Date;
      score: number;
      grade: string;
    }>;
    seasonalPattern?: {
      month: number;
      expectedScore: number;
    }[];
  };
  
  // External validations
  validations?: Array<{
    validatorType: 'expert' | 'lab' | 'certified_grader';
    validatorId?: Types.ObjectId;
    validationScore: number;
    validationGrade: string;
    validationDate: Date;
    notes?: string;
    agreement: number; // 0-1, agreement with AI analysis
  }>;
  
  // Pricing impact
  pricingImpact: {
    qualityMultiplier: number;
    estimatedPriceRange: {
      minimum: number;
      maximum: number;
      currency: string;
    };
    marketPositioning: 'premium' | 'standard' | 'discount';
    competitiveAdvantage?: string[];
  };
  
  // Analytics and usage
  analytics: {
    viewCount: number;
    shareCount: number;
    downloadCount: number;
    feedbackRating?: number; // 1-5
    feedbackComments?: string[];
  };
  
  // Status and lifecycle
  status: 'processing' | 'completed' | 'failed' | 'expired' | 'disputed';
  errorInfo?: {
    errorCode: string;
    errorMessage: string;
    stackTrace?: string;
    retryCount: number;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

// Enhanced Quality Analysis Model Interface
interface IQualityAnalysisModel extends Model<IQualityAnalysis> {
  findByProduct(productId: string): Promise<IQualityAnalysis[]>;
  findByFarmer(farmerId: string, limit?: number): Promise<IQualityAnalysis[]>;
  findByCommodity(commodity: string, filters?: any): Promise<IQualityAnalysis[]>;
  findByGrade(grade: string): Promise<IQualityAnalysis[]>;
  getQualityTrends(farmerId: string, commodity: string, days?: number): Promise<any>;
  getRegionalAnalytics(region: string, commodity: string): Promise<any>;
  findSimilarQuality(analysisId: string, tolerance?: number): Promise<IQualityAnalysis[]>;
  generateQualityReport(farmerId: string, period?: string): Promise<any>;
}

// Image Data Schema
const ImageDataSchema = new Schema({
  originalUrl: { type: String, required: true },
  optimizedUrl: { type: String },
  imageSize: { type: Number, required: true, min: 0 },
  dimensions: {
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 }
  },
  format: { 
    type: String, 
    required: true,
    enum: ['jpeg', 'jpg', 'png', 'webp']
  },
  uploadedAt: { type: Date, default: Date.now }
});

// Vision API Results Schema
const VisionApiResultsSchema = new Schema({
  objects: [{
    name: { type: String, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    boundingBox: { type: Schema.Types.Mixed },
    category: { type: String }
  }],
  colors: [{
    red: { type: Number, required: true, min: 0, max: 255 },
    green: { type: Number, required: true, min: 0, max: 255 },
    blue: { type: Number, required: true, min: 0, max: 255 },
    score: { type: Number, required: true, min: 0, max: 1 },
    pixelFraction: { type: Number, min: 0, max: 1 }
  }],
  labels: [{
    description: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 1 },
    topicality: { type: Number, min: 0, max: 1 }
  }],
  textAnnotations: [{
    description: { type: String, required: true },
    boundingPoly: { type: Schema.Types.Mixed },
    confidence: { type: Number, min: 0, max: 1 }
  }],
  imageProperties: {
    dominantColors: { type: Schema.Types.Mixed },
    cropHints: [{ type: Schema.Types.Mixed }]
  },
  safeSearchAnnotation: { type: Schema.Types.Mixed },
  error: { type: String }
});

// Quality Results Schema
const QualityResultsSchema = new Schema({
  overallScore: { 
    type: Number, 
    required: true, 
    min: 0, 
    max: 100 
  },
  grade: {
    type: String,
    required: true,
    enum: ['A+', 'A', 'B', 'C', 'D']
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  detailedMetrics: {
    type: Schema.Types.Mixed,
    default: {}
  },
  visualQualityIndicators: {
    surfaceQuality: { type: Number, min: 0, max: 100 },
    shapeRegularity: { type: Number, min: 0, max: 100 },
    textureConsistency: { type: Number, min: 0, max: 100 },
    contamination: { type: Number, min: 0, max: 100 },
    overallAppearance: { type: Number, min: 0, max: 100 }
  },
  processingQuality: {
    score: { type: Number, min: 0, max: 100 },
    processingMethod: { type: String },
    dryingQuality: { type: Number, min: 0, max: 100 },
    fermentationQuality: { type: Number, min: 0, max: 100 },
    storageCondition: { type: Number, min: 0, max: 100 },
    handlingQuality: { type: Number, min: 0, max: 100 }
  }
});

// Recommendations Schema
const RecommendationSchema = new Schema({
  category: {
    type: String,
    required: true,
    enum: ['processing', 'storage', 'handling', 'marketing', 'improvement', 'drying']
  },
  priority: {
    type: String,
    required: true,
    enum: ['high', 'medium', 'low']
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  expectedImpact: { type: String, required: true },
  timeframe: { type: String, required: true },
  actionItems: [{ type: String }],
  estimatedCost: {
    amount: { type: Number, min: 0 },
    currency: { type: String, enum: ['XOF', 'GHS', 'NGN', 'USD', 'EUR'] }
  },
  potentialROI: { type: Number, min: 0 }
});

// Benchmarking Schema
const BenchmarkingSchema = new Schema({
  regionalAverage: { type: Number, min: 0, max: 100 },
  seasonalAverage: { type: Number, min: 0, max: 100 },
  farmerHistorical: { type: Number, min: 0, max: 100 },
  commodityStandard: { type: Number, min: 0, max: 100 },
  percentileRank: { type: Number, min: 0, max: 100 },
  improvementFromLast: { type: Number } // can be negative
});

// Analysis Metadata Schema
const AnalysisMetadataSchema = new Schema({
  processingTime: { type: Number, required: true, min: 0 },
  algorithmVersion: { type: String, required: true },
  modelConfidence: { type: Number, required: true, min: 0, max: 1 },
  imageQuality: {
    score: { type: Number, required: true, min: 0, max: 100 },
    issues: [{ type: String }],
    recommendations: [{ type: String }]
  },
  weatherConditions: {
    temperature: { type: Number },
    humidity: { type: Number, min: 0, max: 100 },
    precipitation: { type: Number, min: 0 },
    date: { type: Date }
  },
  validityPeriod: { type: Number, default: 7, min: 1 },
  analysisDate: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now }
});

// Quality Trends Schema
const QualityTrendsSchema = new Schema({
  trend: {
    type: String,
    enum: ['improving', 'stable', 'declining'],
    default: 'stable'
  },
  trendConfidence: { type: Number, min: 0, max: 1, default: 0.5 },
  comparisonPeriod: { type: Number, default: 30 },
  previousAnalyses: [{
    date: { type: Date, required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    grade: { type: String, required: true }
  }],
  seasonalPattern: [{
    month: { type: Number, min: 1, max: 12 },
    expectedScore: { type: Number, min: 0, max: 100 }
  }]
});

// Pricing Impact Schema
const PricingImpactSchema = new Schema({
  qualityMultiplier: { type: Number, required: true, min: 0.5, max: 2.0 },
  estimatedPriceRange: {
    minimum: { type: Number, required: true, min: 0 },
    maximum: { type: Number, required: true, min: 0 },
    currency: { 
      type: String, 
      required: true,
      enum: ['XOF', 'GHS', 'NGN', 'USD', 'EUR']
    }
  },
  marketPositioning: {
    type: String,
    enum: ['premium', 'standard', 'discount'],
    default: 'standard'
  },
  competitiveAdvantage: [{ type: String }]
});

// Main Quality Analysis Schema
const QualityAnalysisSchema = new Schema<IQualityAnalysis>({
  analysisId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  farmerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  commodity: {
    type: String,
    required: true,
    enum: ['cocoa', 'coffee', 'cotton', 'maize', 'rice', 'peanuts', 'cashew', 'palm_oil'],
    index: true
  },
  
  imageData: {
    type: ImageDataSchema,
    required: true
  },
  
  visionApiResults: {
    type: VisionApiResultsSchema,
    required: true
  },
  
  qualityResults: {
    type: QualityResultsSchema,
    required: true
  },
  
  recommendations: [RecommendationSchema],
  
  benchmarking: {
    type: BenchmarkingSchema,
    default: {}
  },
  
  analysisMetadata: {
    type: AnalysisMetadataSchema,
    required: true
  },
  
  qualityTrends: {
    type: QualityTrendsSchema,
    default: {}
  },
  
  validations: [{
    validatorType: {
      type: String,
      enum: ['expert', 'lab', 'certified_grader'],
      required: true
    },
    validatorId: { type: Schema.Types.ObjectId, ref: 'User' },
    validationScore: { type: Number, required: true, min: 0, max: 100 },
    validationGrade: { type: String, required: true },
    validationDate: { type: Date, default: Date.now },
    notes: { type: String },
    agreement: { type: Number, min: 0, max: 1 }
  }],
  
  pricingImpact: {
    type: PricingImpactSchema,
    required: true
  },
  
  analytics: {
    viewCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 },
    feedbackRating: { type: Number, min: 1, max: 5 },
    feedbackComments: [{ type: String }]
  },
  
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed', 'expired', 'disputed'],
    default: 'processing',
    index: true
  },
  
  errorInfo: {
    errorCode: { type: String },
    errorMessage: { type: String },
    stackTrace: { type: String },
    retryCount: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Comprehensive Indexing Strategy
QualityAnalysisSchema.index({ analysisId: 1 }, { unique: true });
QualityAnalysisSchema.index({ productId: 1 });
QualityAnalysisSchema.index({ farmerId: 1 });
QualityAnalysisSchema.index({ commodity: 1 });
QualityAnalysisSchema.index({ 'qualityResults.grade': 1 });
QualityAnalysisSchema.index({ 'qualityResults.overallScore': -1 });
QualityAnalysisSchema.index({ status: 1 });
QualityAnalysisSchema.index({ createdAt: -1 });
QualityAnalysisSchema.index({ 'analysisMetadata.analysisDate': -1 });

// Compound indexes for complex queries
QualityAnalysisSchema.index({ farmerId: 1, commodity: 1, createdAt: -1 });
QualityAnalysisSchema.index({ commodity: 1, 'qualityResults.grade': 1, status: 1 });
QualityAnalysisSchema.index({ farmerId: 1, status: 1, 'analysisMetadata.analysisDate': -1 });
QualityAnalysisSchema.index({ 
  commodity: 1, 
  'qualityResults.overallScore': -1, 
  'analysisMetadata.analysisDate': -1 
});

// Pre-save middleware to generate analysisId if not provided
QualityAnalysisSchema.pre('save', function(this: IQualityAnalysis, next) {
  if (!this.analysisId) {
    this.analysisId = `QA_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

// Pre-save middleware to update lastUpdated in metadata
QualityAnalysisSchema.pre('save', function(this: IQualityAnalysis, next) {
  this.analysisMetadata.lastUpdated = new Date();
  next();
});

// Static method to find analyses by product
QualityAnalysisSchema.statics.findByProduct = function(productId: string) {
  return this.find({ productId, status: 'completed' })
    .sort({ 'analysisMetadata.analysisDate': -1 })
    .populate('farmerId', 'profile.name')
    .populate('productId', 'commodity variety');
};

// Static method to find analyses by farmer
QualityAnalysisSchema.statics.findByFarmer = function(farmerId: string, limit: number = 10) {
  return this.find({ farmerId, status: 'completed' })
    .sort({ 'analysisMetadata.analysisDate': -1 })
    .limit(limit)
    .populate('productId', 'commodity variety');
};

// Static method to find analyses by commodity
QualityAnalysisSchema.statics.findByCommodity = function(commodity: string, filters: any = {}) {
  const query = { commodity, status: 'completed', ...filters };
  return this.find(query)
    .sort({ 'qualityResults.overallScore': -1 })
    .populate('farmerId', 'profile.name profile.location')
    .populate('productId', 'variety');
};

// Static method to find analyses by grade
QualityAnalysisSchema.statics.findByGrade = function(grade: string) {
  return this.find({ 'qualityResults.grade': grade, status: 'completed' })
    .sort({ 'analysisMetadata.analysisDate': -1 })
    .populate('farmerId', 'profile.name')
    .populate('productId', 'commodity variety');
};

// Static method to get quality trends
QualityAnalysisSchema.statics.getQualityTrends = async function(
  farmerId: string, 
  commodity: string, 
  days: number = 90
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const analyses = await this.find({
    farmerId,
    commodity,
    status: 'completed',
    'analysisMetadata.analysisDate': { $gte: startDate }
  }).sort({ 'analysisMetadata.analysisDate': 1 });
  
  if (analyses.length < 2) {
    return { trend: 'insufficient_data', analyses };
  }
  
  const scores = analyses.map((a: any) => a.qualityResults.overallScore);
  const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
  const secondHalf = scores.slice(Math.floor(scores.length / 2));
  
  const firstAvg = firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length;
  
  let trend = 'stable';
  if (secondAvg > firstAvg + 5) trend = 'improving';
  else if (secondAvg < firstAvg - 5) trend = 'declining';
  
  return {
    trend,
    improvementRate: ((secondAvg - firstAvg) / firstAvg) * 100,
    averageScore: scores.reduce((a: number, b: number) => a + b, 0) / scores.length,
    analyses
  };
};

// Instance method to check if analysis is expired
QualityAnalysisSchema.methods.isExpired = function() {
  const validityDays = this.analysisMetadata.validityPeriod;
  const analysisDate = this.analysisMetadata.analysisDate;
  const expiryDate = new Date(analysisDate);
  expiryDate.setDate(expiryDate.getDate() + validityDays);
  
  return new Date() > expiryDate;
};

// Instance method to get quality summary
QualityAnalysisSchema.methods.getQualitySummary = function() {
  return {
    analysisId: this.analysisId,
    grade: this.qualityResults.grade,
    score: this.qualityResults.overallScore,
    confidence: this.qualityResults.confidence,
    commodity: this.commodity,
    analysisDate: this.analysisMetadata.analysisDate,
    isExpired: this.isExpired(),
    keyRecommendations: this.recommendations
      .filter((r: any) => r.priority === 'high')
      .slice(0, 3)
      .map((r: any) => r.title)
  };
};

// Virtual for analysis age in days
QualityAnalysisSchema.virtual('ageInDays').get(function(this: IQualityAnalysis) {
  const now = new Date();
  const analysisDate = this.analysisMetadata.analysisDate;
  const diffTime = now.getTime() - analysisDate.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for validation consensus
QualityAnalysisSchema.virtual('validationConsensus').get(function(this: IQualityAnalysis) {
  if (!this.validations || this.validations.length === 0) {
    return { hasValidation: false };
  }
  
  const avgAgreement = this.validations.reduce((sum, v) => sum + v.agreement, 0) / this.validations.length;
  const avgScore = this.validations.reduce((sum, v) => sum + v.validationScore, 0) / this.validations.length;
  
  return {
    hasValidation: true,
    validationCount: this.validations.length,
    averageAgreement: avgAgreement,
    averageScore: avgScore,
    consensus: avgAgreement > 0.8 ? 'high' : avgAgreement > 0.6 ? 'medium' : 'low'
  };
});

// Create and export the model
export const QualityAnalysis: IQualityAnalysisModel = mongoose.model<IQualityAnalysis, IQualityAnalysisModel>('QualityAnalysis', QualityAnalysisSchema);
export default QualityAnalysis;