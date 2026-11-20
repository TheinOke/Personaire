import { Link, useLocation } from 'react-router'
import { Coffee, Timer } from 'lucide-react'
import { entrySeconds, formatTimer, useNow, useRunningEntry } from './useTime'

/** Small floating indicator of the running timer, shown on every page except Focus. */
export function TimerPill() {
  const { data: running } = useRunningEntry()
  const { pathname } = useLocation()
  const now = useNow(1000, !!running)
  if (!running || pathname === '/focus') return null

  const remaining = running.planned_end_at
    ? Math.max(0, Math.round((new Date(running.planned_end_at).getTime() - now) / 1000))
    : null
  const Icon = running.kind === 'break' ? Coffee : Timer

  return (
    <Link
      to="/focus"
      className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-sm shadow-lg md:bottom-6 md:right-6"
      aria-label="Open running timer"
    >
      <span className="size-2 animate-pulse rounded-full bg-foreground" />
      <Icon className="size-4" />
      <span className="tabular-nums">{formatTimer(remaining ?? entrySeconds(running, now))}</span>
    </Link>
  )
}
