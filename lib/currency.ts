import type { Currency } from "./types"

export const DEFAULT_USD_BRL = 5.0

/** Converte qualquer valor para BRL usando a cotação informada. */
export function toBRL(amount: number, currency: Currency, usdBrl: number): number {
  if (currency === "USD") return amount * usdBrl
  return amount
}
