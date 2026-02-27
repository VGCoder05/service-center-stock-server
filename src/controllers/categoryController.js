const SerialNumber = require('../models/SerialNumber');
const CategoryMovement = require('../models/CategoryMovement');
const Bill = require('../models/Bill');

// Category validation rules
const CATEGORY_RULES = {
  IN_STOCK: {
    requiredFields: [],
    optionalFields: ['location', 'remarks']
  },
  SPU_PENDING: {
    requiredFields: ['spuId', 'ticketId', 'customerName', 'spuDate'],
    optionalFields: ['customerContact', 'productModel', 'productSerialNumber', 'isChargeable', 'chargeAmount', 'chargeReason', 'paymentStatus', 'remarks']
  },
  SPU_CLEARED: {
    requiredFields: ['spuId', 'ticketId', 'customerName', 'spuDate'],
    optionalFields: ['customerContact', 'productModel', 'productSerialNumber', 'isChargeable', 'chargeAmount', 'chargeReason', 'paymentStatus', 'paymentDate', 'paymentMode', 'remarks']
  },
  AMC: {
    requiredFields: ['customerName'],
    optionalFields: ['amcNumber', 'amcServiceDate', 'ticketId', 'isChargeable', 'chargeAmount', 'chargeReason', 'paymentStatus', 'remarks']
  },
  OG: {
    requiredFields: ['customerName', 'cashAmount', 'paymentStatus'],
    optionalFields: ['ticketId', 'productModel', 'productSerialNumber', 'paymentDate', 'paymentMode', 'remarks']
  },
  RETURN: {
    requiredFields: ['returnReason'],
    optionalFields: ['expectedReturnDate', 'returnApproved', 'returnedToSupplier', 'returnDate', 'remarks']
  },
  RECEIVED_FOR_OTHERS: {
    requiredFields: ['receivedFor'],
    optionalFields: ['transferStatus', 'transferDate', 'remarks']
  },
  UNCATEGORIZED: {
    requiredFields: [],
    optionalFields: ['remarks']
  }
};

