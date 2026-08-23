# Supabase Setup Guide

This guide walks you through setting up Supabase for Appraisal Online.

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Create a new project:
   - Click "New Project"
   - Enter a project name (e.g., "appraisal-online")
   - Create a strong database password
   - Select a region closest to you
   - Click "Create new project"

4. Wait for the project to initialize (2-3 minutes)

## Step 2: Get Your Credentials

1. Go to **Settings** → **API**
2. Copy these values:
   - `Project URL` → `EXPO_PUBLIC_SUPABASE_URL`
   - `anon` public key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Step 3: Set Up Environment Variables

1. In the mobile folder, copy `.env.example` to `.env.local`:
   ```bash
   cp mobile/.env.example mobile/.env.local
   ```

2. Edit `mobile/.env.local` and paste your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   ```

3. Add other API keys as needed (Gemini, Stripe, Google Places)

## Step 4: Run Database Migrations

1. Go to the Supabase dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
5. Paste into the SQL editor and click **Run**
6. Repeat for `supabase/migrations/002_functions_and_triggers.sql`

This creates all your tables, functions, and RLS policies.

## Step 5: Test the Connection

1. Start the app:
   ```bash
   cd mobile
   npm start
   ```

2. Press `w` for web or scan QR code for phone
3. Try signing up with a test email
4. Check Supabase dashboard **Authentication** tab to see the new user

## What Gets Created

### Tables
- `users` - Consumer and broker user accounts
- `broker_profiles` - Broker company info
- `properties` - Submitted properties
- `reports` - AI valuations
- `leads` - Qualified homeowner leads
- `subscriptions` - Broker membership info
- `cities` - Available cities for brokers

### Security
- Row-level security (RLS) policies protect all tables
- Users can only see their own data
- Brokers can only access their leads and cities

### Functions
- `check_founder_capacity()` - Enforces 30-per-city limit
- `calculate_refund_eligible_until()` - Calculates refund windows

## Environment Variables Reference

```bash
# Required
EXPO_PUBLIC_SUPABASE_URL          # Your Supabase project URL
EXPO_PUBLIC_SUPABASE_ANON_KEY     # Supabase anon/public key

# Optional but recommended
EXPO_PUBLIC_GEMINI_API_KEY        # For AI valuations
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY # For payments
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY  # For address autocomplete
```

## Troubleshooting

**"Missing Supabase environment variables"**
- Make sure `.env.local` exists in the mobile folder
- Check that env var names match exactly (case-sensitive)
- Restart the dev server after changing env vars

**"User creation failed"**
- Make sure migrations ran successfully
- Check the SQL output for errors
- Verify the `users` table exists

**"Invalid email or password"**
- Supabase requires strong passwords (8+ chars, mixed case/numbers)
- Make sure user exists in Supabase auth (check **Authentication** tab)

## Next Steps

1. **Test auth flow**: Try signup/login in the app
2. **Test data operations**: Create properties, reports, leads
3. **Set up other services**: Stripe, Gemini, email, push notifications
4. **Configure RLS policies**: Review security settings for your use case

## Security Best Practices

✅ Never commit `.env.local` (it's in .gitignore)
✅ Use environment variables for all secrets
✅ Review RLS policies before going to production
✅ Enable 2FA on your Supabase account
✅ Use separate Supabase projects for dev/prod
✅ Monitor database usage in Supabase dashboard
