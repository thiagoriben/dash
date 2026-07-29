"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { Select } from "@/components/ui"
import type { Project } from "@/lib/types"
import { Filter } from "lucide-react"

export function DashboardFilters({
  projects,
  offerTypes,
}: {
  projects: Project[]
  offerTypes: string[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "") params.delete(key)
    else params.set(key, value)
    startTransition(() => router.push(`/?${params.toString()}`))
  }

  const val = (k: string) => searchParams.get(k) ?? ""

  return (
    <div className="glass flex flex-wrap items-center gap-2 rounded-2xl p-3">
      <div className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted">
        <Filter size={14} className="text-primary" />
        Filtros
      </div>
      <Select
        aria-label="Projeto"
        value={val("project")}
        onChange={(e) => update("project", e.target.value)}
        className="h-9 w-auto min-w-36"
      >
        <option value="">Todos projetos</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Região"
        value={val("region")}
        onChange={(e) => update("region", e.target.value)}
        className="h-9 w-auto"
      >
        <option value="">Região</option>
        <option value="BR">BR</option>
        <option value="LATAM">LATAM</option>
      </Select>
      <Select
        aria-label="Moeda"
        value={val("currency")}
        onChange={(e) => update("currency", e.target.value)}
        className="h-9 w-auto"
      >
        <option value="">Moeda</option>
        <option value="BRL">BRL</option>
        <option value="USD">USD</option>
      </Select>
      {offerTypes.length > 0 ? (
        <Select
          aria-label="Tipo de oferta"
          value={val("offer")}
          onChange={(e) => update("offer", e.target.value)}
          className="h-9 w-auto min-w-32"
        >
          <option value="">Tipo de oferta</option>
          {offerTypes.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      ) : null}
      {pending ? <span className="text-xs text-muted">Atualizando…</span> : null}
    </div>
  )
}
