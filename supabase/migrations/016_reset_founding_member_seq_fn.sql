-- Lets scripts/reset-all-data.ts reset the founding-member counter
-- (migration 015) back to zero as part of a full data wipe — without this,
-- repeated "wipe everything and test again" cycles during development
-- would keep the sequence climbing even though no real founding members
-- exist anymore. Restricted to service_role only: an ordinary broker has no
-- business resetting this, so it is deliberately NOT granted to
-- `authenticated`.
CREATE OR REPLACE FUNCTION reset_founding_member_seq()
RETURNS VOID AS $$
BEGIN
  PERFORM setval('founding_member_seq', 1, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION reset_founding_member_seq() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION reset_founding_member_seq() TO service_role;
