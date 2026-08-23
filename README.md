# Appraisal Online - iOS App

A two-sided marketplace that provides AI-powered property valuations to consumers and lead-generation services to real estate brokers, lenders, and agents.

**Status**: Phase 1 (Foundation) Complete ✅ | Ready for Phase 2 (UI Development)

## 📱 Product Overview

**Consumer Side (Free)**
- Enter property address and details
- Receive AI valuation in under 60 seconds
- Get 3 free reports per calendar month
- Optional broker contact opt-in
- Download PDF reports

**Broker Side (Paid)**
- Three subscription tiers with tier-specific refund windows
- Real-time lead notifications (Lifetime/Premium) or weekly digest (Basic)
- Supply-driven marketing budget allocation per city
- City-based lead routing with founder cap enforcement
- Notification preferences (email, push, SMS)

## 🏗️ Architecture

```
┌─────────────────┐
│  React Native   │  Expo Router
│   (Frontend)    │  Zustand State
└────────┬────────┘
         │
    ┌────▼────────────────────────┐
    │  Supabase (Backend)         │
    │  ├─ PostgreSQL Database     │
    │  ├─ Row-Level Security      │
    │  ├─ Real-time Subscriptions │
    │  └─ Edge Functions          │
    └────┬────────────────────────┘
         │
    ┌────┴──────────────────────────────────┐
    │  External Services                    │
    │  ├─ Stripe (Payments & Refunds)      │
    │  ├─ Google Gemini (AI Valuations)    │
    │  ├─ Google Places (Autocomplete)     │
    │  ├─ Postmark (Transactional Email)   │
    │  ├─ SendGrid (Weekly Digests)        │
    │  ├─ Twilio (SMS)                     │
    │  ├─ Expo (Push Notifications)        │
    │  └─ PostHog (Analytics)              │
    └─────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Supabase account (free tier)
- Stripe account (test mode)

### Setup
```bash
# Clone and setup
cd appraisal-online-ios

# Copy environment variables
cp .env.example .env.local
# Fill in your Supabase, Stripe, and API keys

# Install dependencies
cd mobile && npm install

# Run development server
npm run dev