// ===================
// @desc    Categorize a serial number
// @route   PUT /api/v1/categories/categorize/:id
// @access  Private (Admin, Operator)
// ===================
exports.categorizeSerial = async (req, res, next) => {
  try {
    const { category, context, reason } = req.body;

    // Validate category
    if (!category || !CATEGORY_RULES[category]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category'
      });
    }

    // Find serial number
    const serial = await SerialNumber.findById(req.params.id);
    if (!serial) {
      return res.status(404).json({
        success: false,
        error: 'Serial number not found'
      });
    }

    // Validate required fields for category
    const rules = CATEGORY_RULES[category];
    const missingFields = [];
    
    for (const field of rules.requiredFields) {
      if (!context || !context[field]) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields for ${category}: ${missingFields.join(', ')}`
      });
    }

    // Determine movement type
    let movementType = 'CATEGORY_CHANGE';
    if (serial.currentCategory === 'UNCATEGORIZED' && category !== 'UNCATEGORIZED') {
      movementType = 'CATEGORIZED';
    } else if (serial.currentCategory === category) {
      movementType = 'CONTEXT_UPDATE';
    }

    const previousCategory = serial.currentCategory;
    const previousContext = { ...serial.context };

    // Update serial number
    serial.currentCategory = category;
    serial.context = {
      ...serial.context,
      ...context
    };
    serial.lastCategoryChange = new Date();
    
    if (previousCategory === 'UNCATEGORIZED' && category !== 'UNCATEGORIZED') {
      serial.categorizedDate = new Date();
    }

    await serial.save();

    // Create movement record
    await CategoryMovement.createMovement({
      serialNumberId: serial._id,
      serialNumber: serial.serialNumber,
      billId: serial.billId,
      voucherNumber: serial.voucherNumber,
      movementType,
      fromCategory: previousCategory,
      toCategory: category,
      contextSnapshot: context,
      reason,
      performedBy: req.user.id,
      performedByName: req.user.fullName
    });

    // Update bill summary
    const bill = await Bill.findById(serial.billId);
    if (bill) {
      await bill.updateCategorySummary();
    }

    res.status(200).json({
      success: true,
      message: `Serial number categorized as ${category}`,
      data: serial
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Bulk categorize serial numbers
// @route   PUT /api/v1/categories/bulk-categorize
// @access  Private (Admin, Operator)
// ===================
exports.bulkCategorize = async (req, res, next) => {
  try {
    const { serialIds, category, context, reason } = req.body;

    if (!serialIds || !Array.isArray(serialIds) || serialIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Serial IDs array is required'
      });
    }

    if (!category || !CATEGORY_RULES[category]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category'
      });
    }

    // Validate required fields
    const rules = CATEGORY_RULES[category];
    const missingFields = [];
    
    for (const field of rules.requiredFields) {
      if (!context || !context[field]) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields for ${category}: ${missingFields.join(', ')}`
      });
    }

    // Process each serial
    const results = [];
    const billIds = new Set();

    for (const serialId of serialIds) {
      try {
        const serial = await SerialNumber.findById(serialId);
        if (!serial) {
          results.push({ serialId, success: false, error: 'Not found' });
          continue;
        }

        const previousCategory = serial.currentCategory;
        let movementType = 'CATEGORY_CHANGE';
        if (previousCategory === 'UNCATEGORIZED' && category !== 'UNCATEGORIZED') {
          movementType = 'CATEGORIZED';
        } else if (previousCategory === category) {
          movementType = 'CONTEXT_UPDATE';
        }

        // Update serial
        serial.currentCategory = category;
        serial.context = { ...serial.context, ...context };
        serial.lastCategoryChange = new Date();
        
        if (previousCategory === 'UNCATEGORIZED' && category !== 'UNCATEGORIZED') {
          serial.categorizedDate = new Date();
        }

        await serial.save();
        billIds.add(serial.billId.toString());

        // Create movement record
        await CategoryMovement.createMovement({
          serialNumberId: serial._id,
          serialNumber: serial.serialNumber,
          billId: serial.billId,
          voucherNumber: serial.voucherNumber,
          movementType,
          fromCategory: previousCategory,
          toCategory: category,
          contextSnapshot: context,
          reason,
          performedBy: req.user.id,
          performedByName: req.user.fullName
        });

        results.push({ serialId, success: true, serialNumber: serial.serialNumber });
      } catch (err) {
        results.push({ serialId, success: false, error: err.message });
      }
    }

    // Update all affected bills
    for (const billId of billIds) {
      const bill = await Bill.findById(billId);
      if (bill) {
        await bill.updateCategorySummary();
      }
    }

    const successCount = results.filter(r => r.success).length;

    res.status(200).json({
      success: true,
      message: `${successCount} of ${serialIds.length} serial numbers categorized`,
      data: results
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Get movement history for a serial
// @route   GET /api/v1/categories/history/:serialId
// @access  Private
// ===================
exports.getMovementHistory = async (req, res, next) => {
  try {
    const movements = await CategoryMovement.getHistory(req.params.serialId);

    res.status(200).json({
      success: true,
      data: movements,
      count: movements.length
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Get serials by category
// @route   GET /api/v1/categories/:category/serials
// @access  Private
// ===================
exports.getSerialsByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const {
      search,
      startDate,
      endDate,
      page = 1,
      limit = 25,
      sortBy = 'billDate',
      sortOrder = 'desc'
    } = req.query;

    // Validate category
    if (!CATEGORY_RULES[category]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category'
      });
    }

    // Build query
    const query = { currentCategory: category };

    // Search filter
    if (search) {
      query.$or = [
        { serialNumber: { $regex: search, $options: 'i' } },
        { partName: { $regex: search, $options: 'i' } },
        { voucherNumber: { $regex: search, $options: 'i' } },
        { 'context.customerName': { $regex: search, $options: 'i' } },
        { 'context.spuId': { $regex: search, $options: 'i' } }
      ];
    }

    // Date range filter (by bill date)
    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) {
        query.billDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.billDate.$lte = end;
      }
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Execute query
    const [serials, total] = await Promise.all([
      SerialNumber.find(query)
        .populate('billId', 'voucherNumber billDate')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      SerialNumber.countDocuments(query)
    ]);

    // Calculate total value
    const totalValue = await SerialNumber.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$unitPrice' } } }
    ]);

    res.status(200).json({
      success: true,
      data: serials,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      summary: {
        count: total,
        totalValue: totalValue[0]?.total || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Get category summary (dashboard)
// @route   GET /api/v1/categories/summary
// @access  Private
// ===================
exports.getCategorySummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Build match stage
    const matchStage = {};
    if (startDate || endDate) {
      matchStage.billDate = {};
      if (startDate) {
        matchStage.billDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchStage.billDate.$lte = end;
      }
    }

    const summary = await SerialNumber.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$currentCategory',
          count: { $sum: 1 },
          totalValue: { $sum: '$unitPrice' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format response
    const categories = {
      IN_STOCK: { count: 0, totalValue: 0 },
      SPU_PENDING: { count: 0, totalValue: 0 },
      SPU_CLEARED: { count: 0, totalValue: 0 },
      AMC: { count: 0, totalValue: 0 },
      OG: { count: 0, totalValue: 0 },
      RETURN: { count: 0, totalValue: 0 },
      RECEIVED_FOR_OTHERS: { count: 0, totalValue: 0 },
      UNCATEGORIZED: { count: 0, totalValue: 0 }
    };

    let totalCount = 0;
    let totalValue = 0;

    summary.forEach(item => {
      if (categories[item._id] !== undefined) {
        categories[item._id] = {
          count: item.count,
          totalValue: item.totalValue
        };
        totalCount += item.count;
        totalValue += item.totalValue;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        categories,
        total: {
          count: totalCount,
          totalValue
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Update payment status
// @route   PUT /api/v1/categories/payment/:id
// @access  Private (Admin, Operator)
// ===================
exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { paymentStatus, paymentDate, paymentMode, notes } = req.body;

    const serial = await SerialNumber.findById(req.params.id);
    if (!serial) {
      return res.status(404).json({
        success: false,
        error: 'Serial number not found'
      });
    }

    // Check if serial has chargeable context
    if (!serial.context?.isChargeable && serial.currentCategory !== 'OG') {
      return res.status(400).json({
        success: false,
        error: 'This serial number is not chargeable'
      });
    }

    const previousPaymentStatus = serial.context?.paymentStatus;

    // Update payment info
    serial.context = {
      ...serial.context,
      paymentStatus,
      paymentDate: paymentDate || (paymentStatus === 'PAID' ? new Date() : serial.context?.paymentDate),
      paymentMode: paymentMode || serial.context?.paymentMode
    };

    await serial.save();

    // Create movement record
    await CategoryMovement.createMovement({
      serialNumberId: serial._id,
      serialNumber: serial.serialNumber,
      billId: serial.billId,
      voucherNumber: serial.voucherNumber,
      movementType: 'PAYMENT_UPDATE',
      fromCategory: serial.currentCategory,
      toCategory: serial.currentCategory,
      contextSnapshot: { paymentStatus, paymentDate, paymentMode },
      reason: `Payment status changed from ${previousPaymentStatus || 'N/A'} to ${paymentStatus}`,
      notes,
      performedBy: req.user.id,
      performedByName: req.user.fullName
    });

    res.status(200).json({
      success: true,
      message: 'Payment status updated',
      data: serial
    });
  } catch (error) {
    next(error);
  }
};