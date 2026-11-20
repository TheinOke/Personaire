import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { addDaysISO, isoWeekday } from '@/lib/dates'
import type { Habit, HabitLog } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToday } from '@/features/settings/useToday'

const habitsKey = ['habits'] as const
const logsKey = ['habit_logs'] as const

/** How far back logs are loaded (enough for streaks and stats). */
export const LOG_WINDOW_DAYS = 400

export type HabitInput = Omit<Habit, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'sort_order' | 'start_date'> &
  Partial<Pick<Habit, 'start_date'>>
export type HabitPatch = Partial<Omit<Habit, 'user_id' | 'created_at' | 'updated_at'>> & { id: string }

export function useHabits() {
  const { user } = useAuth()
  return useQuery({
    queryKey: habitsKey,
    enabled: !!user,
    queryFn: async (): Promise<Habit[]> => {
      const { data, error } = await supabase.from('habits').select('*').order('sort_order').order('created_at')
      if (error) throw error
      return data as Habit[]
    },
  })
}

export function useHabitLogs() {
  const { user } = useAuth()
  const today = useToday()
  const since = addDaysISO(today, -LOG_WINDOW_DAYS)
  return useQuery({
    queryKey: [...logsKey, since],
    enabled: !!user,
    queryFn: async (): Promise<HabitLog[]> => {
      const { data, error } = await supabase.from('habit_logs').select('*').gte('log_date', since)
      if (error) throw error
      return data as HabitLog[]
    },
  })
}

/** Set of "habitId|yyyy-MM-dd" for fast lookups. */
export function logSet(logs: HabitLog[] | undefined) {
  return new Set((logs ?? []).map((l) => `${l.habit_id}|${l.log_date}`))
}

export function isDueOn(habit: Habit, day: string) {
  return day >= habit.start_date && habit.days_of_week.includes(isoWeekday(day))
}

/**
 * Current streak: consecutive *due* days completed, counting back from today.
 * If today is due but not done yet, the streak continues from yesterday.
 */
export function currentStreak(habit: Habit, done: Set<string>, today: string) {
  let streak = 0
  let day = today
  if (isDueOn(habit, day) && !done.has(`${habit.id}|${day}`)) day = addDaysISO(day, -1)
  for (let i = 0; i < LOG_WINDOW_DAYS && day >= habit.start_date; i++, day = addDaysISO(day, -1)) {
    if (!isDueOn(habit, day)) continue
    if (done.has(`${habit.id}|${day}`)) streak++
    else break
  }
  return streak
}

/** Longest run of completed due days in the loaded window. */
export function bestStreak(habit: Habit, done: Set<string>, today: string) {
  let best = 0
  let run = 0
  const from = [habit.start_date, addDaysISO(today, -LOG_WINDOW_DAYS)].sort()[1]
  for (let day = from; day <= today; day = addDaysISO(day, 1)) {
    if (!isDueOn(habit, day)) continue
    if (done.has(`${habit.id}|${day}`)) best = Math.max(best, ++run)
    else if (day !== today) run = 0
  }
  return best
}

/** Completion rate (0–100) over the last `days` days, counting only due days. */
export function completionRate(habit: Habit, done: Set<string>, today: string, days = 30) {
  let due = 0
  let hit = 0
  for (let i = 0; i < days; i++) {
    const day = addDaysISO(today, -i)
    if (!isDueOn(habit, day)) continue
    // Today only counts once it's done, so an unfinished morning doesn't lower the rate.
    const isDone = done.has(`${habit.id}|${day}`)
    if (day === today && !isDone) continue
    due++
    if (isDone) hit++
  }
  return due === 0 ? 0 : Math.round((100 * hit) / due)
}

export function useHabitMutations() {
  const qc = useQueryClient()
  const { user } = useAuth()

  const create = useMutation({
    mutationFn: async (input: HabitInput) => {
      const list = qc.getQueryData<Habit[]>(habitsKey) ?? []
      const sort_order = list.reduce((m, h) => Math.max(m, h.sort_order), 0) + 1
      const { error } = await supabase.from('habits').insert({ ...input, sort_order })
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: habitsKey }),
  })

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: HabitPatch) => {
      const { error } = await supabase.from('habits').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: habitsKey })
      const previous = qc.getQueryData<Habit[]>(habitsKey)
      qc.setQueryData<Habit[]>(habitsKey, (l) => l?.map((h) => (h.id === id ? { ...h, ...patch } : h)))
      return { previous }
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(habitsKey, ctx.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: habitsKey }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('habits').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: habitsKey })
      qc.invalidateQueries({ queryKey: logsKey })
    },
  })

  /** Mark a habit done / not done on a day. */
  const toggle = useMutation({
    mutationFn: async ({ habitId, day, done }: { habitId: string; day: string; done: boolean }) => {
      if (done) {
        const { error } = await supabase
          .from('habit_logs')
          .upsert({ habit_id: habitId, log_date: day }, { onConflict: 'habit_id,log_date', ignoreDuplicates: true })
        if (error) throw error
      } else {
        const { error } = await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('log_date', day)
        if (error) throw error
      }
    },
    onMutate: async ({ habitId, day, done }) => {
      await qc.cancelQueries({ queryKey: logsKey })
      const snapshots = qc.getQueriesData<HabitLog[]>({ queryKey: logsKey })
      for (const [key, list] of snapshots) {
        if (!list) continue
        const without = list.filter((l) => !(l.habit_id === habitId && l.log_date === day))
        qc.setQueryData(
          key,
          done
            ? [...without, { id: `tmp-${habitId}-${day}`, user_id: user?.id ?? '', habit_id: habitId, log_date: day, note: null, created_at: new Date().toISOString() }]
            : without,
        )
      }
      return { snapshots }
    },
    onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([key, list]) => qc.setQueryData(key, list)),
    onSettled: () => qc.invalidateQueries({ queryKey: logsKey }),
  })

  return { create, update, remove, toggle }
}
