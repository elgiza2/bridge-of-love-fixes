CREATE TABLE IF NOT EXISTS public.billing_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier text NOT NULL,
  interval text NOT NULL,
  base_interval text NOT NULL,
  usd_price numeric NOT NULL,
  egp_price numeric,
  credits integer NOT NULL DEFAULT 0,
  dodo_product_id text,
  kashier_sku text,
  trial_days integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tier, interval)
);

GRANT SELECT ON public.billing_catalog TO anon;
GRANT SELECT ON public.billing_catalog TO authenticated;
GRANT ALL ON public.billing_catalog TO service_role;

ALTER TABLE public.billing_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_catalog_public_read" ON public.billing_catalog;
CREATE POLICY "billing_catalog_public_read"
ON public.billing_catalog FOR SELECT
TO anon, authenticated
USING (active = true);

DROP POLICY IF EXISTS "billing_catalog_admin_all" ON public.billing_catalog;
CREATE POLICY "billing_catalog_admin_all"
ON public.billing_catalog FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER billing_catalog_updated_at
BEFORE UPDATE ON public.billing_catalog
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.billing_catalog
  (tier, interval, base_interval, usd_price, egp_price, credits, dodo_product_id, kashier_sku, trial_days, sort)
VALUES
  ('pro','monthly','monthly',20,999,240,'pdt_0NmMJe9VjECKDbnwNB3FF','plan_pro_m',0,10),
  ('pro','monthly_intro','monthly',7,349,240,'pdt_0NmMJpl33HrzioYp8eQKp','plan_pro_m_first',0,11),
  ('pro','monthly_winback','monthly',5,249,240,'pdt_0NmMJzzgEol6PgmKsTeRL','plan_pro_m_winback',0,12),
  ('pro','monthly_trial','monthly',1,49,240,NULL,'plan_pro_m_trial',3,13),
  ('pro','yearly','yearly',160,7999,3600,'pdt_0NmMKEL4olXitfxpF146K','plan_pro_y',0,14),
  ('pro','yearly_winback','yearly',149,7499,3600,'pdt_0NmMKJmTn3jLB4fIAfyP2','plan_pro_y_winback',0,15),
  ('elite','monthly','monthly',40,1999,600,NULL,'plan_elite_m',0,20),
  ('elite','monthly_intro','monthly',17,849,600,NULL,'plan_elite_m_first',0,21),
  ('elite','monthly_winback','monthly',12,599,600,NULL,'plan_elite_m_winback',0,22),
  ('elite','yearly','yearly',320,15999,9000,NULL,'plan_elite_y',0,23),
  ('elite','yearly_winback','yearly',299,14999,9000,NULL,'plan_elite_y_winback',0,24)
ON CONFLICT (tier, interval) DO NOTHING;