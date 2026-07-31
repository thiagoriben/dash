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

/**
 * Cotações manuais por moeda (quantos BRL vale 1 unidade).
 * Persistidas em cookie "fx_overrides" como JSON { USD: 5.1, EUR: 5.9, ... }.
 * A moeda USD também espelha em "usd_brl" para manter compatibilidade dos cálculos.
 */
export async function getCurrencyOverrides(): Promise<Record<string, number>> {
  const store = await cookies()
  const raw = store.get("fx_overrides")?.value
  if (!raw) return {}
  try {
    const obj = JSON.parse(raw) as Record<string, number>
    return obj && typeof obj === "object" ? obj : {}
  } catch {
    return {}
  }
}

export async function setCurrencyOverrides(overrides: Record<string, number>): Promise<{ ok: boolean }> {
  const clean: Record<string, number> = {}
  for (const [code, val] of Object.entries(overrides ?? {})) {
    const n = Number(val)
    if (code && Number.isFinite(n) && n > 0) clean[code.toUpperCase()] = n
  }
  const store = await cookies()
  store.set("fx_overrides", JSON.stringify(clean), { path: "/", maxAge: 31536000 })
  if (clean.USD) store.set("usd_brl", String(clean.USD), { path: "/", maxAge: 31536000 })
  return { ok: true }
}

/** Lista de moedas que o usuário acompanha no conversor (cookie "fx_currencies"). */
export async function getTrackedCurrencies(): Promise<string[]> {
  const store = await cookies()
  const raw = store.get("fx_currencies")?.value
  if (!raw) return ["USD", "EUR"]
  try {
    const arr = JSON.parse(raw) as string[]
    return Array.isArray(arr) && arr.length ? arr.map((c) => c.toUpperCase()) : ["USD", "EUR"]
  } catch {
    return ["USD", "EUR"]
  }
}

export async function setTrackedCurrencies(codes: string[]): Promise<{ ok: boolean }> {
  const clean = Array.from(new Set((codes ?? []).map((c) => c.toUpperCase()).filter((c) => c && c !== "BRL")))
  const store = await cookies()
  store.set("fx_currencies", JSON.stringify(clean), { path: "/", maxAge: 31536000 })
  return { ok: true }
}
