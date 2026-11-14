// MUST stay first — loads .env.local before any module reads process.env
import './env.js';

import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';

// Routes
import paymentRoutes from './routes/payments.js';
import reportRoutes from './routes/reports.js';
import emailRoutes from './routes/emails.js';
import webhookRoutes from './routes/webhooks.js';
import healthRoutes from './routes/health.js';
import placesRoutes from './routes/places.js';
import valuationRoutes from './routes/valuation.js';
import accountRoutes from './routes/account.js';
import { startNotificationPoller } from './services/notificationPoller.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Webhook routes are mounted before the global body parsers below, and
// parse their own bodies individually (see routes/webhooks.ts) rather
// than relying on them. Stripe's signature check needs the exact raw
// bytes it signed — a JSON.stringify of an already-parsed body is a
// different (if structurally identical) byte sequence and always fails
// verification, which is what express.json() running first would do.
app.use('/webhooks', webhookRoutes);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors({
  // Expo picks the next free port when 8081 is taken, so allow any
  // localhost port in development. Production stays locked to MOBILE_URL.
  origin: process.env.NODE_ENV === 'development'
    ? /^http:\/\/localhost:\d+$/
    : [process.env.MOBILE_URL || 'https://appraisalonline.com'],
  credentials: true,
}));

// Health check (no auth required)
app.use('/health', healthRoutes);

// Public API endpoints
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected API routes (require authentication)
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/valuation', valuationRoutes);
app.use('/api/account', accountRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Drains notification_queue (migration 040) — see
// services/notificationPoller.ts for why this is a poller rather than a
// Postgres-triggered HTTP call.
startNotificationPoller();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});

export default app;
