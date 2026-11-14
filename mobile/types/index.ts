// User types
export type UserType = 'consumer' | 'broker';
// Single-tier model (migration 034) — 'Premium Annual' is the only tier.
// Kept as a type (not a plain string literal everywhere) so every existing
// call site that assigned 'Basic Annual'/'Founder Lifetime' surfaces as a
// compile error, rather than silently keeping a retired tier name alive.
export type BrokerTier = 'Premium Annual';

export interface User {
  id: string;
  email: string;
  user_type: UserType;
  first_name?: string;
  last_name?: string;
  suffix?: string;
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
  // A broker's permanent place in the global signup order (migration 034),
  // which fixes their intro price tier — see config/brokerTiers.ts's
  // getBrokerAnnualPrice. Null until claimed (see claimBrokerSignupRank).
  signup_rank?: number;
  // Auto-assigned at signup (migration 030) — this broker's own shareable
  // code. referred_by is the referring broker's user_id, set once at
  // signup if a valid code was entered; never changes afterward.
  referral_code?: string;
  referred_by?: string;
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
  // Free-text flag for a situation the standard fields don't capture —
  // agricultural/farmland, mixed-use, co-owned/inherited, disaster-damaged,
  // pre-selling/not-yet-built, etc. Optional, independent of property_type.
  special_situation?: string;
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
  // Required in the UI whenever broker_contact_opted_in is set true (see
  // broker-optins.tsx) — how many professionals the consumer wants matched
  // to them.
  requested_broker_count?: number;
  // Optional, self-reported signal for a specialized broker niche
  // (foreclosure, financing, OFW/overseas owner) — see broker-optins.tsx
  // and migration 031. Copied onto the resulting lead's lead_tags.
  help_tags?: string[];
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
  // Copied from reports.help_tags at lead creation (migration 031) — a
  // visible signal for a specialized broker niche, not a routing input.
  lead_tags?: string[];
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

export type LeadRoutingClaimStatus = 'invited' | 'claimed';
export type LeadRoutingStatus = 'new' | 'contacted' | 'in_talks' | 'converted' | 'lost' | 'revoked';

/**
 * One row per get_my_lead_routings() (migrations 037/038) — the single
 * source of truth for the broker-side inbox/dashboard/detail screens.
 * PII fields (consumer_name/email/phone, property_address, estimated_value,
 * is_owner, intends_to_sell, title_url, comparables) are only ever
 * populated when claim_status is 'claimed'; before that they come back
 * null/undefined from the RPC itself, not just hidden by the UI.
 */
export interface LeadRoutingPreview {
  lead_routing_id: string;
  lead_id: string;
  claim_status: LeadRoutingClaimStatus;
  status: LeadRoutingStatus;
  lost_reason?: string;
  delivery_channel: 'email' | 'push' | 'sms';
  invited_at: string;
  claimed_at?: string;
  property_type?: string;
  condition?: string;
  bedrooms?: number;
  bathrooms?: number;
  city_name?: string;
  city_state?: string;
  city_country?: string;
  estimated_value_low?: number;
  estimated_value_high?: number;
  lead_tags?: string[];
  has_title_on_file: boolean;
  requested_broker_count?: number;
  claimed_count: number;
  // Claimed-only — see the migration comment above.
  property_address?: string;
  consumer_name?: string;
  consumer_email?: string;
  consumer_phone?: string;
  estimated_value?: number;
  is_owner?: boolean;
  intends_to_sell?: boolean;
  title_url?: string;
  comparables?: any[];
}

/**
 * One row per get_my_connected_brokers() (migration 039) — the consumer
 * side's view of their own leads' routed brokers. Unlike
 * LeadRoutingPreview this carries the broker's own public listing info
 * (not the homeowner's PII — the consumer already has that), since the
 * homeowner is the one deciding whether to keep or revoke each broker.
 */
export interface ConnectedBrokerRouting {
  lead_routing_id: string;
  lead_id: string;
  report_id: string;
  property_address: string;
  broker_id: string;
  broker_company_name?: string;
  broker_first_name?: string;
  broker_last_name?: string;
  claim_status: LeadRoutingClaimStatus;
  status: LeadRoutingStatus;
  invited_at: string;
  claimed_at?: string;
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
  special_situation?: string;
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
