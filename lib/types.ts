export type Currency = "BRL" | "USD"

export type Profile = {
  id: string
  username: string
  full_name: string | null
  phone: string | null
  role: "admin" | "member"
  prefs: Prefs | null
  created_at: string
}

export type Project = {
  id: string
  name: string
  offer_type: string | null
  region: string
  currency: Currency
  status: "ativo" | "pausado" | "encerrado"
  visibility: "privado" | "publico" | "restrito"
  owner_id: string | null
  tax_pct: number
  created_at: string
}

export type Prefs = {
  region?: string
  offer_type?: string
  currency?: Currency
  payment_method?: string
  source?: string
  gateway_id?: string
}

export type Expense = {
  id: string
  project_id: string
  type: "ads" | "ferramenta" | "servico" | "outro"
  category: string | null
  amount: number
  currency: Currency
  description: string | null
  spent_at: string
  recurring: boolean
  created_by: string | null
  created_at: string
}

export type Creative = {
  id: string
  project_id: string
  name: string
  status: "testando" | "escalando" | "pausado" | "morto"
  activated_at: string | null
  spend: number
  sales: number
  revenue: number
  notes: string | null
  created_at: string
}

export type DailyMetric = {
  id: string
  project_id: string
  date: string
  spend: number
  impressions: number
  clicks: number
  checkouts_initiated: number
  sales: number
  revenue: number
}

export type FunnelProduct = {
  id: string
  project_id: string
  name: string
  kind: "front" | "upsell" | "orderbump" | "downsell"
  price: number
  product_cost: number
  created_at: string
}

export type ProfitSplit = {
  id: string
  project_id: string
  user_id: string
  percentage: number
}

export type ProductKind = "front" | "upsell" | "orderbump" | "downsell"

export type PaymentGateway = {
  id: string
  owner_id: string
  name: string
  fee_pct: number
  fee_fixed: number
  created_at: string
}

export type Product = {
  id: string
  project_id: string
  name: string
  kind: ProductKind
  price: number
  product_cost: number
  gateway_id: string | null
  in_funnel: boolean
  position: number
  created_at: string
}

export type Sale = {
  id: string
  project_id: string
  product_id: string | null
  gateway_id: string | null
  gross_amount: number
  apply_gateway_fee: boolean
  fee_amount: number
  tax_amount: number
  net_amount: number
  payment_method: string
  source: string | null
  sold_at: string
  notes: string | null
  created_by: string | null
  created_at: string
}

export type CashEntry = {
  id: string
  owner_id: string
  project_id: string | null
  direction: "entrada" | "saida"
  amount: number
  category: string | null
  description: string | null
  occurred_at: string
  sale_id: string | null
  created_by: string | null
  created_at: string
}
