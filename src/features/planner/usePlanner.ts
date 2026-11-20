import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { addDaysISO } from '@/lib/dates'
import type { PlannerBlock } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'
import { tasksKey } from '@/features/tasks/useTasks'

const plannerKey = ['planner'] as const

export type BlockInput = Omit<PlannerBlock, 'id' | 'user_id' | 'created_at' | 'updated_at'>
export type BlockPatch = Partial<BlockInput> & { id: string }

/** All blocks in the 7 days starting at `weekStart`. */
export function useWeekBlocks(weekStart: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...plannerKey, weekStart],
    enabled: !!user,
    queryFn: async (): Promise<PlannerBlock[]> => {
      const { data, error } = await supabase
        .from('planner_blocks')
        .select('*')
        .gte('block_date', weekStart)
        .lte('block_date', addDaysISO(weekStart, 6))
        .order('start_time')
      if (error) throw error
      return data as PlannerBlock[]
    },
  })
}

export function usePlannerMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: plannerKey })

  /** Apply a change to every cached week optimistically. */
  const patchCache = (fn: (list: PlannerBlock[]) => PlannerBlock[]) => {
    const snapshots = qc.getQueriesData<PlannerBlock[]>({ queryKey: plannerKey })
    for (const [key, list] of snapshots) if (list) qc.setQueryData(key, fn(list))
    return snapshots
  }
  const restore = (_e: unknown, _v: unknown, ctx?: { snapshots: [readonly unknown[], PlannerBlock[] | undefined][] }) => {
    ctx?.snapshots.forEach(([key, list]) => qc.setQueryData(key, list))
  }

  const create = useMutation({
    mutationFn: async (input: BlockInput) => {
      const { data, error } = await supabase.from('planner_blocks').insert(input).select().single()
      if (error) throw error
      return data as PlannerBlock
    },
    onSettled: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: BlockPatch) => {
      const { error } = await supabase.from('planner_blocks').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: plannerKey })
      return { snapshots: patchCache((list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b))) }
    },
    onError: restore,
    onSettled: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('planner_blocks').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: plannerKey })
      return { snapshots: patchCache((list) => list.filter((b) => b.id !== id)) }
    },
    onError: restore,
    onSettled: invalidate,
  })

  /** Tick a block; ticking a block that is linked to a task completes the task too. */
  const toggleDone = (block: PlannerBlock) => {
    const done = !block.done
    update.mutate(
      { id: block.id, done },
      {
        onSuccess: async () => {
          if (done && block.task_id) {
            await supabase.from('tasks').update({ status: 'done' }).eq('id', block.task_id)
            qc.invalidateQueries({ queryKey: tasksKey })
          }
        },
      },
    )
  }

  return { create, update, remove, toggleDone }
}
