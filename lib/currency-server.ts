import "server-only"
import { cookies } from "next/headers"
import { DEFAULT_USD_BRL } from "./currency"

export async function getUsdBrlRate(): Promise<number> {
  const store = await cookies()
  const raw = store.get("usd_brl")?.value
  const n = raw ? Number.parseFloat(raw) : NaN
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_BRL
}
