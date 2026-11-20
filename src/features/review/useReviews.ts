import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addMonths, endOfMonth, format, parseISO, startOfMonth } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { addDaysISO, weekStartOf } from '@/lib/dates'
import type { Review } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'

const key = ['reviews'] as const

export type PeriodType = Review['period_type']

export interface Period {
  type: PeriodType
  start: string // yyyy-MM-dd, inclusive
  end: string // yyyy-MM-dd, inclusive
  label: string
}

export function periodFor(type: PeriodType, day: string, weekStart: 0 | 1): Period {
  if (type === 'week') {
    const start = weekStartOf(day, weekStart)
    const end = addDaysISO(start, 6)
    const s = parseISO(start)
    const e = parseISO(end)
    const label =
      s.getMonth() === e.getMonth()
        ? `${format(s, 'd')}–${format(e, 'd MMM yyyy')}`
        : `${format(s, 'd MMM')} – ${format(e, 'd MMM yyyy')}`
    return { type, start, end, label }
  }
  const m = startOfMonth(parseISO(day))
  return { type, start: format(m, 'yyyy-MM-dd'), end: format(endOfMonth(m), 'yyyy-MM-dd'), label: format(m, 'MMMM yyyy') }
}

/** The period before/after `p`. */
export function shiftPeriod(p: Period, by: number, weekStart: 0 | 1): Period {
  return p.type === 'week'
    ? periodFor('week', addDaysISO(p.start, 7 * by), weekStart)
    : periodFor('month', format(addMonths(parseISO(p.start), by), 'yyyy-MM-dd'), weekStart)
}

export function useReviews() {
  const { user } = useAuth()
  return useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await supabase.from('reviews').select('*').order('period_start', { ascending: false })
      if (error) throw error
      return data as Review[]
    },
  })
}

export type ReviewInput = Pick<Review, 'period_type' | 'period_start' | 'rating' | 'wins' | 'challenges' | 'lessons' | 'next_focus'>

export function useSaveReview() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: ReviewInput) => {
      const { data, error } = await supabase
        .from('reviews')
        .upsert({ user_id: user?.id, ...input }, { onConflict: 'user_id,period_type,period_start' })
        .select()
        .single()
      if (error) throw error
      return data as Review
    },
    onSuccess: (saved) =>
      qc.setQueryData<Review[]>(key, (list) => {
        const rest = (list ?? []).filter((r) => r.id !== saved.id)
        return [...rest, saved].sort((a, b) => b.period_start.localeCompare(a.period_start))
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}
