"use client"

import { useState, useTransition } from "react"
import { Bug, Lightbulb, MessageCircle, Check, RotateCcw } from "lucide-react"
import { Card, CardContent, Button } from "@/components/ui"
import { setFeedbackStatus } from "@/app/actions/social"
import type { FeedbackView } from "@/lib/data"
import { cn } from "@/lib/utils"

const kindMeta: Record<string, { label: string; icon: typeof Bug }> = {
  bug: { label: "Bug", icon: Bug },
  suggestion: { label: "Sugestão", icon: Lightbulb },
  other: { label: "Outro", icon: MessageCircle },
}

export function FeedbackAdminList({ items }: { items: FeedbackView[] }) {
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open")
  const filtered = items.filter((f) => (filter === "all" ? true : f.status === filter))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {(["open", "resolved", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm transition-colors",
              filter === f
                ? "border-primary bg-primary/10 text-foreground"
                : "border-[color:var(--color-border)] text-muted hover:text-foreground",
            )}
          >
            {f === "open" ? "Abertos" : f === "resolved" ? "Resolvidos" : "Todos"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted">Nada por aqui.</CardContent>
        </Card>
      ) : (
        filtered.map((f) => <FeedbackRow key={f.id} item={f} />)
      )}
    </div>
  )
}

function FeedbackRow({ item }: { item: FeedbackView }) {
  const [pending, startTransition] = useTransition()
  const meta = kindMeta[item.kind] ?? kindMeta.other
  const Icon = meta.icon
  const resolved = item.status === "resolved"

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <span
            className={cn(
              "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
              item.kind === "bug" ? "bg-danger/15 text-danger" : "bg-primary/15 text-primary",
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{meta.label}</span>
              <span className="text-muted">·</span>
              <span className="text-muted">{item.profile?.full_name || item.profile?.username || "Usuário"}</span>
              {item.page && (
                <>
                  <span className="text-muted">·</span>
                  <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-muted">{item.page}</code>
                </>
              )}
            </div>
            <p className="text-sm text-foreground/90">{item.message}</p>
            <span className="text-[10px] text-muted">
              {new Date(item.created_at).toLocaleString("pt-BR")}
            </span>
          </div>
        </div>
        <div className="shrink-0">
          <Button
            variant={resolved ? "ghost" : "outline"}
            size="sm"
            disabled={pending}
            onClick={() => startTransition(() => void setFeedbackStatus(item.id, resolved ? "open" : "resolved"))}
          >
            {resolved ? (
              <>
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reabrir
              </>
            ) : (
              <>
                <Check className="mr-1 h-3.5 w-3.5" /> Resolver
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
