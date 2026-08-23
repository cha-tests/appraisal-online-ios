# Appraisal Online - API & Data Model

## Database Tables

### users
Represents both consumers and brokers.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key, auth user ID |
| email | TEXT | Unique email address |
| user_type | TEXT | 'consumer' or 'broker' |
| created_at | TIMESTAMP | Account creation |
| updated_at | TIMESTAMP | Last update |
| last_login_at | TIMESTAMP | Last login time |
| deleted_at | TIMESTAMP | Soft delete flag |

### broker_profiles
Extended data for broker accounts.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK to users |
| company_name | TEXT | Business name |
| license_number | TEXT | Real estate license |
| bio | TEXT | Bio/description |
| profile_photo_url | TEXT | Profile image |
| phone | TEXT | Contact phone |
| website | TEXT | Company website |
| tier | TEXT | 'Founder Lifetime', 'Premium Annual', 'Basic Annual' |
| selected_cities | UUID[] | Array of city IDs |
| founder_number | BIGINT | Sequence # per city (1-30) |
| email_enabled | BOOLEAN | Email notifications |
| push_enabled | BOOLEAN | Push notifications |
| sms_enabled | BOOLEAN | SMS notifications (Lifetime only) |
| quiet_hours_start | TIME | Start of quiet hours |
| quiet_hours_end | TIME | End of quiet hours |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update |

### properties
Consumer-submitted property records.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK to users |
| address | TEXT | Full address |
| address_components | JSONB | Parsed Google Places data |
| bedrooms | INTEGER | Bedroom count |
| bathrooms | DECIMAL | Bathroom count (can be 2.5, etc.) |
| square_feet | INTEGER | Living area |
| lot_size | INTEGER | Lot size in sq ft |
| year_built | INTEGER | Construction year |
| property_type | TEXT | 'single_family', 'condo', etc. |
| condition | TEXT | 'Excellent', 'Good', 'Fair', 'Poor' |
| recent_updates | JSONB | Array of renovation items |
| created_at | TIMESTAMP | Creation time |

### reports
AI-generated valuations.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK to users |
| property_id | UUID | FK to properties |
| estimated_value | BIGINT | Valuation in cents |
| confidence_range | JSONB | {low: int, high: int} in cents |
| comparables | JSONB | Array of ComparableSale objects |
| gemini_response | JSONB | Full Gemini API response |
| broker_contact_opted_in | BOOLEAN | Consumer opted in for contact |
| phone_provided | TEXT | Consumer's phone number |
| phone_verified | BOOLEAN | SMS verified flag |
| status | TEXT | 'generating', 'generated', 'error', 'deleted' |
| pdf_url | TEXT | URL to generated PDF |
| created_at | TIMESTAMP | Creation time |

### leads
Broker contact opportunities.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| report_id | UUID | FK to reports |
| property_id | UUID | FK to properties |
| consumer_id | UUID | FK to users (consumer) |
| consumer_email | TEXT | Denormalized for quick access |
| consumer_phone | TEXT | From report.phone_provided |
| property_address | TEXT | Snapshot of address at lead creation |
| property_value | BIGINT | Snapshot of valuation in cents |
| city_id | UUID | FK to cities |
| status | TEXT | 'new', 'contacted', 'converted', 'archived' |
| created_at | TIMESTAMP | Lead creation time |
| updated_at | TIMESTAMP | Last update |

### lead_routings
Delivery tracking for leads.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| lead_id | UUID | FK to leads |
| broker_id | UUID | FK to users (broker) |
| delivery_channel | TEXT | 'email', 'push', 'sms' |
| delivery_status | TEXT | 'pending', 'sent', 'failed', 'bounced' |
| delivery_timestamp | TIMESTAMP | When delivered |
| delivery_error | TEXT | Error message if failed |
| included_in_digest | BOOLEAN | Part of weekly digest |
| digest_date | DATE | Date of digest inclusion |
| created_at | TIMESTAMP | Routing creation time |

### subscriptions
Stripe subscription records.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| broker_id | UUID | FK to users (unique) |
| stripe_subscription_id | TEXT | Stripe subscription ID |
| stripe_customer_id | TEXT | Stripe customer ID |
| tier | TEXT | Subscription tier |
| price | BIGINT | Price in cents |
| currency | TEXT | 'USD' |
| billing_cycle | TEXT | 'lifetime', 'annual' |
| started_at | TIMESTAMP | Subscription start date |
| renewal_at | TIMESTAMP | Next renewal date (annual only) |
| cancelled_at | TIMESTAMP | Cancellation date |
| refund_eligible_until | TIMESTAMP | Refund window expiration |
| status | TEXT | 'active', 'pending', 'cancelled', 'refunded' |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last update |

