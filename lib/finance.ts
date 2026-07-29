import { safeDiv, formatCurrency, formatNumber, formatPercent } from "./utils"

export type SemaphoreColor = "green" | "yellow" | "red"

/** ---- Formatação (aliases curtos) ---- */
export function fmtMoney(value: number, currency = "BRL") {
  return formatCurrency(value, currency === "USD" ? "USD" : "BRL")
}
export function fmtNum(value: number, digits = 0) {
  return formatNumber(value, digits)
}
export function fmtPct(value: number, digits = 1) {
  return formatPercent(value, digits)
}
export function fmtDate(value: string | Date | null | undefined) {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value + (value.length === 10 ? "T00:00:00" : "")) : value
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}
export function roas(revenue: number, spend: number) {
  return safeDiv(revenue, spend)
}
export function semaphoreFromRoas(roasValue: number, min = 1, target = 2): SemaphoreColor {
  if (roasValue >= target) return "green"
  if (roasValue >= min) return "yellow"
  return "red"
}

/** ---- Cálculo do líquido de uma venda ---- */
export function computeSaleNet(input: {
  gross: number
  applyFee: boolean
  feePct: number // % gateway (0-100)
  feeFixed: number // taxa fixa gateway
  taxPct: number // % imposto (0-100)
}) {
  const fee = input.applyFee ? input.gross * (input.feePct / 100) + input.feeFixed : 0
  const tax = input.gross * (input.taxPct / 100)
  const net = Math.max(0, input.gross - fee - tax)
  return { fee, tax, net }
}

/** ---- Calculadora: Modo Real ---- */
export type RealInputs = {
  revenue: number // faturamento
  sales: number // vendas
  spend: number // gasto em ads
  productCost: number // custo do produto por venda
  gatewayPct: number // % gateway (0-100)
  taxPct: number // % imposto (0-100)
  targetMarginPct: number // margem de lucro desejada (0-100)
}

export type RealResults = {
  ticketMedio: number
  margemContribuicao: number
  cpaBreakeven: number
  cpaAlvo: number
  cpaAtual: number
  roas: number
  roasMin: number
  semaphore: SemaphoreColor
}

export function computeReal(i: RealInputs): RealResults {
  const ticketMedio = safeDiv(i.revenue, i.sales)
  const margemContribuicao =
    ticketMedio - i.productCost - ticketMedio * (i.gatewayPct / 100) - ticketMedio * (i.taxPct / 100)
  const cpaBreakeven = margemContribuicao
  const cpaAlvo = cpaBreakeven * (1 - i.targetMarginPct / 100)
  const cpaAtual = safeDiv(i.spend, i.sales)
  const roas = safeDiv(i.revenue, i.spend)
  const roasMin = safeDiv(ticketMedio, margemContribuicao)

  let semaphore: SemaphoreColor = "yellow"
  if (cpaAtual > 0) {
    if (cpaAtual <= cpaAlvo) semaphore = "green"
    else if (cpaAtual > cpaBreakeven) semaphore = "red"
    else semaphore = "yellow"
  }

  return { ticketMedio, margemContribuicao, cpaBreakeven, cpaAlvo, cpaAtual, roas, roasMin, semaphore }
}

/** ---- Calculadora: Modo Planejamento ---- */
export type PlanInputs = {
  frontPrice: number
  extras: number // soma de upsells/orderbumps média por venda
  productCost: number
  gatewayPct: number
  taxPct: number
  targetMarginPct: number
  expectedConversionPct: number // conversão esperada (visitante -> venda) %
  budget: number
}

export type Scenario = {
  name: string
  conversionPct: number
  sales: number
  revenue: number
  adSpend: number
  profit: number
  roas: number
}

export type PlanResults = {
  ticket: number
  margemContribuicao: number
  cpaBreakeven: number
  cpaAlvo: number
  roasMin: number
  roasAlvo: number
  suggestedTestBudget: number // por criativo
  scenarios: Scenario[]
  // modo reverso
  salesToBreakeven: number
  salesToTarget: number
}

export function computePlan(i: PlanInputs): PlanResults {
  const ticket = i.frontPrice + i.extras
  const margemContribuicao =
    ticket - i.productCost - ticket * (i.gatewayPct / 100) - ticket * (i.taxPct / 100)
  const cpaBreakeven = margemContribuicao
  const cpaAlvo = cpaBreakeven * (1 - i.targetMarginPct / 100)
  const roasMin = safeDiv(ticket, margemContribuicao)
  const roasAlvo = safeDiv(ticket, cpaAlvo)
  const suggestedTestBudget = cpaBreakeven * 1.75

  const buildScenario = (name: string, factor: number): Scenario => {
    const conversionPct = i.expectedConversionPct * factor
    // custo por visitante estimado a partir do CPA alvo e conversão
    const cpa = cpaAlvo > 0 ? cpaAlvo : cpaBreakeven
    const sales = cpa > 0 ? safeDiv(i.budget, cpa) : 0
    const revenue = sales * ticket
    const adSpend = i.budget
    const profit = sales * margemContribuicao - adSpend
    const roas = safeDiv(revenue, adSpend)
    return { name, conversionPct, sales, revenue, adSpend, profit, roas }
  }

  const scenarios: Scenario[] = [
    buildScenario("Pessimista", 0.6),
    buildScenario("Realista", 1),
    buildScenario("Otimista", 1.5),
  ]

  const salesToBreakeven = margemContribuicao > 0 ? i.budget / margemContribuicao : 0
  const salesToTarget = cpaAlvo > 0 ? i.budget / cpaAlvo : 0

  return {
    ticket,
    margemContribuicao,
    cpaBreakeven,
    cpaAlvo,
    roasMin,
    roasAlvo,
    suggestedTestBudget,
    scenarios,
    salesToBreakeven,
    salesToTarget,
  }
}

