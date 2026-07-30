"use client"

import { useId } from "react"

export function Sparkline({
  data,
  width = 120,
  height = 36,
}: {
  data: number[]
  width?: number
  height?: number
}) {
  const id = useId()
  if (!data || data.length < 2) {
    return <div style={{ width, height }} aria-hidden />
  }
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = width / (data.length - 1)
  const points = data.map((d, i) => {
    const x = i * step
    const y = height - ((d - min) / range) * (height - 4) - 2
    return [x, y]
  })
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const area = `${line} L${width},${height} L0,${height} Z`

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={`spark-line-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2de2e6" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id={`spark-fill-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(45,226,230,0.25)" />
          <stop offset="100%" stopColor="rgba(45,226,230,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-fill-${id})`} />
      <path
        d={line}
        fill="none"
        stroke={`url(#spark-line-${id})`}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 4px rgba(45,226,230,0.5))" }}
      />
    </svg>
  )
}
