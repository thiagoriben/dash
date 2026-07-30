"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Prefs, Project } from "@/lib/types"
import { createProject } from "@/app/actions/projects"
import { Button, Badge, Field, Input, Select, Card } from "@/components/ui"
import { Modal } from "@/components/modal"
import { SelectOrOther } from "@/components/select-or-other"
import { Plus, FolderKanban, Globe, Lock, Users, ArrowUpRight } from "lucide-react"
import { DEFAULT_CURRENCIES, DEFAULT_OFFER_TYPES, DEFAULT_REGIONS } from "@/lib/currency"

const statusTone = {
  ativo: "positive",
  pausado: "warning",
  encerrado: "default",
} as const

const visIcon = { publico: Globe, privado: Lock, restrito: Users }

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
  const router = useRouter()

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
          {projects.map((p) => {
            const Vis = visIcon[p.visibility]
            return (
              <Link key={p.id} href={`/projetos/${p.id}`} prefetch>
                <Card className="group h-full p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-base font-semibold text-foreground group-hover:text-primary">
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
