"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { DailyMetric, Expense, Project, Sale } from "@/lib/types"
import { toBRL } from "@/lib/currency"
import { computeDreFromSales } from "@/lib/finance"
import { formatCurrency, formatPercent } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, Button, Field, Input } from "@/components/ui"
import { setProjectTax } from "@/app/actions/projects"
import { Settings } from "lucide-react"
import { Modal } from "@/components/modal"

export function TabDre({
  project,
  metrics,
  expenses,
  sales,
  usdBrl,
  isOwner,
}: {
  project: Project
  metrics: DailyMetric[]
  expenses: Expense[]
  sales: Sale[]
  usdBrl: number
  isOwner: boolean
}) {
  const [taxOpen, setTaxOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const dre = useMemo(() => {
    const cur = project.currency
    const metricAdSpend = metrics.reduce((s, m) => s + toBRL(m.spend, cur, usdBrl), 0)
    const expenseAdSpend = expenses
      .filter((e) => e.type === "ads")
      .reduce((s, e) => s + toBRL(e.amount, e.currency, usdBrl), 0)
    const adSpend = Math.max(metricAdSpend, expenseAdSpend)
    const toolSpend = expenses
      .filter((e) => e.type !== "ads")
      .reduce((s, e) => s + toBRL(e.amount, e.currency, usdBrl), 0)

    return computeDreFromSales(sales, {
      adSpend,
      toolSpend,
      productCostOf: () => 0,
    })
  }, [metrics, expenses, sales, project.currency, usdBrl])

  const rows = [
    { label: "Faturamento bruto", value: dre.revenue, kind: "in" as const },
    { label: "(-) Taxas de gateway", value: -dre.gatewayFees, kind: "out" as const },
    { label: `(-) Impostos (${project.tax_pct}%)`, value: -dre.taxes, kind: "out" as const },
    { label: "(-) Investimento em tráfego", value: -dre.adSpend, kind: "out" as const },
    { label: "(-) Ferramentas / outros", value: -dre.toolSpend, kind: "out" as const },
  ]

  function onSaveTax(formData: FormData) {
    const tax = Number.parseFloat(String(formData.get("tax_pct") ?? "0").replace(",", ".")) || 0
    startTransition(async () => {
      await setProjectTax(project.id, tax)
      setTaxOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">DRE simplificado</h2>
          <p className="text-sm text-muted">
            Baseado nas vendas registradas do período (valores em {project.currency}).
          </p>
        </div>
        {isOwner ? (
          <Button size="sm" variant="outline" onClick={() => setTaxOpen(true)}>
            <Settings size={16} /> Imposto ({project.tax_pct}%)
          </Button>
        ) : null}
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
                {formatCurrency(r.value, project.currency)}
              </span>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between rounded-xl bg-[color:var(--color-surface-2)] px-3 py-3">
            <span className="font-medium">Lucro líquido</span>
            <span
              className={`font-mono text-lg font-semibold ${dre.lucroLiquido >= 0 ? "text-positive" : "text-negative"}`}
            >
              {formatCurrency(dre.lucroLiquido, project.currency)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between px-3 text-sm">
            <span className="text-muted">Margem líquida</span>
            <span className="font-mono">{formatPercent(dre.margem)}</span>
          </div>
        </CardContent>
      </Card>

      {sales.length === 0 ? (
        <p className="text-xs text-muted">
          Registre vendas na aba Vendas para o DRE refletir taxas e impostos reais por transação.
        </p>
      ) : null}

      <Modal open={taxOpen} onClose={() => setTaxOpen(false)} title="Imposto do projeto">
        <form action={onSaveTax} className="flex flex-col gap-4">
          <Field label="Alíquota de imposto (%)">
            <Input
              name="tax_pct"
              inputMode="decimal"
              placeholder="Ex: 6"
              defaultValue={project.tax_pct}
            />
          </Field>
          <p className="text-xs text-muted">
            Aplicado no cálculo do líquido de cada nova venda registrada.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setTaxOpen(false)}>
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
