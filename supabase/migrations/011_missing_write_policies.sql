-- Same bug class as 008/009/010, found systematically rather than one at a
-- time: 001_initial_schema.sql enabled RLS on nearly every table with mostly
-- SELECT-only policies, so several other legitimate self-service write paths
-- have been silently blocked since the very first migration. Found by
-- grepping every .insert(/.update(/.rpc( call across the mobile app's
-- services and cross-checking each against the live policy list.
--
-- Confirmed live (screenshot from the app): incrementReportUsage's RPC call
-- failed with 42501 on report_allowance — that function is plain
-- LANGUAGE plpgsql (SECURITY INVOKER by default), so it is fully subject to
-- report_allowance's RLS, same as a direct client write would be.

-- Broker signup itself was broken: brokerService.createProfile() runs during
-- onboarding (app/broker/onboarding.tsx) and inserts into broker_profiles,
-- which had only SELECT + UPDATE policies, no INSERT.
CREATE POLICY "Brokers can create own profile" ON broker_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Backs increment_report_usage() (the function itself is not SECURITY
-- DEFINER, so it needs these to run at all) and generally lets a consumer
-- read/write their own monthly usage row.
CREATE POLICY "Users can create own allowance" ON report_allowance
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own allowance" ON report_allowance
  FOR UPDATE USING (auth.uid() = user_id);

-- Backs updateBrokerOptIn (the step that leads into createLeadFromReport) and
-- generatePDF's pdf_url update — both consumer-driven updates to their own report.
CREATE POLICY "Consumers can update own reports" ON reports
  FOR UPDATE USING (auth.uid() = user_id);

-- Backs lead-detail.tsx's status update (new/contacted/converted/archived).
-- Mirrors the SELECT policy fixed in 010 — same EXISTS shape, explicitly
-- qualified from the start this time.
CREATE POLICY "Brokers can update assigned leads" ON leads
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM lead_routings
      WHERE lead_routings.lead_id = leads.id
        AND lead_routings.broker_id = auth.uid()
    )
  );

-- Backs subscriptionService.createSubscription (the Stripe checkout
-- confirmation step) and cancelSubscription. Without the INSERT policy,
-- completing a real Stripe payment would appear to succeed on Stripe's side
-- and then fail to ever create the subscription record.
CREATE POLICY "Brokers can create own subscription" ON subscriptions
  FOR INSERT WITH CHECK (auth.uid() = broker_id);
CREATE POLICY "Brokers can update own subscription" ON subscriptions
  FOR UPDATE USING (auth.uid() = broker_id);

-- refund_log had RLS enabled with zero policies of any kind — not even
-- SELECT — so requestRefund and getRefundHistory were both fully blocked.
CREATE POLICY "Brokers can view own refunds" ON refund_log
  FOR SELECT USING (auth.uid() = broker_id);
CREATE POLICY "Brokers can create own refund requests" ON refund_log
  FOR INSERT WITH CHECK (auth.uid() = broker_id);

-- Not fixed here, flagged for a separate decision: marketing_allocations was
-- never given ENABLE ROW LEVEL SECURITY at all in 001_initial_schema.sql, so
-- it is currently open to whatever the project's default grants allow —
-- unlike the tables above, nothing is failing there, so this is a follow-up
-- to explicitly decide the right read policy for rather than a "things are
-- broken" bug.
