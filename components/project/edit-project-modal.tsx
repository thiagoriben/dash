"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Prefs, Project } from "@/lib/types"
import { updateProject } from "@/app/actions/projects"
import { Button, Field, Input, Select } from "@/components/ui"
import { Modal } from "@/components/modal"
import { SelectOrOther } from "@/components/select-or-other"
import { DEFAULT_CURRENCIES, DEFAULT_OFFER_TYPES, DEFAULT_REGIONS } from "@/lib/currency"

export function EditProjectModal({
  project,
  prefs,
  onClose,
}: {
  project: Project
  prefs: Prefs | null
  onClose: () => void
}) {
  const [open, setOpen] = useState(true)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const router = useRouter()

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
    </>
  )
}
