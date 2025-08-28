import mongoose, { Schema, Model, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser, ILocation, GeoLocation, NotificationSettings } from '../types';

// Enhanced User Model Interface with additional static methods
interface IUserModel extends Model<IUser> {
  findByPhoneNumber(phoneNumber: string): Promise<IUser | null>;
  findNearLocation(longitude: number, latitude: number, radiusKm?: number): Promise<IUser[]>;
  findByReputation(minScore: number): Promise<IUser[]>;
  findVerifiedUsers(role?: string): Promise<IUser[]>;
  updateReputation(userId: string, transactionOutcome: 'positive' | 'negative'): Promise<void>;
}

// GeoJSON Point Schema for precise geospatial queries
const GeoLocationSchema = new Schema<GeoLocation>({
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point'
  },
  coordinates: {
    type: [Number],
    required: true,
    validate: {
      validator: function(coordinates: number[]) {
        return coordinates.length === 2 && 
               coordinates[0] >= -180 && coordinates[0] <= 180 && // longitude
               coordinates[1] >= -90 && coordinates[1] <= 90;     // latitude
      },
      message: 'Coordinates must be [longitude, latitude] within valid ranges'
    }
  }
});

// Enhanced Location Schema with comprehensive geographic information
const EnhancedLocationSchema = new Schema({
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
  geometry: {
    type: GeoLocationSchema,
    index: '2dsphere'
  }
});

// Enhanced Profile Schema
const ProfileSchema = new Schema({
  name: { type: String, required: true, trim: true },
  location: { type: EnhancedLocationSchema, required: true },
  languages: [{
    type: String,
    enum: ['french', 'english', 'dioula', 'wolof', 'hausa', 'yoruba', 'swahili']
  }],
  avatar: { type: String }, // S3 URL
  verified: { type: Boolean, default: false },
  verificationLevel: {
    type: String,
    enum: ['basic', 'enhanced', 'premium'],
    default: 'basic'
  },
  kycStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending'
  },
  documentation: {
    idCard: { type: String }, // S3 URL
    farmCertificate: { type: String }, // For farmers
    businessLicense: { type: String }, // For buyers
    verificationDate: { type: Date }
  }
});

// Notification Preferences Schema
const NotificationPreferencesSchema = new Schema({
  sms: { type: Boolean, default: true },
  whatsapp: { type: Boolean, default: true },
  voice: { type: Boolean, default: false },
  email: { type: Boolean, default: false }
});

// User Preferences Schema
const PreferencesSchema = new Schema({
  notifications: { type: NotificationPreferencesSchema, default: {} },
  language: { 
    type: String, 
    enum: ['french', 'english', 'dioula', 'wolof'],
    default: 'french' 
  },
  currency: {
    type: String,
    enum: ['XOF', 'GHS', 'NGN', 'USD', 'EUR'],
    default: 'XOF'
  },
  units: {
    type: String,
    enum: ['metric', 'imperial'],
    default: 'metric'
  },
  timeZone: { type: String, default: 'Africa/Abidjan' }
});

// Review Summary Schema
const ReviewSummarySchema = new Schema({
  reviewerId: { type: Schema.Types.ObjectId, ref: 'User' },
  rating: { type: Number, min: 1, max: 5 },
  comment: { type: String, maxlength: 500 },
  transactionId: { type: Schema.Types.ObjectId, ref: 'Order' },
  date: { type: Date, default: Date.now }
});

// Enhanced Reputation Schema
const ReputationSchema = new Schema({
  score: { type: Number, default: 50, min: 0, max: 100 },
  transactionCount: { type: Number, default: 0, min: 0 },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  reviews: [ReviewSummarySchema],
  badges: [{
    type: String,
    enum: ['trusted_seller', 'quality_producer', 'timely_delivery', 'premium_buyer', 'verified_organic']
  }]
});

