import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'

export const tasksKey = ['tasks'] as const

export type TaskInput = Partial<Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'completed_at'>> & {
  title: string
}
export type TaskPatch = Partial<Omit<Task, 'user_id' | 'created_at' | 'updated_at'>> & { id: string }

/** All tasks. A personal app has few enough rows to load once and filter in the browser. */
export function useTasks() {
  const { user } = useAuth()
  return useQuery({
    queryKey: tasksKey,
    enabled: !!user,
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('sort_order')
        .order('created_at')
      if (error) throw error
      return data as Task[]
    },
  })
}

/** Ids of a task and all of its descendants. */
function withDescendants(id: string, tasks: Task[]): Set<string> {
  const ids = new Set([id])
  let grew = true
  while (grew) {
    grew = false
    for (const t of tasks) {
      if (t.parent_task_id && ids.has(t.parent_task_id) && !ids.has(t.id)) {
        ids.add(t.id)
        grew = true
      }
    }
  }
  return ids
}

export function useTaskMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: tasksKey })
  const snapshot = async () => {
    await qc.cancelQueries({ queryKey: tasksKey })
    return qc.getQueryData<Task[]>(tasksKey)
  }
  const rollback = (_e: unknown, _v: unknown, ctx?: { previous?: Task[] }) => {
    if (ctx?.previous) qc.setQueryData(tasksKey, ctx.previous)
  }

  const create = useMutation({
    mutationFn: async (input: TaskInput) => {
      const list = qc.getQueryData<Task[]>(tasksKey) ?? []
      const siblings = list.filter(
        (t) => t.parent_task_id === (input.parent_task_id ?? null) && t.goal_id === (input.goal_id ?? null),
      )
      const sort_order = siblings.reduce((max, t) => Math.max(max, t.sort_order), 0) + 1
      const { data, error } = await supabase
        .from('tasks')
        .insert({ sort_order, ...input })
        .select()
        .single()
      if (error) throw error
      return data as Task
    },
    onSuccess: (task) => qc.setQueryData<Task[]>(tasksKey, (list) => (list ? [...list, task] : [task])),
    onSettled: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: TaskPatch) => {
      const { error } = await supabase.from('tasks').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, ...patch }) => {
      const previous = await snapshot()
      qc.setQueryData<Task[]>(tasksKey, (list) =>
        list?.map((t) => {
          if (t.id !== id) return t
          const next = { ...t, ...patch }
          if (patch.status) next.completed_at = patch.status === 'done' ? (t.completed_at ?? new Date().toISOString()) : null
          return next
        }),
      )
      return { previous }
    },
    onError: rollback,
    onSettled: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      const previous = await snapshot()
      const gone = withDescendants(id, previous ?? [])
      qc.setQueryData<Task[]>(tasksKey, (list) => list?.filter((t) => !gone.has(t.id)))
      return { previous }
    },
    onError: rollback,
    onSettled: invalidate,
  })

  const toggle = (task: Task) => update.mutate({ id: task.id, status: task.status === 'done' ? 'todo' : 'done' })

  return { create, update, remove, toggle }
}
