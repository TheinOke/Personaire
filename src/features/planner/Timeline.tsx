import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fromMinutes, toMinutes } from '@/lib/dates'
import { formatClock } from '@/lib/format'
import type { PlannerBlock, Settings } from '@/lib/types'
import { categoryIcon } from '@/features/categories/icons'
import { useCategories } from '@/features/categories/useCategories'

const HOUR_PX = 60

interface Placed {
  block: PlannerBlock
  start: number
  end: number
  col: number
  cols: number
}

/** Lay out overlapping blocks side by side. */
function layout(blocks: PlannerBlock[]): Placed[] {
  const items = blocks
    .map((block) => ({ block, start: toMinutes(block.start_time), end: toMinutes(block.end_time), col: 0, cols: 1 }))
    .sort((a, b) => a.start - b.start || b.end - a.end)

  let cluster: Placed[] = []
  let clusterEnd = -1
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((p) => p.col + 1))
    cluster.forEach((p) => (p.cols = cols))
    cluster = []
  }
  for (const item of items) {
    if (item.start >= clusterEnd) flush()
    const taken = new Set(cluster.filter((p) => p.end > item.start).map((p) => p.col))
    let col = 0
    while (taken.has(col)) col++
    item.col = col
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.end)
  }
  flush()
  return items
}

export function Timeline({
  blocks,
  settings,
  nowMinutes,
  onSelect,
  onCreateAt,
  onToggle,
}: {
  blocks: PlannerBlock[]
  settings: Pick<Settings, 'time_format' | 'date_format'> | undefined
  /** Minutes since midnight to draw the "now" line, or null when not viewing today. */
  nowMinutes: number | null
  onSelect: (block: PlannerBlock) => void
  onCreateAt: (startTime: string) => void
  onToggle: (block: PlannerBlock) => void
}) {
  const { data: categories } = useCategories()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Show 06:00–23:00 by default, widened to fit any earlier/later blocks.
  const firstHour = Math.min(6, ...blocks.map((b) => Math.floor(toMinutes(b.start_time) / 60)))
  const lastHour = Math.max(23, ...blocks.map((b) => Math.ceil(toMinutes(b.end_time) / 60)))
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i)
  const top = (minutes: number) => ((minutes - firstHour * 60) / 60) * HOUR_PX

  // Scroll to the current time (or the first block) on open.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = nowMinutes ?? (blocks.length ? Math.min(...blocks.map((b) => toMinutes(b.start_time))) : 8 * 60)
    el.scrollTop = Math.max(0, top(target) - 80)
    // Only on first render — don't jump around while the user scrolls.
  }, [])

  return (
    <div ref={scrollRef} className="max-h-[65dvh] overflow-y-auto rounded-lg border">
      <div className="relative" style={{ height: hours.length * HOUR_PX }}>
        {hours.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => onCreateAt(fromMinutes(h * 60))}
            aria-label={`Add block at ${formatClock(fromMinutes(h * 60), settings)}`}
            className="absolute inset-x-0 flex border-t text-left hover:bg-accent/30"
            style={{ top: top(h * 60), height: HOUR_PX }}
          >
            <span className="w-16 shrink-0 -translate-y-2 bg-background pl-2 text-[11px] text-muted-foreground">
              {h <= 23 ? formatClock(fromMinutes(h * 60), settings) : ''}
            </span>
          </button>
        ))}

        {layout(blocks).map(({ block, start, end, col, cols }) => {
          const category = categories?.find((c) => c.id === block.category_id)
          const Icon = categoryIcon(category?.icon)
          const height = Math.max(24, top(end) - top(start) - 2)
          return (
            <div
              key={block.id}
              className="absolute pr-1"
              style={{
                top: top(start) + 1,
                height,
                left: `calc(4rem + (100% - 4rem) * ${col / cols})`,
                width: `calc((100% - 4rem) / ${cols})`,
              }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(block)}
                onKeyDown={(e) => e.key === 'Enter' && onSelect(block)}
                className={cn(
                  'flex h-full cursor-pointer gap-2 overflow-hidden rounded-md border px-2 py-1 text-xs',
                  block.done ? 'border-border bg-muted text-muted-foreground' : 'border-foreground/40 bg-secondary',
                )}
              >
                <button
                  type="button"
                  aria-label={block.done ? `Mark "${block.title}" not done` : `Mark "${block.title}" done`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggle(block)
                  }}
                  className={cn(
                    'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                    block.done ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground',
                  )}
                >
                  {block.done && <Check className="size-2.5" strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate font-medium', block.done && 'line-through')}>{block.title}</p>
                  {height > 36 && (
                    <p className="flex items-center gap-1 truncate text-muted-foreground">
                      {formatClock(block.start_time, settings)}–{formatClock(block.end_time, settings)}
                      {category && <Icon className="ml-1 size-3 shrink-0" />}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {nowMinutes !== null && nowMinutes >= firstHour * 60 && nowMinutes <= (lastHour + 1) * 60 && (
          <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: top(nowMinutes) }}>
            <span className="ml-14 size-2 rounded-full bg-foreground" />
            <span className="h-px flex-1 bg-foreground" />
          </div>
        )}
      </div>
    </div>
  )
}
