import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { TZDate } from '@date-fns/tz'

/** All "day" values in the app are 'yyyy-MM-dd' strings in the user's timezone. */
export type ISODate = string

/** Today's date in the given IANA timezone. */
export function todayIn(tz: string): ISODate {
  return format(TZDate.tz(tz), 'yyyy-MM-dd')
}

export function addDaysISO(day: ISODate, n: number): ISODate {
  return format(addDays(parseISO(day), n), 'yyyy-MM-dd')
}

export function daysBetween(from: ISODate, to: ISODate) {
  return differenceInCalendarDays(parseISO(to), parseISO(from))
}

/** Wall-clock date + time in `tz` → UTC ISO timestamp. */
export function toInstant(day: ISODate, time: string, tz: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  return new TZDate(y, m - 1, d, h, min, 0, tz).toISOString()
}

/** UTC timestamp → wall-clock { day, time } in `tz`. */
export function fromInstant(iso: string, tz: string): { day: ISODate; time: string } {
  const d = new TZDate(iso, tz)
  return { day: format(d, 'yyyy-MM-dd'), time: format(d, 'HH:mm') }
}

/** "HH:mm:ss" from Postgres → "HH:mm" for <input type="time">. */
export function trimSeconds(time: string | null | undefined) {
  return time ? time.slice(0, 5) : ''
}

/** "Today", "Tomorrow", "Yesterday", weekday within a week, else a formatted date. */
export function dayLabel(day: ISODate, today: ISODate, dateFormat = 'd MMM yyyy') {
  const diff = daysBetween(today, day)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff < 7) return format(parseISO(day), 'EEEE')
  return format(parseISO(day), dateFormat)
}
