import { createClient } from "@/lib/supabase/server"
import type {
  AdAccount,
  BankAccount,
  CardCharge,
  CashEntry,
  Creative,
  DailyMetric,
  Expense,
  PaymentGateway,
  Product,
  Profile,
  Project,
  ProfitSplit,
  Sale,
} from "./types"

export type Period = "hoje" | "7d" | "30d" | "90d" | "mes" | "ano" | "tudo"

export function periodStartDate(period: Period): string | null {
  if (period === "tudo") return null
  const d = new Date()
  if (period === "hoje") return d.toISOString().slice(0, 10)
  if (period === "mes") {
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  }
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 365
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/** Intervalo de datas explícito (from/to em YYYY-MM-DD). Sobrepõe o period quando presente. */
export type DateRange = { from: string | null; to: string | null }

export function resolveRange(period: Period, range?: Partial<DateRange>): DateRange {
  if (range?.from || range?.to) return { from: range.from ?? null, to: range.to ?? null }
  return { from: periodStartDate(period), to: null }
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
  if (data) return data as Profile

  // Sessão válida mas sem perfil: cria um a partir dos metadados (não desloga o usuário).
  const username =
    (user.user_metadata?.username as string) ?? user.email?.split("@")[0] ?? "usuario"
  const { data: created } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      username,
      full_name: (user.user_metadata?.full_name as string) ?? null,
      role: (user.user_metadata?.role as string) ?? "member",
    })
    .select("*")
    .maybeSingle()
  return (created as Profile) ?? null
}

/** Mescla e salva preferências do usuário (última escolha vira padrão). */
export async function savePrefs(
  patch: Record<string, string | string[] | number | boolean | undefined>,
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const { data } = await supabase.from("profiles").select("prefs").eq("id", user.id).maybeSingle()
  const current = (data?.prefs ?? {}) as Record<string, unknown>
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v != null && v !== ""))
  await supabase
    .from("profiles")
    .update({ prefs: { ...current, ...clean } })
    .eq("id", user.id)
}

export async function getProfiles(): Promise<Profile[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("profiles").select("*").order("created_at")
  return (data ?? []) as Profile[]
}

/** Contas aguardando aprovação (visível só para admin via RLS). */
export async function getPendingProfiles(): Promise<Profile[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("approved", false)
    .order("created_at")
  return (data ?? []) as Profile[]
}

/**
 * Projetos visíveis para o usuário. O RLS já restringe as linhas retornadas
 * aos projetos que o usuário criou OU nos quais é colaborador (project_members),
 * então basta retornar o que vier — sem filtro extra de visibilidade.
 */
export async function getVisibleProjects(profile: Profile | null): Promise<Project[]> {
  if (!profile) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false })
  return (data ?? []) as Project[]
}

/** Retorna quais projetos (dentre os visíveis) o usuário é dono. */
export async function getOwnedProjectIds(profile: Profile | null): Promise<Set<string>> {
  if (!profile) return new Set()
  const supabase = await createClient()
  const { data } = await supabase.from("projects").select("id").eq("owner_id", profile.id)
  return new Set((data ?? []).map((p) => p.id))
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = await createClient()
  const { data } = await supabase.from("projects").select("*").eq("id", id).single()
  return data as Project | null
}

export async function getExpenses(
  projectIds: string[],
  start: string | null,
  end: string | null = null,
): Promise<Expense[]> {
  if (projectIds.length === 0) return []
  const supabase = await createClient()
  let q = supabase.from("expenses").select("*").in("project_id", projectIds)
  if (start) q = q.gte("spent_at", start)
  if (end) q = q.lte("spent_at", end)
  const { data } = await q.order("spent_at", { ascending: false })
  return (data ?? []) as Expense[]
}

export async function getDailyMetrics(
  projectIds: string[],
  start: string | null,
  end: string | null = null,
): Promise<DailyMetric[]> {
  if (projectIds.length === 0) return []
  const supabase = await createClient()
  let q = supabase.from("daily_metrics").select("*").in("project_id", projectIds)
  if (start) q = q.gte("date", start)
  if (end) q = q.lte("date", end)
  const { data } = await q.order("date")
  return (data ?? []) as DailyMetric[]
}

export async function getCreatives(projectId: string): Promise<Creative[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("creatives")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
  return (data ?? []) as Creative[]
}

