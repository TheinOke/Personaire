import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { format, parseISO } from 'date-fns'
import { Coffee, Pause, Play, Plus, Settings2, SkipForward, Square, Timer } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { StatTile } from '@/components/StatTile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { addDaysISO, dayLabel, fromInstant, toInstant, weekStartOf } from '@/lib/dates'
import { formatTime } from '@/lib/format'
import { playChime, unlockSound } from '@/lib/sound'
import type { TimeEntry } from '@/lib/types'
import { categoryIcon } from '@/features/categories/icons'
import { useActiveCategories, useCategories } from '@/features/categories/useCategories'
import { useGoals } from '@/features/goals/useGoals'
import { useSettings, useUpdateSettings } from '@/features/settings/useSettings'
import { useTimezone, useToday } from '@/features/settings/useToday'
import { useTasks } from '@/features/tasks/useTasks'
import { EntryForm } from './EntryForm'
import { entrySeconds, formatDuration, formatTimer, useEntriesSince, useNow, useRunningEntry, useTimeMutations } from './useTime'

type Mode = 'pomodoro' | 'stopwatch'

/** Circular progress around the timer (pomodoro only). */
function Ring({ fraction, children }: { fraction: number | null; children: ReactNode }) {
  const r = 108
  const c = 2 * Math.PI * r
  return (
    <div className="relative mx-auto size-60">
      <svg viewBox="0 0 240 240" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="120" cy="120" r={r} fill="none" stroke="var(--color-secondary)" strokeWidth="6" />
        {fraction !== null && (
          <circle
            cx="120"
            cy="120"
            r={r}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.max(0, Math.min(1, fraction)))}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

function TimerSettings() {
  const { data: s } = useSettings()
  const update = useUpdateSettings()
  if (!s) return null
  const num = (key: 'pomodoro_focus_min' | 'pomodoro_short_break_min' | 'pomodoro_long_break_min' | 'pomodoro_long_every', label: string, max: number) => (
    <label className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        defaultValue={s[key] ?? ''}
        key={`${key}-${s[key]}`}
        onBlur={(e) => {
          const v = Math.round(Number(e.target.value))
          if (v >= 1 && v <= max && v !== s[key]) update.mutate({ [key]: v })
        }}
      />
    </label>
  )
  return (
    <div className="space-y-3 border-t pt-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {num('pomodoro_focus_min', 'Focus (min)', 180)}
        {num('pomodoro_short_break_min', 'Short break', 60)}
        {num('pomodoro_long_break_min', 'Long break', 90)}
        {num('pomodoro_long_every', 'Long break every', 12)}
      </div>
      <label className="flex items-center justify-between text-sm">
        <span>Sound when a session ends (app open)</span>
        <Switch checked={!!s.timer_sound} onCheckedChange={(timer_sound) => update.mutate({ timer_sound })} aria-label="Timer sound" />
      </label>
      {update.isError && <p className="text-xs text-muted-foreground">⚠ {update.error.message}</p>}
    </div>
  )
}

export function FocusPage() {
  const { data: settings } = useSettings()
  const tz = useTimezone()
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const { data: tasks } = useTasks()
  const { data: goals } = useGoals()
  const { data: categories } = useCategories()
  const { data: activeCategories } = useActiveCategories()
  const runningQ = useRunningEntry()
  const running = runningQ.data ?? null

  const weekStart = weekStartOf(today, settings?.week_start ?? 1)
  const since = useMemo(() => {
    const from = [weekStart, addDaysISO(today, -6)].sort()[0]
    return toInstant(from, '00:00', tz)
  }, [weekStart, today, tz])
  const entriesQ = useEntriesSince(since)
  const { start, stop } = useTimeMutations()

  const [mode, setMode] = useState<Mode>('pomodoro')
  const [taskId, setTaskId] = useState(params.get('task') ?? '')
  const [categoryId, setCategoryId] = useState('')
  const [form, setForm] = useState<{ entry?: TimeEntry } | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  // Pre-fill category from a task passed in the URL (?task=…).
  useEffect(() => {
    const t = tasks?.find((x) => x.id === taskId)
    if (t?.category_id && !categoryId) setCategoryId(t.category_id)
    // Only when the task list arrives / the task changes.
  }, [tasks, taskId])

  const now = useNow(1000, !!running)

  // ---- Running timer & auto-finish -------------------------------------------
  const plannedEnd = running?.planned_end_at ? new Date(running.planned_end_at).getTime() : null
  const elapsed = running ? entrySeconds(running, now) : 0
  const remaining = plannedEnd ? Math.max(0, Math.round((plannedEnd - now) / 1000)) : null
  const total = plannedEnd && running ? Math.round((plannedEnd - new Date(running.started_at).getTime()) / 1000) : null
  const finishing = useRef<string | null>(null)

  useEffect(() => {
    if (!running || !plannedEnd || now < plannedEnd || finishing.current === running.id) return
    finishing.current = running.id
    if (settings?.timer_sound !== false) playChime()
    stop.mutate({ entry: running, at: new Date(plannedEnd) })
  }, [running, plannedEnd, now, settings?.timer_sound, stop])

  // Show the countdown in the browser tab.
  useEffect(() => {
    if (!running) return void (document.title = 'Personaire')
    const label = remaining !== null ? formatTimer(remaining) : formatTimer(elapsed)
    document.title = `${label} · ${running.kind === 'focus' ? 'Focus' : 'Break'}`
    return () => void (document.title = 'Personaire')
  }, [running, remaining, elapsed])

  // ---- Today / week numbers ---------------------------------------------------
  const entries = entriesQ.data ?? []
  const dayOf = (e: TimeEntry) => fromInstant(e.started_at, tz).day
  const focusEntries = entries.filter((e) => e.kind === 'focus')
  const todayFocus = focusEntries.filter((e) => dayOf(e) === today)
  const weekFocus = focusEntries.filter((e) => dayOf(e) >= weekStart)
  const sum = (list: TimeEntry[]) => list.reduce((s, e) => s + entrySeconds(e, now), 0)

  const focusMin = settings?.pomodoro_focus_min ?? 25
  const every = settings?.pomodoro_long_every ?? 4
  // A pomodoro counts if at least 90% of it was completed.
  const sessionsToday = todayFocus.filter((e) => {
    if (e.source !== 'pomodoro' || !e.ended_at || !e.planned_end_at) return false
    const planned = new Date(e.planned_end_at).getTime() - new Date(e.started_at).getTime()
    return entrySeconds(e) * 1000 >= planned * 0.9
  }).length

  // What to suggest next: right after a focus session → a break, after a break → focus.
  const last = entries.find((e) => e.source === 'pomodoro' && e.ended_at)
  const lastEndedAgoMin = last?.ended_at ? (Date.now() - new Date(last.ended_at).getTime()) / 60000 : Infinity
  const suggestBreak = !running && last?.kind === 'focus' && lastEndedAgoMin < 15
  const longBreakNext = sessionsToday > 0 && sessionsToday % every === 0
  const breakMin = longBreakNext ? (settings?.pomodoro_long_break_min ?? 15) : (settings?.pomodoro_short_break_min ?? 5)

  // ---- Actions ----------------------------------------------------------------
  function context() {
    const task = tasks?.find((t) => t.id === taskId)
    return { task_id: task?.id ?? null, goal_id: task?.goal_id ?? null, category_id: categoryId || task?.category_id || null }
  }

  function startFocus() {
    unlockSound()
    const startAt = new Date()
    start.mutate({
      kind: 'focus',
      source: mode,
      started_at: startAt.toISOString(),
      planned_end_at: mode === 'pomodoro' ? new Date(startAt.getTime() + focusMin * 60000).toISOString() : null,
      ...context(),
    })
    if (params.get('task')) setParams({}, { replace: true })
  }

  function startBreak() {
    unlockSound()
    const startAt = new Date()
    start.mutate({
      kind: 'break',
      source: 'pomodoro',
      started_at: startAt.toISOString(),
      planned_end_at: new Date(startAt.getTime() + breakMin * 60000).toISOString(),
      ...context(),
    })
  }

  // ---- Labels -----------------------------------------------------------------
  const labelFor = (e: TimeEntry) => {
    const task = tasks?.find((t) => t.id === e.task_id)
    if (task) return task.title
    const goal = goals?.find((g) => g.id === e.goal_id)
    if (goal) return goal.title
    const cat = categories?.find((c) => c.id === e.category_id)
    return cat?.name ?? (e.kind === 'break' ? 'Break' : 'Focus')
  }

  const byCategory = useMemo(() => {
    const m = new Map<string | null, number>()
    for (const e of weekFocus) m.set(e.category_id, (m.get(e.category_id) ?? 0) + entrySeconds(e, now))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [weekFocus, now])
  const maxCat = Math.max(1, ...byCategory.map(([, s]) => s))

  const logDays = [...new Set(entries.map(dayOf))].sort().reverse()
  const runningTask = running && tasks?.find((t) => t.id === running.task_id)
  const openTasks = (tasks ?? []).filter((t) => t.status !== 'done')

  return (
    <>
      <PageHeader
        title="Focus"
        description="Pomodoro timer and time tracking."
        actions={
          <Button variant="outline" onClick={() => setForm({})}>
            <Plus /> Add time
          </Button>
        }
      />

      <QueryState isLoading={runningQ.isLoading} error={runningQ.error ?? entriesQ.error}>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* ---------------- Timer ---------------- */}
          <Card>
            <CardContent className="space-y-6 p-5 sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <Segmented
                  value={mode}
                  onChange={setMode}
                  disabled={!!running}
                  options={[
                    { value: 'pomodoro', label: 'Pomodoro' },
                    { value: 'stopwatch', label: 'Stopwatch' },
                  ]}
                />
                <Button variant="ghost" size="icon" aria-label="Timer settings" aria-expanded={showSettings} onClick={() => setShowSettings((s) => !s)}>
                  <Settings2 />
                </Button>
              </div>

              <Ring fraction={running ? (total && remaining !== null ? 1 - remaining / total : null) : null}>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {running
                    ? running.kind === 'break'
                      ? 'Break'
                      : running.source === 'pomodoro'
                        ? 'Focus'
                        : 'Tracking'
                    : suggestBreak
                      ? 'Session done'
                      : mode === 'pomodoro'
                        ? 'Ready'
                        : 'Stopwatch'}
                </span>
                <span className="mt-1 text-5xl font-semibold tabular-nums tracking-tight">
                  {running
                    ? formatTimer(remaining ?? elapsed)
                    : suggestBreak
                      ? formatTimer(breakMin * 60)
                      : mode === 'pomodoro'
                        ? formatTimer(focusMin * 60)
                        : '0:00'}
                </span>
                {running && (
                  <span className="mt-2 max-w-44 truncate text-xs text-muted-foreground">
                    {runningTask?.title ?? labelFor(running)}
                  </span>
                )}
                {!running && suggestBreak && (
                  <span className="mt-2 text-xs text-muted-foreground">{longBreakNext ? 'Long break' : 'Short break'} next</span>
                )}
              </Ring>

              {/* Session dots for the current cycle */}
              {mode === 'pomodoro' && (
                <div className="flex items-center justify-center gap-2" aria-label={`${sessionsToday} sessions today`}>
                  {Array.from({ length: every }, (_, i) => {
                    const inCycle = sessionsToday % every || (sessionsToday > 0 ? every : 0)
                    return <span key={i} className={cn('size-2 rounded-full', i < inCycle ? 'bg-primary' : 'border border-muted-foreground')} />
                  })}
                  <span className="ml-2 text-xs text-muted-foreground">{sessionsToday} today</span>
                </div>
              )}

              {/* What am I working on */}
              {!running && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select value={taskId} onChange={(e) => setTaskId(e.target.value)} aria-label="Task">
                    <option value="">No task</option>
                    {openTasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </Select>
                  <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Category">
                    <option value="">No category</option>
                    {activeCategories?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-2">
                {!running && suggestBreak && (
                  <>
                    <Button size="lg" onClick={startBreak} disabled={start.isPending}>
                      <Coffee /> Start {breakMin} min break
                    </Button>
                    <Button size="lg" variant="outline" onClick={startFocus} disabled={start.isPending}>
                      <SkipForward /> Skip break
                    </Button>
                  </>
                )}
                {!running && !suggestBreak && (
                  <Button size="lg" className="min-w-40" onClick={startFocus} disabled={start.isPending}>
                    <Play /> {mode === 'pomodoro' ? `Start ${focusMin} min focus` : 'Start'}
                  </Button>
                )}
                {running && running.kind === 'focus' && (
                  <Button size="lg" variant="outline" className="min-w-40" onClick={() => stop.mutate({ entry: running })}>
                    {running.source === 'pomodoro' ? <Pause /> : <Square />}
                    {running.source === 'pomodoro' ? 'Stop & log' : 'Stop'}
                  </Button>
                )}
                {running && running.kind === 'break' && (
                  <Button size="lg" variant="outline" className="min-w-40" onClick={() => stop.mutate({ entry: running })}>
                    <SkipForward /> End break
                  </Button>
                )}
              </div>

              {running?.planned_end_at && (
                <p className="text-center text-xs text-muted-foreground">
                  Ends at {formatTime(running.planned_end_at, settings)}. You’ll get a notification even if the app is closed.
                </p>
              )}
              {(start.isError || stop.isError) && (
                <p className="text-center text-xs text-muted-foreground">⚠ {(start.error ?? stop.error)?.message}</p>
              )}

              {showSettings && <TimerSettings />}
            </CardContent>
          </Card>

          {/* ---------------- Totals ---------------- */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Focused today" value={formatDuration(sum(todayFocus))} sub={`${todayFocus.length} session${todayFocus.length === 1 ? '' : 's'}`} />
              <StatTile label="This week" value={formatDuration(sum(weekFocus))} sub={`since ${format(parseISO(weekStart), 'EEE d MMM')}`} />
            </div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">This week by category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {byCategory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No focus time yet this week.</p>
                ) : (
                  byCategory.map(([id, secs]) => {
                    const cat = categories?.find((c) => c.id === id)
                    const Icon = categoryIcon(cat?.icon)
                    return (
                      <div key={id ?? 'none'}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="inline-flex items-center gap-1.5">
                            <Icon className="size-3.5 text-muted-foreground" />
                            {cat?.name ?? 'Uncategorised'}
                          </span>
                          <span className="tabular-nums text-muted-foreground">{formatDuration(secs)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(100 * secs) / maxCat}%` }} />
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ---------------- Log ---------------- */}
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Time log</h2>
          {logDays.length === 0 ? (
            <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
              <Timer className="mx-auto mb-2 size-5" />
              Start a timer or add time to see it here.
            </Card>
          ) : (
            <div className="space-y-4">
              {logDays.map((day) => {
                const list = entries.filter((e) => dayOf(e) === day)
                const dayFocus = list.filter((e) => e.kind === 'focus')
                return (
                  <div key={day}>
                    <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                      <span>{dayLabel(day, today, settings?.date_format)}</span>
                      <span className="tabular-nums">{formatDuration(sum(dayFocus))} focused</span>
                    </div>
                    <Card className="divide-y overflow-hidden">
                      {list.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setForm({ entry: e })}
                          className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/40', e.kind === 'break' && 'text-muted-foreground')}
                        >
                          <span className="w-28 shrink-0 text-xs tabular-nums text-muted-foreground">
                            {formatTime(e.started_at, settings)}–{e.ended_at ? formatTime(e.ended_at, settings) : 'now'}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {e.kind === 'break' && <Coffee className="mr-1.5 inline size-3.5" />}
                            {labelFor(e)}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums">{e.ended_at ? formatDuration(entrySeconds(e)) : '●'}</span>
                        </button>
                      ))}
                    </Card>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </QueryState>

      {form && <EntryForm key={form.entry?.id ?? 'new'} entry={form.entry} onClose={() => setForm(null)} />}
    </>
  )
}
