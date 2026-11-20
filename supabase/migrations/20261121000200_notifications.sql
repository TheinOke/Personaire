-- =============================================================================
-- Personaire — push notifications (M09)
-- Run in Supabase SQL Editor AFTER running supabase/secrets.local.sql
-- (which stores the project URL and cron secret in Vault).
-- =============================================================================

-- ---------- Daily summary preferences ---------------------------------------
alter table public.settings
  add column if not exists daily_summary_enabled boolean not null default true,
  add column if not exists daily_summary_time    time    not null default '08:00';

-- ---------- Allow the daily summary in the notification log -----------------
alter table public.notification_log drop constraint if exists notification_log_kind_check;
alter table public.notification_log
  add constraint notification_log_kind_check
  check (kind in ('task_reminder', 'task_due', 'habit_reminder', 'daily_summary'));

-- ---------- Scheduler: call the Edge Function every minute -------------------
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net  with schema extensions;

-- Replace the job if this file is run again.
select cron.unschedule(jobid) from cron.job where jobname = 'personaire-send-reminders';

select cron.schedule(
  'personaire-send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'personaire_project_url')
               || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'personaire_cron_secret')
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);

-- Keep the scheduler's own history tables small.
select cron.unschedule(jobid) from cron.job where jobname = 'personaire-cleanup';
select cron.schedule(
  'personaire-cleanup',
  '17 3 * * *',
  $$
  delete from cron.job_run_details where end_time < now() - interval '3 days';
  delete from public.notification_log where sent_at < now() - interval '60 days';
  $$
);
