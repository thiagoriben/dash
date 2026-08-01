"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Prefs, Project } from "@/lib/types"
import {
  createProject,
  duplicateProject,
  assignProjectFolder,
  saveProjectFolders,
  saveProjectOrder,
} from "@/app/actions/projects"
import { Button, Badge, Field, Input, Select, Card } from "@/components/ui"
import { Modal } from "@/components/modal"
import { SelectOrOther } from "@/components/select-or-other"
import { EditProjectModal } from "@/components/project/edit-project-modal"
import {
  Plus,
  FolderKanban,
  Globe,
  Lock,
  Users,
  ArrowUpRight,
  Search,
  Copy,
  FolderPlus,
  Folder,
  Pencil,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { DEFAULT_CURRENCIES, DEFAULT_OFFER_TYPES, DEFAULT_REGIONS } from "@/lib/currency"
import { cn } from "@/lib/utils"

const statusTone = {
  ativo: "positive",
  pausado: "warning",
  encerrado: "default",
} as const

const visIcon = { publico: Globe, privado: Lock, restrito: Users }

const GERAL = "Geral"

type VisFilter = "todos" | "privado" | "restrito" | "publico"
const VIS_FILTERS: { key: VisFilter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "privado", label: "Individuais" },
  { key: "restrito", label: "Restritos" },
  { key: "publico", label: "Públicos" },
]

