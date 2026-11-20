import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Field } from '@/components/Field'
import { cn } from '@/lib/utils'
import { addDaysISO } from '@/lib/dates'
import type { MoneyKind, Transaction } from '@/lib/types'
import { useSettings } from '@/features/settings/useSettings'
import { useToday } from '@/features/settings/useToday'
import { moneyIcon, parseAmount } from './money'
import { amountOf, useFinanceMutations, useMoneyCategories } from './useFinance'

export function TransactionForm({
  tx,
  defaultKind = 'expense',
  defaultDay,
  onClose,
}: {
  tx?: Transaction
  defaultKind?: MoneyKind
  defaultDay?: string
  onClose: () => void
}) {
  const today = useToday()
  const { data: settings } = useSettings()
  const { data: categories } = useMoneyCategories()
  const { saveTx, removeTx } = useFinanceMutations()

  const [kind, setKind] = useState<MoneyKind>(tx?.kind ?? defaultKind)
  const [amount, setAmount] = useState(tx ? String(amountOf(tx)) : '')
  const [categoryId, setCategoryId] = useState(tx?.money_category_id ?? '')
  const [day, setDay] = useState(tx?.occurred_on ?? defaultDay ?? today)
  const [note, setNote] = useState(tx?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [addAnother, setAddAnother] = useState(false)

  const options = (categories ?? []).filter((c) => c.kind === kind && (!c.archived || c.id === categoryId))
  const currencySymbol =
    new Intl.NumberFormat(undefined, { style: 'currency', currency: settings?.currency ?? 'USD' })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? ''

  function switchKind(next: MoneyKind) {
    setKind(next)
    if (categories?.find((c) => c.id === categoryId)?.kind !== next) setCategoryId('')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!Number.isFinite(value) || value <= 0) return setError('Enter an amount greater than 0.')
    if (value >= 1e10) return setError('That amount is too large.')
    if (!day) return setError('Pick a date.')
    try {
      await saveTx.mutateAsync({
        id: tx?.id,
        kind,
        amount: value,
        occurred_on: day,
        money_category_id: categoryId || null,
        note: note.trim() || null,
      })
      if (addAnother && !tx) {
        setAmount('')
        setNote('')
        setError(null)
      } else onClose()
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Could not save.')
    }
  }

  function onDelete() {
    if (tx && window.confirm('Delete this transaction? This cannot be undone.')) {
      removeTx.mutate(tx.id)
      onClose()
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={tx ? 'Edit transaction' : kind === 'income' ? 'Add income' : 'Add expense'}
      footer={
        <>
          {tx && (
            <Button type="button" variant="ghost" size="icon" aria-label="Delete transaction" onClick={onDelete}>
              <Trash2 />
            </Button>
          )}
          {!tx && (
            <Button type="submit" form="tx-form" variant="ghost" onClick={() => setAddAnother(true)} disabled={saveTx.isPending}>
              Save & add another
            </Button>
          )}
          <div className="flex-1" />
          <Button type="submit" form="tx-form" onClick={() => setAddAnother(false)} disabled={saveTx.isPending}>
            {saveTx.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="tx-form" onSubmit={onSubmit} className="space-y-4">
        <Segmented
          value={kind}
          onChange={switchKind}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
        />

        <div className="flex items-baseline gap-2 border-b pb-2">
          <span className="text-2xl text-muted-foreground">{currencySymbol}</span>
          <input
            autoFocus={!tx}
            inputMode="decimal"
            placeholder="0"
            aria-label="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-transparent text-4xl font-semibold tabular-nums outline-none placeholder:text-muted-foreground/50"
          />
        </div>

        <Field label="Category">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {options.map((c) => {
              const Icon = moneyIcon(c.icon)
              const selected = c.id === categoryId
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCategoryId(selected ? '' : c.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-md border px-2 py-2.5 text-xs transition-colors',
                    selected ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" />
                  <span className="w-full truncate text-center">{c.name}</span>
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Date" htmlFor="tx-day">
          <div className="flex gap-2">
            <Input id="tx-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            <Button type="button" variant="outline" onClick={() => setDay(today)}>
              Today
            </Button>
            <Button type="button" variant="outline" onClick={() => setDay(addDaysISO(today, -1))}>
              Ytd
            </Button>
          </div>
        </Field>

        <Field label="Note" htmlFor="tx-note">
          <Input id="tx-note" value={note} maxLength={300} placeholder="Optional" onChange={(e) => setNote(e.target.value)} />
        </Field>

        {error && <p className="text-sm text-muted-foreground">⚠ {error}</p>}
        {addAnother && !error && !saveTx.isPending && amount === '' && (
          <p className="text-xs text-muted-foreground">Saved. Add the next one.</p>
        )}
      </form>
    </Dialog>
  )
}
