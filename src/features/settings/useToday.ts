import { todayIn } from '@/lib/dates'
import { deviceTimezone, useSettings } from './useSettings'

/** The user's timezone (from Settings, falling back to the device). */
export function useTimezone() {
  const { data } = useSettings()
  return data?.timezone ?? deviceTimezone()
}

/** Today's date ('yyyy-MM-dd') in the user's timezone. */
export function useToday() {
  return todayIn(useTimezone())
}
