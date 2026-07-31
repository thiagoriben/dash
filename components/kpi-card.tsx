import { cn } from "@/lib/utils"
import { Sparkline } from "./sparkline"
import { TrendingUp, TrendingDown } from "lucide-react"

export function KpiCard({
  label,
  value,
  hint,
  delta,
  trend,
  icon,
  accent = "primary",
}: {
  label: string
  value: string
  hint?: string
  delta?: number
  trend?: number[]
  icon?: React.ReactNode
  accent?: "primary" | "positive" | "negative" | "warning" | "secondary"
}) {
  const positive = (delta ?? 0) >= 0
  const accentColor = {
    primary: "text-primary",
    positive: "text-positive",
    negative: "text-negative",
    warning: "text-warning",
    secondary: "text-secondary",
  }[accent]

  return (
    <div className="glass glass-hover rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
          {icon ? <span className={accentColor}>{icon}</span> : null}
          {label}
        </div>
        {typeof delta === "number" ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              positive ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative",
            )}
          >
            {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <div className="money font-mono text-2xl font-semibold tracking-tight text-foreground" data-money>
            {value}
          </div>
          {hint ? <div className="money mt-1 font-mono text-[11px] text-muted" data-money>{hint}</div> : null}
        </div>
        {trend && trend.length > 1 ? <Sparkline data={trend} /> : null}
      </div>
    </div>
  )
}
