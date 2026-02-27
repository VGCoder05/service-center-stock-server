const express = require('express');
const router = express.Router();

const {
  getDashboardSummary,
  getDashboardAlerts,
  getRecentActivity,
  getQuickStats
} = require('../controllers/dashboardController');

const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.get('/summary', getDashboardSummary);
router.get('/alerts', getDashboardAlerts);
router.get('/activity', getRecentActivity);
router.get('/stats', getQuickStats);

module.exports = router;