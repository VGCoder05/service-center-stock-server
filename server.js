const express = require('express');
const cors = require('cors');
// Load environment variables FIRST
require('dotenv').config();
const app = require('./src/app')

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 Bookmark Manager API Server                          ║
║                                                            ║
║   → Local:    http://localhost:${PORT}                     ║
║   → API:      http://localhost:${PORT}/api/bookmarks,      ║
║               http://localhost:${PORT}/api/tags            ║
║   → Health:   http://localhost:${PORT}/api/health          ║
║   → Mode:     ${process.env.NODE_ENV || 'development'}     ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`❌ Unhandled Rejection: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});