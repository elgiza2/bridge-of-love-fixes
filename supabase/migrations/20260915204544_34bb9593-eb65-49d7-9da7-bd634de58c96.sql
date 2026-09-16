CREATE TABLE IF NOT EXISTS public.daily_credit_grants (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grant_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, grant_date)
);

GRANT SELECT ON public.daily_credit_grants TO authenticated;
GRANT ALL ON public.daily_credit_grants TO service_role;

ALTER TABLE public.daily_credit_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own daily grants" ON public.daily_credit_grants;
CREATE POLICY "Users read own daily grants"
  ON public.daily_credit_grants FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.daily_credit_allowance(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN public.has_paid_plan(_user_id) THEN 300 ELSE 30 END;
$$;

CREATE OR REPLACE FUNCTION public.claim_daily_credits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_allowance integer;
  v_balance numeric;
  v_granted numeric := 0;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  v_allowance := public.daily_credit_allowance(v_user);

  -- One top-up per calendar day; a second call the same day is a no-op.
  INSERT INTO public.daily_credit_grants (user_id, grant_date, amount)
  VALUES (v_user, CURRENT_DATE, 0)
  ON CONFLICT (user_id, grant_date) DO NOTHING;

  SELECT amount INTO v_granted
  FROM public.daily_credit_grants
  WHERE user_id = v_user AND grant_date = CURRENT_DATE
  FOR UPDATE;

  IF v_granted > 0 THEN
    SELECT credits INTO v_balance FROM public.profiles WHERE id = v_user;
    RETURN jsonb_build_object('success', true, 'granted', 0, 'credits', coalesce(v_balance, 0),
                              'allowance', v_allowance, 'already_claimed', true);
  END IF;

  SELECT credits INTO v_balance FROM public.profiles WHERE id = v_user FOR UPDATE;
  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- The daily allowance is a floor, not an addition: a bigger balance is kept.
  IF v_balance < v_allowance THEN
    v_granted := v_allowance - v_balance;
    UPDATE public.profiles
       SET credits = v_allowance, updated_at = now()
     WHERE id = v_user;
    v_balance := v_allowance;

    INSERT INTO public.credit_transactions (user_id, amount, action_type, description)
    VALUES (v_user, -v_granted, 'daily_refresh', 'Daily credit refresh');
  END IF;

  UPDATE public.daily_credit_grants
     SET amount = greatest(v_granted, 0.0001)
   WHERE user_id = v_user AND grant_date = CURRENT_DATE;

  RETURN jsonb_build_object('success', true, 'granted', v_granted, 'credits', v_balance,
                            'allowance', v_allowance, 'already_claimed', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_credit_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_plan text;
  v_balance numeric;
  v_allowance integer;
  v_granted numeric;
  v_spent_today numeric;
  v_tasks_today integer;
  v_spent_month numeric;
  v_free_today jsonb;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT credits, coalesce(plan, 'free') INTO v_balance, v_plan
  FROM public.profiles WHERE id = v_user;

  SELECT coalesce(s.plan, v_plan) INTO v_plan
  FROM public.subscriptions s
  WHERE s.user_id = v_user
    AND s.status IN ('active', 'trialing')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ORDER BY s.created_at DESC
  LIMIT 1;

  v_allowance := public.daily_credit_allowance(v_user);

  SELECT coalesce(amount, 0) INTO v_granted
  FROM public.daily_credit_grants
  WHERE user_id = v_user AND grant_date = CURRENT_DATE;

  SELECT coalesce(sum(amount), 0), count(*)
    INTO v_spent_today, v_tasks_today
  FROM public.credit_transactions
  WHERE user_id = v_user AND amount > 0 AND created_at >= date_trunc('day', now());

  SELECT coalesce(sum(amount), 0) INTO v_spent_month
  FROM public.credit_transactions
  WHERE user_id = v_user AND amount > 0 AND created_at >= date_trunc('month', now());

  SELECT coalesce(jsonb_object_agg(feature, usage_count), '{}'::jsonb) INTO v_free_today
  FROM public.daily_free_usage
  WHERE user_id = v_user AND usage_date = CURRENT_DATE;

  RETURN jsonb_build_object(
    'success', true,
    'credits', coalesce(v_balance, 0),
    'plan', coalesce(v_plan, 'free'),
    'daily_allowance', v_allowance,
    'claimed_today', coalesce(v_granted, 0) > 0,
    'granted_today', coalesce(v_granted, 0),
    'next_refresh', (date_trunc('day', now()) + interval '1 day'),
    'spent_today', v_spent_today,
    'tasks_today', v_tasks_today,
    'spent_this_month', v_spent_month,
    'free_today', v_free_today
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_daily_credits() FROM anon;
REVOKE ALL ON FUNCTION public.get_credit_overview() FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_credits() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_credit_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_credit_allowance(uuid) TO authenticated;