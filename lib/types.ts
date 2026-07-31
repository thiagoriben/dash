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
  card_color: string | null
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
  /** Marca que o aviso de cadastrar email real já foi dispensado (aparece só uma vez). */
  email_notice_dismissed?: boolean
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
  media_url: string | null
  media_type: "image" | "video" | null
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
  withdraw_fee_pct: number
  withdraw_fee_fixed: number
  term_days_pix: number
  term_days_card: number
  created_at: string
}

export type GatewayWithdrawal = {
  id: string
  owner_id: string
  gateway_id: string
  gross_amount: number
  fee_amount: number
  net_amount: number
  currency: string
  dest_kind: "carteira" | "projeto"
  dest_account_id: string | null
  dest_project_id: string | null
  note: string | null
  withdrawn_at: string
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
  /** Conta de anúncio vinculada à venda (opcional). */
  ad_account_id: string | null
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
  /** Itens (produtos) da venda — carregado sob demanda em edições/listagens. */
  items?: SaleItem[]
}

/** Rótulo de um produto dentro de uma venda. */
export type SaleItemRole = "front" | "order_bump" | "upsell" | "downsell"

/** Um produto vendido dentro de uma venda (venda multi-produto). */
export type SaleItem = {
  id: string
  sale_id: string
  product_id: string | null
  role: SaleItemRole
  gross_amount: number
  quantity: number
  created_at: string
}

/** Rótulos legíveis dos itens de venda. */
export const SALE_ITEM_ROLE_LABELS: Record<SaleItemRole, string> = {
  front: "Front",
  order_bump: "Order bump",
  upsell: "Upsell",
  downsell: "Downsell",
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
  /** Tipo do lançamento: comum, aporte via pix (fundos), gasto com anúncio ou cobrança no cartão. */
  entry_type: CashEntryType
  /** Vincula um gasto_anuncio à sua cobranca_cartao (e vice-versa) para calcular o imposto Meta. */
  linked_entry_id: string | null
  created_by: string | null
  created_at: string
}

/** Tipo de um lançamento do caixa. */
export type CashEntryType = "comum" | "aporte_pix" | "gasto_anuncio" | "cobranca_cartao"

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
  // Enriquecido em runtime (notas pessoais):
  shared_with?: string[] // ids de amigos com quem eu compartilhei (quando sou dono)
  shared_by_me?: boolean // true quando a nota é minha e está compartilhada
  shared_from?: { id: string; name: string } | null // dono, quando a nota foi compartilhada COMIGO
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
  /** Prazo real (YYYY-MM-DD) — habilita os filtros por data. */
  due_date: string | null
  /** Concluída e ocultada da lista principal (movida para "Feitas"). */
  archived: boolean
  position: number
  created_at: string
}
