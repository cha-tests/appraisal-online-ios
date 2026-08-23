import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';

// Routes
import paymentRoutes from './routes/payments.js';
import reportRoutes from './routes/reports.js';
import emailRoutes from './routes/emails.js';
import webhookRoutes from './routes/webhooks.js';
import healthRoutes from './routes/health.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors({
  origin: [
    'http://localhost:8081',
    'http://localhost:3000',
    process.env.MOBILE_URL || 'https://appraisalonline.com',
  ],
  credentials: true,
}));

// Health check (no auth required)
app.use('/health', healthRoutes);

// Webhook routes (no auth required, but have their own validation)
app.use('/webhooks', webhookRoutes);

// Public API endpoints
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected API routes (require authentication)
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/emails', emailRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});

export default app;
