import { redirect } from "next/navigation"
import Link from "next/link"
import {
  getCurrentProfile,
  getVisibleProjects,
  getOwnedProjectIds,
  getExpenses,
  getDailyMetrics,
  getSales,
  getCardCharges,
  getCashEntries,
  resolveRange,
  type Period,
} from "@/lib/data"
import { getUsdBrlRate } from "@/lib/currency-server"
import { DEFAULT_CURRENCIES, DEFAULT_REGIONS } from "@/lib/currency"
import { timeSeries, rankProjects } from "@/lib/aggregate"
import { buildBreakdown } from "@/lib/money"
import {
  buildWidget,
  resolveWidgets,
  DEFAULT_DASH_WIDGETS,
  WIDGET_LABELS,
  type WidgetKey,
} from "@/lib/dashboard-widgets"
import type { SpendView, ProfitBase } from "@/lib/types"
import { formatCurrency, formatNumber } from "@/lib/utils"
import { KpiCard } from "@/components/kpi-card"
import { SpendRevenueChart } from "@/components/spend-revenue-chart"
import { DashboardControls } from "@/components/dashboard-controls"
import { HistoryPopover } from "@/components/history-popover"
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui"
import { AlertsPanel } from "@/components/alerts-panel"
import { Rocket, Trophy } from "lucide-react"

