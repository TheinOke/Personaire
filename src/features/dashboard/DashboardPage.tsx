import { format } from 'date-fns'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function DashboardPage() {
  const today = new Date()
  const hour = today.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <PageHeader title={greeting} description={format(today, 'EEEE, d MMMM yyyy')} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {['Tasks today', 'Habits done', 'Active goals', 'This week'].map((label) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">—</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        The full dashboard (M01) arrives once goals, tasks and habits are built.
      </p>
    </>
  )
}
