CREATE TABLE public.scheduled_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  prompt text NOT NULL,
  agent text,
  hour_utc smallint NOT NULL DEFAULT 9 CHECK (hour_utc BETWEEN 0 AND 23),
  frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekly')),
  weekday smallint CHECK (weekday BETWEEN 0 AND 6),
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_tasks TO authenticated;
GRANT ALL ON public.scheduled_tasks TO service_role;

ALTER TABLE public.scheduled_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scheduled tasks" ON public.scheduled_tasks
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_scheduled_tasks_updated_at BEFORE UPDATE ON public.scheduled_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_scheduled_tasks_due ON public.scheduled_tasks (enabled, hour_utc);

CREATE TABLE public.conversation_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  name text NOT NULL,
  mime_type text,
  size_bytes integer,
  storage_path text,
  extracted_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_documents TO authenticated;
GRANT ALL ON public.conversation_documents TO service_role;

ALTER TABLE public.conversation_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own conversation documents" ON public.conversation_documents
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_conversation_documents_updated_at BEFORE UPDATE ON public.conversation_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_conversation_documents_conv ON public.conversation_documents (conversation_id);