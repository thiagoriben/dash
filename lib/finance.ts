import { safeDiv } from "./utils"

export type SemaphoreColor = "green" | "yellow" | "red"

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
