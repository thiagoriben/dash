"use client"

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatCurrency } from "@/lib/utils"

export type RankingDatum = { name: string; value: number }

const BAR_COLORS = ["#29f57e", "#38bdf8", "#ff9838", "#a78bfa", "#f472b6", "#facc15"]

/**
 * Ranking horizontal reutilizável (barras). Usado para rankear criativos, produtos e
 * origens por faturamento/quantidade na dashboard do projeto.
 */
export function RankingBarChart({
  data,
  currency,
  kind = "currency",
  emptyLabel = "Sem dados no período.",
}: {
  data: RankingDatum[]
  currency?: string
  /** currency: formata como moeda. number: valor cru (ex.: quantidade de vendas). */
  kind?: "currency" | "number"
  emptyLabel?: string
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, 8)
  const fmt = (v: number) => (kind === "currency" ? formatCurrency(v, currency) : String(Math.round(v)))

  if (sorted.length === 0 || sorted.every((d) => d.value === 0)) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-muted">{emptyLabel}</div>
  }

  return (
    <div className="relative h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%" debounce={80}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#c7ccd3", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={120}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "#16191d",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              color: "#f1f3f5",
              fontSize: 12,
            }}
            formatter={(value: number) => [fmt(value), "Total"]}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={26}>
            {sorted.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
