-- Phase 4 (notifications) of the claim-based lead routing redesign.
--
-- Decided after discovering the backend's existing email-sending functions
-- (sendBrokerLeadNotification etc.) are never actually called for a real
-- routing event — CLAUDE.md's "notify every active broker in real time"
-- rule has no real implementation to extend. Push notifications don't
-- exist in this codebase at all (no token capture, no sending code) —
-- out of scope for this phase, email only (Postmark, already wired up).
--
-- There's no pg_net usage anywhere in this project and no Supabase Edge
-- Functions, so rather than take on an unconfirmed new extension
-- dependency, this queues notification-worthy events here in Postgres —
-- via triggers, so no code path that creates/changes a lead_routings row
-- can forget to queue one — and a new backend poller (plain setInterval
-- in the existing always-on Express server, same service-role access it
-- already has) drains the queue and sends via the existing emailService.
--
-- Each trigger pre-computes a ready-to-send payload at queue time (it has
-- full access to join everything needed right there), so the poller
-- itself stays simple: read a row, format, send, mark it done. No RLS
-- policies at all on this table on purpose — nothing client-side should
-- ever read or write it; only the service-role key (which bypasses RLS)
-- is meant to touch it.

CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'broker_invite',
    'broker_missed_lead',
    'broker_stop_contact',
    'consumer_check_in'
  )),
  recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  lead_routing_id UUID REFERENCES lead_routings(id) ON DELETE CASCADE,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  error TEXT
);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notification_queue_pending ON notification_queue(created_at) WHERE status = 'pending';

-- ============================================================================
-- 1. Invite notification — every new lead_routings row, whichever function
--    created it (route_lead_to_brokers, route_all_orphaned_leads,
--    route_orphaned_leads_to_broker, escalate_lead_routing). Payload is the
--    same masked fields the broker's own inbox shows pre-claim — never
--    PII, since they haven't claimed yet.
-- ============================================================================

CREATE OR REPLACE FUNCTION queue_broker_invite_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_payload JSONB;
BEGIN
  SELECT jsonb_build_object(
    'property_type', p.property_type,
    'condition', p.condition,
    'city_name', c.name,
    'city_state', c.state,
    'city_country', c.country,
    'estimated_value_low', (r.confidence_range->>'low')::BIGINT,
    'estimated_value_high', (r.confidence_range->>'high')::BIGINT,
    'lead_tags', l.lead_tags
  )
  INTO v_payload
  FROM leads l
  LEFT JOIN properties p ON p.id = l.property_id
  LEFT JOIN cities c ON c.id = l.city_id
  LEFT JOIN reports r ON r.id = l.report_id
  WHERE l.id = NEW.lead_id;

  INSERT INTO notification_queue (notification_type, recipient_user_id, lead_id, lead_routing_id, payload)
  VALUES ('broker_invite', NEW.broker_id, NEW.lead_id, NEW.id, v_payload);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER lead_routings_queue_invite
  AFTER INSERT ON lead_routings
  FOR EACH ROW EXECUTE FUNCTION queue_broker_invite_notification();

-- ============================================================================
-- 2. Missed-lead notification — fires the moment a claim fills the last
--    open slot, to every OTHER broker still invited-but-unclaimed on that
--    same lead. Fires at most once per claim event (guarded by the
--    OLD/NEW claim_status check), and only once the lead is actually full
--    (a claim that still leaves slots open queues nothing).
-- ============================================================================

CREATE OR REPLACE FUNCTION queue_missed_lead_notifications()
RETURNS TRIGGER AS $$
DECLARE
  v_requested INTEGER;
  v_claimed INTEGER;
  v_payload JSONB;
BEGIN
  IF NOT (NEW.claim_status = 'claimed' AND OLD.claim_status = 'invited') THEN
    RETURN NEW;
  END IF;

  SELECT r.requested_broker_count INTO v_requested
  FROM leads l JOIN reports r ON r.id = l.report_id WHERE l.id = NEW.lead_id;

  SELECT count(*) INTO v_claimed
  FROM lead_routings WHERE lead_id = NEW.lead_id AND claim_status = 'claimed';

  IF v_requested IS NULL OR v_claimed < v_requested THEN
    RETURN NEW;
  END IF;

  SELECT jsonb_build_object('property_type', p.property_type, 'city_name', c.name)
  INTO v_payload
  FROM leads l
  LEFT JOIN properties p ON p.id = l.property_id
  LEFT JOIN cities c ON c.id = l.city_id
  WHERE l.id = NEW.lead_id;

  INSERT INTO notification_queue (notification_type, recipient_user_id, lead_id, lead_routing_id, payload)
  SELECT 'broker_missed_lead', lr.broker_id, lr.lead_id, lr.id, v_payload
  FROM lead_routings lr
  WHERE lr.lead_id = NEW.lead_id AND lr.claim_status = 'invited';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER lead_routings_queue_missed
  AFTER UPDATE OF claim_status ON lead_routings
  FOR EACH ROW EXECUTE FUNCTION queue_missed_lead_notifications();