export function ProjectsClient({
  projects,
  prefs,
}: {
  projects: Project[]
  prefs?: Prefs | null
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const [visFilter, setVisFilter] = useState<VisFilter>("todos")
  const [query, setQuery] = useState("")
  const [duplicating, setDuplicating] = useState<Project | null>(null)
  const [editing, setEditing] = useState<Project | null>(null)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [reorderMode, setReorderMode] = useState(false)
  const router = useRouter()

  const folders = useMemo(() => (prefs?.project_folders ?? []).filter(Boolean), [prefs])
  const folderMap = useMemo(() => prefs?.project_folder_map ?? {}, [prefs])
  const folderOf = (p: Project) => folderMap[p.id] || GERAL

  // Aplica a ordem manual salva nas prefs; projetos novos (sem ordem) vão pro fim.
  const ordered = useMemo(() => {
    const order = prefs?.project_order ?? []
    const rank = new Map(order.map((id, i) => [id, i]))
    return [...projects].sort(
      (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    )
  }, [projects, prefs?.project_order])

  const filtered = ordered.filter((p) => {
    if (visFilter !== "todos" && p.visibility !== visFilter) return false
    if (query.trim() && !p.name.toLowerCase().includes(query.trim().toLowerCase())) return false
    return true
  })
  const countBy = (key: VisFilter) =>
    key === "todos" ? projects.length : projects.filter((p) => p.visibility === key).length

  // Seções: "Geral" (sem pasta) primeiro, depois as pastas do usuário — todas sempre visíveis.
  const sections = useMemo(() => {
    const order = [GERAL, ...folders]
    return order.map((folder) => ({
      folder,
      projects: filtered.filter((p) => folderOf(p) === folder),
    }))
  }, [filtered, folders, folderMap])

  const regions = prefs?.regions?.length ? prefs.regions : DEFAULT_REGIONS
  const offers = prefs?.offer_types?.length ? prefs.offer_types : DEFAULT_OFFER_TYPES
  const currencies = prefs?.currencies?.length ? prefs.currencies : DEFAULT_CURRENCIES

  function onSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const res = await createProject(formData)
      if (res?.error) setError(res.error)
      else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  function onDuplicate(formData: FormData) {
    if (!duplicating) return
    setError(undefined)
    startTransition(async () => {
      const res = await duplicateProject(duplicating.id, formData)
      if (res?.error) setError(res.error)
      else {
        setDuplicating(null)
        router.refresh()
      }
    })
  }

  function moveToFolder(projectId: string, folder: string) {
    startTransition(async () => {
      await assignProjectFolder(projectId, folder)
      router.refresh()
    })
  }

  function createFolder(name: string) {
    const clean = name.trim()
    if (!clean) return
    startTransition(async () => {
      await saveProjectFolders([...folders, clean])
      setNewFolderOpen(false)
      router.refresh()
    })
  }

  /** Move um projeto para cima/baixo dentro da sua pasta e persiste a ordem global. */
  function moveProject(sectionItems: Project[], index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= sectionItems.length) return
    const a = sectionItems[index]
    const b = sectionItems[target]
    // Reordena na lista global preservando a ordem das demais.
    const ids = ordered.map((p) => p.id)
    const ia = ids.indexOf(a.id)
    const ib = ids.indexOf(b.id)
    ids[ia] = b.id
    ids[ib] = a.id
    startTransition(async () => {
      await saveProjectOrder(ids)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Projetos</h1>
          <p className="text-sm text-muted">Gerencie suas operações e ofertas.</p>
        </div>
        <div className="flex items-center gap-2">
          {projects.length > 1 && (
            <Button
              variant={reorderMode ? "primary" : "outline"}
              onClick={() => setReorderMode((v) => !v)}
              title="Reordenar projetos"
            >
              <ArrowUpDownIcon />
              <span className="hidden sm:inline">{reorderMode ? "Concluir" : "Reordenar"}</span>
            </Button>
          )}
          <Button variant="outline" onClick={() => setNewFolderOpen(true)}>
            <FolderPlus size={16} />
            <span className="hidden sm:inline">Nova pasta</span>
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            <span className="hidden sm:inline">Novo projeto</span>
          </Button>
        </div>
      </div>

      {projects.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap rounded-xl border border-[color:var(--color-border)] p-1">
            {VIS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setVisFilter(f.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  visFilter === f.key
                    ? "bg-primary text-[color:var(--color-accent-fg)]"
                    : "text-muted hover:text-foreground",
                )}
              >
                {f.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs",
                    visFilter === f.key ? "bg-black/20" : "bg-surface-2 text-muted",
                  )}
                >
                  {countBy(f.key)}
                </span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar projeto…"
              className="h-9 w-[220px] pl-9"
            />
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <FolderKanban size={32} className="text-muted" />
          <div>
            <p className="font-medium text-foreground">Nenhum projeto ainda</p>
            <p className="text-sm text-muted">Crie o primeiro projeto para começar a operar.</p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            Criar projeto
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {sections.map(({ folder, projects: items }) => {
            // "Geral" só aparece se tiver projetos; pastas do usuário aparecem sempre.
            if (folder === GERAL && items.length === 0) return null
            return (
              <section key={folder} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Folder size={16} className="text-muted" />
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
                    {folder}
                  </h2>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-muted">
                    {items.length}
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[color:var(--color-border)] px-4 py-6 text-center text-sm text-muted">
                    Pasta vazia — mova um projeto para cá pelo seletor no card.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((p, i) => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        folders={folders}
                        currentFolder={folderOf(p)}
                        onDuplicate={() => setDuplicating(p)}
                        onEdit={() => setEditing(p)}
                        onMove={(folder) => moveToFolder(p.id, folder)}
                        reorderMode={reorderMode}
                        canUp={i > 0}
                        canDown={i < items.length - 1}
                        onUp={() => moveProject(items, i, -1)}
                        onDown={() => moveProject(items, i, 1)}
                        disabled={pending}
                      />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">
              Nenhum projeto encontrado com esse filtro.
            </p>
          )}
        </div>
      )}

      {/* Novo projeto */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo projeto"
        description="Configure a operação e sua visibilidade."
      >
        <form action={onSubmit} className="flex flex-col gap-4">
          <Field label="Nome">
            <Input name="name" placeholder="Ex.: Oferta X — Emagrecimento" required autoFocus />
          </Field>
          <Field label="Tipo de oferta">
            <SelectOrOther
              name="offer_type"
              options={offers}
              defaultValue={prefs?.offer_type ?? offers[0]}
              placeholder="Descreva o tipo de oferta"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Região">
              <SelectOrOther
                name="region"
                options={regions}
                defaultValue={prefs?.region ?? regions[0]}
                placeholder="Descreva a região"
              />
            </Field>
            <Field label="Moeda">
              <SelectOrOther
                name="currency"
                options={currencies}
                defaultValue={prefs?.currency?.toLowerCase() ?? currencies[0]}
                placeholder="Ex: brl"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select name="status" defaultValue="ativo">
                <option value="ativo">Ativo</option>
                <option value="pausado">Pausado</option>
                <option value="encerrado">Encerrado</option>
              </Select>
            </Field>
            <Field label="Visibilidade">
              <Select name="visibility" defaultValue="privado">
                <option value="privado">Privado</option>
                <option value="publico">Público</option>
                <option value="restrito">Restrito</option>
              </Select>
            </Field>
          </div>
          <Field label="Saldo inicial da carteira (opcional)" hint="Lançado como aporte no caixa do projeto.">
            <Input name="initial_balance" inputMode="decimal" placeholder="0,00" />
          </Field>
          {error ? <p className="text-sm text-negative">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Duplicar projeto */}
      <Modal
        open={!!duplicating}
        onClose={() => setDuplicating(null)}
        title="Duplicar projeto"
        description="Cria uma cópia com os produtos do projeto. Ajuste o que precisar antes de duplicar."
      >
        {duplicating ? (
          <form action={onDuplicate} className="flex flex-col gap-4">
            <Field label="Nome">
              <Input name="name" defaultValue={`${duplicating.name} (cópia)`} required autoFocus />
            </Field>
            <Field label="Tipo de oferta">
              <SelectOrOther
                name="offer_type"
                options={offers}
                defaultValue={duplicating.offer_type?.toLowerCase() ?? offers[0]}
                placeholder="Descreva o tipo de oferta"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Região">
                <SelectOrOther
                  name="region"
                  options={regions}
                  defaultValue={duplicating.region?.toLowerCase() ?? regions[0]}
                  placeholder="Ex: br"
                />
              </Field>
              <Field label="Moeda">
                <SelectOrOther
                  name="currency"
                  options={currencies}
                  defaultValue={duplicating.currency?.toLowerCase() ?? currencies[0]}
                  placeholder="Ex: brl"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <Select name="status" defaultValue={duplicating.status}>
                  <option value="ativo">Ativo</option>
                  <option value="pausado">Pausado</option>
                  <option value="encerrado">Encerrado</option>
                </Select>
              </Field>
              <Field label="Visibilidade">
                <Select name="visibility" defaultValue={duplicating.visibility}>
                  <option value="privado">Privado</option>
                  <option value="publico">Público</option>
                  <option value="restrito">Restrito</option>
                </Select>
              </Field>
            </div>
            <Field label="Pasta">
              <Select name="folder" defaultValue={folderMap[duplicating.id] || GERAL}>
                <option value={GERAL}>{GERAL}</option>
                {folders.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="rounded-lg border border-[color:var(--color-border)] bg-white/[0.02] p-3 text-xs text-muted">
              Serão copiados apenas os produtos. Vendas, gastos, criativos, contas e métricas não
              são duplicados.
            </p>
            {error ? <p className="text-sm text-negative">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setDuplicating(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Duplicando..." : "Duplicar"}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      {/* Editar projeto */}
      {editing ? (
        <EditProjectModal
          project={editing}
          prefs={prefs ?? null}
          canDelete
          onClose={() => setEditing(null)}
        />
      ) : null}

      {/* Nova pasta */}
      <Modal open={newFolderOpen} onClose={() => setNewFolderOpen(false)} title="Nova pasta">
        <form
          action={(fd) => createFolder(String(fd.get("folder_name") ?? ""))}
          className="flex flex-col gap-4"
        >
          <Field label="Nome da pasta" hint="Ex.: Brasil, América Latina, Clientes…">
            <Input name="folder_name" placeholder="Nome da pasta" required autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setNewFolderOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Criando..." : "Criar pasta"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function ArrowUpDownIcon() {
  // Ícone composto simples de reordenar (setas cima/baixo).
  return (
    <span className="flex items-center">
      <ArrowUp size={13} className="-mr-1" />
      <ArrowDown size={13} />
    </span>
  )
}

function ProjectCard({
  project: p,
  folders,
  currentFolder,
  onDuplicate,
  onEdit,
  onMove,
  reorderMode,
  canUp,
  canDown,
  onUp,
  onDown,
  disabled,
}: {
  project: Project
  folders: string[]
  currentFolder: string
  onDuplicate: () => void
  onEdit: () => void
  onMove: (folder: string) => void
  reorderMode?: boolean
  canUp?: boolean
  canDown?: boolean
  onUp?: () => void
  onDown?: () => void
  disabled?: boolean
}) {
  const Vis = visIcon[p.visibility]
  const [folderOpen, setFolderOpen] = useState(false)
  const folderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (folderRef.current && !folderRef.current.contains(e.target as Node)) setFolderOpen(false)
    }
    if (folderOpen) document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [folderOpen])

  return (
    <Card
      className="group flex h-full flex-col overflow-hidden p-5"
      style={p.card_color ? { borderLeft: `3px solid ${p.card_color}` } : undefined}
    >
      <Link href={`/projetos/${p.id}`} prefetch className="block flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-foreground group-hover:text-primary">
            {p.card_color ? (
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: p.card_color }}
              />
            ) : null}
            {p.name}
          </h3>
          <ArrowUpRight
            size={16}
            className="text-muted transition-transform group-hover:-translate-y-0.5 group-hover:text-primary"
          />
        </div>
        {p.offer_type ? <p className="mt-1 text-sm text-muted">{p.offer_type}</p> : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={statusTone[p.status]}>{p.status}</Badge>
          <Badge tone="primary">{p.region}</Badge>
          <Badge tone="secondary">{p.currency}</Badge>
          <Badge tone="default">
            <Vis size={11} />
            {p.visibility}
          </Badge>
        </div>
      </Link>

      <div className="mt-4 flex items-center justify-between gap-1 border-t border-[color:var(--color-border)] pt-3">
        {reorderMode ? (
          <div className="flex items-center gap-1">
            <IconBtn label="Mover para cima" onClick={onUp} disabled={disabled || !canUp}>
              <ArrowUp size={16} />
            </IconBtn>
            <IconBtn label="Mover para baixo" onClick={onDown} disabled={disabled || !canDown}>
              <ArrowDown size={16} />
            </IconBtn>
          </div>
        ) : (
          <div className="relative" ref={folderRef}>
            <IconBtn
              label="Pasta"
              onClick={() => setFolderOpen((v) => !v)}
              disabled={disabled}
              active={currentFolder !== GERAL}
            >
              <Folder size={16} />
            </IconBtn>
            {folderOpen && (
              <div className="absolute bottom-full left-0 z-30 mb-2 w-48 rounded-xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-2)] p-1.5 shadow-2xl">
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Mover para pasta
                </p>
                {[GERAL, ...folders].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      onMove(f)
                      setFolderOpen(false)
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-white/5",
                      currentFolder === f ? "text-primary" : "text-foreground",
                    )}
                  >
                    <Folder size={13} className="shrink-0 text-muted" />
                    <span className="truncate">{f}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-1">
          <IconBtn label="Editar projeto" onClick={onEdit} disabled={disabled}>
            <Pencil size={16} />
          </IconBtn>
          <IconBtn label="Duplicar projeto" onClick={onDuplicate} disabled={disabled}>
            <Copy size={16} />
          </IconBtn>
        </div>
      </div>
    </Card>
  )
}

function IconBtn({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-30",
        active ? "text-primary" : "text-muted",
      )}
    >
      {children}
    </button>
  )
}
