# Appraisal Online - Setup Guide

## Prerequisites

- Node.js 18+ and npm
- Expo CLI: `npm install -g expo-cli`
- Git
- iOS Simulator (Xcode) or physical iOS device
- Supabase account (free tier available at supabase.com)
- Stripe account (test mode for development)

## Environment Setup

### 1. Supabase Project Setup

1. Create a new project at https://supabase.com
2. Copy your project URL and API key
3. Run the migrations to set up the database schema:
   ```bash
   # Install Supabase CLI
   npm install -g supabase

   # Link to your project
   supabase link --project-ref your-project-ref

   # Apply migrations
   supabase migration up
   ```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required variables:
- `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Stripe publishable key (test mode)
- `STRIPE_SECRET_KEY`: Stripe secret key (server-side only)
- `EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY`: Google Gemini API key
- Other API keys as needed

### 3. Mobile App Setup

```bash
# Navigate to mobile directory
cd mobile

# Install dependencies
npm install

# Start Expo development server
npm run dev

# Open in iOS simulator or scan QR code with Expo Go
```

## Database Schema

The database includes the following key tables:

- **users**: Core user records (consumers and brokers)
- **broker_profiles**: Broker-specific data (tier, cities, notification preferences)
- **properties**: Consumer-submitted properties
- **reports**: AI-generated valuations
- **leads**: Broker contact opportunities
- **lead_routings**: Lead delivery tracking
- **subscriptions**: Stripe subscription records
- **cities**: Master list of cities with founder counts
- **refund_log**: Refund request history
- **report_allowance**: Monthly free report tracking

See `docs/API.md` for full schema documentation.

## Development Workflow

### Running the App

```bash
cd mobile
npm run dev
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

## Key Services

### Authentication (`services/auth.service.ts`)
- Signup with email/password
- Email verification
- OAuth (Google)
- Password reset

### Reports (`services/report.service.ts`)
- Create property records
- Generate valuations via Gemini API
- Track free report allowance (3/month)
- Manage broker opt-in

### Subscriptions (`services/subscription.service.ts`)
- Create subscriptions after Stripe payment
- Check refund eligibility (tier-specific windows)
- Request refunds
- Track refund status

### Brokers (`services/broker.service.ts`)
- Create broker profiles
- Select cities (with founder cap enforcement)
- Update notification preferences
- View marketing allocations

## Business Logic Rules

### Free Reports
- 3 reports per calendar month (resets on the 1st)
- After 3 reports, show soft paywall

### Refund Windows
- Founder Lifetime: 14 days
- Premium Annual: 30 days
- Basic Annual: 30 days

### Founder Cap
- Maximum 30 Founder Lifetime members per city
- Checked at signup; city cannot be selected if full

### Marketing Allocation
- Calculated monthly on the 1st
- Formula: Lifetime x3, Premium x2, Basic x1
- Results published to founder dashboard

### Lead Delivery
- Lifetime & Premium: Real-time (email/push/SMS)
- Basic: Weekly digest (Monday 9 AM local time)
- Empty digest safeguard: Supplement with market intelligence if <3 reports

## Deployment

### App Store Submission

1. Configure bundle identifier in `app.json`
2. Set up EAS Build for automated iOS builds
3. Set up TestFlight for beta testing
4. Submit to App Store

See `docs/DEPLOYMENT.md` for detailed instructions.

## Testing

### Test Scenarios

1. **Consumer Flow**
   - Create account
   - Enter property address
   - Complete property details
   - Generate report
   - Opt in to broker contact
   - Verify report limit

2. **Broker Flow**
   - Create broker account
   - Complete onboarding (9 steps)
   - Select cities with founder cap validation
   - Choose subscription tier
   - Complete Stripe checkout
   - Verify refund window

3. **Refund Logic**
   - Lifetime tier: Refund within 14 days ✓, blocked after ✗
   - Annual tiers: Refund within 30 days ✓, blocked after ✗
   - Monthly refund rate tracking

## Troubleshooting

### Supabase Connection Issues
```bash
# Check auth status
supabase status

# Restart development server
npm run dev
```

### Expo Issues
```bash
# Clear Expo cache
expo start -c

# Clear node_modules and reinstall
rm -rf node_modules && npm install
```

### Stripe Connection
- Ensure publishable key is in `.env.local`
- Check webhook URLs in Stripe dashboard
- Test with Stripe test card: 4242 4242 4242 4242

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Expo Documentation](https://docs.expo.dev)
- [React Native Documentation](https://reactnative.dev)
- [Stripe Documentation](https://stripe.com/docs)
- [Gemini API Documentation](https://ai.google.dev/tutorials/python_quickstart)
