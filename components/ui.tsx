"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/* ---------- Card ---------- */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass glass-hover rounded-2xl", className)} {...props} />
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-3", className)} {...props} />
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("font-display text-base font-semibold text-foreground", className)} {...props} />
  )
}
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted", className)} {...props} />
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...props} />
}

/* ---------- Button ---------- */
type ButtonVariant = "primary" | "outline" | "ghost" | "danger"
type ButtonSize = "sm" | "md" | "icon"
const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-[color:var(--brand-fg)] font-semibold hover:brightness-110 shadow-[0_0_22px_color-mix(in_srgb,var(--brand)_35%,transparent)]",
  outline: "border border-[color:var(--color-border-strong)] text-foreground hover:bg-white/5",
  ghost: "text-muted hover:text-foreground hover:bg-white/5",
  danger: "bg-negative/90 text-white font-semibold hover:bg-negative",
}
const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm rounded-lg",
  md: "h-10 px-4 text-sm rounded-xl",
  icon: "h-9 w-9 rounded-lg",
}
export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(function Button({ className, variant = "primary", size = "md", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "press inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  )
})

/* ---------- Input / Label / Select / Textarea ---------- */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 text-sm text-foreground placeholder:text-muted/70 focus:border-primary/50 focus:outline-none",
          className,
        )}
        {...props}
      />
    )
  },
)
export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-20 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-sm text-foreground placeholder:text-muted/70 focus:border-primary/50 focus:outline-none",
        className,
      )}
      {...props}
    />
  )
})
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-xs font-medium text-muted", className)} {...props} />
}
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 text-sm text-foreground focus:border-primary/50 focus:outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
})

/* ---------- Field wrapper ---------- */
export function Field({
  label,
  children,
  className,
  hint,
}: {
  label: string
  children: React.ReactNode
  className?: string
  /** Descrição curta abaixo do campo, para explicar o que ele faz. */
  hint?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-[11px] leading-snug text-muted">{hint}</p> : null}
    </div>
  )
}

/* ---------- Badge ---------- */
type BadgeTone =
  | "default"
  | "primary"
  | "positive"
  | "negative"
  | "warning"
  | "secondary"
  | "success"
  | "danger"
const badgeTones: Record<BadgeTone, string> = {
  default: "bg-white/5 text-muted border-white/10",
  primary: "bg-primary/10 text-primary border-primary/30",
  positive: "bg-positive/10 text-positive border-positive/30",
  negative: "bg-negative/10 text-negative border-negative/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  secondary: "bg-secondary/10 text-secondary border-secondary/30",
  success: "bg-positive/10 text-positive border-positive/30",
  danger: "bg-negative/10 text-negative border-negative/30",
}
export function Badge({
  tone = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  )
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-white/5", className)}
      aria-hidden="true"
      {...props}
    />
  )
}

/* ---------- Table ---------- */
export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  )
}
export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-[color:var(--color-border)] px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted",
        className,
      )}
      {...props}
    />
  )
}
export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("border-b border-[color:var(--color-border)]/60 px-3 py-2.5", className)} {...props} />
  )
}
