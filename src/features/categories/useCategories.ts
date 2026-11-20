import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Category } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'

const key = ['categories'] as const

export function useCategories() {
  const { user } = useAuth()
  return useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order')
        .order('name')
      if (error) throw error
      return data as Category[]
    },
  })
}

/** Active (not archived) categories — for pickers in goals, tasks, habits. */
export function useActiveCategories() {
  const query = useCategories()
  return { ...query, data: query.data?.filter((c) => !c.archived) }
}

export function useCategoryMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: key })

  const create = useMutation({
    mutationFn: async (input: { name: string; icon: string }) => {
      const list = qc.getQueryData<Category[]>(key) ?? []
      const sort_order = list.reduce((max, c) => Math.max(max, c.sort_order), 0) + 1
      const { error } = await supabase.from('categories').insert({ ...input, sort_order })
      if (error) throw error
    },
    onSettled: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Category> & { id: string }) => {
      const { error } = await supabase.from('categories').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Category[]>(key)
      qc.setQueryData<Category[]>(key, (list) => list?.map((c) => (c.id === id ? { ...c, ...patch } : c)))
      return { previous }
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(key, ctx.previous),
    onSettled: invalidate,
  })

  /** Swap sort order with the neighbour above (-1) or below (+1). */
  const move = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: -1 | 1 }) => {
      const list = (qc.getQueryData<Category[]>(key) ?? []).filter((c) => !c.archived)
      const i = list.findIndex((c) => c.id === id)
      const j = i + direction
      if (i < 0 || j < 0 || j >= list.length) return
      // Renumber everything so equal sort_order values can't get stuck.
      const reordered = [...list]
      ;[reordered[i], reordered[j]] = [reordered[j], reordered[i]]
      qc.setQueryData<Category[]>(key, (all) =>
        all?.map((c) => {
          const idx = reordered.findIndex((r) => r.id === c.id)
          return idx >= 0 ? { ...c, sort_order: idx + 1 } : c
        }),
      )
      const results = await Promise.all(
        reordered.map((c, idx) =>
          supabase.from('categories').update({ sort_order: idx + 1 }).eq('id', c.id),
        ),
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
    },
    onSettled: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: invalidate,
  })

  return { create, update, move, remove }
}