# Open in iOS simulator or scan QR code with Expo Go
```

See [docs/SETUP.md](docs/SETUP.md) for detailed instructions.

## 📁 Project Structure

```
appraisal-online-ios/
├── mobile/                          # React Native App
│   ├── app/                         # Expo Router screens
│   │   ├── consumer/                # Consumer flows
│   │   ├── broker/                  # Broker flows
│   │   ├── auth/                    # Authentication screens
│   │   └── public/                  # Marketing pages
│   ├── services/                    # Business logic & API
│   │   ├── auth.service.ts
│   │   ├── report.service.ts
│   │   ├── subscription.service.ts
│   │   └── broker.service.ts
│   ├── stores/                      # Zustand state management
│   ├── types/                       # TypeScript definitions
│   ├── components/                  # Reusable UI components
│   ├── hooks/                       # Custom React hooks
│   └── styles/                      # Theme & global styles
│
├── supabase/                        # Database & Backend
│   ├── migrations/                  # Database schema
│   ├── functions/                   # Edge functions
│   └── seed/                        # Test data
│
├── docs/                            # Documentation
│   ├── SETUP.md                    # Installation & setup
│   ├── API.md                      # Data model & schema
│   ├── ARCHITECTURE.md             # Tech decisions & design
│   └── DEPLOYMENT.md               # App Store submission
│
├── CLAUDE.md                        # Master brief
├── PHASE1_SUMMARY.md               # What's been completed
└── README.md                        # This file
```

## 🏛️ Database Schema

**Core Tables:**
- `users` - Consumers & brokers
- `broker_profiles` - Broker data with tier & cities
- `properties` - Consumer properties
- `reports` - AI valuations with comparables
- `leads` - Broker contact opportunities
- `subscriptions` - Stripe subscription records
- `cities` - Master city list with founder counters

**Key Functions:**
- `check_founder_capacity()` - 30-per-city limit
- `calculate_refund_eligible_until()` - Tier-specific windows
- `get_report_allowance()` - Track free reports (3/month)

See [docs/API.md](docs/API.md) for complete schema documentation.

## 🔐 Security

- **Authentication**: Supabase Auth with email verification & OAuth
- **Authorization**: Row-Level Security (RLS) on all tables
- **Payments**: Stripe (PCI-compliant, no card data in app)
- **Data Privacy**: Explicit opt-in for broker contact, no pre-checked boxes
- **Environment**: API keys in `.env` (not in code)

## 💰 Subscription Tiers

| Tier | Price | Cities | Refund Window | Lead Delivery | SMS |
|------|-------|--------|---------------|---------------|-----|
| Founder Lifetime | $499 | 25 | 14 days | Real-time | ✅ |
| Premium Annual | $199/yr | 10 | 30 days | Real-time | ❌ |
| Basic Annual | $49/yr | 1 | 30 days | Weekly digest | ❌ |

All tiers capped at 30 Founder members per city.

## 📊 Key Business Rules

✅ **Free Reports**: 3 per calendar month per consumer
✅ **Refund Windows**: Tier-specific (14 or 30 days)
✅ **Founder Cap**: Max 30 per city per tier
✅ **Marketing Allocation**: Weighted by tier (Lifetime×3, Premium×2, Basic×1)
✅ **Lead Routing**: Real-time for Lifetime/Premium, weekly digest for Basic
✅ **AI Disclaimer**: Appears in app, email, and PDF

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for implementation details.

## 🛠️ Development

### Running the App
```bash
cd mobile
npm run dev
```

### Building for iOS
```bash
npm run build:ios
```

### Running Tests
```bash
npm test
```

### Type Checking
```bash
npm run typecheck
```

### Linting
```bash
npm run lint
```

## 📦 Phase 1 Deliverables (Complete)

✅ Database schema with 11 tables + functions + RLS
✅ TypeScript types for all data models
✅ 5 core services (auth, reports, subscriptions, brokers, Supabase)
✅ Zustand state management (auth, reports, subscriptions)
✅ App routing with entry point
✅ Comprehensive documentation (Setup, API, Architecture)

**Total Code**: ~4,500 lines

## 🎯 Phase 2 Preview (Coming Next)

**Screens to Build:**
- Consumer: Address entry → Property details → Report generation → Broker opt-in
- Broker: Onboarding → City selection → Paywall → Dashboard
- Public: "How We Make Money" explainer + Per-city Founder counter

**Timeline**: 4 weeks for complete UI

## 📚 Documentation

- **[SETUP.md](docs/SETUP.md)**: Installation, environment, development workflow
- **[API.md](docs/API.md)**: Complete data model, functions, RLS policies
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)**: Tech stack, design patterns, security
- **[CLAUDE.md](CLAUDE.md)**: Complete product brief & acceptance criteria
- **[PHASE1_SUMMARY.md](PHASE1_SUMMARY.md)**: What's been built, ready for Phase 2

## 🤝 Integration Points

All services are ready for integration:
- ✅ Stripe (subscription checkout & refunds)
- ✅ Google Gemini (AI valuations)
- ✅ Google Places (address autocomplete)
- ✅ RealtyMole & ATTOM (property comparables)
- ✅ Postmark (transactional email)
- ✅ SendGrid (weekly digests)
- ✅ Twilio (SMS)
- ✅ Expo (push notifications)
- ✅ PostHog (analytics)

## ⚙️ Environment Variables

See `.env.example` for complete list. Required for development:

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://...supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...

# Stripe (test keys)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# APIs
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=...
EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY=...
```

## 🚢 Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for:
- EAS Build configuration
- TestFlight beta testing
- App Store submission process
- Supabase production setup
- Stripe webhook configuration

## 📈 Analytics & Monitoring

- **PostHog**: Event tracking (signup, tier selection, refunds)
- **Supabase**: Database monitoring & query analytics
- **Stripe**: Payment metrics & refund rate tracking
- **Expo**: App crash reporting

## 🐛 Troubleshooting

### Supabase connection issues
```bash
supabase status
supabase db pull  # Get latest schema
npm run dev       # Restart
```

### Expo issues
```bash
expo start -c     # Clear cache
rm -rf node_modules && npm install
```

### Stripe test mode
Use test card: `4242 4242 4242 4242` with any future date and CVC.

## 📞 Support

For detailed setup and architecture questions:
- See [SETUP.md](docs/SETUP.md) for installation
- See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for design decisions
- See [API.md](docs/API.md) for data model
- Read [CLAUDE.md](CLAUDE.md) for complete product brief

## 📄 License

PROPRIETARY - Appraisal Online, Inc.

---

**Phase Status**: Foundation Complete ✅ → Ready for UI Development