export async function getProfitSplits(projectId: string): Promise<ProfitSplit[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("profit_splits").select("*").eq("project_id", projectId)
  return (data ?? []) as ProfitSplit[]
}

export type ProjectMemberWithProfile = {
  id: string
  user_id: string
  role: string
  profile: Profile | null
}

export async function getProjectMembers(projectId: string): Promise<ProjectMemberWithProfile[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("project_members")
    .select("id, user_id, role, profile:profiles(*)")
    .eq("project_id", projectId)
  return (data ?? []).map((m: any) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role,
    profile: (m.profile ?? null) as Profile | null,
  }))
}

/* ---------- Gateways de pagamento (global do usuário) ---------- */
const DEFAULT_GATEWAYS = ["Hotmart", "Wiapy", "B3", "Paradise"]

export async function getPaymentGateways(ownerId: string): Promise<PaymentGateway[]> {
  const supabase = await createClient()
  let { data } = await supabase
    .from("payment_gateways")
    .select("*")
    .eq("owner_id", ownerId)
    .order("name")

  // Semeia os gateways padrão uma única vez.
  if (!data || data.length === 0) {
    await supabase
      .from("payment_gateways")
      .insert(DEFAULT_GATEWAYS.map((name) => ({ owner_id: ownerId, name })))
    const res = await supabase
      .from("payment_gateways")
      .select("*")
      .eq("owner_id", ownerId)
      .order("name")
    data = res.data
  }
  return (data ?? []) as PaymentGateway[]
}

/* ---------- Produtos ---------- */
export async function getProducts(projectId: string): Promise<Product[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("project_id", projectId)
    .order("position")
    .order("created_at")
  return (data ?? []) as Product[]
}

/* ---------- Vendas ---------- */
export async function getSales(
  projectIds: string[],
  start: string | null,
  end: string | null = null,
): Promise<Sale[]> {
  if (projectIds.length === 0) return []
  const supabase = await createClient()
  let q = supabase.from("sales").select("*").in("project_id", projectIds)
  if (start) q = q.gte("sold_at", start)
  if (end) q = q.lte("sold_at", end)
  const { data } = await q.order("sold_at", { ascending: false })
  return (data ?? []) as Sale[]
}

