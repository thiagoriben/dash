import "server-only"
import { cookies } from "next/headers"
import { DEFAULT_USD_BRL } from "./currency"
import { getLiveRates, getCurrencyOverrides } from "@/app/actions/currency"

/**
 * Cotação USD->BRL usada em todos os cálculos.
 *
 * Ordem de prioridade:
 * 1. Override manual ("fixo") do USD salvo pelo usuário no câmbio — sempre vence.
 * 2. Cotação ao vivo (open.er-api.com, cache de 1h) — atualização automática.
 * 3. Último valor salvo em cookie / constante padrão — fallback se a API cair.
 */
export async function getUsdBrlRate(): Promise<number> {
  // 1. Fixo pelo usuário
  const overrides = await getCurrencyOverrides()
  if (overrides.USD && overrides.USD > 0) return overrides.USD

  // 2. Ao vivo (automático)
  try {
    const live = await getLiveRates(["USD"])
    if (live.ok && live.toBRL.USD && live.toBRL.USD > 0) return live.toBRL.USD
  } catch {
    // ignora e cai no fallback
  }

  // 3. Fallback: cookie salvo ou constante padrão
  const store = await cookies()
  const raw = store.get("usd_brl")?.value
  const n = raw ? Number.parseFloat(raw) : NaN
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_BRL
}
