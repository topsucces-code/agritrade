import { Document, Types } from 'mongoose';

// Geographic and Location Types
export interface GeoLocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface ILocation {
  country: string;
  region: string;
  city: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  geometry?: GeoLocation; // For geospatial queries
  address?: string;
  postalCode?: string;
}

// Notification and Communication Types
export interface NotificationSettings {
  sms: boolean;
  email: boolean;
  whatsapp: boolean;
  push: boolean;
  priceAlerts: boolean;
  orderUpdates: boolean;
  weatherAlerts: boolean;
  marketNews: boolean;
}

// User Types with Enhanced Features
export interface IUser extends Document {
  _id: Types.ObjectId;
  phoneNumber: string; // Primary identifier
  email?: string; // Optional for rural users
  password?: string; // Optional for SMS-only auth
  role: 'farmer' | 'buyer' | 'transporter' | 'admin';
  profile: {
    name: string;
    location: ILocation;
    languages: string[]; // Supported: French, English, local dialects
    verified: boolean;
    kycStatus: 'pending' | 'approved' | 'rejected';
    documentation: string[]; // S3 URLs for ID documents
  };
  preferences: {
    notifications: NotificationSettings;
    currency: 'XOF' | 'GHS' | 'NGN' | 'USD';
    units: 'metric' | 'imperial';
  };
  reputation: {
    score: number; // 0-100
    transactionCount: number;
    rating: number; // 1-5 stars
    reviewCount: number;
    lastUpdated: Date;
  };
  authentication: {
    smsVerified: boolean;
    emailVerified: boolean;
    lastOTPSent?: Date;
    otpAttempts: number;
    lockoutUntil?: Date;
  };
  subscription?: {
    plan: 'free' | 'basic' | 'premium';
    validUntil: Date;
    features: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  lastActive: Date;
  
  // Instance methods
  comparePassword?(candidatePassword: string): Promise<boolean>;
  generateOTP?(): string;
  updateReputation?(newRating: number): void;
}

export interface IFarmerProfile {
  firstName: string;
  lastName: string;
  farmName?: string;
  farmSize: number; // in hectares
  primaryCrops: string[];
  experience: number; // years
  certifications: string[];
  bankAccount?: IBankAccount;
  documents: IDocument[];
  rating: number;
  totalTransactions: number;
}

export interface IBuyerProfile {
  companyName: string;
  contactPerson: string;
  businessType: 'trader' | 'processor' | 'exporter' | 'cooperative';
  licenseNumber?: string;
  interestedCrops: string[];
  minOrderQuantity: number;
  maxOrderQuantity: number;
  paymentTerms: string[];
  rating: number;
  totalTransactions: number;
  verificationStatus: 'pending' | 'verified' | 'rejected';
}

export interface ILocation {
  country: string;
  region: string;
  city: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  address?: string;
}

export interface IBankAccount {
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  swiftCode?: string;
}

export interface IDocument {
  type: 'id' | 'license' | 'certificate' | 'land_title';
  url: string;
  filename: string;
  uploadedAt: Date;
  verified: boolean;
}

// Enhanced Product Types
export interface IProduct extends Document {
  _id: Types.ObjectId;
  farmerId: Types.ObjectId;
  commodity: 'cocoa' | 'coffee' | 'cotton' | 'maize' | 'rice' | 'peanuts' | 'cashew' | 'palm_oil';
  variety: string;
  quantity: {
    available: number;
    reserved: number;
    unit: 'kg' | 'tons' | 'bags';
  };
  qualityAssessment: {
    overallScore: number; // 0-100
    grade: 'A+' | 'A' | 'B' | 'C' | 'D';
    confidence: number; // 0-1
    analysisDate: Date;
    imageUrls: string[];
    detailedMetrics: QualityMetrics;
  };
  pricing: {
    basePrice: number;
    currency: string;
    qualityMultiplier: number;
    finalPrice: number;
    marketPriceRef?: number;
    lastUpdated: Date;
  };
  location: ILocation;
  harvestDate: Date;
  status: 'available' | 'reserved' | 'sold' | 'processing';
  certifications: {
    organic: boolean;
    fairTrade: boolean;
    rainforest: boolean;
    custom: string[];
  };
  storageConditions: {
    temperature: number;
    humidity: number;
    duration: number; // days since harvest
    facility: string;
    qualityMaintained: boolean;
  };
  logistics: {
    pickupLocation: ILocation;
    transportOptions: string[];
    packagingType: string;
    minimumOrder: number;
  };
  marketData: {
    demandScore: number;
    seasonalityFactor: number;
    competitivePrice: number;
    marketTrend: 'rising' | 'falling' | 'stable';
  };
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  isAvailable(): boolean;
  getPriceInCurrency(targetCurrency: string): Promise<number>;
  getTotalValue(): number;
  getQualitySummary(): QualityGrade;
  calculateMarketPosition(): MarketPosition;
}

// Enhanced Quality Assessment Types
export interface QualityMetrics {
  // Cocoa-specific metrics
  beanSizeUniformity?: number;
  colorConsistency?: number;
  moistureContent?: number;
  defectCount?: number;
  shellToBeanRatio?: number;
  
