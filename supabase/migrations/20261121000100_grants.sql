-- =============================================================================
-- Personaire — table privileges for signed-in users
-- New Supabase projects don't grant the Data API roles access to new tables
-- automatically. Grant access to `authenticated` only (never `anon`).
-- RLS policies from the init migration still restrict every row to its owner.
-- =============================================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.settings,
  public.categories,
  public.goals,
  public.tasks,
  public.planner_blocks,
  public.habits,
  public.habit_logs,
  public.push_subscriptions
to authenticated;

-- Written only by the server (service role); the user may read it.
grant select on public.notification_log to authenticated;

-- Progress view (M07)
grant select on public.goal_progress to authenticated;

-- Make sure the public (signed-out) role has nothing.
revoke all on
  public.settings,
  public.categories,
  public.goals,
  public.tasks,
  public.planner_blocks,
  public.habits,
  public.habit_logs,
  public.push_subscriptions,
  public.notification_log,
  public.goal_progress
from anon;
