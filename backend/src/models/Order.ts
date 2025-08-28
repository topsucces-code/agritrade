import mongoose, { Schema, Model } from 'mongoose';
import { IOrder, ILogistics, IContract, ILocation } from '../types';

// Location Schema (reused)
const LocationSchema = new Schema<ILocation>({
  country: { type: String, required: true },
  region: { type: String, required: true },
  city: { type: String, required: true },
  coordinates: {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 }
  },
  address: { type: String }
});

// Logistics Schema
const LogisticsSchema = new Schema<ILogistics>({
  transporterId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  vehicleType: {
    type: String,
    required: true,
    enum: ['truck', 'van', 'motorcycle', 'bicycle', 'boat', 'train']
  },
  estimatedDeliveryTime: {
    type: Number,
    required: true,
    min: 1 // minimum 1 hour
  },
  trackingNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  route: [LocationSchema],
  cost: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in_transit', 'delivered'],
    default: 'pending'
  }
});

// Contract Schema
const ContractSchema = new Schema<IContract>({
  terms: {
    type: String,
    required: true,
    maxlength: 5000
  },
  conditions: {
    type: String,
    required: true,
    maxlength: 3000
  },
  penaltyClause: {
    type: String,
    maxlength: 1000
  },
  signedByFarmer: {
    type: Boolean,
    default: false
  },
  signedByBuyer: {
    type: Boolean,
    default: false
  },
  farmerSignatureDate: {
    type: Date
  },
  buyerSignatureDate: {
    type: Date
  }
});

// Order Schema
const OrderSchema = new Schema<IOrder>({
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  farmerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
    validate: {
      validator: async function(v: string) {
        const User = mongoose.model('User');
        const user = await User.findById(v);
        return user && user.role === 'farmer';
      },
      message: 'farmerId must reference a valid farmer'
    }
  },
  buyerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
    validate: {
      validator: async function(v: string) {
        const User = mongoose.model('User');
        const user = await User.findById(v);
        return user && user.role === 'buyer';
      },
      message: 'buyerId must reference a valid buyer'
    }
  },
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: function(v: number) {
        return v > 0 && Number.isFinite(v);
      },
      message: 'Quantity must be a positive number'
    }
  },
  pricePerUnit: {
    type: Number,
    required: true,
    min: 0.01,
    validate: {
      validator: function(v: number) {
        return v > 0 && Number.isFinite(v);
      },
      message: 'Price per unit must be a positive number'
    }
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0.01
  },
  currency: {
    type: String,
    required: true,
    enum: ['USD', 'EUR', 'XOF', 'GHS', 'NGN', 'KES', 'TZS', 'UGX'],
    default: 'USD'
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'paid', 'shipped', 'delivered', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'mobile_money', 'cash', 'escrow'],
    required: true
  },
  deliveryMethod: {
    type: String,
    enum: ['pickup', 'delivery', 'shipping'],
    required: true
  },
  deliveryAddress: {
    type: LocationSchema
  },
  deliveryDate: {
    type: Date,
    validate: {
      validator: function(this: IOrder, v: Date) {
        // Delivery date should be in the future
        return !v || v > new Date();
      },
      message: 'Delivery date must be in the future'
    }
  },
  logistics: {
    type: LogisticsSchema
  },
  contract: {
    type: ContractSchema
  },
  notes: {
    type: String,
    maxlength: 2000
  }
}, {
  timestamps: true
});

// Indexes for performance
OrderSchema.index({ farmerId: 1, createdAt: -1 });
OrderSchema.index({ buyerId: 1, createdAt: -1 });
OrderSchema.index({ productId: 1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ orderNumber: 1 }, { unique: true });

// Compound indexes
OrderSchema.index({ farmerId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ buyerId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ status: 1, paymentStatus: 1 });

// Pre-save middleware to generate order number
OrderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Count orders created today
    const startOfDay = new Date(year, date.getMonth(), date.getDate());
    const endOfDay = new Date(year, date.getMonth(), date.getDate() + 1);
    
    const orderCount = await this.constructor.countDocuments({
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    });
    
    const sequence = String(orderCount + 1).padStart(4, '0');
    this.orderNumber = `AGT${year}${month}${day}${sequence}`;
  }
  
  next();
});

// Pre-save middleware to calculate total amount
OrderSchema.pre('save', function(next) {
  if (this.isModified('quantity') || this.isModified('pricePerUnit')) {
    this.totalAmount = Math.round((this.quantity * this.pricePerUnit) * 100) / 100;
  }
  next();
});

// Pre-save middleware to validate delivery address for delivery method
OrderSchema.pre('save', function(next) {
  if (this.deliveryMethod === 'delivery' && !this.deliveryAddress) {
    return next(new Error('Delivery address is required for delivery method'));
  }
  next();
});

// Pre-save middleware to validate logistics for shipping
OrderSchema.pre('save', function(next) {
  if (this.deliveryMethod === 'shipping' && this.status === 'shipped' && !this.logistics) {
    return next(new Error('Logistics information is required for shipped orders'));
  }
  next();
});

