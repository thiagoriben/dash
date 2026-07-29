"use client"

import { useMemo } from "react"
import type { DailyMetric, Expense, FunnelProduct, Project } from "@/lib/types"
import { toBRL } from "@/lib/currency"
import { computeDre } from "@/lib/finance"
import { formatCurrency, formatPercent } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"

export function TabDre({
  project,
  metrics,
  expenses,
  funnel,
  usdBrl,
}: {
  project: Project
  metrics: DailyMetric[]
  expenses: Expense[]
  funnel: FunnelProduct[]
  usdBrl: number
}) {
  const dre = useMemo(() => {
    const cur = project.currency
    const revenue = metrics.reduce((s, m) => s + toBRL(m.revenue, cur, usdBrl), 0)
    const sales = metrics.reduce((s, m) => s + m.sales, 0)

    const frontCost = funnel.find((f) => f.kind === "front")?.product_cost ?? 0
    const productCost = frontCost * sales

    const gatewayFees = revenue * 0.05
    const taxes = revenue * 0.06

    const metricAdSpend = metrics.reduce((s, m) => s + toBRL(m.spend, cur, usdBrl), 0)
    const expenseAdSpend = expenses
      .filter((e) => e.type === "ads")
      .reduce((s, e) => s + toBRL(e.amount, e.currency, usdBrl), 0)
    const adSpend = Math.max(metricAdSpend, expenseAdSpend)

    const toolSpend = expenses
      .filter((e) => e.type !== "ads")
      .reduce((s, e) => s + toBRL(e.amount, e.currency, usdBrl), 0)

    const r = computeDre({ revenue, productCost, gatewayFees, taxes, adSpend, toolSpend })
    return { revenue, productCost, gatewayFees, taxes, adSpend, toolSpend, ...r }
  }, [metrics, expenses, funnel, project.currency, usdBrl])

  const rows = [
    { label: "Faturamento bruto", value: dre.revenue, kind: "in" as const },
    { label: "(-) Custo dos produtos", value: -dre.productCost, kind: "out" as const },
    { label: "(-) Taxas de gateway (5%)", value: -dre.gatewayFees, kind: "out" as const },
    { label: "(-) Impostos (6%)", value: -dre.taxes, kind: "out" as const },
    { label: "(-) Investimento em tráfego", value: -dre.adSpend, kind: "out" as const },
    { label: "(-) Ferramentas / outros", value: -dre.toolSpend, kind: "out" as const },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-semibold">DRE simplificado</h2>
        <p className="text-sm text-muted">Demonstrativo de resultado do período (valores em BRL).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resultado do período</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between border-b border-[color:var(--color-border)]/60 py-2.5 text-sm"
            >
              <span className="text-muted">{r.label}</span>
              <span className={`font-mono ${r.kind === "out" ? "text-negative" : "text-foreground"}`}>
                {formatCurrency(r.value)}
              </span>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between rounded-xl bg-[color:var(--color-surface-2)] px-3 py-3">
            <span className="font-medium">Lucro líquido</span>
            <span className={`font-mono text-lg font-semibold ${dre.lucroLiquido >= 0 ? "text-positive" : "text-negative"}`}>
              {formatCurrency(dre.lucroLiquido)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between px-3 text-sm">
            <span className="text-muted">Margem líquida</span>
            <span className="font-mono">{formatPercent(dre.margem)}</span>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted">
        Gateway e imposto usam percentuais padrão de mercado (5% e 6%). Ajuste conforme sua operação
        na aba Calculadora.
      </p>
    </div>
  )
}
