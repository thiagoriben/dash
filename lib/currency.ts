import { cookies } from "next/headers"
import type { Currency } from "./types"

export const DEFAULT_USD_BRL = 5.0

export async function getUsdBrlRate(): Promise<number> {
  const store = await cookies()
  const raw = store.get("usd_brl")?.value
  const n = raw ? Number.parseFloat(raw) : NaN
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_BRL
}

/** Converte qualquer valor para BRL usando a cotação informada. */
export function toBRL(amount: number, currency: Currency, usdBrl: number): number {
  if (currency === "USD") return amount * usdBrl
  return amount
}
