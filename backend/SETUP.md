# Backend Setup Guide

Complete step-by-step guide to get the backend running locally and deployed to production.

## 🎯 Goals

After completing this guide, you'll have:
1. ✅ Backend API running locally on port 3001
2. ✅ All environment variables configured
3. ✅ Stripe & Postmark accounts set up
4. ✅ Ready to deploy to production

## ⏱️ Time Required

- First-time setup: **2-4 hours** (includes account creation)
- Subsequent deploys: **15-30 minutes**

## 📋 Prerequisites

- Node.js 18+ installed
- npm or yarn
- Git
- Text editor (VS Code recommended)
- Stripe account (free trial available)
- Postmark account (free trial available)
- Supabase project already created

## 🔧 Local Development Setup

### Step 1: Install Dependencies

```bash
cd backend
npm install
```

### Step 2: Create Environment File

```bash
cp .env.example .env.local
```

### Step 3: Configure Supabase

Get these from your Supabase dashboard:
- `SUPABASE_URL` - Project URL
- `SUPABASE_ANON_KEY` - Anonymous key
- `SUPABASE_SERVICE_KEY` - Service role key (keep secret!)

Update `.env.local`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_KEY=eyJhbG...
```

### Step 4: Setup Stripe

1. Go to https://stripe.com
2. Create account or sign in
3. Copy **Test** API keys (not live keys!)
4. Add to `.env.local`:

```env
STRIPE_SECRET_KEY=sk_test_4eC39HqLyjWDarhtT657L8zN
STRIPE_PUBLISHABLE_KEY=pk_test_51234...
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

**Getting Webhook Secret**:
1. Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. URL: `http://localhost:3001/webhooks/stripe` (local testing)
4. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `customer.subscription.deleted`
5. Copy signing secret

### Step 5: Setup Postmark

1. Go to https://postmarkapp.com
2. Create free account
3. Create Server (API tokens section)
4. Copy API token
5. Add to `.env.local`:

```env
POSTMARK_API_KEY=00000000-0000-0000-0000-000000000000
POSTMARK_FROM_EMAIL=noreply@appraisalonline.com
```

**Configure Bounce Webhook**:
1. Server → Webhooks
2. Add webhook
3. URL: `http://localhost:3001/webhooks/postmark` (local testing)
4. Select: Bounces, Complaints, Deliveries
5. Save

### Step 6: Generate JWT Secret

```bash
# Generate random string for JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env.local`:
```env
JWT_SECRET=<paste_generated_value>
```

### Step 7: Verify Configuration

```bash
npm run typecheck
```

Should have no errors.

### Step 8: Start Development Server

```bash
npm run dev
```

You should see:
```
🚀 Server running on http://localhost:3001
📍 Environment: development
```

### Step 9: Test Health Endpoint

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-08-21T...",
  "uptime": 5.123,
  "environment": "development"
}
```

## 📱 Connect Mobile App

Update frontend `.env.local`:
```env
EXPO_PUBLIC_API_URL=http://localhost:3001
```

When mobile app makes API calls, they'll reach your local backend.

## 🚀 Deployment

### Production Checklist

- [ ] Stripe live keys obtained
- [ ] Postmark account verified (email sending tested)
- [ ] Database migrations completed
- [ ] Environment variables set
- [ ] Webhook URLs updated to production domain
- [ ] SSL certificate installed
- [ ] Backup plan documented

### Option 1: Heroku (Easiest)

```bash
# Install Heroku CLI
brew install heroku

# Login
heroku login

# Create app
heroku create appraisal-online-api

# Set environment variables
heroku config:set -a appraisal-online-api \
  NODE_ENV=production \
  SUPABASE_URL=... \
  SUPABASE_SERVICE_KEY=... \
  STRIPE_SECRET_KEY=... \
  POSTMARK_API_KEY=... \
  JWT_SECRET=...

# Deploy
git push heroku main

# View logs
heroku logs -t -a appraisal-online-api
```

### Option 2: DigitalOcean (Recommended)

1. **Create Droplet**
   - OS: Ubuntu 22.04 LTS
   - Size: Basic ($5-10/month)
   - Add SSH key

2. **Setup Server**
   ```bash
   ssh root@your-droplet-ip
   
   # Update system
   apt update && apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   apt install -y nodejs
   
   # Install PM2 (process manager)
   npm install -g pm2
   
   # Clone repo
   git clone your-repo-url
   cd backend
   npm install --production
   
   # Create .env
   nano .env
   # (paste production env vars)
   
   # Start app with PM2
   pm2 start npm --name "appraisal-api" -- start
   pm2 save
   pm2 startup
   ```

3. **Setup Reverse Proxy (Nginx)**
   ```bash
   apt install -y nginx
   
   # Create nginx config
   nano /etc/nginx/sites-available/default
   ```
   
   ```nginx
   server {
     listen 80;
     server_name your-domain.com;
   
     location / {
       proxy_pass http://localhost:3001;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
     }
   }
   ```
   
   ```bash
   systemctl restart nginx
   ```

4. **Setup SSL (Let's Encrypt)**
   ```bash
   apt install -y certbot python3-certbot-nginx
   certbot --nginx -d your-domain.com
   ```

### Option 3: Docker + Any Host

1. **Create Dockerfile**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY dist ./dist
   ENV NODE_ENV=production
   EXPOSE 3001
   CMD ["npm", "start"]
   ```

