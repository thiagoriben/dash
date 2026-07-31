"use client"

import { useMemo } from "react"
import type { DayCount } from "@/lib/activity"

/**
 * Heatmap estilo GitHub: uma célula por dia nas últimas ~19 semanas.
 * Intensidade da cor de destaque proporcional à atividade do dia (com teto).
 */
export function ActivityHeatmap({
  data,
  weeks = 19,
}: {
  data: DayCount[]
  weeks?: number
}) {
  const { columns, total, max } = useMemo(() => {
    const counts = new Map(data.map((d) => [d.date, d.count]))
    const days = weeks * 7
    const today = new Date()
    // Alinha o fim da grade ao fim da semana atual (sábado).
    const end = new Date(today)
    end.setDate(end.getDate() + (6 - end.getDay()))
    const cells: { date: string; count: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end)
      d.setDate(end.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      cells.push({ date: key, count: counts.get(key) ?? 0 })
    }
    const cols: { date: string; count: number }[][] = []
    for (let w = 0; w < weeks; w++) cols.push(cells.slice(w * 7, w * 7 + 7))
    const total = data.reduce((s, d) => s + d.count, 0)
    const max = Math.max(1, ...data.map((d) => d.count))
    return { columns: cols, total, max }
  }, [data, weeks])

  function level(count: number): number {
    if (count <= 0) return 0
    const ratio = count / max
    if (ratio > 0.66) return 4
    if (ratio > 0.33) return 3
    if (ratio > 0.1) return 2
    return 1
  }

  const opacities = [0, 0.25, 0.45, 0.7, 1]
  const future = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-1 overflow-x-auto pb-1">
        {columns.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-1">
            {col.map((cell) => {
              const isFuture = cell.date > future
              const lvl = level(cell.count)
              return (
                <div
                  key={cell.date}
                  title={`${cell.date}: ${cell.count} atividade(s)`}
                  className="h-3 w-3 rounded-sm border border-border/50"
                  style={{
                    backgroundColor: isFuture
                      ? "transparent"
                      : lvl === 0
                        ? "var(--surface-2)"
                        : "var(--brand)",
                    opacity: isFuture ? 0.2 : lvl === 0 ? 1 : opacities[lvl],
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{total} atividades no período</span>
        <div className="flex items-center gap-1">
          <span>menos</span>
          {opacities.map((op, i) => (
            <div
              key={i}
              className="h-3 w-3 rounded-sm border border-border/50"
              style={{
                backgroundColor: i === 0 ? "var(--surface-2)" : "var(--brand)",
                opacity: i === 0 ? 1 : op,
              }}
            />
          ))}
          <span>mais</span>
        </div>
      </div>
    </div>
  )
}