  // Coffee-specific metrics
  beanSizeDistribution?: {
    screen18Plus: number;
    screen16to17: number;
    screen14to15: number;
    below14: number;
  };
  
  // Common metrics
  overallAppearance: number;
  processingQuality: number;
  storageCondition: number;
  
  // AI Analysis metadata
  analysisConfidence: number;
  imageQuality: number;
  processingTime: number;
}

export interface QualityGrade {
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  score: number;
  confidence: number;
  strengths: string[];
  improvements: string[];
  marketPremium: number;
}

export interface MarketPosition {
  competitiveRank: number;
  pricePercentile: number;
  qualityPercentile: number;
  demandLevel: 'high' | 'medium' | 'low';
  recommendedAction: string;
}

// Matching and Order Types
export interface MatchingCriteria {
  location: {
    proximity: number; // km radius
    weight: number;
  };
  quality: {
    minGrade: string;
    scoreRange: [number, number];
    weight: number;
  };
  price: {
    range: [number, number];
    flexibility: number; // 0-1
    weight: number;
  };
  timing: {
    deliveryWindow: number; // days
    urgency: 'low' | 'medium' | 'high';
    weight: number;
  };
  reputation: {
    minScore: number;
    weight: number;
  };
}

export interface MatchResult {
  productId: Types.ObjectId;
  farmerId: Types.ObjectId;
  score: number;
  breakdown: {
    location: number;
    quality: number;
    price: number;
    timing: number;
    reputation: number;
  };
  estimatedDelivery: Date;
  confidence: number;
}

// Pricing Types
export interface PricingFactors {
  qualityMultiplier: number; // Based on AI analysis
  marketDemand: number; // Local supply/demand
  seasonalAdjustment: number; // Historical patterns
  weatherImpact: number; // Climate predictions
  locationPremium: number; // Transport costs
  certificationBonus: number; // Organic/FairTrade
}

export interface PriceEstimate {
  basePrice: number;
  adjustedPrice: number;
  factors: PricingFactors;
  confidence: number;
  validUntil: Date;
  marketComparison: {
    percentile: number;
    competitive: boolean;
    suggestions: string[];
  };
}

// Enhanced Order Management Types
export interface IOrder extends Document {
  _id: Types.ObjectId;
  orderNumber: string;
  farmerId: Types.ObjectId;
  buyerId: Types.ObjectId;
  productId: Types.ObjectId;
  quantity: {
    requested: number;
    confirmed: number;
    unit: string;
  };
  pricing: {
    pricePerUnit: number;
    totalAmount: number;
    currency: string;
    negotiatedPrice?: number;
    finalPrice: number;
  };
  status: 'pending' | 'negotiating' | 'accepted' | 'rejected' | 'paid' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'disputed';
  paymentStatus: 'pending' | 'partial' | 'paid' | 'failed' | 'refunded' | 'escrowed';
  paymentMethod: 'bank_transfer' | 'mobile_money' | 'cash' | 'escrow' | 'credit';
  deliveryDetails: {
    method: 'pickup' | 'delivery' | 'shipping';
    address?: ILocation;
    scheduledDate?: Date;
    actualDate?: Date;
    instructions?: string;
  };
  logistics?: ILogistics;
  contract: {
    terms: string;
    conditions: string[];
    qualityRequirements: QualityRequirements;
    deliveryTerms: string;
    paymentTerms: string;
    penaltyClauses: PenaltyClause[];
    signatures: {
      farmer: {
        signed: boolean;
        timestamp?: Date;
        ipAddress?: string;
      };
      buyer: {
        signed: boolean;
        timestamp?: Date;
        ipAddress?: string;
      };
    };
  };
  negotiationHistory: NegotiationRound[];
  qualityInspection?: QualityInspection;
  dispute?: DisputeRecord;
  notes?: string;
  metadata: {
    source: 'web' | 'mobile' | 'api' | 'sms';
    userAgent?: string;
    referralCode?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface BuyOrder {
  _id: Types.ObjectId;
  buyerId: Types.ObjectId;
  commodity: string;
  quantity: {
    min: number;
    max: number;
    preferred: number;
    unit: string;
  };
  qualityRequirements: QualityRequirements;
  priceRange: {
    min: number;
    max: number;
    target: number;
    currency: string;
  };
  deliveryLocation: ILocation;
  deliveryDate: {
    earliest: Date;
    latest: Date;
    preferred: Date;
  };
  specialRequirements: string[];
  matchingCriteria: MatchingCriteria;
  status: 'active' | 'paused' | 'filled' | 'expired' | 'cancelled';
  validUntil: Date;
  createdAt: Date;
}

export interface QualityRequirements {
  minGrade: 'A+' | 'A' | 'B' | 'C' | 'D';
  maxMoistureContent?: number;
  maxDefectRate?: number;
  minPurity?: number;
  certificationRequired: string[];
  inspectionRequired: boolean;
}

export interface PenaltyClause {
  condition: string;
  penalty: {
    type: 'percentage' | 'fixed';
    amount: number;
    currency?: string;
  };
  description: string;
}

export interface NegotiationRound {
  timestamp: Date;
  initiator: 'farmer' | 'buyer';
  type: 'price' | 'quantity' | 'delivery' | 'terms';
  originalValue: any;
  proposedValue: any;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
}

export interface QualityInspection {
  inspectorId?: Types.ObjectId;
  scheduledDate: Date;
  completedDate?: Date;
  results?: {
    grade: string;
    passed: boolean;
    notes: string;
    images: string[];
  };
  disputeRaised: boolean;
}

export interface DisputeRecord {
  raisedBy: 'farmer' | 'buyer';
  reason: string;
  description: string;
  evidence: string[];
  status: 'open' | 'investigating' | 'resolved' | 'escalated';
  resolution?: {
    decision: string;
    compensationAmount?: number;
    resolvedBy: string;
    resolvedAt: Date;
  };
  createdAt: Date;
}

// Enhanced Logistics Types
export interface ILogistics {
  transporterId?: Types.ObjectId;
  vehicleInfo: {
    type: 'truck' | 'van' | 'pickup' | 'motorcycle';
    capacity: number;
    plateNumber?: string;
    driverName?: string;
    driverPhone?: string;
  };
  route: {
    origin: ILocation;
    destination: ILocation;
    waypoints: ILocation[];
    distance: number; // km
    estimatedDuration: number; // minutes
    actualDuration?: number;
  };
  tracking: {
    trackingNumber: string;
    currentLocation?: ILocation;
    status: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';
    updates: LogisticsUpdate[];
    estimatedArrival: Date;
    actualArrival?: Date;
  };
  cost: {
    baseCost: number;
    distanceCost: number;
    handlingFee: number;
    totalCost: number;
    currency: string;
    paymentBy: 'farmer' | 'buyer' | 'split';
  };
  insurance?: {
    required: boolean;
    provider?: string;
    amount?: number;
    policyNumber?: string;
  };
  specialInstructions?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LogisticsUpdate {
  timestamp: Date;
  location?: ILocation;
  status: string;
  description: string;
  photo?: string;
  signature?: string;
}

// AI Analysis Types
export interface IQualityAnalysis extends Document {
  _id: string;
  productId?: string;
  farmerId: string;
  productType: string;
  images: string[];
  analysisResults: IAnalysisResult;
  metadata: IAnalysisMetadata;
  status: 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface IAnalysisResult {
  grade: 'A' | 'B' | 'C' | 'D';
  overallScore: number;
  confidence: number;
  metrics: {
    color: IColorAnalysis;
    size: ISizeAnalysis;
    defects: IDefectAnalysis;
    moisture: IMoistureAnalysis;
  };
  recommendations: string[];
  marketPriceEstimate: number;
  expectedYield?: number;
}

export interface IColorAnalysis {
  score: number;
  dominantColors: string[];
  uniformity: number;
  brightness: number;
}

export interface ISizeAnalysis {
  averageSize: number;
  sizeVariability: number;
  distribution: {
    small: number;
    medium: number;
    large: number;
  };
}

export interface IDefectAnalysis {
  totalDefects: number;
  defectTypes: {
    type: string;
    count: number;
    severity: 'low' | 'medium' | 'high';
  }[];
  defectRate: number;
}

export interface IMoistureAnalysis {
  estimatedMoisture: number;
  confidence: number;
  recommendation: string;
}

export interface IAnalysisMetadata {
  processingTime: number;
  imageCount: number;
  imageResolution: string;
  aiModelVersion: string;
  weatherConditions?: IWeatherData;
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
  };
}

// Market Data Types
export interface IMarketPrice extends Document {
  _id: string;
  productType: string;
  market: string;
  region: string;
  country: string;
  price: number;
  currency: string;
  unit: string;
  date: Date;
  source: 'fao' | 'local_market' | 'exchange' | 'api';
  volume?: number;
  trend: 'up' | 'down' | 'stable';
  createdAt: Date;
}

export interface IWeatherData {
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  pressure: number;
  uvIndex: number;
  date: Date;
  location: ILocation;
  source: 'openweather' | 'nasa' | 'local';
}

// Notification Types
export interface INotification extends Document {
  _id: string;
  userId: string;
  type: 'order' | 'payment' | 'weather' | 'price_alert' | 'quality_analysis' | 'system';
  title: string;
  message: string;
  data?: any;
  channels: ('push' | 'email' | 'sms' | 'whatsapp')[];
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  readAt?: Date;
  createdAt: Date;
}

// API Request/Response Types
export interface LoginRequest {
  email?: string;
  phone?: string;
  password: string;
}

export interface LoginResponse {
  user: Omit<IUser, 'password'>;
  token: string;
  refreshToken: string;
}

export interface RegisterRequest {
  email: string;
  phone: string;
  password: string;
  userType: 'farmer' | 'buyer';
  profile: Partial<IFarmerProfile> | Partial<IBuyerProfile>;
  location: ILocation;
  preferredLanguage?: string;
}

export interface QualityAnalysisRequest {
  productType: string;
  images: string[]; // base64 or URLs
  location?: ILocation;
}

export interface QualityAnalysisResponse {
  analysisId: string;
  results: IAnalysisResult;
  status: string;
  processingTime: number;
}

export interface MarketPriceRequest {
  productType: string;
  region?: string;
  country?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface MarketPriceResponse {
  prices: IMarketPrice[];
  averagePrice: number;
  trend: 'up' | 'down' | 'stable';
  forecast?: {
    nextWeek: number;
    nextMonth: number;
    confidence: number;
  };
}

// Pagination Types
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Error Types
export interface APIError {
  code: string;
  message: string;
  details?: any;
  statusCode: number;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Fastify Request Extensions
declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: IUser;
    pagination?: PaginationOptions;
  }
  
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => Promise<void>;
  }

  interface FastifySchema {
    tags?: string[];
    description?: string;
    summary?: string;
    security?: Array<Record<string, string[]>>;
    deprecated?: boolean;
    consumes?: string[];
    produces?: string[];
  }
}

// Import for HookHandlerDoneFunction type
import { HookHandlerDoneFunction, FastifyRequest, FastifyReply } from 'fastify';

// JWT Payload
export interface JWTPayload {
  userId: string;
  email: string;
  userType: 'farmer' | 'buyer';
  iat: number;
  exp: number;
}