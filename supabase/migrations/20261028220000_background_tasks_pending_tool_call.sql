begin;

alter table public.background_tasks
  add column if not exists pending_tool_call jsonb;

alter table public.background_tasks
  drop constraint if exists background_tasks_status_check;

alter table public.background_tasks
  add constraint background_tasks_status_check
  check (status in ('running','completed','failed','cancelled','waiting_confirmation'));

commit;