-- ============================================================================
-- 3. Stop-contact notification — fires only when an already-claimed row is
--    revoked (revoke_broker_contact deletes a pre-claim row outright
--    instead of marking it, so this trigger only ever sees the
--    "they already had contact info" case, which is exactly the one that
--    needs a notice — see migration 037's header comment on why this
--    can't force compliance, only document the request).
-- ============================================================================

CREATE OR REPLACE FUNCTION queue_stop_contact_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_payload JSONB;
BEGIN
  IF NOT (NEW.status = 'revoked' AND OLD.status != 'revoked') THEN
    RETURN NEW;
  END IF;

  SELECT jsonb_build_object('property_address', l.property_address)
  INTO v_payload
  FROM leads l WHERE l.id = NEW.lead_id;

  INSERT INTO notification_queue (notification_type, recipient_user_id, lead_id, lead_routing_id, payload)
  VALUES ('broker_stop_contact', NEW.broker_id, NEW.lead_id, NEW.id, v_payload);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER lead_routings_queue_stop_contact
  AFTER UPDATE OF status ON lead_routings
  FOR EACH ROW EXECUTE FUNCTION queue_stop_contact_notification();

-- ============================================================================
-- 4. Consumer check-in — the email/push equivalent of
--    consumer/settings.tsx's in-app check-in banner, same CHECK_IN_DAYS
--    (5) threshold. Queued at most once per lead ever (the NOT EXISTS
--    guard), matching the in-app version's one-time nature — no repeat
--    reminders every N days.
-- ============================================================================

CREATE OR REPLACE FUNCTION queue_consumer_check_ins()
RETURNS INTEGER AS $$
DECLARE
  v_queued INTEGER;
BEGIN
  INSERT INTO notification_queue (notification_type, recipient_user_id, lead_id, payload)
  SELECT
    'consumer_check_in',
    l.consumer_id,
    l.id,
    jsonb_build_object(
      'property_address', l.property_address,
      'days_waiting', EXTRACT(DAY FROM now() - min(lr.created_at))::INTEGER
    )
  FROM leads l
  JOIN reports r ON r.id = l.report_id
  JOIN lead_routings lr ON lr.lead_id = l.id
  WHERE r.broker_contact_opted_in = TRUE
  GROUP BY l.id, l.consumer_id, l.property_address
  HAVING
    bool_and(lr.claim_status = 'invited')
    AND min(lr.created_at) <= now() - INTERVAL '5 days'
    AND NOT EXISTS (
      SELECT 1 FROM notification_queue nq
      WHERE nq.lead_id = l.id AND nq.notification_type = 'consumer_check_in'
    );

  GET DIAGNOSTICS v_queued = ROW_COUNT;
  RETURN v_queued;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION queue_consumer_check_ins() TO authenticated;

-- Daily is plenty for a 5-day threshold — this isn't the 24h/48h
-- escalation timer, it doesn't need hourly granularity. Separate cron job
-- from escalate-lead-routings-hourly (migration 037) rather than folding
-- in here, so either can be paused/retimed independently.
DO $$
BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron could not be enabled (%). Enable it via Supabase Dashboard > Database > Extensions, then run: SELECT cron.schedule(''queue-consumer-check-ins-daily'', ''0 9 * * *'', ''SELECT queue_consumer_check_ins();'');', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('queue-consumer-check-ins-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'queue-consumer-check-ins-daily',
    '0 9 * * *',
    $cron$SELECT queue_consumer_check_ins();$cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule the pg_cron job (%). If pg_cron is not enabled on this Supabase plan, enable it via Dashboard > Database > Extensions, then run: SELECT cron.schedule(''queue-consumer-check-ins-daily'', ''0 9 * * *'', ''SELECT queue_consumer_check_ins();'');', SQLERRM;
END $$;
