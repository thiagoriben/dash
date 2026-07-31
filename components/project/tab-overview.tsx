"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { CardCharge, CashEntry, CustomMetric, DailyMetric, Expense, Project, Sale, SpendView, ProfitBase, MetricPreset } from "@/lib/types"
import { CustomMetricsSection } from "@/components/custom-metrics-section"
import { timeSeries } from "@/lib/aggregate"
import { buildBreakdown } from "@/lib/money"
import { buildWidget, resolveWidgets, DEFAULT_PROJECT_WIDGETS } from "@/lib/dashboard-widgets"
import { diagnoseFunnel } from "@/lib/finance"
import { toBRL, currencySymbol } from "@/lib/currency"
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
  customMetrics = [],
  metricPresets = [],
  currencies = ["BRL", "USD", "EUR"],
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
  customMetrics?: CustomMetric[]
  metricPresets?: MetricPreset[]
  /** Moedas que o usuário acompanha — permite lançar gasto/faturamento em outra moeda. */
  currencies?: string[]
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const [view, setView] = useState<SpendView>(initialView)
  const [base, setBase] = useState<ProfitBase>(initialBase)
  // Data selecionada no modal de métricas. O formulário reflete o registro desse dia,
  // ficando em sincronia com os números que a dashboard já mostra.
  const [metricDate, setMetricDate] = useState(() => new Date().toISOString().slice(0, 10))
  const dayMetric = useMemo(() => metrics.find((m) => m.date === metricDate) ?? null, [metrics, metricDate])
  // Moeda em que o usuário digita gasto/faturamento do dia (o valor é convertido para a moeda do projeto ao salvar).
  const projectCurrency = String(project.currency).toUpperCase()
  const [metricCurrency, setMetricCurrency] = useState(projectCurrency)
  const currencyOptions = useMemo(
    () => Array.from(new Set([projectCurrency, "BRL", ...currencies].map((c) => c.toUpperCase()))),
    [projectCurrency, currencies],
  )
  const router = useRouter()

  /** Converte um valor da moeda digitada para a moeda do projeto (armazenamento). */
  function toProjectCurrency(raw: string): string {
    const n = Number.parseFloat(String(raw ?? "").replace(",", ".")) || 0
    if (n === 0 || metricCurrency === projectCurrency) return String(n)
    const brl = toBRL(n, metricCurrency, usdBrl)
    // De BRL para a moeda do projeto: se o projeto for BRL, fica em BRL; senão divide pela cotação.
    const converted = projectCurrency === "BRL" ? brl : brl / (usdBrl || 1)
    return String(+converted.toFixed(2))
  }

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
    // Converte gasto/faturamento da moeda digitada para a moeda do projeto antes de salvar.
    formData.set("spend", toProjectCurrency(String(formData.get("spend") ?? "")))
    formData.set("revenue", toProjectCurrency(String(formData.get("revenue") ?? "")))
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setMetricDate(new Date().toISOString().slice(0, 10))
              setError(undefined)
              setOpen(true)
            }}
          >
            <Plus size={16} />
            Métricas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {widgetKeys.map((k) => {
          const w = buildWidget(k, breakdown, view, base)
          if (!w) return null
          return <KpiCard key={k} label={w.label} value={w.value} hint={w.hint ?? undefined} info={w.desc} accent={w.accent} />
        })}
      </div>

      <CustomMetricsSection
        metrics={customMetrics}
        projectId={project.id}
        isX1={(project.offer_type ?? "").toLowerCase() === "x1"}
        presets={metricPresets}
      />

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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Atualizar métricas do dia"
        description="Reflete o dia selecionado — os campos já vêm com os valores atuais da dashboard. Reenviar atualiza."
      >
        {/* key força o form a repopular quando a data muda (inputs n��o-controlados). */}
        <form key={metricDate} action={onSubmit} className="flex flex-col gap-4">
          <Field label="Data" hint={dayMetric ? "Já existe registro neste dia — os campos abaixo mostram os valores salvos." : "Sem registro ainda neste dia."}>
            <Input
              name="date"
              type="date"
              value={metricDate}
              onChange={(e) => setMetricDate(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Moeda dos valores"
            hint={
              metricCurrency === projectCurrency
                ? `Valores na moeda do projeto (${projectCurrency}).`
                : `Digite em ${metricCurrency}; será convertido para ${projectCurrency} ao salvar.`
            }
          >
            <Select value={metricCurrency} onChange={(e) => setMetricCurrency(e.target.value)}>
              {currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c} ({currencySymbol(c)})
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Gasto (${metricCurrency})`}>
              <Input name="spend" inputMode="decimal" placeholder="0,00" defaultValue={dayMetric?.spend ? String(dayMetric.spend) : ""} />
            </Field>
            <Field label={`Faturamento (${metricCurrency})`}>
              <Input name="revenue" inputMode="decimal" placeholder="0,00" defaultValue={dayMetric?.revenue ? String(dayMetric.revenue) : ""} />
            </Field>
            <Field label="Impressões">
              <Input name="impressions" inputMode="numeric" placeholder="0" defaultValue={dayMetric?.impressions ? String(dayMetric.impressions) : ""} />
            </Field>
            <Field label="Cliques">
              <Input name="clicks" inputMode="numeric" placeholder="0" defaultValue={dayMetric?.clicks ? String(dayMetric.clicks) : ""} />
            </Field>
            <Field label="Visualizações de página">
              <Input name="page_views" inputMode="numeric" placeholder="0" defaultValue={dayMetric?.page_views ? String(dayMetric.page_views) : ""} />
            </Field>
            <Field label="Checkouts iniciados (IC)">
              <Input name="checkouts_initiated" inputMode="numeric" placeholder="0" defaultValue={dayMetric?.checkouts_initiated ? String(dayMetric.checkouts_initiated) : ""} />
            </Field>
            <Field label="Vendas">
              <Input name="sales" inputMode="numeric" placeholder="0" defaultValue={dayMetric?.sales ? String(dayMetric.sales) : ""} />
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
