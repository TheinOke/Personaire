import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Trash2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Segmented } from '@/components/ui/segmented'
import { Field } from '@/components/Field'
import type { Goal, Priority } from '@/lib/types'
import { useActiveCategories } from '@/features/categories/useCategories'
import { PRIORITY_OPTIONS } from '@/features/tasks/meta'
import { useTasks } from '@/features/tasks/useTasks'
import { useGoalMutations, type GoalInput } from './useGoals'

export const GOAL_STATUS_OPTIONS: { value: Goal['status']; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Done' },
  { value: 'archived', label: 'Archived' },
]

export function GoalForm({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const navigate = useNavigate()
  const { data: categories } = useActiveCategories()
  const { data: tasks } = useTasks()
  const { create, update, remove } = useGoalMutations()

  const [title, setTitle] = useState(goal?.title ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [categoryId, setCategoryId] = useState(goal?.category_id ?? '')
  const [priority, setPriority] = useState<Priority>(goal?.priority ?? 'medium')
  const [status, setStatus] = useState<Goal['status']>(goal?.status ?? 'active')
  const [startDate, setStartDate] = useState(goal?.start_date ?? '')
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? '')
  const [mode, setMode] = useState<Goal['progress_mode']>(goal?.progress_mode ?? 'tasks')
  const [error, setError] = useState<string | null>(null)
  const busy = create.isPending || update.isPending

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return setError('Give the goal a title.')
    if (startDate && targetDate && targetDate < startDate) return setError('Target date is before the start date.')

    const values: GoalInput = {
      title: trimmed,
      description: description.trim() || null,
      category_id: categoryId || null,
      priority,
      status,
      start_date: startDate || null,
      target_date: targetDate || null,
      progress_mode: mode,
    }
    try {
      if (goal) {
        await update.mutateAsync({ id: goal.id, ...values })
        onClose()
      } else {
        const created = await create.mutateAsync(values)
        onClose()
        navigate(`/goals/${created.id}`)
      }
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Could not save.')
    }
  }

  function onDelete() {
    if (!goal) return
    const count = tasks?.filter((t) => t.goal_id === goal.id).length ?? 0
    const extra = count ? `\n\nIts ${count} task${count > 1 ? 's' : ''} will be deleted too.` : ''
    if (window.confirm(`Delete the goal "${goal.title}"? This cannot be undone.${extra}\n\nTip: archive it instead to keep its history.`)) {
      remove.mutate(goal.id)
      onClose()
      navigate('/goals')
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={goal ? 'Edit goal' : 'New goal'}
      footer={
        <>
          {goal && (
            <Button type="button" variant="ghost" size="icon" aria-label="Delete goal" onClick={onDelete}>
              <Trash2 />
            </Button>
          )}
          <div className="flex-1" />
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="goal-form" disabled={busy}>
            {busy ? 'Saving…' : goal ? 'Save' : 'Create goal'}
          </Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={onSubmit} className="space-y-4">
        <Field label="Goal" htmlFor="goal-title">
          <Input
            id="goal-title"
            autoFocus={!goal}
            placeholder="e.g. Run a half marathon"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Why it matters / details" htmlFor="goal-desc">
          <Textarea id="goal-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        {goal && (
          <Field label="Status">
            <Segmented value={status} onChange={setStatus} options={GOAL_STATUS_OPTIONS} />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="goal-category">
            <Select id="goal-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">No category</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Segmented value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Start date" htmlFor="goal-start">
            <Input id="goal-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Target date" htmlFor="goal-target">
            <Input id="goal-target" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </Field>
        </div>

        <Field
          label="Measure progress by"
          hint={mode === 'tasks' ? 'Percentage of this goal’s tasks that are done.' : 'You set the percentage yourself on the goal page.'}
        >
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'tasks', label: 'Tasks done' },
              { value: 'manual', label: 'Manual %' },
            ]}
          />
        </Field>

        {error && <p className="text-sm text-muted-foreground">⚠ {error}</p>}
      </form>
    </Dialog>
  )
}
