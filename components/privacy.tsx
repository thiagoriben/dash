"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"

type PrivacyCtx = {
  hidden: boolean
  toggle: () => void
  setHidden: (v: boolean) => void
}

const Ctx = createContext<PrivacyCtx>({ hidden: false, toggle: () => {}, setHidden: () => {} })

export function usePrivacy() {
  return useContext(Ctx)
}

const STORAGE_KEY = "dash_hide_values"

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHiddenState] = useState(false)

  // Restaura preferência salva.
  useEffect(() => {
    try {
      setHiddenState(localStorage.getItem(STORAGE_KEY) === "1")
    } catch {
      /* ignore */
    }
  }, [])

  // Reflete no <html> para permitir mascaramento por CSS global.
  useEffect(() => {
    const el = document.documentElement
    if (hidden) el.setAttribute("data-hide-values", "true")
    else el.removeAttribute("data-hide-values")
  }, [hidden])

  const setHidden = useCallback((v: boolean) => {
    setHiddenState(v)
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0")
    } catch {
      /* ignore */
    }
  }, [])

  const toggle = useCallback(() => setHidden(!hidden), [hidden, setHidden])

  return <Ctx.Provider value={{ hidden, toggle, setHidden }}>{children}</Ctx.Provider>
}

/**
 * Valor monetário que respeita o modo "esconder valores".
 * Recebe um número + moeda, ou um texto já formatado via `text`.
 */
export function Money({
  value,
  currency = "BRL",
  text,
  className,
}: {
  value?: number
  currency?: string
  text?: string
  className?: string
}) {
  const content = text ?? formatCurrency(value ?? 0, currency)
  return <span className={cn("money", className)} data-money>{content}</span>
}

/** Botão de alternância global (olho) para esconder/mostrar valores. */
export function PrivacyToggle({ className }: { className?: string }) {
  const { hidden, toggle } = usePrivacy()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={hidden ? "Mostrar valores" : "Esconder valores"}
      title={hidden ? "Mostrar valores" : "Esconder valores"}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted transition-colors hover:text-foreground",
        className,
      )}
    >
      {hidden ? <EyeOff /> : <Eye />}
    </button>
  )
}

function Eye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  )
}
