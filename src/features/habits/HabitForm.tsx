import { useState, type FormEvent } from 'react'
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Field } from '@/components/Field'
import { cn } from '@/lib/utils'
import { trimSeconds } from '@/lib/dates'
import type { Habit } from '@/lib/types'
import { useActiveCategories } from '@/features/categories/useCategories'
import { useSettings } from '@/features/settings/useSettings'
import { useHabitMutations } from './useHabits'

const WEEKDAYS = [
  { iso: 1, short: 'M', label: 'Monday' },
  { iso: 2, short: 'T', label: 'Tuesday' },
  { iso: 3, short: 'W', label: 'Wednesday' },
  { iso: 4, short: 'T', label: 'Thursday' },
  { iso: 5, short: 'F', label: 'Friday' },
  { iso: 6, short: 'S', label: 'Saturday' },
  { iso: 7, short: 'S', label: 'Sunday' },
]

const PRESETS = [
  { label: 'Every day', days: [1, 2, 3, 4, 5, 6, 7] },
  { label: 'Weekdays', days: [1, 2, 3, 4, 5] },
  { label: 'Weekends', days: [6, 7] },
]

export function HabitForm({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const { data: categories } = useActiveCategories()
  const { data: settings } = useSettings()
  const { create, update, remove } = useHabitMutations()

  const [name, setName] = useState(habit?.name ?? '')
  const [description, setDescription] = useState(habit?.description ?? '')
  const [categoryId, setCategoryId] = useState(habit?.category_id ?? '')
  const [days, setDays] = useState<number[]>(habit?.days_of_week ?? [1, 2, 3, 4, 5, 6, 7])
  const [reminder, setReminder] = useState(trimSeconds(habit?.reminder_time))
  const [error, setError] = useState<string | null>(null)
  const busy = create.isPending || update.isPending

  // Show weekday chips in the user's week order.
  const ordered = settings?.week_start === 0 ? [WEEKDAYS[6], ...WEEKDAYS.slice(0, 6)] : WEEKDAYS

  const toggleDay = (iso: number) =>
    setDays((d) => (d.includes(iso) ? d.filter((x) => x !== iso) : [...d, iso].sort()))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Give the habit a name.')
    if (days.length === 0) return setError('Pick at least one day.')
    const values = {
      name: trimmed,
      description: description.trim() || null,
      category_id: categoryId || null,
      days_of_week: days,
      reminder_time: reminder || null,
      archived: habit?.archived ?? false,
    }
    try {
      if (habit) await update.mutateAsync({ id: habit.id, ...values })
      else await create.mutateAsync(values)
      onClose()
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Could not save.')
    }
  }

  function onDelete() {
    if (habit && window.confirm(`Delete "${habit.name}" and its whole history? This cannot be undone.\n\nTip: archive it instead to keep the history.`)) {
      remove.mutate(habit.id)
      onClose()
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={habit ? 'Edit habit' : 'New habit'}
      footer={
        <>
          {habit && (
            <>
              <Button type="button" variant="ghost" size="icon" aria-label="Delete habit" onClick={onDelete}>
                <Trash2 />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={habit.archived ? 'Restore habit' : 'Archive habit'}
                onClick={() => {
                  update.mutate({ id: habit.id, archived: !habit.archived })
                  onClose()
                }}
              >
                {habit.archived ? <ArchiveRestore /> : <Archive />}
              </Button>
            </>
          )}
          <div className="flex-1" />
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="habit-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="habit-form" onSubmit={onSubmit} className="space-y-4">
        <Field label="Habit" htmlFor="habit-name">
          <Input
            id="habit-name"
            autoFocus={!habit}
            placeholder="e.g. Read 20 pages, Meditate, Drink 2L water"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Repeat on">
          <div className="flex gap-1.5">
            {ordered.map((d) => (
              <button
                key={d.iso}
                type="button"
                aria-label={d.label}
                aria-pressed={days.includes(d.iso)}
                onClick={() => toggleDay(d.iso)}
                className={cn(
                  'flex size-9 items-center justify-center rounded-full border text-sm',
                  days.includes(d.iso) ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
                )}
              >
                {d.short}
              </button>
            ))}
          </div>
          <div className="flex gap-3 pt-1">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" className="text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={() => setDays(p.days)}>
                {p.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="habit-category">
            <Select id="habit-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">No category</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reminder time" htmlFor="habit-reminder" hint="Optional. Push reminders arrive in a later step.">
            <Input id="habit-reminder" type="time" value={reminder} onChange={(e) => setReminder(e.target.value)} />
          </Field>
        </div>

        <Field label="Notes" htmlFor="habit-desc">
          <Textarea id="habit-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        {error && <p className="text-sm text-muted-foreground">⚠ {error}</p>}
      </form>
    </Dialog>
  )
}
