import { useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { Habit } from '@/lib/types'
import { useToday } from '@/features/settings/useToday'
import { HabitCard } from './HabitCard'
import { HabitForm } from './HabitForm'
import { isDueOn, logSet, useHabitLogs, useHabits } from './useHabits'

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        {aside}
      </div>
      <Card className="divide-y overflow-hidden">{children}</Card>
    </section>
  )
}

export function HabitsPage() {
  const { data: habits, isLoading, error } = useHabits()
  const { data: logs, isLoading: logsLoading, error: logsError } = useHabitLogs()
  const today = useToday()
  const [form, setForm] = useState<{ habit?: Habit } | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const done = logSet(logs)
  const active = (habits ?? []).filter((h) => !h.archived)
  const archived = (habits ?? []).filter((h) => h.archived)
  const dueToday = active.filter((h) => isDueOn(h, today))
  const notToday = active.filter((h) => !isDueOn(h, today))
  const doneToday = dueToday.filter((h) => done.has(`${h.id}|${today}`)).length
  const pct = dueToday.length ? (100 * doneToday) / dueToday.length : 0

  const card = (h: Habit) => <HabitCard key={h.id} habit={h} done={done} today={today} onEdit={(habit) => setForm({ habit })} />

  return (
    <>
      <PageHeader
        title="Habits"
        description="Build habits one day at a time."
        actions={
          <Button onClick={() => setForm({})}>
            <Plus /> New habit
          </Button>
        }
      />

      <QueryState isLoading={isLoading || logsLoading} error={error ?? logsError}>
        {active.length === 0 ? (
          <Card className="border-dashed p-10 text-center text-sm text-muted-foreground">
            <p>No habits yet. Start small — one habit you can do every day.</p>
            <Button variant="outline" className="mt-4" onClick={() => setForm({})}>
              <Plus /> Create your first habit
            </Button>
          </Card>
        ) : (
          <>
            {dueToday.length > 0 && (
              <Card className="mb-6 p-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Today</span>
                  <span className="text-2xl font-semibold">
                    {doneToday}/{dueToday.length}
                  </span>
                </div>
                <Progress value={pct} className="mt-3 h-2" />
                {doneToday === dueToday.length && <p className="mt-2 text-xs text-muted-foreground">All done for today. 👏</p>}
              </Card>
            )}

            {dueToday.length > 0 && (
              <Section title="Due today" aside={<span className="text-[11px] text-muted-foreground">Last 7 days — tap to fill in</span>}>
                {dueToday.map(card)}
              </Section>
            )}
            {notToday.length > 0 && <Section title="Not scheduled today">{notToday.map(card)}</Section>}
          </>
        )}

        {archived.length > 0 && (
          <div>
            <button className="mb-2 text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => setShowArchived((s) => !s)}>
              {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
            </button>
            {showArchived && <Card className="divide-y overflow-hidden">{archived.map(card)}</Card>}
          </div>
        )}
      </QueryState>

      {form && <HabitForm key={form.habit?.id ?? 'new'} habit={form.habit} onClose={() => setForm(null)} />}
    </>
  )
}
