"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { CardCharge, CashEntry, DailyMetric, Expense, Project, Sale, SpendView, ProfitBase } from "@/lib/types"
import { timeSeries } from "@/lib/aggregate"
import { buildBreakdown } from "@/lib/money"
import { buildWidget, resolveWidgets, DEFAULT_PROJECT_WIDGETS } from "@/lib/dashboard-widgets"
import { diagnoseFunnel } from "@/lib/finance"
import { formatPercent } from "@/lib/utils"
import { KpiCard } from "@/components/kpi-card"
import { SpendRevenueChart } from "@/components/spend-revenue-chart"
import { HistoryPopover } from "@/components/history-popover"
import { Card, CardContent, CardHeader, CardTitle, Button, Field, Input, Select } from "@/components/ui"
import { SemaphoreDot } from "@/components/semaphore"
import { upsertDailyMetric } from "@/app/actions/projects"
import { Plus } from "lucide-react"
import { Modal } from "@/components/modal"

const SPEND_VIEWS: { value: SpendView; label: string }[] = [
  { value: "ads", label: "Anúncios" },
  { value: "card", label: "Cartão" },
  { value: "combined", label: "Total c/ imposto" },
  { value: "ads_tax", label: "Anúncios + imposto" },
  { value: "card_tax", label: "Cartão + imposto" },
]

export function TabOverview({
  project,
  metrics,
  expenses,
  sales,
  cardCharges = [],
  cashEntries = [],
  usdBrl,
  spendView: initialView = "ads",
  profitBase: initialBase = "ads",
  metaTaxPct = 0,
  widgets,
}: {
  project: Project
  metrics: DailyMetric[]
  expenses: Expense[]
  sales: Sale[]
  cardCharges?: CardCharge[]
  cashEntries?: CashEntry[]
  usdBrl: number
  spendView?: SpendView
  profitBase?: ProfitBase
  metaTaxPct?: number
  widgets?: string[]
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const [view, setView] = useState<SpendView>(initialView)
  const [base, setBase] = useState<ProfitBase>(initialBase)
  const router = useRouter()

  const breakdown = useMemo(
    () =>
      buildBreakdown({ projects: [project], metrics, expenses, sales, cardCharges, cashEntries }, usdBrl, {
        metaTaxPct,
      }),
    [project, metrics, expenses, sales, cardCharges, cashEntries, usdBrl, metaTaxPct],
  )
  const series = timeSeries(metrics, [project], usdBrl)
  const historyPoints = series.map((s) => ({ date: s.date, liquido: s.revenue - s.spend, faturado: s.revenue }))
  const widgetKeys = resolveWidgets(widgets, DEFAULT_PROJECT_WIDGETS)

  const funnelTot = metrics.reduce(
    (a, m) => ({
      impressions: a.impressions + m.impressions,
      clicks: a.clicks + m.clicks,
      checkouts: a.checkouts + m.checkouts_initiated,
      sales: a.sales + m.sales,
    }),
    { impressions: 0, clicks: 0, checkouts: 0, sales: 0 },
  )
  const diag = diagnoseFunnel(funnelTot)

  function onSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const res = await upsertDailyMetric(project.id, formData)
      if (res?.error) setError(res.error)
      else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Desempenho</h2>
          <p className="text-sm text-muted">
            Atualiza sozinho com vendas e gastos. Lançar métricas do dia é opcional.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HistoryPopover points={historyPoints} />
          <Select
            aria-label="Como exibir o gasto"
            value={view}
            onChange={(e) => setView(e.target.value as SpendView)}
            className="h-9 w-auto text-sm"
          >
            {SPEND_VIEWS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Base do lucro"
            value={base}
            onChange={(e) => setBase(e.target.value as ProfitBase)}
            className="h-9 w-auto text-sm"
          >
            <option value="ads">Lucro s/ anúncios</option>
            <option value="card">Lucro c/ imposto</option>
          </Select>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus size={16} />
            Métricas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {widgetKeys.map((k) => {
          const w = buildWidget(k, breakdown, view, base)
          if (!w) return null
          return <KpiCard key={k} label={w.label} value={w.value} hint={w.hint ?? undefined} accent={w.accent} />
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Gasto x Faturamento</CardTitle>
          </CardHeader>
          <CardContent>
            {series.length > 1 ? (
              <SpendRevenueChart data={series} />
            ) : (
              <div className="flex h-[280px] items-center justify-center text-center text-sm text-muted">
                Sem métricas ainda — lance o primeiro dia para ver a evolução.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Diagnóstico do funil</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="CTR" value={formatPercent(diag.ctr)} />
              <Metric label="Pág→Check" value={formatPercent(diag.pageToCheckout)} />
              <Metric label="Check→Venda" value={formatPercent(diag.checkoutToSale)} />
            </div>
            <ul className="flex flex-col gap-2">
              {diag.findings.map((f, i) => (
                <li key={i} className="flex items-start gap-2 rounded-xl border border-[color:var(--color-border)] bg-white/[0.02] px-3 py-2 text-sm">
                  <span className="mt-1">
                    <SemaphoreDot color={f.level} />
                  </span>
                  <span className="text-foreground/90">{f.label}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Atualizar métricas do dia" description="Opcional. Preencha só o que quiser — um registro por data, reenviar atualiza os valores.">
        <form action={onSubmit} className="flex flex-col gap-4">
          <Field label="Data">
            <Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Gasto (${project.currency})`}>
              <Input name="spend" inputMode="decimal" placeholder="0,00" />
            </Field>
            <Field label={`Faturamento (${project.currency})`}>
              <Input name="revenue" inputMode="decimal" placeholder="0,00" />
            </Field>
            <Field label="Impressões">
              <Input name="impressions" inputMode="numeric" placeholder="0" />
            </Field>
            <Field label="Cliques">
              <Input name="clicks" inputMode="numeric" placeholder="0" />
            </Field>
            <Field label="Visualizações de página">
              <Input name="page_views" inputMode="numeric" placeholder="0" />
            </Field>
            <Field label="Checkouts iniciados (IC)">
              <Input name="checkouts_initiated" inputMode="numeric" placeholder="0" />
            </Field>
            <Field label="Vendas">
              <Input name="sales" inputMode="numeric" placeholder="0" />
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-white/[0.02] p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-mono text-sm font-semibold text-foreground">{value}</div>
    </div>
  )
}
