import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useTaskMutations, type TaskInput } from './useTasks'

/** One-line "type and press Enter" task creator. */
export function QuickAdd({
  defaults,
  placeholder = 'Add a task…',
}: {
  defaults?: Omit<TaskInput, 'title'>
  placeholder?: string
}) {
  const [title, setTitle] = useState('')
  const { create } = useTaskMutations()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    create.mutate({ ...defaults, title: trimmed })
    setTitle('')
  }

  return (
    <form onSubmit={onSubmit} className="relative">
      <Plus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        maxLength={300}
        enterKeyHint="done"
        className="pl-9"
        aria-label={placeholder}
      />
      {create.isError && <p className="mt-1 text-xs text-muted-foreground">⚠ {create.error.message}</p>}
    </form>
  )
}
