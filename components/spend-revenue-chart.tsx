"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { TimePoint } from "@/lib/aggregate"
import { formatCurrency } from "@/lib/utils"

export function SpendRevenueChart({ data, currency = "BRL" }: { data: TimePoint[]; currency?: string }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date + "T00:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
  }))

  return (
    <div className="relative h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%" debounce={80}>
        <AreaChart data={formatted} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#29f57e" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#29f57e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff9838" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#ff9838" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#9098a3", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: "#9098a3", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={64}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              background: "#16191d",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              color: "#f1f3f5",
              fontSize: 12,
            }}
            labelStyle={{ color: "#9098a3" }}
            formatter={(value: number, name) => [
              formatCurrency(value, currency),
              name === "revenue" ? "Faturamento" : "Gasto",
            ]}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#29f57e"
            strokeWidth={2}
            fill="url(#gRevenue)"
          />
          <Area
            type="monotone"
            dataKey="spend"
            stroke="#ff9838"
            strokeWidth={2}
            fill="url(#gSpend)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
