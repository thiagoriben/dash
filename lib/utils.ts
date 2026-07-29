import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency: "BRL" | "USD" = "BRL") {
  const symbol = currency === "USD" ? "US$" : "R$"
  const n = Number.isFinite(value) ? value : 0
  return `${symbol} ${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatNumber(value: number, digits = 0) {
  const n = Number.isFinite(value) ? value : 0
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatPercent(value: number, digits = 1) {
  const n = Number.isFinite(value) ? value : 0
  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`
}

export function safeDiv(a: number, b: number) {
  if (!b) return 0
  const r = a / b
  return Number.isFinite(r) ? r : 0
}
