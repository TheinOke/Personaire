import { useMemo, useState } from 'react'
import { addMonths, endOfMonth, format, parseISO, startOfMonth } from 'date-fns'
import { ChevronLeft, ChevronRight, Minus, Plus, Settings2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { BarChart, type Bar } from '@/components/BarChart'
import { StatTile } from '@/components/StatTile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'
import { dayLabel } from '@/lib/dates'
import type { MoneyKind, Transaction } from '@/lib/types'
import { useSettings } from '@/features/settings/useSettings'
import { useToday } from '@/features/settings/useToday'
import { MoneyCategoriesDialog } from './MoneyCategoriesDialog'
import { TransactionForm } from './TransactionForm'
import { money, moneyIcon } from './money'
import { amountOf, useMoneyCategories, useTransactions } from './useFinance'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

export function FinancePage() {
  const today = useToday()
  const { data: settings } = useSettings()
  const currency = settings?.currency ?? 'USD'
  const fmt = (n: number, opts?: { sign?: boolean; compact?: boolean }) => money(n, currency, opts)

  const [month, setMonth] = useState(() => startOfMonth(parseISO(today)))
  const monthStart = iso(month)
  const monthEnd = iso(endOfMonth(month))
  const historyStart = iso(addMonths(month, -5))
  const txQ = useTransactions(historyStart, monthEnd)
  const { data: categories } = useMoneyCategories()

  const [form, setForm] = useState<{ tx?: Transaction; kind?: MoneyKind } | null>(null)
  const [manage, setManage] = useState(false)
  const [breakdown, setBreakdown] = useState<MoneyKind>('expense')

  const all = txQ.data ?? []
  const inMonth = all.filter((t) => t.occurred_on >= monthStart && t.occurred_on <= monthEnd)
  const total = (list: Transaction[], kind: MoneyKind) => list.filter((t) => t.kind === kind).reduce((s, t) => s + amountOf(t), 0)
  const income = total(inMonth, 'income')
  const expense = total(inMonth, 'expense')
  const net = income - expense
  const savingsRate = income > 0 ? Math.round((100 * net) / income) : null

  const prevMonth = addMonths(month, -1)
  const prevList = all.filter((t) => t.occurred_on >= iso(prevMonth) && t.occurred_on <= iso(endOfMonth(prevMonth)))
  const prevExpense = total(prevList, 'expense')

  // Daily spending for the month.
  const daysInMonth = Number(format(endOfMonth(month), 'd'))
  const isCurrentMonth = monthStart <= today && today <= monthEnd
  const lastDay = isCurrentMonth ? Number(today.slice(8, 10)) : daysInMonth
  const spendBars: Bar[] = Array.from({ length: daysInMonth }, (_, i) => {
    const day = iso(new Date(month.getFullYear(), month.getMonth(), i + 1))
    const value = inMonth.filter((t) => t.kind === 'expense' && t.occurred_on === day).reduce((s, t) => s + amountOf(t), 0)
    return {
      key: day,
      value: i + 1 > lastDay ? null : value,
      label: String(i + 1),
      title: format(parseISO(day), 'EEE d MMM'),
    }
  })
  const avgDaily = lastDay ? expense / lastDay : 0

  // Category breakdown.
  const byCategory = useMemo(() => {
    const m = new Map<string | null, number>()
    for (const t of inMonth) if (t.kind === breakdown) m.set(t.money_category_id, (m.get(t.money_category_id) ?? 0) + amountOf(t))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [inMonth, breakdown])
  const breakdownTotal = byCategory.reduce((s, [, v]) => s + v, 0)

  // Last 6 months.
  const months = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5)).map((m) => {
    const from = iso(m)
    const to = iso(endOfMonth(m))
    const list = all.filter((t) => t.occurred_on >= from && t.occurred_on <= to)
    const inc = total(list, 'income')
    const exp = total(list, 'expense')
    return { key: from, label: format(m, 'MMM yyyy'), inc, exp, net: inc - exp }
  })

  const days = [...new Set(inMonth.map((t) => t.occurred_on))].sort().reverse()
  const catOf = (id: string | null) => categories?.find((c) => c.id === id)

  return (
    <>
      <PageHeader
        title="Finance"
        description="Income and expenses."
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" aria-label="Manage money categories" onClick={() => setManage(true)}>
              <Settings2 />
            </Button>
            <Button variant="outline" onClick={() => setForm({ kind: 'income' })}>
              <Plus /> <span className="hidden sm:inline">Income</span>
            </Button>
            <Button onClick={() => setForm({ kind: 'expense' })}>
              <Minus /> <span className="hidden sm:inline">Expense</span>
            </Button>
          </div>
        }
      />

      {/* Month switcher */}
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}>
          <ChevronLeft />
        </Button>
        <span className="min-w-36 text-center font-medium">{format(month, 'MMMM yyyy')}</span>
        <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRight />
        </Button>
        {!isCurrentMonth && (
          <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(parseISO(today)))}>
            This month
          </Button>
        )}
      </div>

      <QueryState isLoading={txQ.isLoading} error={txQ.error}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Income" value={fmt(income)} sub={`${inMonth.filter((t) => t.kind === 'income').length} entries`} />
          <StatTile
            label="Expenses"
            value={fmt(expense)}
            sub={prevExpense ? `${expense >= prevExpense ? '+' : '−'}${fmt(Math.abs(expense - prevExpense))} vs last month` : `${inMonth.filter((t) => t.kind === 'expense').length} entries`}
          />
          <StatTile label="Net" value={fmt(net, { sign: true })} sub={net >= 0 ? 'Saved this month' : 'Spent more than earned'} />
          <StatTile label="Savings rate" value={savingsRate === null ? '—' : `${savingsRate}%`} sub="of income kept" />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Daily spending</CardTitle>
              <p className="text-xs text-muted-foreground">Average {fmt(avgDaily)} per day</p>
            </CardHeader>
            <CardContent>
              <BarChart bars={spendBars} formatValue={(v) => fmt(v)} labelEvery={5} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm">By category</CardTitle>
              <Segmented
                value={breakdown}
                onChange={setBreakdown}
                options={[
                  { value: 'expense', label: 'Expenses' },
                  { value: 'income', label: 'Income' },
                ]}
              />
            </CardHeader>
            <CardContent className="space-y-3">
              {byCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing recorded this month.</p>
              ) : (
                byCategory.map(([id, value]) => {
                  const cat = catOf(id)
                  const Icon = moneyIcon(cat?.icon)
                  const pct = breakdownTotal ? (100 * value) / breakdownTotal : 0
                  return (
                    <div key={id ?? 'none'}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{cat?.name ?? 'Uncategorised'}</span>
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {fmt(value)} <span className="text-xs text-muted-foreground">· {Math.round(pct)}%</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Six-month comparison as a table (two measures → no dual-series chart). */}
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Last 6 months</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2 font-normal">Month</th>
                  <th className="px-3 py-2 text-right font-normal">Income</th>
                  <th className="px-3 py-2 text-right font-normal">Expenses</th>
                  <th className="px-5 py-2 text-right font-normal">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {months.map((m) => (
                  <tr key={m.key} className={cn(m.key === monthStart && 'bg-accent/40')}>
                    <td className="px-5 py-2.5">{m.label}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmt(m.inc)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmt(m.exp)}</td>
                    <td className={cn('px-5 py-2.5 text-right tabular-nums', m.net < 0 && 'font-medium')}>{fmt(m.net, { sign: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Transactions */}
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Transactions</h2>
          {days.length === 0 ? (
            <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
              No transactions in {format(month, 'MMMM')}. Use <span className="text-foreground">Expense</span> or{' '}
              <span className="text-foreground">Income</span> above to add one.
            </Card>
          ) : (
            <div className="space-y-4">
              {days.map((day) => {
                const list = inMonth.filter((t) => t.occurred_on === day)
                const dayNet = total(list, 'income') - total(list, 'expense')
                return (
                  <div key={day}>
                    <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                      <span>{dayLabel(day, today, settings?.date_format)}</span>
                      <span className="tabular-nums">{fmt(dayNet, { sign: true })}</span>
                    </div>
                    <Card className="divide-y overflow-hidden">
                      {list.map((t) => {
                        const cat = catOf(t.money_category_id)
                        const Icon = moneyIcon(cat?.icon)
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setForm({ tx: t })}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/40"
                          >
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                              <Icon className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm">{cat?.name ?? 'Uncategorised'}</span>
                              {t.note && <span className="block truncate text-xs text-muted-foreground">{t.note}</span>}
                            </span>
                            <span className={cn('shrink-0 tabular-nums', t.kind === 'income' ? 'font-semibold' : 'text-muted-foreground')}>
                              {t.kind === 'income' ? '+' : '−'}
                              {fmt(amountOf(t))}
                            </span>
                          </button>
                        )
                      })}
                    </Card>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </QueryState>

      {form && (
        <TransactionForm
          key={form.tx?.id ?? `new-${form.kind}`}
          tx={form.tx}
          defaultKind={form.kind}
          defaultDay={isCurrentMonth ? today : monthEnd}
          onClose={() => setForm(null)}
        />
      )}
      {manage && <MoneyCategoriesDialog onClose={() => setManage(false)} />}
    </>
  )
}
