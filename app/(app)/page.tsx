import { redirect } from "next/navigation"
import Link from "next/link"
import {
  getCurrentProfile,
  getVisibleProjects,
  getExpenses,
  getDailyMetrics,
  getProfiles,
  periodStartDate,
  type Period,
} from "@/lib/data"
import { getUsdBrlRate } from "@/lib/currency-server"
import { aggregateTotals, timeSeries, rankProjects } from "@/lib/aggregate"
import { formatCurrency, formatNumber } from "@/lib/utils"
import { KpiCard } from "@/components/kpi-card"
import { SpendRevenueChart } from "@/components/spend-revenue-chart"
import { DashboardFilters } from "@/components/dashboard-filters"
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui"
import { AlertsPanel } from "@/components/alerts-panel"
import { Wallet, TrendingUp, PiggyBank, Target, Rocket, Trophy } from "lucide-react"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")

  const period = (sp.period as Period) ?? "30d"
  const start = periodStartDate(period)
  const usdBrl = await getUsdBrlRate()

  const [allProjects, profiles] = await Promise.all([getVisibleProjects(profile), getProfiles()])

  // aplica filtros
  let projects = allProjects
  if (sp.project) projects = projects.filter((p) => p.id === sp.project)
  if (sp.region) projects = projects.filter((p) => p.region === sp.region)
  if (sp.currency) projects = projects.filter((p) => p.currency === sp.currency)
  if (sp.owner) projects = projects.filter((p) => p.owner_id === sp.owner)
  if (sp.offer) projects = projects.filter((p) => p.offer_type === sp.offer)

  const projectIds = projects.map((p) => p.id)
  const [expenses, metrics] = await Promise.all([
    getExpenses(projectIds, start),
    getDailyMetrics(projectIds, start),
  ])

  const totals = aggregateTotals(metrics, expenses, projects, usdBrl)
  const series = timeSeries(metrics, projects, usdBrl)
  const ranking = rankProjects(metrics, expenses, projects, usdBrl)
  const activeCount = allProjects.filter((p) => p.status === "ativo").length

  const revenueTrend = series.map((s) => s.revenue)
  const spendTrend = series.map((s) => s.spend)
  const offerTypes = Array.from(
    new Set(allProjects.map((p) => p.offer_type).filter(Boolean) as string[]),
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-balance">
          Visão geral
        </h1>
        <p className="text-sm text-muted">
          Olá, {profile.full_name ?? profile.username}. Aqui está o panorama das suas operações.
        </p>
      </div>

      <DashboardFilters projects={allProjects} profiles={profiles} offerTypes={offerTypes} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Gasto total"
          value={formatCurrency(totals.totalSpend)}
          trend={spendTrend}
          icon={<Wallet size={14} />}
          accent="secondary"
        />
        <KpiCard
          label="Faturamento"
          value={formatCurrency(totals.revenue)}
          trend={revenueTrend}
          icon={<TrendingUp size={14} />}
          accent="primary"
        />
        <KpiCard
          label="Lucro líquido"
          value={formatCurrency(totals.profit)}
          icon={<PiggyBank size={14} />}
          accent={totals.profit >= 0 ? "positive" : "negative"}
        />
        <KpiCard
          label="ROAS médio"
          value={`${formatNumber(totals.roas, 2)}x`}
          icon={<Target size={14} />}
          accent="warning"
        />
        <KpiCard
          label="Projetos ativos"
          value={formatNumber(activeCount)}
          icon={<Rocket size={14} />}
          accent="primary"
        />
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
                        <span className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                          {r.project.name}
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
    </div>
  )
}
