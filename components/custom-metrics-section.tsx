"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { CustomMetric, MetricKind } from "@/lib/types"
import { KpiCard } from "@/components/kpi-card"
import { Modal } from "@/components/modal"
import { Card, CardContent, Button, Field, Input, Select } from "@/components/ui"
import { formatCurrency, formatNumber } from "@/lib/utils"
import {
  createCustomMetric,
  updateCustomMetric,
  deleteCustomMetric,
  toggleCustomMetric,
  applyX1Preset,
} from "@/app/actions/metrics"
import { Sliders, Plus, Pencil, Trash2, Eye, EyeOff, Sparkles, Hash, DollarSign, Percent } from "lucide-react"

const KIND_META: Record<MetricKind, { label: string; icon: React.ReactNode }> = {
  quantidade: { label: "Quantidade", icon: <Hash size={14} /> },
  valor: { label: "Valor (R$)", icon: <DollarSign size={14} /> },
  percentual: { label: "Porcentagem", icon: <Percent size={14} /> },
}

function formatMetric(m: CustomMetric): string {
  if (m.kind === "valor") return formatCurrency(m.value)
  if (m.kind === "percentual") return `${formatNumber(m.value, 1)}%`
  return formatNumber(m.value)
}

export function CustomMetricsSection({
  metrics,
  projectId = null,
  isX1 = false,
}: {
  metrics: CustomMetric[]
  projectId?: string | null
  isX1?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [manageOpen, setManageOpen] = useState(false)
  const [editing, setEditing] = useState<CustomMetric | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string>()

  const visible = metrics.filter((m) => !m.hidden)

  function run(fn: () => Promise<{ error?: string; ok?: boolean }>, after?: () => void) {
    setError(undefined)
    startTransition(async () => {
      const res = await fn()
      if (res?.error) setError(res.error)
      else {
        after?.()
        router.refresh()
      }
    })
  }

  function submitCreate(formData: FormData) {
    run(() => createCustomMetric(projectId, formData), () => setCreating(false))
  }
  function submitEdit(formData: FormData) {
    if (!editing) return
    run(() => updateCustomMetric(editing.id, formData), () => setEditing(null))
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Métricas personalizadas</h2>
          <p className="text-sm text-muted">Crie, edite e organize os indicadores que importam para este painel.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setManageOpen(true)}>
          <Sliders size={16} /> Personalizar
        </Button>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted">
              Nenhuma métrica personalizada ainda.
              {isX1 && " Este projeto é X1 — aplique o preset de mensagens para começar."}
            </p>
            <div className="flex gap-2">
              {isX1 && (
                <Button size="sm" onClick={() => run(() => applyX1Preset(projectId))} disabled={pending}>
                  <Sparkles size={16} /> Aplicar preset X1
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => { setManageOpen(true); setCreating(true) }}>
                <Plus size={16} /> Criar métrica
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {visible.map((m) => (
            <KpiCard
              key={m.id}
              label={m.name}
              value={formatMetric(m)}
              icon={KIND_META[m.kind].icon}
              accent={m.kind === "valor" ? "positive" : m.kind === "percentual" ? "warning" : "primary"}
            />
          ))}
        </div>
      )}

      {/* Modal de personalização */}
      <Modal open={manageOpen} onClose={() => { setManageOpen(false); setCreating(false); setEditing(null) }} title="Personalizar métricas">
        <div className="flex flex-col gap-4">
          {isX1 && (
            <Button size="sm" variant="ghost" onClick={() => run(() => applyX1Preset(projectId))} disabled={pending}>
              <Sparkles size={16} /> Aplicar preset X1 (mensagens)
            </Button>
          )}

          <div className="flex flex-col gap-2">
            {metrics.length === 0 && <p className="py-4 text-center text-sm text-muted">Nenhuma métrica ainda.</p>}
            {metrics.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-[color:var(--color-border)] p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-primary">{KIND_META[m.kind].icon}</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{m.name}</div>
                    <div className="text-xs text-muted">{KIND_META[m.kind].label} · {formatMetric(m)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => run(() => toggleCustomMetric(m.id, !m.hidden))}
                    className="text-muted hover:text-foreground"
                    aria-label={m.hidden ? "Mostrar" : "Ocultar"}
                    disabled={pending}
                  >
                    {m.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    onClick={() => { setEditing(m); setCreating(false) }}
                    className="text-muted hover:text-foreground"
                    aria-label="Editar"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => run(() => deleteCustomMetric(m.id))}
                    className="text-muted hover:text-negative"
                    aria-label="Excluir"
                    disabled={pending}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Form criar/editar */}
          {(creating || editing) ? (
            <form action={editing ? submitEdit : submitCreate} className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] p-3">
              <p className="text-sm font-medium">{editing ? "Editar métrica" : "Nova métrica"}</p>
              <Field label="Nome">
                <Input name="name" defaultValue={editing?.name ?? ""} placeholder="Ex: Conversas iniciadas" required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo">
                  <Select name="kind" defaultValue={editing?.kind ?? "quantidade"}>
                    <option value="quantidade">Quantidade</option>
                    <option value="valor">Valor (R$)</option>
                    <option value="percentual">Porcentagem</option>
                  </Select>
                </Field>
                <Field label="Valor">
                  <Input name="value" inputMode="decimal" defaultValue={editing ? String(editing.value) : ""} placeholder="0" />
                </Field>
              </div>
              {error && <p className="text-sm text-negative">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => { setCreating(false); setEditing(null) }}>Cancelar</Button>
                <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button>
              </div>
            </form>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
              <Plus size={16} /> Criar nova métrica
            </Button>
          )}
        </div>
      </Modal>
    </section>
  )
}