/** Vendas com prazo em aberto (para projeção de recebíveis), sem filtro de período. */
export async function getReceivables(projectIds: string[]): Promise<Sale[]> {
  if (projectIds.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("sales")
    .select("*")
    .in("project_id", projectIds)
    .eq("received", false)
    .order("receivable_date")
  return (data ?? []) as Sale[]
}

/* ---------- Contas de anúncio ---------- */
export async function getAdAccounts(projectId: string): Promise<AdAccount[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("ad_accounts")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at")
  return (data ?? []) as AdAccount[]
}

/* ---------- Cobranças no cartão (anúncios com imposto) ---------- */
export async function getCardCharges(
  projectIds: string[],
  start: string | null,
  end: string | null = null,
): Promise<CardCharge[]> {
  if (projectIds.length === 0) return []
  const supabase = await createClient()
  let q = supabase.from("card_charges").select("*").in("project_id", projectIds)
  if (start) q = q.gte("charged_at", start)
  if (end) q = q.lte("charged_at", end)
  const { data } = await q.order("charged_at", { ascending: false })
  return (data ?? []) as CardCharge[]
}

/* ---------- Caixa ---------- */
export async function getCashEntries(profile: Profile | null): Promise<CashEntry[]> {
  if (!profile) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("cash_entries")
    .select("*")
    .order("occurred_at", { ascending: false })
  return (data ?? []) as CashEntry[]
}

/**
 * Lançamentos de caixa de projetos que devem refletir na dashboard.
 * Apenas entradas/saídas marcadas com `to_dashboard` entram (opt-in do usuário).
 */
export async function getCashEntriesForProjects(
  projectIds: string[],
  from: string | null,
  to: string | null,
): Promise<CashEntry[]> {
  if (projectIds.length === 0) return []
  const supabase = await createClient()
  let q = supabase
    .from("cash_entries")
    .select("*")
    .in("project_id", projectIds)
    .eq("to_dashboard", true)
  if (from) q = q.gte("occurred_at", from)
  if (to) q = q.lte("occurred_at", to)
  const { data } = await q.order("occurred_at", { ascending: false })
  return (data ?? []) as CashEntry[]
}

/** Contas bancárias/carteiras do usuário (gestor financeiro pessoal). */
export async function getBankAccounts(profile: Profile | null): Promise<BankAccount[]> {
  if (!profile) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("owner_id", profile.id)
    .order("created_at")
  return (data ?? []) as BankAccount[]
}

/* ============================ SOCIAL ============================ */

export type Friendship = {
  id: string
  requester_id: string
  addressee_id: string
  status: "pending" | "accepted"
  created_at: string
}
export type FriendView = { friendshipId: string; profile: Profile; status: "pending" | "accepted"; incoming: boolean }
export type JoinRequestView = {
  id: string
  project_id: string
  user_id: string
  status: string
  message: string | null
  created_at: string
  profile: Profile | null
  projectName?: string
}

/** Amigos + pedidos pendentes do usuário logado. */
export async function getFriends(meId: string): Promise<{
  friends: FriendView[]
  incoming: FriendView[]
  outgoing: FriendView[]
}> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${meId},addressee_id.eq.${meId}`)
    .order("created_at", { ascending: false })
  const rows = (data ?? []) as Friendship[]

  const otherIds = rows.map((r) => (r.requester_id === meId ? r.addressee_id : r.requester_id))
  const profileMap = new Map<string, Profile>()
  if (otherIds.length > 0) {
    const { data: profs } = await supabase.from("profiles").select("*").in("id", otherIds)
    for (const p of (profs ?? []) as Profile[]) profileMap.set(p.id, p)
  }

  const friends: FriendView[] = []
  const incoming: FriendView[] = []
  const outgoing: FriendView[] = []
  for (const r of rows) {
    const otherId = r.requester_id === meId ? r.addressee_id : r.requester_id
    const profile = profileMap.get(otherId)
    if (!profile) continue
    const view: FriendView = {
      friendshipId: r.id,
      profile,
      status: r.status,
      incoming: r.addressee_id === meId,
    }
    if (r.status === "accepted") friends.push(view)
    else if (view.incoming) incoming.push(view)
    else outgoing.push(view)
  }
  return { friends, incoming, outgoing }
}

/** Pedidos que o usuário enviou para entrar em projetos. */
export async function getMyJoinRequests(meId: string): Promise<JoinRequestView[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("project_join_requests")
    .select("*, projects(name)")
    .eq("user_id", meId)
    .order("created_at", { ascending: false })
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    project_id: r.project_id,
    user_id: r.user_id,
    status: r.status,
    message: r.message,
    created_at: r.created_at,
    profile: null,
    projectName: r.projects?.name,
  }))
}

export type ChatMessage = {
  id: string
  project_id: string
  sender_id: string
  body: string
  created_at: string
}

/** Últimas mensagens do chat do projeto (ordem cronológica). */
export async function getChatMessages(projectId: string): Promise<ChatMessage[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100)
  return ((data ?? []) as ChatMessage[]).reverse()
}

/** Pedidos de entrada pendentes num projeto (para o dono aprovar). */
export async function getProjectJoinRequests(projectId: string): Promise<JoinRequestView[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("project_join_requests")
    .select("*, profiles(*)")
    .eq("project_id", projectId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    project_id: r.project_id,
    user_id: r.user_id,
    status: r.status,
    message: r.message,
    created_at: r.created_at,
    profile: r.profiles ?? null,
  }))
}

/* ============================ DM / PERFIL PÚBLICO ============================ */

export type DirectMessage = {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  read: boolean
  created_at: string
}

/** Sócios (amizades aceitas) como lista simples de perfis. */
export async function getPartners(meId: string): Promise<Profile[]> {
  const { friends } = await getFriends(meId)
  return friends.map((f) => f.profile)
}

/** Perfil público por username (respeita is_public; dono sempre vê o próprio). */
export async function getPublicProfileByUsername(username: string, meId: string): Promise<Profile | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle()
  const p = (data ?? null) as Profile | null
  if (!p) return null
  if (!p.is_public && p.id !== meId) return null
  return p
}

/** Mensagens diretas entre o usuário logado e outro (ordem cronológica). */
export async function getDirectMessages(meId: string, otherId: string): Promise<DirectMessage[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("direct_messages")
    .select("*")
    .or(
      `and(sender_id.eq.${meId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${meId})`,
    )
    .order("created_at", { ascending: true })
    .limit(200)
  return (data ?? []) as DirectMessage[]
}
