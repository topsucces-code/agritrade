import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { AppError, ValidationError, NotFoundError, AuthorizationError, ConflictError } from '../middleware/errorHandler';
import { getCurrentUser } from '../middleware/authentication';
import { cache } from '../config/redis';
import CommunicationService from '../services/communicationService';
import mongoose from 'mongoose';

// Initialize communication service
const communicationService = new CommunicationService();

export default async function orderRoutes(app: FastifyInstance) {

  // Create a new order
  app.post('/', {
    schema: {
      description: 'Create a new order (buyers only)',
      tags: ['Orders'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['productId', 'quantity', 'paymentMethod', 'deliveryMethod'],
        properties: {
          productId: { type: 'string' },
          quantity: { type: 'number', minimum: 1 },
          pricePerUnit: { type: 'number', minimum: 0.01 },
          paymentMethod: { type: 'string', enum: ['bank_transfer', 'mobile_money', 'cash', 'escrow'] },
          deliveryMethod: { type: 'string', enum: ['pickup', 'delivery', 'shipping'] },
          deliveryAddress: {
            type: 'object',
            properties: {
              country: { type: 'string' },
              region: { type: 'string' },
              city: { type: 'string' },
              coordinates: {
                type: 'object',
                properties: {
                  latitude: { type: 'number', minimum: -90, maximum: 90 },
                  longitude: { type: 'number', minimum: -180, maximum: 180 }
                }
              },
              address: { type: 'string' }
            }
          },
          deliveryDate: { type: 'string', format: 'date' },
          notes: { type: 'string', maxLength: 2000 }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      
      if (!user || user.role !== 'buyer') {
        throw new AuthorizationError('Only buyers can create orders');
      }

      const {
        productId,
        quantity,
        pricePerUnit,
        paymentMethod,
        deliveryMethod,
        deliveryAddress,
        deliveryDate,
        notes
      } = request.body as any;

      // Get product details
      const product = await Product.findById(productId).populate('farmerId');
      
      if (!product) {
        throw new NotFoundError('Product not found');
      }

      if (product.status !== 'available') {
        throw new ConflictError('Product is not available for purchase');
      }

      if (product.quantity < quantity) {
        throw new ConflictError(`Insufficient quantity. Available: ${product.quantity.available} ${product.quantity.unit}`);
      }

      // Use product price if not specified
      const finalPricePerUnit = pricePerUnit || product.pricing.finalPrice;

      // Validate delivery address for delivery method
      if (deliveryMethod === 'delivery' && !deliveryAddress) {
        throw new ValidationError('Delivery address is required for delivery method');
      }

      // Create order
      const orderData: any = {
        farmerId: product.farmerId._id,
        buyerId: user._id,
        productId: product._id,
        quantity,
        pricePerUnit: finalPricePerUnit,
        currency: product.pricing.currency,
        paymentMethod,
        deliveryMethod,
        notes
      };

      if (deliveryAddress) {
        orderData.deliveryAddress = deliveryAddress;
      }

      if (deliveryDate) {
        orderData.deliveryDate = new Date(deliveryDate);
      }

      const order = new Order(orderData);
      await order.save();

      // Reserve product quantity
      await Product.findByIdAndUpdate(productId, {
        $inc: { quantity: -quantity },
        status: product.quantity === quantity ? 'reserved' : 'available'
      });

      // Populate order for response
      const populatedOrder = await Order.findById(order._id)
        .populate('farmerId', 'profile.firstName profile.lastName profile.farmName profile.phone')
        .populate('buyerId', 'profile.companyName profile.contactPerson profile.phone')
        .populate('productId', 'name type qualityMetrics.grade images');

      // Send notification to farmer
      const farmer = await User.findById(product.farmerId);
      if (farmer && farmer.phoneNumber) {
        await communicationService.sendOrderSMS(
          farmer.phoneNumber,
          order.orderNumber,
          'received',
          product.farmerId._id.toString(),
          user._id.toString()
        );
      }

      return reply.code(201).send({
        success: true,
        message: 'Order created successfully',
        data: populatedOrder
      });

    } catch (error) {
      throw error;
    }
  });

  // Get orders (farmer or buyer perspective)
  app.get('/', {
    schema: {
      description: 'Get orders for authenticated user',
      tags: ['Orders'],
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'accepted', 'rejected', 'paid', 'shipped', 'delivered', 'completed', 'cancelled'] },
          paymentStatus: { type: 'string', enum: ['pending', 'paid', 'failed', 'refunded'] },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          sortBy: { type: 'string', enum: ['createdAt', 'totalAmount', 'status'], default: 'createdAt' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { status, paymentStatus, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = request.query as any;

      if (!user) {
        throw new AuthorizationError('Authentication required');
      }

      // Build query based on user type
      const query: any = {};
      if (user.role === 'farmer') {
        query.farmerId = user._id;
      } else if (user.role === 'buyer') {
        query.buyerId = user._id;
      }

      if (status) query.status = status;
      if (paymentStatus) query.paymentStatus = paymentStatus;

      // Sorting
      const sortOptions: any = {};
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const skip = (page - 1) * limit;

      const [orders, total] = await Promise.all([
        Order.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .populate('farmerId', 'profile.firstName profile.lastName profile.farmName profile.rating profile.phone')
          .populate('buyerId', 'profile.companyName profile.contactPerson profile.rating profile.phone')
          .populate('productId', 'name type qualityMetrics.grade images'),
        Order.countDocuments(query)
      ]);

      const pages = Math.ceil(total / limit);

      return reply.send({
        success: true,
        data: orders.map(order => (order as any).getOrderSummary()),
        pagination: {
          page,
          limit,
          total,
          pages,
          hasNext: page < pages,
          hasPrev: page > 1
        }
      });

    } catch (error) {
      throw error;
    }
  });

  // Get order by ID
  app.get<{ Params: { orderId: string } }>('/:orderId', {
    schema: {
      tags: ['Orders'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        required: ['orderId'],
        properties: {
          orderId: { type: 'string' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest<{ Params: { orderId: string } }>, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { orderId } = request.params;

      const order = await Order.findById(orderId)
        .populate('farmerId', 'profile.firstName profile.lastName profile.farmName profile.rating profile.phone location')
        .populate('buyerId', 'profile.companyName profile.contactPerson profile.rating profile.phone location')
        .populate('productId', 'name type description qualityMetrics images storageConditions certifications');

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      // Check access permissions
      const hasAccess = user && user.role === 'farmer' ? 
        order.farmerId._id.toString() === user._id.toString() :
        user ? order.buyerId._id.toString() === user._id.toString() : false;

      if (!hasAccess) {
        throw new AuthorizationError('You can only view your own orders');
      }

      return reply.send({
        success: true,
        data: {
          ...order.toJSON(),
          timeline: (order as any).getDeliveryTimeline(),
          estimatedDelivery: (order as any).estimatedDelivery,
          contractStatus: (order as any).contractStatus
        }
      });

    } catch (error) {
      throw error;
    }
  });

  // Update order status (farmers and buyers)
  app.put<{ Params: { orderId: string } }>('/:orderId/status', {
    schema: {
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        required: ['orderId'],
        properties: {
          orderId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['accepted', 'rejected', 'paid', 'shipped', 'delivered', 'completed', 'cancelled'] },
          reason: { type: 'string', maxLength: 500 },
          logistics: {
            type: 'object',
            properties: {
              transporterId: { type: 'string' },
              vehicleType: { type: 'string', enum: ['truck', 'van', 'motorcycle', 'bicycle', 'boat', 'train'] },
              estimatedDeliveryTime: { type: 'number', minimum: 1 },
              trackingNumber: { type: 'string' },
              cost: { type: 'number', minimum: 0 }
            }
          }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest<{ Params: { orderId: string } }>, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { orderId } = request.params;
      const { status, reason, logistics } = request.body as any;

      const order = await Order.findById(orderId);

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      // Check permissions based on status change
      let hasPermission = false;
      if (user && user.role === 'farmer') {
        hasPermission = order.farmerId.toString() === user._id.toString() &&
          ['accepted', 'rejected', 'shipped'].includes(status);
      } else if (user && user.role === 'buyer') {
        hasPermission = order.buyerId.toString() === user._id.toString() &&
          ['paid', 'delivered', 'completed', 'cancelled'].includes(status);
      }

      if (!hasPermission) {
        throw new AuthorizationError('You do not have permission to update this order status');
      }

      // Validate status transitions
      const validTransitions: { [key: string]: string[] } = {
        'pending': ['accepted', 'rejected'],
        'accepted': ['paid', 'cancelled'],
        'paid': ['shipped', 'cancelled'],
        'shipped': ['delivered', 'cancelled'],
        'delivered': ['completed'],
        'completed': [],
        'rejected': [],
        'cancelled': []
      };

      if (!validTransitions[order.status]?.includes(status)) {
        throw new ConflictError(`Cannot change status from ${order.status} to ${status}`);
      }

      // Handle specific status changes
      const updateData: any = { status };

      if (status === 'rejected' && reason) {
        updateData.notes = `Rejection reason: ${reason}`;
        
        // Restore product quantity
        await Product.findByIdAndUpdate(order.productId, {
          $inc: { quantity: order.quantity },
          status: 'available'
        });
      }

      if (status === 'shipped' && logistics) {
        updateData.logistics = logistics;
        if (logistics.trackingNumber) {
          updateData['logistics.trackingNumber'] = logistics.trackingNumber;
        }
      }

      if (status === 'paid') {
        updateData.paymentStatus = 'paid';
      }

      if (status === 'cancelled') {
        // Restore product quantity
        await Product.findByIdAndUpdate(order.productId, {
          $inc: { quantity: order.quantity },
          status: 'available'
        });
      }

      if (status === 'completed') {
        // Mark product as sold if this was the complete quantity
        const product = await Product.findById(order.productId);
        if (product && product.quantity.available === 0) {
          await Product.findByIdAndUpdate(order.productId, { status: 'sold' });
        }
      }

      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        updateData,
        { new: true, runValidators: true }
      ).populate('farmerId', 'profile.firstName profile.lastName profile.farmName profile.phone')
        .populate('buyerId', 'profile.companyName profile.contactPerson profile.phone')
        .populate('productId', 'name type');

      // Send notification to other party
      if (user) {
        const otherPartyId = user.role === 'farmer' ? order.buyerId : order.farmerId;
        const otherParty = await User.findById(otherPartyId);
        if (otherParty && otherParty.phoneNumber) {
          await communicationService.sendOrderSMS(
            otherParty.phoneNumber,
            order.orderNumber,
            status,
            order.farmerId.toString(),
            order.buyerId.toString()
          );
        }
      }

      return reply.send({
        success: true,
        message: `Order status updated to ${status}`,
        data: updatedOrder
      });

    } catch (error) {
      throw error;
    }
  });

  // Cancel order
  app.put<{ Params: { orderId: string } }>('/:orderId/cancel', {
    schema: {
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        required: ['orderId'],
        properties: {
          orderId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string', maxLength: 500 }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest<{ Params: { orderId: string } }>, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { orderId } = request.params;
      const { reason } = request.body as any;

      const order = await Order.findById(orderId);

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      // Check permissions
      const hasPermission = 
        (user && user.role === 'farmer' && order.farmerId.toString() === user._id.toString()) ||
        (user && user.role === 'buyer' && order.buyerId.toString() === user._id.toString());

      if (!hasPermission) {
        throw new AuthorizationError('You can only cancel your own orders');
      }

      if (!(order as any).canBeCancelled()) {
        throw new ConflictError('Order cannot be cancelled in its current status');
      }

      // Cancel order
      const updateData: any = { 
        status: 'cancelled',
        notes: reason ? `Cancelled: ${reason}` : 'Order cancelled'
      };

      await Order.findByIdAndUpdate(orderId, updateData);

      // Restore product quantity
      await Product.findByIdAndUpdate(order.productId, {
        $inc: { quantity: order.quantity },
        status: 'available'
      });

      // Send notification to other party
      if (user) {
        const otherPartyId = user.role === 'farmer' ? order.buyerId : order.farmerId;
        const otherParty = await User.findById(otherPartyId);
        if (otherParty && otherParty.phoneNumber) {
          await communicationService.sendOrderSMS(
            otherParty.phoneNumber,
            order.orderNumber,
            'cancelled',
            order.farmerId.toString(),
            order.buyerId.toString()
          );
        }
      }

      return reply.send({
        success: true,
        message: 'Order cancelled successfully'
      });

    } catch (error) {
      throw error;
    }
  });

  // Create contract for order
  app.post<{ Params: { orderId: string } }>('/:orderId/contract', {
    schema: {
      params: {
        type: 'object',
        required: ['orderId'],
        properties: {
          orderId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['terms', 'conditions'],
        properties: {
          terms: { type: 'string', maxLength: 5000 },
          conditions: { type: 'string', maxLength: 3000 },
          penaltyClause: { type: 'string', maxLength: 1000 }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest<{ Params: { orderId: string } }>, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { orderId } = request.params;
      const { terms, conditions, penaltyClause } = request.body as any;

      const order = await Order.findById(orderId);

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      // Only farmers can create contracts for their orders
      if (!user) {
        throw new AuthorizationError('Only the farmer can create a contract for this order');
      }
      if (user.role !== 'farmer') {
        throw new AuthorizationError('Only the farmer can create a contract for this order');
      }
      if (order.farmerId.toString() !== user._id.toString()) {
        throw new AuthorizationError('Only the farmer can create a contract for this order');
      }

      if (order.status !== 'accepted') {
        throw new ConflictError('Contract can only be created for accepted orders');
      }

      if (order.contract) {
        throw new ConflictError('Contract already exists for this order');
      }

      const contractData = {
        terms,
        conditions,
        penaltyClause
      };

      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { contract: contractData },
        { new: true, runValidators: true }
      );

      // Notify buyer about contract
      const buyer = await User.findById(order.buyerId);
      if (buyer && buyer.phoneNumber) {
        await communicationService.sendOrderSMS(
          buyer.phoneNumber,
          order.orderNumber,
          'contract_created',
          order.farmerId.toString(),
          order.buyerId.toString()
        );
      }

      return reply.send({
        success: true,
        message: 'Contract created successfully',
        data: updatedOrder?.contract
      });

    } catch (error) {
      throw error;
    }
  });

  // Sign contract
  app.put<{ Params: { orderId: string } }>('/:orderId/contract/sign', {
    schema: {
      params: {
        type: 'object',
        required: ['orderId'],
        properties: {
          orderId: { type: 'string' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest<{ Params: { orderId: string } }>, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { orderId } = request.params;

      const order = await Order.findById(orderId);

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      if (!order.contract) {
        throw new ConflictError('No contract exists for this order');
      }

      // Check permissions
      let isFarmer = false;
      let isBuyer = false;
      
      if (user) {
        if (user.role === 'farmer') {
          isFarmer = order.farmerId.toString() === user._id.toString();
        }
        if (user.role === 'buyer') {
          isBuyer = order.buyerId.toString() === user._id.toString();
        }
      }

      if (!isFarmer && !isBuyer) {
        throw new AuthorizationError('You can only sign contracts for your own orders');
      }

      // Update signature
      const updateData: any = {};
      if (isFarmer) {
        if (order.contract.signatures.farmer.signed) {
          throw new ConflictError('Farmer has already signed this contract');
        }
        updateData['contract.signedByFarmer'] = true;
        updateData['contract.farmerSignatureDate'] = new Date();
      } else {
        if (order.contract.signatures.buyer.signed) {
          throw new ConflictError('Buyer has already signed this contract');
        }
        updateData['contract.signedByBuyer'] = true;
        updateData['contract.buyerSignatureDate'] = new Date();
      }

      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        updateData,
        { new: true, runValidators: true }
      );

      // Check if contract is fully signed
      const contract = updatedOrder?.contract;
      if (contract?.signatures.farmer.signed && contract?.signatures.buyer.signed) {
        // Notify both parties that contract is fully executed
        const [farmer, buyer] = await Promise.all([
          User.findById(order.farmerId),
          User.findById(order.buyerId)
        ]);
        
        if (farmer && farmer.phoneNumber) {
          await communicationService.sendOrderSMS(
            farmer.phoneNumber,
            order.orderNumber,
            'contract_signed',
            order.farmerId.toString(),
            order.buyerId.toString()
          );
        }
        
        if (buyer && buyer.phoneNumber) {
          await communicationService.sendOrderSMS(
            buyer.phoneNumber,
            order.orderNumber,
            'contract_signed',
            order.farmerId.toString(),
            order.buyerId.toString()
          );
        }
      } else {
        // Notify the other party that contract has been signed
        const otherPartyId = isFarmer ? order.buyerId : order.farmerId;
        const otherParty = await User.findById(otherPartyId);
        if (otherParty && otherParty.phoneNumber) {
          await communicationService.sendOrderSMS(
            otherParty.phoneNumber,
            order.orderNumber,
            'contract_partially_signed',
            order.farmerId.toString(),
            order.buyerId.toString()
          );
        }
      }

      return reply.send({
        success: true,
        message: 'Contract signed successfully',
        data: {
          contractStatus: updatedOrder?.status,
          fullyExecuted: contract?.signatures.farmer.signed && contract?.signatures.buyer.signed
        }
      });

    } catch (error) {
      throw error;
    }
  });

  // Get order statistics
  app.get('/statistics', {
    schema: {
      description: 'Get order statistics for authenticated user',
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['week', 'month', 'quarter', 'year'], default: 'month' }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const { period = 'month' } = request.query as any;

      if (!user) {
        throw new AuthorizationError('Authentication required');
      }

      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      const stats = await Order.getOrderStats(
        user._id.toString(),
        user.role,
        startDate,
        endDate
      );

      return reply.send({
        success: true,
        data: {
          ...stats,
          period,
          userType: user.role
        }
      });

    } catch (error) {
      throw error;
    }
  });

  // Search orders
  app.get('/search', {
    schema: {
      description: 'Search orders with filters',
      querystring: {
        type: 'object',
        properties: {
          orderNumber: { type: 'string' },
          productType: { type: 'string', enum: ['cocoa', 'coffee', 'cotton', 'peanuts', 'cashew', 'palm_oil'] },
          status: { type: 'string', enum: ['pending', 'accepted', 'rejected', 'paid', 'shipped', 'delivered', 'completed', 'cancelled'] },
          minAmount: { type: 'number', minimum: 0 },
          maxAmount: { type: 'number', minimum: 0 },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 }
        }
      }
    },
    preHandler: app.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getCurrentUser(request);
      const {
        orderNumber,
        productType,
        status,
        minAmount,
        maxAmount,
        dateFrom,
        dateTo,
        page = 1,
        limit = 20
      } = request.query as any;

      if (!user) {
        throw new AuthorizationError('Authentication required');
      }

      // Base query for user's orders
      const query: any = {};
      if (user.role === 'farmer') {
        query.farmerId = user._id;
      } else {
        query.buyerId = user._id;
      }

      // Apply filters
      if (orderNumber) {
        query.orderNumber = { $regex: orderNumber, $options: 'i' };
      }
      if (status) query.status = status;
      if (minAmount !== undefined) query.totalAmount = { ...query.totalAmount, $gte: minAmount };
      if (maxAmount !== undefined) query.totalAmount = { ...query.totalAmount, $lte: maxAmount };
      
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      // Handle product type filter (requires population)
      let aggregationPipeline: any[] = [
        { $match: query }
      ];

      if (productType) {
        aggregationPipeline.push(
          {
            $lookup: {
              from: 'products',
              localField: 'productId',
              foreignField: '_id',
              as: 'product'
            }
          },
          {
            $match: {
              'product.type': productType
            }
          }
        );
      }

      aggregationPipeline.push(
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'farmerId',
            foreignField: '_id',
            as: 'farmer'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'buyerId',
            foreignField: '_id',
            as: 'buyer'
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product'
          }
        }
      );

      const [orders, totalResults] = await Promise.all([
        Order.aggregate(aggregationPipeline),
        Order.countDocuments(query)
      ]);

      const pages = Math.ceil(totalResults / limit);

      return reply.send({
        success: true,
        data: orders,
        pagination: {
          page,
          limit,
          total: totalResults,
          pages,
          hasNext: page < pages,
          hasPrev: page > 1
        }
      });

    } catch (error) {
      throw error;
    }
  });
}