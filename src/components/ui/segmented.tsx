import { cn } from '@/lib/utils'

/** A small row of mutually exclusive buttons, e.g. 12h | 24h. */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <div className="inline-flex rounded-md border p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[5px] px-3 py-1.5 text-sm text-muted-foreground transition-colors disabled:opacity-50',
            o.value === value && 'bg-primary text-primary-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
