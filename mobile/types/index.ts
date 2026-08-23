// User types
export type UserType = 'consumer' | 'broker';
export type BrokerTier = 'Founder Lifetime' | 'Premium Annual' | 'Basic Annual';

export interface User {
  id: string;
  email: string;
  user_type: UserType;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  deleted_at?: string;
}

export interface BrokerProfile {
  id: string;
  user_id: string;
  company_name: string;
  license_number?: string;
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
  created_at: string;
  updated_at: string;
}

// Properties
export interface Property {
  id: string;
  user_id: string;
  address: string;
  address_components?: Record<string, any>;
  bedrooms?: number;
  bathrooms?: number;
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
  status: 'generating' | 'generated' | 'error' | 'deleted';
  pdf_url?: string;
  created_at: string;
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
