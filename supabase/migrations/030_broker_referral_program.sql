-- Item #8 from the synthetic user report: virtually no persona in either
-- the consumer or broker batches discovered the product through paid
-- marketing — discovery was peer-to-peer on both sides. This adds the
-- lightweight piece the report asks for on the broker side: a referral
-- code every broker can share, and attribution tracking for who referred
-- whom (no monetary incentive/reward wired up here — that's a pricing
-- decision, out of scope for this item).

ALTER TABLE broker_profiles
  ADD COLUMN referral_code TEXT UNIQUE,
  ADD COLUMN referred_by UUID REFERENCES users(id);

-- Sequence-based, not random-with-retry — matches this schema's existing
-- pattern for broker-facing numbers (founding_member_seq in migration 015)
-- over generating a random code and re-rolling on collision.
CREATE SEQUENCE IF NOT EXISTS broker_referral_code_seq START 1;

CREATE OR REPLACE FUNCTION set_broker_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := 'BRK-' || lpad(nextval('broker_referral_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS broker_profile_referral_code ON broker_profiles;
CREATE TRIGGER broker_profile_referral_code
  BEFORE INSERT ON broker_profiles
  FOR EACH ROW EXECUTE FUNCTION set_broker_referral_code();

-- Backfill for brokers who already exist — the trigger only covers new rows.
UPDATE broker_profiles
SET referral_code = 'BRK-' || lpad(nextval('broker_referral_code_seq')::text, 6, '0')
WHERE referral_code IS NULL;

-- Resolves a referral code to the referring broker's user_id at signup.
-- SECURITY DEFINER because a brand-new broker's own RLS session can only
-- read their own broker_profiles row — looking up someone else's by code
-- needs the same elevated-read pattern already used elsewhere in this
-- schema (route_lead_to_brokers, checkFounderCapacity). Returns NULL for
-- an unrecognized code rather than raising, so a typo just means no
-- attribution is recorded instead of blocking signup.
CREATE OR REPLACE FUNCTION resolve_referral_code(p_code TEXT)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM broker_profiles
  WHERE referral_code = upper(trim(p_code));
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION resolve_referral_code(TEXT) TO authenticated;
