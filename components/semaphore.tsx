import { cn } from "@/lib/utils"
import { type SemaphoreColor, semaphoreFromRoas } from "@/lib/finance"
import { Badge } from "./ui"

const map: Record<SemaphoreColor, { tone: "positive" | "warning" | "negative"; label: string }> = {
  green: { tone: "positive", label: "Escalar" },
  yellow: { tone: "warning", label: "Observar" },
  red: { tone: "negative", label: "Matar" },
}

export function SemaphoreDot({ color }: { color: SemaphoreColor }) {
  const c = { green: "bg-positive", yellow: "bg-warning", red: "bg-negative" }[color]
  return (
    <span
      className={cn("inline-block h-2.5 w-2.5 rounded-full", c)}
      style={{ boxShadow: "0 0 8px currentColor" }}
      aria-hidden
    />
  )
}

export function SemaphoreBadge({ color, label }: { color: SemaphoreColor; label?: string }) {
  const m = map[color]
  return (
    <Badge tone={m.tone}>
      <SemaphoreDot color={color} />
      {label ?? m.label}
    </Badge>
  )
}

/** Componente flexível: aceita `color` direto OU `roas` para derivar a cor. */
export function Semaphore({
  color,
  roas,
  showLabel = false,
  label,
}: {
  color?: SemaphoreColor
  roas?: number
  showLabel?: boolean
  label?: string
}) {
  const resolved: SemaphoreColor = color ?? (roas !== undefined ? semaphoreFromRoas(roas) : "yellow")
  if (showLabel || label) return <SemaphoreBadge color={resolved} label={label} />
  return <SemaphoreDot color={resolved} />
}
