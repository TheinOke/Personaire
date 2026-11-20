-- =============================================================================
-- Personaire — Weekly / monthly reviews
-- =============================================================================

create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  period_type   text not null check (period_type in ('week', 'month')),
  period_start  date not null,
  rating        smallint check (rating between 1 and 5),
  wins          text,
  challenges    text,
  lessons       text,
  next_focus    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, period_type, period_start)
);

create index if not exists reviews_user_period on public.reviews (user_id, period_type, period_start desc);

drop trigger if exists set_updated_at on public.reviews;
create trigger set_updated_at before update on public.reviews for each row execute function public.set_updated_at();

alter table public.reviews enable row level security;
drop policy if exists "own reviews" on public.reviews;
create policy "own reviews" on public.reviews
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.reviews to authenticated, service_role;
revoke all on public.reviews from anon;

-- Review reminders: last day of the week / month at this time.
alter table public.settings
  add column if not exists review_reminders_enabled boolean not null default true,
  add column if not exists review_reminder_time     time    not null default '19:00';

alter table public.notification_log drop constraint if exists notification_log_kind_check;
alter table public.notification_log
  add constraint notification_log_kind_check
  check (kind in ('task_reminder', 'task_due', 'habit_reminder', 'daily_summary', 'timer_end', 'review_reminder'));

notify pgrst, 'reload schema';
