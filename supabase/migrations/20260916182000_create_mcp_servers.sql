CREATE TABLE public.mcp_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  url text NOT NULL CHECK (length(trim(url)) BETWEEN 1 AND 2048),
  auth_token text,
  enabled boolean NOT NULL DEFAULT true,
  tools_cache jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;

-- Deliberately no SELECT policy: auth_token must never be readable by the browser.
-- All user-facing CRUD is mediated by the mcp-admin Edge Function using service_role.
GRANT INSERT, UPDATE, DELETE ON public.mcp_servers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_servers TO authenticated;
REVOKE SELECT ON public.mcp_servers FROM authenticated;

CREATE POLICY "Users insert own MCP servers"
  ON public.mcp_servers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own MCP servers"
  ON public.mcp_servers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own MCP servers"
  ON public.mcp_servers FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_mcp_servers_user_enabled ON public.mcp_servers(user_id, enabled);

CREATE OR REPLACE FUNCTION public.touch_mcp_servers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER mcp_servers_updated_at
BEFORE UPDATE ON public.mcp_servers
FOR EACH ROW EXECUTE FUNCTION public.touch_mcp_servers_updated_at();

GRANT ALL ON public.mcp_servers TO service_role;
