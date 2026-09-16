-- Keep background task states explicit and distinguish paused confirmations
-- from successful completion. NOT VALID preserves any legacy rows with older values
-- while enforcing the allowed states for new writes and updates.
ALTER TABLE public.background_tasks
  DROP CONSTRAINT IF EXISTS background_tasks_status_check;

ALTER TABLE public.background_tasks
  ADD CONSTRAINT background_tasks_status_check
  CHECK (status IN ('running', 'completed', 'failed', 'cancelled', 'waiting_confirmation'))
  NOT VALID;
