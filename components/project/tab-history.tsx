"use client"

import type { ActivityLog } from "@/lib/types"
import { timeAgo, actionLabel } from "@/lib/activity"
import { Card, CardContent, Badge } from "@/components/ui"
import { History } from "lucide-react"

export function TabHistory({ activity }: { activity: ActivityLog[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-semibold">Histórico</h2>
        <p className="text-sm text-muted">
          Todas as alterações do projeto, quem fez e há quanto tempo.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {activity.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">
              Nenhuma atividade registrada ainda.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--color-border)]">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="mt-0.5 text-muted">
                    <History size={16} />
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{a.actor_name ?? "Alguém"}</span>
                      <Badge tone="default">{actionLabel(a.action)}</Badge>
                    </div>
                    <p className="text-sm text-foreground/90">{a.summary ?? a.entity}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted">
                    {timeAgo(a.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
