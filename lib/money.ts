import type { CardCharge, CashEntry, DailyMetric, Expense, ProfitBase, Project, Sale, SpendView } from "./types"
import { toBRL } from "./currency"
import { safeDiv } from "./utils"

/**
 * Camada única de dinheiro. Todas as dashs (principal e de projeto) devem
 * derivar seus números daqui para garantir sincronia entre gastos, vendas,
 * cobranças de cartão e caixa.
 */

export type MoneyBreakdown = {
  /** Faturamento líquido (fonte: vendas reais; cai p/ métricas se não houver vendas). */
  revenue: number
  /** Gasto com anúncios (Meta) — máximo entre métricas diárias e despesas tipo "ads". */
  adSpend: number
  /** Total cobrado no cartão (inclui imposto da Meta). */
  cardCharged: number
  /** Imposto do tráfego = max(0, cartão − ads) OU ads * meta_tax_pct quando não há cobrança. */
  trafficTax: number
  /** Gastos de ferramentas/serviços/outros (não-ads). */
  otherSpend: number
  /** Taxas de gateway das vendas. */
  gatewayFees: number
  /** Impostos das vendas (tax_amount). */
  salesTax: number
  /** Entradas/saídas de caixa marcadas para refletir na dash. */
  cashRevenue: number
  cashExpense: number
  salesCount: number
}

export type MoneyOptions = {
  /** % extra somada ao ads p/ estimar imposto da Meta quando não há cobrança lançada. */
  metaTaxPct?: number
}

/** Constrói o breakdown consolidado em BRL a partir de todas as fontes. */
export function buildBreakdown(
  input: {
    projects: Project[]
    metrics: DailyMetric[]
    expenses: Expense[]
    sales: Sale[]
    cardCharges?: CardCharge[]
    cashEntries?: CashEntry[]
  },
  usdBrl: number,
  opts: MoneyOptions = {},
): MoneyBreakdown {
  const currencyOf = new Map(input.projects.map((p) => [p.id, p.currency]))
  const ids = new Set(input.projects.map((p) => p.id))
  const cur = (pid: string) => currencyOf.get(pid) ?? "BRL"

  let metricSpend = 0
  let metricRevenue = 0
  let metricSales = 0
  for (const m of input.metrics) {
    if (!ids.has(m.project_id)) continue
    metricSpend += toBRL(m.spend, cur(m.project_id), usdBrl)
    metricRevenue += toBRL(m.revenue, cur(m.project_id), usdBrl)
    metricSales += m.sales
  }

  let adExpense = 0
  let otherSpend = 0
  for (const e of input.expenses) {
    if (!ids.has(e.project_id)) continue
    const v = toBRL(e.amount, e.currency, usdBrl)
    if (e.type === "ads") adExpense += v
    else otherSpend += v
  }

  const sales = input.sales.filter((s) => ids.has(s.project_id))
  let revenue = 0
  let gatewayFees = 0
  let salesTax = 0
  for (const s of sales) {
    revenue += toBRL(s.net_amount, cur(s.project_id), usdBrl)
    gatewayFees += toBRL(s.fee_amount, cur(s.project_id), usdBrl)
    salesTax += toBRL(s.tax_amount, cur(s.project_id), usdBrl)
  }
  const hasSales = sales.length > 0

  let cardCharged = 0
  for (const c of input.cardCharges ?? []) {
    if (!ids.has(c.project_id)) continue
    cardCharged += toBRL(c.amount, cur(c.project_id), usdBrl)
  }

  const adSpend = Math.max(metricSpend, adExpense)

  // Imposto do tráfego: se há cobrança lançada, usa cartão − ads.
  // Senão, estima com a % da Meta (opcional).
  const metaPct = opts.metaTaxPct ?? 0
  const trafficTax =
    cardCharged > 0 ? Math.max(0, cardCharged - adSpend) : adSpend * (metaPct / 100)

  let cashRevenue = 0
  let cashExpense = 0
  for (const c of input.cashEntries ?? []) {
    if (!c.to_dashboard) continue
    const v = toBRL(c.amount, c.currency ?? "BRL", usdBrl)
    if (c.dashboard_kind === "faturamento") cashRevenue += v
    else if (c.dashboard_kind === "gasto") cashExpense += v
  }

  return {
    revenue: hasSales ? revenue : metricRevenue,
    adSpend,
    cardCharged,
    trafficTax,
    otherSpend,
    gatewayFees,
    salesTax,
    cashRevenue,
    cashExpense,
    salesCount: hasSales ? sales.length : metricSales,
  }
}

/**
 * Gasto exibido conforme a preferência do usuário.
 * Retorna o valor principal, um rótulo e um valor "discreto" opcional (imposto).
 */
export function displaySpend(b: MoneyBreakdown, view: SpendView) {
  const cardTotal = b.cardCharged > 0 ? b.cardCharged : b.adSpend + b.trafficTax
  switch (view) {
    case "ads":
      return { main: b.adSpend, label: "Gasto com anúncios", hint: null as string | null, hintValue: null as number | null }
    case "card":
      return { main: cardTotal, label: "Total cobrado no cartão", hint: null, hintValue: null }
    case "combined":
      return { main: b.adSpend + b.trafficTax, label: "Gasto total (com imposto)", hint: null, hintValue: null }
    case "ads_tax":
      return { main: b.adSpend, label: "Gasto com anúncios", hint: "imposto", hintValue: b.trafficTax }
    case "card_tax":
      return { main: cardTotal, label: "Total cobrado no cartão", hint: "imposto", hintValue: b.trafficTax }
    default:
      return { main: b.adSpend, label: "Gasto com anúncios", hint: null, hintValue: null }
  }
}

/** Gasto usado no cálculo de lucro conforme a base escolhida. */
export function spendForProfit(b: MoneyBreakdown, base: ProfitBase): number {
  const cardTotal = b.cardCharged > 0 ? b.cardCharged : b.adSpend + b.trafficTax
  const adsBasis = base === "ads" ? b.adSpend + b.trafficTax : cardTotal
  return adsBasis + b.otherSpend + b.cashExpense
}

/** Lucro líquido conforme a base de gasto escolhida. */
export function profitOf(b: MoneyBreakdown, base: ProfitBase): number {
  return b.revenue + b.cashRevenue - spendForProfit(b, base)
}

export function roasOf(b: MoneyBreakdown, base: ProfitBase): number {
  const cardTotal = b.cardCharged > 0 ? b.cardCharged : b.adSpend + b.trafficTax
  const denom = base === "ads" ? b.adSpend : cardTotal
  return safeDiv(b.revenue, denom)
}

export function cpaOf(b: MoneyBreakdown, base: ProfitBase): number {
  const cardTotal = b.cardCharged > 0 ? b.cardCharged : b.adSpend + b.trafficTax
  const denom = base === "ads" ? b.adSpend : cardTotal
  return safeDiv(denom, b.salesCount)
}
