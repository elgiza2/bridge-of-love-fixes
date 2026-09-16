DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname IN (
        'add_credits','grant_user_credits','deduct_credits','spend_credits_auto',
        'spend_user_credits','workspace_deduct_credits','admin_add_api_key',
        'admin_grant_pro_monthly','block_v0_key','get_integration_secret',
        'acquire_media_key','mark_media_key_exhausted','pick_api_key','pick_v0_key',
        'record_api_key_usage','verify_external_api_key','grant_referral_milestone',
        'notify_admin_new_signup','notify_user_milestone'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;

  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname IN ('consume_video_quota','get_user_subscription_status')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;