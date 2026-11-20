-- =============================================================================
-- Personaire — initial schema (Must-have features M01–M10)
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.
-- Every table is private to its owner via Row Level Security (RLS).
-- =============================================================================

-- ---------- helpers ----------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- M10 Personal Settings -------------------------------------------
create table public.settings (
  user_id                  uuid primary key references auth.users (id) on delete cascade,
  display_name             text,
  timezone                 text not null default 'UTC',
  time_format              text not null default '24h' check (time_format in ('12h', '24h')),
  date_format              text not null default 'dd/MM/yyyy',
  week_start               smallint not null default 1 check (week_start in (0, 1)), -- 1 = Monday, 0 = Sunday
  default_reminder_minutes integer not null default 30 check (default_reminder_minutes >= 0),
  notifications_enabled    boolean not null default false,
  habit_reminders_enabled  boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ---------- M08 Category Management -----------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 50),
  icon        text not null default 'tag', -- lucide icon name
  sort_order  integer not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------- M02 Goal Management ---------------------------------------------
create table public.goals (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id      uuid references public.categories (id) on delete set null,
  title            text not null check (char_length(title) between 1 and 200),
  description      text,
  status           text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  priority         text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  start_date       date,
  target_date      date,
  -- 'tasks' = progress calculated from the goal's tasks; 'manual' = set by hand
  progress_mode    text not null default 'tasks' check (progress_mode in ('tasks', 'manual')),
  manual_progress  smallint not null default 0 check (manual_progress between 0 and 100),
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------- M03 Task Management + M04 Task Breakdown -------------------------
create table public.tasks (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id            uuid references public.goals (id) on delete cascade,
  parent_task_id     uuid references public.tasks (id) on delete cascade, -- subtasks
  category_id        uuid references public.categories (id) on delete set null,
  title              text not null check (char_length(title) between 1 and 300),
  notes              text,
  status             text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority           text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date           date,
  due_time           time,
  scheduled_date     date,           -- the day you plan to work on it
  estimated_minutes  integer check (estimated_minutes > 0),
  reminder_at        timestamptz,    -- when to send a push reminder (M09)
  sort_order         integer not null default 0,
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (parent_task_id is null or parent_task_id <> id)
);

-- ---------- M05 Daily Planner ------------------------------------------------
create table public.planner_blocks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  block_date   date not null,
  start_time   time not null,
  end_time     time not null,
  title        text not null check (char_length(title) between 1 and 200),
  notes        text,
  task_id      uuid references public.tasks (id) on delete set null,
  category_id  uuid references public.categories (id) on delete set null,
  done         boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (end_time > start_time)
);

-- ---------- M06 Habit Tracker ------------------------------------------------
create table public.habits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id    uuid references public.categories (id) on delete set null,
  name           text not null check (char_length(name) between 1 and 100),
  description    text,
  -- ISO weekdays the habit is due on: 1 = Monday … 7 = Sunday
  days_of_week   smallint[] not null default '{1,2,3,4,5,6,7}'
                 check (days_of_week <@ '{1,2,3,4,5,6,7}'::smallint[] and cardinality(days_of_week) > 0),
  reminder_time  time,
  start_date     date not null default current_date,
  archived       boolean not null default false,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One row = the habit was completed on that day.
create table public.habit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id    uuid not null references public.habits (id) on delete cascade,
  log_date    date not null,
  note        text,
  created_at  timestamptz not null default now(),
  unique (habit_id, log_date)
);

-- ---------- M09 Basic Notifications -----------------------------------------
create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

-- Prevents sending the same reminder twice. Written by the server only.
create table public.notification_log (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  kind           text not null check (kind in ('task_reminder', 'task_due', 'habit_reminder')),
  ref_id         uuid not null,
  scheduled_for  timestamptz not null,
  sent_at        timestamptz not null default now(),
  unique (kind, ref_id, scheduled_for)
);

-- ---------- indexes ----------------------------------------------------------
create index on public.categories (user_id, sort_order);
create index on public.goals (user_id, status);
create index on public.goals (category_id);
create index on public.tasks (user_id, status);
create index on public.tasks (user_id, due_date);
create index on public.tasks (user_id, scheduled_date);
create index on public.tasks (goal_id);
create index on public.tasks (parent_task_id);
create index on public.tasks (category_id);
create index on public.tasks (reminder_at) where reminder_at is not null and status <> 'done';
create index on public.planner_blocks (user_id, block_date);
create index on public.planner_blocks (task_id);
create index on public.habits (user_id) where not archived;
create index on public.habit_logs (user_id, log_date);
create index on public.push_subscriptions (user_id);
create index on public.notification_log (user_id);

-- ---------- updated_at triggers ---------------------------------------------
create trigger set_updated_at before update on public.settings       for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.categories     for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.goals          for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tasks          for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.planner_blocks for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.habits         for each row execute function public.set_updated_at();

-- Keep completed_at in sync with status.
create or replace function public.sync_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('done', 'completed') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.completed_at = coalesce(new.completed_at, now());
  elsif new.status not in ('done', 'completed') then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

create trigger sync_completed_at before insert or update of status on public.tasks for each row execute function public.sync_completed_at();
create trigger sync_completed_at before insert or update of status on public.goals for each row execute function public.sync_completed_at();

-- ---------- Row Level Security ----------------------------------------------
alter table public.settings           enable row level security;
alter table public.categories         enable row level security;
alter table public.goals              enable row level security;
alter table public.tasks              enable row level security;
alter table public.planner_blocks     enable row level security;
alter table public.habits             enable row level security;
alter table public.habit_logs         enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_log   enable row level security;

create policy "own settings"       on public.settings           for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own categories"     on public.categories         for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own goals"          on public.goals              for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own tasks"          on public.tasks              for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own planner"        on public.planner_blocks     for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own habits"         on public.habits             for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own habit logs"     on public.habit_logs         for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own subscriptions"  on public.push_subscriptions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- notification_log: read-only for the user; the server writes with the service role.
create policy "read own notification log" on public.notification_log for select to authenticated using (user_id = (select auth.uid()));

-- ---------- M07 Progress: goal progress view --------------------------------
-- security_invoker = true makes the view respect the caller's RLS.
create view public.goal_progress
with (security_invoker = true)
as
select
  g.id as goal_id,
  g.user_id,
  count(t.id)::int                                   as total_tasks,
  count(t.id) filter (where t.status = 'done')::int  as done_tasks,
  case
    when g.status = 'completed' then 100
    when g.progress_mode = 'manual' then g.manual_progress
    when count(t.id) = 0 then 0
    else round(100.0 * count(t.id) filter (where t.status = 'done') / count(t.id))::int
  end                                                as percent
from public.goals g
left join public.tasks t on t.goal_id = g.id
group by g.id;

-- ---------- New user: default settings + categories -------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.settings (user_id) values (new.id);
  insert into public.categories (user_id, name, icon, sort_order) values
    (new.id, 'Career',    'briefcase',      1),
    (new.id, 'Education', 'graduation-cap', 2),
    (new.id, 'Health',    'heart-pulse',    3),
    (new.id, 'Finance',   'wallet',         4),
    (new.id, 'Personal',  'user',           5);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
