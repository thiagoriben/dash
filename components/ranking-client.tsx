"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, Button, Badge } from "@/components/ui"
import type { RankingRow } from "@/lib/ranking"
import { Trophy, Crown, EyeOff, Users, Globe } from "lucide-react"

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

const MONTH = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })

function RankList({ rows }: { rows: RankingRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <Trophy size={28} className="text-muted" />
          <p className="text-sm text-muted text-pretty">
            Ninguém participando ainda. Ative o ranking no seu perfil para aparecer aqui.
          </p>
          <Link href="/perfil">
            <Button variant="outline" size="sm">
              Ir para o perfil
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r, i) => {
        const pos = i + 1
        const leader = pos === 1 && (r.revenue ?? 0) > 0
        return (
          <Card key={r.userId} className={r.isMe ? "border-accent/50" : undefined}>
            <CardContent className="flex items-center gap-3 py-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-sm font-semibold"
                style={{
                  backgroundColor: leader ? "var(--brand)" : "var(--surface-2)",
                  color: leader ? "#000" : "var(--foreground)",
                }}
              >
                {pos}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{r.displayName}</span>
                  {leader ? (
                    <Badge tone="primary">
                      <Crown size={12} /> Líder
                    </Badge>
                  ) : null}
                  {r.isMe ? <Badge tone="default">Você</Badge> : null}
                </div>
              </div>
              <div className="shrink-0 text-right font-display text-sm font-semibold">
                {r.revenue === null ? (
                  <span className="inline-flex items-center gap-1 text-muted">
                    <EyeOff size={13} /> Oculto
                  </span>
                ) : (
                  brl(r.revenue)
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export function RankingClient({
  geral,
  socios,
  optedIn,
}: {
  geral: RankingRow[]
  socios: RankingRow[]
  optedIn: boolean
}) {
  const [tab, setTab] = useState<"geral" | "socios">("geral")
  const rows = tab === "geral" ? geral : socios

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Ranking de faturamento</h1>
          <p className="text-sm text-muted capitalize">{MONTH}</p>
        </div>
      </div>

      {!optedIn ? (
        <Card className="border-accent/40">
          <CardContent className="flex items-center gap-3 py-4">
            <Trophy size={18} className="shrink-0 text-accent" />
            <p className="text-sm text-pretty">
              Você não está participando. Ative no{" "}
              <Link href="/perfil" className="text-accent underline">
                seu perfil
              </Link>{" "}
              para entrar na disputa mensal.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex w-fit items-center gap-1 rounded-xl border border-border bg-surface-2 p-1">
        <button
          onClick={() => setTab("geral")}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm data-[on=true]:bg-accent data-[on=true]:text-black"
          data-on={tab === "geral"}
        >
          <Globe size={14} /> Geral
        </button>
        <button
          onClick={() => setTab("socios")}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm data-[on=true]:bg-accent data-[on=true]:text-black"
          data-on={tab === "socios"}
        >
          <Users size={14} /> Sócios
        </button>
      </div>

      <RankList rows={rows} />
    </div>
  )
}
