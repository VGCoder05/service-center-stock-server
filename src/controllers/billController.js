const Bill = require('../models/Bill');
const Supplier = require('../models/Supplier');

// ===================
// @desc    Get all bills
// @route   GET /api/v1/bills
// @access  Private
// ===================
exports.getBills = async (req, res, next) => {
  try {
    const {
      search,
      supplierId,
      startDate,
      endDate,
      isFullyCategorized,
      page = 1,
      limit = 25,
      sortBy = 'billDate',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { voucherNumber: { $regex: search, $options: 'i' } },
        { companyBillNumber: { $regex: search, $options: 'i' } },
        { supplierName: { $regex: search, $options: 'i' } }
      ];
    }

    // Supplier filter
    if (supplierId) {
      query.supplierId = supplierId;
    }

    // Date range filter
    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) {
        query.billDate.$gte = new Date(startDate);
      }
      if (endDate) {
        // Set to end of day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.billDate.$lte = end;
      }
    }

    // Categorization status filter
    if (isFullyCategorized !== undefined) {
      query.isFullyCategorized = isFullyCategorized === 'true';
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Execute query
    const [bills, total] = await Promise.all([
      Bill.find(query)
        .populate('supplierId', 'supplierCode supplierName')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Bill.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: bills,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Get single bill
// @route   GET /api/v1/bills/:id
// @access  Private
// ===================
exports.getBill = async (req, res, next) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('supplierId', 'supplierCode supplierName contactPerson phone')
      .populate('receivedBy', 'fullName email');

    if (!bill) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    res.status(200).json({
      success: true,
      data: bill
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Create bill
// @route   POST /api/v1/bills
// @access  Private (Admin, Operator)
// ===================
exports.createBill = async (req, res, next) => {
  try {
    const {
      voucherNumber,
      companyBillNumber,
      billDate,
      supplierId,
      totalBillAmount,
      notes
    } = req.body;

    // Check for duplicate voucher number
    const existingBill = await Bill.findOne({ voucherNumber: voucherNumber.toUpperCase() });
    if (existingBill) {
      return res.status(400).json({
        success: false,
        error: 'Voucher number already exists'
      });
    }

    // Get supplier details for denormalization
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      return res.status(400).json({
        success: false,
        error: 'Supplier not found'
      });
    }

    // Create bill
    const bill = await Bill.create({
      voucherNumber,
      companyBillNumber,
      billDate,
      supplierId,
      supplierName: supplier.supplierName,
      supplierCode: supplier.supplierCode,
      totalBillAmount,
      notes,
      receivedBy: req.user.id,
      receivedByName: req.user.fullName
    });

    // Populate and return
    const populatedBill = await Bill.findById(bill._id)
      .populate('supplierId', 'supplierCode supplierName');

    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      data: populatedBill
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: messages
      });
    }
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Voucher number already exists'
      });
    }
    next(error);
  }
};

// ===================
// @desc    Update bill
// @route   PUT /api/v1/bills/:id
// @access  Private (Admin, Operator)
// ===================
exports.updateBill = async (req, res, next) => {
  try {
    const {
      voucherNumber,
      companyBillNumber,
      billDate,
      supplierId,
      totalBillAmount,
      notes
    } = req.body;

    let bill = await Bill.findById(req.params.id);

    if (!bill) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    // Check for duplicate voucher number (if changed)
    if (voucherNumber && voucherNumber.toUpperCase() !== bill.voucherNumber) {
      const existingBill = await Bill.findOne({
        voucherNumber: voucherNumber.toUpperCase(),
        _id: { $ne: req.params.id }
      });
      if (existingBill) {
        return res.status(400).json({
          success: false,
          error: 'Voucher number already exists'
        });
      }
    }

    // Get supplier details if changed
    let supplierName = bill.supplierName;
    let supplierCode = bill.supplierCode;
    if (supplierId && supplierId !== bill.supplierId.toString()) {
      const supplier = await Supplier.findById(supplierId);
      if (!supplier) {
        return res.status(400).json({
          success: false,
          error: 'Supplier not found'
        });
      }
      supplierName = supplier.supplierName;
      supplierCode = supplier.supplierCode;
    }

    // Update bill
    bill = await Bill.findByIdAndUpdate(
      req.params.id,
      {
        voucherNumber,
        companyBillNumber,
        billDate,
        supplierId,
        supplierName,
        supplierCode,
        totalBillAmount,
        notes
      },
      { new: true, runValidators: true }
    ).populate('supplierId', 'supplierCode supplierName');

    res.status(200).json({
      success: true,
      message: 'Bill updated successfully',
      data: bill
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: messages
      });
    }
    next(error);
  }
};

// ===================
// @desc    Delete bill
// @route   DELETE /api/v1/bills/:id
// @access  Private (Admin only)
// ===================
exports.deleteBill = async (req, res, next) => {
  try {
    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    // Check if bill has serial numbers
    if (bill.totalSerialNumbers > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete bill. It has ${bill.totalSerialNumbers} serial number(s) attached. Delete serial numbers first.`
      });
    }

    await bill.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Bill deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Get bill by voucher number
// @route   GET /api/v1/bills/voucher/:voucherNumber
// @access  Private
// ===================
exports.getBillByVoucher = async (req, res, next) => {
  try {
    const bill = await Bill.findOne({ 
      voucherNumber: req.params.voucherNumber.toUpperCase() 
    })
      .populate('supplierId', 'supplierCode supplierName')
      .populate('receivedBy', 'fullName email');

    if (!bill) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    res.status(200).json({
      success: true,
      data: bill
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Get bill statistics
// @route   GET /api/v1/bills/stats/summary
// @access  Private
// ===================
exports.getBillStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const matchStage = {};
    if (startDate || endDate) {
      matchStage.billDate = {};
      if (startDate) matchStage.billDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchStage.billDate.$lte = end;
      }
    }

    const stats = await Bill.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          totalBillAmount: { $sum: '$totalBillAmount' },
          totalSerialNumbers: { $sum: '$totalSerialNumbers' },
          fullyCategorizeBills: {
            $sum: { $cond: ['$isFullyCategorized', 1, 0] }
          },
          pendingCategorizationBills: {
            $sum: { $cond: ['$isFullyCategorized', 0, 1] }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: stats[0] || {
        totalBills: 0,
        totalBillAmount: 0,
        totalSerialNumbers: 0,
        fullyCategorizeBills: 0,
        pendingCategorizationBills: 0
      }
    });
  } catch (error) {
    next(error);
  }
};