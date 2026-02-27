const express = require('express');
const router = express.Router();

const {
  getBills,
  getBill,
  createBill,
  updateBill,
  deleteBill,
  getBillByVoucher,
  getBillStats
} = require('../controllers/billController');

const { protect, canModify, adminOnly } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Statistics route (must be before :id route)
router.get('/stats/summary', getBillStats);

// Get by voucher number (must be before :id route)
router.get('/voucher/:voucherNumber', getBillByVoucher);

// CRUD routes
router.route('/')
  .get(getBills)
  .post(canModify, createBill);

router.route('/:id')
  .get(getBill)
  .put(canModify, updateBill)
  .delete(adminOnly, deleteBill);

module.exports = router;