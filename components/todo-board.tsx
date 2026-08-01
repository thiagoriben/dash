"use client"

import * as React from "react"
import {
  Plus,
  Eye,
  EyeOff,
  User,
  Check,
  Folder,
  CalendarDays,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { Card, Button, Input, Select, Field, Badge } from "@/components/ui"
import { Modal } from "@/components/modal"
import { RowActions } from "@/components/row-actions"
import { cn } from "@/lib/utils"
import type { TodoItem, Profile } from "@/lib/types"
import { createTodo, updateTodo, toggleTodo, archiveTodo, deleteTodo } from "@/app/actions/todo"
import { scheduleReminders, type ScheduledReminder } from "@/lib/pwa"

/** Mapa de lembretes: id da tarefa -> { time: "HH:MM", lead: minutos antes }. */
export type ReminderMap = Record<string, { time?: string; lead?: number }>

/** Antecedências disponíveis para o lembrete. */
const LEAD_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Na hora" },
  { value: 5, label: "5 min antes" },
  { value: 10, label: "10 min antes" },
  { value: 15, label: "15 min antes" },
  { value: 30, label: "30 min antes" },
  { value: 60, label: "1 h antes" },
  { value: 120, label: "2 h antes" },
  { value: 1440, label: "1 dia antes" },
]

/** Rótulo da área. Tarefa sem categoria cai em "Outros". */
const OUTROS = "Outros"
function areaOf(t: TodoItem) {
  return t.category?.trim() || OUTROS
}

/* ---------------- Filtros de data ---------------- */

type DateFilter = "todas" | "hoje" | "amanha" | "semana" | "atrasadas" | "sem_prazo"

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: "todas", label: "Todos os prazos" },
  { value: "hoje", label: "Hoje" },
  { value: "amanha", label: "Amanhã" },
  { value: "semana", label: "Esta semana" },
  { value: "atrasadas", label: "Atrasadas" },
  { value: "sem_prazo", label: "Sem prazo" },
]

