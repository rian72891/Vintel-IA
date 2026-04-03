
-- Fix 1: Restrict profiles UPDATE policy to prevent plan column changes
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND plan = (SELECT p.plan FROM public.profiles p WHERE p.id = auth.uid()));

-- Fix 2: Restrict usage_limits UPDATE policy to prevent plan column changes
DROP POLICY IF EXISTS "Users can update own usage" ON public.usage_limits;
CREATE POLICY "Users can update own usage" ON public.usage_limits
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND plan = (SELECT u.plan FROM public.usage_limits u WHERE u.id = usage_limits.id));
