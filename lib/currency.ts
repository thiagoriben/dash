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

/**
 * Converte um valor já em BRL para a moeda de exibição alvo.
 * Qualquer moeda diferente de BRL é tratada como dólar (única cotação suportada hoje).
 */
export function fromBRL(amountBRL: number, target: Currency | string, usdBrl: number): number {
  const code = normalizeCurrency(target)
  if (code === "BRL") return amountBRL
  return usdBrl ? amountBRL / usdBrl : amountBRL
}

/** Converte entre duas moedas arbitrárias passando por BRL. */
export function convertCurrency(
  amount: number,
  from: Currency | string,
  to: Currency | string,
  usdBrl: number,
): number {
  return fromBRL(toBRL(amount, from as Currency, usdBrl), to, usdBrl)
}
