import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'

/** Shows loading / error states for a query, otherwise renders children. */
export function QueryState({
  isLoading,
  error,
  children,
}: {
  isLoading: boolean
  error: unknown
  children: ReactNode
}) {
  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
  if (error) {
    const message = error instanceof Error ? error.message : (error as { message?: string })?.message
    return (
      <Card>
        <CardContent className="p-5 text-sm">
          <p className="font-medium">Something went wrong</p>
          <p className="mt-1 text-muted-foreground">{message ?? 'Unknown error'}</p>
        </CardContent>
      </Card>
    )
  }
  return <>{children}</>
}
