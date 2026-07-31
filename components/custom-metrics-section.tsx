"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { CustomMetric, MetricKind, MetricPreset } from "@/lib/types"
import { KpiCard } from "@/components/kpi-card"
import { Modal } from "@/components/modal"
import { Button, Field, Input, Select } from "@/components/ui"
import { formatCurrency, formatNumber } from "@/lib/utils"
import {
  createCustomMetric,
  updateCustomMetric,
  deleteCustomMetric,
  toggleCustomMetric,
  applyX1Preset,
  saveMetricPreset,
  applyMetricPreset,
  deleteMetricPreset,
} from "@/app/actions/metrics"
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  Hash,
  DollarSign,
  Percent,
  BookmarkPlus,
  LayoutGrid,
} from "lucide-react"

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
  presets = [],
}: {
  metrics: CustomMetric[]
  projectId?: string | null
  isX1?: boolean
  presets?: MetricPreset[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [manageOpen, setManageOpen] = useState(false)
  const [editing, setEditing] = useState<CustomMetric | null>(null)
  const [creating, setCreating] = useState(false)
  const [savingPreset, setSavingPreset] = useState(false)
  const [presetName, setPresetName] = useState("")
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
    <>
      {/* Cartões inline (sem seção grande). Só aparecem se houver métricas visíveis. */}
      {visible.length > 0 && (
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

      {/* Botão único compacto para gerenciar KPIs personalizados. */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setManageOpen(true)}>
          <LayoutGrid size={16} /> Personalizar KPIs
          {metrics.length > 0 && <span className="text-xs text-muted">({metrics.length})</span>}
        </Button>
        {visible.length === 0 && isX1 && (
          <Button size="sm" variant="ghost" onClick={() => run(() => applyX1Preset(projectId))} disabled={pending}>
            <Sparkles size={16} /> Preset X1 (mensagens)
          </Button>
        )}
      </div>

      {/* Modal de personalização */}
      <Modal
        open={manageOpen}
        onClose={() => {
          setManageOpen(false)
          setCreating(false)
          setEditing(null)
          setSavingPreset(false)
        }}
        title="Personalizar KPIs"
        description="Adicione, edite, oculte ou reaproveite métricas com presets."
      >
        <div className="flex flex-col gap-4">
          {/* Presets */}
          <div className="rounded-xl border border-[color:var(--color-border)] p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Sparkles size={15} className="text-accent" /> Predefinições
            </div>
            <div className="flex flex-wrap gap-1.5">
              {isX1 && (
                <button
                  onClick={() => run(() => applyX1Preset(projectId))}
                  disabled={pending}
                  className="rounded-lg border border-dashed border-[color:var(--color-border)] px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-foreground"
                >
                  + X1 (mensagens)
                </button>
              )}
              {presets.map((p) => (
                <span key={p.id} className="inline-flex items-center overflow-hidden rounded-lg border border-[color:var(--color-border)] text-xs">
                  <button
                    onClick={() => run(() => applyMetricPreset(projectId, p.id))}
                    disabled={pending}
                    className="px-2.5 py-1 text-muted hover:bg-white/5 hover:text-foreground"
                    title={`Aplicar preset ${p.name}`}
                  >
                    + {p.name} ({p.metrics.length})
                  </button>
                  <button
                    onClick={() => run(() => deleteMetricPreset(p.id))}
                    disabled={pending}
                    className="border-l border-[color:var(--color-border)] px-1.5 py-1 text-muted hover:text-negative"
                    aria-label={`Excluir preset ${p.name}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
              {presets.length === 0 && !isX1 && (
                <span className="text-xs text-muted">Nenhum preset salvo ainda.</span>
              )}
            </div>
            {metrics.length > 0 &&
              (savingPreset ? (
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Nome do preset"
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      run(() => saveMetricPreset(projectId, presetName), () => {
                        setSavingPreset(false)
                        setPresetName("")
                      })
                    }
                    disabled={pending}
                  >
                    Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSavingPreset(false)}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setSavingPreset(true)}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  <BookmarkPlus size={13} /> Salvar métricas atuais como preset
                </button>
              ))}
          </div>

          {/* Lista de métricas */}
          <div className="flex flex-col gap-2">
            {metrics.length === 0 && (
              <p className="py-4 text-center text-sm text-muted">Nenhuma métrica ainda.</p>
            )}
            {metrics.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[color:var(--color-border)] p-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-accent">{KIND_META[m.kind].icon}</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{m.name}</div>
                    <div className="text-xs text-muted">
                      {KIND_META[m.kind].label} · {formatMetric(m)}
                    </div>
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
                    onClick={() => {
                      setEditing(m)
                      setCreating(false)
                    }}
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
          {creating || editing ? (
            <form
              action={editing ? submitEdit : submitCreate}
              className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] p-3"
            >
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
                  <Input
                    name="value"
                    inputMode="decimal"
                    defaultValue={editing ? String(editing.value) : ""}
                    placeholder="0"
                  />
                </Field>
              </div>
              {error && <p className="text-sm text-negative">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setCreating(false)
                    setEditing(null)
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </form>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
              <Plus size={16} /> Criar nova métrica
            </Button>
          )}
          {error && !creating && !editing ? <p className="text-sm text-negative">{error}</p> : null}
        </div>
      </Modal>
    </>
  )
}
