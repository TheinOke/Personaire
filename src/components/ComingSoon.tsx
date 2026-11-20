import { PageHeader } from './PageHeader'
import { Card, CardContent } from '@/components/ui/card'

/** Temporary placeholder until each feature is built. */
export function ComingSoon({
  title,
  description,
  feature,
}: {
  title: string
  description: string
  feature: string
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card className="border-dashed">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          {feature} — coming in the next build step.
        </CardContent>
      </Card>
    </>
  )
}
