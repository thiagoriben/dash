"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useTransition } from "react"
import { Input } from "@/components/ui"
import { cn } from "@/lib/utils"
import { CalendarDays } from "lucide-react"

const PRESETS = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "mes", label: "Este mês" },
  { key: "ano", label: "1 ano" },
  { key: "tudo", label: "Tudo" },
] as const

/**
 * Filtro por período: presets rápidos ou intervalo customizado (from/to).
 * Escreve os parâmetros na URL da rota atual, então funciona em qualquer dashboard.
 */
export function DateRangeFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const from = searchParams.get("from") ?? ""
  const to = searchParams.get("to") ?? ""
  const custom = Boolean(from || to)
  const period = searchParams.get("period") ?? "30d"

  function push(next: URLSearchParams) {
    startTransition(() => router.push(`${pathname}?${next.toString()}`))
  }

  function setPreset(key: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("period", key)
    params.delete("from")
    params.delete("to")
    push(params)
  }

  function setCustom(key: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete("period")
    push(params)
  }

  return (
    <div className="glass flex flex-wrap items-center gap-2 rounded-2xl p-3">
      <div className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted">
        <CalendarDays size={14} className="text-primary" />
        Período
      </div>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              !custom && period === p.key
                ? "bg-primary text-[#04121a]"
                : "text-muted hover:bg-white/5 hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Input
          type="date"
          aria-label="Data inicial"
          value={from}
          onChange={(e) => setCustom("from", e.target.value)}
          className="h-9 w-auto"
        />
        <span className="text-xs text-muted">até</span>
        <Input
          type="date"
          aria-label="Data final"
          value={to}
          onChange={(e) => setCustom("to", e.target.value)}
          className="h-9 w-auto"
        />
      </div>
      {pending ? <span className="text-xs text-muted">Atualizando…</span> : null}
    </div>
  )
}
