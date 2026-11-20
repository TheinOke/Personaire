import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Segmented } from '@/components/ui/segmented'
import { Field } from '@/components/Field'
import { addDaysISO, toInstant, trimSeconds } from '@/lib/dates'
import type { Priority, Task } from '@/lib/types'
import { useActiveCategories } from '@/features/categories/useCategories'
import { useGoals } from '@/features/goals/useGoals'
import { useSettings } from '@/features/settings/useSettings'
import { useTimezone, useToday } from '@/features/settings/useToday'
import { PRIORITY_OPTIONS, REMINDER_CHOICES } from './meta'
import { useTaskMutations, useTasks, type TaskInput } from './useTasks'

type Defaults = Pick<Partial<Task>, 'goal_id' | 'parent_task_id' | 'category_id' | 'scheduled_date' | 'due_date'>

/** Minutes between the reminder and the due time, or null if no reminder. */
function reminderOffset(task: Task | undefined, tz: string): number | null {
  if (!task?.reminder_at || !task.due_date || !task.due_time) return null
  const due = new Date(toInstant(task.due_date, trimSeconds(task.due_time), tz)).getTime()
  return Math.max(0, Math.round((due - new Date(task.reminder_at).getTime()) / 60000))
}

export function TaskForm({
  open,
  onClose,
  task,
  defaults,
}: {
  open: boolean
  onClose: () => void
  task?: Task
  defaults?: Defaults
}) {
  const { data: settings } = useSettings()
  const tz = useTimezone()
  const today = useToday()
  const { data: goals } = useGoals()
  const { data: categories } = useActiveCategories()
  const { data: tasks } = useTasks()
  const { create, update, remove } = useTaskMutations()

  const parent = tasks?.find((t) => t.id === (task?.parent_task_id ?? defaults?.parent_task_id))

  const [title, setTitle] = useState(task?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [goalId, setGoalId] = useState(task?.goal_id ?? defaults?.goal_id ?? '')
  const [categoryId, setCategoryId] = useState(task?.category_id ?? defaults?.category_id ?? '')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium')
  const [status, setStatus] = useState<Task['status']>(task?.status ?? 'todo')
  const [dueDate, setDueDate] = useState(task?.due_date ?? defaults?.due_date ?? '')
  const [dueTime, setDueTime] = useState(trimSeconds(task?.due_time))
  const [reminder, setReminder] = useState<string>(() => {
    const offset = reminderOffset(task, tz)
    return offset === null ? 'none' : String(offset)
  })
  const [scheduled, setScheduled] = useState(task?.scheduled_date ?? defaults?.scheduled_date ?? '')
  const [estimate, setEstimate] = useState(task?.estimated_minutes ? String(task.estimated_minutes) : '')
  const [error, setError] = useState<string | null>(null)

  const goalOptions = (goals ?? []).filter((g) => g.status === 'active' || g.status === 'paused' || g.id === goalId)
  const busy = create.isPending || update.isPending

  function onDueTimeChange(value: string) {
    // First time a due time is added → use the default reminder from Settings.
    if (value && !dueTime && reminder === 'none' && settings) setReminder(String(settings.default_reminder_minutes))
    if (!value) setReminder('none')
    setDueTime(value)
  }

  function onGoalChange(value: string) {
    setGoalId(value)
    const goal = goals?.find((g) => g.id === value)
    if (goal?.category_id && !categoryId) setCategoryId(goal.category_id)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return setError('Give the task a title.')

    let reminder_at: string | null = null
    if (dueDate && dueTime && reminder !== 'none') {
      const due = new Date(toInstant(dueDate, dueTime, tz)).getTime()
      reminder_at = new Date(due - Number(reminder) * 60000).toISOString()
    }

    const values: TaskInput = {
      title: trimmed,
      notes: notes.trim() || null,
      goal_id: parent ? parent.goal_id : goalId || null,
      parent_task_id: parent?.id ?? null,
      category_id: categoryId || null,
      priority,
      status,
      due_date: dueDate || null,
      due_time: dueDate && dueTime ? dueTime : null,
      reminder_at,
      scheduled_date: scheduled || null,
      estimated_minutes: estimate ? Math.max(1, Math.round(Number(estimate))) : null,
    }

    try {
      if (task) await update.mutateAsync({ id: task.id, ...values })
      else await create.mutateAsync(values)
      onClose()
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Could not save.')
    }
  }

  function onDelete() {
    if (!task) return
    const subCount = tasks?.filter((t) => t.parent_task_id === task.id).length ?? 0
    const extra = subCount ? `\n\nIts ${subCount} subtask${subCount > 1 ? 's' : ''} will be deleted too.` : ''
    if (window.confirm(`Delete "${task.title}"? This cannot be undone.${extra}`)) {
      remove.mutate(task.id)
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={task ? 'Edit task' : parent ? 'New subtask' : 'New task'}
      footer={
        <>
          {task && (
            <Button type="button" variant="ghost" size="icon" aria-label="Delete task" onClick={onDelete}>
              <Trash2 />
            </Button>
          )}
          <div className="flex-1" />
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="task-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={onSubmit} className="space-y-4">
        {parent && <p className="text-xs text-muted-foreground">Subtask of “{parent.title}”</p>}

        <Field label="Title" htmlFor="task-title">
          <Input id="task-title" autoFocus={!task} value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        {task && (
          <Field label="Status">
            <Segmented
              value={status}
              onChange={setStatus}
              options={[
                { value: 'todo', label: 'To do' },
                { value: 'in_progress', label: 'In progress' },
                { value: 'done', label: 'Done' },
              ]}
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {!parent && (
            <Field label="Goal" htmlFor="task-goal">
              <Select id="task-goal" value={goalId} onChange={(e) => onGoalChange(e.target.value)}>
                <option value="">No goal</option>
                {goalOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Category" htmlFor="task-category">
            <Select id="task-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">No category</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Priority">
          <Segmented value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Due date" htmlFor="task-due">
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value)
                if (!e.target.value) onDueTimeChange('')
              }}
            />
          </Field>
          <Field label="Due time" htmlFor="task-time">
            <Input id="task-time" type="time" value={dueTime} disabled={!dueDate} onChange={(e) => onDueTimeChange(e.target.value)} />
          </Field>
        </div>

        {dueDate && dueTime && (
          <Field label="Reminder" htmlFor="task-reminder" hint="Sent as a push notification once notifications are enabled.">
            <Select id="task-reminder" value={reminder} onChange={(e) => setReminder(e.target.value)}>
              <option value="none">No reminder</option>
              {REMINDER_CHOICES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Plan for" htmlFor="task-scheduled" hint="The day you intend to work on it.">
          <div className="flex gap-2">
            <Input id="task-scheduled" type="date" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
            <Button type="button" variant="outline" onClick={() => setScheduled(today)}>
              Today
            </Button>
            <Button type="button" variant="outline" onClick={() => setScheduled(addDaysISO(today, 1))}>
              Tmrw
            </Button>
          </div>
        </Field>

        <Field label="Estimate (minutes)" htmlFor="task-estimate">
          <Input
            id="task-estimate"
            type="number"
            inputMode="numeric"
            min={1}
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            className="w-32"
          />
        </Field>

        <Field label="Notes" htmlFor="task-notes">
          <Textarea id="task-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {error && <p className="text-sm text-muted-foreground">⚠ {error}</p>}
      </form>
    </Dialog>
  )
}
