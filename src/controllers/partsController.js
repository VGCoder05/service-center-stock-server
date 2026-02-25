const PartsMaster = require('../models/PartsMaster');

// ===================
// @desc    Get all parts
// @route   GET /api/v1/master/parts
// @access  Private
// ===================
exports.getParts = async (req, res, next) => {
  try {
    const { 
      search, 
      category,
      isActive, 
      page = 1, 
      limit = 25,
      sortBy = 'partName',
      sortOrder = 'asc'
    } = req.query;

    // Build query
    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { partCode: { $regex: search, $options: 'i' } },
        { partName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Active filter
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Execute query
    const [parts, total] = await Promise.all([
      PartsMaster.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      PartsMaster.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: parts,
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
// @desc    Get single part
// @route   GET /api/v1/master/parts/:id
// @access  Private
// ===================
exports.getPart = async (req, res, next) => {
  try {
    const part = await PartsMaster.findById(req.params.id);

    if (!part) {
      return res.status(404).json({
        success: false,
        error: 'Part not found'
      });
    }

    res.status(200).json({
      success: true,
      data: part
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Create part
// @route   POST /api/v1/master/parts
// @access  Private (Admin, Operator)
// ===================
exports.createPart = async (req, res, next) => {
  try {
    const { partCode, partName, description, category, unit, reorderPoint, avgUnitPrice } = req.body;

    // Check for duplicate part code
    const existingPart = await PartsMaster.findOne({ partCode: partCode.toUpperCase() });
    if (existingPart) {
      return res.status(400).json({
        success: false,
        error: 'Part code already exists'
      });
    }

    const part = await PartsMaster.create({
      partCode,
      partName,
      description,
      category,
      unit,
      reorderPoint,
      avgUnitPrice
    });

    res.status(201).json({
      success: true,
      message: 'Part created successfully',
      data: part
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
// @desc    Update part
// @route   PUT /api/v1/master/parts/:id
// @access  Private (Admin, Operator)
// ===================
exports.updatePart = async (req, res, next) => {
  try {
    const { partCode, partName, description, category, unit, reorderPoint, avgUnitPrice, isActive } = req.body;

    let part = await PartsMaster.findById(req.params.id);

    if (!part) {
      return res.status(404).json({
        success: false,
        error: 'Part not found'
      });
    }

    // Check for duplicate part code (if changed)
    if (partCode && partCode.toUpperCase() !== part.partCode) {
      const existingPart = await PartsMaster.findOne({ 
        partCode: partCode.toUpperCase(),
        _id: { $ne: req.params.id }
      });
      if (existingPart) {
        return res.status(400).json({
          success: false,
          error: 'Part code already exists'
        });
      }
    }

    // Update fields
    part = await PartsMaster.findByIdAndUpdate(
      req.params.id,
      { partCode, partName, description, category, unit, reorderPoint, avgUnitPrice, isActive },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Part updated successfully',
      data: part
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
// @desc    Delete part
// @route   DELETE /api/v1/master/parts/:id
// @access  Private (Admin only)
// ===================
exports.deletePart = async (req, res, next) => {
  try {
    const part = await PartsMaster.findById(req.params.id);

    if (!part) {
      return res.status(404).json({
        success: false,
        error: 'Part not found'
      });
    }

    // TODO: Check if part has serial numbers before deleting

    await part.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Part deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Get all parts (dropdown list - no pagination)
// @route   GET /api/v1/master/parts/list/all
// @access  Private
// ===================
exports.getAllPartsList = async (req, res, next) => {
  try {
    const parts = await PartsMaster.find({ isActive: true })
      .select('partCode partName unit avgUnitPrice')
      .sort({ partName: 1 });

    res.status(200).json({
      success: true,
      data: parts
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Get unique categories
// @route   GET /api/v1/master/parts/categories
// @access  Private
// ===================
exports.getPartCategories = async (req, res, next) => {
  try {
    const categories = await PartsMaster.distinct('category', { 
      category: { $ne: null, $ne: '' },
      isActive: true 
    });

    res.status(200).json({
      success: true,
      data: categories.sort()
    });
  } catch (error) {
    next(error);
  }
};