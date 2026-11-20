import { format, parseISO } from 'date-fns'
import { Check, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addDaysISO } from '@/lib/dates'
import { formatClock } from '@/lib/format'
import type { Habit } from '@/lib/types'
import { categoryIcon } from '@/features/categories/icons'
import { useCategories } from '@/features/categories/useCategories'
import { useSettings } from '@/features/settings/useSettings'
import { completionRate, currentStreak, isDueOn, useHabitMutations } from './useHabits'

export function HabitCard({
  habit,
  done,
  today,
  onEdit,
}: {
  habit: Habit
  done: Set<string>
  today: string
  onEdit: (habit: Habit) => void
}) {
  const { data: categories } = useCategories()
  const { data: settings } = useSettings()
  const { toggle } = useHabitMutations()

  const category = categories?.find((c) => c.id === habit.category_id)
  const Icon = categoryIcon(category?.icon)
  const dueToday = isDueOn(habit, today)
  const doneToday = done.has(`${habit.id}|${today}`)
  const streak = currentStreak(habit, done, today)
  const rate = completionRate(habit, done, today, 30)
  const last7 = Array.from({ length: 7 }, (_, i) => addDaysISO(today, i - 6))

  const set = (day: string, value: boolean) => toggle.mutate({ habitId: habit.id, day, done: value })

  return (
    <div className={cn('flex items-center gap-3 px-4 py-3', habit.archived && 'opacity-60')}>
      <button
        type="button"
        onClick={() => set(today, !doneToday)}
        disabled={habit.archived}
        aria-pressed={doneToday}
        aria-label={doneToday ? `Undo "${habit.name}" for today` : `Mark "${habit.name}" done today`}
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          doneToday
            ? 'border-primary bg-primary text-primary-foreground'
            : dueToday
              ? 'border-muted-foreground hover:border-foreground'
              : 'border-dashed border-border',
        )}
      >
        {doneToday && <Check className="size-5" strokeWidth={3} />}
      </button>

      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onEdit(habit)}>
        <p className={cn('truncate font-medium', doneToday && 'text-muted-foreground')}>{habit.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {streak > 0 && (
            <span className="inline-flex items-center gap-1 text-foreground">
              <Flame className="size-3" /> {streak} day{streak > 1 ? 's' : ''}
            </span>
          )}
          <span>{rate}% · 30d</span>
          {category && (
            <span className="inline-flex items-center gap-1">
              <Icon className="size-3" /> {category.name}
            </span>
          )}
          {habit.reminder_time && <span>⏰ {formatClock(habit.reminder_time, settings)}</span>}
        </div>
      </button>

      {/* Last 7 days — tap to fill in a missed day */}
      <div className="flex shrink-0 gap-0.5 sm:gap-1" aria-label="Last 7 days">
        {last7.map((day) => {
          const due = isDueOn(habit, day)
          const hit = done.has(`${habit.id}|${day}`)
          return (
            <button
              key={day}
              type="button"
              disabled={habit.archived || day < habit.start_date}
              onClick={() => set(day, !hit)}
              title={`${format(parseISO(day), 'EEE d MMM')}${hit ? ' · done' : due ? ' · missed' : ' · not scheduled'}`}
              aria-label={`${format(parseISO(day), 'EEEE d MMMM')}: ${hit ? 'done' : due ? 'not done' : 'not scheduled'}`}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-[10px] text-muted-foreground">{format(parseISO(day), 'EEEEE')}</span>
              <span
                className={cn(
                  'size-4 rounded-full',
                  hit ? 'bg-primary' : due ? 'border border-muted-foreground' : 'border border-dashed border-border',
                  day === today && 'ring-1 ring-foreground ring-offset-1 ring-offset-background',
                )}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
