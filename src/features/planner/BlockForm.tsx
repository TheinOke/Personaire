import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Field } from '@/components/Field'
import { fromMinutes, toMinutes, trimSeconds } from '@/lib/dates'
import type { PlannerBlock } from '@/lib/types'
import { useActiveCategories } from '@/features/categories/useCategories'
import { useTasks } from '@/features/tasks/useTasks'
import { usePlannerMutations, type BlockInput } from './usePlanner'

export type BlockDefaults = Partial<Pick<BlockInput, 'block_date' | 'start_time' | 'end_time' | 'title' | 'task_id' | 'category_id'>>

export function BlockForm({
  block,
  defaults,
  onClose,
}: {
  block?: PlannerBlock
  defaults?: BlockDefaults
  onClose: () => void
}) {
  const { data: categories } = useActiveCategories()
  const { data: tasks } = useTasks()
  const { create, update, remove } = usePlannerMutations()

  const [title, setTitle] = useState(block?.title ?? defaults?.title ?? '')
  const [day, setDay] = useState(block?.block_date ?? defaults?.block_date ?? '')
  const [start, setStart] = useState(trimSeconds(block?.start_time ?? defaults?.start_time) || '09:00')
  const [end, setEnd] = useState(trimSeconds(block?.end_time ?? defaults?.end_time) || '10:00')
  const [taskId, setTaskId] = useState(block?.task_id ?? defaults?.task_id ?? '')
  const [categoryId, setCategoryId] = useState(block?.category_id ?? defaults?.category_id ?? '')
  const [notes, setNotes] = useState(block?.notes ?? '')
  const [done, setDone] = useState(block?.done ?? false)
  const [error, setError] = useState<string | null>(null)
  const busy = create.isPending || update.isPending

  const openTasks = (tasks ?? []).filter((t) => t.status !== 'done' || t.id === taskId)

  function onStartChange(value: string) {
    // Keep the same duration when the start moves.
    if (value && start && end) {
      const duration = toMinutes(end) - toMinutes(start)
      if (duration > 0) setEnd(fromMinutes(toMinutes(value) + duration))
    }
    setStart(value)
  }

  function onTaskChange(value: string) {
    setTaskId(value)
    const task = tasks?.find((t) => t.id === value)
    if (task && !title.trim()) setTitle(task.title)
    if (task?.category_id && !categoryId) setCategoryId(task.category_id)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return setError('Give the block a title.')
    if (!day) return setError('Pick a date.')
    if (!start || !end || toMinutes(end) <= toMinutes(start)) return setError('End time must be after the start time.')

    const values: BlockInput = {
      title: trimmed,
      block_date: day,
      start_time: start,
      end_time: end,
      task_id: taskId || null,
      category_id: categoryId || null,
      notes: notes.trim() || null,
      done,
    }
    try {
      if (block) await update.mutateAsync({ id: block.id, ...values })
      else await create.mutateAsync(values)
      onClose()
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Could not save.')
    }
  }

  function onDelete() {
    if (block && window.confirm(`Delete "${block.title}" from your plan?`)) {
      remove.mutate(block.id)
      onClose()
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={block ? 'Edit time block' : 'New time block'}
      footer={
        <>
          {block && (
            <Button type="button" variant="ghost" size="icon" aria-label="Delete block" onClick={onDelete}>
              <Trash2 />
            </Button>
          )}
          <div className="flex-1" />
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="block-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="block-form" onSubmit={onSubmit} className="space-y-4">
        <Field label="What" htmlFor="block-title">
          <Input
            id="block-title"
            autoFocus={!block}
            placeholder="e.g. Deep work, Gym, Study"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Date" htmlFor="block-date" className="col-span-2 sm:col-span-1">
            <Input id="block-date" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label="Start" htmlFor="block-start">
            <Input id="block-start" type="time" value={start} onChange={(e) => onStartChange(e.target.value)} />
          </Field>
          <Field label="End" htmlFor="block-end">
            <Input id="block-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Linked task" htmlFor="block-task" hint="Ticking the block also completes the task.">
            <Select id="block-task" value={taskId} onChange={(e) => onTaskChange(e.target.value)}>
              <option value="">None</option>
              {openTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category" htmlFor="block-category">
            <Select id="block-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">No category</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Notes" htmlFor="block-notes">
          <Textarea id="block-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {block && (
          <label className="flex items-center justify-between">
            <span className="text-sm">Done</span>
            <Switch checked={done} onCheckedChange={setDone} aria-label="Done" />
          </label>
        )}

        {error && <p className="text-sm text-muted-foreground">⚠ {error}</p>}
      </form>
    </Dialog>
  )
}
