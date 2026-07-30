import type { DailyMetric, Expense, Project, Sale } from "./types"
import { toBRL } from "./currency"
import { safeDiv } from "./utils"

export type Totals = {
  spend: number // gasto ads (BRL)
  toolSpend: number // gasto ferramentas/outros (BRL)
  totalSpend: number
  revenue: number
  profit: number
  roas: number
  sales: number
}

export type AggregateOptions = {
  /** Vendas reais; quando presentes, o faturamento vem do líquido das vendas. */
  sales?: Sale[]
  /** Filtra os tipos de gasto considerados (ex.: ["ads"] só conta anúncios). */
  spendTypes?: string[]
}

export function aggregateTotals(
  metrics: DailyMetric[],
  expenses: Expense[],
  projects: Project[],
  usdBrl: number,
  options: AggregateOptions = {},
): Totals {
  const currencyOf = new Map(projects.map((p) => [p.id, p.currency]))
  const projectIds = new Set(projects.map((p) => p.id))

  let metricSpend = 0
  let metricRevenue = 0
  let salesCount = 0
  for (const m of metrics) {
    const cur = currencyOf.get(m.project_id) ?? "BRL"
    metricSpend += toBRL(m.spend, cur, usdBrl)
    metricRevenue += toBRL(m.revenue, cur, usdBrl)
    salesCount += m.sales
  }

  // Faturamento vindo das vendas líquidas (fonte de verdade) quando houver.
  const projSales = (options.sales ?? []).filter((s) => projectIds.has(s.project_id))
  let salesNet = 0
  for (const s of projSales) {
    const cur = currencyOf.get(s.project_id) ?? "BRL"
    salesNet += toBRL(s.net_amount, cur, usdBrl)
  }
  const revenue = projSales.length > 0 ? salesNet : metricRevenue
  const sales = projSales.length > 0 ? projSales.length : salesCount

  // Filtro opcional por tipo de gasto.
  const typeFilter = options.spendTypes
  let adSpend = 0
  let toolSpend = 0
  for (const e of expenses) {
    if (typeFilter && !typeFilter.includes(e.type)) continue
    const v = toBRL(e.amount, e.currency, usdBrl)
    if (e.type === "ads") adSpend += v
    else toolSpend += v
  }

  // Se o filtro exclui "ads", não usar o gasto das métricas diárias.
  const includeAds = !typeFilter || typeFilter.includes("ads")
  const spend = includeAds ? Math.max(metricSpend, adSpend) : 0
  const totalSpend = spend + toolSpend
  const profit = revenue - totalSpend
  const roas = safeDiv(revenue, spend)

  return { spend, toolSpend, totalSpend, revenue, profit, roas, sales }
}

export type TimePoint = { date: string; spend: number; revenue: number }

export function timeSeries(
  metrics: DailyMetric[],
  projects: Project[],
  usdBrl: number,
): TimePoint[] {
  const currencyOf = new Map(projects.map((p) => [p.id, p.currency]))
  const byDate = new Map<string, TimePoint>()
  for (const m of metrics) {
    const cur = currencyOf.get(m.project_id) ?? "BRL"
    const point = byDate.get(m.date) ?? { date: m.date, spend: 0, revenue: 0 }
    point.spend += toBRL(m.spend, cur, usdBrl)
    point.revenue += toBRL(m.revenue, cur, usdBrl)
    byDate.set(m.date, point)
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export type ProjectRank = {
  project: Project
  spend: number
  revenue: number
  profit: number
  roas: number
}

export function rankProjects(
  metrics: DailyMetric[],
  expenses: Expense[],
  projects: Project[],
  usdBrl: number,
  options: AggregateOptions = {},
): ProjectRank[] {
  return projects
    .map((project) => {
      const pm = metrics.filter((m) => m.project_id === project.id)
      const pe = expenses.filter((e) => e.project_id === project.id)
      const ps = (options.sales ?? []).filter((s) => s.project_id === project.id)
      const t = aggregateTotals(pm, pe, [project], usdBrl, {
        sales: ps,
        spendTypes: options.spendTypes,
      })
      return { project, spend: t.totalSpend, revenue: t.revenue, profit: t.profit, roas: t.roas }
    })
    .sort((a, b) => b.profit - a.profit)
}
