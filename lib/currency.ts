import type { Currency } from "./types"

export const DEFAULT_USD_BRL = 5.0

/** Listas padrão (minúsculo) usadas quando o usuário ainda não personalizou. */
export const DEFAULT_REGIONS = ["br", "us", "es", "latam", "mundo"]
export const DEFAULT_CURRENCIES = ["brl", "usd", "eur"]
export const DEFAULT_OFFER_TYPES = ["x1", "tráfego direto"]
export const DEFAULT_SOURCES = ["orgânico", "tráfego pago", "indicação"]

/** Normaliza um código de moeda para maiúsculo ("brl" -> "BRL"). */
export function normalizeCurrency(currency: Currency | string): string {
  return String(currency ?? "brl").toUpperCase()
}

/** Símbolo da moeda. Cai para o próprio código quando desconhecido. */
export function currencySymbol(currency: Currency | string): string {
  const code = normalizeCurrency(currency)
  const map: Record<string, string> = { BRL: "R$", USD: "US$", EUR: "€" }
  return map[code] ?? code
}

/**
 * Converte qualquer valor para BRL usando a cotação informada.
 * Qualquer moeda diferente de BRL é tratada como dólar (uma cotação suportada hoje).
 */
export function toBRL(amount: number, currency: Currency, usdBrl: number): number {
  const code = normalizeCurrency(currency)
  if (code === "BRL") return amount
  return amount * usdBrl
}
