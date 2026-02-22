const Supplier = require('../models/Supplier');

// ===================
// @desc    Get all suppliers
// @route   GET /api/v1/master/suppliers
// @access  Private
// ===================
exports.getSuppliers = async (req, res, next) => {
  try {
    const { 
      search, 
      isActive, 
      page = 1, 
      limit = 25,
      sortBy = 'supplierName',
      sortOrder = 'asc'
    } = req.query;

    // Build query
    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { supplierCode: { $regex: search, $options: 'i' } },
        { supplierName: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } }
      ];
    }

    // Active filter
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Execute query
    const [suppliers, total] = await Promise.all([
      Supplier.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Supplier.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: suppliers,
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
// @desc    Get single supplier
// @route   GET /api/v1/master/suppliers/:id
// @access  Private
// ===================
exports.getSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    }

    res.status(200).json({
      success: true,
      data: supplier
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Create supplier
// @route   POST /api/v1/master/suppliers
// @access  Private (Admin, Operator)
// ===================
exports.createSupplier = async (req, res, next) => {
  try {
    const { supplierCode, supplierName, contactPerson, phone, email, address } = req.body;

    // Check for duplicate supplier code
    const existingSupplier = await Supplier.findOne({ supplierCode: supplierCode.toUpperCase() });
    if (existingSupplier) {
      return res.status(400).json({
        success: false,
        error: 'Supplier code already exists'
      });
    }

    const supplier = await Supplier.create({
      supplierCode,
      supplierName,
      contactPerson,
      phone,
      email,
      address
    });

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: supplier
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
// @desc    Update supplier
// @route   PUT /api/v1/master/suppliers/:id
// @access  Private (Admin, Operator)
// ===================
exports.updateSupplier = async (req, res, next) => {
  try {
    const { supplierCode, supplierName, contactPerson, phone, email, address, isActive } = req.body;

    let supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    }

    // Check for duplicate supplier code (if changed)
    if (supplierCode && supplierCode.toUpperCase() !== supplier.supplierCode) {
      const existingSupplier = await Supplier.findOne({ 
        supplierCode: supplierCode.toUpperCase(),
        _id: { $ne: req.params.id }
      });
      if (existingSupplier) {
        return res.status(400).json({
          success: false,
          error: 'Supplier code already exists'
        });
      }
    }

    // Update fields
    supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { supplierCode, supplierName, contactPerson, phone, email, address, isActive },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Supplier updated successfully',
      data: supplier
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
// @desc    Delete supplier
// @route   DELETE /api/v1/master/suppliers/:id
// @access  Private (Admin only)
// ===================
exports.deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    }

    // TODO: Check if supplier has bills before deleting
    // For now, we'll soft-delete by setting isActive = false
    // or you can hard delete with: await supplier.deleteOne();

    await supplier.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Get all suppliers (dropdown list - no pagination)
// @route   GET /api/v1/master/suppliers/list/all
// @access  Private
// ===================
exports.getAllSuppliersList = async (req, res, next) => {
  try {
    const suppliers = await Supplier.find({ isActive: true })
      .select('supplierCode supplierName')
      .sort({ supplierName: 1 });

    res.status(200).json({
      success: true,
      data: suppliers
    });
  } catch (error) {
    next(error);
  }
};