"use client"

import * as React from "react"
import { Plus, Eye, EyeOff, CalendarDays, Sun, Sunrise, Infinity as InfinityIcon, User } from "lucide-react"
import { Card, Button, Input, Select, Field, Badge } from "@/components/ui"
import { Modal } from "@/components/modal"
import { RowActions } from "@/components/row-actions"
import { cn } from "@/lib/utils"
import type { TodoItem, TodoDueKind, Profile } from "@/lib/types"
import { createTodo, updateTodo, toggleTodo, deleteTodo } from "@/app/actions/todo"

const DUE_META: Record<TodoDueKind, { label: string; icon: typeof Sun }> = {
  hoje: { label: "Hoje", icon: Sun },
  amanha: { label: "Amanhã", icon: Sunrise },
  sem_prazo: { label: "Sem prazo", icon: InfinityIcon },
}
const DUE_ORDER: TodoDueKind[] = ["hoje", "amanha", "sem_prazo"]

export function TodoBoard({
  projectId,
  todos,
  members = [],
}: {
  projectId: string | null
  todos: TodoItem[]
  members?: Profile[]
}) {
  const [pending, startTransition] = React.useTransition()
  const [showDone, setShowDone] = React.useState(false)
  const [categoryFilter, setCategoryFilter] = React.useState<string>("todas")
  const [modal, setModal] = React.useState<{ open: boolean; edit?: TodoItem }>({ open: false })

  const categories = React.useMemo(() => {
    const set = new Set<string>()
    for (const t of todos) if (t.category) set.add(t.category)
    return Array.from(set).sort()
  }, [todos])

  const memberName = (id: string | null) => members.find((m) => m.id === id)?.username ?? null

  const visible = todos.filter((t) => {
    if (!showDone && t.done) return false
    if (categoryFilter !== "todas" && (t.category ?? "") !== categoryFilter) return false
    return true
  })

  const byDue = (kind: TodoDueKind) => visible.filter((t) => t.due_kind === kind)
  const doneCount = todos.filter((t) => t.done).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 w-auto"
          >
            <option value="todas">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Button variant="outline" size="sm" onClick={() => setShowDone((v) => !v)}>
            {showDone ? <EyeOff size={15} /> : <Eye size={15} />}
            {showDone ? "Ocultar feitas" : `Ver feitas (${doneCount})`}
          </Button>
        </div>
        <Button size="sm" onClick={() => setModal({ open: true })}>
          <Plus size={15} /> Tarefa
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {DUE_ORDER.map((kind) => {
          const items = byDue(kind)
          const Meta = DUE_META[kind]
          const Icon = Meta.icon
          return (
            <Card key={kind} className="flex flex-col gap-2 p-4">
              <div className="mb-1 flex items-center gap-2">
                <Icon size={16} className="text-primary" />
                <h3 className="font-display text-sm font-semibold text-foreground">{Meta.label}</h3>
                <Badge tone="default">{items.length}</Badge>
              </div>
              {items.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted">Nada aqui.</p>
              ) : (
                items.map((t) => (
                  <TodoRow
                    key={t.id}
                    item={t}
                    assignee={projectId ? memberName(t.assignee_id) : null}
                    onToggle={() => startTransition(async () => void (await toggleTodo(t.id, !t.done)))}
                    onEdit={() => setModal({ open: true, edit: t })}
                    onDelete={() => deleteTodo(t.id)}
                    pending={pending}
                  />
                ))
              )}
            </Card>
          )
        })}
      </div>

      <TodoModal
        state={modal}
        onClose={() => setModal({ open: false })}
        projectId={projectId}
        members={members}
        categories={categories}
      />
    </div>
  )
}

function TodoRow({
  item,
  assignee,
  onToggle,
  onEdit,
  onDelete,
  pending,
}: {
  item: TodoItem
  assignee: string | null
  onToggle: () => void
  onEdit: () => void
  onDelete: () => Promise<{ ok?: boolean; error?: string }>
  pending: boolean
}) {
  return (
    <div className="group flex items-start gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]/50 p-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.done}
        aria-label={item.done ? "Marcar como não feita" : "Marcar como feita"}
        onClick={onToggle}
        disabled={pending}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
          item.done
            ? "border-primary bg-primary text-[#04121a]"
            : "border-[color:var(--color-border-strong)] hover:border-primary",
        )}
      >
        {item.done && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm text-foreground", item.done && "text-muted line-through")}>{item.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {item.category && <Badge tone="default">{item.category}</Badge>}
          {assignee && (
            <Badge tone="primary">
              <User size={10} /> {assignee}
            </Badge>
          )}
        </div>
      </div>
      <RowActions onEdit={onEdit} onDelete={onDelete} />
    </div>
  )
}

function TodoModal({
  state,
  onClose,
  projectId,
  members,
  categories,
}: {
  state: { open: boolean; edit?: TodoItem }
  onClose: () => void
  projectId: string | null
  members: Profile[]
  categories: string[]
}) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const edit = state.edit
  const run = (fd: FormData) => {
    setError(null)
    startTransition(async () => {
      const res = edit ? await updateTodo(edit.id, fd) : await createTodo(projectId, fd)
      if (res?.error) setError(res.error)
      else onClose()
    })
  }
  return (
    <Modal open={state.open} onClose={onClose} title={edit ? "Editar tarefa" : "Nova tarefa"}>
      <form action={run} className="flex flex-col gap-4">
        <Field label="Tarefa">
          <Input name="title" defaultValue={edit?.title ?? ""} placeholder="Ex.: Subir 3 criativos novos" required autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prazo">
            <Select name="due_kind" defaultValue={edit?.due_kind ?? "sem_prazo"}>
              <option value="hoje">Hoje</option>
              <option value="amanha">Amanhã</option>
              <option value="sem_prazo">Sem prazo</option>
            </Select>
          </Field>
          <Field label="Categoria">
            <Input name="category" defaultValue={edit?.category ?? ""} placeholder="Ex.: Criativos" list="todo-cats" />
            <datalist id="todo-cats">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </div>
        {projectId && members.length > 0 && (
          <Field label="Responsável">
            <Select name="assignee_id" defaultValue={edit?.assignee_id ?? ""}>
              <option value="">Sem responsável</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name ?? m.username}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {error && <p className="text-sm text-negative">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
