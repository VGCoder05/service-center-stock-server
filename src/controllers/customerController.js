// ===================================================
// Pending to check
// ===================================================


const Customer = require('../models/Customer');

// ===================
// @desc    Get all customers
// @route   GET /api/v1/master/customers
// @access  Private
// ===================
exports.getCustomers = async (req, res, next) => {
  try {
    const { 
      search, 
      hasAMC,
      isActive, 
      page = 1, 
      limit = 25,
      sortBy = 'customerName',
      sortOrder = 'asc'
    } = req.query;

    // Build query
    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { customerCode: { $regex: search, $options: 'i' } },
        { ticketNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // AMC filter
    if (hasAMC !== undefined) {
      query.hasAMC = hasAMC === 'true';
    }

    // Active filter
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Execute query
    const [customers, total] = await Promise.all([
      Customer.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Customer.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: customers,
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
// @desc    Get single customer
// @route   GET /api/v1/master/customers/:id
// @access  Private
// ===================
exports.getCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    res.status(200).json({
      success: true,
      data: customer
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Create customer
// @route   POST /api/v1/master/customers
// @access  Private (Admin, Operator)
// ===================
exports.createCustomer = async (req, res, next) => {
  try {
    const { 
      customerCode, 
      ticketNumber,
      customerName, 
      contactPerson, 
      phone, 
      email, 
      address,
      hasAMC,
      amcDetails 
    } = req.body;

    // Check for duplicate customer code (if provided)
    if (customerCode) {
      const existingCustomer = await Customer.findOne({ customerCode: customerCode.toUpperCase() });
      if (existingCustomer) {
        return res.status(400).json({
          success: false,
          error: 'Customer code already exists'
        });
      }
    }

    const customer = await Customer.create({
      customerCode: customerCode || undefined, // Don't store empty string
      ticketNumber,
      customerName,
      contactPerson,
      phone,
      email,
      address,
      hasAMC,
      amcDetails: hasAMC ? amcDetails : undefined
    });

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: customer
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
// @desc    Update customer
// @route   PUT /api/v1/master/customers/:id
// @access  Private (Admin, Operator)
// ===================
exports.updateCustomer = async (req, res, next) => {
  try {
    const { 
      customerCode, 
      ticketNumber,
      customerName, 
      contactPerson, 
      phone, 
      email, 
      address,
      hasAMC,
      amcDetails,
      isActive 
    } = req.body;

    let customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // Check for duplicate customer code (if changed)
    if (customerCode && customerCode.toUpperCase() !== customer.customerCode) {
      const existingCustomer = await Customer.findOne({ 
        customerCode: customerCode.toUpperCase(),
        _id: { $ne: req.params.id }
      });
      if (existingCustomer) {
        return res.status(400).json({
          success: false,
          error: 'Customer code already exists'
        });
      }
    }

    // Update fields
    customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { 
        customerCode: customerCode || undefined,
        ticketNumber,
        customerName, 
        contactPerson, 
        phone, 
        email, 
        address,
        hasAMC,
        amcDetails: hasAMC ? amcDetails : undefined,
        isActive 
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: customer
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
// @desc    Delete customer
// @route   DELETE /api/v1/master/customers/:id
// @access  Private (Admin only)
// ===================
exports.deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    await customer.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Get all customers (dropdown list - no pagination)
// @route   GET /api/v1/master/customers/list/all
// @access  Private
// ===================
exports.getAllCustomersList = async (req, res, next) => {
  try {
    const customers = await Customer.find({ isActive: true })
      .select('customerCode customerName hasAMC')
      .sort({ customerName: 1 });

    res.status(200).json({
      success: true,
      data: customers
    });
  } catch (error) {
    next(error);
  }
};