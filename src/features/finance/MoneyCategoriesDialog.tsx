import { useState, type FormEvent } from 'react'
import { Archive, ArchiveRestore, Check, Pencil, Plus, X } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'
import type { MoneyCategory, MoneyKind } from '@/lib/types'
import { MONEY_ICONS, moneyIcon } from './money'
import { useFinanceMutations, useMoneyCategories } from './useFinance'

function errorText(e: unknown) {
  const msg = (e as { message?: string } | null)?.message ?? ''
  return msg.includes('duplicate key') ? 'That name is already used.' : msg || 'Something went wrong.'
}

function CategoryEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: { name: string; icon: string }
  onSave: (v: { name: string; icon: string }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? 'tag')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim()) onSave({ name: name.trim(), icon })
  }
  return (
    <form onSubmit={submit} className="space-y-2 p-3">
      <div className="flex gap-2">
        <Input autoFocus value={name} maxLength={50} placeholder="Name" onChange={(e) => setName(e.target.value)} />
        <Button type="submit" size="icon" aria-label="Save" disabled={!name.trim()}>
          <Check />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Cancel" onClick={onCancel}>
          <X />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Object.entries(MONEY_ICONS).map(([key, Icon]) => (
          <button
            key={key}
            type="button"
            aria-label={key}
            aria-pressed={icon === key}
            onClick={() => setIcon(key)}
            className={cn('flex h-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent', icon === key && 'bg-primary text-primary-foreground hover:bg-primary')}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    </form>
  )
}

export function MoneyCategoriesDialog({ onClose }: { onClose: () => void }) {
  const { data: categories } = useMoneyCategories()
  const { saveCategory } = useFinanceMutations()
  const [kind, setKind] = useState<MoneyKind>('expense')
  const [editing, setEditing] = useState<string | 'new' | null>(null)

  const list = (categories ?? []).filter((c) => c.kind === kind)
  const save = (values: Partial<MoneyCategory> & { id?: string }) =>
    saveCategory.mutate(values, { onSuccess: () => setEditing(null) })

  return (
    <Dialog open onClose={onClose} title="Money categories">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Segmented
            value={kind}
            onChange={(k) => {
              setKind(k)
              setEditing(null)
            }}
            options={[
              { value: 'expense', label: 'Expense' },
              { value: 'income', label: 'Income' },
            ]}
          />
          {editing !== 'new' && (
            <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
              <Plus /> Add
            </Button>
          )}
        </div>

        <div className="divide-y rounded-lg border">
          {editing === 'new' && <CategoryEditor onCancel={() => setEditing(null)} onSave={(v) => save({ ...v, kind })} />}
          {list.map((c) => {
            if (editing === c.id) {
              return (
                <CategoryEditor key={c.id} initial={c} onCancel={() => setEditing(null)} onSave={(v) => save({ id: c.id, ...v })} />
              )
            }
            const Icon = moneyIcon(c.icon)
            return (
              <div key={c.id} className={cn('flex items-center gap-3 px-3 py-2', c.archived && 'text-muted-foreground')}>
                <Icon className="size-4" />
                <span className="flex-1 truncate text-sm">{c.name}</span>
                {!c.archived && (
                  <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c.id)}>
                    <Pencil />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={c.archived ? `Restore ${c.name}` : `Archive ${c.name}`}
                  onClick={() => save({ id: c.id, archived: !c.archived })}
                >
                  {c.archived ? <ArchiveRestore /> : <Archive />}
                </Button>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">Archived categories are hidden when adding, but past transactions keep them.</p>
        {saveCategory.isError && <p className="text-sm text-muted-foreground">⚠ {errorText(saveCategory.error)}</p>}
      </div>
    </Dialog>
  )
}
