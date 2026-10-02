ALTER TABLE public.background_tasks ADD COLUMN IF NOT EXISTS pending_tool_call jsonb;
ALTER TABLE public.background_tasks DROP CONSTRAINT IF EXISTS background_tasks_status_check;
ALTER TABLE public.background_tasks ADD CONSTRAINT background_tasks_status_check CHECK (status IN ('running','completed','failed','cancelled','waiting_confirmation'));