CREATE TABLE public.github_agent_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  action TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.github_agent_runs TO authenticated;
GRANT ALL ON public.github_agent_runs TO service_role;
ALTER TABLE public.github_agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own github runs" ON public.github_agent_runs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_github_agent_runs_user_created ON public.github_agent_runs (user_id, created_at DESC);