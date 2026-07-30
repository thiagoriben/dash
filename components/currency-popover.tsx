"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { getLiveRates, setUsdBrlRate, type LiveRates } from "@/app/actions/currency"
import { currencySymbol } from "@/lib/currency"
import { Coins, RefreshCw, Check } from "lucide-react"

export function CurrencyPopover({
  usdBrl,
  currencies = ["USD", "EUR"],
  collapsed,
}: {
  usdBrl: number
  currencies?: string[]
  collapsed: boolean
}) {
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [rates, setRates] = useState<LiveRates | null>(null)
  const [loading, setLoading] = useState(false)
  const [rate, setRate] = useState(usdBrl.toString())
  const [saving, startSaving] = useTransition()

  // moedas a converter (exclui BRL)
  const codes = Array.from(new Set(currencies.map((c) => c.toUpperCase()))).filter((c) => c !== "BRL")

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  async function loadRates() {
    setLoading(true)
    const r = await getLiveRates(codes.length ? codes : ["USD", "EUR"])
    setRates(r)
    setLoading(false)
  }

  useEffect(() => {
    if (open && !rates) void loadRates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function useLiveUsd() {
    const live = rates?.toBRL.USD
    if (live) setRate(live.toFixed(2))
  }

  function save() {
    const n = Number.parseFloat(rate.replace(",", "."))
    if (!Number.isFinite(n) || n <= 0) return
    startSaving(async () => {
      await setUsdBrlRate(n)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Câmbio de moedas"
        title="Câmbio"
        className={cn(
          "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-white/5 hover:text-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <Coins size={18} />
        {!collapsed && "Câmbio"}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-2xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-2)] p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Cotações ao vivo</span>
            <button
              onClick={loadRates}
              aria-label="Atualizar cotações"
              className="text-muted transition-colors hover:text-foreground"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {loading && !rates ? (
            <p className="py-2 text-sm text-muted">Carregando…</p>
          ) : rates?.ok ? (
            <ul className="mb-3 flex flex-col gap-1">
              {codes.map((code) => {
                const v = rates.toBRL[code]
                return (
                  <li key={code} className="flex items-center justify-between text-sm">
                    <span className="text-muted">1 {currencySymbol(code)} =</span>
                    <span className="font-mono">{v ? `R$ ${v.toFixed(2)}` : "—"}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mb-3 text-xs text-warning text-pretty">
              Não foi possível buscar cotações ao vivo. Defina o valor manualmente.
            </p>
          )}

          <div className="border-t border-border pt-2">
            <label className="mb-1 block text-xs text-muted">Cotação USD→BRL usada nos cálculos</label>
            <div className="flex items-center gap-2">
              <input
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                inputMode="decimal"
                className="h-9 w-24 rounded-lg border border-border bg-surface px-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              />
              {rates?.toBRL.USD ? (
                <button
                  onClick={useLiveUsd}
                  className="rounded-lg border border-border px-2 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
                >
                  Usar ao vivo
                </button>
              ) : null}
              <button
                onClick={save}
                disabled={saving}
                className="ml-auto flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg disabled:opacity-60"
              >
                <Check size={14} />
                {saving ? "…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
