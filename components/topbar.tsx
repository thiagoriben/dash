"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { signOut } from "@/app/actions/auth"
import { Button, Select } from "@/components/ui"
import { CalendarRange, LogOut, DollarSign, Loader2 } from "lucide-react"
import type { Period } from "@/lib/data"

const periods: { value: Period; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "mes", label: "Este mês" },
  { value: "ano", label: "Último ano" },
  { value: "tudo", label: "Todo período" },
]

export function Topbar({ usdBrl }: { usdBrl: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [rate, setRate] = useState(usdBrl.toString())
  const period = (searchParams.get("period") as Period) ?? "30d"

  function setPeriod(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("period", value)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  function commitRate() {
    const n = Number.parseFloat(rate.replace(",", "."))
    if (Number.isFinite(n) && n > 0) {
      document.cookie = `usd_brl=${n}; path=/; max-age=31536000`
      startTransition(() => router.refresh())
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-[color:var(--color-border)] bg-[color:var(--color-background)]/70 px-4 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-2 text-muted">
        <CalendarRange size={18} className="text-primary" />
        <Select
          aria-label="Período global"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="h-9 w-auto min-w-40"
        >
          {periods.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        {pending ? <Loader2 size={16} className="animate-spin text-primary" /> : null}
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-2.5 py-1.5">
          <DollarSign size={14} className="text-warning" />
          <span className="text-xs text-muted">USD→BRL</span>
          <input
            aria-label="Cotação USD para BRL"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            onBlur={commitRate}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) commitRate()
            }}
            inputMode="decimal"
            className="w-14 bg-transparent font-mono text-sm text-foreground focus:outline-none"
          />
        </label>
        <form action={signOut}>
          <Button variant="ghost" size="sm" type="submit" aria-label="Sair">
            <LogOut size={16} />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </form>
      </div>
    </header>
  )
}
