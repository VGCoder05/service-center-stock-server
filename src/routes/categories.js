const express = require('express');
const router = express.Router();

const {
  categorizeSerial,
  bulkCategorize,
  getMovementHistory,
  getSerialsByCategory,
  getCategorySummary,
  updatePaymentStatus
} = require('../controllers/categoryController');

const { protect, canModify } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Dashboard summary
router.get('/summary', getCategorySummary);

// Get serials by category
router.get('/:category/serials', getSerialsByCategory);

// Movement history
router.get('/history/:serialId', getMovementHistory);

// Categorize single serial
router.put('/categorize/:id', canModify, categorizeSerial);

// Bulk categorize
router.put('/bulk-categorize', canModify, bulkCategorize);

// Update payment status
router.put('/payment/:id', canModify, updatePaymentStatus);

module.exports = router;