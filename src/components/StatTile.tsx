import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Card } from '@/components/ui/card'

/** Headline number with a label and a small supporting line. */
export function StatTile({
  label,
  value,
  sub,
  to,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  to?: string
}) {
  const body = (
    <Card className="h-full p-4 transition-colors hover:bg-accent/40">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  )
  return to ? (
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
  )
}
