-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Core Tables
-- ============================================================================

-- Users table (consumers and brokers)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('consumer', 'broker')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_login_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Broker profiles (extends users for broker-specific data)
CREATE TABLE broker_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  license_number TEXT,
  bio TEXT,
  profile_photo_url TEXT,
  phone TEXT,
  website TEXT,
  -- Subscription tier
  tier TEXT NOT NULL CHECK (tier IN ('Founder Lifetime', 'Premium Annual', 'Basic Annual')),
  -- Cities (stored as JSON array of city IDs)
  selected_cities UUID[] DEFAULT '{}',
  -- Founder tracking
  founder_number BIGINT, -- Sequence number per city (1-30)
  -- Lead preferences
  email_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  sms_enabled BOOLEAN DEFAULT TRUE, -- Lifetime only
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Cities master list
CREATE TABLE cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  state TEXT, -- US state code
  country TEXT NOT NULL DEFAULT 'US',
  population BIGINT,
  -- Founder tracking
  founder_count_lifetime INTEGER DEFAULT 0,
  founder_count_premium INTEGER DEFAULT 0,
  founder_count_basic INTEGER DEFAULT 0,
  -- Marketing budget
  marketing_budget_share DECIMAL(5,2) DEFAULT 0, -- Percentage
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(name, state, country)
);

-- Consumer properties
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  address_components JSONB, -- Parsed Google Places data
  bedrooms INTEGER,
  bathrooms DECIMAL(3,1),
  square_feet INTEGER,
  lot_size INTEGER,
  year_built INTEGER,
  property_type TEXT, -- single_family, condo, etc.
  condition TEXT, -- Excellent, Good, Fair, Poor
  recent_updates JSONB, -- Array of recent renovations
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- AI-generated reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  -- Valuation data
  estimated_value BIGINT NOT NULL,
  confidence_range JSONB NOT NULL, -- {low: int, high: int}
  comparables JSONB NOT NULL, -- Array of comparable sales
  gemini_response JSONB, -- Full API response for audit
  -- Broker opt-in
  broker_contact_opted_in BOOLEAN DEFAULT FALSE,
  phone_provided TEXT,
  phone_verified BOOLEAN DEFAULT FALSE,
  -- Report status
  status TEXT DEFAULT 'generated' CHECK (status IN ('generating', 'generated', 'error', 'deleted')),
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Leads (broker contact opportunities)
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  consumer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consumer_email TEXT NOT NULL,
  consumer_phone TEXT,
  -- Property info snapshot
  property_address TEXT NOT NULL,
  property_value BIGINT,
  city_id UUID REFERENCES cities(id),
  -- Status tracking
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Lead routings (maps leads to brokers, tracks delivery)
CREATE TABLE lead_routings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Delivery channel
  delivery_channel TEXT NOT NULL CHECK (delivery_channel IN ('email', 'push', 'sms')),
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed', 'bounced')),
  delivery_timestamp TIMESTAMP WITH TIME ZONE,
  delivery_error TEXT,
  -- Digest tracking
  included_in_digest BOOLEAN DEFAULT FALSE,
  digest_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Subscriptions (Stripe integration)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  -- Tier & pricing
  tier TEXT NOT NULL CHECK (tier IN ('Founder Lifetime', 'Premium Annual', 'Basic Annual')),
  price BIGINT NOT NULL, -- cents
  currency TEXT DEFAULT 'USD',
  billing_cycle TEXT, -- 'lifetime', 'annual', or 'monthly'
  -- Dates
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  renewal_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  refund_eligible_until TIMESTAMP WITH TIME ZONE NOT NULL,
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'cancelled', 'refunded')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Refund log
CREATE TABLE refund_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  refund_amount BIGINT NOT NULL, -- cents
  refund_reason TEXT,
  stripe_refund_id TEXT,
  days_since_purchase INTEGER,
  refund_eligible BOOLEAN NOT NULL,
  status TEXT DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'processing', 'completed', 'denied')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Monthly marketing budget allocation
CREATE TABLE marketing_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  allocation_month DATE NOT NULL,
  -- Weighted calculation: Lifetime x3, Premium x2, Basic x1
  lifetime_member_count INTEGER DEFAULT 0,
  premium_member_count INTEGER DEFAULT 0,
  basic_member_count INTEGER DEFAULT 0,
  total_weight DECIMAL(10,2) DEFAULT 0,
  allocation_percentage DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(city_id, allocation_month)
);

-- Free report allowance tracking
CREATE TABLE report_allowance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- First day of month
  reports_used INTEGER DEFAULT 0,
  reset_next_month TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
CREATE INDEX idx_broker_profiles_user_id ON broker_profiles(user_id);
CREATE INDEX idx_broker_profiles_tier ON broker_profiles(tier);
CREATE INDEX idx_properties_user_id ON properties(user_id);
CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_property_id ON reports(property_id);
CREATE INDEX idx_reports_broker_opted_in ON reports(broker_contact_opted_in);
CREATE INDEX idx_leads_report_id ON leads(report_id);
CREATE INDEX idx_leads_consumer_id ON leads(consumer_id);
CREATE INDEX idx_leads_city_id ON leads(city_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at);
CREATE INDEX idx_lead_routings_lead_id ON lead_routings(lead_id);
CREATE INDEX idx_lead_routings_broker_id ON lead_routings(broker_id);
CREATE INDEX idx_lead_routings_delivery_status ON lead_routings(delivery_status);
CREATE INDEX idx_subscriptions_broker_id ON subscriptions(broker_id);
CREATE INDEX idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_refund_eligible ON subscriptions(refund_eligible_until);
CREATE INDEX idx_refund_log_broker_id ON refund_log(broker_id);
CREATE INDEX idx_refund_log_tier ON refund_log(tier);
CREATE INDEX idx_report_allowance_user_id ON report_allowance(user_id);
CREATE INDEX idx_report_allowance_month ON report_allowance(month);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_routings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_allowance ENABLE ROW LEVEL SECURITY;

-- Users can only see/update their own record
CREATE POLICY "Users can view own record" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own record" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Brokers can only see/update their own profile
CREATE POLICY "Brokers can view own profile" ON broker_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Brokers can update own profile" ON broker_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Consumers can only see/update their own properties
CREATE POLICY "Consumers can view own properties" ON properties
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Consumers can create properties" ON properties
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Consumers can update own properties" ON properties
  FOR UPDATE USING (auth.uid() = user_id);

-- Reports: consumers see their own, brokers see leads they're routed to
CREATE POLICY "Consumers can view own reports" ON reports
  FOR SELECT USING (auth.uid() = user_id);

-- Leads: visible to assigned brokers and consumers
CREATE POLICY "Brokers can view assigned leads" ON leads
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM lead_routings WHERE lead_id = id AND broker_id = auth.uid())
  );

CREATE POLICY "Consumers can view own leads" ON leads
  FOR SELECT USING (auth.uid() = consumer_id);

-- Subscriptions: brokers see their own
CREATE POLICY "Brokers can view own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = broker_id);

-- Report allowance: users see their own
CREATE POLICY "Users can view own allowance" ON report_allowance
  FOR SELECT USING (auth.uid() = user_id);
