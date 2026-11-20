import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Settings } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthProvider'

const key = ['settings'] as const

export function deviceTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function useSettings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async (): Promise<Settings> => {
      const { data, error } = await supabase.from('settings').select('*').maybeSingle()
      if (error) throw error
      if (data) return data as Settings
      // Safety net: create the row if the sign-up trigger didn't.
      const { data: created, error: insertError } = await supabase
        .from('settings')
        .insert({ user_id: user!.id, timezone: deviceTimezone() })
        .select()
        .single()
      if (insertError) throw insertError
      return created as Settings
    },
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<Omit<Settings, 'user_id' | 'created_at' | 'updated_at'>>) => {
      const { data, error } = await supabase.from('settings').update(patch).select().single()
      if (error) throw error
      return data as Settings
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Settings>(key)
      if (previous) qc.setQueryData<Settings>(key, { ...previous, ...patch })
      return { previous }
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
    },
    onSuccess: (data) => qc.setQueryData(key, data),
  })
}

/**
 * New accounts start on UTC. The first time the app loads, switch to the
 * device's timezone (only if the settings were never edited).
 */
export function useAutoTimezone() {
  const { data } = useSettings()
  const update = useUpdateSettings()
  useEffect(() => {
    if (!data) return
    const neverEdited = data.created_at === data.updated_at
    const device = deviceTimezone()
    if (neverEdited && data.timezone === 'UTC' && device && device !== 'UTC') {
      update.mutate({ timezone: device })
    }
    // Run once per signed-in user, not on every settings change.
  }, [data?.user_id])
}
