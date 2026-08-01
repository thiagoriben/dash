"use client"

import * as React from "react"
import {
  Link2,
  ImageIcon,
  Video,
  Hash,
  FileText,
  Plus,
  FolderPlus,
  Copy,
  ExternalLink,
  Check,
  StickyNote,
  Lock,
  Users,
  ListTodo,
} from "lucide-react"
import { Card, Button, Input, Textarea, Select, Field, Badge } from "@/components/ui"
import { Modal } from "@/components/modal"
import { RowActions } from "@/components/row-actions"
import { TodoBoard } from "@/components/todo-board"
import { MediaPreview, detectMedia } from "@/components/media-preview"
import { cn } from "@/lib/utils"
import type { ShortcutCategory, Shortcut, Note, ShortcutKind, TodoItem, Profile } from "@/lib/types"
import {
  createCategory,
  updateCategory,
  deleteCategory,
  createShortcut,
  updateShortcut,
  deleteShortcut,
  createNote,
  updateNote,
  deleteNote,
  seedOrganizationExamples,
} from "@/app/actions/organizacao"

const KIND_META: Record<ShortcutKind, { label: string; icon: typeof Link2 }> = {
  link: { label: "Link", icon: Link2 },
  imagem: { label: "Imagem", icon: ImageIcon },
  video: { label: "Vídeo", icon: Video },
  id: { label: "ID / código", icon: Hash },
  nota: { label: "Texto", icon: FileText },
}

type Tab = "atalhos" | "notas" | "tarefas"

export type FriendOption = { id: string; name: string }

