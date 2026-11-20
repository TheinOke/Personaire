import type { Priority, Task } from '@/lib/types'

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

export const REMINDER_CHOICES = [
  { value: 0, label: 'At due time' },
  { value: 5, label: '5 min before' },
  { value: 10, label: '10 min before' },
  { value: 15, label: '15 min before' },
  { value: 30, label: '30 min before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
]

/** The day a task "belongs" to: the day you planned it, else its due date. */
export function taskDay(t: Task): string | null {
  return t.scheduled_date ?? t.due_date
}

/** Sort: high priority first, then by due time, then manual order. */
export function compareTasks(a: Task, b: Task) {
  return (
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    (a.due_time ?? '99').localeCompare(b.due_time ?? '99') ||
    a.sort_order - b.sort_order ||
    a.created_at.localeCompare(b.created_at)
  )
}

/** Sort by date (no date last), then by compareTasks. */
export function compareByDay(a: Task, b: Task) {
  const da = taskDay(a) ?? '9999'
  const db = taskDay(b) ?? '9999'
  return da.localeCompare(db) || compareTasks(a, b)
}
