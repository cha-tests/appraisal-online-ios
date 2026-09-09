-- Founding-member rate lock for the ₱5,000/year "Premium Annual" plan (Sep 1
-- sync-up decision: the first 1,000 paid members keep this rate for life,
-- even if pricing changes for everyone who joins after them).
--
-- This only records who's locked in and at what rate — it does not depend
-- on real payment processing (Stripe is still on placeholder keys). Once
-- real billing exists, whatever charges a founding member should read
-- founding_member_locked_price rather than a current list price.

ALTER TABLE broker_profiles
  ADD COLUMN is_founding_member BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN founding_member_number INTEGER,
  -- Minor units (centavos), matching the existing subscriptions.price
  -- convention — 500000 = ₱5,000.
  ADD COLUMN founding_member_locked_price INTEGER;

CREATE UNIQUE INDEX idx_broker_profiles_founding_member_number
  ON broker_profiles(founding_member_number)
  WHERE founding_member_number IS NOT NULL;

-- Backs the numbering itself — a sequence guarantees each caller gets a
-- distinct, gapless-under-concurrency number, unlike the existing
-- "SELECT MAX(...)+1" pattern (get_founder_number in migration 002), which
-- is fine for that function's low-traffic per-city cap of 30 but would be
-- a real race risk at platform-wide scale for the first 1,000 signups.
CREATE SEQUENCE IF NOT EXISTS founding_member_seq START 1;

-- Claims the next founding-member slot for a broker, if any remain.
-- Idempotent: calling it again for a broker who already has a number just
-- returns that number rather than consuming a new one (safe to retry).
-- Returns NULL once all 1,000 slots are taken — the caller still gets to
-- sign up, just without the lock.
CREATE OR REPLACE FUNCTION claim_founding_member_slot(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_existing INTEGER;
  v_number INTEGER;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Can only claim a founding member slot for yourself';
  END IF;

  SELECT founding_member_number INTO v_existing
  FROM broker_profiles WHERE user_id = p_user_id;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  v_number := nextval('founding_member_seq');

  IF v_number <= 1000 THEN
    UPDATE broker_profiles
    SET is_founding_member = TRUE,
        founding_member_number = v_number,
        founding_member_locked_price = 500000
    WHERE user_id = p_user_id;
    RETURN v_number;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION claim_founding_member_slot(UUID) TO authenticated;
