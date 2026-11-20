import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { format, parseISO } from 'date-fns'
import { Check, ChevronRight, Flame } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { StatTile } from '@/components/StatTile'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { addDaysISO, dayLabel, fromInstant, toMinutes, weekStartOf } from '@/lib/dates'
import { formatClock } from '@/lib/format'
import { goalProgress, useGoals } from '@/features/goals/useGoals'
import { targetLabel } from '@/features/goals/GoalCard'
import { currentStreak, isDueOn, logSet, useHabitLogs, useHabitMutations, useHabits } from '@/features/habits/useHabits'
import { useWeekBlocks } from '@/features/planner/usePlanner'
import { useSettings } from '@/features/settings/useSettings'
import { useTimezone, useToday } from '@/features/settings/useToday'
import { QuickAdd } from '@/features/tasks/QuickAdd'
import { TaskItem } from '@/features/tasks/TaskItem'
import { compareTasks, taskDay } from '@/features/tasks/meta'
import { useTaskDialog } from '@/features/tasks/useTaskDialog'
import { useTasks } from '@/features/tasks/useTasks'

function Panel({ title, to, linkLabel, children }: { title: string; to?: string; linkLabel?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        {to && (
          <Link to={to} className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            {linkLabel ?? 'View all'} <ChevronRight className="size-3" />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <Card className="border-dashed p-5 text-center text-sm text-muted-foreground">{children}</Card>
}

export function DashboardPage() {
  const { data: settings } = useSettings()
  const tz = useTimezone()
  const today = useToday()
  const tasksQ = useTasks()
  const goalsQ = useGoals()
  const habitsQ = useHabits()
  const logsQ = useHabitLogs()
  const blocksQ = useWeekBlocks(weekStartOf(today, settings?.week_start ?? 1))
  const { toggle } = useHabitMutations()
  const taskDialog = useTaskDialog()

  const tasks = tasksQ.data ?? []
  const goals = goalsQ.data ?? []
  const habits = habitsQ.data ?? []
  const done = logSet(logsQ.data)

  // Greeting by the user's local hour.
  const nowLocal = fromInstant(new Date().toISOString(), tz)
  const hour = Number(nowLocal.time.slice(0, 2))
  const nowMin = toMinutes(nowLocal.time)
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const name = settings?.display_name

  // Tasks
  const open = tasks.filter((t) => t.status !== 'done')
  const overdue = open.filter((t) => t.due_date && t.due_date < today)
  const todayOpen = open.filter((t) => !(t.due_date && t.due_date < today) && (taskDay(t) ?? '9999') <= today)
  const doneToday = tasks.filter((t) => t.status === 'done' && t.completed_at && fromInstant(t.completed_at, tz).day === today)
  const focus = [...overdue, ...todayOpen].sort(compareTasks)
  const todayTotal = todayOpen.length + overdue.length + doneToday.length

  // Habits
  const dueHabits = habits.filter((h) => !h.archived && isDueOn(h, today))
  const habitsDone = dueHabits.filter((h) => done.has(`${h.id}|${today}`)).length

  // Plan
  const todayBlocks = (blocksQ.data ?? []).filter((b) => b.block_date === today).sort((a, b) => a.start_time.localeCompare(b.start_time))
  const nextBlocks = todayBlocks.filter((b) => toMinutes(b.end_time) > nowMin && !b.done)
  const plannedMin = todayBlocks.reduce((s, b) => s + toMinutes(b.end_time) - toMinutes(b.start_time), 0)

  // Goals
  const activeGoals = goals
    .filter((g) => g.status === 'active')
    .map((g) => ({ g, p: goalProgress(g, tasks) }))
    .sort((a, b) => (a.g.target_date ?? '9999').localeCompare(b.g.target_date ?? '9999'))
  const avgGoal = activeGoals.length ? Math.round(activeGoals.reduce((s, x) => s + x.p.percent, 0) / activeGoals.length) : null

  // Upcoming deadlines (next 7 days)
  const weekAhead = addDaysISO(today, 7)
  const deadlines = [
    ...open
      .filter((t) => t.due_date && t.due_date > today && t.due_date <= weekAhead)
      .map((t) => ({ id: t.id, title: t.title, day: t.due_date!, kind: 'Task' as const, to: '/tasks' })),
    ...goals
      .filter((g) => g.status === 'active' && g.target_date && g.target_date >= today && g.target_date <= weekAhead)
      .map((g) => ({ id: g.id, title: g.title, day: g.target_date!, kind: 'Goal' as const, to: `/goals/${g.id}` })),
  ].sort((a, b) => a.day.localeCompare(b.day))

  const loading = tasksQ.isLoading || goalsQ.isLoading || habitsQ.isLoading || logsQ.isLoading
  const error = tasksQ.error ?? goalsQ.error ?? habitsQ.error ?? logsQ.error ?? blocksQ.error

  return (
    <>
      <PageHeader title={name ? `${greeting}, ${name}` : greeting} description={format(parseISO(today), 'EEEE, d MMMM yyyy')} />

      <QueryState isLoading={loading} error={error}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Tasks today"
            value={`${doneToday.length}/${todayTotal}`}
            sub={overdue.length ? `${overdue.length} overdue` : todayTotal ? 'done / planned' : 'Nothing planned'}
            to="/tasks"
          />
          <StatTile
            label="Habits today"
            value={dueHabits.length ? `${habitsDone}/${dueHabits.length}` : '—'}
            sub={dueHabits.length ? (habitsDone === dueHabits.length ? 'All done 👏' : 'done / due') : 'None due today'}
            to="/habits"
          />
          <StatTile
            label="Planned today"
            value={plannedMin ? `${Math.floor(plannedMin / 60)}h${plannedMin % 60 ? ` ${plannedMin % 60}m` : ''}` : '—'}
            sub={todayBlocks.length ? `${todayBlocks.filter((b) => b.done).length}/${todayBlocks.length} blocks done` : 'No time blocks'}
            to="/planner"
          />
          <StatTile
            label="Active goals"
            value={activeGoals.length}
            sub={avgGoal === null ? 'Set your first goal' : `avg ${avgGoal}% progress`}
            to="/goals"
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Panel title="Focus for today" to="/tasks">
              <div className="mb-3">
                <QuickAdd placeholder="Add a task for today…" defaults={{ scheduled_date: today }} />
              </div>
              {focus.length === 0 ? (
                <Empty>{doneToday.length ? 'Everything for today is done. 🎉' : 'Nothing planned for today.'}</Empty>
              ) : (
                <Card className="divide-y overflow-hidden">
                  {focus.slice(0, 7).map((t) => (
                    <TaskItem key={t.id} task={t} onEdit={taskDialog.edit} showParent />
                  ))}
                  {focus.length > 7 && (
                    <Link to="/tasks" className="block px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground">
                      + {focus.length - 7} more
                    </Link>
                  )}
                </Card>
              )}
            </Panel>

            <Panel title="Goals in progress" to="/goals">
              {activeGoals.length === 0 ? (
                <Empty>
                  No active goals. <Link to="/goals" className="underline">Create one</Link>
                </Empty>
              ) : (
                <Card className="divide-y">
                  {activeGoals.slice(0, 4).map(({ g, p }) => (
                    <Link key={g.id} to={`/goals/${g.id}`} className="block px-4 py-3 hover:bg-accent/40">
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium">{g.title}</span>
                        <span className="shrink-0 text-sm tabular-nums">{p.percent}%</span>
                      </div>
                      <Progress value={p.percent} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {g.progress_mode === 'tasks' ? `${p.done}/${p.total} tasks` : 'Manual'}
                        {g.target_date && ` · ${targetLabel(g.target_date, today)}`}
                      </p>
                    </Link>
                  ))}
                </Card>
              )}
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel title="Habits" to="/habits">
              {dueHabits.length === 0 ? (
                <Empty>No habits due today.</Empty>
              ) : (
                <Card className="divide-y">
                  {dueHabits.map((h) => {
                    const isDone = done.has(`${h.id}|${today}`)
                    const streak = currentStreak(h, done, today)
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => toggle.mutate({ habitId: h.id, day: today, done: !isDone })}
                        aria-pressed={isDone}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/40"
                      >
                        <span
                          className={cn(
                            'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                            isDone ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground',
                          )}
                        >
                          {isDone && <Check className="size-3.5" strokeWidth={3} />}
                        </span>
                        <span className={cn('min-w-0 flex-1 truncate text-sm', isDone && 'text-muted-foreground line-through')}>{h.name}</span>
                        {streak > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                            <Flame className="size-3" />
                            {streak}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </Card>
              )}
            </Panel>

            <Panel title="Up next" to="/planner" linkLabel="Planner">
              {nextBlocks.length === 0 ? (
                <Empty>{todayBlocks.length ? 'Your plan for today is done.' : 'No time blocks today.'}</Empty>
              ) : (
                <Card className="divide-y">
                  {nextBlocks.slice(0, 4).map((b) => {
                    const now = toMinutes(b.start_time) <= nowMin
                    return (
                      <Link key={b.id} to="/planner" className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40">
                        <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatClock(b.start_time, settings)}–{formatClock(b.end_time, settings)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm">{b.title}</span>
                        {now && <span className="rounded border px-1.5 py-0.5 text-[10px]">Now</span>}
                      </Link>
                    )
                  })}
                </Card>
              )}
            </Panel>

            <Panel title="Next 7 days">
              {deadlines.length === 0 ? (
                <Empty>No deadlines this week.</Empty>
              ) : (
                <Card className="divide-y">
                  {deadlines.slice(0, 6).map((d) => (
                    <Link key={`${d.kind}-${d.id}`} to={d.to} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40">
                      <span className="w-20 shrink-0 text-xs text-muted-foreground">{dayLabel(d.day, today, settings?.date_format)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{d.title}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{d.kind}</span>
                    </Link>
                  ))}
                </Card>
              )}
            </Panel>
          </div>
        </div>
      </QueryState>

      {taskDialog.dialog}
    </>
  )
}
