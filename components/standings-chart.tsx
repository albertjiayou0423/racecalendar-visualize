"use client"

import { useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChartData {
  name: string
  shortName: string
  points: number
  wins: number
}

interface StandingsChartProps {
  title: string
  data: ChartData[]
}

export function StandingsChart({ title, data }: StandingsChartProps) {
  const [metric, setMetric] = useState<"points" | "wins">("points")

  if (data.length === 0) return null

  const sortedData = [...data].sort((a, b) => b[metric] - a[metric])
  const maxValue = Math.max(...sortedData.map((d) => d[metric]))
  const colorScale = sortedData.map((_, i) => {
    if (i === 0) return "#fbbf24" // 金色
    if (i === 1) return "#e5e7eb" // 银色
    if (i === 2) return "#f59e0b" // 铜色
    return "#3b82f6" // 蓝色
  })

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-primary" />
          <h3 className="font-semibold">{title}</h3>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          <button
            onClick={() => setMetric("points")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              metric === "points"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            积分
          </button>
          <button
            onClick={() => setMetric("wins")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              metric === "wins"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            胜场
          </button>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sortedData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="shortName"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              interval={0}
              angle={data.length > 8 ? 45 : 0}
              height={data.length > 8 ? 50 : 30}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              domain={[0, Math.ceil(maxValue * 1.1)]}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload as ChartData
                  return (
                    <div className="rounded-lg border border-border bg-card p-2 text-xs shadow-lg">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-muted-foreground">
                        {metric === "points" ? "积分" : "胜场"}: {payload[0].value}
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey={metric} radius={[4, 4, 0, 0]}>
              {sortedData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colorScale[index]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="size-2 rounded-full bg-amber-400" />
          <span>第1名</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="size-2 rounded-full bg-gray-300" />
          <span>第2名</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="size-2 rounded-full bg-amber-600" />
          <span>第3名</span>
        </div>
      </div>
    </div>
  )
}
