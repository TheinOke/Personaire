import { Link } from 'react-router'
import { Flag } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { daysBetween } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import type { Goal } from '@/lib/types'
import { categoryIcon } from '@/features/categories/icons'
import { useCategories } from '@/features/categories/useCategories'
import { useSettings } from '@/features/settings/useSettings'
import { useToday } from '@/features/settings/useToday'
import { useTasks } from '@/features/tasks/useTasks'
import { goalProgress } from './useGoals'

/** "12 days left", "Due today", "5 days overdue". */
export function targetLabel(target: string, today: string) {
  const d = daysBetween(today, target)
  if (d === 0) return 'Due today'
  if (d === 1) return '1 day left'
  if (d > 1) return `${d} days left`
  return `${-d} day${d === -1 ? '' : 's'} overdue`
}

export function GoalCard({ goal }: { goal: Goal }) {
  const { data: tasks } = useTasks()
  const { data: categories } = useCategories()
  const { data: settings } = useSettings()
  const today = useToday()
  const progress = goalProgress(goal, tasks)
  const category = categories?.find((c) => c.id === goal.category_id)
  const Icon = categoryIcon(category?.icon)
  const finished = goal.status === 'completed' || goal.status === 'archived'
  const overdue = !finished && !!goal.target_date && goal.target_date < today

  return (
    <Link to={`/goals/${goal.id}`} className="block">
      <Card className="h-full p-5 transition-colors hover:bg-accent/40">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="size-3.5" />
          <span className="flex-1 truncate">{category?.name ?? 'No category'}</span>
          {goal.priority === 'high' && <Flag className="size-3.5 fill-current text-foreground" aria-label="High priority" />}
          {goal.status === 'paused' && <span className="rounded border px-1.5 py-0.5">Paused</span>}
        </div>
        <h3 className={cn('font-semibold leading-snug', goal.status === 'completed' && 'text-muted-foreground line-through')}>
          {goal.title}
        </h3>
        <div className="mt-4 flex items-baseline justify-between text-xs text-muted-foreground">
          <span>
            {goal.progress_mode === 'tasks'
              ? `${progress.done}/${progress.total} tasks`
              : 'Manual progress'}
          </span>
          <span className="text-sm font-semibold text-foreground">{progress.percent}%</span>
        </div>
        <Progress value={progress.percent} className="mt-1.5" />
        {goal.target_date && (
          <p className={cn('mt-3 text-xs text-muted-foreground', overdue && 'font-medium text-foreground')}>
            {finished ? `Target ${formatDate(goal.target_date, settings)}` : targetLabel(goal.target_date, today)}
          </p>
        )}
      </Card>
    </Link>
  )
}
