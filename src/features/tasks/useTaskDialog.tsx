import { useState } from 'react'
import type { Task } from '@/lib/types'
import { TaskForm } from './TaskForm'

type Defaults = Parameters<typeof TaskForm>[0]['defaults']

/** State + element for the create/edit task dialog. Render `dialog` once per page. */
export function useTaskDialog() {
  const [state, setState] = useState<{ task?: Task; defaults?: Defaults; n: number } | null>(null)

  const dialog = state ? (
    <TaskForm
      key={state.task?.id ?? `new-${state.n}`}
      open
      onClose={() => setState(null)}
      task={state.task}
      defaults={state.defaults}
    />
  ) : null

  return {
    dialog,
    edit: (task: Task) => setState({ task, n: Date.now() }),
    create: (defaults?: Defaults) => setState({ defaults, n: Date.now() }),
  }
}
