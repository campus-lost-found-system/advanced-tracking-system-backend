const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const claimsRoutes = require('./routes/claims');
const aiMatchingRoutes = require('./routes/aiMatching');
const cctvRoutes = require('./routes/cctvVerification');

const saleRoutes = require('./routes/sale.routes');
const adminSaleRoutes = require('./routes/adminsale.routes');
const itemRoutes = require('./routes/items');

// Utils
const { error } = require('./utils/response');

const app = express();

// ===== Middlewares =====
app.use(helmet({
  crossOriginResourcePolicy: false,
}));                 // Security headers
app.use(cors());                   // Enable CORS
app.use(morgan('dev'));            // Request logging
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
const path = require('path');
app.use('/public', express.static(path.join(__dirname, '../public')));

// ===== Routes =====
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api', claimsRoutes);
app.use('/api', aiMatchingRoutes);
app.use('/api/cctv', cctvRoutes);

// 🔹 Your sale feature
app.use('/api/sale', saleRoutes);
app.use('/api/admin/sale', adminSaleRoutes);
app.use('/api/items', itemRoutes);

// ===== Health Check =====
app.get('/', (req, res) => {
  res.send('Advanced Tracking System Backend API is running...');
});

// ===== 404 Handler =====
app.use((req, res) => {
  error(res, 'Resource not found', 404);
});

// ===== Global Error Handler =====
app.use((err, req, res, next) => {
  console.error(err.stack);
  error(res, 'Internal Server Error', 500, err.message);
});

module.exports = app;
