"use client"

import type { DailyMetric, Product, Project } from "@/lib/types"
import { formatCurrency, formatNumber, formatPercent, safeDiv } from "@/lib/utils"
import { Card, CardContent, Badge, Table, Th, Td } from "@/components/ui"

const KINDS: { value: Product["kind"]; label: string }[] = [
  { value: "front", label: "Front-end" },
  { value: "orderbump", label: "Order Bump" },
  { value: "upsell", label: "Upsell" },
  { value: "downsell", label: "Downsell" },
]

export function TabFunnel({
  project,
  products,
  metrics,
}: {
  project: Project
  products: Product[]
  metrics: DailyMetric[]
}) {
  const funnel = products.filter((p) => p.in_funnel)

  const totals = metrics.reduce(
    (a, m) => ({
      impressions: a.impressions + m.impressions,
      clicks: a.clicks + m.clicks,
      pageViews: a.pageViews + m.page_views,
      checkouts: a.checkouts + m.checkouts_initiated,
      sales: a.sales + m.sales,
    }),
    { impressions: 0, clicks: 0, pageViews: 0, checkouts: 0, sales: 0 },
  )
  const steps = [
    { label: "Cliques", value: totals.clicks },
    { label: "Visualizações de página", value: totals.pageViews },
    { label: "Checkouts (IC)", value: totals.checkouts },
    { label: "Vendas", value: totals.sales },
  ]
  const top = steps[0].value || 1

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-semibold">Funil</h2>
        <p className="text-sm text-muted">
          Conversões do período e escada de produtos (cadastre produtos na aba Produtos).
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          {steps.map((s, i) => {
            const pct = (s.value / top) * 100
            const conv =
              i > 0 && steps[i - 1].value > 0 ? safeDiv(s.value, steps[i - 1].value) * 100 : null
            return (
              <div key={s.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted">{s.label}</span>
                  <span className="font-mono">
                    {formatNumber(s.value)}
                    {conv !== null ? (
                      <span className="ml-2 text-xs text-muted">({formatPercent(conv)})</span>
                    ) : null}
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

      <h3 className="font-medium">Escada de produtos</h3>
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
              </tr>
            </thead>
            <tbody>
              {funnel.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="py-10 text-center text-muted">
                    Nenhum produto no funil.
                  </Td>
                </tr>
              ) : (
                funnel.map((p) => {
                  const margin = p.price - p.product_cost
                  return (
                    <tr key={p.id}>
                      <Td className="font-medium">{p.name}</Td>
                      <Td>
                        <Badge>{KINDS.find((k) => k.value === p.kind)?.label ?? p.kind}</Badge>
                      </Td>
                      <Td className="text-right font-mono">
                        {formatCurrency(p.price, project.currency)}
                      </Td>
                      <Td className="text-right font-mono text-muted">
                        {formatCurrency(p.product_cost, project.currency)}
                      </Td>
                      <Td className="text-right font-mono text-positive">
                        {formatCurrency(margin, project.currency)}
                      </Td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
