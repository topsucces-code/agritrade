import mongoose, { Schema, Model, Query } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser, ILocation, GeoLocation, NotificationSettings } from '../types';

// GeoJSON Point Schema for geospatial queries
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

// Enhanced Location Schema with geospatial support
const LocationSchema = new Schema<ILocation>({
  country: { type: String, required: true, trim: true },
  region: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  coordinates: {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 }
  },
  geometry: {
    type: GeoLocationSchema,
    index: '2dsphere' // Enable geospatial queries
  },
  address: { type: String, trim: true },
  postalCode: { type: String, trim: true }
});

// Notification Settings Schema
const NotificationSettingsSchema = new Schema<NotificationSettings>({
  sms: { type: Boolean, default: true },
  email: { type: Boolean, default: false },
  whatsapp: { type: Boolean, default: true },
  push: { type: Boolean, default: true },
  priceAlerts: { type: Boolean, default: true },
  orderUpdates: { type: Boolean, default: true },
  weatherAlerts: { type: Boolean, default: true },
  marketNews: { type: Boolean, default: false }
});

// Enhanced User Schema with comprehensive features
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
      message: 'Please enter a valid international phone number (e.g., +1234567890)'
    }
  },
  email: {
    type: String,
    sparse: true, // Allow multiple null values but unique non-null values
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v: string) {
        return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  password: {
    type: String,
    required: function(this: IUser) {
      // Password required only if email is provided
      return !!this.email;
    },
    minlength: 8,
    validate: {
      validator: function(v: string) {
        // Password must contain at least one uppercase, one lowercase, one number
        return !v || /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/.test(v);
      },
      message: 'Password must be at least 8 characters and contain uppercase, lowercase, and number'
    }
  },
  role: {
    type: String,
    required: true,
    enum: ['farmer', 'buyer', 'transporter', 'admin'],
    default: 'farmer'
  },
  profile: {
    name: { type: String, required: true, trim: true },
    location: { type: LocationSchema, required: true },
    languages: [{
      type: String,
      enum: ['en', 'fr', 'sw', 'ha', 'yo', 'ig', 'tw', 'ee', 'ak'] // English, French, Swahili, Hausa, Yoruba, Igbo, Twi, Ewe, Akan
    }],
    verified: { type: Boolean, default: false },
    kycStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    documentation: [{ type: String }] // S3 URLs for ID documents
  },
  preferences: {
    notifications: { type: NotificationSettingsSchema, default: () => ({}) },
    currency: {
      type: String,
      enum: ['XOF', 'GHS', 'NGN', 'USD'],
      default: 'XOF' // West African CFA franc
    },
    units: {
      type: String,
      enum: ['metric', 'imperial'],
      default: 'metric'
    }
  },
  reputation: {
    score: { type: Number, default: 50, min: 0, max: 100 },
    transactionCount: { type: Number, default: 0, min: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  authentication: {
    smsVerified: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    lastOTPSent: { type: Date },
    otpAttempts: { type: Number, default: 0, max: 5 },
    lockoutUntil: { type: Date }
  },
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
  },
  lastActive: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.__v;
      return ret;
    }
  }
});


// Comprehensive Indexing Strategy for Performance
UserSchema.index({ phoneNumber: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { sparse: true, unique: true });
UserSchema.index({ role: 1 });
UserSchema.index({ 'profile.location.geometry': '2dsphere' }); // Geospatial queries
UserSchema.index({ 'profile.location.country': 1, 'profile.location.region': 1 });
UserSchema.index({ 'authentication.smsVerified': 1 });
UserSchema.index({ 'profile.verified': 1 });
UserSchema.index({ 'profile.kycStatus': 1 });
UserSchema.index({ 'reputation.score': -1 }); // For ranking
UserSchema.index({ lastActive: -1 }); // For active users
UserSchema.index({ createdAt: -1 });

// Compound indexes for complex queries
UserSchema.index({ role: 1, 'profile.verified': 1, 'authentication.smsVerified': 1 });
UserSchema.index({ role: 1, 'profile.location.country': 1, 'profile.location.region': 1 });
UserSchema.index({ 'reputation.score': -1, 'reputation.transactionCount': -1 });

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Pre-save middleware to set geometry for geospatial queries
UserSchema.pre('save', function(next) {
  if (this.profile?.location?.coordinates) {
    this.profile.location.geometry = {
      type: 'Point',
      coordinates: [
        this.profile.location.coordinates.longitude,
        this.profile.location.coordinates.latitude
      ]
    };
  }
  next();
});

// Instance method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.password) {
    throw new Error('Password not set for this user');
  }
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Instance method to generate OTP
UserSchema.methods.generateOTP = function(): string {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.authentication.lastOTPSent = new Date();
  this.authentication.otpAttempts += 1;
  
  // Lock account if too many attempts
  if (this.authentication.otpAttempts >= 5) {
    this.authentication.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  }
  
  return otp;
};

