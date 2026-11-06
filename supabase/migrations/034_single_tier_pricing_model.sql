-- Replaces the three-tier membership model (Founder Lifetime, Premium
-- Annual, Basic Annual) with a single broker tier ("Premium Annual" kept
-- as the tier name to minimize churn), decided after the free-tier cap
-- bug (migration 033) prompted a wider pricing review. New terms:
--
--   - Every broker covers 5 cities, no exceptions.
--   - Price is set by global signup order, through Dec 31, 2026:
--       signup rank 1-1,000      -> $9.95/year
--       signup rank 1,001-2,000  -> $14.95/year
--       signup rank 2,001+       -> $19.95/year
--   - From Jan 1, 2027 onward, EVERY charge (new signup or renewal, any
--     cohort) is $24.95/year — intro pricing is not locked for life.
--   - Real-time delivery (email + push) for everyone. No SMS, no weekly
--     digest — those existed specifically to differentiate Lifetime/Basic,
--     which no longer exist.
--   - 30-day refund window for everyone (the old 14-day/no-pro-rata rule
--     was specific to Lifetime's one-time, irreversible purchase).
--   - No broker-count cap of any kind — open signup at whatever price
--     tier is currently active.
--
-- No real brokers have ever used this app yet (confirmed before writing
-- this migration) — only test accounts — so this is a straight replacement
-- with no grandfathering concerns.

-- ============================================================================
-- 1. Remove the founder-cap system (global 1,000 cap, 30-per-city cap) —
--    existed solely to protect Founder Lifetime's "founder" exclusivity.
-- ============================================================================

DROP TRIGGER IF EXISTS broker_profile_founder_count ON broker_profiles;
DROP TRIGGER IF EXISTS broker_profile_founder_count_delete ON broker_profiles;
DROP FUNCTION IF EXISTS increment_city_founder_count();
DROP FUNCTION IF EXISTS decrement_city_founder_count();
DROP FUNCTION IF EXISTS check_founder_capacity(UUID);
DROP FUNCTION IF EXISTS get_founder_number(UUID, UUID);

-- founder_count_premium/founder_count_basic were always dead columns (never
-- read or written anywhere in the app) from an earlier, unfinished design —
-- dropped alongside founder_count_lifetime for the same reason.
ALTER TABLE cities
  DROP COLUMN IF EXISTS founder_count_lifetime,
  DROP COLUMN IF EXISTS founder_count_premium,
  DROP COLUMN IF EXISTS founder_count_basic;
ALTER TABLE broker_profiles DROP COLUMN IF EXISTS founder_number;

-- ============================================================================
-- 2. Remove the old ₱5,000/year-for-life "founding member" lock (migration
--    015/016) — a different, conflicting "first 1,000 get a special price"
--    promise for Premium Annual specifically, superseded by the signup-rank
--    pricing ladder below.
-- ============================================================================

DROP FUNCTION IF EXISTS claim_founding_member_slot(UUID);
DROP FUNCTION IF EXISTS reset_founding_member_seq();
DROP SEQUENCE IF EXISTS founding_member_seq;

ALTER TABLE broker_profiles
  DROP COLUMN IF EXISTS is_founding_member,
  DROP COLUMN IF EXISTS founding_member_number,
  DROP COLUMN IF EXISTS founding_member_locked_price;

-- ============================================================================
-- 3. Remove the weekly-digest / real-time split — existed to differentiate
--    Basic (cheap, digest) from Premium/Lifetime (real-time). Every broker
--    is real-time now. `lead_routings.digest_date` itself is left in place
--    (nullable, simply never set going forward) rather than dropped, since
--    historical rows already reference it and nothing requires removing it.
-- ============================================================================

DROP FUNCTION IF EXISTS next_weekly_digest_date();

-- Revert to the pre-022 policy: a broker sees everything routed to them,
-- immediately, with no digest gate.
ALTER POLICY "Brokers can view own lead routings" ON lead_routings
  USING (auth.uid() = broker_id);

-- ============================================================================
-- 4. Simplify lead routing — no more tiers to rank by. Brokers covering a
--    city are now ordered purely by earliest active subscription, and
--    the digest_date/tier-rank branching from migration 032 is removed.
--    The per-lead broker_count cap (migration 032's actual point) is
--    untouched — that's orthogonal to tiers.
-- ============================================================================

CREATE OR REPLACE FUNCTION route_lead_to_brokers(
  p_lead_id UUID,
  p_city_id UUID,
  p_broker_count INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  routed_count INTEGER;
BEGIN
  IF p_city_id IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO lead_routings (lead_id, broker_id, delivery_channel)
  SELECT
    p_lead_id,
    ranked.user_id,
    ranked.delivery_channel
  FROM (
    SELECT
      bp.user_id,
      CASE
        WHEN bp.email_enabled THEN 'email'
        WHEN bp.push_enabled THEN 'push'
        ELSE 'email'
      END AS delivery_channel,
      s.started_at
    FROM broker_profiles bp
    JOIN subscriptions s ON s.broker_id = bp.user_id AND s.status = 'active'
    WHERE bp.selected_cities @> ARRAY[p_city_id]
    ORDER BY s.started_at ASC
    LIMIT p_broker_count
  ) ranked;

  GET DIAGNOSTICS routed_count = ROW_COUNT;
  RETURN routed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION route_all_orphaned_leads()
RETURNS INTEGER AS $$
DECLARE
  routed_count INTEGER;
BEGIN
  INSERT INTO lead_routings (lead_id, broker_id, delivery_channel)
  SELECT lead_id, user_id, delivery_channel
  FROM (
    SELECT
      l.id AS lead_id,
      bp.user_id,
      CASE
        WHEN bp.email_enabled THEN 'email'
        WHEN bp.push_enabled THEN 'push'
        ELSE 'email'
      END AS delivery_channel,
      r.requested_broker_count,
      ROW_NUMBER() OVER (
        PARTITION BY l.id
        ORDER BY s.started_at
      ) AS rn
    FROM leads l
    JOIN reports r ON r.id = l.report_id
    JOIN broker_profiles bp ON bp.selected_cities @> ARRAY[l.city_id]
    JOIN subscriptions s ON s.broker_id = bp.user_id AND s.status = 'active'
    WHERE l.city_id IS NOT NULL
      AND l.status != 'archived'
      AND NOT EXISTS (SELECT 1 FROM lead_routings lr WHERE lr.lead_id = l.id)
  ) ranked
  WHERE requested_broker_count IS NULL OR rn <= requested_broker_count;

  GET DIAGNOSTICS routed_count = ROW_COUNT;
  RETURN routed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- route_orphaned_leads_to_broker (027) needs no change — it never ranked by
-- tier (it only ever routes to the one broker who just selected a city),
-- and its sms_enabled check (now permanently false for every broker, per
-- the default change below) just falls through to email/push same as here.

-- No tier offers SMS any more (it was Lifetime-only). Column is kept
-- rather than dropped — 008/022/027/028's delivery_channel CASE
-- expressions all still reference it, and leaving it present but always
-- false is simpler and safer than touching four more functions to remove
-- a branch that will just never be true going forward.
ALTER TABLE broker_profiles ALTER COLUMN sms_enabled SET DEFAULT FALSE;

-- ============================================================================
-- 5. Single tier: tighten the CHECK constraints so the retired tier names
--    can no longer be written, and fix refund-window calc's now-dead
--    branches (left harmless, but simplified for clarity).
--
--    This migration was first written on the assumption that no
--    broker_profiles/subscriptions rows existed under any tier yet — wrong:
--    test accounts created under the old three-tier model are already live
--    (e.g. scripts/create-broker-test-accounts.ts's 'Basic Annual' free
--    account), and the CHECK below rejected them outright the first time
--    this ran. Per the "no real brokers, test accounts only, replace it
--    entirely" decision this migration already implements, backfill every
--    existing row to the one surviving tier before tightening the
--    constraint, rather than leaving the retired tier names in place.
-- ============================================================================

UPDATE broker_profiles SET tier = 'Premium Annual' WHERE tier IS DISTINCT FROM 'Premium Annual';
UPDATE subscriptions SET tier = 'Premium Annual' WHERE tier IS DISTINCT FROM 'Premium Annual';

ALTER TABLE broker_profiles DROP CONSTRAINT IF EXISTS broker_profiles_tier_check;
ALTER TABLE broker_profiles ADD CONSTRAINT broker_profiles_tier_check CHECK (tier = 'Premium Annual');

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_tier_check CHECK (tier = 'Premium Annual');

CREATE OR REPLACE FUNCTION calculate_refund_eligible_until(
  tier_param TEXT,
  subscription_started_at TIMESTAMP WITH TIME ZONE
)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
  -- Every tier is 30 days now; tier_param kept for call-site compatibility.
  RETURN subscription_started_at + INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 6. New pricing mechanism: a broker's price depends on WHEN they signed up
--    (their place in the global signup order, fixed forever) and the DATE
--    the charge is being computed (which climbs to a flat rate in 2027,
--    regardless of signup order). This one function is the single source
--    of truth for both the initial charge and any future renewal charge —
--    billing in this app is one-time PaymentIntents computed fresh at
--    charge time (see backend/src/services/stripe.ts), not a live Stripe
--    Subscription object holding a fixed price, so there is no separate
--    "migrate existing subscriptions" step needed for the 2027 jump: the
--    next time this function is called for any broker, on or after Jan 1
--    2027, it simply returns the new flat rate.
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS broker_signup_seq START 1;

ALTER TABLE broker_profiles ADD COLUMN IF NOT EXISTS signup_rank INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_broker_profiles_signup_rank
  ON broker_profiles(signup_rank)
  WHERE signup_rank IS NOT NULL;

-- Backfill existing (pre-migration) broker_profiles rows, ordered by
-- created_at — onboarding only calls claim_broker_signup_rank for a NEW
-- signup, so without this every test account created before today would
-- have signup_rank permanently NULL and trip getBrokerSignupPrice's "must
-- complete onboarding" guard the next time one of them goes through
-- checkout. Advances the sequence past whatever was just assigned so the
-- next real new signup doesn't collide with a backfilled rank.
WITH ranked AS (
  SELECT user_id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM broker_profiles
  WHERE signup_rank IS NULL
)
UPDATE broker_profiles SET signup_rank = ranked.rn
FROM ranked
WHERE broker_profiles.user_id = ranked.user_id;

SELECT setval('broker_signup_seq', GREATEST((SELECT COALESCE(MAX(signup_rank), 0) FROM broker_profiles), 1), true);

-- Claims this broker's permanent place in the signup order. Idempotent —
-- calling it again for a broker who already has a rank just returns that
-- rank rather than consuming a new sequence value, safe to retry. No cap:
-- every broker gets a rank, used only to look up their price tier below.
CREATE OR REPLACE FUNCTION claim_broker_signup_rank(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_existing INTEGER;
  v_rank INTEGER;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Can only claim a signup rank for yourself';
  END IF;

  SELECT signup_rank INTO v_existing FROM broker_profiles WHERE user_id = p_user_id;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  v_rank := nextval('broker_signup_seq');

  UPDATE broker_profiles SET signup_rank = v_rank WHERE user_id = p_user_id;

  RETURN v_rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION claim_broker_signup_rank(UUID) TO authenticated;

-- Lets scripts/reset-all-data.ts reset this counter during a full data
-- wipe, same as the old reset_founding_member_seq it replaces.
CREATE OR REPLACE FUNCTION reset_broker_signup_seq()
RETURNS VOID AS $$
BEGIN
  PERFORM setval('broker_signup_seq', 1, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION reset_broker_signup_seq() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION reset_broker_signup_seq() TO service_role;

-- Returns the price (in cents) a broker at the given signup rank should be
-- charged, evaluated as of p_as_of (defaults to today). Used for both the
-- initial signup charge and any later renewal charge.
CREATE OR REPLACE FUNCTION get_broker_annual_price(
  p_signup_rank INTEGER,
  p_as_of DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER AS $$
BEGIN
  IF p_as_of >= '2027-01-01' THEN
    RETURN 2495; -- $24.95 flat, for everyone, regardless of original rank
  ELSIF p_signup_rank <= 1000 THEN
    RETURN 995; -- $9.95
  ELSIF p_signup_rank <= 2000 THEN
    RETURN 1495; -- $14.95
  ELSE
    RETURN 1995; -- $19.95
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION get_broker_annual_price(INTEGER, DATE) TO authenticated;
