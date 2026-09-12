// User types
export type UserType = 'consumer' | 'broker';
export type BrokerTier = 'Founder Lifetime' | 'Premium Annual' | 'Basic Annual';

export interface User {
  id: string;
  email: string;
  user_type: UserType;
  first_name?: string;
  last_name?: string;
  // Collected at signup so it's on file once, then shared with a broker
  // automatically only if/when the consumer opts in for professional
  // contact on a report (see broker-optins.tsx) — never shared otherwise.
  phone?: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  deleted_at?: string;
}

export type BrokerRole = 'broker' | 'salesperson';
export type KycStatus = 'pending' | 'approved' | 'rejected';

export interface BrokerProfile {
  id: string;
  user_id: string;
  company_name: string;
  license_number?: string;
  // 'salesperson' operates under a sponsoring broker rather than holding a
  // broker license outright — both can join (see the Sep 1 sync-up spec),
  // and license_number stays optional either way.
  role: BrokerRole;
  bio?: string;
  profile_photo_url?: string;
  phone?: string;
  website?: string;
  tier: BrokerTier;
  selected_cities: string[];
  founder_number?: number;
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  // Lightweight identity check (selfie + government ID), reviewed by an
  // admin — not automated pass/fail. A 'pending' broker can still complete
  // onboarding; kyc_status is what gates lead access down the line.
  kyc_status: KycStatus;
  kyc_id_url?: string;
  kyc_selfie_url?: string;
  kyc_submitted_at?: string;
  kyc_reviewed_at?: string;
  kyc_rejection_reason?: string;
  // Locks in the ₱5,000/year rate for life for the first 1,000 paid
  // ('Premium Annual') signups — see migration 015 and the Sep 1 spec's
  // founding-member pricing decision. founding_member_locked_price is in
  // minor units (centavos), matching subscriptions.price.
  is_founding_member: boolean;
  founding_member_number?: number;
  founding_member_locked_price?: number;
  created_at: string;
  updated_at: string;
}

export interface DisclaimerAcceptance {
  id: string;
  user_id: string;
  disclaimer_type: 'client' | 'broker';
  version: string;
  context?: Record<string, unknown>;
  accepted_at: string;
}

// Properties
export interface Property {
  id: string;
  user_id: string;
  address: string;
  address_components?: Record<string, any>;
  bedrooms?: number;
  bathrooms?: number;
  parking_spaces?: number;
  square_feet?: number;
  lot_size?: number;
  year_built?: number;
  property_type?: string;
  condition?: string;
  recent_updates?: string[];
  created_at: string;
}

// Reports
export interface ValueRange {
  low: number;
  high: number;
}

export interface ComparableSale {
  address: string;
  sale_price: number;
  sale_date: string;
  distance_miles: number;
  similarity_score: number;
}

export interface Report {
  id: string;
  user_id: string;
  property_id: string;
  estimated_value: number;
  confidence_range: ValueRange;
  comparables: ComparableSale[];
  gemini_response?: Record<string, any>;
  broker_contact_opted_in: boolean;
  phone_provided?: string;
  phone_verified: boolean;
  // Asked only alongside the broker opt-in, never on the initial appraisal
  // — see broker-optins.tsx. title_url is a storage path (private bucket),
  // not a public URL; a self-reported flag, never verified by the
  // platform itself — see BROKER_DISCLAIMER_TEXT in config/disclaimers.ts.
  is_owner?: boolean;
  intends_to_sell?: boolean;
  title_url?: string;
  title_submitted_at?: string;
  status: 'generating' | 'generated' | 'error' | 'deleted';
  pdf_url?: string;
  created_at: string;
  // Only populated where the query joins it in (see
  // reportService.getUserReports) — the reports table has no address column
  // of its own; it lives on the referenced property.
  property?: { address: string; address_components?: { route?: string; city?: string } };
}

// Leads
export interface Lead {
  id: string;
  report_id: string;
  property_id: string;
  consumer_id: string;
  consumer_email: string;
  consumer_phone?: string;
  property_address: string;
  property_value?: number;
  city_id?: string;
  status: 'new' | 'contacted' | 'converted' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface LeadRouting {
  id: string;
  lead_id: string;
  broker_id: string;
  delivery_channel: 'email' | 'push' | 'sms';
  delivery_status: 'pending' | 'sent' | 'failed' | 'bounced';
  delivery_timestamp?: string;
  delivery_error?: string;
  included_in_digest: boolean;
  digest_date?: string;
  created_at: string;
}

// Subscriptions & Billing
export interface Subscription {
  id: string;
  broker_id: string;
  stripe_subscription_id?: string;
  stripe_customer_id: string;
  tier: BrokerTier;
  price: number; // cents
  currency: string;
  billing_cycle: 'lifetime' | 'annual' | 'monthly';
  started_at: string;
  renewal_at?: string;
  cancelled_at?: string;
  refund_eligible_until: string;
  status: 'active' | 'pending' | 'cancelled' | 'refunded';
  created_at: string;
  updated_at: string;
}

export interface RefundLogEntry {
  id: string;
  subscription_id: string;
  broker_id: string;
  tier: BrokerTier;
  refund_amount: number; // cents
  refund_reason?: string;
  stripe_refund_id?: string;
  days_since_purchase: number;
  refund_eligible: boolean;
  status: 'requested' | 'approved' | 'processing' | 'completed' | 'denied';
  requested_at: string;
  processed_at?: string;
  created_at: string;
}

// Cities
export interface City {
  id: string;
  name: string;
  state?: string;
  country: string;
  population?: number;
  founder_count_lifetime: number;
  founder_count_premium: number;
  founder_count_basic: number;
  marketing_budget_share: number;
  created_at: string;
  updated_at: string;
}

// Report Allowance
export interface ReportAllowance {
  id: string;
  user_id: string;
  month: string;
  reports_used: number;
  reset_next_month?: string;
  created_at: string;
  updated_at: string;
}

// Marketing Allocation
export interface MarketingAllocation {
  id: string;
  city_id: string;
  allocation_month: string;
  lifetime_member_count: number;
  premium_member_count: number;
  basic_member_count: number;
  total_weight: number;
  allocation_percentage: number;
  created_at: string;
}

// API Response types
export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, any>;
}

export interface ApiSuccess<T> {
  data: T;
  timestamp: string;
}

// Form submission types
export interface PropertyDetailsFormData {
  bedrooms: number;
  bathrooms: number;
  parking_spaces?: number;
  square_feet: number;
  lot_size?: number;
  year_built: number;
  property_type: string;
  condition: string;
  recent_updates?: string[];
}

export interface BrokerOnboardingFormData {
  company_name: string;
  license_number?: string;
  phone: string;
  website?: string;
  cities: string[];
  tier: BrokerTier;
  email_notifications: boolean;
  push_notifications: boolean;
  sms_notifications: boolean; // Lifetime only
}

// Authentication
export interface AuthSession {
  user: User;
  session_token: string;
  expires_at: string;
  broker_profile?: BrokerProfile;
}

export interface AuthCredentials {
  email: string;
  password?: string;
  verification_code?: string;
}
