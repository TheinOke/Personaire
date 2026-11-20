import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MoneyCategory, MoneyKind, Transaction } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'

const catKey = ['money_categories'] as const
const txKey = ['transactions'] as const

export function useMoneyCategories() {
  const { user } = useAuth()
  return useQuery({
    queryKey: catKey,
    enabled: !!user,
    queryFn: async (): Promise<MoneyCategory[]> => {
      const { data, error } = await supabase.from('money_categories').select('*').order('sort_order').order('name')
      if (error) throw error
      return data as MoneyCategory[]
    },
  })
}

/** Transactions with occurred_on in [from, to] (inclusive, 'yyyy-MM-dd'). */
export function useTransactions(from: string, to: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...txKey, from, to],
    enabled: !!user,
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('occurred_on', from)
        .lte('occurred_on', to)
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Transaction[]
    },
  })
}

export type TxInput = {
  kind: MoneyKind
  amount: number
  occurred_on: string
  money_category_id: string | null
  note: string | null
}

export function useFinanceMutations() {
  const qc = useQueryClient()
  const invalidateTx = () => qc.invalidateQueries({ queryKey: txKey })
  const invalidateCats = () => qc.invalidateQueries({ queryKey: catKey })

  const saveTx = useMutation({
    mutationFn: async ({ id, ...values }: TxInput & { id?: string }) => {
      const { error } = id
        ? await supabase.from('transactions').update(values).eq('id', id)
        : await supabase.from('transactions').insert(values)
      if (error) throw error
    },
    onSettled: invalidateTx,
  })

  const removeTx = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: invalidateTx,
  })

  const saveCategory = useMutation({
    mutationFn: async ({ id, ...values }: Partial<MoneyCategory> & { id?: string }) => {
      if (id) {
        const { error } = await supabase.from('money_categories').update(values).eq('id', id)
        if (error) throw error
      } else {
        const list = qc.getQueryData<MoneyCategory[]>(catKey) ?? []
        const sort_order = list.filter((c) => c.kind === values.kind).reduce((m, c) => Math.max(m, c.sort_order), 0) + 1
        const { error } = await supabase.from('money_categories').insert({ ...values, sort_order })
        if (error) throw error
      }
    },
    onSettled: invalidateCats,
  })

  return { saveTx, removeTx, saveCategory }
}

export const amountOf = (t: Transaction) => Number(t.amount)
