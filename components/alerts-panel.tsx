import type { ProjectRank } from "@/lib/aggregate"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { formatCurrency } from "@/lib/utils"
import { Bell, AlertTriangle, TrendingDown, CheckCircle2 } from "lucide-react"

export function AlertsPanel({ ranking }: { ranking: ProjectRank[] }) {
  const alerts: { level: "red" | "warning" | "green"; text: string }[] = []

  for (const r of ranking) {
    if (r.profit < 0) {
      alerts.push({
        level: "red",
        text: `${r.project.name} no vermelho (${formatCurrency(r.profit)})`,
      })
    } else if (r.roas > 0 && r.roas < 1.2 && r.spend > 0) {
      alerts.push({
        level: "warning",
        text: `${r.project.name} com ROAS baixo (${r.roas.toFixed(2)}x)`,
      })
    }
  }

  const top = ranking.find((r) => r.profit > 0 && r.roas >= 2)
  if (top) {
    alerts.push({ level: "green", text: `${top.project.name} performando bem — considere escalar` })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell size={16} className="text-warning" />
          Alertas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted">
            <CheckCircle2 size={24} className="text-positive" />
            Tudo sob controle. Nenhum alerta no período.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {alerts.slice(0, 6).map((a, i) => {
              const Icon =
                a.level === "red" ? TrendingDown : a.level === "warning" ? AlertTriangle : CheckCircle2
              const color =
                a.level === "red"
                  ? "text-negative"
                  : a.level === "warning"
                    ? "text-warning"
                    : "text-positive"
              return (
                <li
                  key={i}
                  className="flex items-start gap-2.5 rounded-xl border border-[color:var(--color-border)] bg-white/[0.02] px-3 py-2.5 text-sm"
                >
                  <Icon size={16} className={`mt-0.5 shrink-0 ${color}`} />
                  <span className="text-foreground/90">{a.text}</span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
