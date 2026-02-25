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

const {
  getParts,
  getPart,
  createPart,
  updatePart,
  deletePart,
  getAllPartsList,
  getPartCategories
} = require('../controllers/partsController');

const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getAllCustomersList
} = require('../controllers/customerController');

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

// ===================
// PARTS ROUTES
// ===================

// Get all parts for dropdown (no pagination)
router.get('/parts/list/all', getAllPartsList);

// Get unique categories
router.get('/parts/categories', getPartCategories);

// CRUD routes
router.route('/parts')
  .get(getParts)
  .post(canModify, createPart);

router.route('/parts/:id')
  .get(getPart)
  .put(canModify, updatePart)
  .delete(adminOnly, deletePart);

// ===================
// CUSTOMER ROUTES
// ===================

router.get('/customers/list/all', getAllCustomersList);

router.route('/customers')
  .get(getCustomers)
  .post(canModify, createCustomer);

router.route('/customers/:id')
  .get(getCustomer)
  .put(canModify, updateCustomer)
  .delete(adminOnly, deleteCustomer);

module.exports = router;