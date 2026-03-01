const SerialNumber = require('../models/SerialNumber');
const Bill = require('../models/Bill');
const PartsMaster = require('../models/PartsMaster');

// ===================
// @desc    Get all serial numbers
// @route   GET /api/v1/serials
// @access  Private
// ===================
exports.getSerials = async (req, res, next) => {
  try {
    const {
      search,
      billId,
      currentCategory,
      startDate,
      endDate,
      page = 1,
      limit = 25,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { serialNumber: { $regex: search, $options: 'i' } },
        { partName: { $regex: search, $options: 'i' } },
        { voucherNumber: { $regex: search, $options: 'i' } },
        { 'context.spuId': { $regex: search, $options: 'i' } },
        { 'context.customerName': { $regex: search, $options: 'i' } }
      ];
    }

    // Bill filter
    if (billId) {
      query.billId = billId;
    }

    // Category filter
    if (currentCategory) {
      query.currentCategory = currentCategory;
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

    res.status(200).json({
      success: true,
      data: serials,
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
// @desc    Get serials by bill ID
// @route   GET /api/v1/serials/bill/:billId
// @access  Private
// ===================
exports.getSerialsByBill = async (req, res, next) => {
  try {
    const serials = await SerialNumber.find({ billId: req.params.billId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: serials,
      count: serials.length
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Get single serial number
// @route   GET /api/v1/serials/:id
// @access  Private
// ===================
exports.getSerial = async (req, res, next) => {
  try {
    const serial = await SerialNumber.findById(req.params.id)
      .populate('billId', 'voucherNumber companyBillNumber billDate totalBillAmount')
      .populate('partId', 'partCode partName')
      .populate('createdBy', 'fullName email');

    if (!serial) {
      return res.status(404).json({
        success: false,
        error: 'Serial number not found'
      });
    }

    res.status(200).json({
      success: true,
      data: serial
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Get serial by serial number string
// @route   GET /api/v1/serials/sn/:serialNumber
// @access  Private
// ===================
exports.getSerialByNumber = async (req, res, next) => {
  try {
    const serial = await SerialNumber.findOne({ 
      serialNumber: req.params.serialNumber.toUpperCase() 
    })
      .populate('billId', 'voucherNumber companyBillNumber billDate totalBillAmount')
      .populate('partId', 'partCode partName');

    if (!serial) {
      return res.status(404).json({
        success: false,
        error: 'Serial number not found'
      });
    }

    res.status(200).json({
      success: true,
      data: serial
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Create serial number (single)
// @route   POST /api/v1/serials
// @access  Private (Admin, Operator)
// ===================
exports.createSerial = async (req, res, next) => {
  try {
    const {
      serialNumber,
      billId,
      partId,
      partCode,
      partName,
      unitPrice,
      currentCategory,
      context
    } = req.body;

    // Check for duplicate serial number
    const existingSerial = await SerialNumber.findOne({ 
      serialNumber: serialNumber.toUpperCase() 
    });
    if (existingSerial) {
      return res.status(400).json({
        success: false,
        error: `Serial number "${serialNumber}" already exists`
      });
    }

    // Get bill details
    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(400).json({
        success: false,
        error: 'Bill not found'
      });
    }
    // ════════════════════════════════════════════════════════
    // SMART PART RESOLUTION
    // ════════════════════════════════════════════════════════
    let resolvedPartId = partId;
    let resolvedPartCode = partCode;
    let resolvedPartName = partName;

    if (partId) {
      // CASE A: User selected a part from dropdown (partId provided)
      const part = await PartsMaster.findById(partId);
      if (part) {
        resolvedPartCode = part.partCode;
        resolvedPartName = part.partName;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Selected part not found in Parts Master'
        });
      }
    } else if (partCode) {
      // CASE B: User typed a part code (no partId, but partCode given)
      let part = await PartsMaster.findOne({
        partCode: partCode.toUpperCase()
      });

      if (part) {
        // Part exists → link to it
        resolvedPartId = part._id;
        resolvedPartCode = part.partCode;
        resolvedPartName = part.partName;
      } else {
        // Part doesn't exist → auto-create it
        part = await PartsMaster.create({
          partCode: partCode.toUpperCase(),
          partName: partName || partCode,
          avgUnitPrice: unitPrice || 0,
          isActive: true
        });
        resolvedPartId = part._id;
        resolvedPartCode = part.partCode;
        resolvedPartName = part.partName;
      }
    } else if (partName) {
      // CASE C: User typed only a part name (no code, no id)
      // Try to find by name (fuzzy match)
      let part = await PartsMaster.findOne({
        partName: { $regex: `^${partName.trim()}$`, $options: 'i' }
      });

      if (part) {
        // Found existing part with same name → link
        resolvedPartId = part._id;
        resolvedPartCode = part.partCode;
        resolvedPartName = part.partName;
      } else {
        // Not found → auto-create with generated code
        const partCount = await PartsMaster.countDocuments();
        const autoCode = `PART-${String(partCount + 1).padStart(4, '0')}`;

        part = await PartsMaster.create({
          partCode: autoCode,
          partName: partName.trim(),
          avgUnitPrice: unitPrice || 0,
          isActive: true
        });
        resolvedPartId = part._id;
        resolvedPartCode = part.partCode;
        resolvedPartName = part.partName;
      }
    }
    // ════════════════════════════════════════════════════════

    // Create serial number (now ALWAYS linked to PartsMaster)
    const serial = await SerialNumber.create({
      serialNumber,
      billId,
      voucherNumber: bill.voucherNumber,
      companyBillNumber: bill.companyBillNumber,
      billDate: bill.billDate,
      partId: resolvedPartId,       // ← Now always has a value
      partCode: resolvedPartCode,   // ← Synced with PartsMaster
      partName: resolvedPartName,   // ← Synced with PartsMaster
      unitPrice,
      supplierId: bill.supplierId,
      supplierName: bill.supplierName,
      currentCategory: currentCategory || 'UNCATEGORIZED',
      categorizedDate: currentCategory && currentCategory !== 'UNCATEGORIZED'
        ? new Date()
        : null,
      context,
      createdBy: req.user.id,
      createdByName: req.user.fullName
    });

    // ════════════════════════════════════════════════════════
    // 🔗 CHANGE 1b: UPDATE PART'S AVERAGE PRICE
    // ════════════════════════════════════════════════════════
    if (resolvedPartId) {
      await updatePartAvgPrice(resolvedPartId);
    }

    // Update bill summary
    const updatedBill = await Bill.findById(billId);
    if (updatedBill) {
      await updatedBill.updateCategorySummary();
    }

    res.status(201).json({
      success: true,
      message: 'Serial number created successfully',
      data: serial
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
        error: 'Serial number already exists'
      });
    }
    next(error);
  }
};

// ===================
// @desc    Create multiple serial numbers (bulk)
// @route   POST /api/v1/serials/bulk
// @access  Private (Admin, Operator)
// ===================
exports.createBulkSerials = async (req, res, next) => {
  try {
    const { billId, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Items array is required'
      });
    }

    // Get bill details
    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(400).json({
        success: false,
        error: 'Bill not found'
      });
    }

    // Check for duplicate serial numbers
    const serialNumbers = items.map(item => item.serialNumber.toUpperCase());
    const existingSerials = await SerialNumber.find({
      serialNumber: { $in: serialNumbers }
    }).select('serialNumber');

    if (existingSerials.length > 0) {
      const duplicates = existingSerials.map(s => s.serialNumber);
      return res.status(400).json({
        success: false,
        error: `Duplicate serial number(s): ${duplicates.join(', ')}`
      });
    }

    // Check for duplicates within the request
    const uniqueSerials = new Set(serialNumbers);
    if (uniqueSerials.size !== serialNumbers.length) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate serial numbers in request'
      });
    }

    
    // ════════════════════════════════════════════════════════
    //  BATCH PART RESOLUTION
    // Cache resolved parts to avoid duplicate DB calls
    // ════════════════════════════════════════════════════════
    const partCache = new Map(); // key: partCode or partName → value: part doc

    const resolvePartForItem = async (item) => {
      const { partId, partCode, partName, unitPrice } = item;

      // Check cache first (by partCode or partName)
      const cacheKey = partCode?.toUpperCase() || partName?.trim().toLowerCase();
      if (cacheKey && partCache.has(cacheKey)) {
        return partCache.get(cacheKey);
      }

      let resolved = { partId: null, partCode: null, partName: null };

      if (partId) {
        // User selected from dropdown
        const part = await PartsMaster.findById(partId);
        if (part) {
          resolved = { partId: part._id, partCode: part.partCode, partName: part.partName };
        }
      } else if (partCode) {
        // Try find by code
        let part = await PartsMaster.findOne({ partCode: partCode.toUpperCase() });
        if (part) {
          resolved = { partId: part._id, partCode: part.partCode, partName: part.partName };
        } else {
          // Auto-create
          part = await PartsMaster.create({
            partCode: partCode.toUpperCase(),
            partName: partName || partCode,
            avgUnitPrice: unitPrice || 0,
            isActive: true
          });
          resolved = { partId: part._id, partCode: part.partCode, partName: part.partName };
        }
      } else if (partName) {
        // Try find by name
        let part = await PartsMaster.findOne({
          partName: { $regex: `^${partName.trim()}$`, $options: 'i' }
        });
        if (part) {
          resolved = { partId: part._id, partCode: part.partCode, partName: part.partName };
        } else {
          // Auto-create with generated code
          const partCount = await PartsMaster.countDocuments();
          const autoCode = `PART-${String(partCount + 1).padStart(4, '0')}`;
          part = await PartsMaster.create({
            partCode: autoCode,
            partName: partName.trim(),
            avgUnitPrice: unitPrice || 0,
            isActive: true
          });
          resolved = { partId: part._id, partCode: part.partCode, partName: part.partName };
        }
      }

      // Cache it
      if (cacheKey) {
        partCache.set(cacheKey, resolved);
      }

      return resolved;
    };

    const serialDocs = [];
    for (const item of items) {
      const resolvedPart = await resolvePartForItem(item);

      serialDocs.push({
        serialNumber: item.serialNumber.toUpperCase(),
        billId,
        voucherNumber: bill.voucherNumber,
        companyBillNumber: bill.companyBillNumber,
        billDate: bill.billDate,
        partId: resolvedPart.partId,
        partCode: resolvedPart.partCode,
        partName: resolvedPart.partName,
        unitPrice: item.unitPrice,
        supplierId: bill.supplierId,
        supplierName: bill.supplierName,
        currentCategory: item.currentCategory || 'UNCATEGORIZED',
        categorizedDate: item.currentCategory && item.currentCategory !== 'UNCATEGORIZED'
          ? new Date()
          : null,
        context: item.context,
        createdBy: req.user.id,
        createdByName: req.user.fullName
      });
    }

    // Insert all serial numbers
    const serials = await SerialNumber.insertMany(serialDocs);

     // ════════════════════════════════════════════════════════
    // 🔗 Update avg price for all affected parts
    // ════════════════════════════════════════════════════════
    const affectedPartIds = [...new Set(
      serialDocs
        .filter(doc => doc.partId)
        .map(doc => doc.partId.toString())
    )];
    
    for (const pid of affectedPartIds) {
      await updatePartAvgPrice(new mongoose.Types.ObjectId(pid));
    }

    // Update bill summary
    await bill.updateCategorySummary();

    res.status(201).json({
      success: true,
      message: `${serials.length} serial number(s) created successfully`,
      data: serials,
      count: serials.length
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'One or more serial numbers already exist'
      });
    }
    next(error);
  }
};

// ===================
// @desc    Update serial number
// @route   PUT /api/v1/serials/:id
// @access  Private (Admin, Operator)
// ===================
exports.updateSerial = async (req, res, next) => {
  try {
    const {
      serialNumber,
      partId,
      partCode,
      partName,
      unitPrice,
      context
    } = req.body;

    let serial = await SerialNumber.findById(req.params.id);

    if (!serial) {
      return res.status(404).json({
        success: false,
        error: 'Serial number not found'
      });
    }

    // Check for duplicate serial number (if changed)
    if (serialNumber && serialNumber.toUpperCase() !== serial.serialNumber) {
      const existingSerial = await SerialNumber.findOne({
        serialNumber: serialNumber.toUpperCase(),
        _id: { $ne: req.params.id }
      });
      if (existingSerial) {
        return res.status(400).json({
          success: false,
          error: 'Serial number already exists'
        });
      }
    }

    // Get part details if partId provided
    let partDetails = { partCode, partName };
    if (partId) {
      const part = await PartsMaster.findById(partId);
      if (part) {
        partDetails.partCode = part.partCode;
        partDetails.partName = part.partName;
      }
    }

    // Update serial
    serial = await SerialNumber.findByIdAndUpdate(
      req.params.id,
      {
        serialNumber: serialNumber?.toUpperCase(),
        partId,
        partCode: partDetails.partCode,
        partName: partDetails.partName,
        unitPrice,
        context: { ...serial.context, ...context }
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Serial number updated successfully',
      data: serial
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
// @desc    Delete serial number
// @route   DELETE /api/v1/serials/:id
// @access  Private (Admin only)
// ===================
exports.deleteSerial = async (req, res, next) => {
  try {
    const serial = await SerialNumber.findById(req.params.id);

    if (!serial) {
      return res.status(404).json({
        success: false,
        error: 'Serial number not found'
      });
    }

    const billId = serial.billId;
    await SerialNumber.findByIdAndDelete(req.params.id);

    // Update bill summary
    const bill = await Bill.findById(billId);
    if (bill) {
      await bill.updateCategorySummary();
    }

    res.status(200).json({
      success: true,
      message: 'Serial number deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Check if serial number exists
// @route   GET /api/v1/serials/check/:serialNumber
// @access  Private
// ===================
exports.checkSerialExists = async (req, res, next) => {
  try {
    const serial = await SerialNumber.findOne({
      serialNumber: req.params.serialNumber.toUpperCase()
    }).select('serialNumber billId voucherNumber');

    res.status(200).json({
      success: true,
      exists: !!serial,
      data: serial
    });
  } catch (error) {
    next(error);
  }
};


// ════════════════════════════════════════════════════════
// HELPER: Update average price of a part based on all its serials
// ════════════════════════════════════════════════════════
const updatePartAvgPrice = async (partId) => {
  const result = await SerialNumber.aggregate([
    { $match: { partId: partId } },
    {
      $group: {
        _id: '$partId',
        avgPrice: { $avg: '$unitPrice' },
        totalSerials: { $sum: 1 }
      }
    }
  ]);

  if (result.length > 0) {
    await PartsMaster.findByIdAndUpdate(partId, {
      avgUnitPrice: Math.round(result[0].avgPrice * 100) / 100,
      updatedAt: new Date()
    });
  }
};