import { format as fmt, parseISO } from 'date-fns'
import type { Settings } from './types'

/** Date formats offered in Settings (date-fns tokens). */
export const DATE_FORMATS = [
  { value: 'dd/MM/yyyy', label: '21/11/2026' },
  { value: 'MM/dd/yyyy', label: '11/21/2026' },
  { value: 'yyyy-MM-dd', label: '2026-11-21' },
  { value: 'd MMM yyyy', label: '21 Nov 2026' },
  { value: 'MMM d, yyyy', label: 'Nov 21, 2026' },
] as const

type FormatPrefs = Pick<Settings, 'time_format' | 'date_format'> | undefined

function toDate(value: Date | string) {
  return typeof value === 'string' ? parseISO(value) : value
}

export function formatDate(value: Date | string, prefs: FormatPrefs) {
  return fmt(toDate(value), prefs?.date_format ?? 'dd/MM/yyyy')
}

export function formatTime(value: Date | string, prefs: FormatPrefs) {
  return fmt(toDate(value), prefs?.time_format === '12h' ? 'h:mm a' : 'HH:mm')
}

/** Format a Postgres `time` value like "14:30:00". */
export function formatClock(time: string, prefs: FormatPrefs) {
  const [h, m] = time.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return formatTime(d, prefs)
}
