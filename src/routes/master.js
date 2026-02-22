const express = require('express');
const router = express.Router();

// Controllers
const {
  getSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getAllSuppliersList
} = require('../controllers/supplierController');

// Middleware
const { protect, canModify, adminOnly } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// ===================
// SUPPLIER ROUTES
// ===================

// Get all suppliers for dropdown (no pagination)
router.get('/suppliers/list/all', getAllSuppliersList);

// CRUD routes
router.route('/suppliers')
  .get(getSuppliers)
  .post(canModify, createSupplier);

router.route('/suppliers/:id')
  .get(getSupplier)
  .put(canModify, updateSupplier)
  .delete(adminOnly, deleteSupplier);

module.exports = router;