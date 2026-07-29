"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { DailyMetric, FunnelProduct, Project } from "@/lib/types"
import { formatCurrency, formatNumber, formatPercent, safeDiv } from "@/lib/utils"
import { Card, CardContent, Button, Field, Input, Select, Badge, Table, Th, Td } from "@/components/ui"
import { Modal } from "@/components/modal"
import { createFunnelProduct, deleteFunnelProduct } from "@/app/actions/projects"
import { Plus, Trash2 } from "lucide-react"

const KINDS: { value: FunnelProduct["kind"]; label: string }[] = [
  { value: "front", label: "Front-end" },
  { value: "orderbump", label: "Order Bump" },
  { value: "upsell", label: "Upsell" },
  { value: "downsell", label: "Downsell" },
]

export function TabFunnel({
  project,
  funnel,
  metrics,
}: {
  project: Project
  funnel: FunnelProduct[]
  metrics: DailyMetric[]
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const router = useRouter()

  const totals = metrics.reduce(
    (a, m) => ({
      impressions: a.impressions + m.impressions,
      clicks: a.clicks + m.clicks,
      checkouts: a.checkouts + m.checkouts_initiated,
      sales: a.sales + m.sales,
    }),
    { impressions: 0, clicks: 0, checkouts: 0, sales: 0 },
  )
  const steps = [
    { label: "Impressões", value: totals.impressions },
    { label: "Cliques", value: totals.clicks },
    { label: "Checkouts", value: totals.checkouts },
    { label: "Vendas", value: totals.sales },
  ]
  const top = steps[0].value || 1

  function onSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const res = await createFunnelProduct(project.id, formData)
      if (res?.error) setError(res.error)
      else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-semibold">Funil</h2>
        <p className="text-sm text-muted">Conversões do período e escada de produtos.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          {steps.map((s, i) => {
            const pct = (s.value / top) * 100
            const conv = i > 0 && steps[i - 1].value > 0 ? safeDiv(s.value, steps[i - 1].value) * 100 : null
            return (
              <div key={s.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted">{s.label}</span>
                  <span className="font-mono">
                    {formatNumber(s.value)}
                    {conv !== null ? <span className="ml-2 text-xs text-muted">({formatPercent(conv)})</span> : null}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[color:var(--color-surface-2)]">
                  <div
                    className="h-full rounded-full bg-primary shadow-[0_0_12px_rgba(45,226,230,0.5)]"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="font-medium">Produtos do funil</h3>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={16} /> Produto
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Produto</Th>
                <Th>Etapa</Th>
                <Th className="text-right">Preço</Th>
                <Th className="text-right">Custo</Th>
                <Th className="text-right">Margem</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {funnel.length === 0 ? (
                <tr>
                  <Td colSpan={6} className="py-10 text-center text-muted">Nenhum produto no funil.</Td>
                </tr>
              ) : (
                funnel.map((p) => {
                  const margin = p.price - p.product_cost
                  return (
                    <tr key={p.id}>
                      <Td>{p.name}</Td>
                      <Td>
                        <Badge>{KINDS.find((k) => k.value === p.kind)?.label ?? p.kind}</Badge>
                      </Td>
                      <Td className="text-right font-mono">{formatCurrency(p.price, project.currency)}</Td>
                      <Td className="text-right font-mono text-muted">{formatCurrency(p.product_cost, project.currency)}</Td>
                      <Td className="text-right font-mono text-positive">{formatCurrency(margin, project.currency)}</Td>
                      <Td className="text-right">
                        <button
                          onClick={() =>
                            startTransition(async () => {
                              await deleteFunnelProduct(project.id, p.id)
                              router.refresh()
                            })
                          }
                          className="text-muted transition-colors hover:text-negative"
                          aria-label="Excluir produto"
                        >
                          <Trash2 size={16} />
                        </button>
                      </Td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo produto do funil">
        <form action={onSubmit} className="flex flex-col gap-4">
          <Field label="Nome">
            <Input name="name" placeholder="Ex: Oferta principal" required />
          </Field>
          <Field label="Etapa">
            <Select name="kind" defaultValue="front">
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço">
              <Input name="price" inputMode="decimal" placeholder="0,00" required />
            </Field>
            <Field label="Custo do produto">
              <Input name="product_cost" inputMode="decimal" placeholder="0,00" />
            </Field>
          </div>
          {error ? <p className="text-sm text-negative">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
