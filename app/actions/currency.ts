"use server"

import { cookies } from "next/headers"

export type LiveRates = {
  base: "BRL"
  /** Quantos BRL vale 1 unidade da moeda (ex.: USD -> 5.10). */
  toBRL: Record<string, number>
  updatedAt: string | null
  ok: boolean
}

/**
 * Busca cotações ao vivo (base BRL) na open.er-api.com — gratuita, sem chave.
 * Retorna quanto vale 1 unidade de cada moeda em BRL.
 */
export async function getLiveRates(codes: string[] = ["USD", "EUR"]): Promise<LiveRates> {
  const fallback: LiveRates = { base: "BRL", toBRL: {}, updatedAt: null, ok: false }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/BRL", {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return fallback
    const json = (await res.json()) as {
      result?: string
      rates?: Record<string, number>
      time_last_update_utc?: string
    }
    if (json.result !== "success" || !json.rates) return fallback

    const toBRL: Record<string, number> = {}
    for (const code of codes) {
      const perBRL = json.rates[code.toUpperCase()]
      if (perBRL && perBRL > 0) toBRL[code.toUpperCase()] = 1 / perBRL
    }
    return { base: "BRL", toBRL, updatedAt: json.time_last_update_utc ?? null, ok: true }
  } catch {
    return fallback
  }
}

/** Salva a cotação USD->BRL usada nos cálculos (cookie lido por getUsdBrlRate). */
export async function setUsdBrlRate(rate: number): Promise<{ ok: boolean }> {
  if (!Number.isFinite(rate) || rate <= 0) return { ok: false }
  const store = await cookies()
  store.set("usd_brl", String(rate), { path: "/", maxAge: 31536000 })
  return { ok: true }
}