function ymd(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function matchesDate(t: TodoItem, filter: DateFilter): boolean {
  if (filter === "todas") return true
  const d = t.due_date
  if (filter === "sem_prazo") return !d
  if (!d) return false
  const hoje = ymd(0)
  if (filter === "hoje") return d === hoje
  if (filter === "amanha") return d === ymd(1)
  if (filter === "semana") return d >= hoje && d <= ymd(7)
  if (filter === "atrasadas") return d < hoje
  return true
}

function fmtDate(d: string | null) {
  if (!d) return null
  const [y, m, day] = d.split("-").map(Number)
  return new Date(y, m - 1, day).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

export function TodoBoard({
  projectId,
  todos,
  members = [],
  reminders = {},
  notifEnabled = true,
  projectOptions = [],
}: {
  projectId: string | null
  todos: TodoItem[]
  members?: Profile[]
  /** Horários/antecedências por tarefa (vindos das prefs). */
  reminders?: ReminderMap
  /** Se o usuário habilitou lembretes de tarefas nas configurações. */
  notifEnabled?: boolean
  /** Projetos aos quais a tarefa pode ser atribuída (páginas globais). */
  projectOptions?: { id: string; name: string }[]
}) {
  const [pending, startTransition] = React.useTransition()

  // Agenda notificações locais das tarefas com horário definido (aba precisa estar aberta).
  // Namespace por escopo para não apagar os lembretes de outros quadros na mesma página.
  const reminderNs = `todos:${projectId ?? "pessoal"}`
  React.useEffect(() => {
    if (!notifEnabled) {
      scheduleReminders([], reminderNs)
      return
    }
    const list: ScheduledReminder[] = []
    for (const t of todos) {
      if (t.done || t.archived || !t.due_date) continue
      const r = reminders[t.id]
      if (!r?.time) continue
      const [hh, mm] = r.time.split(":").map(Number)
      const [y, mo, d] = t.due_date.split("-").map(Number)
      const at = new Date(y, mo - 1, d, hh || 0, mm || 0, 0, 0).getTime() - (r.lead ?? 0) * 60_000
      list.push({
        id: t.id,
        at,
        title: "Lembrete de tarefa",
        body: t.title,
      })
    }
    scheduleReminders(list, reminderNs)
  }, [todos, reminders, notifEnabled, reminderNs])

  const [showDone, setShowDone] = React.useState(false)
  const [areaFilter, setAreaFilter] = React.useState<string>("todas")
  const [dateFilter, setDateFilter] = React.useState<DateFilter>("todas")
  const [modal, setModal] = React.useState<{ open: boolean; edit?: TodoItem }>({ open: false })

  // Áreas existentes (para o filtro e sugestões). "Outros" sempre disponível.
  const areas = React.useMemo(() => {
    const set = new Set<string>()
    for (const t of todos) set.add(areaOf(t))
    set.add(OUTROS)
    return Array.from(set).sort((a, b) => (a === OUTROS ? 1 : b === OUTROS ? -1 : a.localeCompare(b)))
  }, [todos])

  const memberName = (id: string | null) => members.find((m) => m.id === id)?.username ?? null

  // Ativas x concluídas ocultas ("Feitas" = archived).
  const active = todos.filter((t) => !t.archived)
  const archived = todos.filter((t) => t.archived)

  const visible = active.filter((t) => {
    if (areaFilter !== "todas" && areaOf(t) !== areaFilter) return false
    if (!matchesDate(t, dateFilter)) return false
    return true
  })

  // Agrupa por área (o usuário cria áreas escrevendo a categoria).
  const grouped = React.useMemo(() => {
    const map = new Map<string, TodoItem[]>()
    for (const t of visible) {
      const a = areaOf(t)
      if (!map.has(a)) map.set(a, [])
      map.get(a)!.push(t)
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      a === OUTROS ? 1 : b === OUTROS ? -1 : a.localeCompare(b),
    )
  }, [visible])

  const runToggle = (t: TodoItem) => startTransition(async () => void (await toggleTodo(t.id, !t.done)))
  const runArchive = (t: TodoItem, v: boolean) => startTransition(async () => void (await archiveTodo(t.id, v)))

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros: área + prazo. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} className="h-9 w-auto">
            <option value="todas">Todas as áreas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <Select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="h-9 w-auto"
          >
            {DATE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
          <Button variant="outline" size="sm" onClick={() => setShowDone((v) => !v)}>
            {showDone ? <EyeOff size={15} /> : <Eye size={15} />}
            {showDone ? "Ocultar feitas" : `Feitas (${archived.length})`}
          </Button>
        </div>
        <Button size="sm" onClick={() => setModal({ open: true })}>
          <Plus size={15} /> Tarefa
        </Button>
      </div>

      {/* Colunas por ÁREA. */}
      {grouped.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">Nenhuma tarefa com esses filtros.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {grouped.map(([area, items]) => (
            <Card key={area} className="flex flex-col gap-2 p-4">
              <div className="mb-1 flex items-center gap-2">
                <Folder size={16} className="text-primary" />
                <h3 className="font-display text-sm font-semibold text-foreground">{area}</h3>
                <Badge tone="default">{items.length}</Badge>
              </div>
              {items.map((t) => (
                <TodoRow
                  key={t.id}
                  item={t}
                  reminder={reminders[t.id]}
                  assignee={projectId ? memberName(t.assignee_id) : null}
                  onToggle={() => runToggle(t)}
                  onArchive={() => runArchive(t, true)}
                  onEdit={() => setModal({ open: true, edit: t })}
                  onDelete={() => deleteTodo(t.id)}
                  pending={pending}
                />
              ))}
            </Card>
          ))}
        </div>
      )}

      {/* Seção "Feitas" (arquivadas), aberta via botão do olho. */}
      {showDone && (
        <DoneSection
          items={archived}
          onToggle={runToggle}
          onRestore={(t) => runArchive(t, false)}
          onDelete={(t) => deleteTodo(t.id)}
          pending={pending}
        />
      )}

      <TodoModal
        state={modal}
        onClose={() => setModal({ open: false })}
        projectId={projectId}
        members={members}
        areas={areas}
        reminder={modal.edit ? reminders[modal.edit.id] : undefined}
        projectOptions={projectOptions}
      />
    </div>
  )
}

function DoneSection({
  items,
  onToggle,
  onRestore,
  onDelete,
  pending,
}: {
  items: TodoItem[]
  onToggle: (t: TodoItem) => void
  onRestore: (t: TodoItem) => void
  onDelete: (t: TodoItem) => Promise<{ ok?: boolean; error?: string }>
  pending: boolean
}) {
  const [open, setOpen] = React.useState(true)
  return (
    <Card className="flex flex-col gap-2 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-semibold text-foreground"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        Feitas
        <Badge tone="default">{items.length}</Badge>
      </button>
      {open &&
        (items.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted">Nenhuma tarefa concluída ainda.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => (
              <TodoRow
                key={t.id}
                item={t}
                assignee={null}
                archivedView
                onToggle={() => onToggle(t)}
                onArchive={() => onRestore(t)}
                onEdit={() => {}}
                onDelete={() => onDelete(t)}
                pending={pending}
              />
            ))}
          </div>
        ))}
    </Card>
  )
}

