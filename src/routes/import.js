const express = require('express');
const router = express.Router();

const { importExcel, validateImport } = require('../controllers/importController');

const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Import routes
router.post('/excel', importExcel);
router.post('/validate', validateImport);

module.exports = router;
