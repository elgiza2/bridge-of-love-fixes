DROP POLICY IF EXISTS "Anyone can read published rows (non-prompt cols)" ON public.landing_page_prompts;
REVOKE SELECT ON public.landing_page_prompts FROM anon;

DROP POLICY IF EXISTS "Anyone can record a click" ON public.referral_clicks;
CREATE POLICY "Anyone can record a click" ON public.referral_clicks
  FOR INSERT TO anon, authenticated
  WITH CHECK (converted_user_id IS NULL);

DROP POLICY IF EXISTS "page_views close own row" ON public.page_views;
CREATE POLICY "page_views close own row" ON public.page_views
  FOR UPDATE TO anon, authenticated
  USING (started_at > (now() - interval '1 day') AND ended_at IS NULL)
  WITH CHECK (ended_at IS NOT NULL);