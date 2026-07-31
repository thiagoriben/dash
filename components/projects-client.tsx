"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Prefs, Project } from "@/lib/types"
import { createProject } from "@/app/actions/projects"
import { Button, Badge, Field, Input, Select, Card } from "@/components/ui"
import { Modal } from "@/components/modal"
import { SelectOrOther } from "@/components/select-or-other"
import { Plus, FolderKanban, Globe, Lock, Users, ArrowUpRight, Search } from "lucide-react"
import { DEFAULT_CURRENCIES, DEFAULT_OFFER_TYPES, DEFAULT_REGIONS } from "@/lib/currency"
import { cn } from "@/lib/utils"

const statusTone = {
  ativo: "positive",
  pausado: "warning",
  encerrado: "default",
} as const

const visIcon = { publico: Globe, privado: Lock, restrito: Users }

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
  const router = useRouter()

  const filtered = projects.filter((p) => {
    if (visFilter !== "todos" && p.visibility !== visFilter) return false
    if (query.trim() && !p.name.toLowerCase().includes(query.trim().toLowerCase())) return false
    return true
  })
  const countBy = (key: VisFilter) =>
    key === "todos" ? projects.length : projects.filter((p) => p.visibility === key).length

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Projetos</h1>
          <p className="text-sm text-muted">Gerencie suas operações e ofertas.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} />
          Novo projeto
        </Button>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-muted">
              Nenhum projeto encontrado com esse filtro.
            </p>
          )}
          {filtered.map((p) => {
            const Vis = visIcon[p.visibility]
            return (
              <Link key={p.id} href={`/projetos/${p.id}`} prefetch>
                <Card
                  className="group h-full overflow-hidden p-5"
                  style={
                    p.card_color
                      ? { borderLeft: `3px solid ${p.card_color}` }
                      : undefined
                  }
                >
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
                  {p.offer_type ? (
                    <p className="mt-1 text-sm text-muted">{p.offer_type}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone[p.status]}>{p.status}</Badge>
                    <Badge tone="primary">{p.region}</Badge>
                    <Badge tone="secondary">{p.currency}</Badge>
                    <Badge tone="default">
                      <Vis size={11} />
                      {p.visibility}
                    </Badge>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

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
    </div>
  )
}
