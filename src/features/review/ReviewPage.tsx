import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { format, parseISO } from 'date-fns'
import { Check, ChevronLeft, ChevronRight, Flame } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { StatTile } from '@/components/StatTile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Segmented } from '@/components/ui/segmented'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { addDaysISO, toInstant } from '@/lib/dates'
import type { Review } from '@/lib/types'
import { useCategories } from '@/features/categories/useCategories'
import { money, moneyIcon } from '@/features/finance/money'
import { amountOf, useMoneyCategories, useTransactions } from '@/features/finance/useFinance'
import { entrySeconds, formatDuration, useEntriesBetween } from '@/features/focus/useTime'
import { goalProgress, useGoals } from '@/features/goals/useGoals'
import { logSet, useHabitLogs, useHabits } from '@/features/habits/useHabits'
import { completedDay, delta, goalsCompletedIn, habitDays, habitRate, taskStats } from '@/features/progress/stats'
import { useSettings } from '@/features/settings/useSettings'
import { useTimezone, useToday } from '@/features/settings/useToday'
import { useTasks } from '@/features/tasks/useTasks'
import { periodFor, shiftPeriod, useReviews, useSaveReview, type Period, type PeriodType } from './useReviews'

function daysOf(p: Period, until: string) {
  const out: string[] = []
  for (let d = p.start; d <= p.end && d <= until; d = addDaysISO(d, 1)) out.push(d)
  return out
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        {aside}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

const PROMPTS = [
  { key: 'wins', label: 'Wins', placeholder: 'What went well? What are you proud of?' },
  { key: 'challenges', label: 'Challenges', placeholder: 'What got in the way?' },
  { key: 'lessons', label: 'Lessons', placeholder: 'What did you learn?' },
  { key: 'next_focus', label: 'Focus for next', placeholder: 'The 1–3 things that matter most next.' },
] as const

type Draft = Pick<Review, 'rating' | 'wins' | 'challenges' | 'lessons' | 'next_focus'>
const emptyDraft: Draft = { rating: null, wins: '', challenges: '', lessons: '', next_focus: '' }

function Reflection({ period, existing }: { period: Period; existing?: Review }) {
  const save = useSaveReview()
  const [draft, setDraft] = useState<Draft>(existing ?? emptyDraft)
  const [dirty, setDirty] = useState(false)
  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setDirty(true)
  }

  function onSave() {
    const clean = (s: string | null) => (s && s.trim() ? s.trim() : null)
    save.mutate(
      {
        period_type: period.type,
        period_start: period.start,
        rating: draft.rating,
        wins: clean(draft.wins),
        challenges: clean(draft.challenges),
        lessons: clean(draft.lessons),
        next_focus: clean(draft.next_focus),
      },
      { onSuccess: () => setDirty(false) },
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Reflection</CardTitle>
        <p className="text-sm text-muted-foreground">A few honest lines are enough.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-sm text-muted-foreground">How did this {period.type} go?</p>
          <div className="flex gap-2" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={draft.rating === n}
                aria-label={`${n} of 5`}
                onClick={() => set({ rating: draft.rating === n ? null : n })}
                className={cn(
                  'flex size-10 items-center justify-center rounded-full border text-sm font-medium transition-colors',
                  draft.rating !== null && n <= draft.rating ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        {PROMPTS.map((p) => (
          <label key={p.key} className="block space-y-1.5">
            <span className="text-sm text-muted-foreground">{p.label}</span>
            <Textarea value={draft[p.key] ?? ''} placeholder={p.placeholder} onChange={(e) => set({ [p.key]: e.target.value })} />
          </label>
        ))}
        <div className="flex items-center gap-3">
          <Button onClick={onSave} disabled={save.isPending || !dirty}>
            {save.isPending ? 'Saving…' : existing && !dirty ? <><Check /> Saved</> : 'Save review'}
          </Button>
          {existing && !dirty && (
            <span className="text-xs text-muted-foreground">Last saved {format(parseISO(existing.updated_at), 'd MMM, HH:mm')}</span>
          )}
          {save.isError && <span className="text-xs text-muted-foreground">⚠ {save.error.message}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

export function ReviewPage() {
  const { data: settings } = useSettings()
  const weekStart = settings?.week_start ?? 1
  const tz = useTimezone()
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const type: PeriodType = params.get('type') === 'month' ? 'month' : 'week'
  const [period, setPeriod] = useState<Period>(() => periodFor(type, today, weekStart))

  // Follow ?type= changes and the week-start setting once it loads.
  useEffect(() => {
    setPeriod((p) => (p.type === type ? periodFor(type, p.start, weekStart) : periodFor(type, today, weekStart)))
  }, [type, weekStart, today])

  const prev = shiftPeriod(period, -1, weekStart)
  const isCurrent = period.start <= today && today <= period.end
  const isFuture = period.start > today

  const tasksQ = useTasks()
  const goalsQ = useGoals()
  const habitsQ = useHabits()
  const logsQ = useHabitLogs()
  const reviewsQ = useReviews()
  const { data: categories } = useCategories()
  const { data: moneyCats } = useMoneyCategories()
  const txQ = useTransactions(prev.start, period.end)
  const entriesQ = useEntriesBetween(toInstant(prev.start, '00:00', tz), toInstant(addDaysISO(period.end, 1), '00:00', tz))

  const tasks = tasksQ.data ?? []
  const goals = goalsQ.data ?? []
  const habits = habitsQ.data ?? []
  const done = logSet(logsQ.data)
  const days = daysOf(period, today)
  const prevDays = daysOf(prev, today)

  // Tasks
  const ts = taskStats(tasks, days, tz)
  const prevTs = taskStats(tasks, prevDays, tz)
  const completedTasks = tasks
    .filter((t) => {
      const d = completedDay(t, tz)
      return d && d >= period.start && d <= period.end
    })
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))

  // Habits
  const hRate = habitRate(habitDays(habits, done, days, today))
  const prevHRate = habitRate(habitDays(habits, done, prevDays, today))
  const habitRows = habits
    .filter((h) => !h.archived)
    .map((h) => {
      const list = habitDays([h], done, days, today)
      const due = list.reduce((s, d) => s + d.due, 0)
      const hit = list.reduce((s, d) => s + d.done, 0)
      return { h, due, hit }
    })
    .filter((r) => r.due > 0)
    .sort((a, b) => b.hit / b.due - a.hit / a.due)

  // Goals
  const goalsDone = goalsCompletedIn(goals, days, tz)
  const activeGoals = goals.filter((g) => g.status === 'active').map((g) => ({ g, p: goalProgress(g, tasks) }))

  // Focus time
  const entries = (entriesQ.data ?? []).filter((e) => e.kind === 'focus')
  const periodStartMs = new Date(toInstant(period.start, '00:00', tz)).getTime()
  const inPeriod = (iso: string) => new Date(iso).getTime() >= periodStartMs
  const focusNow = entries.filter((e) => inPeriod(e.started_at))
  const focusPrev = entries.filter((e) => !inPeriod(e.started_at))
  const secs = (list: typeof entries) => list.reduce((s, e) => s + entrySeconds(e), 0)
  const focusByCat = useMemo(() => {
    const m = new Map<string | null, number>()
    for (const e of focusNow) m.set(e.category_id, (m.get(e.category_id) ?? 0) + entrySeconds(e))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [focusNow])

  // Money
  const currency = settings?.currency ?? 'USD'
  const tx = txQ.data ?? []
  const txNow = tx.filter((t) => t.occurred_on >= period.start)
  const txPrev = tx.filter((t) => t.occurred_on < period.start)
  const sum = (list: typeof tx, kind: 'income' | 'expense') => list.filter((t) => t.kind === kind).reduce((s, t) => s + amountOf(t), 0)
  const income = sum(txNow, 'income')
  const expense = sum(txNow, 'expense')
  const net = income - expense
  const prevNet = sum(txPrev, 'income') - sum(txPrev, 'expense')
  const topExpenses = useMemo(() => {
    const m = new Map<string | null, number>()
    for (const t of txNow) if (t.kind === 'expense') m.set(t.money_category_id, (m.get(t.money_category_id) ?? 0) + amountOf(t))
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [txNow])

  const existing = reviewsQ.data?.find((r) => r.period_type === period.type && r.period_start === period.start)
  const past = (reviewsQ.data ?? []).filter((r) => r.period_type === period.type)

  const loading = tasksQ.isLoading || goalsQ.isLoading || habitsQ.isLoading || logsQ.isLoading || reviewsQ.isLoading
  const error = tasksQ.error ?? goalsQ.error ?? habitsQ.error ?? logsQ.error ?? reviewsQ.error ?? txQ.error ?? entriesQ.error
  const unit = period.type

  return (
    <>
      <PageHeader
        title="Review"
        description="Look back, learn, and set your focus."
        actions={
          <Segmented
            value={type}
            onChange={(t) => setParams({ type: t }, { replace: true })}
            options={[
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
          />
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" aria-label={`Previous ${unit}`} onClick={() => setPeriod(prev)}>
          <ChevronLeft />
        </Button>
        <span className="min-w-40 text-center font-medium">{period.label}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Next ${unit}`}
          disabled={isCurrent || isFuture}
          onClick={() => setPeriod(shiftPeriod(period, 1, weekStart))}
        >
          <ChevronRight />
        </Button>
        {!isCurrent && (
          <Button variant="outline" size="sm" onClick={() => setPeriod(periodFor(type, today, weekStart))}>
            This {unit}
          </Button>
        )}
        {isCurrent && <span className="text-xs text-muted-foreground">In progress · {days.length} of {daysOf(period, period.end).length} days</span>}
      </div>

      <QueryState isLoading={loading} error={error}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile label="Tasks done" value={ts.completed} sub={`${delta(ts.completed, prevTs.completed)} vs last ${unit}`} />
          <StatTile
            label="Habits"
            value={hRate === null ? '—' : `${hRate}%`}
            sub={hRate !== null && prevHRate !== null ? `${delta(hRate, prevHRate)} pts vs last ${unit}` : 'scheduled days'}
          />
          <StatTile
            label="Focus time"
            value={formatDuration(secs(focusNow))}
            sub={`${secs(focusNow) >= secs(focusPrev) ? '+' : '−'}${formatDuration(Math.abs(secs(focusNow) - secs(focusPrev)))} vs last ${unit}`}
          />
          <StatTile
            label="Net money"
            value={money(net, currency, { sign: true })}
            sub={`last ${unit}: ${money(prevNet, currency, { sign: true })}`}
          />
          <StatTile label="Goals completed" value={goalsDone} sub={`${activeGoals.length} still active`} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Section title="Completed tasks" aside={<span className="text-xs text-muted-foreground">{completedTasks.length}</span>}>
            {completedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks completed this {unit}.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {completedTasks.slice(0, 10).map((t) => (
                  <li key={t.id} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 break-words">{t.title}</span>
                  </li>
                ))}
                {completedTasks.length > 10 && <li className="text-xs text-muted-foreground">+ {completedTasks.length - 10} more</li>}
              </ul>
            )}
          </Section>

          <Section title="Habits">
            {habitRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No habits scheduled this {unit}.</p>
            ) : (
              <div className="space-y-3">
                {habitRows.map(({ h, due, hit }) => (
                  <div key={h.id}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span className="truncate">{h.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {hit}/{due}
                        {hit === due && <Flame className="ml-1 inline size-3 text-foreground" />}
                      </span>
                    </div>
                    <Progress value={(100 * hit) / due} />
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Goals">
            {activeGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active goals.</p>
            ) : (
              <div className="space-y-3">
                {activeGoals.map(({ g, p }) => (
                  <Link key={g.id} to={`/goals/${g.id}`} className="block">
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span className="truncate">{g.title}</span>
                      <span className="shrink-0 tabular-nums">{p.percent}%</span>
                    </div>
                    <Progress value={p.percent} />
                  </Link>
                ))}
              </div>
            )}
          </Section>

          <Section title="Focus by category">
            {focusByCat.length === 0 ? (
              <p className="text-sm text-muted-foreground">No focus time logged this {unit}.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {focusByCat.map(([id, s]) => (
                  <div key={id ?? 'none'} className="flex justify-between gap-3">
                    <span className="truncate">{categories?.find((c) => c.id === id)?.name ?? 'Uncategorised'}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{formatDuration(s)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Money" aside={<Link to="/finance" className="text-xs text-muted-foreground hover:text-foreground">Finance →</Link>}>
            <div className="mb-4 grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Income</p>
                <p className="font-medium tabular-nums">{money(income, currency)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expenses</p>
                <p className="font-medium tabular-nums">{money(expense, currency)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net</p>
                <p className="font-medium tabular-nums">{money(net, currency, { sign: true })}</p>
              </div>
            </div>
            {topExpenses.length > 0 && (
              <div className="space-y-2 border-t pt-3 text-sm">
                <p className="text-xs text-muted-foreground">Top spending</p>
                {topExpenses.map(([id, v]) => {
                  const cat = moneyCats?.find((c) => c.id === id)
                  const Icon = moneyIcon(cat?.icon)
                  return (
                    <div key={id ?? 'none'} className="flex items-center justify-between gap-3">
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{cat?.name ?? 'Uncategorised'}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">{money(v, currency)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          <Reflection key={`${period.type}-${period.start}-${existing?.id ?? 'new'}`} period={period} existing={existing} />
        </div>

        {past.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Past {unit}ly reviews</h2>
            <Card className="divide-y overflow-hidden">
              {past.slice(0, 12).map((r) => {
                const p = periodFor(r.period_type, r.period_start, weekStart)
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={cn('flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/40', r.period_start === period.start && 'bg-accent/40')}
                  >
                    <span className="w-36 shrink-0 text-sm">{p.label}</span>
                    <span className="flex gap-0.5" aria-label={r.rating ? `Rated ${r.rating} of 5` : 'Not rated'}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className={cn('size-1.5 rounded-full', r.rating && n <= r.rating ? 'bg-foreground' : 'bg-border')} />
                      ))}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{r.wins ?? r.next_focus ?? ''}</span>
                  </button>
                )
              })}
            </Card>
          </section>
        )}
      </QueryState>
    </>
  )
}
