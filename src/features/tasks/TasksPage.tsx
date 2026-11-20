import { useMemo, useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { addDaysISO, dayLabel, fromInstant } from '@/lib/dates'
import type { Task } from '@/lib/types'
import { useActiveCategories } from '@/features/categories/useCategories'
import { useSettings } from '@/features/settings/useSettings'
import { useTimezone, useToday } from '@/features/settings/useToday'
import { QuickAdd } from './QuickAdd'
import { TaskItem } from './TaskItem'
import { compareByDay, compareTasks, taskDay } from './meta'
import { useTaskDialog } from './useTaskDialog'
import { useTasks } from './useTasks'

type View = 'today' | 'upcoming' | 'all' | 'done'

const VIEWS: { value: View; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'all', label: 'All' },
  { value: 'done', label: 'Done' },
]

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 flex items-baseline gap-2 text-sm font-medium text-muted-foreground">
        {title}
        {count !== undefined && <span className="text-xs">{count}</span>}
      </h2>
      <Card className="divide-y overflow-hidden">{children}</Card>
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">{children}</Card>
}

export function TasksPage() {
  const { data: tasks, isLoading, error } = useTasks()
  const { data: categories } = useActiveCategories()
  const { data: settings } = useSettings()
  const today = useToday()
  const tz = useTimezone()
  const dialog = useTaskDialog()
  const [view, setView] = useState<View>('today')
  const [categoryId, setCategoryId] = useState('')

  const filtered = useMemo(
    () => (tasks ?? []).filter((t) => !categoryId || t.category_id === categoryId),
    [tasks, categoryId],
  )
  const open = filtered.filter((t) => t.status !== 'done')

  const item = (t: Task, extra?: Partial<Parameters<typeof TaskItem>[0]>) => (
    <TaskItem key={t.id} task={t} onEdit={dialog.edit} showParent {...extra} />
  )

  let content: ReactNode
  if (view === 'today') {
    const overdue = open.filter((t) => t.due_date && t.due_date < today).sort(compareByDay)
    const overdueIds = new Set(overdue.map((t) => t.id))
    const todays = open
      .filter((t) => !overdueIds.has(t.id) && (taskDay(t) ?? '9999') <= today)
      .sort(compareTasks)
    const doneToday = filtered.filter(
      (t) => t.status === 'done' && t.completed_at && fromInstant(t.completed_at, tz).day === today,
    )
    content = (
      <>
        {overdue.length > 0 && <Section title="Overdue" count={overdue.length}>{overdue.map((t) => item(t))}</Section>}
        {todays.length > 0 ? (
          <Section title="Today" count={todays.length}>{todays.map((t) => item(t))}</Section>
        ) : (
          overdue.length === 0 && <Empty>Nothing planned for today. Add a task above, or plan one from “All”.</Empty>
        )}
        {doneToday.length > 0 && (
          <Section title="Completed today" count={doneToday.length}>{doneToday.map((t) => item(t))}</Section>
        )}
      </>
    )
  } else if (view === 'upcoming') {
    const upcoming = open.filter((t) => (taskDay(t) ?? '') > today).sort(compareByDay)
    const byDay = new Map<string, Task[]>()
    for (const t of upcoming) {
      const d = taskDay(t)!
      byDay.set(d, [...(byDay.get(d) ?? []), t])
    }
    content =
      upcoming.length === 0 ? (
        <Empty>No upcoming tasks. Give a task a due date or plan it for a future day.</Empty>
      ) : (
        [...byDay].map(([day, list]) => (
          <Section key={day} title={dayLabel(day, today, settings?.date_format)} count={list.length}>
            {list.map((t) => item(t))}
          </Section>
        ))
      )
  } else if (view === 'all') {
    // Top-level tasks with their subtasks nested underneath.
    const roots = open.filter((t) => !t.parent_task_id || !open.some((p) => p.id === t.parent_task_id)).sort(compareByDay)
    content =
      roots.length === 0 ? (
        <Empty>No open tasks. Nice work.</Empty>
      ) : (
        <Section title="Open tasks" count={open.length}>
          {roots.map((t) => item(t, { showSubtasks: true, showParent: !!t.parent_task_id, onAddSubtask: (p) => dialog.create({ parent_task_id: p.id }) }))}
        </Section>
      )
  } else {
    const done = filtered
      .filter((t) => t.status === 'done')
      .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
      .slice(0, 100)
    content =
      done.length === 0 ? <Empty>No completed tasks yet.</Empty> : <Section title="Recently completed">{done.map((t) => item(t))}</Section>
  }

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Everything you need to get done."
        actions={
          <Button onClick={() => dialog.create({ scheduled_date: view === 'today' ? today : undefined, category_id: categoryId || undefined })}>
            <Plus /> New
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex rounded-md border p-0.5" role="tablist">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              role="tab"
              aria-selected={view === v.value}
              onClick={() => setView(v.value)}
              className={cn(
                'flex-1 rounded-[5px] px-3 py-1.5 text-sm text-muted-foreground sm:flex-none',
                view === v.value && 'bg-primary text-primary-foreground',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto sm:w-48">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Filter by category">
            <option value="">All categories</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {view !== 'done' && (
        <div className="mb-6">
          <QuickAdd
            placeholder={view === 'today' ? 'Add a task for today…' : view === 'upcoming' ? 'Add a task for tomorrow…' : 'Add a task…'}
            defaults={{
              scheduled_date: view === 'today' ? today : view === 'upcoming' ? addDaysISO(today, 1) : null,
              category_id: categoryId || null,
            }}
          />
        </div>
      )}

      <QueryState isLoading={isLoading} error={error}>
        {content}
      </QueryState>

      {dialog.dialog}
    </>
  )
}
