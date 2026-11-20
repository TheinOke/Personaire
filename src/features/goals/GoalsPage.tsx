import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Goal } from '@/lib/types'
import { useActiveCategories } from '@/features/categories/useCategories'
import { GoalCard } from './GoalCard'
import { GoalForm } from './GoalForm'
import { useGoals } from './useGoals'

const TABS: { value: Goal['status']; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
]

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 }

export function GoalsPage() {
  const { data: goals, isLoading, error } = useGoals()
  const { data: categories } = useActiveCategories()
  const [tab, setTab] = useState<Goal['status']>('active')
  const [categoryId, setCategoryId] = useState('')
  const [creating, setCreating] = useState(false)

  const list = (goals ?? [])
    .filter((g) => g.status === tab && (!categoryId || g.category_id === categoryId))
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        (a.target_date ?? '9999').localeCompare(b.target_date ?? '9999'),
    )

  const countFor = (s: Goal['status']) => goals?.filter((g) => g.status === s).length ?? 0

  return (
    <>
      <PageHeader
        title="Goals"
        description="What you are working towards."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> New goal
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex overflow-x-auto rounded-md border p-0.5" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'flex-1 whitespace-nowrap rounded-[5px] px-3 py-1.5 text-sm text-muted-foreground sm:flex-none',
                tab === t.value && 'bg-primary text-primary-foreground',
              )}
            >
              {t.label}
              <span className="ml-1.5 text-xs opacity-70">{countFor(t.value)}</span>
            </button>
          ))}
        </div>
        <div className="sm:ml-auto sm:w-48">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Filter by category">
            <option value="">All categories</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <QueryState isLoading={isLoading} error={error}>
        {list.length === 0 ? (
          <Card className="border-dashed p-10 text-center text-sm text-muted-foreground">
            {tab === 'active' ? (
              <>
                <p>No active goals yet.</p>
                <Button variant="outline" className="mt-4" onClick={() => setCreating(true)}>
                  <Plus /> Create your first goal
                </Button>
              </>
            ) : (
              `No ${tab} goals.`
            )}
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </div>
        )}
      </QueryState>

      {creating && <GoalForm onClose={() => setCreating(false)} />}
    </>
  )
}