// Static method to find orders by farmer
OrderSchema.statics.findByFarmer = function(
  farmerId: string,
  status?: string,
  limit: number = 20
) {
  const query: any = { farmerId };
  if (status) {
    query.status = status;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('buyerId', 'profile.companyName profile.contactPerson profile.rating')
    .populate('productId', 'name type quantity unit qualityMetrics.grade');
};

// Static method to find orders by buyer
OrderSchema.statics.findByBuyer = function(
  buyerId: string,
  status?: string,
  limit: number = 20
) {
  const query: any = { buyerId };
  if (status) {
    query.status = status;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('farmerId', 'profile.firstName profile.lastName profile.farmName profile.rating')
    .populate('productId', 'name type quantity unit qualityMetrics.grade');
};

// Static method to get order statistics
OrderSchema.statics.getOrderStats = async function(
  userId?: string,
  userType?: 'farmer' | 'buyer',
  dateFrom?: Date,
  dateTo?: Date
) {
  const matchStage: any = {};
  
  if (userId) {
    if (userType === 'farmer') {
      matchStage.farmerId = new mongoose.Types.ObjectId(userId);
    } else if (userType === 'buyer') {
      matchStage.buyerId = new mongoose.Types.ObjectId(userId);
    }
  }
  
  if (dateFrom || dateTo) {
    matchStage.createdAt = {};
    if (dateFrom) matchStage.createdAt.$gte = dateFrom;
    if (dateTo) matchStage.createdAt.$lte = dateTo;
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalValue: { $sum: '$totalAmount' },
        averageOrderValue: { $avg: '$totalAmount' },
        statusDistribution: { $push: '$status' },
        paymentStatusDistribution: { $push: '$paymentStatus' },
        completedOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        pendingOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalOrders: 0,
    totalValue: 0,
    averageOrderValue: 0,
    statusDistribution: [],
    paymentStatusDistribution: [],
    completedOrders: 0,
    pendingOrders: 0
  };
};

// Instance method to check if order can be cancelled
OrderSchema.methods.canBeCancelled = function(): boolean {
  const cancellableStatuses = ['pending', 'accepted'];
  return cancellableStatuses.includes(this.status);
};

// Instance method to check if order can be accepted
OrderSchema.methods.canBeAccepted = function(): boolean {
  return this.status === 'pending';
};

// Instance method to check if order can be shipped
OrderSchema.methods.canBeShipped = function(): boolean {
  return this.status === 'paid' && this.paymentStatus === 'paid';
};

// Instance method to check if order can be delivered
OrderSchema.methods.canBeDelivered = function(): boolean {
  return this.status === 'shipped';
};

// Instance method to check if order can be completed
OrderSchema.methods.canBeCompleted = function(): boolean {
  return this.status === 'delivered';
};

// Instance method to get order summary
OrderSchema.methods.getOrderSummary = function() {
  return {
    id: this._id,
    orderNumber: this.orderNumber,
    status: this.status,
    paymentStatus: this.paymentStatus,
    totalAmount: this.totalAmount,
    currency: this.currency,
    quantity: this.quantity,
    deliveryMethod: this.deliveryMethod,
    deliveryDate: this.deliveryDate,
    createdAt: this.createdAt,
    canBeCancelled: this.canBeCancelled(),
    canBeAccepted: this.canBeAccepted(),
    canBeShipped: this.canBeShipped(),
    canBeDelivered: this.canBeDelivered(),
    canBeCompleted: this.canBeCompleted()
  };
};

// Instance method to calculate delivery timeline
OrderSchema.methods.getDeliveryTimeline = function() {
  const events = [];
  
  events.push({
    status: 'pending',
    date: this.createdAt,
    completed: true,
    description: 'Order placed'
  });

  if (this.status !== 'pending') {
    events.push({
      status: 'accepted',
      date: this.updatedAt,
      completed: ['accepted', 'paid', 'shipped', 'delivered', 'completed'].includes(this.status),
      description: 'Order accepted by farmer'
    });
  }

  if (['paid', 'shipped', 'delivered', 'completed'].includes(this.status)) {
    events.push({
      status: 'paid',
      date: this.updatedAt,
      completed: true,
      description: 'Payment confirmed'
    });
  }

  if (['shipped', 'delivered', 'completed'].includes(this.status)) {
    events.push({
      status: 'shipped',
      date: this.updatedAt,
      completed: true,
      description: 'Order shipped'
    });
  }

  if (['delivered', 'completed'].includes(this.status)) {
    events.push({
      status: 'delivered',
      date: this.deliveryDate || this.updatedAt,
      completed: true,
      description: 'Order delivered'
    });
  }

  if (this.status === 'completed') {
    events.push({
      status: 'completed',
      date: this.updatedAt,
      completed: true,
      description: 'Order completed'
    });
  }

  return events;
};

// Virtual for order age
OrderSchema.virtual('orderAge').get(function() {
  const now = new Date();
  const diffMs = now.getTime() - this.createdAt.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
});

// Virtual for estimated delivery
OrderSchema.virtual('estimatedDelivery').get(function() {
  if (!this.logistics || !this.logistics.estimatedDeliveryTime) {
    return null;
  }
  
  const shippedDate = this.status === 'shipped' ? this.updatedAt : new Date();
  const estimatedDate = new Date(shippedDate.getTime() + (this.logistics.estimatedDeliveryTime * 60 * 60 * 1000));
  
  return estimatedDate;
});

// Virtual for contract status
OrderSchema.virtual('contractStatus').get(function() {
  if (!this.contract) {
    return 'not_created';
  }
  
  if (this.contract.signedByFarmer && this.contract.signedByBuyer) {
    return 'fully_signed';
  }
  
  if (this.contract.signedByFarmer || this.contract.signedByBuyer) {
    return 'partially_signed';
  }
  
  return 'pending_signature';
});

// Interface for Order model static methods
interface IOrderModel extends Model<IOrder> {
  getOrderStats(
    userId?: string,
    userType?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<any>;
}

// Create and export the model
export const Order: IOrderModel = mongoose.model<IOrder, IOrderModel>('Order', OrderSchema);
export default Order;