export function OrganizacaoClient({
  projectId,
  categories,
  shortcuts,
  notes,
  todos = [],
  members = [],
  friends = [],
  meId,
  embedded = false,
  only,
  title,
  description,
  reminders = {},
  notifEnabled = true,
  projectOptions = [],
}: {
  projectId: string | null
  categories: ShortcutCategory[]
  shortcuts: Shortcut[]
  notes: Note[]
  todos?: TodoItem[]
  members?: Profile[]
  /** Horários/antecedências por tarefa (das prefs). */
  reminders?: Record<string, { time?: string; lead?: number }>
  /** Lembretes de tarefas habilitados nas configurações. */
  notifEnabled?: boolean
  /** Projetos aos quais notas/tarefas podem ser atribuídas (páginas globais). */
  projectOptions?: { id: string; name: string }[]
  /** Amigos aceitos, para compartilhar notas pessoais. */
  friends?: FriendOption[]
  /** Id do usuário logado, para distinguir notas próprias das compartilhadas comigo. */
  meId?: string
  embedded?: boolean
  /** Renderiza apenas uma ferramenta, sem a barra de abas (usado nas rotas dedicadas). */
  only?: Tab
  title?: string
  description?: string
}) {
  const [tab, setTab] = React.useState<Tab>(only ?? "atalhos")
  const [pending, startTransition] = React.useTransition()

  // Modais
  const [catModal, setCatModal] = React.useState<{ open: boolean; edit?: ShortcutCategory }>({ open: false })
  const [scModal, setScModal] = React.useState<{ open: boolean; edit?: Shortcut }>({ open: false })
  const [noteModal, setNoteModal] = React.useState<{ open: boolean; edit?: Note }>({ open: false })

  const empty = categories.length === 0 && shortcuts.length === 0 && notes.length === 0

  const grouped = React.useMemo(() => {
    const map = new Map<string | null, Shortcut[]>()
    for (const s of shortcuts) {
      const key = s.category_id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return map
  }, [shortcuts])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      {!embedded && (
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold text-foreground">
            {title ?? "Organização"}
          </h1>
          <p className="text-sm text-muted">
            {description ?? "Salve links, imagens, vídeos, IDs e anotações. Tudo fácil de ver, copiar e editar."}
          </p>
        </header>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {only ? (
          <span />
        ) : (
          <div className="inline-flex rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-1">
            <TabBtn active={tab === "atalhos"} onClick={() => setTab("atalhos")}>
              <Link2 size={15} /> Atalhos
            </TabBtn>
            <TabBtn active={tab === "notas"} onClick={() => setTab("notas")}>
              <StickyNote size={15} /> Notas
            </TabBtn>
            <TabBtn active={tab === "tarefas"} onClick={() => setTab("tarefas")}>
              <ListTodo size={15} /> Tarefas
            </TabBtn>
          </div>
        )}
        {tab !== "tarefas" && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCatModal({ open: true })}>
              <FolderPlus size={15} /> Categoria
            </Button>
            {tab === "atalhos" ? (
              <Button size="sm" onClick={() => setScModal({ open: true })}>
                <Plus size={15} /> Atalho
              </Button>
            ) : (
              <Button size="sm" onClick={() => setNoteModal({ open: true })}>
                <Plus size={15} /> Nota
              </Button>
            )}
          </div>
        )}
      </div>

      {tab === "tarefas" ? (
        <TodoBoard
          projectId={projectId}
          todos={todos}
          members={members}
          reminders={reminders}
          notifEnabled={notifEnabled}
          projectOptions={projectOptions}
        />
      ) : empty ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FolderPlus size={22} />
          </div>
          <div>
            <p className="font-medium text-foreground">Nada por aqui ainda</p>
            <p className="text-sm text-muted">Crie categorias e atalhos, ou comece com exemplos.</p>
          </div>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => startTransition(async () => void (await seedOrganizationExamples(projectId)))}
          >
            {pending ? "Criando..." : "Criar exemplos"}
          </Button>
        </Card>
      ) : tab === "atalhos" ? (
        <div className="flex flex-col gap-5">
          {categories.map((cat) => (
            <CategoryBlock
              key={cat.id}
              category={cat}
              shortcuts={grouped.get(cat.id) ?? []}
              onEditCat={() => setCatModal({ open: true, edit: cat })}
              onDeleteCat={() => deleteCategory(cat.id)}
              onEditSc={(s) => setScModal({ open: true, edit: s })}
              onDeleteSc={(id) => deleteShortcut(id)}
            />
          ))}
          {(grouped.get(null)?.length ?? 0) > 0 && (
            <CategoryBlock
              category={null}
              shortcuts={grouped.get(null) ?? []}
              onEditSc={(s) => setScModal({ open: true, edit: s })}
              onDeleteSc={(id) => deleteShortcut(id)}
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma nota ainda.</p>
          ) : (
            notes.map((n) => {
              const mine = !meId || n.owner_id === meId
              // Em projeto, qualquer membro pode editar/excluir (RLS garante o acesso).
              const canManage = mine || projectId !== null
              return (
                <NoteCard
                  key={n.id}
                  note={n}
                  category={categories.find((c) => c.id === n.category_id) ?? null}
                  friends={friends}
                  mine={mine}
                  onEdit={canManage ? () => setNoteModal({ open: true, edit: n }) : undefined}
                  onDelete={canManage ? () => deleteNote(n.id) : undefined}
                />
              )
            })
          )}
        </div>
      )}

      <CategoryModal
        state={catModal}
        onClose={() => setCatModal({ open: false })}
        projectId={projectId}
      />
      <ShortcutModal
        state={scModal}
        onClose={() => setScModal({ open: false })}
        projectId={projectId}
        categories={categories}
      />
      <NoteModal
        state={noteModal}
        onClose={() => setNoteModal({ open: false })}
        projectId={projectId}
        categories={categories}
        friends={friends}
        projectOptions={projectOptions}
      />
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-primary/15 text-primary" : "text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function CategoryBlock({
  category,
  shortcuts,
  onEditCat,
  onDeleteCat,
  onEditSc,
  onDeleteSc,
}: {
  category: ShortcutCategory | null
  shortcuts: Shortcut[]
  onEditCat?: () => void
  onDeleteCat?: () => Promise<{ ok?: boolean; error?: string }>
  onEditSc: (s: Shortcut) => void
  onDeleteSc: (id: string) => Promise<{ ok?: boolean; error?: string }>
}) {
  const color = category?.color ?? "var(--color-muted)"
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          <h2 className="font-display text-base font-semibold text-foreground">
            {category?.name ?? "Sem categoria"}
          </h2>
          <Badge tone="default">{shortcuts.length}</Badge>
        </div>
        {category && (
          <RowActions onEdit={onEditCat} onDelete={onDeleteCat} />
        )}
      </div>
      {shortcuts.length === 0 ? (
        <p className="text-sm text-muted">Nenhum atalho nesta categoria.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {shortcuts.map((s) => (
            <ShortcutRow key={s.id} shortcut={s} onEdit={() => onEditSc(s)} onDelete={() => onDeleteSc(s.id)} />
          ))}
        </div>
      )}
    </Card>
  )
}

