"use client"

import { useEffect, useRef, useState } from "react"
import { formatCurrency } from "@/lib/utils"
import { History } from "lucide-react"

export type HistoryPoint = {
  /** ISO date (YYYY-MM-DD). */
  date: string
  /** Lucro líquido do dia. */
  liquido: number
  /** Faturamento do dia. */
  faturado: number
}

/**
 * Histórico minimalista na dashboard: um ícone que abre a evolução diária de
 * Lucro líquido (L) e Faturado (F), com data. Do mais recente ao mais antigo.
 */
export function HistoryPopover({ points }: { points: HistoryPoint[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  const ordered = [...points].reverse()

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Histórico"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--color-border)] text-muted transition-colors hover:bg-white/5 hover:text-foreground"
      >
        <History size={16} />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted">Histórico diário</span>
            <span className="flex items-center gap-2 text-[11px] text-muted">
              <span className="text-positive">L</span> líquido
              <span className="text-primary">F</span> faturado
            </span>
          </div>
          {ordered.length === 0 ? (
            <p className="px-1 py-4 text-center text-xs text-muted">Sem dados no período.</p>
          ) : (
            <ul className="max-h-72 space-y-0.5 overflow-y-auto">
              {ordered.map((p) => (
                <li
                  key={p.date}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-white/5"
                >
                  <span className="tabular-nums text-muted">
                    {new Date(p.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </span>
                  <span className="flex items-center gap-2 font-mono">
                    <span className={p.liquido >= 0 ? "text-positive" : "text-negative"}>
                      L {formatCurrency(p.liquido)}
                    </span>
                    <span className="text-primary">F {formatCurrency(p.faturado)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
