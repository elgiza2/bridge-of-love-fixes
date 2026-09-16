UPDATE public.billing_catalog SET credits = 24 WHERE tier = 'pro' AND interval = 'monthly_trial';

CREATE OR REPLACE FUNCTION public.fulfill_kashier_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  subscription_id uuid;
  trial_days integer := 0;
  period_days integer := 30;
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    BEGIN
      trial_days := COALESCE((NEW.raw ->> 'trial_days')::integer, 0);
    EXCEPTION WHEN others THEN
      trial_days := 0;
    END;

    IF COALESCE(NEW.raw ->> 'interval', 'monthly') = 'yearly' THEN
      period_days := 365;
    END IF;
    IF trial_days > 0 THEN
      period_days := trial_days;
    END IF;

    IF NEW.credits > 0 THEN
      PERFORM public.add_credits(
        NEW.user_id,
        NEW.credits,
        'kashier:payment:' || NEW.order_id
      );
    END IF;

    IF NEW.plan IS NOT NULL AND btrim(NEW.plan) <> '' THEN
      UPDATE public.profiles
      SET plan = NEW.plan, updated_at = now()
      WHERE id = NEW.user_id;

      SELECT id INTO subscription_id
      FROM public.subscriptions
      WHERE user_id = NEW.user_id
      ORDER BY updated_at DESC
      LIMIT 1;

      IF subscription_id IS NULL THEN
        INSERT INTO public.subscriptions (
          user_id, plan, status, currency, amount_cents, current_period_end, updated_at
        ) VALUES (
          NEW.user_id, NEW.plan, 'active', NEW.currency,
          round(NEW.amount * 100)::integer,
          now() + (period_days || ' days')::interval,
          now()
        );
      ELSE
        UPDATE public.subscriptions
        SET plan = NEW.plan,
            status = 'active',
            currency = NEW.currency,
            amount_cents = round(NEW.amount * 100)::integer,
            current_period_end = now() + (period_days || ' days')::interval,
            updated_at = now()
        WHERE id = subscription_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;