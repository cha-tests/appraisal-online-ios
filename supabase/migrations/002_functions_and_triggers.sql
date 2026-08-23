-- ============================================================================
-- Functions for business logic
-- ============================================================================

-- Function to check if a city has reached founder cap (30)
CREATE OR REPLACE FUNCTION check_founder_capacity(city_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT founder_count_lifetime FROM cities WHERE id = city_id_param
  ) < 30;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get founder number for a broker in a city
CREATE OR REPLACE FUNCTION get_founder_number(broker_id_param UUID, city_id_param UUID)
RETURNS BIGINT AS $$
DECLARE
  next_number BIGINT;
BEGIN
  SELECT COALESCE(MAX(founder_number), 0) + 1
  INTO next_number
  FROM broker_profiles
  WHERE user_id = broker_id_param
    AND selected_cities @> ARRAY[city_id_param];

  RETURN next_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate refund eligibility window
CREATE OR REPLACE FUNCTION calculate_refund_eligible_until(
  tier_param TEXT,
  subscription_started_at TIMESTAMP WITH TIME ZONE
)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
  CASE tier_param
    WHEN 'Founder Lifetime' THEN
      RETURN subscription_started_at + INTERVAL '14 days';
    WHEN 'Premium Annual' THEN
      RETURN subscription_started_at + INTERVAL '30 days';
    WHEN 'Basic Annual' THEN
      RETURN subscription_started_at + INTERVAL '30 days';
    ELSE
      RETURN subscription_started_at;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if broker can request refund
CREATE OR REPLACE FUNCTION can_request_refund(broker_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE broker_id = broker_id_param
      AND status = 'active'
      AND refund_eligible_until > now()
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get monthly free report allowance (3 per month)
CREATE OR REPLACE FUNCTION get_report_allowance(user_id_param UUID, report_month DATE)
RETURNS RECORD AS $$
DECLARE
  result RECORD;
BEGIN
  SELECT reports_used, (3 - COALESCE(reports_used, 0)) as remaining
  INTO result
  FROM report_allowance
  WHERE user_id = user_id_param AND month = report_month;

  IF NOT FOUND THEN
    RETURN ROW(0, 3)::RECORD;
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to increment report usage
CREATE OR REPLACE FUNCTION increment_report_usage(user_id_param UUID, report_month DATE)
RETURNS INTEGER AS $$
DECLARE
  current_usage INTEGER;
BEGIN
  INSERT INTO report_allowance (user_id, month, reports_used)
  VALUES (user_id_param, report_month, 1)
  ON CONFLICT (user_id) DO UPDATE
  SET reports_used = report_allowance.reports_used + 1,
      updated_at = now()
  RETURNING reports_used INTO current_usage;

  RETURN current_usage;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Update updated_at on users table
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_users_updated_at();

-- Update updated_at on broker_profiles table
CREATE OR REPLACE FUNCTION update_broker_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS broker_profiles_updated_at ON broker_profiles;
CREATE TRIGGER broker_profiles_updated_at BEFORE UPDATE ON broker_profiles
FOR EACH ROW EXECUTE FUNCTION update_broker_profiles_updated_at();

-- Increment city founder count when a broker is created with Lifetime tier
CREATE OR REPLACE FUNCTION increment_city_founder_count()
RETURNS TRIGGER AS $$
DECLARE
  city_id UUID;
BEGIN
  IF NEW.tier = 'Founder Lifetime' AND NEW.selected_cities IS NOT NULL THEN
    FOREACH city_id IN ARRAY NEW.selected_cities LOOP
      UPDATE cities
      SET founder_count_lifetime = founder_count_lifetime + 1,
          updated_at = now()
      WHERE id = city_id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS broker_profile_founder_count ON broker_profiles;
CREATE TRIGGER broker_profile_founder_count AFTER INSERT ON broker_profiles
FOR EACH ROW EXECUTE FUNCTION increment_city_founder_count();

-- Decrement city founder count when a broker profile is deleted
CREATE OR REPLACE FUNCTION decrement_city_founder_count()
RETURNS TRIGGER AS $$
DECLARE
  city_id UUID;
BEGIN
  IF OLD.tier = 'Founder Lifetime' AND OLD.selected_cities IS NOT NULL THEN
    FOREACH city_id IN ARRAY OLD.selected_cities LOOP
      UPDATE cities
      SET founder_count_lifetime = GREATEST(0, founder_count_lifetime - 1),
          updated_at = now()
      WHERE id = city_id;
    END LOOP;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS broker_profile_founder_count_delete ON broker_profiles;
CREATE TRIGGER broker_profile_founder_count_delete BEFORE DELETE ON broker_profiles
FOR EACH ROW EXECUTE FUNCTION decrement_city_founder_count();

-- Automatically set refund_eligible_until on subscription creation
CREATE OR REPLACE FUNCTION set_refund_eligible_until()
RETURNS TRIGGER AS $$
BEGIN
  NEW.refund_eligible_until = calculate_refund_eligible_until(NEW.tier, NEW.started_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscription_refund_window ON subscriptions;
CREATE TRIGGER subscription_refund_window BEFORE INSERT ON subscriptions
FOR EACH ROW EXECUTE FUNCTION set_refund_eligible_until();

-- Update updated_at on subscriptions
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION update_subscriptions_updated_at();

-- Validate report is within 3 per month limit (warning: use service layer for enforcement)
CREATE OR REPLACE FUNCTION validate_report_limit()
RETURNS TRIGGER AS $$
DECLARE
  report_count INTEGER;
  month_start DATE;
BEGIN
  month_start := DATE_TRUNC('month', NOW())::DATE;

  SELECT COUNT(*) INTO report_count
  FROM reports
  WHERE user_id = NEW.user_id
    AND created_at >= month_start
    AND created_at < month_start + INTERVAL '1 month'
    AND status != 'deleted';

  IF report_count >= 3 THEN
    RAISE EXCEPTION 'Monthly report limit (3) exceeded';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger is NOT applied by default because we want the app layer
-- to handle this validation. Uncomment if you want DB-level enforcement:
-- CREATE TRIGGER report_limit_check BEFORE INSERT ON reports
-- FOR EACH ROW EXECUTE FUNCTION validate_report_limit();

-- ============================================================================
-- Realtime subscriptions
-- ============================================================================
-- Note: Realtime tables are configured via Supabase dashboard
-- to avoid duplicate publication errors