function ShortcutRow({
  shortcut,
  onEdit,
  onDelete,
}: {
  shortcut: Shortcut
  onEdit: () => void
  onDelete: () => Promise<{ ok?: boolean; error?: string }>
}) {
  const meta = KIND_META[shortcut.kind] ?? KIND_META.link
  const Icon = meta.icon
  const [copied, setCopied] = React.useState(false)
  const copyText = shortcut.url ?? shortcut.body ?? ""
  const copy = async () => {
    if (!copyText) return
    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {}
  }
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]/50 p-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{shortcut.title}</p>
        {shortcut.url ? (
          <a
            href={shortcut.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 truncate text-xs text-primary hover:underline"
          >
            <ExternalLink size={11} /> <span className="truncate">{shortcut.url}</span>
          </a>
        ) : shortcut.body ? (
          <p className="line-clamp-2 whitespace-pre-wrap text-xs text-muted">{shortcut.body}</p>
        ) : null}
        {/* Pré-visualização de imagem/vídeo/YouTube/biblioteca de anúncios */}
        {detectMedia(shortcut.url) !== "link" ? (
          <MediaPreview url={shortcut.url} title={shortcut.title} />
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {copyText ? (
          <button
            type="button"
            aria-label="Copiar"
            title="Copiar"
            onClick={copy}
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
          >
            {copied ? <Check size={15} className="text-positive" /> : <Copy size={15} />}
          </button>
        ) : null}
        <RowActions onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  )
}

function NoteCard({
  note,
  category,
  friends = [],
  mine = true,
  onEdit,
  onDelete,
}: {
  note: Note
  category: ShortcutCategory | null
  friends?: FriendOption[]
  mine?: boolean
  onEdit?: () => void
  onDelete?: () => Promise<{ ok?: boolean; error?: string }>
}) {
  // Detecta a primeira URL de mídia no corpo da nota para pré-visualizar.
  const mediaUrl = React.useMemo(() => {
    const found = (note.body ?? "").match(/https?:\/\/[^\s]+/g) ?? []
    return found.find((u) => detectMedia(u) !== "link") ?? null
  }, [note.body])

  // Rótulo do badge conforme quem é o dono e o estado de compartilhamento.
  const sharedCount = note.shared_with?.length ?? 0
  const nameOf = (id: string) => friends.find((f) => f.id === id)?.name
  const shareLabel = (() => {
    if (!mine && note.shared_from) return `De ${note.shared_from.name}`
    if (mine && sharedCount > 0) {
      if (sharedCount === 1) {
        const only = note.shared_with![0]
        return `Com ${nameOf(only) ?? "1 amigo"}`
      }
      return `Com ${sharedCount} amigos`
    }
    return null
  })()

  return (
    <Card className={cn("flex flex-col gap-2 p-4", !mine && "border-primary/25 bg-primary/[0.03]")}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-foreground">{note.title}</h3>
        {mine ? <RowActions onEdit={onEdit} onDelete={onDelete} /> : null}
      </div>
      {note.body ? (
        <p className="line-clamp-5 whitespace-pre-wrap text-sm text-muted">{note.body}</p>
      ) : (
        <p className="text-sm text-muted/60">Sem conteúdo.</p>
      )}
      {mediaUrl ? <MediaPreview url={mediaUrl} title={note.title} /> : null}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        {category && (
          <Badge tone="default">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color ?? "var(--color-muted)" }} />
            {category.name}
          </Badge>
        )}
        {shareLabel ? (
          <Badge tone="primary">
            <Users size={11} />
            {shareLabel}
          </Badge>
        ) : (
          <Badge tone="default">
            <Lock size={11} />
            Privada
          </Badge>
        )}
      </div>
    </Card>
  )
}

/* ---------------- Modais ---------------- */

function useFormAction(onDone: () => void) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>) => {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (res?.error) setError(res.error)
      else onDone()
    })
  }
  return { pending, error, run }
}

