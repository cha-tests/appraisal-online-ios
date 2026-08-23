# Appraisal Online - Architecture & Design

## Overview

Appraisal Online is a two-sided marketplace built with:
- **Frontend**: React Native + Expo (iOS-first)
- **Backend**: Supabase (managed Postgres + authentication + real-time)
- **Payments**: Stripe (subscriptions + refunds)
- **AI Valuations**: Google Gemini 2.5 Flash API
- **Notifications**: Expo Push + Postmark (email) + Twilio (SMS)
- **Analytics**: PostHog

## Technology Decisions

### React Native + Expo
**Why**: 
- Single codebase for iOS, Android, and web
- Built-in updates via Expo
- Fast development iteration
- Production-ready

**Alternatives considered**: Native Swift (iOS-only, more code), Flutter (different ecosystem)

### Supabase
**Why**:
- Real-time PostgreSQL with RLS
- Built-in authentication
- Edge functions for serverless logic
- Free tier for development
- Row-level security for multi-tenant data

**Alternatives considered**: Firebase (no real-time Postgres), AWS Amplify (more complex setup)

### Stripe
**Why**:
- Industry standard for payments
- Handles refunds natively
- Subscription management built-in
- Webhook support for async operations

**Alternatives considered**: PayPal (fees), Square (US-only)

### Google Gemini 2.5 Flash
**Why**:
- Faster inference than earlier Gemini models
- Lower latency (important for real-time response)
- Google's latest and most capable small model
- Consistent with existing Apps Script pipeline

**Alternatives considered**: OpenAI (cost), Anthropic Claude (cost/speed tradeoff)

### Zustand for State Management
**Why**:
- Lightweight and performant
- Minimal boilerplate
- TypeScript support
- No provider nesting

**Alternatives considered**: Redux (verbose), Context API (prop drilling), MobX (overkill)

## Architecture Layers

### 1. Presentation Layer (UI)
- React Native components with Expo Router
- Organized by flow: consumer, broker, auth, public
- Reusable UI component library
- Theme system (colors, typography, spacing)

### 2. State Management Layer
- Zustand stores for auth, reports, subscriptions
- Local component state for forms
- Optimistic updates where applicable

### 3. Service Layer
- Business logic separated from components
- Services communicate with APIs and databases
- Error handling and parsing centralized
- Async operations managed cleanly

```
Components → Hooks (useAuthStore) → Services → Supabase/APIs
```

### 4. Data Layer
- Supabase client with auto-retry and refresh
- PostgreSQL database with RLS
- Real-time subscriptions for live updates
- Edge functions for complex server-side logic

## Data Flow

### Consumer Report Flow
```
1. User enters address
   → Google Places API autocomplete
   
2. User fills property details
   → Validate form locally
   
3. User submits
   → Create property record (Supabase)
   → Call Gemini API for valuation
   → Fetch comparables (RealtyMole + ATTOM)
   → Create report record (Supabase)
   
4. User sees report
   → Display in-app
   → Generate PDF
   → Offer broker contact opt-in
   
5. User opts in
   → Record consent
   → Create lead record
   → Route to brokers by tier + city
   → Send notifications
```

### Broker Subscription Flow
```
1. User completes onboarding
   → Store temporary selections in Zustand
   
2. User selects cities
   → Validate city count per tier
   → Check founder capacity (30 max per city)
   → Display marketing budget allocation
   
3. User chooses tier
   → Show price, refund window, features
   
4. User enters payment
   → Create Stripe session
   → Handle 3D Secure if needed
   
5. Stripe webhook received
   → Create subscription record
   → Update broker tier + cities
   → Increment city founder count
   → Send welcome email
   
6. Broker can request refund (within window)
   → Check refund eligibility
   → Validate days since purchase
   → Create refund log
   → Call Stripe API to refund
   → Update subscription status
```

## Security Considerations

### Authentication
- Supabase Auth handles signup, email verification, password reset
- OAuth (Google) as alternative sign-in
- JWT tokens stored in AsyncStorage
- Auto-refresh of expired tokens

