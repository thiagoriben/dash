export type Currency = "BRL" | "USD"

export type Profile = {
  id: string
  username: string
  full_name: string | null
  phone: string | null
  role: "admin" | "member"
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
  created_at: string
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
