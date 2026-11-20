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

/** "HH:mm" or "HH:mm:ss" → minutes since midnight. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** Minutes since midnight → "HH:mm" (clamped to 00:00–23:59). */
export function fromMinutes(total: number): string {
  const t = Math.max(0, Math.min(23 * 60 + 59, Math.round(total)))
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** ISO weekday of a 'yyyy-MM-dd' day: 1 = Monday … 7 = Sunday. */
export function isoWeekday(day: ISODate): number {
  const d = parseISO(day).getDay()
  return d === 0 ? 7 : d
}

/** First day of the week containing `day`. weekStart: 1 = Monday, 0 = Sunday. */
export function weekStartOf(day: ISODate, weekStart: 0 | 1): ISODate {
  const dow = parseISO(day).getDay() // 0 = Sunday
  const back = (dow - weekStart + 7) % 7
  return addDaysISO(day, -back)
}