/** ---- Semáforo de criativo ---- */
export function creativeSemaphore(
  spend: number,
  sales: number,
  cpaTarget: number,
  testBudget: number,
): SemaphoreColor {
  if (spend >= testBudget && sales === 0) return "red"
  const cpa = safeDiv(spend, sales)
  if (sales > 0 && cpaTarget > 0 && cpa <= cpaTarget) return "green"
  return "yellow"
}

/** ---- DRE ---- */
export type DreInput = {
  revenue: number
  productCost: number
  gatewayFees: number
  taxes: number
  adSpend: number
  toolSpend: number
}

export function computeDre(i: DreInput) {
  const lucroLiquido =
    i.revenue - i.productCost - i.gatewayFees - i.taxes - i.adSpend - i.toolSpend
  const margem = safeDiv(lucroLiquido, i.revenue) * 100
  return { lucroLiquido, margem }
}

/** ---- DRE consolidado a partir de vendas reais + gastos ---- */
export type SaleLike = {
  gross_amount: number
  fee_amount: number
  tax_amount: number
  product_id: string | null
}
export type DreConsolidated = {
  revenue: number
  productCost: number
  gatewayFees: number
  taxes: number
  adSpend: number
  toolSpend: number
  lucroLiquido: number
  margem: number
}

/**
 * Calcula o DRE do período usando as vendas registradas (bruto, taxas e impostos
 * já persistidos por venda) e os gastos. `productCostOf` mapeia product_id -> custo.
 */
export function computeDreFromSales(
  sales: SaleLike[],
  opts: { adSpend: number; toolSpend: number; productCostOf: (id: string | null) => number },
): DreConsolidated {
  const revenue = sales.reduce((s, v) => s + v.gross_amount, 0)
  const gatewayFees = sales.reduce((s, v) => s + v.fee_amount, 0)
  const taxes = sales.reduce((s, v) => s + v.tax_amount, 0)
  const productCost = sales.reduce((s, v) => s + opts.productCostOf(v.product_id), 0)
  const { lucroLiquido, margem } = computeDre({
    revenue,
    productCost,
    gatewayFees,
    taxes,
    adSpend: opts.adSpend,
    toolSpend: opts.toolSpend,
  })
  return {
    revenue,
    productCost,
    gatewayFees,
    taxes,
    adSpend: opts.adSpend,
    toolSpend: opts.toolSpend,
    lucroLiquido,
    margem,
  }
}

/** ---- Imposto do tráfego = cobrança no cartão − gasto em anúncio ---- */
export function computeTrafficTax(adSpend: number, cardCharged: number) {
  const tax = Math.max(0, cardCharged - adSpend)
  const pct = safeDiv(tax, adSpend) * 100
  return { adSpend, cardCharged, tax, pct }
}

/** ---- Recebíveis: calcula a data de recebimento a partir do prazo do gateway ---- */
export function addDays(dateISO: string, days: number): string {
  const base = new Date(dateISO + (dateISO.length === 10 ? "T00:00:00" : ""))
  base.setDate(base.getDate() + days)
  return base.toISOString().slice(0, 10)
}

export function receivableDateFor(
  soldAt: string,
  method: string,
  gateway: { term_days_pix: number; term_days_card: number } | null | undefined,
): { date: string; hasTerm: boolean } {
  if (!gateway) return { date: soldAt, hasTerm: false }
  const isCard = /cart/i.test(method) || method === "cartao" || method === "credit"
  const days = isCard ? gateway.term_days_card : gateway.term_days_pix
  return { date: addDays(soldAt, days), hasTerm: days > 0 }
}

/** Agrupa valores a receber por data (líquido), somente vendas ainda não recebidas. */
export function groupReceivablesByDate(
  sales: {
    receivable_date: string | null
    sold_at: string
    net_amount: number
    received: boolean
  }[],
): { date: string; amount: number; count: number }[] {
  const map = new Map<string, { amount: number; count: number }>()
  for (const s of sales) {
    if (s.received) continue
    const date = s.receivable_date ?? s.sold_at
    const cur = map.get(date) ?? { amount: 0, count: 0 }
    cur.amount += s.net_amount
    cur.count += 1
    map.set(date, cur)
  }
  return [...map.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** ---- Diagnóstico de funil ---- */
export function diagnoseFunnel(m: {
  impressions: number
  clicks: number
  checkouts: number
  sales: number
}) {
  const ctr = safeDiv(m.clicks, m.impressions) * 100
  const pageToCheckout = safeDiv(m.checkouts, m.clicks) * 100
  const checkoutToSale = safeDiv(m.sales, m.checkouts) * 100

  const findings: { level: SemaphoreColor; label: string }[] = []
  if (m.impressions > 0 && ctr < 1)
    findings.push({ level: "red", label: "CTR baixo — problema no criativo" })
  if (m.clicks > 0 && pageToCheckout < 10)
    findings.push({ level: "yellow", label: "Página → checkout baixo — problema na oferta/copy" })
  if (m.checkouts > 0 && checkoutToSale < 30)
    findings.push({
      level: "yellow",
      label: "Checkout → venda baixo — problema em preço/gateway/upsell",
    })
  if (findings.length === 0)
    findings.push({ level: "green", label: "Funil saudável — sem gargalos evidentes" })

  return { ctr, pageToCheckout, checkoutToSale, findings }
}
