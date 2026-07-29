import type { DailyMetric, Expense, Project } from "./types"
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

export function aggregateTotals(
  metrics: DailyMetric[],
  expenses: Expense[],
  projects: Project[],
  usdBrl: number,
): Totals {
  const currencyOf = new Map(projects.map((p) => [p.id, p.currency]))

  let metricSpend = 0
  let revenue = 0
  let sales = 0
  for (const m of metrics) {
    const cur = currencyOf.get(m.project_id) ?? "BRL"
    metricSpend += toBRL(m.spend, cur, usdBrl)
    revenue += toBRL(m.revenue, cur, usdBrl)
    sales += m.sales
  }

  let adSpend = 0
  let toolSpend = 0
  for (const e of expenses) {
    const v = toBRL(e.amount, e.currency, usdBrl)
    if (e.type === "ads") adSpend += v
    else toolSpend += v
  }

  // gasto de ads = maior entre métricas registradas e despesas tipo ads
  const spend = Math.max(metricSpend, adSpend)
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
): ProjectRank[] {
  return projects
    .map((project) => {
      const pm = metrics.filter((m) => m.project_id === project.id)
      const pe = expenses.filter((e) => e.project_id === project.id)
      const t = aggregateTotals(pm, pe, [project], usdBrl)
      return { project, spend: t.totalSpend, revenue: t.revenue, profit: t.profit, roas: t.roas }
    })
    .sort((a, b) => b.profit - a.profit)
}
