"use client"

import { useMemo, useState } from "react"
import type { DailyMetric, Expense, Product, Project, Sale } from "@/lib/types"
import { computeReal, type RealInputs } from "@/lib/finance"
import { formatCurrency, formatNumber } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, Field, Input } from "@/components/ui"
import { SemaphoreBadge } from "@/components/semaphore"

export function TabCalculator({
  project,
  metrics,
  expenses,
  sales,
  products,
}: {
  project: Project
  metrics: DailyMetric[]
  expenses: Expense[]
  sales: Sale[]
  products: Product[]
}) {
  // prefill a partir de vendas reais (fallback: métricas diárias)
  const salesRevenue = sales.reduce((s, v) => s + v.gross_amount, 0)
  const salesCount = sales.length
  const metricRevenue = metrics.reduce((s, m) => s + m.revenue, 0)
  const metricSalesCount = metrics.reduce((s, m) => s + m.sales, 0)
  const revenue = salesRevenue || metricRevenue
  const salesQty = salesCount || metricSalesCount
  const metricSpend = metrics.reduce((s, m) => s + m.spend, 0)
  const adSpend = expenses.filter((e) => e.type === "ads").reduce((s, e) => s + e.amount, 0)
  const front = products.find((f) => f.kind === "front")

  const [inputs, setInputs] = useState<RealInputs>({
    revenue: revenue || 0,
    sales: salesQty || 0,
    spend: Math.max(metricSpend, adSpend) || 0,
    productCost: front?.product_cost ?? 0,
    gatewayPct: 5,
    taxPct: project.tax_pct || 6,
    targetMarginPct: 30,
  })
  const res = useMemo(() => computeReal(inputs), [inputs])
  const set = (k: keyof RealInputs) => (v: string) =>
    setInputs((s) => ({ ...s, [k]: Number.parseFloat(v.replace(",", ".")) || 0 }))

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Dados da operação</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Field label={`Faturamento (${project.currency})`}>
            <Input inputMode="decimal" value={inputs.revenue} onChange={(e) => set("revenue")(e.target.value)} />
          </Field>
          <Field label="Vendas">
            <Input inputMode="numeric" value={inputs.sales} onChange={(e) => set("sales")(e.target.value)} />
          </Field>
          <Field label={`Gasto ads (${project.currency})`}>
            <Input inputMode="decimal" value={inputs.spend} onChange={(e) => set("spend")(e.target.value)} />
          </Field>
          <Field label="Custo do produto">
            <Input inputMode="decimal" value={inputs.productCost} onChange={(e) => set("productCost")(e.target.value)} />
          </Field>
          <Field label="Gateway (%)">
            <Input inputMode="decimal" value={inputs.gatewayPct} onChange={(e) => set("gatewayPct")(e.target.value)} />
          </Field>
          <Field label="Imposto (%)">
            <Input inputMode="decimal" value={inputs.taxPct} onChange={(e) => set("taxPct")(e.target.value)} />
          </Field>
          <Field label="Margem desejada (%)" className="col-span-2">
            <Input inputMode="decimal" value={inputs.targetMarginPct} onChange={(e) => set("targetMarginPct")(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Resultado</CardTitle>
          <SemaphoreBadge color={res.semaphore} />
        </CardHeader>
        <CardContent className="flex flex-col">
          <Row label="Ticket médio" value={formatCurrency(res.ticketMedio, project.currency)} />
          <Row label="Margem de contribuição" value={formatCurrency(res.margemContribuicao, project.currency)} />
          <Row label="CPA breakeven" value={formatCurrency(res.cpaBreakeven, project.currency)} />
          <Row label="CPA alvo" value={formatCurrency(res.cpaAlvo, project.currency)} />
          <Row label="CPA atual" value={formatCurrency(res.cpaAtual, project.currency)} />
          <Row label="ROAS atual" value={`${formatNumber(res.roas, 2)}x`} />
          <Row label="ROAS mínimo" value={`${formatNumber(res.roasMin, 2)}x`} />
          <p className="mt-3 rounded-xl bg-[color:var(--color-surface-2)] p-3 text-xs text-muted">
            {res.semaphore === "green"
              ? "Escala liberada: CPA atual abaixo do alvo."
              : res.semaphore === "yellow"
                ? "Atenção: lucrativo, mas acima do CPA alvo. Otimize antes de escalar."
                : "Prejuízo: CPA acima do breakeven. Pause ou ajuste a oferta."}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[color:var(--color-border)]/60 py-2 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  )
}