2. **Build & Push**
   ```bash
   docker build -t appraisal-api .
   docker tag appraisal-api your-registry/appraisal-api:latest
   docker push your-registry/appraisal-api:latest
   ```

3. **Deploy with Docker**
   ```bash
   docker run -d \
     -p 3001:3001 \
     -e SUPABASE_URL=... \
     -e STRIPE_SECRET_KEY=... \
     # ... other env vars
     your-registry/appraisal-api:latest
   ```

## 🔄 Update Webhook URLs

After deploying to production, update webhook endpoints:

### Stripe Webhooks
1. Dashboard → Developers → Webhooks
2. Update endpoint URL to: `https://your-domain.com/webhooks/stripe`
3. Use **live** signing secret

### Postmark Webhooks
1. Server → Webhooks
2. Update URL to: `https://your-domain.com/webhooks/postmark`

## 📊 Verify Production Setup

```bash
# Health check
curl https://your-domain.com/health/detailed

# Should return:
{
  "status": "healthy",
  "services": {
    "api": "ok",
    "supabase": "ok",
    "stripe": "ok",
    "postmark": "ok"
  }
}
```

## 🧪 Test Payment Flow

1. Start mobile app and complete broker onboarding
2. Go to checkout
3. Use Stripe test card: `4242 4242 4242 4242`
4. Verify:
   - Payment processes
   - Subscription created in database
   - Welcome email received

## 📈 Monitoring

### Check Logs
```bash
# Heroku
heroku logs -t

# DigitalOcean/PM2
pm2 logs

# Docker
docker logs <container-id>
```

### Monitor Services
- **Stripe Dashboard**: Payment events, webhooks
- **Postmark Dashboard**: Email deliveries, bounces
- **Supabase Dashboard**: Database activity, RLS policies

## 🔐 Security Checklist

- [ ] JWT_SECRET is random and secret
- [ ] No API keys in code/git
- [ ] HTTPS enabled in production
- [ ] CORS configured for mobile app domain
- [ ] Webhook signatures verified
- [ ] RLS policies enforced on database
- [ ] Environment variables not logged

## 🐛 Troubleshooting

### "Cannot find module" errors
```bash
npm install
npm run build
```

### Payment fails with "Invalid API Key"
- Check STRIPE_SECRET_KEY starts with `sk_test_` (not `pk_`)
- Verify key in `.env` matches Stripe dashboard

### Emails not sending
- Verify POSTMARK_API_KEY in Stripe webhook (wait 1-2 minutes)
- Check Postmark bounce logs for email issues
- Test: `curl -X POST http://localhost:3001/api/emails/send ...`

### Database connection errors
- Verify SUPABASE_URL and SUPABASE_SERVICE_KEY
- Check Supabase dashboard for project status
- Run: `curl http://localhost:3001/health/detailed`

### Webhook not firing
- Verify URL is correct and publicly accessible
- Check Stripe/Postmark webhook delivery logs
- Re-trigger by making payment in test mode

## 📚 Next Steps

1. ✅ Complete local setup (this guide)
2. ✅ Test payment flow with Stripe test card
3. ✅ Verify emails sending via Postmark
4. ✅ Deploy to production (Option 1, 2, or 3)
5. ✅ Update webhook URLs to production
6. ✅ Obtain Stripe/Postmark live keys
7. ✅ Migrate to live keys in production
8. ✅ Monitor and maintain

## 💡 Pro Tips

- Use `.env.local` for secrets (never commit to git)
- Test webhooks locally using ngrok: `ngrok http 3001`
- Add Sentry for error tracking in production
- Monitor CPU/memory with PM2 Plus
- Setup daily backups for Supabase

## ❓ Questions?

Refer to:
- `backend/README.md` - API documentation
- `.env.example` - Environment variables guide
- Stripe docs: https://stripe.com/docs/api
- Postmark docs: https://postmarkapp.com/developer

---

**Status**: Ready to deploy! 🚀

Once local setup is complete, proceed to production deployment.