### cities
Master list of cities.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| name | TEXT | City name |
| state | TEXT | US state code |
| country | TEXT | Country code |
| population | BIGINT | City population |
| founder_count_lifetime | INTEGER | Current Founder members |
| founder_count_premium | INTEGER | Current Premium members |
| founder_count_basic | INTEGER | Current Basic members |
| marketing_budget_share | DECIMAL | Monthly allocation % |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last update |

### refund_log
Refund request history.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| subscription_id | UUID | FK to subscriptions |
| broker_id | UUID | FK to users |
| tier | TEXT | Tier at time of request |
| refund_amount | BIGINT | Amount in cents |
| refund_reason | TEXT | Reason provided by broker |
| stripe_refund_id | TEXT | Stripe refund transaction ID |
| days_since_purchase | INTEGER | Days from subscription start |
| refund_eligible | BOOLEAN | Was within refund window |
| status | TEXT | 'requested', 'approved', 'processing', 'completed', 'denied' |
| requested_at | TIMESTAMP | Request time |
| processed_at | TIMESTAMP | Completion time |
| created_at | TIMESTAMP | Record creation |

### report_allowance
Monthly free report tracking.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK to users (unique per month) |
| month | DATE | First day of month |
| reports_used | INTEGER | Count of reports used |
| reset_next_month | TIMESTAMP | When counter resets |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last update |

### marketing_allocations
Monthly budget distribution snapshot.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| city_id | UUID | FK to cities |
| allocation_month | DATE | Month for allocation |
| lifetime_member_count | INTEGER | # of Founder members |
| premium_member_count | INTEGER | # of Premium members |
| basic_member_count | INTEGER | # of Basic members |
| total_weight | DECIMAL | Weighted sum for calculation |
| allocation_percentage | DECIMAL | Final share % |
| created_at | TIMESTAMP | Record creation |

## Key Functions

### check_founder_capacity(city_id)
Returns true if city has fewer than 30 Founder members.

### get_founder_number(broker_id, city_id)
Returns the next sequential founder number (1-30) for a broker in a city.

### calculate_refund_eligible_until(tier, subscription_started_at)
Calculates the refund window expiration based on tier:
- Founder Lifetime: started_at + 14 days
- Premium Annual: started_at + 30 days
- Basic Annual: started_at + 30 days

### can_request_refund(broker_id)
Returns true if broker is within refund window.

### get_report_allowance(user_id, month)
Returns current month's report usage and remaining quota.

### increment_report_usage(user_id, month)
Increments report counter for the month.

## Real-time Subscriptions

The following tables have real-time enabled:
- `cities` (founder count updates)
- `leads` (new lead notifications)
- `subscriptions` (subscription status changes)

Subscribe on mobile using Supabase Realtime:

```typescript
supabase
  .channel('cities')
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'cities' },
    (payload) => {
      console.log('City updated:', payload.new);
    }
  )
  .subscribe();
```

## Row Level Security (RLS)

All tables have RLS enabled:

- **users**: Users can only see/update their own record
- **broker_profiles**: Brokers can only see/update their own profile
- **properties**: Consumers can only see/update their own properties
- **reports**: Consumers see their own; brokers see leads they're routed to
- **leads**: Brokers see assigned leads; consumers see their own leads
- **subscriptions**: Brokers see their own subscription
- **report_allowance**: Users see their own allowance

## Indexes

Strategic indexes for performance:

- `users(email)` - Fast email lookups
- `reports(user_id, broker_contact_opted_in)` - Filter opted-in reports
- `leads(city_id, created_at)` - Find leads by city and date
- `subscriptions(broker_id, tier, status)` - Broker subscription queries
- `report_allowance(user_id, month)` - Monthly usage tracking

## Constraints

- `broker_profiles(user_id)` - One profile per broker
- `subscriptions(broker_id)` - One active subscription per broker
- `report_allowance(user_id)` - One record per user per month
- `cities(name, state, country)` - Unique city combinations
- Founder cap: 30 per city enforced by check_founder_capacity()
- Monthly free reports: 3 per consumer enforced by app layer

## Transactions

Critical multi-step operations wrapped in transactions:

1. **Subscription Creation**: Insert subscription + update city founder count
2. **Refund Processing**: Create refund log + call Stripe API + update subscription status
3. **Lead Creation**: Insert lead + route to brokers based on tier + send notifications
