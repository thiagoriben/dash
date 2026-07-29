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

export function SpendRevenueChart({ data }: { data: TimePoint[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date + "T00:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={formatted} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2de2e6" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#2de2e6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#8a93a8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: "#8a93a8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={64}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{
            background: "#0f1524",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            color: "#e8ecf4",
            fontSize: 12,
          }}
          labelStyle={{ color: "#8a93a8" }}
          formatter={(value: number, name) => [
            formatCurrency(value),
            name === "revenue" ? "Faturamento" : "Gasto",
          ]}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#2de2e6"
          strokeWidth={2}
          fill="url(#gRevenue)"
        />
        <Area
          type="monotone"
          dataKey="spend"
          stroke="#8b5cf6"
          strokeWidth={2}
          fill="url(#gSpend)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