### Authorization
- Row Level Security (RLS) on all tables
- Consumers can only see their own data
- Brokers can only see leads assigned to them
- Public endpoints require explicit policy

### Data Protection
- PII (phone numbers) only captured when opted in
- Passwords hashed by Supabase
- HTTPS for all API calls
- API keys stored in environment variables (not in code)

### Payment Security
- Stripe PCI-compliant (no card data in app)
- webhook signature verification
- Idempotency keys for refund operations

## Performance Optimizations

### Caching
- AsyncStorage for auth tokens + basic user data
- Zustand for view-layer caching
- Supabase client caches recent queries

### Pagination
- Lead lists paginated (20 at a time)
- Report history paginated
- Avoid loading entire datasets

### Lazy Loading
- Broker profile photos cached on device
- PDF generation deferred to on-demand

### Real-time Updates
- Subscribe to city founder counts (updates every signup)
- Subscribe to lead inbox (new leads appear instantly)
- Unsubscribe on unmount to prevent memory leaks

## Error Handling

Errors are handled at multiple layers:

1. **Service Layer**: Try-catch, parse Supabase errors
2. **Component Layer**: Display user-friendly messages
3. **Global Error Boundary**: Catch uncaught exceptions

Error types:
- **Network errors**: Retry logic with exponential backoff
- **Auth errors**: Redirect to login
- **Validation errors**: Show in-form feedback
- **Business logic errors**: Show actionable messages (e.g., founder cap reached)

## Scalability

### Database
- Indexes on frequently queried columns
- Materialized view for marketing allocations (run monthly)
- Partitioning on `leads(created_at)` for historical data

### API
- Edge functions (Supabase) for complex logic
- Webhook queues for async operations (Stripe)
- Rate limiting on public endpoints

### Frontend
- Code splitting by route
- Image optimization
- Minimize bundle size with tree-shaking

## Monitoring & Observability

### Analytics
- PostHog for funnel analysis (signup completion, tier selection, refunds)
- Segment critical events: report generated, subscription created, refund processed

### Error Tracking
- Sentry for crash reporting (optional)
- Error logging to Supabase for debugging

### Performance
- Lighthouse CI for web bundle
- App startup time metrics
- API latency tracking

## Deployment Pipeline

```
Local Dev → Git Push → GitHub Actions → EAS Build → TestFlight → App Store
                                    ↓
                            Run Tests + Lint
```

1. **Local**: `npm run dev` with Expo
2. **CI/CD**: GitHub Actions runs tests, type-check, lint
3. **Build**: EAS Build generates iOS .ipa
4. **Beta**: TestFlight for internal testing
5. **Production**: Submit to App Store

## Cost Optimization

### Free/Low-Cost Services
- Supabase free tier: 500MB database, unlimited API requests
- Expo free tier: unlimited builds (with EAS subscription for faster builds)
- Google Places API: $7/1000 requests (low volume for autocomplete)
- Gemini: ~$0.075/1M input tokens, $0.30/1M output tokens (very cheap)

### Scaling Costs
- Supabase: Scale storage/auth as needed ($10-100/month typical)
- Stripe: 2.9% + $0.30 per transaction
- Email (Postmark + SendGrid): $10-50/month combined
- SMS (Twilio): $0.0075 per SMS (Lifetime tier only)

## Disaster Recovery

### Backup Strategy
- Supabase automated backups (daily)
- Manual exports before major migrations
- Stripe records cloud-backed (not our responsibility)

### Incident Response
- Error alerting via PostHog
- Rollback plan: Previous Expo update available
- Database restoration: Last known good backup

## Future Enhancements

### Phase 2
- Premium tier with advanced analytics
- Lead assignment automation
- Broker network (collaboration features)

### Phase 3
- International expansion (Philippines, India)
- Broker AI assistant
- Consumer premium tier (advanced comps)

### Phase 4
- Marketplace for ancillary services (inspections, financing)
- API for partners
- White-label broker platform
