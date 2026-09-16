CREATE OR REPLACE FUNCTION public.store_provider_key(p_provider text, p_value text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF coalesce(btrim(p_value), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty');
  END IF;
  INSERT INTO public.provider_api_keys (provider, api_key, status)
  VALUES (btrim(p_provider), btrim(p_value), 'active');
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.store_provider_key(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.store_provider_key(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.provider_key_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    jsonb_object_agg(provider || '_' || CASE WHEN status = 'active' THEN 'active' ELSE 'blocked' END, n),
    '{}'::jsonb)
  FROM (
    SELECT provider, status, count(*) AS n
    FROM public.provider_api_keys
    GROUP BY provider, status
  ) s;
$$;

REVOKE EXECUTE ON FUNCTION public.provider_key_counts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.provider_key_counts() TO authenticated, service_role;