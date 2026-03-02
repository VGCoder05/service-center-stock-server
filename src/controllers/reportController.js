const SerialNumber = require('../models/SerialNumber');
const Bill = require('../models/Bill');

// ===================
// @desc    Get stock valuation report data
// @route   GET /api/v1/reports/valuation
// @access  Private
// ===================
exports.getStockValuation = async (req, res, next) => {
  try {
    const { startDate, endDate, category } = req.query;

    // Build match stage
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
    if (category) {
      matchStage.currentCategory = category;
    }

    // Category summary
    const categorySummary = await SerialNumber.aggregate([
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

    // Format categories
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

    categorySummary.forEach(item => {
      if (categories[item._id] !== undefined) {
        categories[item._id] = {
          count: item.count,
          totalValue: item.totalValue
        };
      }
    });

    res.status(200).json({
      success: true,
      data: { categories },
      filters: { startDate, endDate, category }
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Export stock valuation to Excel (Now sends JSON for frontend)
// @route   GET /api/v1/reports/valuation/export
// @access  Private
// ===================
exports.exportStockValuation = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Build match stage
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

    // Get category summary
    const categorySummary = await SerialNumber.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$currentCategory',
          count: { $sum: 1 },
          totalValue: { $sum: '$unitPrice' }
        }
      }
    ]);

    const categories = {};
    categorySummary.forEach(item => {
      categories[item._id] = {
        count: item.count,
        totalValue: item.totalValue
      };
    });

    // Get details for each category
    const details = {};
    const categoryList = ['IN_STOCK', 'SPU_PENDING', 'SPU_CLEARED', 'AMC', 'OG', 'RETURN', 'RECEIVED_FOR_OTHERS', 'UNCATEGORIZED'];

    for (const cat of categoryList) {
      details[cat] = await SerialNumber.find({
        ...matchStage,
        currentCategory: cat
      })
        .select('serialNumber partName partCode voucherNumber billDate supplierName unitPrice context')
        .sort({ billDate: -1 })
        .limit(1000); // Limit for performance
    }

    // Send raw data to frontend instead of generating file
    res.status(200).json({
      success: true,
      data: { categories, details },
      filters: { startDate, endDate }
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Get IN_STOCK report grouped by bill
// @route   GET /api/v1/reports/in-stock
// @access  Private
// ===================
exports.getInStockByBill = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Build match stage
    const matchStage = { currentCategory: 'IN_STOCK' };
    if (startDate || endDate) {
      matchStage.billDate = {};
      if (startDate) matchStage.billDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchStage.billDate.$lte = end;
      }
    }

    // Group by bill
    const data = await SerialNumber.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$billId',
          voucherNumber: { $first: '$voucherNumber' },
          companyBillNumber: { $first: '$companyBillNumber' },
          billDate: { $first: '$billDate' },
          supplierName: { $first: '$supplierName' },
          serials: {
            $push: {
              _id: '$_id',
              serialNumber: '$serialNumber',
              partName: '$partName',
              unitPrice: '$unitPrice',
              context: '$context'
            }
          },
          totalValue: { $sum: '$unitPrice' },
          count: { $sum: 1 }
        }
      },
      { $sort: { billDate: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data,
      summary: {
        totalBills: data.length,
        totalItems: data.reduce((sum, b) => sum + b.count, 0),
        totalValue: data.reduce((sum, b) => sum + b.totalValue, 0)
      }
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Export IN_STOCK report to Excel (Now sends JSON for frontend)
// @route   GET /api/v1/reports/in-stock/export
// @access  Private
// ===================
exports.exportInStockByBill = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Build match stage
    const matchStage = { currentCategory: 'IN_STOCK' };
    if (startDate || endDate) {
      matchStage.billDate = {};
      if (startDate) matchStage.billDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchStage.billDate.$lte = end;
      }
    }

    // Group by bill
    const data = await SerialNumber.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$billId',
          voucherNumber: { $first: '$voucherNumber' },
          companyBillNumber: { $first: '$companyBillNumber' },
          billDate: { $first: '$billDate' },
          supplierName: { $first: '$supplierName' },
          serials: {
            $push: {
              serialNumber: '$serialNumber',
              partName: '$partName',
              unitPrice: '$unitPrice',
              context: '$context'
            }
          }
        }
      },
      { $sort: { billDate: -1 } }
    ]);

    // Send raw grouped data to the frontend
    res.status(200).json({
      success: true,
      data,
      filters: { startDate, endDate }
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Get SPU report grouped by SPU ID
// @route   GET /api/v1/reports/spu
// @access  Private
// ===================
exports.getSPUReport = async (req, res, next) => {
  try {
    const { startDate, endDate, status } = req.query;

    // Build match stage
    const matchStage = {
      currentCategory: status === 'cleared' ? 'SPU_CLEARED' : 'SPU_PENDING'
    };
    if (startDate || endDate) {
      matchStage.billDate = {};
      if (startDate) matchStage.billDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchStage.billDate.$lte = end;
      }
    }

    // Group by SPU ID
    const data = await SerialNumber.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$context.spuId',
          spuId: { $first: '$context.spuId' },
          ticketId: { $first: '$context.ticketId' },
          customerName: { $first: '$context.customerName' },
          spuDate: { $first: '$context.spuDate' },
          serials: {
            $push: {
              _id: '$_id',
              serialNumber: '$serialNumber',
              partName: '$partName',
              unitPrice: '$unitPrice',
              voucherNumber: '$voucherNumber',
              companyBillNumber: '$companyBillNumber',      // ✅ New
              billDate: '$billDate',                        // ✅ New
              context: '$context',
              note: '$note'
            }
          },
          totalValue: { $sum: '$unitPrice' },
          count: { $sum: 1 },
          chargeableCount: {
            $sum: { $cond: ['$context.isChargeable', 1, 0] }
          },
          chargeableAmount: {
            $sum: { $cond: ['$context.isChargeable', '$context.chargeAmount', 0] }
          }
        }
      },
      { $sort: { spuDate: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data,
      summary: {
        totalSPUs: data.length,
        totalItems: data.reduce((sum, s) => sum + s.count, 0),
        totalValue: data.reduce((sum, s) => sum + s.totalValue, 0),
        totalChargeable: data.reduce((sum, s) => sum + s.chargeableAmount, 0)
      }
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Export SPU report to Excel (Now sends JSON for frontend)
// @route   GET /api/v1/reports/spu/export
// @access  Private
// ===================
exports.exportSPUReport = async (req, res, next) => {
  try {
    const { startDate, endDate, status } = req.query;
    const category = status === 'cleared' ? 'SPU_CLEARED' : 'SPU_PENDING';

    // Build match stage
    const matchStage = { currentCategory: category };
    if (startDate || endDate) {
      matchStage.billDate = {};
      if (startDate) matchStage.billDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchStage.billDate.$lte = end;
      }
    }

    // Group by SPU ID
    const data = await SerialNumber.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$context.spuId',
          spuId: { $first: '$context.spuId' },
          ticketId: { $first: '$context.ticketId' },
          customerName: { $first: '$context.customerName' },
          spuDate: { $first: '$context.spuDate' },
          serials: {
            $push: {
              serialNumber: '$serialNumber',
              partName: '$partName',
              unitPrice: '$unitPrice',
              voucherNumber: '$voucherNumber',
              companyBillNumber: '$companyBillNumber',      // ✅ NEW
              billDate: '$billDate',                        // ✅ NEW
              context: '$context',
              note: '$note'
            }
          }
        }
      },
      { $sort: { spuDate: -1 } }
    ]);

    // Send raw grouped data to the frontend
    res.status(200).json({
      success: true,
      data,
      filters: { startDate, endDate, status: category }
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Get category-specific report
// @route   GET /api/v1/reports/category/:category
// @access  Private
// ===================
exports.getCategoryReport = async (req, res, next) => {
  try {
    const { category } = req.params;
    const { startDate, endDate, page = 1, limit = 100 } = req.query;

    // Build match stage
    const matchStage = { currentCategory: category };
    if (startDate || endDate) {
      matchStage.billDate = {};
      if (startDate) matchStage.billDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchStage.billDate.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [data, countResult, valueResult] = await Promise.all([
      SerialNumber.find(matchStage)
        .select('serialNumber partName partCode voucherNumber billDate supplierName unitPrice context')
        .sort({ billDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      SerialNumber.countDocuments(matchStage),
      SerialNumber.aggregate([
        { $match: matchStage },
        { $group: { _id: null, total: { $sum: '$unitPrice' } } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult,
        pages: Math.ceil(countResult / parseInt(limit))
      },
      summary: {
        count: countResult,
        totalValue: valueResult[0]?.total || 0
      }
    });
  } catch (error) {
    next(error);
  }
};