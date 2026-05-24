
-- 1) shared_artifacts: add ownership
ALTER TABLE public.shared_artifacts ADD COLUMN IF NOT EXISTS user_id uuid;

DROP POLICY IF EXISTS "Authenticated users can create shared artifacts" ON public.shared_artifacts;
CREATE POLICY "Users can create own shared artifacts"
ON public.shared_artifacts
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shared artifacts"
ON public.shared_artifacts
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 2) oauth_tokens: restrict insert/update to owner
CREATE POLICY "Users can insert own oauth tokens"
ON public.oauth_tokens
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own oauth tokens"
ON public.oauth_tokens
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3) usage_limits: remove client INSERT, add unique constraint
DROP POLICY IF EXISTS "Users can insert own usage" ON public.usage_limits;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usage_limits_user_id_unique'
  ) THEN
    ALTER TABLE public.usage_limits
      ADD CONSTRAINT usage_limits_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- 4) Lock down SECURITY DEFINER function from public execution
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
