-- =============================================================================
-- Personaire — Pomodoro timer + time tracking
-- =============================================================================

-- ---------- Pomodoro preferences --------------------------------------------
alter table public.settings
  add column if not exists pomodoro_focus_min       smallint not null default 25 check (pomodoro_focus_min between 1 and 180),
  add column if not exists pomodoro_short_break_min smallint not null default 5  check (pomodoro_short_break_min between 1 and 60),
  add column if not exists pomodoro_long_break_min  smallint not null default 15 check (pomodoro_long_break_min between 1 and 90),
  add column if not exists pomodoro_long_every      smallint not null default 4  check (pomodoro_long_every between 2 and 12),
  add column if not exists timer_sound              boolean  not null default true;

-- ---------- Time entries -----------------------------------------------------
-- One row per tracked period. A running timer has ended_at = null.
-- Pomodoro rows also have planned_end_at, so the server can notify and close
-- them even when the app is closed.
create table if not exists public.time_entries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind            text not null default 'focus' check (kind in ('focus', 'break')),
  source          text not null default 'stopwatch' check (source in ('pomodoro', 'stopwatch', 'manual')),
  task_id         uuid references public.tasks (id) on delete set null,
  goal_id         uuid references public.goals (id) on delete set null,
  category_id     uuid references public.categories (id) on delete set null,
  note            text,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  planned_end_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  check (planned_end_at is null or planned_end_at > started_at)
);

-- Only one running timer per user.
create unique index if not exists time_entries_one_running on public.time_entries (user_id) where ended_at is null;
create index if not exists time_entries_user_started on public.time_entries (user_id, started_at);
create index if not exists time_entries_task on public.time_entries (task_id);
create index if not exists time_entries_goal on public.time_entries (goal_id);
create index if not exists time_entries_category on public.time_entries (category_id);
create index if not exists time_entries_due on public.time_entries (planned_end_at) where ended_at is null;

drop trigger if exists set_updated_at on public.time_entries;
create trigger set_updated_at before update on public.time_entries for each row execute function public.set_updated_at();

alter table public.time_entries enable row level security;
drop policy if exists "own time entries" on public.time_entries;
create policy "own time entries" on public.time_entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.time_entries to authenticated;
grant select, insert, update, delete on public.time_entries to service_role;
revoke all on public.time_entries from anon;

-- ---------- "Session finished" push notifications ----------------------------
alter table public.notification_log drop constraint if exists notification_log_kind_check;
alter table public.notification_log
  add constraint notification_log_kind_check
  check (kind in ('task_reminder', 'task_due', 'habit_reminder', 'daily_summary', 'timer_end'));
