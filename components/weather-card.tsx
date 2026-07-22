"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import ReactEChartsCore from "echarts-for-react/lib/core"
import * as echarts from "echarts/core"
import { LineChart, BarChart } from "echarts/charts"
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"
import {
  Thermometer,
  Droplets,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  RefreshCw,
} from "lucide-react"
import type { DailyForecast } from "@/app/api/weather/route"
import { cn } from "@/lib/utils"

echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
])

interface WeatherCardProps {
  city: string
  country: string
  date: string
  startTime: string
  lat?: number
  lon?: number
}

export function WeatherCard({ city, country, date, startTime, lat, lon }: WeatherCardProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [daily, setDaily] = useState<DailyForecast[]>([])
  const chartRef = useRef<ReactEChartsCore>(null)

  const fetchWeather = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ city, country, date })
      if (lat !== undefined) params.set("lat", lat.toString())
      if (lon !== undefined) params.set("lon", lon.toString())
      const res = await fetch(`/api/weather?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setDaily(json.daily || [])
      } else {
        const err = await res.json().catch(() => ({}))
        setError(err.error || "获取天气失败")
      }
    } catch {
      setError("网络错误")
    } finally {
      setLoading(false)
    }
  }, [city, country, date, lat, lon])

  useEffect(() => {
    fetchWeather()
  }, [fetchWeather])

  const raceDayData = useMemo(() => {
    if (!daily.length) return null
    return daily.find((d) => d.date === date) || daily[3] || null
  }, [daily, date])

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <RefreshCw className="size-3 animate-spin" />
        <Thermometer className="size-3" />
      </div>
    )
  }

  if (error || !daily.length) return null

  return (
    <div className="rounded-xl border border-border/40 bg-background/60 backdrop-blur-sm p-3 shadow-sm">
      {raceDayData && (
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Thermometer className="size-5 text-primary" />
            </div>
            <div>
              <div className="text-lg font-semibold text-foreground">
                {Math.round(raceDayData.tempMax)}°
              </div>
              <div className="text-xs text-muted-foreground">
                最低 {Math.round(raceDayData.tempMin)}°
              </div>
            </div>
          </div>
          {raceDayData.precipitationProbability > 30 && (
            <div className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1.5 text-xs text-blue-500">
              <Droplets className="size-3" />
              {raceDayData.precipitationProbability}%
            </div>
          )}
        </div>
      )}
      <WeatherChart daily={daily} raceDate={date} />
    </div>
  )
}

function WeatherChart({ daily, raceDate }: { daily: DailyForecast[]; raceDate: string }) {
  const days = useMemo(() => {
    return daily.slice(0, 7).map((d) => ({
      ...d,
      label: formatDayLabel(d.date, raceDate),
      isRace: d.date === raceDate,
    }))
  }, [daily, raceDate])

  if (days.length === 0) return null

  const option = useMemo(() => {
    const labels = days.map((d) => d.label)
    const raceIndex = days.findIndex((d) => d.isRace)

    return {
      backgroundColor: "transparent",
      grid: {
        left: "8%",
        right: "4%",
        top: "12%",
        bottom: "25%",
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderColor: "#e5e7eb",
        borderWidth: 1,
        textStyle: {
          color: "#374151",
        },
        axisPointer: {
          type: "cross",
          lineStyle: {
            color: "#9ca3af",
            width: 1,
            type: "dashed",
          },
        },
        formatter: (params: any) => {
          const day = days[params[0].dataIndex]
          let html = `<div class="font-medium mb-1">${day.label}</div>`
          params.forEach((item: any) => {
            const value = item.seriesName.includes("降水") ? `${item.value}%` : `${Math.round(item.value)}°`
            html += `<div class="flex items-center gap-2 text-sm">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${item.color}"></span>
              <span>${item.seriesName}: ${value}</span>
            </div>`
          })
          return html
        },
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLine: {
          lineStyle: {
            color: "#e5e7eb",
          },
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: raceIndex >= 0 ? (value: string, index: number) => 
            index === raceIndex ? "#f59e0b" : "#9ca3af" : "#9ca3af",
          fontSize: 11,
          fontWeight: raceIndex >= 0 ? (value: string, index: number) => 
            index === raceIndex ? 600 : 400 : 400,
        },
      },
      yAxis: [
        {
          type: "value",
          name: "°C",
          nameTextStyle: {
            color: "#9ca3af",
            fontSize: 10,
            padding: [0, 0, 0, -20],
          },
          axisLine: {
            show: false,
          },
          axisTick: {
            show: false,
          },
          axisLabel: {
            color: "#9ca3af",
            fontSize: 10,
            formatter: "{value}°",
          },
          splitLine: {
            lineStyle: {
              color: "#f3f4f6",
              type: "dashed",
            },
          },
        },
        {
          type: "value",
          name: "%",
          nameTextStyle: {
            color: "#9ca3af",
            fontSize: 10,
            padding: [0, -20, 0, 0],
          },
          axisLine: {
            show: false,
          },
          axisTick: {
            show: false,
          },
          axisLabel: {
            color: "#9ca3af",
            fontSize: 10,
            formatter: "{value}%",
          },
          splitLine: {
            show: false,
          },
          max: 100,
        },
      ],
      series: [
        {
          name: "高温",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: {
            color: "#f59e0b",
            width: 2.5,
          },
          itemStyle: {
            color: "#f59e0b",
            borderWidth: 2,
            borderColor: "#fff",
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(245, 158, 11, 0.15)" },
              { offset: 0.5, color: "rgba(245, 158, 11, 0.08)" },
              { offset: 1, color: "rgba(245, 158, 11, 0.02)" },
            ]),
          },
          data: days.map((d) => d.tempMax),
        },
        {
          name: "低温",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 5,
          lineStyle: {
            color: "#94a3b8",
            width: 1.5,
          },
          itemStyle: {
            color: "#94a3b8",
            borderWidth: 1.5,
            borderColor: "#fff",
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(148, 163, 184, 0.08)" },
              { offset: 1, color: "rgba(148, 163, 184, 0.02)" },
            ]),
          },
          data: days.map((d) => d.tempMin),
        },
        {
          name: "降水",
          type: "bar",
          yAxisIndex: 1,
          barWidth: "30%",
          itemStyle: {
            color: (params: any) => {
              const val = params.value
              return val > 50 
                ? "rgba(96, 165, 250, 0.6)" 
                : "rgba(147, 197, 253, 0.5)"
            },
            borderRadius: [4, 4, 0, 0],
          },
          data: days.map((d) => d.precipitationProbability),
        },
      ],
    }
  }, [days])

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[300px]">
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          style={{ height: "180px", width: "100%" }}
          opts={{ renderer: "canvas" }}
        />
      </div>
    </div>
  )
}

function formatDayLabel(dateStr: string, raceDate: string): string {
  const d = new Date(dateStr + "T00:00:00")
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)

  if (dateStr === raceDate) return "赛日"
  if (diff === 0) return "今天"
  if (diff === 1) return "明天"
  if (diff === -1) return "昨天"

  const weekdays = ["日", "一", "二", "三", "四", "五", "六"]
  return weekdays[d.getDay()]
}