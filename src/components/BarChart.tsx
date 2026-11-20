import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface Bar {
  key: string
  /** Value used for height; null = no data (drawn as a faint stub). */
  value: number | null
  /** Short label under the bar (shown only for some bars to avoid crowding). */
  label?: string
  /** Full text for the tooltip and screen readers. */
  title: string
}

/**
 * Minimal single-series column chart. Monochrome, 4px rounded tops anchored
 * to the baseline, 2px gaps, tooltip on hover/tap. One series → no legend;
 * the card title names it.
 */
export function BarChart({
  bars,
  max: maxProp,
  height = 140,
  formatValue = (v) => String(v),
  labelEvery = 1,
}: {
  bars: Bar[]
  max?: number
  height?: number
  formatValue?: (v: number) => string
  labelEvery?: number
}) {
  const [active, setActive] = useState<string | null>(null)
  const max = Math.max(1, maxProp ?? Math.max(0, ...bars.map((b) => b.value ?? 0)))
  const activeBar = bars.find((b) => b.key === active)

  return (
    <div className="relative">
      {/* Tooltip */}
      <div className="mb-2 h-5 text-xs text-muted-foreground" aria-live="polite">
        {activeBar ? (
          <span>
            <span className="font-medium text-foreground">{activeBar.value === null ? '—' : formatValue(activeBar.value)}</span>
            {' · '}
            {activeBar.title}
          </span>
        ) : (
          <span>Max {formatValue(max)}</span>
        )}
      </div>

      <div className="relative" style={{ height }}>
        {/* Recessive gridlines at 0 / 50% / 100% */}
        {[0, 0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-border/60" style={{ bottom: f * height }} />
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px]" role="list" onMouseLeave={() => setActive(null)}>
          {bars.map((b) => {
            const h = b.value === null ? 2 : Math.max(b.value > 0 ? 3 : 0, (b.value / max) * height)
            return (
              <button
                key={b.key}
                type="button"
                role="listitem"
                aria-label={`${b.title}: ${b.value === null ? 'no data' : formatValue(b.value)}`}
                onMouseEnter={() => setActive(b.key)}
                onFocus={() => setActive(b.key)}
                onClick={() => setActive((a) => (a === b.key ? null : b.key))}
                className="group flex h-full min-w-0 flex-1 items-end"
              >
                <span
                  className={cn(
                    'block w-full rounded-t-[4px] transition-opacity',
                    b.value === null ? 'bg-border' : 'bg-primary',
                    active && active !== b.key && 'opacity-40',
                  )}
                  style={{ height: h }}
                />
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-1.5 flex gap-[2px]" aria-hidden>
        {bars.map((b, i) => (
          <span key={b.key} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground">
            {i % labelEvery === 0 || i === bars.length - 1 ? b.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
