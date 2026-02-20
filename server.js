// Load environment variables FIRST
require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/db');

// ===================
// START SERVER
// ===================

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start Express server
    const server = app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║     SERVICE CENTER STOCK MANAGEMENT API               ║
╠═══════════════════════════════════════════════════════╣
║  Status:      ✅ Running                              ║
║  Environment: ${process.env.NODE_ENV.padEnd(41)}║
║  Port:        ${String(PORT).padEnd(41)}║
║  API Health:  http://localhost:${PORT}/api/health        ║
╚═══════════════════════════════════════════════════════╝
      `);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error(`❌ Unhandled Rejection: ${err.message}`);
      server.close(() => {
        process.exit(1);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error(`❌ Uncaught Exception: ${err.message}`);
      process.exit(1);
    });

  } catch (error) {
    console.error(`❌ Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();