const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
// const { errorHandler } = require('./middleware/errorHandler');
// const notFound = require('./middleware/notFound');


// Import routes
const authRoutes = require('./routes/auth');


// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Connect to database
connectDB();


// ===================
// MIDDLEWARE
// ===================

// Enable CORS for frontend communication
app.use(cors({
    // for vercel (serverless)
    origin: process.env.FRONTEND_URL

    // for Render or other 
    // origin: process.env.NODE_ENV === 'production' 
    //   ? process.env.FRONTEND_URL 
    // : 'http://localhost:5173' /* Vite default port */ || '*',
    // credentials: true,
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// ===================
// HEALTH CHECK ROUTE
// ===================

app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Service Center Stock API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

// ===================
// API ROUTES
// ===================

app.use('/api/v1/auth', authRoutes);


// Placeholder for future routes
// app.use('/api/v1/auth', authRoutes);
// app.use('/api/v1/bills', billRoutes);
// app.use('/api/v1/serials', serialRoutes);

// ===================
// 404 HANDLER
// ===================

app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        error: `Route ${req.originalUrl} not found`
    });
});

// ===================
// GLOBAL ERROR HANDLER
// ===================

app.use((err, req, res, next) => {
    console.error('Error:', err);

    res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

module.exports = app;