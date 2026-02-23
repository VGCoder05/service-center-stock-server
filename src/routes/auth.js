const express = require('express');
const router = express.Router();

const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');

// ===================
// PUBLIC ROUTES
// ===================

// for testing
router.get('/register', (req, res) => {
    res.json({ message: 'Use POST method to register' });
});

// @route   POST /api/v1/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', register);

// @route   POST /api/v1/auth/login
// @desc    Login user
// @access  Public
router.post('/login', login);

// ===================
// PROTECTED ROUTES
// ===================

// @route   GET /api/v1/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', protect, getMe);

// @route   PUT /api/v1/auth/me
// @desc    Update user profile
// @access  Private
router.put('/me', protect, updateProfile);

// @route   PUT /api/v1/auth/change-password
// @desc    Change password
// @access  Private
router.put('/change-password', protect, changePassword);

module.exports = router;