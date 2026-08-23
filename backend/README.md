# Appraisal Online - Backend API

Node.js/Express backend for Appraisal Online mobile app.

**Status**: ✅ Production-ready structure (integrations need configuration)

## 📋 Features

- 🔒 **Authentication**: Supabase JWT verification
- 💳 **Payments**: Stripe integration for subscriptions
- 📄 **PDF Reports**: Server-side PDF generation
- 📧 **Email Service**: Postmark for transactional emails
- 📲 **Webhooks**: Stripe and Postmark webhook handling
- 🏥 **Health Checks**: Liveness, readiness, and detailed health endpoints
- 📝 **Logging**: Winston logger with file rotation
- 🔍 **Error Handling**: Comprehensive error handling and validation

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase project
- Stripe account
- Postmark account

### Installation

```bash
cd backend
npm install
```

### Configuration

1. Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

2. Fill in your credentials:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
STRIPE_SECRET_KEY=sk_test_...
POSTMARK_API_KEY=your_postmark_key
JWT_SECRET=your_secret_key_min_32_chars
```

### Development

```bash
npm run dev
```

Server runs on `http://localhost:3001`

### Production

```bash
npm run build
npm start
```

## 📚 API Endpoints

### Health & Status

```
GET  /health           - Basic health check
GET  /health/detailed  - Services status
GET  /health/ready     - Readiness probe
GET  /health/live      - Liveness probe
```

### Payments

```
POST /api/payments/intent      - Create payment intent
POST /api/payments/charge      - Process payment
POST /api/payments/confirm     - Confirm & create subscription
GET  /api/payments/:paymentId  - Get payment status
```

### Reports

```
GET  /api/reports/:reportId           - Get report details
GET  /api/reports/:reportId/pdf       - Download PDF
GET  /api/reports/:reportId/pdf-url   - Get shareable URL
```

### Emails

```
POST /api/emails/send                  - Send generic email
POST /api/emails/welcome               - Send broker welcome
POST /api/emails/confirmation          - Send consumer confirmation
POST /api/emails/lead-notification     - Send broker lead notification
```

### Webhooks

```
POST /webhooks/stripe    - Stripe events
POST /webhooks/postmark  - Email events
```

## 🔐 Authentication

All API endpoints (except webhooks and health) require Bearer token:

```
Authorization: Bearer <supabase_jwt_token>
```

Token is automatically provided by Supabase Auth on mobile app.

## 🏗️ Project Structure

```
backend/
├── src/
│   ├── index.ts              # Entry point
│   ├── middleware/           # Express middleware
│   │   ├── auth.ts          # Authentication
│   │   └── errorHandler.ts  # Error handling
│   ├── routes/              # API routes
│   │   ├── payments.ts
│   │   ├── reports.ts
│   │   ├── emails.ts
│   │   ├── webhooks.ts
│   │   └── health.ts
│   ├── services/            # Business logic
│   │   ├── supabase.ts
│   │   ├── stripe.ts
│   │   ├── pdf.ts
│   │   └── email.ts
│   └── utils/               # Utilities
│       └── logger.ts
├── .env.example             # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## 🔌 Service Integration

### Supabase

- Database for storing subscriptions, refund logs, etc.
- JWT verification for authentication
- RLS policies for data access control

**Setup**: Create database tables and RLS policies (see frontend supabase/ folder)

### Stripe

- Payment intent creation
- Card processing
- Webhook handling for payment events
- Refund processing

**Setup**: 
1. Create Stripe account
2. Get API keys
3. Configure webhook endpoint: `https://your-domain.com/webhooks/stripe`
4. Enable events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`

### Postmark

- Transactional emails
- Bounce/complaint handling
- Email templates (optional)

**Setup**:
1. Create Postmark account
2. Get API key
3. Add bounce webhook: `https://your-domain.com/webhooks/postmark`

### PDF Generation

Currently uses `pdfkit` for server-side PDF generation. PDFs are generated on-demand and can be cached.

**Options**:
- pdfkit (current)
- puppeteer (HTML to PDF)
- wkhtmltopdf
- AWS Lambda + Layers

## 📊 Logging

Logs are written to:
- Console (development)
- `logs/error.log` (errors only)
- `logs/combined.log` (all logs)

Control with `LOG_LEVEL` env var: `debug`, `info`, `warn`, `error`

## 🧪 Testing

Add tests with Jest:

```bash
npm test
```

## 🚢 Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["npm", "start"]
```

### Heroku

```bash
heroku create appraisal-online-api
heroku config:set NODE_ENV=production
heroku config:set SUPABASE_URL=...
# ... set other env vars
git push heroku main
```

### AWS Lambda

Requires serverless framework. See `serverless.yml` (to be created).

### Google Cloud Run

```bash
gcloud run deploy appraisal-online-api \
  --source . \
  --platform managed \
  --region us-central1 \
  --set-env-vars SUPABASE_URL=... \
  # ... other env vars
```

### DigitalOcean App Platform

1. Create new app from GitHub
2. Set environment variables
3. Set build command: `npm install && npm run build`
4. Set run command: `npm start`
5. Deploy

## 📈 Monitoring

### Health Endpoints

Use these for Kubernetes/orchestration health probes:

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 5

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 10
```

### Error Tracking

Add Sentry for error monitoring:

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({ dsn: process.env.SENTRY_DSN });
app.use(Sentry.Handlers.errorHandler());
```

### Performance Monitoring

Add New Relic, DataDog, or other APM tools:

```typescript
require('newrelic');
```

## 🔧 Maintenance

### Database Migrations

After schema changes:

```bash
supabase migration new <name>
supabase migration up
```

### Upgrading Dependencies

```bash
npm update
npm audit fix
npm test
```

### Backup

Regular backups are handled by Supabase. Configure backup frequency in dashboard.

## ❓ Troubleshooting

### Connection Errors

Check `.env` variables and service availability:
```bash
curl http://localhost:3001/health/detailed
```

### Payment Failures

Check Stripe logs and webhook deliveries in Stripe dashboard.

### Email Delivery Issues

Check Postmark webhooks and bounce logs.

### PDF Generation Errors

Check temp directory permissions: `chmod 755 tmp/pdfs`

## 📞 Support

For API issues, check:
1. Logs: `logs/error.log`
2. Console output
3. Service health: `/health/detailed`
4. Webhook deliveries in respective dashboards

## 📝 License

Proprietary - Appraisal Online, Inc.

---

**Next Steps**:
1. Configure environment variables
2. Setup Stripe and Postmark accounts
3. Deploy to production
4. Configure webhooks
5. Run integration tests

**Time to Deploy**: ~2-4 hours (first time setup including account creation)
