import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarClock, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { addDaysISO, dayLabel, fromInstant, fromMinutes, toMinutes, weekStartOf } from '@/lib/dates'
import type { PlannerBlock, Task } from '@/lib/types'
import { useSettings } from '@/features/settings/useSettings'
import { useTimezone, useToday } from '@/features/settings/useToday'
import { TaskItem } from '@/features/tasks/TaskItem'
import { compareTasks, taskDay } from '@/features/tasks/meta'
import { useTaskDialog } from '@/features/tasks/useTaskDialog'
import { useTasks } from '@/features/tasks/useTasks'
import { BlockForm, type BlockDefaults } from './BlockForm'
import { Timeline } from './Timeline'
import { usePlannerMutations, useWeekBlocks } from './usePlanner'

/** Minutes since midnight right now, in the user's timezone (updates every minute). */
function useNowMinutes(tz: string) {
  const read = () => toMinutes(fromInstant(new Date().toISOString(), tz).time)
  const [now, setNow] = useState(read)
  useEffect(() => {
    const id = setInterval(() => setNow(read()), 60_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tz])
  return now
}

/** First free slot of `duration` minutes at or after `from`, rounded to 15 min. */
function nextFreeSlot(blocks: PlannerBlock[], from: number, duration: number) {
  let start = Math.ceil(from / 15) * 15
  const sorted = blocks.map((b) => [toMinutes(b.start_time), toMinutes(b.end_time)]).sort((a, b) => a[0] - b[0])
  for (const [s, e] of sorted) {
    if (start + duration <= s) break
    if (e > start) start = Math.ceil(e / 15) * 15
  }
  return Math.min(start, 24 * 60 - duration)
}

export function PlannerPage() {
  const { data: settings } = useSettings()
  const tz = useTimezone()
  const today = useToday()
  const now = useNowMinutes(tz)
  const [day, setDay] = useState(today)
  const weekStart = weekStartOf(day, settings?.week_start ?? 1)
  const { data: weekBlocks, isLoading, error } = useWeekBlocks(weekStart)
  const { data: tasks } = useTasks()
  const { toggleDone } = usePlannerMutations()
  const taskDialog = useTaskDialog()
  const [form, setForm] = useState<{ block?: PlannerBlock; defaults?: BlockDefaults; n: number } | null>(null)

  const blocks = (weekBlocks ?? []).filter((b) => b.block_date === day)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i))
  const isToday = day === today

  // Tasks for this day: planned/due today (plus overdue when viewing today), not yet done.
  const linked = new Set(blocks.map((b) => b.task_id).filter(Boolean))
  const dayTasks = (tasks ?? [])
    .filter((t) => t.status !== 'done')
    .filter((t) => taskDay(t) === day || (isToday && !!t.due_date && t.due_date < today))
    .sort(compareTasks)

  const plannedMinutes = blocks.reduce((sum, b) => sum + toMinutes(b.end_time) - toMinutes(b.start_time), 0)
  const doneCount = blocks.filter((b) => b.done).length

  function scheduleTask(task: Task) {
    const duration = Math.min(task.estimated_minutes ?? 30, 8 * 60)
    const startAt = nextFreeSlot(blocks, isToday ? Math.max(now, 6 * 60) : 9 * 60, duration)
    setForm({
      defaults: {
        block_date: day,
        title: task.title,
        task_id: task.id,
        category_id: task.category_id,
        start_time: fromMinutes(startAt),
        end_time: fromMinutes(startAt + duration),
      },
      n: Date.now(),
    })
  }

  function newBlockAt(start: string) {
    const s = toMinutes(start)
    setForm({ defaults: { block_date: day, start_time: start, end_time: fromMinutes(s + 60) }, n: Date.now() })
  }

  return (
    <>
      <PageHeader
        title="Daily Planner"
        description={format(parseISO(day), 'EEEE, d MMMM yyyy')}
        actions={
          <Button
            onClick={() => newBlockAt(fromMinutes(nextFreeSlot(blocks, isToday ? Math.max(now, 6 * 60) : 9 * 60, 60)))}
          >
            <Plus /> Block
          </Button>
        }
      />

      {/* Week strip */}
      <div className="mb-4 flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Previous week" onClick={() => setDay(addDaysISO(day, -7))}>
          <ChevronLeft />
        </Button>
        <div className="grid flex-1 grid-cols-7 gap-1">
          {weekDays.map((d) => {
            const count = (weekBlocks ?? []).filter((b) => b.block_date === d).length
            return (
              <button
                key={d}
                onClick={() => setDay(d)}
                aria-pressed={d === day}
                className={cn(
                  'flex flex-col items-center rounded-md py-1.5 text-xs transition-colors',
                  d === day ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                  d === today && d !== day && 'ring-1 ring-foreground/50',
                )}
              >
                <span className={cn(d === day ? 'opacity-70' : 'text-muted-foreground')}>{format(parseISO(d), 'EEEEE')}</span>
                <span className="text-sm font-medium">{format(parseISO(d), 'd')}</span>
                <span className={cn('mt-0.5 size-1 rounded-full', count ? (d === day ? 'bg-primary-foreground' : 'bg-foreground') : 'bg-transparent')} />
              </button>
            )
          })}
        </div>
        <Button variant="ghost" size="icon" aria-label="Next week" onClick={() => setDay(addDaysISO(day, 7))}>
          <ChevronRight />
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={isToday} onClick={() => setDay(today)}>
          Today
        </Button>
        <Input
          type="date"
          value={day}
          onChange={(e) => e.target.value && setDay(e.target.value)}
          className="h-8 w-auto text-sm"
          aria-label="Go to date"
        />
        <span className="ml-auto text-xs text-muted-foreground">
          {blocks.length > 0 &&
            `${doneCount}/${blocks.length} done · ${Math.floor(plannedMinutes / 60)}h${plannedMinutes % 60 ? ` ${plannedMinutes % 60}m` : ''} planned`}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <QueryState isLoading={isLoading} error={error}>
          <div>
            <Timeline
              key={day}
              blocks={blocks}
              settings={settings}
              nowMinutes={isToday ? now : null}
              onSelect={(block) => setForm({ block, n: Date.now() })}
              onCreateAt={newBlockAt}
              onToggle={toggleDone}
            />
            <p className="mt-2 text-xs text-muted-foreground">Tap an empty hour to add a block there.</p>
          </div>
        </QueryState>

        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Tasks for {dayLabel(day, today, settings?.date_format).toLowerCase() === 'today' ? 'today' : dayLabel(day, today, settings?.date_format)}
          </h2>
          {dayTasks.length === 0 ? (
            <Card className="border-dashed p-6 text-center text-sm text-muted-foreground">
              No tasks planned for this day.
              <Button variant="link" className="mt-1 h-auto p-0 text-sm" onClick={() => taskDialog.create({ scheduled_date: day })}>
                Add a task
              </Button>
            </Card>
          ) : (
            <Card className="divide-y overflow-hidden">
              {dayTasks.map((t) => (
                <div key={t.id} className="flex items-center">
                  <div className="min-w-0 flex-1">
                    <TaskItem task={t} onEdit={taskDialog.edit} showParent />
                  </div>
                  {linked.has(t.id) ? (
                    <span className="px-3 text-xs text-muted-foreground">Scheduled</span>
                  ) : (
                    <Button variant="ghost" size="icon" className="mr-1" aria-label={`Schedule "${t.title}"`} onClick={() => scheduleTask(t)}>
                      <CalendarClock />
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          )}
        </section>
      </div>

      {form && <BlockForm key={form.block?.id ?? `new-${form.n}`} block={form.block} defaults={form.defaults} onClose={() => setForm(null)} />}
      {taskDialog.dialog}
    </>
  )
}
