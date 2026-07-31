"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  getLiveRates,
  setCurrencyOverrides,
  setTrackedCurrencies,
  type LiveRates,
} from "@/app/actions/currency"
import { currencySymbol } from "@/lib/currency"
import { Coins, RefreshCw, Check, Pencil, Plus, X, Zap } from "lucide-react"

export function CurrencyPopover({
  usdBrl,
  currencies = ["USD", "EUR"],
  overrides = {},
  collapsed,
}: {
  usdBrl: number
  currencies?: string[]
  /** Cotações manuais salvas por moeda (BRL por 1 unidade). */
  overrides?: Record<string, number>
  collapsed: boolean
}) {
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [rates, setRates] = useState<LiveRates | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, startSaving] = useTransition()

  // Moedas acompanhadas (sem BRL). USD default se lista vier vazia.
  const [tracked, setTracked] = useState<string[]>(
    Array.from(new Set(currencies.map((c) => c.toUpperCase()))).filter((c) => c !== "BRL"),
  )
  // Valores manuais editáveis por moeda (string p/ input). Inicia dos overrides ou do usdBrl.
  const [manual, setManual] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    for (const c of currencies.map((x) => x.toUpperCase()).filter((x) => x !== "BRL")) {
      m[c] = overrides[c] ? String(overrides[c]) : c === "USD" ? String(usdBrl) : ""
    }
    return m
  })
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newCode, setNewCode] = useState("")

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  async function loadRates(codes: string[]) {
    setLoading(true)
    const r = await getLiveRates(codes.length ? codes : ["USD", "EUR"])
    setRates(r)
    setLoading(false)
  }

  useEffect(() => {
    if (open && !rates) void loadRates(tracked)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Valor efetivo exibido: manual (se houver) senão ao vivo.
  const effective = useMemo(() => {
    const out: Record<string, { value: number | null; source: "manual" | "live" | "none" }> = {}
    for (const c of tracked) {
      const man = Number.parseFloat((manual[c] ?? "").replace(",", "."))
      if (Number.isFinite(man) && man > 0) out[c] = { value: man, source: "manual" }
      else if (rates?.toBRL[c]) out[c] = { value: rates.toBRL[c], source: "live" }
      else out[c] = { value: null, source: "none" }
    }
    return out
  }, [tracked, manual, rates])

  function useLive(code: string) {
    const live = rates?.toBRL[code]
    if (live) setManual((m) => ({ ...m, [code]: live.toFixed(4) }))
  }

  function removeCurrency(code: string) {
    setTracked((t) => t.filter((c) => c !== code))
    setManual((m) => {
      const n = { ...m }
      delete n[code]
      return n
    })
    if (editing === code) setEditing(null)
  }

  function addCurrency() {
    const code = newCode.trim().toUpperCase()
    if (!code || code === "BRL" || tracked.includes(code)) {
      setNewCode("")
      setAdding(false)
      return
    }
    setTracked((t) => [...t, code])
    setManual((m) => ({ ...m, [code]: "" }))
    setNewCode("")
    setAdding(false)
    void loadRates([...tracked, code])
  }

  function saveAll() {
    // Só grava overrides das moedas com valor manual válido.
    const ov: Record<string, number> = {}
    for (const c of tracked) {
      const n = Number.parseFloat((manual[c] ?? "").replace(",", "."))
      if (Number.isFinite(n) && n > 0) ov[c] = n
    }
    startSaving(async () => {
      await setTrackedCurrencies(tracked)
      await setCurrencyOverrides(ov)
      setOpen(false)
      setEditing(null)
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
        <div className="absolute bottom-full left-0 z-50 mb-2 w-80 rounded-2xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-2)] p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Câmbio (BRL base)</span>
            <button
              onClick={() => loadRates(tracked)}
              aria-label="Atualizar cotações"
              className="text-muted transition-colors hover:text-foreground"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          <ul className="mb-2 flex flex-col gap-1.5">
            {tracked.map((code) => {
              const eff = effective[code]
              const isEditing = editing === code
              return (
                <li key={code} className="rounded-xl border border-border bg-surface px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm">
                      <span className="font-medium">1 {currencySymbol(code)}</span>
                      <span className="text-muted">=</span>
                    </span>
                    {!isEditing && (
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-sm">
                          {eff?.value != null ? `R$ ${eff.value.toFixed(2)}` : "—"}
                        </span>
                        {eff?.source === "manual" ? (
                          <span title="Cotação manual" className="text-[10px] font-semibold uppercase text-accent">
                            fixo
                          </span>
                        ) : eff?.source === "live" ? (
                          <span title="Cotação ao vivo" className="text-[10px] font-semibold uppercase text-muted">
                            ao vivo
                          </span>
                        ) : null}
                        <button
                          onClick={() => setEditing(code)}
                          aria-label={`Editar ${code}`}
                          className="text-muted transition-colors hover:text-foreground"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => removeCurrency(code)}
                          aria-label={`Remover ${code}`}
                          className="text-muted transition-colors hover:text-negative"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    )}
                  </div>
                  {isEditing && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        value={manual[code] ?? ""}
                        onChange={(e) => setManual((m) => ({ ...m, [code]: e.target.value }))}
                        inputMode="decimal"
                        placeholder="Valor em R$"
                        autoFocus
                        className="h-8 w-24 rounded-lg border border-border bg-surface-2 px-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                      />
                      {rates?.toBRL[code] ? (
                        <button
                          onClick={() => useLive(code)}
                          title="Usar cotação ao vivo"
                          className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
                        >
                          <Zap size={12} /> ao vivo
                        </button>
                      ) : null}
                      <button
                        onClick={() => setEditing(null)}
                        className="ml-auto rounded-lg border border-border px-2 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
                      >
                        ok
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {adding ? (
            <div className="mb-2 flex items-center gap-2">
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) addCurrency()
                }}
                placeholder="Código (ex: GBP)"
                maxLength={4}
                autoFocus
                className="h-8 flex-1 rounded-lg border border-border bg-surface px-2 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              />
              <button
                onClick={addCurrency}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg"
              >
                Adicionar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-1.5 text-xs text-muted transition-colors hover:border-[color:var(--color-border-strong)] hover:text-foreground"
            >
              <Plus size={13} /> Adicionar moeda
            </button>
          )}

          {!rates?.ok && !loading && (
            <p className="mb-2 text-xs text-warning text-pretty">
              Cotações ao vivo indisponíveis. Use os valores manuais (lápis).
            </p>
          )}

          <div className="border-t border-border pt-2">
            <button
              onClick={saveAll}
              disabled={saving}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-60"
            >
              <Check size={15} />
              {saving ? "Salvando…" : "Salvar cotações"}
            </button>
            <p className="mt-1.5 text-center text-[11px] text-muted">
              USD define a conversão usada nos cálculos do app.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
