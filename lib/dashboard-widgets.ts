import type { MoneyBreakdown } from "./money"
import { displaySpend, profitOf, roasOf, cpaOf } from "./money"
import type { ProfitBase, SpendView } from "./types"
import { formatCurrency, formatNumber, safeDiv } from "./utils"

export type WidgetKey =
  | "spend"
  | "revenue"
  | "profit"
  | "roas"
  | "cpa"
  | "ticket"
  | "trafficTax"
  | "gatewayFees"
  | "salesTax"
  | "otherSpend"
  | "margin"
  | "sales"

export type WidgetDef = {
  key: WidgetKey
  label: string
  value: string
  /** Valor discreto exibido ao lado (ex.: imposto embutido no gasto). */
  hint?: string | null
  accent: "primary" | "positive" | "negative" | "warning" | "secondary"
}

/** Widgets padrão da dashboard principal (na ordem exibida). */
export const DEFAULT_DASH_WIDGETS: WidgetKey[] = ["spend", "revenue", "profit", "roas", "sales"]
export const DEFAULT_PROJECT_WIDGETS: WidgetKey[] = [
  "spend",
  "revenue",
  "profit",
  "roas",
  "cpa",
  "ticket",
]

export const WIDGET_LABELS: Record<WidgetKey, string> = {
  spend: "Gasto",
  revenue: "Faturamento líquido",
  profit: "Lucro líquido",
  roas: "ROAS",
  cpa: "CPA (custo por venda)",
  ticket: "Ticket médio",
  trafficTax: "Imposto do tráfego",
  gatewayFees: "Taxas de gateway",
  salesTax: "Impostos das vendas",
  otherSpend: "Outros gastos",
  margin: "Margem líquida",
  sales: "Vendas",
}

/** Constrói a definição de um widget a partir do breakdown consolidado. */
export function buildWidget(
  key: WidgetKey,
  b: MoneyBreakdown,
  view: SpendView,
  base: ProfitBase,
): WidgetDef {
  const profit = profitOf(b, base)
  const revenueTotal = b.revenue + b.cashRevenue
  switch (key) {
    case "spend": {
      const d = displaySpend(b, view)
      return {
        key,
        label: d.label,
        value: formatCurrency(d.main),
        hint: d.hint && d.hintValue != null ? `${d.hint} ${formatCurrency(d.hintValue)}` : null,
        accent: "secondary",
      }
    }
    case "revenue":
      return { key, label: WIDGET_LABELS.revenue, value: formatCurrency(revenueTotal), accent: "primary" }
    case "profit":
      return {
        key,
        label: WIDGET_LABELS.profit,
        value: formatCurrency(profit),
        accent: profit >= 0 ? "positive" : "negative",
      }
    case "roas":
      return { key, label: WIDGET_LABELS.roas, value: `${formatNumber(roasOf(b, base), 2)}x`, accent: "warning" }
    case "cpa":
      return { key, label: WIDGET_LABELS.cpa, value: formatCurrency(cpaOf(b, base)), accent: "secondary" }
    case "ticket":
      return {
        key,
        label: WIDGET_LABELS.ticket,
        value: formatCurrency(safeDiv(revenueTotal, b.salesCount)),
        accent: "primary",
      }
    case "trafficTax":
      return { key, label: WIDGET_LABELS.trafficTax, value: formatCurrency(b.trafficTax), accent: "warning" }
    case "gatewayFees":
      return { key, label: WIDGET_LABELS.gatewayFees, value: formatCurrency(b.gatewayFees), accent: "secondary" }
    case "salesTax":
      return { key, label: WIDGET_LABELS.salesTax, value: formatCurrency(b.salesTax), accent: "warning" }
    case "otherSpend":
      return { key, label: WIDGET_LABELS.otherSpend, value: formatCurrency(b.otherSpend), accent: "secondary" }
    case "margin":
      return {
        key,
        label: WIDGET_LABELS.margin,
        value: `${formatNumber(safeDiv(profit, revenueTotal) * 100, 1)}%`,
        accent: profit >= 0 ? "positive" : "negative",
      }
    case "sales":
      return { key, label: WIDGET_LABELS.sales, value: formatNumber(b.salesCount), accent: "primary" }
    default:
      return { key, label: key, value: "—", accent: "primary" }
  }
}

/** Normaliza a lista de widgets salva, removendo inválidos e mantendo a ordem. */
export function resolveWidgets(saved: string[] | undefined, fallback: WidgetKey[]): WidgetKey[] {
  if (!saved || saved.length === 0) return fallback
  const valid = saved.filter((k): k is WidgetKey => k in WIDGET_LABELS)
  return valid.length ? valid : fallback
}
