import { useState, type FormEvent } from 'react'
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Category } from '@/lib/types'
import { CATEGORY_ICONS, categoryIcon } from './icons'
import { useCategories, useCategoryMutations } from './useCategories'

function errorText(e: unknown) {
  const msg = (e as { message?: string } | null)?.message ?? ''
  if (msg.includes('duplicate key')) return 'A category with that name already exists.'
  return msg || 'Something went wrong.'
}

function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-1 sm:grid-cols-9">
      {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => (
        <button
          key={name}
          type="button"
          aria-label={name}
          aria-pressed={value === name}
          onClick={() => onChange(name)}
          className={cn(
            'flex h-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            value === name && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
          )}
        >
          <Icon className="size-5" />
        </button>
      ))}
    </div>
  )
}

function CategoryForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  busy,
  error,
}: {
  initial?: { name: string; icon: string }
  submitLabel: string
  onSubmit: (v: { name: string; icon: string }) => void
  onCancel?: () => void
  busy?: boolean
  error?: string | null
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? 'tag')

  function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) onSubmit({ name: trimmed, icon })
  }

  return (
    <form onSubmit={submit} className="space-y-3 p-4">
      <div className="flex gap-2">
        <Input
          autoFocus
          placeholder="Category name"
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" disabled={busy || !name.trim()}>
          <Check /> <span className="hidden sm:inline">{submitLabel}</span>
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="icon" aria-label="Cancel" onClick={onCancel}>
            <X />
          </Button>
        )}
      </div>
      <IconPicker value={icon} onChange={setIcon} />
      {error && <p className="text-sm text-muted-foreground">⚠ {error}</p>}
    </form>
  )
}

export function CategoriesPage() {
  const { data, isLoading, error } = useCategories()
  const { create, update, move, remove } = useCategoryMutations()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const active = data?.filter((c) => !c.archived) ?? []
  const archived = data?.filter((c) => c.archived) ?? []

  function handleDelete(c: Category) {
    const ok = window.confirm(
      `Delete "${c.name}" permanently?\n\nGoals, tasks and habits in this category are kept but become uncategorised. This cannot be undone.`,
    )
    if (ok) remove.mutate(c.id)
  }

  return (
    <>
      <PageHeader
        title="Categories"
        description="Group your goals, tasks and habits by area of life."
        actions={
          !adding && (
            <Button onClick={() => { setAdding(true); setEditingId(null); create.reset() }}>
              <Plus /> Add
            </Button>
          )
        }
      />

      <QueryState isLoading={isLoading} error={error}>
        {adding && (
          <Card className="mb-4">
            <CategoryForm
              submitLabel="Add"
              busy={create.isPending}
              error={create.isError ? errorText(create.error) : null}
              onCancel={() => setAdding(false)}
              onSubmit={(v) => create.mutate(v, { onSuccess: () => setAdding(false) })}
            />
          </Card>
        )}

        {active.length === 0 && !adding ? (
          <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
            No categories yet. Add one to get started.
          </Card>
        ) : (
          <Card className="divide-y">
            {active.map((c, i) => {
              const Icon = categoryIcon(c.icon)
              if (editingId === c.id) {
                return (
                  <CategoryForm
                    key={c.id}
                    initial={{ name: c.name, icon: c.icon }}
                    submitLabel="Save"
                    busy={update.isPending}
                    error={update.isError ? errorText(update.error) : null}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(v) => update.mutate({ id: c.id, ...v }, { onSuccess: () => setEditingId(null) })}
                  />
                )
              }
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                  <div className="flex items-center">
                    <Button variant="ghost" size="icon" aria-label="Move up" disabled={i === 0 || move.isPending}
                      onClick={() => move.mutate({ id: c.id, direction: -1 })}>
                      <ArrowUp />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Move down" disabled={i === active.length - 1 || move.isPending}
                      onClick={() => move.mutate({ id: c.id, direction: 1 })}>
                      <ArrowDown />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`}
                      onClick={() => { setEditingId(c.id); setAdding(false); update.reset() }}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Archive ${c.name}`}
                      onClick={() => update.mutate({ id: c.id, archived: true })}>
                      <Archive />
                    </Button>
                  </div>
                </div>
              )
            })}
          </Card>
        )}

        {archived.length > 0 && (
          <div className="mt-6">
            <button className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setShowArchived((s) => !s)}>
              {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
            </button>
            {showArchived && (
              <Card className="mt-3 divide-y">
                {archived.map((c) => {
                  const Icon = categoryIcon(c.icon)
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 text-muted-foreground">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <Button variant="ghost" size="icon" aria-label={`Restore ${c.name}`}
                        onClick={() => update.mutate({ id: c.id, archived: false })}>
                        <ArchiveRestore />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`} onClick={() => handleDelete(c)}>
                        <Trash2 />
                      </Button>
                    </div>
                  )
                })}
              </Card>
            )}
          </div>
        )}

        {(move.isError || remove.isError) && (
          <p className="mt-3 text-sm text-muted-foreground">⚠ {errorText(move.error ?? remove.error)}</p>
        )}
      </QueryState>
    </>
  )
}
