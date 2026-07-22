"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import ReactEChartsCore from "echarts-for-react/lib/core"
import * as echarts from "echarts/core"
import { LineChart, BarChart } from "echarts/charts"
import {
  GridComponent,
  TooltipComponent,
} from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"
import {
  Thermometer,
  Droplets,
  RefreshCw,
} from "lucide-react"
import type { DailyForecast } from "@/app/api/weather/route"

echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
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
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCw className="size-3 animate-spin" />
        <Thermometer className="size-3" />
      </div>
    )
  }

  if (error || !daily.length) return null

  return (
    <div className="space-y-3">
      {raceDayData && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-900/50 to-orange-900/50">
              <Thermometer className="size-4 text-amber-500" />
            </div>
            <div>
              <div className="text-base font-medium text-amber-500">
                {Math.round(raceDayData.tempMax)}°
              </div>
              <div className="text-xs text-sky-400">
                {Math.round(raceDayData.tempMin)}°
              </div>
            </div>
          </div>
          {raceDayData.precipitationProbability > 30 && (
            <div className="flex items-center gap-1 rounded-lg bg-blue-500/10 px-2 py-1 text-xs text-blue-400">
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
      tooltip: {
        show: true,
        trigger: "axis",
        triggerOn: "mousemove|click",
        hideDelay: 50,
        alwaysShowContent: false,
        enterable: false,
        axisPointer: {
          type: "cross",
          crossStyle: {
            color: "rgba(255,255,255,0.15)",
            type: "dashed",
            width: 1,
          },
          label: {
            backgroundColor: "rgba(20,23,28,0.8)",
            color: "rgba(255,255,255,0.6)",
            fontSize: 12,
            borderRadius: 0,
            padding: [4, 8],
            margin: 6,
          },
        },
        backgroundColor: "rgba(20, 23, 28, 0.92)",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        borderRadius: 0,
        padding: [12, 16],
        shadowBlur: 24,
        shadowColor: "rgba(0,0,0,0.6)",
        textStyle: {
          color: "rgba(255,255,255,0.85)",
          fontSize: 13,
          lineHeight: 24,
        },
        position: function (point: number[], params: any[], dom: HTMLElement, rect: any, size: any) {
          const tooltipHeight = dom.offsetHeight || 80
          const tooltipWidth = dom.offsetWidth || 180
          const viewHeight = size.viewSize[1]
          const viewWidth = size.viewSize[0]
          let x = point[0]
          let y = point[1]

          if (x + tooltipWidth > viewWidth - 10) {
            x = viewWidth - tooltipWidth - 10
          }
          if (x < 10) x = 10

          if (y - tooltipHeight > 20) {
            y = y - tooltipHeight - 10
          } else {
            y = y + 20
          }
          return [x, y]
        },
        formatter: function (params: any[]) {
          const date = params[0].axisValue
          let html = `<div style="font-weight:600; font-size:15px; margin-bottom:6px; color:rgba(255,255,255,0.9);">${date}</div>`
          params.forEach((p) => {
            if (p.seriesName === "最高温") {
              html += `<div style="display:flex; align-items:center; gap:8px;">
                <span style="display:inline-block; width:10px; height:10px; background:#f6ad55; border-radius:50%;"></span>
                <span style="font-weight:400;">最高温</span>
                <span style="font-weight:600; color:#f6ad55; margin-left:auto;">${Math.round(p.value)}°</span>
              </div>`
            } else if (p.seriesName === "最低温") {
              html += `<div style="display:flex; align-items:center; gap:8px;">
                <span style="display:inline-block; width:10px; height:10px; background:#6fc3df; border-radius:50%;"></span>
                <span style="font-weight:400;">最低温</span>
                <span style="font-weight:600; color:#6fc3df; margin-left:auto;">${Math.round(p.value)}°</span>
              </div>`
            } else if (p.seriesName === "降水") {
              html += `<div style="display:flex; align-items:center; gap:8px;">
                <span style="display:inline-block; width:10px; height:10px; background:#4facfe; border-radius:50%;"></span>
                <span style="font-weight:400;">降水概率</span>
                <span style="font-weight:600; color:#4facfe; margin-left:auto;">${p.value}%</span>
              </div>`
            }
          })
          return html
        },
      },
      grid: {
        left: "6%",
        right: "6%",
        bottom: "14%",
        top: "12%",
        containLabel: false,
        borderWidth: 0,
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: raceIndex >= 0 ? (value: string, index: number) => 
            index === raceIndex ? "#f6ad55" : "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.4)",
          fontSize: 12,
          fontWeight: 600,
          margin: 12,
        },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: "value",
          splitLine: {
            show: true,
            lineStyle: {
              color: "rgba(255,255,255,0.06)",
              type: "dashed",
              width: 1,
            },
          },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: "rgba(255,255,255,0.3)",
            fontSize: 11,
            fontWeight: 400,
            margin: 6,
            formatter: "{value}°",
          },
        },
        {
          type: "value",
          min: 0,
          max: 100,
          splitLine: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: "rgba(255,255,255,0.3)",
            fontSize: 11,
            fontWeight: 400,
            margin: 6,
            formatter: "{value}%",
          },
        },
      ],
      series: [
        {
          name: "最高温",
          type: "line",
          smooth: false,
          symbol: "circle",
          symbolSize: 8,
          showSymbol: true,
          lineStyle: {
            width: 3,
            color: "#f6ad55",
            shadowBlur: 12,
            shadowColor: "rgba(246, 173, 85, 0.3)",
            shadowOffsetY: 4,
          },
          itemStyle: {
            color: "#f6ad55",
            borderColor: "#14171c",
            borderWidth: 2,
            shadowBlur: 8,
            shadowColor: "rgba(246, 173, 85, 0.4)",
          },
          areaStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(246, 173, 85, 0.25)" },
                { offset: 1, color: "rgba(246, 173, 85, 0.01)" },
              ],
            },
          },
          data: days.map((d) => d.tempMax),
          yAxisIndex: 0,
          z: 2,
        },
        {
          name: "最低温",
          type: "line",
          smooth: false,
          symbol: "diamond",
          symbolSize: 8,
          showSymbol: true,
          lineStyle: {
            width: 3,
            color: "#6fc3df",
            shadowBlur: 10,
            shadowColor: "rgba(111, 195, 223, 0.25)",
            shadowOffsetY: 3,
          },
          itemStyle: {
            color: "#6fc3df",
            borderColor: "#14171c",
            borderWidth: 2,
            shadowBlur: 6,
            shadowColor: "rgba(111, 195, 223, 0.3)",
          },
          areaStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(111, 195, 223, 0.15)" },
                { offset: 1, color: "rgba(111, 195, 223, 0.01)" },
              ],
            },
          },
          data: days.map((d) => d.tempMin),
          yAxisIndex: 0,
          z: 1,
        },
        {
          name: "降水",
          type: "bar",
          barGap: "0%",
          barCategoryGap: "0%",
          barWidth: "100%",
          data: days.map((d) => d.precipitationProbability),
          yAxisIndex: 1,
          itemStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(79, 172, 254, 0.7)" },
                { offset: 1, color: "rgba(79, 172, 254, 0.2)" },
              ],
            },
            borderWidth: 0,
            shadowBlur: 10,
            shadowColor: "rgba(79, 172, 254, 0.15)",
          },
          emphasis: { itemStyle: { color: "rgba(79, 172, 254, 0.9)" } },
          z: 0,
        },
      ],
      legend: { show: false },
    }
  }, [days])

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[280px]">
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          style={{ height: "160px", width: "100%" }}
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