function TodoRow({
  item,
  reminder,
  assignee,
  archivedView = false,
  onToggle,
  onArchive,
  onEdit,
  onDelete,
  pending,
}: {
  item: TodoItem
  reminder?: { time?: string; lead?: number }
  assignee: string | null
  archivedView?: boolean
  onToggle: () => void
  onArchive: () => void
  onEdit: () => void
  onDelete: () => Promise<{ ok?: boolean; error?: string }>
  pending: boolean
}) {
  const dueLabel = fmtDate(item.due_date)
  const overdue = !item.done && item.due_date != null && item.due_date < ymd(0)
  return (
    <div
      className={cn(
        "group flex items-start gap-2.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]/50 p-3",
        item.done && "opacity-70",
      )}
    >
      {/* Checkbox grande e destacado. */}
      <button
        type="button"
        role="checkbox"
        aria-checked={item.done}
        aria-label={item.done ? "Marcar como não feita" : "Marcar como feita"}
        onClick={onToggle}
        disabled={pending}
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
          item.done
            ? "border-primary bg-primary text-[#04121a]"
            : "border-[color:var(--color-border-strong)] hover:border-primary hover:bg-primary/10",
        )}
      >
        {item.done && <Check size={16} strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("text-sm text-foreground", item.done && "text-muted line-through")}>{item.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {dueLabel && (
            <Badge tone={overdue ? "negative" : "default"}>
              <CalendarDays size={10} /> {dueLabel}
            </Badge>
          )}
          {reminder?.time && (
            <Badge tone="primary">
              <Clock size={10} /> {reminder.time}
            </Badge>
          )}
          {assignee && (
            <Badge tone="primary">
              <User size={10} /> {assignee}
            </Badge>
          )}
        </div>
      </div>

      {/* Olho: oculta (arquiva) uma concluída, ou traz de volta na aba Feitas. */}
      {item.done && (
        <button
          type="button"
          onClick={onArchive}
          disabled={pending}
          aria-label={archivedView ? "Trazer de volta" : "Ocultar (mover para Feitas)"}
          title={archivedView ? "Trazer de volta" : "Ocultar (mover para Feitas)"}
          className="mt-0.5 shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
        >
          {archivedView ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
      )}
      {!archivedView && <RowActions onEdit={onEdit} onDelete={onDelete} />}
      {archivedView && <RowActions onDelete={onDelete} />}
    </div>
  )
}

function TodoModal({
  state,
  onClose,
  projectId,
  members,
  areas,
  reminder,
  projectOptions = [],
}: {
  state: { open: boolean; edit?: TodoItem }
  onClose: () => void
  projectId: string | null
  members: Profile[]
  areas: string[]
  reminder?: { time?: string; lead?: number }
  projectOptions?: { id: string; name: string }[]
}) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const edit = state.edit
  // Escopo: "" = pessoal, senão id do projeto. Começa no escopo atual do quadro.
  const [scope, setScope] = React.useState<string>(projectId ?? "")
  React.useEffect(() => {
    if (state.open) setScope(projectId ?? "")
  }, [state.open, projectId])

  // Só tarefa pessoal pode ser atribuída a um projeto. Tarefa de projeto fica travada nele.
  const showScopePicker = projectOptions.length > 0 && projectId === null
  const scopeUnchanged = scope === (projectId ?? "")
  // Responsável só quando a tarefa está no projeto atual do quadro (que conhece os membros).
  const showAssignee = scopeUnchanged && scope !== "" && members.length > 0

  const run = (fd: FormData) => {
    setError(null)
    startTransition(async () => {
      const res = edit ? await updateTodo(edit.id, fd) : await createTodo(scope || null, fd)
      if (res?.error) setError(res.error)
      else onClose()
    })
  }
  return (
    <Modal open={state.open} onClose={onClose} title={edit ? "Editar tarefa" : "Nova tarefa"}>
      <form action={run} className="flex flex-col gap-4">
        <Field label="Tarefa">
          <Input
            name="title"
            defaultValue={edit?.title ?? ""}
            placeholder="Ex.: Subir 3 criativos novos"
            required
            autoFocus
          />
        </Field>
        {/* Ao editar, envia o escopo escolhido para a server action mover a tarefa. */}
        {edit && <input type="hidden" name="project_id" value={scope} />}
        {showScopePicker && (
          <Field label="Atribuir a" hint="Escolha um projeto ou deixe como tarefa pessoal.">
            <Select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="">Pessoal</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Área" hint="Ex.: Pessoal, Casa, Mercado. Vazio = Outros.">
            <Input name="category" defaultValue={edit?.category ?? ""} placeholder="Outros" list="todo-areas" />
            <datalist id="todo-areas">
              {areas.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Field>
          <Field label="Prazo (opcional)">
            <Input name="due_date" type="date" defaultValue={edit?.due_date ?? ""} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Horário" hint="Para receber lembrete (precisa de prazo).">
            <Input name="time" type="time" defaultValue={reminder?.time ?? ""} />
          </Field>
          <Field label="Lembrar">
            <Select name="lead" defaultValue={String(reminder?.lead ?? 0)}>
              {LEAD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {showAssignee && (
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