// Instance method to update reputation
UserSchema.methods.updateReputation = function(newRating: number): void {
  const currentRating = this.reputation.rating;
  const currentCount = this.reputation.reviewCount;
  
  // Calculate new average rating
  const totalRating = (currentRating * currentCount) + newRating;
  const newCount = currentCount + 1;
  
  this.reputation.rating = totalRating / newCount;
  this.reputation.reviewCount = newCount;
  this.reputation.lastUpdated = new Date();
  
  // Update reputation score (complex algorithm considering various factors)
  const transactionWeight = Math.min(this.reputation.transactionCount / 10, 1);
  const ratingWeight = this.reputation.rating / 5;
  const verificationBonus = this.profile.verified ? 0.1 : 0;
  
  this.reputation.score = Math.min(
    Math.round((transactionWeight * 40 + ratingWeight * 50 + verificationBonus * 10) * 100) / 100,
    100
  );
};

// Static method to find users by location with radius
UserSchema.statics.findByLocation = function(
  longitude: number, 
  latitude: number, 
  radiusInKm: number = 50,
  role?: string
) {
  const query: any = {
    'profile.location.geometry': {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: radiusInKm * 1000 // Convert km to meters
      }
    },
    'profile.verified': true,
    'authentication.smsVerified': true
  };
  
  if (role) {
    query.role = role;
  }
  
  return this.find(query).sort({ 'reputation.score': -1 });
};

// Static method to find farmers by crop type
UserSchema.statics.findFarmersByLocation = function(
  longitude: number,
  latitude: number,
  radiusInKm: number = 100
) {
  const query: any = {
    'profile.location.geometry': {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: radiusInKm * 1000 // Convert km to meters
      }
    },
    'profile.verified': true,
    'authentication.smsVerified': true,
    role: 'farmer'
  };
  
  return this.find(query).sort({ 'reputation.score': -1 });
};

// Static method to find buyers by location
UserSchema.statics.findBuyersByLocation = function(
  longitude: number,
  latitude: number,
  radiusInKm: number = 200
) {
  const query: any = {
    'profile.location.geometry': {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: radiusInKm * 1000 // Convert km to meters
      }
    },
    'profile.verified': true,
    'authentication.smsVerified': true,
    role: 'buyer'
  };
  
  return this.find(query).sort({ 'reputation.score': -1 });
};

// Static method to get user statistics
UserSchema.statics.getUserStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
        verified: {
          $sum: {
            $cond: [{ $eq: ['$profile.verified', true] }, 1, 0]
          }
        },
        avgReputation: { $avg: '$reputation.score' }
      }
    }
  ]);
  
  return stats;
};

// Virtual for display name
UserSchema.virtual('displayName').get(function(this: IUser) {
  return this.profile?.name || 'Unknown User';
});

// Virtual for verification status
UserSchema.virtual('isFullyVerified').get(function(this: IUser) {
  return this.authentication.smsVerified && 
         this.authentication.emailVerified && 
         this.profile.verified;
});

// Instance method to get profile summary
UserSchema.methods.getProfileSummary = function(this: IUser) {
  return {
    id: this._id,
    name: this.profile.name,
    role: this.role,
    location: {
      country: this.profile.location.country,
      region: this.profile.location.region,
      city: this.profile.location.city
    },
    reputation: {
      score: this.reputation.score,
      rating: this.reputation.rating,
      transactionCount: this.reputation.transactionCount
    },
    verified: this.profile.verified,
    memberSince: this.createdAt,
    lastActive: this.lastActive
  };
};

// Interface for User model static methods
interface IUserModel extends Model<IUser> {
  findByLocation(
    longitude: number,
    latitude: number,
    radiusInKm?: number,
    role?: string
  ): any;
  
  findFarmersByLocation(
    longitude: number,
    latitude: number,
    radiusInKm?: number
  ): any;
  
  findBuyersByLocation(
    longitude: number,
    latitude: number,
    radiusInKm?: number
  ): any;
  
  getUserStats(): Promise<any[]>;
}

// Export the enhanced User model
export const User: IUserModel = mongoose.model<IUser, IUserModel>('User', UserSchema);
export default User;