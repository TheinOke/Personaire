import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TimeEntry } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'

export const timeKey = ['time_entries'] as const
const runningKey = [...timeKey, 'running'] as const

export type EntryInput = Partial<Omit<TimeEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>> & {
  started_at: string
}

/** The timer that is currently running (or null). */
export function useRunningEntry() {
  const { user } = useAuth()
  return useQuery({
    queryKey: runningKey,
    enabled: !!user,
    queryFn: async (): Promise<TimeEntry | null> => {
      const { data, error } = await supabase.from('time_entries').select('*').is('ended_at', null).maybeSingle()
      if (error) throw error
      return (data as TimeEntry) ?? null
    },
  })
}

/** Entries started at or after `sinceISO` (newest first). */
export function useEntriesSince(sinceISO: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...timeKey, 'since', sinceISO],
    enabled: !!user,
    queryFn: async (): Promise<TimeEntry[]> => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .gte('started_at', sinceISO)
        .order('started_at', { ascending: false })
      if (error) throw error
      return data as TimeEntry[]
    },
  })
}

/** Seconds an entry has lasted (so far, if still running). */
export function entrySeconds(e: TimeEntry, nowMs = Date.now()) {
  const end = e.ended_at ? new Date(e.ended_at).getTime() : nowMs
  return Math.max(0, Math.round((end - new Date(e.started_at).getTime()) / 1000))
}

/** "1h 05m", "25m", "<1m" */
export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  if (m < 1) return seconds > 0 ? '<1m' : '0m'
  const h = Math.floor(m / 60)
  return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`
}

/** "24:59" or "1:02:03" */
export function formatTimer(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Re-render every `ms` milliseconds while `active`. */
export function useNow(ms = 1000, active = true) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms, active])
  return now
}

export function useTimeMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: timeKey })

  /** End a running entry (at its planned end if that has already passed). */
  async function close(entry: TimeEntry, at = new Date()) {
    const planned = entry.planned_end_at ? new Date(entry.planned_end_at) : null
    const end = planned && planned < at ? planned : at
    const { error } = await supabase
      .from('time_entries')
      .update({ ended_at: end.toISOString() })
      .eq('id', entry.id)
      .is('ended_at', null)
    if (error) throw error
  }

  const start = useMutation({
    mutationFn: async (input: Omit<EntryInput, 'started_at'> & { started_at?: string }) => {
      const running = qc.getQueryData<TimeEntry | null>(runningKey)
      if (running) await close(running)
      const { data, error } = await supabase
        .from('time_entries')
        .insert({ started_at: new Date().toISOString(), ...input, ended_at: null })
        .select()
        .single()
      if (error) throw error
      return data as TimeEntry
    },
    onSuccess: (entry) => qc.setQueryData(runningKey, entry),
    onSettled: invalidate,
  })

  const stop = useMutation({
    mutationFn: async ({ entry, at }: { entry: TimeEntry; at?: Date }) => close(entry, at),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: runningKey })
      const previous = qc.getQueryData<TimeEntry | null>(runningKey)
      qc.setQueryData(runningKey, null)
      return { previous }
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(runningKey, ctx.previous),
    onSettled: invalidate,
  })

  const save = useMutation({
    mutationFn: async ({ id, ...values }: EntryInput & { id?: string }) => {
      const { error } = id
        ? await supabase.from('time_entries').update(values).eq('id', id)
        : await supabase.from('time_entries').insert({ source: 'manual', kind: 'focus', ...values })
      if (error) throw error
    },
    onSettled: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('time_entries').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: invalidate,
  })

  return { start, stop, save, remove }
}