// Financial Information Schema
const FinancialsSchema = new Schema({
  totalRevenue: { type: Number, default: 0 },
  averageOrderValue: { type: Number, default: 0 },
  paymentMethods: [{
    type: String,
    enum: ['orange_money', 'mtn_money', 'airtel_money', 'bank_transfer', 'cash']
  }],
  creditScore: { type: Number, min: 0, max: 100 }
});

// Device Information Schema
const DeviceInfoSchema = new Schema({
  platform: { type: String },
  version: { type: String },
  deviceId: { type: String },
  lastSeen: { type: Date, default: Date.now }
});

// Activity Tracking Schema
const ActivitySchema = new Schema({
  lastLogin: { type: Date, default: Date.now },
  loginCount: { type: Number, default: 0 },
  deviceInfo: DeviceInfoSchema
});

// Enhanced User Schema with comprehensive design specifications
const UserSchema = new Schema<IUser>({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    validate: {
      validator: function(v: string) {
        // International phone number format validation
        return /^\+[1-9]\d{1,14}$/.test(v);
      },
      message: 'Please enter a valid international phone number with country code'
    }
  },
  role: {
    type: String,
    required: true,
    enum: ['farmer', 'buyer', 'transporter', 'admin', 'cooperative'],
    default: 'farmer'
  },
  profile: {
    type: ProfileSchema,
    required: true
  },
  preferences: {
    type: PreferencesSchema,
    default: {}
  },
  reputation: {
    type: ReputationSchema,
    default: {}
  },
  financials: {
    type: FinancialsSchema,
    default: {}
  },
  activity: {
    type: ActivitySchema,
    default: {}
  },
  
  // Authentication fields
  smsVerified: { type: Boolean, default: false },
  lastOTPSent: { type: Date },
  otpAttempts: { type: Number, default: 0, max: 5 },
  lockoutUntil: { type: Date },
  
  // Subscription information
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium'],
      default: 'free'
    },
    validUntil: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    },
    features: [{ type: String }]
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Comprehensive Indexing Strategy for Performance
UserSchema.index({ phoneNumber: 1 }, { unique: true });
UserSchema.index({ role: 1 });
UserSchema.index({ 'profile.location.coordinates': '2dsphere' }); // Geospatial queries
UserSchema.index({ 'profile.location.country': 1, 'profile.location.region': 1 });
UserSchema.index({ smsVerified: 1 });
UserSchema.index({ 'profile.verified': 1 });
UserSchema.index({ 'profile.kycStatus': 1 });
UserSchema.index({ 'reputation.score': -1 }); // For ranking
UserSchema.index({ 'activity.lastLogin': -1 }); // For active users
UserSchema.index({ createdAt: -1 });

// Compound indexes for complex queries
UserSchema.index({ role: 1, 'profile.verified': 1, smsVerified: 1 });
UserSchema.index({ role: 1, 'profile.location.country': 1, 'profile.location.region': 1 });
UserSchema.index({ 'reputation.score': -1, 'reputation.transactionCount': -1 });
UserSchema.index({ 'profile.kycStatus': 1, 'profile.verificationLevel': 1 });

// Pre-save middleware to auto-generate geometry from coordinates
UserSchema.pre('save', function(this: IUser, next) {
  if (this.profile?.location?.coordinates) {
    this.profile.location.geometry = {
      type: 'Point',
      coordinates: this.profile.location.coordinates
    };
  }
  next();
});

// Pre-save middleware to update reputation badges
UserSchema.pre('save', function(this: IUser, next) {
  if (this.reputation) {
    const reputation = this.reputation;
    const badges: string[] = [];
    
    // Award badges based on reputation metrics
    if (reputation.score >= 90) badges.push('trusted_seller');
    if (reputation.transactionCount >= 50) badges.push('experienced_trader');
    if (reputation.rating >= 4.5) badges.push('quality_producer');
    if (this.profile?.kycStatus === 'approved') badges.push('verified_member');
    
    reputation.badges = badges;
  }
  next();
});

// Static method to find user by phone number
UserSchema.statics.findByPhoneNumber = function(phoneNumber: string) {
  return this.findOne({ phoneNumber });
};

