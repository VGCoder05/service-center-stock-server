const SerialNumber = require('../models/SerialNumber');
const Bill = require('../models/Bill');

// ===================
// @desc    Get dashboard summary
// @route   GET /api/v1/dashboard/summary
// @access  Private
// ===================
exports.getDashboardSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Build match stage for date filtering
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

    // Get category summary
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

    // Format category data
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

    categorySummary.forEach(item => {
      if (categories[item._id] !== undefined) {
        categories[item._id] = {
          count: item.count,
          totalValue: item.totalValue
        };
        totalCount += item.count;
        totalValue += item.totalValue;
      }
    });

    // Get OG payment summary
    const ogPaymentSummary = await SerialNumber.aggregate([
      { 
        $match: { 
          ...matchStage,
          currentCategory: 'OG' 
        } 
      },
      {
        $group: {
          _id: '$context.paymentStatus',
          count: { $sum: 1 },
          totalCash: { $sum: '$context.cashAmount' }
        }
      }
    ]);

    const ogSummary = {
      paid: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      total: { count: 0, amount: 0 }
    };

    ogPaymentSummary.forEach(item => {
      if (item._id === 'PAID') {
        ogSummary.paid = { count: item.count, amount: item.totalCash };
      } else if (item._id === 'PENDING') {
        ogSummary.pending = { count: item.count, amount: item.totalCash };
      }
      ogSummary.total.count += item.count;
      ogSummary.total.amount += item.totalCash;
    });

    res.status(200).json({
      success: true,
      data: {
        categories,
        totals: {
          count: totalCount,
          value: totalValue
        },
        ogPaymentSummary: ogSummary
      }
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Get dashboard alerts
// @route   GET /api/v1/dashboard/alerts
// @access  Private
// ===================
exports.getDashboardAlerts = async (req, res, next) => {
  try {
    const now = new Date();
    
    // SPU Pending > 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const spuPendingOld = await SerialNumber.countDocuments({
      currentCategory: 'SPU_PENDING',
      'context.spuDate': { $lt: thirtyDaysAgo }
    });

    // Payment Pending > 15 days (OG with pending payment)
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    const paymentPending = await SerialNumber.countDocuments({
      currentCategory: 'OG',
      'context.paymentStatus': 'PENDING',
      categorizedDate: { $lt: fifteenDaysAgo }
    });

    // Return Pending > 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const returnPending = await SerialNumber.countDocuments({
      currentCategory: 'RETURN',
      'context.returnedToSupplier': { $ne: true },
      categorizedDate: { $lt: sevenDaysAgo }
    });

    // Uncategorized items
    const uncategorizedCount = await SerialNumber.countDocuments({
      currentCategory: 'UNCATEGORIZED'
    });

    // Bills with uncategorized items
    const billsWithUncategorized = await Bill.countDocuments({
      'categorySummary.UNCATEGORIZED': { $gt: 0 }
    });

    // Chargeable items with pending payment (non-OG)
    const chargeablePending = await SerialNumber.countDocuments({
      currentCategory: { $in: ['SPU_PENDING', 'SPU_CLEARED', 'AMC'] },
      'context.isChargeable': true,
      'context.paymentStatus': 'PENDING'
    });

    // Get recent pending items details
    const spuPendingDetails = await SerialNumber.find({
      currentCategory: 'SPU_PENDING',
      'context.spuDate': { $lt: thirtyDaysAgo }
    })
      .select('serialNumber partName context.spuId context.customerName context.spuDate')
      .limit(5)
      .sort({ 'context.spuDate': 1 });

    const paymentPendingDetails = await SerialNumber.find({
      currentCategory: 'OG',
      'context.paymentStatus': 'PENDING'
    })
      .select('serialNumber partName context.customerName context.cashAmount categorizedDate')
      .limit(5)
      .sort({ categorizedDate: 1 });

    res.status(200).json({
      success: true,
      data: {
        alerts: {
          spuPendingOld: {
            count: spuPendingOld,
            threshold: '30 days',
            severity: spuPendingOld > 0 ? 'warning' : 'ok'
          },
          paymentPending: {
            count: paymentPending,
            threshold: '15 days',
            severity: paymentPending > 0 ? 'warning' : 'ok'
          },
          returnPending: {
            count: returnPending,
            threshold: '7 days',
            severity: returnPending > 0 ? 'warning' : 'ok'
          },
          uncategorized: {
            count: uncategorizedCount,
            billsCount: billsWithUncategorized,
            severity: uncategorizedCount > 0 ? 'info' : 'ok'
          },
          chargeablePending: {
            count: chargeablePending,
            severity: chargeablePending > 0 ? 'info' : 'ok'
          }
        },
        details: {
          spuPending: spuPendingDetails,
          paymentPending: paymentPendingDetails
        },
        totalAlerts: spuPendingOld + paymentPending + returnPending + (uncategorizedCount > 0 ? 1 : 0)
      }
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Get recent activity
// @route   GET /api/v1/dashboard/activity
// @access  Private
// ===================
exports.getRecentActivity = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    // Recent bills
    const recentBills = await Bill.find()
      .select('voucherNumber supplierName billDate totalSerialNumbers totalBillAmount')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Recent serial movements
    const CategoryMovement = require('../models/CategoryMovement');
    const recentMovements = await CategoryMovement.find()
      .select('serialNumber movementType fromCategory toCategory performedByName timestamp')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        recentBills,
        recentMovements
      }
    });
  } catch (error) {
    next(error);
  }
};

// ===================
// @desc    Get quick stats
// @route   GET /api/v1/dashboard/stats
// @access  Private
// ===================
exports.getQuickStats = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // This month's bills
    const thisMonthBills = await Bill.aggregate([
      { $match: { billDate: { $gte: startOfMonth } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalBillAmount' },
          totalSerials: { $sum: '$totalSerialNumbers' }
        }
      }
    ]);

    // Last month's bills (for comparison)
    const lastMonthBills = await Bill.aggregate([
      { $match: { billDate: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalBillAmount' },
          totalSerials: { $sum: '$totalSerialNumbers' }
        }
      }
    ]);

    // Total inventory
    const totalInventory = await SerialNumber.aggregate([
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalValue: { $sum: '$unitPrice' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        thisMonth: thisMonthBills[0] || { count: 0, totalAmount: 0, totalSerials: 0 },
        lastMonth: lastMonthBills[0] || { count: 0, totalAmount: 0, totalSerials: 0 },
        totalInventory: totalInventory[0] || { count: 0, totalValue: 0 }
      }
    });
  } catch (error) {
    next(error);
  }
};