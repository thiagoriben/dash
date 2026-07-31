"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { Select } from "@/components/ui"
import { CalendarRange, Loader2 } from "lucide-react"
import type { Period } from "@/lib/data"
import { PrivacyToggle } from "@/components/privacy"

const periods: { value: Period; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "mes", label: "Este mês" },
  { value: "ano", label: "Último ano" },
  { value: "tudo", label: "Todo período" },
]

export function Topbar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const period = (searchParams.get("period") as Period) ?? "30d"

  // Seletor de período só faz sentido em telas com métricas por período.
  // Fica oculto na LISTA de projetos (só nomes) e em telas de organização,
  // ranking, perfil, config, sócios e chat. No DETALHE do projeto ele aparece.
  const exactHide = ["/projetos", "/organizacao", "/ranking", "/perfil", "/socios", "/chat"]
  const prefixHide = ["/config"]
  const hidePeriod =
    exactHide.includes(pathname) || prefixHide.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  function setPeriod(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("period", value)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-[color:var(--color-border)] bg-[color:var(--color-background)]/70 px-4 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-2 text-muted">
        {hidePeriod ? (
          <span className="h-9" aria-hidden="true" />
        ) : (
          <>
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
          </>
        )}
      </div>
      <PrivacyToggle />
    </header>
  )
}
