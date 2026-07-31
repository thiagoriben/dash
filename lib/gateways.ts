import "server-only"
import { createClient } from "@/lib/supabase/server"
import { toBRL } from "@/lib/currency"
import { getUsdBrlRate } from "@/lib/currency-server"
import type { Currency, GatewayWithdrawal } from "@/lib/types"

export type GatewayBalance = {
  gatewayId: string
  /** Soma das vendas líquidas atribuídas ao gateway. */
  salesNet: number
  /** Soma dos saques brutos já feitos. */
  withdrawnGross: number
  /** Saldo disponível para saque (vendas líquidas − saques brutos). */
  available: number
}

/**
 * Calcula o saldo disponível de cada gateway do usuário.
 * saldo = Σ vendas.net_amount (do gateway) − Σ saques.gross_amount (do gateway).
 * RLS já limita as vendas aos projetos que o usuário acessa.
 */
export async function getGatewayBalances(): Promise<Record<string, GatewayBalance>> {
  const supabase = await createClient()
  const [{ data: sales }, { data: withdrawals }, { data: projects }, usdBrl] = await Promise.all([
    supabase.from("sales").select("gateway_id, net_amount, project_id").not("gateway_id", "is", null),
    supabase.from("gateway_withdrawals").select("gateway_id, gross_amount, currency"),
    supabase.from("projects").select("id, currency"),
    getUsdBrlRate(),
  ])

  // Moeda de cada projeto — usada para converter as vendas para BRL (moeda de exibição do saldo).
  const currencyOf = new Map(
    ((projects ?? []) as { id: string; currency: Currency }[]).map((p) => [p.id, p.currency]),
  )

  const map: Record<string, GatewayBalance> = {}
  const ensure = (id: string) =>
    (map[id] ??= { gatewayId: id, salesNet: 0, withdrawnGross: 0, available: 0 })

  for (const s of (sales ?? []) as { gateway_id: string; net_amount: number; project_id: string }[]) {
    const currency = currencyOf.get(s.project_id) ?? "BRL"
    ensure(s.gateway_id).salesNet += toBRL(Number(s.net_amount) || 0, currency, usdBrl)
  }
  for (const w of (withdrawals ?? []) as { gateway_id: string; gross_amount: number; currency: Currency | null }[]) {
    // Saques são registrados já em BRL, mas respeitamos a moeda salva quando houver.
    ensure(w.gateway_id).withdrawnGross += toBRL(Number(w.gross_amount) || 0, w.currency ?? "BRL", usdBrl)
  }
  for (const id of Object.keys(map)) {
    map[id].available = map[id].salesNet - map[id].withdrawnGross
  }
  return map
}

/** Lista os saques de um gateway (mais recentes primeiro). */
export async function getGatewayWithdrawals(gatewayId?: string): Promise<GatewayWithdrawal[]> {
  const supabase = await createClient()
  let q = supabase.from("gateway_withdrawals").select("*").order("withdrawn_at", { ascending: false })
  if (gatewayId) q = q.eq("gateway_id", gatewayId)
  const { data } = await q
  return (data ?? []) as GatewayWithdrawal[]
}
