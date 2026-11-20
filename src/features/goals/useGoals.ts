import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Goal, Task } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'
import { tasksKey } from '@/features/tasks/useTasks'

export const goalsKey = ['goals'] as const

export type GoalInput = Partial<Omit<Goal, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'completed_at'>> & {
  title: string
}
export type GoalPatch = Partial<Omit<Goal, 'user_id' | 'created_at' | 'updated_at'>> & { id: string }

export function useGoals() {
  const { user } = useAuth()
  return useQuery({
    queryKey: goalsKey,
    enabled: !!user,
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await supabase.from('goals').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data as Goal[]
    },
  })
}

export interface GoalProgress {
  total: number
  done: number
  percent: number
}

/**
 * Progress of a goal. Calculated in the browser from the loaded tasks so it
 * updates instantly when a task is ticked off. (Same rules as the
 * `goal_progress` view in the database.)
 */
export function goalProgress(goal: Goal, tasks: Task[] | undefined): GoalProgress {
  const own = (tasks ?? []).filter((t) => t.goal_id === goal.id)
  const done = own.filter((t) => t.status === 'done').length
  const total = own.length
  let percent: number
  if (goal.status === 'completed') percent = 100
  else if (goal.progress_mode === 'manual') percent = goal.manual_progress
  else percent = total === 0 ? 0 : Math.round((100 * done) / total)
  return { total, done, percent }
}

export function useGoalMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: goalsKey })

  const create = useMutation({
    mutationFn: async (input: GoalInput) => {
      const { data, error } = await supabase.from('goals').insert(input).select().single()
      if (error) throw error
      return data as Goal
    },
    onSuccess: (goal) => qc.setQueryData<Goal[]>(goalsKey, (list) => (list ? [goal, ...list] : [goal])),
    onSettled: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: GoalPatch) => {
      const { error } = await supabase.from('goals').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: goalsKey })
      const previous = qc.getQueryData<Goal[]>(goalsKey)
      qc.setQueryData<Goal[]>(goalsKey, (list) => list?.map((g) => (g.id === id ? { ...g, ...patch } : g)))
      return { previous }
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(goalsKey, ctx.previous),
    onSettled: invalidate,
  })

  /** Deleting a goal also deletes its tasks (ON DELETE CASCADE). */
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('goals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, id) => {
      qc.setQueryData<Goal[]>(goalsKey, (list) => list?.filter((g) => g.id !== id))
      qc.setQueryData<Task[]>(tasksKey, (list) => list?.filter((t) => t.goal_id !== id))
    },
    onSettled: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: tasksKey })
    },
  })

  return { create, update, remove }
}
