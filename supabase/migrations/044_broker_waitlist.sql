-- Broker web waitlist: a lightweight email capture for the broker landing
-- page (web/partners.html) ahead of the actual web broker signup/checkout
-- flow being ready. No programmatic sending in this pass — the admin
-- panel exports this as a CSV, uploaded by hand to Resend's own dashboard
-- for the actual campaign. So this is just storage + an open INSERT +
-- an admin-only SELECT, same shape as every other admin-gated table
-- (migration 024's is_admin pattern).

CREATE TABLE broker_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  -- Where the signup came from (e.g. 'partners_landing') — free text, not
  -- enumerated, since this is just an internal campaign-tracking hint, not
  -- something the app itself branches on.
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Case-insensitive dedupe: the same person re-submitting the form (a
-- double-click, or just trying again later) shouldn't produce duplicate
-- rows in the export. The landing page's own insert call is expected to
-- treat a unique-violation as "you're already on the list" rather than a
-- hard error.
CREATE UNIQUE INDEX broker_waitlist_email_unique ON broker_waitlist (lower(email));

ALTER TABLE broker_waitlist ENABLE ROW LEVEL SECURITY;

-- Open to anyone, signed in or not — this is a pre-signup marketing
-- capture, not an authenticated action.
CREATE POLICY "Anyone can join the broker waitlist" ON broker_waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Same admin-only read pattern as migration 024's KYC policies.
CREATE POLICY "Admins can view the broker waitlist" ON broker_waitlist
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );
