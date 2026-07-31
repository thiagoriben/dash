"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { CardCharge, CashEntry, CustomMetric, DailyMetric, Expense, Project, Sale, SpendView, ProfitBase, MetricPreset } from "@/lib/types"
import { CustomMetricsSection } from "@/components/custom-metrics-section"
import { timeSeries } from "@/lib/aggregate"
import { buildBreakdown } from "@/lib/money"
import { buildWidget, resolveWidgets, DEFAULT_PROJECT_WIDGETS } from "@/lib/dashboard-widgets"
import { diagnoseFunnel } from "@/lib/finance"
import { toBRL, currencySymbol, normalizeCurrency } from "@/lib/currency"
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

  // ---- Filtro de período ----
  type RangePreset = "7d" | "30d" | "mes" | "tudo" | "custom"
  const [rangePreset, setRangePreset] = useState<RangePreset>("tudo")
  const todayStr = new Date().toISOString().slice(0, 10)
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState(todayStr)

  // Intervalo efetivo [from, to] em YYYY-MM-DD (from vazio = sem limite inferior).
  const range = useMemo(() => {
    const to = rangePreset === "custom" ? customTo || todayStr : todayStr
    if (rangePreset === "tudo") return { from: "", to: "" }
    if (rangePreset === "custom") return { from: customFrom, to }
    const d = new Date(to + "T00:00:00")
    if (rangePreset === "mes") d.setDate(1)
    else d.setDate(d.getDate() - (rangePreset === "7d" ? 6 : 29))
    return { from: d.toISOString().slice(0, 10), to }
  }, [rangePreset, customFrom, customTo, todayStr])

  // Mantém apenas registros cuja data (campo informado) cai no intervalo.
  function inRange(dateVal: string | null | undefined): boolean {
    if (!range.from && !range.to) return true
    const d = String(dateVal ?? "").slice(0, 10)
    if (!d) return false
    if (range.from && d < range.from) return false
    if (range.to && d > range.to) return false
    return true
  }

  const fMetrics = useMemo(() => metrics.filter((m) => inRange(m.date)), [metrics, range])
  const fExpenses = useMemo(() => expenses.filter((e) => inRange(e.spent_at)), [expenses, range])
  const fSales = useMemo(() => sales.filter((s) => inRange(s.sold_at)), [sales, range])
  const fCardCharges = useMemo(() => cardCharges.filter((c) => inRange(c.charged_at)), [cardCharges, range])
  const fCashEntries = useMemo(() => cashEntries.filter((c) => inRange(c.occurred_at)), [cashEntries, range])

  // ---- Moeda de exibição ----
  // "__ind__" ativa o modo individual: cada métrica escolhe sua própria moeda.
  const [displayCur, setDisplayCur] = useState(projectCurrency)
  const individual = displayCur === "__ind__"
  const [perCur, setPerCur] = useState<Record<string, string>>({})
  const displayOptions = useMemo(
    () => Array.from(new Set([projectCurrency, "BRL", ...currencies].map((c) => c.toUpperCase()))),
    [projectCurrency, currencies],
  )
  // Métricas monetárias que aceitam seleção de moeda (as demais são % ou contagem).
  const MONETARY_WIDGETS = useMemo(
    () => new Set(["spend", "revenue", "profit", "cpa", "ticket", "trafficTax", "gatewayFees", "salesTax", "otherSpend"]),
    [],
  )
  // Converte um valor em BRL para uma moeda alvo.
  const brlToCur = (brl: number, cur: string) =>
    normalizeCurrency(cur) === "BRL" ? brl : brl / (usdBrl || 1)
  // Moeda usada no gráfico/série (no modo individual cai para a moeda do projeto).
  const chartCur = individual ? projectCurrency : displayCur
  const brlToDisplay = (brl: number) => brlToCur(brl, chartCur)

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
      buildBreakdown(
        { projects: [project], metrics: fMetrics, expenses: fExpenses, sales: fSales, cardCharges: fCardCharges, cashEntries: fCashEntries },
        usdBrl,
        { metaTaxPct },
      ),
    [project, fMetrics, fExpenses, fSales, fCardCharges, fCashEntries, usdBrl, metaTaxPct],
  )
  // Série do gráfico convertida para a moeda de exibição.
  const series = useMemo(() => {
    const s = timeSeries(fMetrics, [project], usdBrl)
    return s.map((p) => ({ ...p, spend: brlToDisplay(p.spend), revenue: brlToDisplay(p.revenue) }))
  }, [fMetrics, project, usdBrl, displayCur])
  const historyPoints = series.map((s) => ({ date: s.date, liquido: s.revenue - s.spend, faturado: s.revenue }))
  const widgetKeys = resolveWidgets(widgets, DEFAULT_PROJECT_WIDGETS)

  const funnelTot = fMetrics.reduce(
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
        <div className="flex flex-wrap items-center gap-2">
          <HistoryPopover points={historyPoints} />
          <Select
            aria-label="Período"
            value={rangePreset}
            onChange={(e) => setRangePreset(e.target.value as RangePreset)}
            className="h-9 w-auto text-sm"
          >
            <option value="tudo">Todo o período</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="mes">Mês atual</option>
            <option value="custom">Personalizado</option>
          </Select>
          <Select
            aria-label="Moeda de exibição"
            value={displayCur}
            onChange={(e) => setDisplayCur(e.target.value)}
            className="h-9 w-auto text-sm"
            title="Moeda de exibição dos valores"
          >
            {displayOptions.map((c) => (
              <option key={c} value={c}>
                {c} ({currencySymbol(c)})
              </option>
            ))}
            <option value="__ind__">Individual (por métrica)</option>
          </Select>
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

      {(rangePreset === "custom" || (displayCur !== projectCurrency && !individual)) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--color-border)] bg-white/[0.02] px-3 py-2 text-sm">
          {rangePreset === "custom" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">De</span>
              <Input
                type="date"
                value={customFrom}
                max={customTo || todayStr}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 w-auto text-sm"
              />
              <span className="text-xs text-muted">até</span>
              <Input
                type="date"
                value={customTo}
                max={todayStr}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 w-auto text-sm"
              />
            </div>
          )}
          {displayCur !== projectCurrency && !individual && (
            <span className="text-xs text-muted">
              Exibindo em {displayCur} · convertido de {projectCurrency} pela cotação US$ {usdBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {widgetKeys.map((k) => {
          const isMonetary = MONETARY_WIDGETS.has(k)
          // Moeda efetiva: no modo individual usa a escolha da métrica; senão a moeda global.
          const effCur = individual ? perCur[k] ?? projectCurrency : displayCur
          const money = { currency: effCur, toDisplay: (brl: number) => brlToCur(brl, effCur) }
          const w = buildWidget(k, breakdown, view, base, money)
          if (!w) return null
          const action =
            individual && isMonetary ? (
              <CurrencyMini
                value={effCur}
                options={displayOptions}
                onChange={(c) => setPerCur((p) => ({ ...p, [k]: c }))}
              />
            ) : undefined
          return (
            <KpiCard
              key={k}
              label={w.label}
              value={w.value}
              hint={w.hint ?? undefined}
              info={w.desc}
              accent={w.accent}
              action={action}
            />
          )
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
              <SpendRevenueChart data={series} currency={chartCur} />
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

/** Seletor compacto de moeda para uma métrica individual (topo do card). */
function CurrencyMini({
  value,
  options,
  onChange,
}: {
  value: string
  options: string[]
  onChange: (c: string) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-[color:var(--color-border)] p-0.5">
      {options.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`rounded px-1.5 py-0.5 text-[11px] transition-colors ${
            normalizeCurrency(value) === normalizeCurrency(c)
              ? "bg-accent text-accent-fg"
              : "text-muted hover:text-foreground"
          }`}
        >
          {currencySymbol(c)}
        </button>
      ))}
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
