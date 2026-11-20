import { addDaysISO, fromInstant } from '@/lib/dates'
import type { Category, Goal, Habit, Task } from '@/lib/types'
import { isDueOn } from '@/features/habits/useHabits'

/** The `n` days ending today, oldest first. */
export function lastDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDaysISO(today, i - (n - 1)))
}

/** Day (in the user's timezone) a task was completed, or null. */
export function completedDay(task: Task, tz: string): string | null {
  return task.status === 'done' && task.completed_at ? fromInstant(task.completed_at, tz).day : null
}

export interface TaskStats {
  completed: number
  /** Completed tasks that had a due date and were finished on or before it. */
  onTime: number
  withDue: number
  perDay: Map<string, number>
  byCategory: Map<string | null, number>
}

export function taskStats(tasks: Task[], days: string[], tz: string): TaskStats {
  const inRange = new Set(days)
  const perDay = new Map(days.map((d) => [d, 0]))
  const byCategory = new Map<string | null, number>()
  let completed = 0
  let onTime = 0
  let withDue = 0
  for (const t of tasks) {
    const day = completedDay(t, tz)
    if (!day || !inRange.has(day)) continue
    completed++
    perDay.set(day, (perDay.get(day) ?? 0) + 1)
    byCategory.set(t.category_id, (byCategory.get(t.category_id) ?? 0) + 1)
    if (t.due_date) {
      withDue++
      if (day <= t.due_date) onTime++
    }
  }
  return { completed, onTime, withDue, perDay, byCategory }
}

export interface HabitDay {
  day: string
  due: number
  done: number
  /** 0–100, or null when nothing was due. */
  pct: number | null
}

/**
 * Habit completion per day. Today only counts habits already done, so an
 * unfinished morning doesn't drag the numbers down.
 */
export function habitDays(habits: Habit[], done: Set<string>, days: string[], today: string): HabitDay[] {
  return days.map((day) => {
    let due = 0
    let hit = 0
    for (const h of habits) {
      if (h.archived || !isDueOn(h, day)) continue
      const isDone = done.has(`${h.id}|${day}`)
      if (day === today && !isDone) continue
      due++
      if (isDone) hit++
    }
    return { day, due, done: hit, pct: due ? Math.round((100 * hit) / due) : null }
  })
}

export function habitRate(list: HabitDay[]) {
  const due = list.reduce((s, d) => s + d.due, 0)
  const hit = list.reduce((s, d) => s + d.done, 0)
  return due ? Math.round((100 * hit) / due) : null
}

export function goalsCompletedIn(goals: Goal[], days: string[], tz: string) {
  const inRange = new Set(days)
  return goals.filter((g) => g.status === 'completed' && g.completed_at && inRange.has(fromInstant(g.completed_at, tz).day))
    .length
}

export function categoryName(categories: Category[] | undefined, id: string | null) {
  if (!id) return 'Uncategorised'
  return categories?.find((c) => c.id === id)?.name ?? 'Uncategorised'
}

/** "+3" / "−2" / "±0" change label. */
export function delta(now: number, before: number) {
  const d = now - before
  return d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '±0'
}
