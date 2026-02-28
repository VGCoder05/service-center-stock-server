const express = require('express');
const router = express.Router();

const {
  getStockValuation,
  exportStockValuation,
  getInStockByBill,
  exportInStockByBill,
  getSPUReport,
  exportSPUReport,
  getCategoryReport
} = require('../controllers/reportController');

const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Stock valuation
router.get('/valuation', getStockValuation);
router.get('/valuation/export', exportStockValuation);

// IN_STOCK by bill
router.get('/in-stock', getInStockByBill);
router.get('/in-stock/export', exportInStockByBill);

// SPU reports
router.get('/spu', getSPUReport);
router.get('/spu/export', exportSPUReport);

// Category-specific report
router.get('/category/:category', getCategoryReport);

module.exports = router;