import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/Field'
import { fromInstant, toInstant } from '@/lib/dates'
import type { TimeEntry } from '@/lib/types'
import { useActiveCategories } from '@/features/categories/useCategories'
import { useTimezone, useToday } from '@/features/settings/useToday'
import { useTasks } from '@/features/tasks/useTasks'
import { entrySeconds, useTimeMutations } from './useTime'

/** Add time by hand, or edit / delete a logged entry. */
export function EntryForm({ entry, onClose }: { entry?: TimeEntry; onClose: () => void }) {
  const tz = useTimezone()
  const today = useToday()
  const { data: tasks } = useTasks()
  const { data: categories } = useActiveCategories()
  const { save, remove } = useTimeMutations()

  const startLocal = entry ? fromInstant(entry.started_at, tz) : null
  const [day, setDay] = useState(startLocal?.day ?? today)
  const [time, setTime] = useState(startLocal?.time ?? '09:00')
  const [minutes, setMinutes] = useState(entry ? String(Math.max(1, Math.round(entrySeconds(entry) / 60))) : '30')
  const [taskId, setTaskId] = useState(entry?.task_id ?? '')
  const [categoryId, setCategoryId] = useState(entry?.category_id ?? '')
  const [note, setNote] = useState(entry?.note ?? '')
  const [error, setError] = useState<string | null>(null)

  const taskOptions = (tasks ?? []).filter((t) => t.status !== 'done' || t.id === taskId)
  const running = entry && !entry.ended_at

  function onTaskChange(id: string) {
    setTaskId(id)
    const task = tasks?.find((t) => t.id === id)
    if (task?.category_id) setCategoryId(task.category_id)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const mins = Math.round(Number(minutes))
    if (!day || !time) return setError('Pick a date and start time.')
    if (!running && (!mins || mins < 1 || mins > 24 * 60)) return setError('Duration must be between 1 minute and 24 hours.')
    const started = new Date(toInstant(day, time, tz))
    const task = tasks?.find((t) => t.id === taskId)
    try {
      await save.mutateAsync({
        id: entry?.id,
        started_at: started.toISOString(),
        // A running timer keeps running; everything else gets its end from the duration.
        ...(running ? {} : { ended_at: new Date(started.getTime() + mins * 60000).toISOString() }),
        task_id: taskId || null,
        goal_id: task?.goal_id ?? null,
        category_id: categoryId || null,
        note: note.trim() || null,
      })
      onClose()
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Could not save.')
    }
  }

  function onDelete() {
    if (entry && window.confirm('Delete this time entry?')) {
      remove.mutate(entry.id)
      onClose()
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={entry ? 'Edit time' : 'Add time'}
      footer={
        <>
          {entry && (
            <Button type="button" variant="ghost" size="icon" aria-label="Delete entry" onClick={onDelete}>
              <Trash2 />
            </Button>
          )}
          <div className="flex-1" />
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="entry-form" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="entry-form" onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Date" htmlFor="entry-day" className="col-span-2 sm:col-span-1">
            <Input id="entry-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label="Start" htmlFor="entry-time">
            <Input id="entry-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Minutes" htmlFor="entry-min">
            <Input
              id="entry-min"
              type="number"
              inputMode="numeric"
              min={1}
              disabled={!!running}
              value={running ? '' : minutes}
              placeholder={running ? 'Running' : undefined}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Task" htmlFor="entry-task">
          <Select id="entry-task" value={taskId} onChange={(e) => onTaskChange(e.target.value)}>
            <option value="">No task</option>
            {taskOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category" htmlFor="entry-category">
          <Select id="entry-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">No category</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note" htmlFor="entry-note">
          <Textarea id="entry-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" />
        </Field>
        {error && <p className="text-sm text-muted-foreground">⚠ {error}</p>}
      </form>
    </Dialog>
  )
}
