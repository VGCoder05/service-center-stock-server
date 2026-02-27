const express = require('express');
const router = express.Router();

const {
  getSerials,
  getSerialsByBill,
  getSerial,
  getSerialByNumber,
  createSerial,
  createBulkSerials,
  updateSerial,
  deleteSerial,
  checkSerialExists
} = require('../controllers/serialController');

const { protect, canModify, adminOnly } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Check if serial exists (must be before :id route)
router.get('/check/:serialNumber', checkSerialExists);

// Get by serial number string (must be before :id route)
router.get('/sn/:serialNumber', getSerialByNumber);

// Get serials by bill ID
router.get('/bill/:billId', getSerialsByBill);

// Bulk create
router.post('/bulk', canModify, createBulkSerials);

// CRUD routes
router.route('/')
  .get(getSerials)
  .post(canModify, createSerial);

router.route('/:id')
  .get(getSerial)
  .put(canModify, updateSerial)
  .delete(adminOnly, deleteSerial);

module.exports = router;