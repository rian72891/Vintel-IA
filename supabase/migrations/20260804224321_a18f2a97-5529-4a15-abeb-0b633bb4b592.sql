DROP POLICY IF EXISTS "Users can view own oauth tokens" ON public.oauth_tokens;
REVOKE SELECT ON public.oauth_tokens FROM authenticated;
GRANT ALL ON public.oauth_tokens TO service_role;