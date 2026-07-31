"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Prefs, Project } from "@/lib/types"
import { deleteProject, updateProject } from "@/app/actions/projects"
import { Button, Field, Input, Select } from "@/components/ui"
import { Modal } from "@/components/modal"
import { SelectOrOther } from "@/components/select-or-other"
import { DEFAULT_CURRENCIES, DEFAULT_OFFER_TYPES, DEFAULT_REGIONS } from "@/lib/currency"
import { Trash2 } from "lucide-react"

const CARD_COLORS = ["#29f57e", "#2de2e6", "#f59e0b", "#ef4444", "#3b82f6", "#e879f9"]

export function EditProjectModal({
  project,
  prefs,
  canDelete,
  onClose,
}: {
  project: Project
  prefs: Prefs | null
  canDelete?: boolean
  onClose: () => void
}) {
  const [open, setOpen] = useState(true)
  const [error, setError] = useState<string>()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [cardColor, setCardColor] = useState(project.card_color ?? "")
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function onDelete() {
    setError(undefined)
    startTransition(async () => {
      const res = await deleteProject(project.id)
      if (res?.error) setError(res.error)
      else router.push("/projetos")
    })
  }

  function close() {
    setOpen(false)
    onClose()
  }

  const regions = prefs?.regions?.length ? prefs.regions : DEFAULT_REGIONS
  const offers = prefs?.offer_types?.length ? prefs.offer_types : DEFAULT_OFFER_TYPES
  const currencies = prefs?.currencies?.length ? prefs.currencies : DEFAULT_CURRENCIES

  function onSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const res = await updateProject(project.id, formData)
      if (res?.error) setError(res.error)
      else {
        router.refresh()
        close()
      }
    })
  }

  return (
    <>
      <Modal open={open} onClose={close} title="Editar projeto">
        <form action={onSubmit} className="flex flex-col gap-4">
          <Field label="Nome">
            <Input name="name" defaultValue={project.name} required autoFocus />
          </Field>
          <Field label="Tipo de oferta">
            <SelectOrOther
              name="offer_type"
              options={offers}
              defaultValue={project.offer_type?.toLowerCase() ?? offers[0]}
              placeholder="Descreva o tipo de oferta"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Região">
              <SelectOrOther
                name="region"
                options={regions}
                defaultValue={project.region?.toLowerCase() ?? regions[0]}
                placeholder="Ex: br"
              />
            </Field>
            <Field label="Moeda">
              <SelectOrOther
                name="currency"
                options={currencies}
                defaultValue={project.currency?.toLowerCase() ?? currencies[0]}
                placeholder="Ex: brl"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select name="status" defaultValue={project.status}>
                <option value="ativo">Ativo</option>
                <option value="pausado">Pausado</option>
                <option value="encerrado">Encerrado</option>
              </Select>
            </Field>
            <Field label="Visibilidade">
              <Select name="visibility" defaultValue={project.visibility}>
                <option value="privado">Privado</option>
                <option value="publico">Público</option>
                <option value="restrito">Restrito</option>
              </Select>
            </Field>
          </div>
          <Field label="Cor do card (opcional)">
            <div className="flex flex-wrap items-center gap-2">
              {CARD_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCardColor(c)}
                  aria-label={`Cor ${c}`}
                  aria-pressed={cardColor === c}
                  className="h-7 w-7 rounded-full border border-border transition-transform data-[on=true]:scale-110 data-[on=true]:ring-2 data-[on=true]:ring-offset-2 data-[on=true]:ring-offset-[color:var(--color-surface)]"
                  data-on={cardColor === c}
                  style={{ backgroundColor: c, ...(cardColor === c ? { boxShadow: `0 0 0 2px ${c}` } : {}) }}
                />
              ))}
              <input
                type="color"
                value={cardColor || "#29f57e"}
                onChange={(e) => setCardColor(e.target.value)}
                aria-label="Cor personalizada"
                className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent"
              />
              <button
                type="button"
                onClick={() => setCardColor("")}
                className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-white/5 hover:text-foreground"
              >
                Nenhuma
              </button>
            </div>
            <input type="hidden" name="card_color" value={cardColor} />
          </Field>

          {error ? <p className="text-sm text-negative">{error}</p> : null}
          <div className="flex items-center justify-between gap-2">
            {canDelete ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-negative">Excluir mesmo?</span>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onDelete}
                    disabled={pending}
                    className="text-negative hover:bg-negative/10"
                  >
                    <Trash2 size={14} /> {pending ? "Excluindo..." : "Confirmar"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Não
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  className="text-negative hover:bg-negative/10"
                >
                  <Trash2 size={14} /> Excluir
                </Button>
              )
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  )
}
