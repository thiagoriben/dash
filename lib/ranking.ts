import { createAdminClient } from "@/lib/supabase/server"
import type { Profile, Prefs } from "@/lib/types"

export type RankingRow = {
  userId: string
  /** Nome exibido (ou "Anônimo" quando o usuário opta por ocultar). */
  displayName: string
  /** Faturamento do mês (net). null quando o usuário oculta o valor. */
  revenue: number | null
  isMe: boolean
  showName: boolean
}

/** Início/fim (YYYY-MM-DD) do mês corrente. */
function monthBounds(ref = new Date()): { from: string; to: string } {
  const y = ref.getFullYear()
  const m = ref.getMonth()
  const from = new Date(y, m, 1)
  const to = new Date(y, m + 1, 0)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to) }
}

/**
 * Ranking mensal de faturamento. Usa o admin client (server-only) porque
 * precisa somar vendas de projetos de OUTROS usuários — o RLS do usuário
 * logado não enxergaria. Respeita o opt-in e as preferências de privacidade.
 *
 * @param meId usuário logado
 * @param scopeUserIds quando informado, restringe o ranking a esses usuários
 *        (ex.: sócios). Sem valor = ranking geral (todos que optaram).
 */
export async function getMonthlyRevenueRanking(
  meId: string,
  scopeUserIds?: string[],
): Promise<RankingRow[]> {
  const admin = createAdminClient()
  const { from, to } = monthBounds()

  // 1) Perfis que optaram por participar (+ sempre inclui o próprio usuário).
  const { data: profs } = await admin.from("profiles").select("id, username, full_name, prefs")
  const all = (profs ?? []) as Profile[]

  let participants = all.filter((p) => {
    const prefs = (p.prefs ?? {}) as Prefs
    return prefs.ranking_opt_in === true || p.id === meId
  })
  if (scopeUserIds) {
    const set = new Set([...scopeUserIds, meId])
    participants = participants.filter((p) => set.has(p.id))
  }
  if (participants.length === 0) return []

  // 2) Projetos por dono (mapeia project_id -> owner_id).
  const { data: projects } = await admin.from("projects").select("id, owner_id")
  const projectOwner = new Map<string, string>()
  for (const p of (projects ?? []) as { id: string; owner_id: string | null }[]) {
    if (p.owner_id) projectOwner.set(p.id, p.owner_id)
  }

  // 3) Vendas do mês, somadas por dono do projeto.
  const { data: sales } = await admin
    .from("sales")
    .select("project_id, net_amount, sold_at")
    .gte("sold_at", from)
    .lte("sold_at", to)

  const revenueByUser = new Map<string, number>()
  for (const s of (sales ?? []) as { project_id: string; net_amount: number }[]) {
    const owner = projectOwner.get(s.project_id)
    if (!owner) continue
    revenueByUser.set(owner, (revenueByUser.get(owner) ?? 0) + Number(s.net_amount || 0))
  }

  // 4) Monta as linhas respeitando privacidade.
  const rows: RankingRow[] = participants.map((p) => {
    const prefs = (p.prefs ?? {}) as Prefs
    const isMe = p.id === meId
    const showName = isMe || prefs.ranking_show_name !== false
    const showRevenue = isMe || prefs.ranking_show_revenue !== false
    const revenue = revenueByUser.get(p.id) ?? 0
    return {
      userId: p.id,
      displayName: showName ? (p.full_name ?? p.username) : "Anônimo",
      revenue: showRevenue ? revenue : null,
      isMe,
      showName,
    }
  })

  // 5) Ordena por faturamento (quem oculta valor vai pro fim, mas participa).
  rows.sort((a, b) => (b.revenue ?? -1) - (a.revenue ?? -1))
  return rows
}
