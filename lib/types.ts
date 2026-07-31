/** Moeda: código ISO em maiúsculo ("BRL", "USD", ...). Aceita qualquer código cadastrado. */
export type Currency = string

export type Profile = {
  id: string
  username: string
  full_name: string | null
  phone: string | null
  role: "admin" | "member"
  approved: boolean
  is_public: boolean
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
  /** Listas editáveis (globais) em minúsculo. */
  regions?: string[]
  currencies?: string[]
  offer_types?: string[]
  sources?: string[]
  sidebar_collapsed?: boolean
  /** % extra somada ao gasto de ads para estimar o total com impostos da Meta. */
  meta_tax_pct?: number
  /** Como exibir o gasto na dashboard. */
  spend_view?: SpendView
  /** Base do cálculo de lucro. */
  profit_base?: ProfitBase
  /** Configuração dos widgets/KPIs da dashboard principal. */
  dash_widgets?: string[]
  /** Configuração dos widgets/KPIs da dashboard de projeto. */
  project_widgets?: string[]
  /** Email opcional para recuperação de senha. */
  recovery_email?: string
  /** Cor de destaque do app (hex). Aplicada globalmente. */
  accent_color?: string
  /** Cores de badges por chave (ex.: "usd", "br", "latam"). */
  badge_colors?: Record<string, string>
  /** Participa do ranking interno de faturamento (opt-in). */
  ranking_opt_in?: boolean
  /** Mostra o nome/username no ranking (senão, anônimo). */
  ranking_show_name?: boolean
  /** Mostra o valor de faturamento no ranking (senão, oculto). */
  ranking_show_revenue?: boolean
  /** Cotações fixas editáveis por par "BRL-USD" -> valor da moeda em BRL. */
  currency_overrides?: Record<string, number>
  /** Presets de métricas salvos pelo usuário. */
  metric_presets?: MetricPreset[]
}

/** Preset de métricas reutilizável nas dashboards. */
export type MetricPreset = {
  id: string
  name: string
  metrics: { name: string; kind: MetricKind }[]
}

/** Como o gasto aparece na dashboard. */
export type SpendView =
  | "ads" // só gasto com anúncios
  | "card" // total cobrado no cartão
  | "combined" // gasto já com a cobrança (total)
  | "ads_tax" // ads + imposto discreto ao lado
  | "card_tax" // cobrança total + imposto discreto

/** Base do lucro. */
export type ProfitBase = "ads" | "card"

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
  ad_account_id: string | null
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
  page_views: number
  checkouts_initiated: number
  sales: number
  revenue: number
  ad_account_id: string | null
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
  term_days_pix: number
  term_days_card: number
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
  creative_id: string | null
  gateway_id: string | null
  gross_amount: number
  apply_gateway_fee: boolean
  fee_amount: number
  tax_amount: number
  net_amount: number
  payment_method: string
  source: string | null
  sold_at: string
  has_term: boolean
  receivable_date: string | null
  received: boolean
  notes: string | null
  created_by: string | null
  created_at: string
}

export type AdAccount = {
  id: string
  project_id: string
  bm_name: string | null
  account_name: string
  created_at: string
}

export type CardCharge = {
  id: string
  project_id: string
  ad_account_id: string | null
  amount: number
  charged_at: string
  notes: string | null
  created_by: string | null
  created_at: string
}

export type ActivityLog = {
  id: string
  project_id: string | null
  owner_id: string | null
  actor_id: string | null
  actor_name: string | null
  action: string
  entity: string | null
  entity_id: string | null
  summary: string | null
  meta: Record<string, unknown>
  created_at: string
}

export type CashEntry = {
  id: string
  owner_id: string
  project_id: string | null
  direction: "entrada" | "saida"
  amount: number
  currency: Currency
  category: string | null
  description: string | null
  occurred_at: string
  sale_id: string | null
  bank_account_id: string | null
  /** Agrupa as 2 pernas de uma transferência (saída + entrada). */
  transfer_group: string | null
  /** Contraparte da transferência (outro usuário/sócio). */
  counterparty_id: string | null
  /** Se a saída/entrada deve refletir na dashboard como gasto/faturamento. */
  to_dashboard: boolean
  dashboard_kind: "gasto" | "faturamento" | null
  created_by: string | null
  created_at: string
}

/** Conta bancária/carteira do gestor financeiro pessoal. */
export type BankAccount = {
  id: string
  owner_id: string
  name: string
  kind: string
  balance: number
  currency: Currency
  created_at: string
}

/** Tipo do valor de uma métrica personalizada. */
export type MetricKind = "quantidade" | "valor" | "percentual"

/** Métrica personalizada (dashboard pessoal quando project_id é null). */
export type CustomMetric = {
  id: string
  owner_id: string
  project_id: string | null
  name: string
  kind: MetricKind
  value: number
  icon: string | null
  position: number
  hidden: boolean
  created_at: string
}

/** Categoria de atalhos/notas (global do usuário quando project_id é null). */
export type ShortcutCategory = {
  id: string
  owner_id: string
  project_id: string | null
  name: string
  color: string | null
  position: number
  created_at: string
}

export type ShortcutKind = "link" | "imagem" | "video" | "nota" | "id"

/** Atalho salvo (link, id, imagem, vídeo, texto). */
export type Shortcut = {
  id: string
  owner_id: string
  project_id: string | null
  category_id: string | null
  title: string
  url: string | null
  body: string | null
  kind: ShortcutKind
  position: number
  created_at: string
}

/** Nota do bloco de notas. */
export type Note = {
  id: string
  owner_id: string
  project_id: string | null
  category_id: string | null
  title: string
  body: string | null
  visibility: "privado" | "compartilhado"
  created_at: string
  updated_at: string
}

export type TodoDueKind = "hoje" | "amanha" | "sem_prazo"

/** Item de to-do (pessoal quando project_id é null). */
export type TodoItem = {
  id: string
  owner_id: string
  project_id: string | null
  assignee_id: string | null
  category: string | null
  title: string
  done: boolean
  due_kind: TodoDueKind
  position: number
  created_at: string
}
