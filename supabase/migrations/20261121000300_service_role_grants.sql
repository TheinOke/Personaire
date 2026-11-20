-- =============================================================================
-- Personaire — table privileges for the server (service_role)
-- The send-reminders Edge Function uses the service_role key. New Supabase
-- projects don't grant it access to new tables automatically.
-- service_role bypasses RLS and is only ever used server-side.
-- =============================================================================

grant usage on schema public to service_role;

grant select, insert, update, delete on
  public.settings,
  public.categories,
  public.goals,
  public.tasks,
  public.planner_blocks,
  public.habits,
  public.habit_logs,
  public.push_subscriptions,
  public.notification_log
to service_role;

grant select on public.goal_progress to service_role;
