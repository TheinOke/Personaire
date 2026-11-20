import type { ReactNode } from 'react'
import { Check, ChevronRight, CornerDownRight, Flag, Plus, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dayLabel } from '@/lib/dates'
import { formatClock } from '@/lib/format'
import type { Task } from '@/lib/types'
import { categoryIcon } from '@/features/categories/icons'
import { useCategories } from '@/features/categories/useCategories'
import { useGoals } from '@/features/goals/useGoals'
import { useSettings } from '@/features/settings/useSettings'
import { useToday } from '@/features/settings/useToday'
import { useTaskMutations, useTasks } from './useTasks'

export function TaskCheck({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const done = task.status === 'done'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
      aria-pressed={done}
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
        done ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground hover:border-foreground',
        task.status === 'in_progress' && 'border-dashed border-foreground',
      )}
    >
      {done && <Check className="size-3" strokeWidth={3} />}
    </button>
  )
}

export function TaskItem({
  task,
  onEdit,
  showGoal = true,
  showParent = false,
  showSubtasks = false,
  onAddSubtask,
  depth = 0,
}: {
  task: Task
  onEdit: (task: Task) => void
  showGoal?: boolean
  /** Show "↳ parent title" for subtasks listed outside their parent. */
  showParent?: boolean
  /** Render this task's subtasks nested under it. */
  showSubtasks?: boolean
  onAddSubtask?: (parent: Task) => void
  depth?: number
}) {
  const { data: settings } = useSettings()
  const { data: goals } = useGoals()
  const { data: categories } = useCategories()
  const { data: tasks } = useTasks()
  const { toggle } = useTaskMutations()
  const today = useToday()

  const done = task.status === 'done'
  const goal = showGoal && task.goal_id ? goals?.find((g) => g.id === task.goal_id) : undefined
  const category = task.category_id ? categories?.find((c) => c.id === task.category_id) : undefined
  const parent = showParent && task.parent_task_id ? tasks?.find((t) => t.id === task.parent_task_id) : undefined
  const subtasks = (tasks ?? []).filter((t) => t.parent_task_id === task.id).sort((a, b) => a.sort_order - b.sort_order)
  const subDone = subtasks.filter((t) => t.status === 'done').length
  const overdue = !done && !!task.due_date && task.due_date < today
  const CategoryIcon = categoryIcon(category?.icon)

  const meta: ReactNode[] = []
  if (parent) meta.push(<span key="p" className="inline-flex items-center gap-1"><CornerDownRight className="size-3" />{parent.title}</span>)
  if (task.due_date) {
    meta.push(
      <span key="d" className={cn(overdue && 'font-medium text-foreground')}>
        {overdue ? 'Overdue · ' : 'Due '}
        {dayLabel(task.due_date, today, settings?.date_format)}
        {task.due_time && ` ${formatClock(task.due_time, settings)}`}
      </span>,
    )
  }
  if (goal) meta.push(<span key="g" className="inline-flex items-center gap-1"><Target className="size-3" />{goal.title}</span>)
  if (category) meta.push(<span key="c" className="inline-flex items-center gap-1"><CategoryIcon className="size-3" />{category.name}</span>)
  if (subtasks.length && !showSubtasks) meta.push(<span key="s">{subDone}/{subtasks.length} subtasks</span>)

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onEdit(task)}
        onKeyDown={(e) => e.key === 'Enter' && onEdit(task)}
        className="group flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-accent/50"
        style={{ paddingLeft: 16 + depth * 28 }}
      >
        <div className="pt-0.5">
          <TaskCheck task={task} onToggle={() => toggle(task)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('break-words', done && 'text-muted-foreground line-through')}>{task.title}</p>
          {meta.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">{meta}</div>
          )}
        </div>
        {task.priority === 'high' && !done && <Flag className="mt-1 size-3.5 shrink-0 fill-current" aria-label="High priority" />}
        {onAddSubtask && !done && (
          <button
            type="button"
            aria-label={`Add subtask to "${task.title}"`}
            onClick={(e) => {
              e.stopPropagation()
              onAddSubtask(task)
            }}
            className="-my-1 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-4" />
          </button>
        )}
        {!onAddSubtask && <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />}
      </div>
      {showSubtasks &&
        subtasks.map((s) => (
          <TaskItem key={s.id} task={s} onEdit={onEdit} showGoal={false} depth={depth + 1} showSubtasks onAddSubtask={depth < 1 ? onAddSubtask : undefined} />
        ))}
    </div>
  )
}
