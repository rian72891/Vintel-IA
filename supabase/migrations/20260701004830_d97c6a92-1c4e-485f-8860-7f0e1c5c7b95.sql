
-- 1. shared_artifacts: revoke public/anon direct SELECT, keep owner-only SELECT via RLS,
--    expose a secure RPC for the share-link page.
DROP POLICY IF EXISTS "Anyone can view shared artifacts" ON public.shared_artifacts;

CREATE POLICY "Owners can view own shared artifacts"
  ON public.shared_artifacts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Tighten INSERT: require the row to be attributed to the caller (user_id NOT NULL for new rows)
DROP POLICY IF EXISTS "Users can create own shared artifacts" ON public.shared_artifacts;
CREATE POLICY "Users can create own shared artifacts"
  ON public.shared_artifacts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

-- Remove broad anon table grants; anon now must go through the RPC below.
REVOKE SELECT ON public.shared_artifacts FROM anon;

-- Security-definer function acting as capability lookup by UUID (id is the unguessable share token)
CREATE OR REPLACE FUNCTION public.get_shared_artifact(p_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  artifacts jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sa.id, sa.title, sa.artifacts, sa.created_at
  FROM public.shared_artifacts sa
  WHERE sa.id = p_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_artifact(uuid) TO anon, authenticated;

-- 2. user_connectors: split ALL/public policy into explicit per-command policies scoped to authenticated
DROP POLICY IF EXISTS "user sees own connectors" ON public.user_connectors;

CREATE POLICY "Users select own connectors"
  ON public.user_connectors
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own connectors"
  ON public.user_connectors
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own connectors"
  ON public.user_connectors
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own connectors"
  ON public.user_connectors
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
