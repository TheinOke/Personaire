import { useState } from 'react'
import { Link } from 'react-router'
import { format, parseISO } from 'date-fns'
import { Flame } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { BarChart, type Bar } from '@/components/BarChart'
import { StatTile } from '@/components/StatTile'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Segmented } from '@/components/ui/segmented'
import { addDaysISO } from '@/lib/dates'
import { useCategories } from '@/features/categories/useCategories'
import { goalProgress, useGoals } from '@/features/goals/useGoals'
import { targetLabel } from '@/features/goals/GoalCard'
import { bestStreak, completionRate, currentStreak, logSet, useHabitLogs, useHabits } from '@/features/habits/useHabits'
import { useTimezone, useToday } from '@/features/settings/useToday'
import { useTasks } from '@/features/tasks/useTasks'
import { categoryName, delta, goalsCompletedIn, habitDays, habitRate, lastDays, taskStats } from './stats'

type Period = 7 | 30 | 91

/** Group daily bars into weeks for the 90-day view. */
function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

export function ProgressPage() {
  const tz = useTimezone()
  const today = useToday()
  const [period, setPeriod] = useState<Period>(7)
  const tasksQ = useTasks()
  const goalsQ = useGoals()
  const habitsQ = useHabits()
  const logsQ = useHabitLogs()
  const { data: categories } = useCategories()

  const tasks = tasksQ.data ?? []
  const goals = goalsQ.data ?? []
  const habits = habitsQ.data ?? []
  const done = logSet(logsQ.data)

  const days = lastDays(today, period)
  const prevDays = lastDays(addDaysISO(today, -period), period)
  const ts = taskStats(tasks, days, tz)
  const prevTs = taskStats(tasks, prevDays, tz)
  const hDays = habitDays(habits, done, days, today)
  const hRate = habitRate(hDays)
  const prevHRate = habitRate(habitDays(habits, done, prevDays, today))
  const goalsDone = goalsCompletedIn(goals, days, tz)
  const activeGoals = goals.filter((g) => g.status === 'active')
  const avgGoal = activeGoals.length
    ? Math.round(activeGoals.reduce((s, g) => s + goalProgress(g, tasks).percent, 0) / activeGoals.length)
    : null

  // Chart bars — daily for 7/30 days, weekly for 90 days.
  const weekly = period === 91
  const taskBars: Bar[] = weekly
    ? chunk(days, 7).map((w) => ({
        key: w[0],
        value: w.reduce((s, d) => s + (ts.perDay.get(d) ?? 0), 0),
        label: format(parseISO(w[0]), 'd/M'),
        title: `Week of ${format(parseISO(w[0]), 'd MMM')}`,
      }))
    : days.map((d) => ({
        key: d,
        value: ts.perDay.get(d) ?? 0,
        label: period === 7 ? format(parseISO(d), 'EEE') : format(parseISO(d), 'd'),
        title: format(parseISO(d), 'EEE d MMM'),
      }))

  const habitBars: Bar[] = weekly
    ? chunk(hDays, 7).map((w) => ({
        key: w[0].day,
        value: habitRate(w),
        label: format(parseISO(w[0].day), 'd/M'),
        title: `Week of ${format(parseISO(w[0].day), 'd MMM')}`,
      }))
    : hDays.map((h) => ({
        key: h.day,
        value: h.pct,
        label: period === 7 ? format(parseISO(h.day), 'EEE') : format(parseISO(h.day), 'd'),
        title: `${format(parseISO(h.day), 'EEE d MMM')}${h.due ? ` · ${h.done}/${h.due} habits` : ' · nothing due'}`,
      }))

  const byCategory = [...ts.byCategory.entries()]
    .map(([id, count]) => ({ id, name: categoryName(categories, id), count }))
    .sort((a, b) => b.count - a.count)
  const maxCat = Math.max(1, ...byCategory.map((c) => c.count))

  const activeHabits = habits.filter((h) => !h.archived)
  const loading = tasksQ.isLoading || goalsQ.isLoading || habitsQ.isLoading || logsQ.isLoading
  const error = tasksQ.error ?? goalsQ.error ?? habitsQ.error ?? logsQ.error
  const periodLabel = period === 91 ? '90 days' : `${period} days`

  return (
    <>
      <PageHeader
        title="Progress"
        description="How your goals, tasks and habits are going."
        actions={
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: 7 as const, label: '7d' },
              { value: 30 as const, label: '30d' },
              { value: 91 as const, label: '90d' },
            ]}
          />
        }
      />

      <QueryState isLoading={loading} error={error}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Tasks completed"
            value={ts.completed}
            sub={`${delta(ts.completed, prevTs.completed)} vs previous ${periodLabel}`}
          />
          <StatTile
            label="On time"
            value={ts.withDue ? `${Math.round((100 * ts.onTime) / ts.withDue)}%` : '—'}
            sub={ts.withDue ? `${ts.onTime} of ${ts.withDue} with a due date` : 'No due-dated tasks done'}
          />
          <StatTile
            label="Habit completion"
            value={hRate === null ? '—' : `${hRate}%`}
            sub={hRate !== null && prevHRate !== null ? `${delta(hRate, prevHRate)} pts vs previous` : 'Scheduled days only'}
          />
          <StatTile
            label="Active goals"
            value={avgGoal === null ? '—' : `${avgGoal}%`}
            sub={`avg progress · ${goalsDone} completed in ${periodLabel}`}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tasks completed {weekly ? 'per week' : 'per day'}</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart bars={taskBars} labelEvery={period === 30 ? 5 : 1} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Habit completion {weekly ? 'per week' : 'per day'}</CardTitle>
            </CardHeader>
            <CardContent>
              {activeHabits.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No habits yet.</p>
              ) : (
                <BarChart bars={habitBars} max={100} formatValue={(v) => `${v}%`} labelEvery={period === 30 ? 5 : 1} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Goals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeGoals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active goals.</p>
              ) : (
                activeGoals
                  .map((g) => ({ g, p: goalProgress(g, tasks) }))
                  .sort((a, b) => b.p.percent - a.p.percent)
                  .map(({ g, p }) => (
                    <Link key={g.id} to={`/goals/${g.id}`} className="block">
                      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate">{g.title}</span>
                        <span className="shrink-0 tabular-nums">{p.percent}%</span>
                      </div>
                      <Progress value={p.percent} />
                      {g.target_date && <p className="mt-1 text-xs text-muted-foreground">{targetLabel(g.target_date, today)}</p>}
                    </Link>
                  ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Tasks completed by category · {periodLabel}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {byCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks completed in this period.</p>
              ) : (
                byCategory.map((c) => (
                  <div key={c.id ?? 'none'}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{c.name}</span>
                      <span className="tabular-nums text-muted-foreground">{c.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(100 * c.count) / maxCat}%` }} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {activeHabits.length > 0 && (
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Habits</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-5 py-2 font-normal">Habit</th>
                    <th className="px-3 py-2 text-right font-normal">Streak</th>
                    <th className="px-3 py-2 text-right font-normal">Best</th>
                    <th className="px-5 py-2 text-right font-normal">30-day</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activeHabits.map((h) => {
                    const streak = currentStreak(h, done, today)
                    return (
                      <tr key={h.id}>
                        <td className="max-w-0 truncate px-5 py-2.5">{h.name}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            {streak > 0 && <Flame className="size-3" />}
                            {streak}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{bestStreak(h, done, today)}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums">{completionRate(h, done, today, 30)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </QueryState>
    </>
  )
}
