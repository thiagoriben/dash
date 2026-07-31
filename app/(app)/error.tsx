"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { reportAutoBug } from "@/app/actions/social"
import { AlertTriangle, RotateCcw } from "lucide-react"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const pathname = usePathname()

  useEffect(() => {
    // Reporta o erro de renderização para os admins (silencioso).
    void reportAutoBug({
      message: error.message || "Erro de renderização",
      stack: error.stack ?? null,
      page: pathname,
      url: typeof location !== "undefined" ? location.href : null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      source: "error-boundary",
    })
  }, [error, pathname])

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-negative/15 text-negative">
        <AlertTriangle size={26} />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-semibold text-foreground">Algo deu errado</h2>
        <p className="max-w-md text-sm text-muted">
          O erro foi registrado automaticamente e a equipe já foi avisada. Você pode tentar de novo.
        </p>
      </div>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-[var(--accent-fg)] transition-opacity hover:opacity-90"
      >
        <RotateCcw size={16} /> Tentar novamente
      </button>
    </div>
  )
}