const ALL_WIDGETS = Object.keys(WIDGET_LABELS) as WidgetKey[]

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")

  const period = (sp.period as Period) ?? "30d"
  const { from, to } = resolveRange(period, { from: sp.from ?? null, to: sp.to ?? null })
  const usdBrl = await getUsdBrlRate()

  const spendView: SpendView = (sp.sv as SpendView) ?? profile.prefs?.spend_view ?? "ads"
  const profitBase: ProfitBase = (sp.pb as ProfitBase) ?? profile.prefs?.profit_base ?? "ads"
  const metaTaxPct = profile.prefs?.meta_tax_pct ?? 0

  const [allProjects, ownedIds] = await Promise.all([
    getVisibleProjects(profile),
    getOwnedProjectIds(profile),
  ])

  // Aplica filtros (região/moeda/oferta case-insensitive).
  let projects = allProjects
  if (sp.project) projects = projects.filter((p) => p.id === sp.project)
  if (sp.region) projects = projects.filter((p) => p.region?.toLowerCase() === sp.region!.toLowerCase())
  if (sp.currency) projects = projects.filter((p) => p.currency?.toUpperCase() === sp.currency!.toUpperCase())
  if (sp.offer) projects = projects.filter((p) => p.offer_type?.toLowerCase() === sp.offer!.toLowerCase())

  const projectIds = projects.map((p) => p.id)
  const [expenses, metrics, sales, cardCharges, allCash] = await Promise.all([
    getExpenses(projectIds, from, to),
    getDailyMetrics(projectIds, from, to),
    getSales(projectIds, from, to),
    getCardCharges(projectIds, from, to),
    getCashEntries(profile),
  ])

  // Caixa que reflete na dash: dentro do período e ligado a projetos filtrados (ou pessoal opt-in).
  const idSet = new Set(projectIds)
  const cashEntries = allCash.filter((c) => {
    if (!c.to_dashboard) return false
    if (from && c.occurred_at < from) return false
    if (to && c.occurred_at > to) return false
    return c.project_id === null || idSet.has(c.project_id)
  })

  const breakdown = buildBreakdown(
    { projects, metrics, expenses, sales, cardCharges, cashEntries },
    usdBrl,
    { metaTaxPct },
  )

  const series = timeSeries(metrics, projects, usdBrl)
  const ranking = rankProjects(metrics, expenses, projects, usdBrl, { sales })

  const revenueTrend = series.map((s) => s.revenue)
  const spendTrend = series.map((s) => s.spend)
  const historyPoints = series.map((s) => ({
    date: s.date,
    liquido: s.revenue - s.spend,
    faturado: s.revenue,
  }))

  const offerTypes = Array.from(new Set(allProjects.map((p) => p.offer_type).filter(Boolean) as string[]))
  const regions = profile.prefs?.regions?.length ? profile.prefs.regions : DEFAULT_REGIONS
  const currencies = profile.prefs?.currencies?.length ? profile.prefs.currencies : DEFAULT_CURRENCIES

  const widgetKeys = resolveWidgets(profile.prefs?.dash_widgets, DEFAULT_DASH_WIDGETS)
  const trendFor = (k: WidgetKey) =>
    k === "revenue" ? revenueTrend : k === "spend" ? spendTrend : undefined

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-balance">Meu painel</h1>
          <p className="text-sm text-muted">
            Olá, {profile.full_name ?? profile.username}. Resultados dos seus projetos
            {ownedIds.size < allProjects.length ? " e colaborações" : ""}.
          </p>
        </div>
        {allProjects.length > 0 && (
          <div className="flex items-center gap-2">
            <HistoryPopover points={historyPoints} />
            <DashboardControls
              projects={allProjects}
              offerTypes={offerTypes}
              regions={regions}
              currencies={currencies}
              spendView={spendView}
              profitBase={profitBase}
              metaTaxPct={metaTaxPct}
              widgets={widgetKeys}
              allWidgets={ALL_WIDGETS}
              scope="dash"
            />
          </div>
        )}
      </div>

      {allProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Rocket size={28} className="text-primary" />
            <div className="flex flex-col gap-1">
              <p className="font-medium text-foreground">Você ainda não tem projetos</p>
              <p className="text-sm text-muted">
                Crie seu primeiro projeto para acompanhar gastos, criativos e lucro.
              </p>
            </div>
            <Link
              href="/projetos"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-[var(--accent-fg)] hover:opacity-90"
            >
              Criar projeto
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {widgetKeys.map((k) => {
              const w = buildWidget(k, breakdown, spendView, profitBase)
              return (
                <KpiCard
                  key={k}
                  label={w.hint ? `${w.label} · ${w.hint}` : w.label}
                  value={w.value}
                  trend={trendFor(k)}
                  accent={w.accent}
                />
              )
            })}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Gasto x Faturamento</CardTitle>
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-primary" /> Faturamento
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-secondary" /> Gasto
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {series.length > 1 ? (
                  <SpendRevenueChart data={series} />
                ) : (
                  <div className="flex h-[280px] items-center justify-center text-center text-sm text-muted">
                    Sem métricas diárias no período — registre dados para ver a evolução.
                  </div>
                )}
              </CardContent>
            </Card>

            <AlertsPanel ranking={ranking} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy size={16} className="text-warning" />
                Ranking de projetos por lucro
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ranking.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted">
                  Nenhum projeto no período — crie seu primeiro projeto em Projetos.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {ranking.slice(0, 8).map((r, i) => {
                    const max = Math.max(...ranking.map((x) => Math.abs(x.profit)), 1)
                    const width = (Math.abs(r.profit) / max) * 100
                    const positive = r.profit >= 0
                    return (
                      <Link
                        key={r.project.id}
                        href={`/projetos/${r.project.id}`}
                        className="group flex items-center gap-4 rounded-xl px-2 py-2 hover:bg-white/5"
                      >
                        <span className="w-5 text-center font-mono text-sm text-muted">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                                {r.project.name}
                              </span>
                              {!ownedIds.has(r.project.id) ? <Badge tone="secondary">Colaboração</Badge> : null}
                            </span>
                            <span
                              className={`font-mono text-sm font-semibold ${positive ? "text-positive" : "text-negative"}`}
                            >
                              {formatCurrency(r.profit)}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                            <div
                              className={`h-full rounded-full ${positive ? "bg-positive/70" : "bg-negative/70"}`}
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                        <Badge tone="default">{formatNumber(r.roas, 2)}x</Badge>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
