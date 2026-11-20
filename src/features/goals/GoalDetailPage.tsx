import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, CalendarRange, Check, Flag, Pause, Pencil, Play, RotateCcw } from 'lucide-react'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatDate } from '@/lib/format'
import { categoryIcon } from '@/features/categories/icons'
import { useCategories } from '@/features/categories/useCategories'
import { useSettings } from '@/features/settings/useSettings'
import { useToday } from '@/features/settings/useToday'
import { QuickAdd } from '@/features/tasks/QuickAdd'
import { TaskItem } from '@/features/tasks/TaskItem'
import { useTaskDialog } from '@/features/tasks/useTaskDialog'
import { useTasks } from '@/features/tasks/useTasks'
import { targetLabel } from './GoalCard'
import { GoalForm } from './GoalForm'
import { goalProgress, useGoalMutations, useGoals } from './useGoals'

/** Range slider that only saves when you let go. */
function ManualProgress({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  const commit = () => local !== value && onCommit(local)
  return (
    <div className="mt-4">
      <label htmlFor="manual-progress" className="mb-2 block text-xs text-muted-foreground">
        Drag to set progress
      </label>
      <input
        id="manual-progress"
        type="range"
        min={0}
        max={100}
        step={5}
        value={local}
        onChange={(e) => setLocal(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="w-full accent-white"
      />
    </div>
  )
}

export function GoalDetailPage() {
  const { goalId } = useParams()
  const { data: goals, isLoading, error } = useGoals()
  const { data: tasks } = useTasks()
  const { data: categories } = useCategories()
  const { data: settings } = useSettings()
  const { update } = useGoalMutations()
  const today = useToday()
  const dialog = useTaskDialog()
  const [editing, setEditing] = useState(false)
  const [showDone, setShowDone] = useState(true)

  const goal = goals?.find((g) => g.id === goalId)

  if (!isLoading && !error && !goal) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">This goal doesn’t exist (it may have been deleted).</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/goals">Back to goals</Link>
        </Button>
      </div>
    )
  }

  const progress = goal ? goalProgress(goal, tasks) : { total: 0, done: 0, percent: 0 }
  const category = categories?.find((c) => c.id === goal?.category_id)
  const Icon = categoryIcon(category?.icon)

  // Top-level steps of this goal; subtasks render nested inside them.
  const steps = (tasks ?? [])
    .filter((t) => t.goal_id === goalId && !t.parent_task_id)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
  const openSteps = steps.filter((t) => t.status !== 'done')
  const doneSteps = steps.filter((t) => t.status === 'done')

  const finished = goal?.status === 'completed' || goal?.status === 'archived'

  return (
    <QueryState isLoading={isLoading} error={error}>
      {goal && (
        <>
          <Link to="/goals" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Goals
          </Link>

          <div className="mb-6 flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Icon className="size-3.5" /> {category?.name ?? 'No category'}
                </span>
                {goal.priority === 'high' && (
                  <span className="inline-flex items-center gap-1 text-foreground">
                    <Flag className="size-3.5 fill-current" /> High priority
                  </span>
                )}
                {goal.status !== 'active' && <span className="rounded border px-1.5 py-0.5 capitalize">{goal.status}</span>}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight break-words">{goal.title}</h1>
              {goal.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{goal.description}</p>}
            </div>
            <Button variant="outline" size="icon" aria-label="Edit goal" onClick={() => setEditing(true)}>
              <Pencil />
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardContent className="p-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Progress</span>
                  <span className="text-3xl font-semibold">{progress.percent}%</span>
                </div>
                <Progress value={progress.percent} className="mt-3 h-2" />
                <p className="mt-2 text-xs text-muted-foreground">
                  {goal.progress_mode === 'tasks'
                    ? `${progress.done} of ${progress.total} tasks done (including subtasks)`
                    : 'Progress is set manually.'}
                </p>
                {goal.progress_mode === 'manual' && !finished && (
                  <ManualProgress value={goal.manual_progress} onCommit={(v) => update.mutate({ id: goal.id, manual_progress: v })} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-5 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarRange className="size-4" />
                  <span>
                    {goal.start_date ? formatDate(goal.start_date, settings) : 'No start'} →{' '}
                    {goal.target_date ? formatDate(goal.target_date, settings) : 'No target'}
                  </span>
                </div>
                {goal.target_date && !finished && <p className="font-medium">{targetLabel(goal.target_date, today)}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  {goal.status === 'active' && (
                    <>
                      <Button size="sm" onClick={() => update.mutate({ id: goal.id, status: 'completed' })}>
                        <Check /> Complete
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => update.mutate({ id: goal.id, status: 'paused' })}>
                        <Pause /> Pause
                      </Button>
                    </>
                  )}
                  {goal.status === 'paused' && (
                    <Button size="sm" variant="outline" onClick={() => update.mutate({ id: goal.id, status: 'active' })}>
                      <Play /> Resume
                    </Button>
                  )}
                  {finished && (
                    <Button size="sm" variant="outline" onClick={() => update.mutate({ id: goal.id, status: 'active' })}>
                      <RotateCcw /> Reopen
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* M04 — Task breakdown */}
          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle>Breakdown</CardTitle>
              <p className="text-sm text-muted-foreground">
                Split this goal into steps. Use <span className="text-foreground">+</span> on a step to add subtasks.
              </p>
            </CardHeader>
            {!finished && (
              <div className="px-5 pb-4">
                <QuickAdd
                  placeholder="Add a step…"
                  defaults={{ goal_id: goal.id, category_id: goal.category_id }}
                />
              </div>
            )}
            {steps.length === 0 ? (
              <p className="border-t px-5 py-8 text-center text-sm text-muted-foreground">No steps yet.</p>
            ) : (
              <div className="divide-y border-t">
                {openSteps.map((t) => (
                  <TaskItem
                    key={t.id}
                    task={t}
                    onEdit={dialog.edit}
                    showGoal={false}
                    showSubtasks
                    onAddSubtask={(p) => dialog.create({ parent_task_id: p.id })}
                  />
                ))}
                {doneSteps.length > 0 && (
                  <>
                    <button
                      className="w-full px-4 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setShowDone((s) => !s)}
                    >
                      {showDone ? 'Hide' : 'Show'} completed steps ({doneSteps.length})
                    </button>
                    {showDone &&
                      doneSteps.map((t) => (
                        <TaskItem key={t.id} task={t} onEdit={dialog.edit} showGoal={false} showSubtasks />
                      ))}
                  </>
                )}
              </div>
            )}
          </Card>

          {editing && <GoalForm goal={goal} onClose={() => setEditing(false)} />}
          {dialog.dialog}
        </>
      )}
    </QueryState>
  )
}