function CategoryModal({
  state,
  onClose,
  projectId,
}: {
  state: { open: boolean; edit?: ShortcutCategory }
  onClose: () => void
  projectId: string | null
}) {
  const { pending, error, run } = useFormAction(onClose)
  const edit = state.edit
  return (
    <Modal open={state.open} onClose={onClose} title={edit ? "Editar categoria" : "Nova categoria"}>
      <form
        action={(fd) => run(() => (edit ? updateCategory(edit.id, fd) : createCategory(projectId, fd)))}
        className="flex flex-col gap-4"
      >
        <Field label="Nome">
          <Input name="name" defaultValue={edit?.name ?? ""} placeholder="Ex.: Concorrentes" required autoFocus />
        </Field>
        <Field label="Cor">
          <input
            type="color"
            name="color"
            defaultValue={edit?.color ?? "#2de2e6"}
            className="h-10 w-full cursor-pointer rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]"
          />
        </Field>
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

function ShortcutModal({
  state,
  onClose,
  projectId,
  categories,
}: {
  state: { open: boolean; edit?: Shortcut }
  onClose: () => void
  projectId: string | null
  categories: ShortcutCategory[]
}) {
  const { pending, error, run } = useFormAction(onClose)
  const edit = state.edit
  const [kind, setKind] = React.useState<ShortcutKind>(edit?.kind ?? "link")
  const [url, setUrl] = React.useState(edit?.url ?? "")
  React.useEffect(() => {
    if (state.open) {
      setKind(edit?.kind ?? "link")
      setUrl(edit?.url ?? "")
    }
  }, [state.open, edit])
  const usesUrl = kind === "link" || kind === "imagem" || kind === "video"
  return (
    <Modal open={state.open} onClose={onClose} title={edit ? "Editar atalho" : "Novo atalho"}>
      <form
        action={(fd) => run(() => (edit ? updateShortcut(edit.id, fd) : createShortcut(projectId, fd)))}
        className="flex flex-col gap-4"
      >
        <Field label="Título">
          <Input name="title" defaultValue={edit?.title ?? ""} placeholder="Ex.: Anúncio do concorrente X" required autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value as ShortcutKind)}>
              {(Object.keys(KIND_META) as ShortcutKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_META[k].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Categoria">
            <Select name="category_id" defaultValue={edit?.category_id ?? ""}>
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {usesUrl ? (
          <Field label="URL">
            <Input
              name="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://... (imagem, vídeo, YouTube ou biblioteca de anúncios)"
            />
            {detectMedia(url) !== "link" ? <MediaPreview url={url} title="Pré-visualização do atalho" /> : null}
          </Field>
        ) : (
          <input type="hidden" name="url" value="" />
        )}
        <Field label={usesUrl ? "Observação (opcional)" : "Conteúdo"}>
          <Textarea name="body" defaultValue={edit?.body ?? ""} placeholder="Cole aqui o ID, código ou anotação..." />
        </Field>
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

function NoteModal({
  state,
  onClose,
  projectId,
  categories,
  friends = [],
  projectOptions = [],
}: {
  state: { open: boolean; edit?: Note }
  onClose: () => void
  projectId: string | null
  categories: ShortcutCategory[]
  friends?: FriendOption[]
  /** Projetos aos quais a nota pode ser atribuída (páginas globais). */
  projectOptions?: { id: string; name: string }[]
}) {
  const { pending, error, run } = useFormAction(onClose)
  const edit = state.edit
  const [selected, setSelected] = React.useState<string[]>([])
  // Escopo escolhido: "" = pessoal, senão id do projeto. Começa no escopo atual.
  const [scope, setScope] = React.useState<string>(projectId ?? "")

  React.useEffect(() => {
    if (state.open) {
      setSelected(edit?.shared_with ?? [])
      setScope(projectId ?? "")
    }
  }, [state.open, edit, projectId])

  // Só nota pessoal pode ser atribuída a um projeto. Nota já de projeto fica travada nele.
  const showScopePicker = projectOptions.length > 0 && projectId === null
  const scopeChanged = scope !== (projectId ?? "")
  // Compartilhar só quando a nota é/continua pessoal.
  const personal = scope === ""
  // Categoria só faz sentido no escopo atual (ao trocar de escopo ela é zerada).
  const showCategory = !scopeChanged

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <Modal open={state.open} onClose={onClose} title={edit ? "Editar nota" : "Nova nota"}>
      <form
        action={(fd) => run(() => (edit ? updateNote(edit.id, fd) : createNote(scope || null, fd)))}
        className="flex flex-col gap-4"
      >
        <Field label="Título">
          <Input name="title" defaultValue={edit?.title ?? ""} placeholder="Ex.: Ideias de criativo" required autoFocus />
        </Field>
        {/* Ao editar, envia o escopo escolhido para a server action mover a nota. */}
        {edit && <input type="hidden" name="project_id" value={scope} />}
        {showScopePicker && (
          <Field label="Atribuir a" hint="Escolha um projeto ou deixe como nota pessoal.">
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
        {showCategory && (
          <Field label="Categoria">
            <Select name="category_id" defaultValue={edit?.category_id ?? ""}>
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Conteúdo">
          <Textarea name="body" defaultValue={edit?.body ?? ""} className="min-h-32" placeholder="Escreva sua nota..." />
        </Field>

        {personal && (
          <div className="flex flex-col gap-2">
            {/* CSV com os ids selecionados, lido pela server action. */}
            <input type="hidden" name="shared_with" value={selected.join(",")} />
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Users size={14} className="text-primary" />
              Compartilhar com amigos
            </div>
            {friends.length === 0 ? (
              <p className="text-xs text-muted">
                Você ainda não tem amigos. Adicione amigos em Amigos para poder compartilhar notas.
              </p>
            ) : (
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]/50 p-2">
                {friends.map((f) => {
                  const on = selected.includes(f.id)
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggle(f.id)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                        on ? "bg-primary/15 text-primary" : "text-muted hover:bg-white/5 hover:text-foreground",
                      )}
                    >
                      <span className="truncate">{f.name}</span>
                      {on ? <Check size={14} /> : null}
                    </button>
                  )
                })}
              </div>
            )}
            <p className="text-xs text-muted">
              {selected.length === 0
                ? "Nota privada — só você vê."
                : `Compartilhada com ${selected.length} ${selected.length === 1 ? "amigo" : "amigos"}.`}
            </p>
          </div>
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