// Static method to find users near a location
UserSchema.statics.findNearLocation = function(
  longitude: number,
  latitude: number,
  radiusKm: number = 50
) {
  return this.find({
    'profile.location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: radiusKm * 1000 // Convert km to meters
      }
    },
    'profile.verified': true
  });
};

// Static method to find users by reputation
UserSchema.statics.findByReputation = function(minScore: number) {
  return this.find({
    'reputation.score': { $gte: minScore },
    'profile.verified': true
  }).sort({ 'reputation.score': -1 });
};

// Static method to find verified users
UserSchema.statics.findVerifiedUsers = function(role?: string) {
  const query: any = {
    'profile.verified': true,
    smsVerified: true,
    'profile.kycStatus': 'approved'
  };
  
  if (role) {
    query.role = role;
  }
  
  return this.find(query).sort({ 'reputation.score': -1 });
};

// Static method to update user reputation
UserSchema.statics.updateReputation = async function(
  userId: string, 
  transactionOutcome: 'positive' | 'negative'
) {
  const user = await this.findById(userId);
  if (!user) return;
  
  const reputation = user.reputation;
  reputation.transactionCount += 1;
  
  // Adjust score based on outcome
  if (transactionOutcome === 'positive') {
    reputation.score = Math.min(100, reputation.score + 2);
  } else {
    reputation.score = Math.max(0, reputation.score - 5);
  }
  
  await user.save();
};

// Instance method to check if user is active
UserSchema.methods.isActive = function() {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  return this.activity.lastLogin > oneMonthAgo;
};

// Instance method to check if user is verified
UserSchema.methods.isVerified = function() {
  return this.profile.verified && 
         this.smsVerified && 
         this.profile.kycStatus === 'approved';
};

// Instance method to get reputation summary
UserSchema.methods.getReputationSummary = function() {
  const reputation = this.reputation;
  let level = 'Bronze';
  
  if (reputation.score >= 90) level = 'Platinum';
  else if (reputation.score >= 75) level = 'Gold';
  else if (reputation.score >= 60) level = 'Silver';
  
  return {
    level,
    score: reputation.score,
    transactionCount: reputation.transactionCount,
    rating: reputation.rating,
    badges: reputation.badges || []
  };
};

// Instance method to check eligibility for premium features
UserSchema.methods.canAccessPremiumFeatures = function() {
  return this.subscription.plan !== 'free' && 
         this.subscription.validUntil > new Date();
};

// Instance method to update last activity
UserSchema.methods.updateActivity = function(deviceInfo?: any) {
  this.activity.lastLogin = new Date();
  this.activity.loginCount += 1;
  
  if (deviceInfo) {
    this.activity.deviceInfo = {
      ...this.activity.deviceInfo,
      ...deviceInfo,
      lastSeen: new Date()
    };
  }
  
  return this.save();
};

// Virtual for user's full verification status
UserSchema.virtual('fullVerificationStatus').get(function(this: IUser) {
  return {
    smsVerified: this.smsVerified,
    profileVerified: this.profile.verified,
    kycStatus: this.profile.kycStatus,
    verificationLevel: this.profile.verificationLevel,
    isFullyVerified: this.isVerified()
  };
});

// Virtual for user's reputation level
UserSchema.virtual('reputationLevel').get(function(this: IUser) {
  const score = this.reputation.score;
  if (score >= 90) return 'Platinum';
  if (score >= 75) return 'Gold';
  if (score >= 60) return 'Silver';
  return 'Bronze';
});

// Virtual for subscription status
UserSchema.virtual('subscriptionStatus').get(function(this: IUser) {
  const now = new Date();
  return {
    isActive: this.subscription.validUntil > now,
    plan: this.subscription.plan,
    daysRemaining: Math.max(0, Math.ceil((this.subscription.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  };
});

// Create and export the enhanced model
export const User: IUserModel = mongoose.model<IUser, IUserModel>('User', UserSchema);
export default User;