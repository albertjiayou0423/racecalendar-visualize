"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import ReactEChartsCore from "echarts-for-react/lib/core"
import * as echarts from "echarts/core"
import { LineChart, BarChart } from "echarts/charts"
import {
  GridComponent,
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-50 to-orange-50">
              <Thermometer className="size-4 text-amber-500" />
            </div>
            <div>
              <div className="text-base font-medium text-foreground">
                {Math.round(raceDayData.tempMax)}°
              </div>
              <div className="text-xs text-muted-foreground">
                {Math.round(raceDayData.tempMin)}°
              </div>
            </div>
          </div>
          {raceDayData.precipitationProbability > 30 && (
            <div className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs text-blue-500">
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
        left: "4%",
        right: "4%",
        top: "8%",
        bottom: "18%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: raceIndex >= 0 ? (value: string, index: number) => 
            index === raceIndex ? "#f59e0b" : "#94a3b8" : "#94a3b8",
          fontSize: 11,
          fontWeight: raceIndex >= 0 ? (value: string, index: number) => 
            index === raceIndex ? 600 : 400 : 400,
        },
      },
      yAxis: [
        {
          type: "value",
          axisLine: {
            show: false,
          },
          axisTick: {
            show: false,
          },
          axisLabel: {
            show: false,
          },
          splitLine: {
            show: false,
          },
        },
        {
          type: "value",
          axisLine: {
            show: false,
          },
          axisTick: {
            show: false,
          },
          axisLabel: {
            show: false,
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
            borderColor: "#ffffff",
          },
          label: {
            show: true,
            position: "top",
            color: "#f59e0b",
            fontSize: 10,
            fontWeight: 500,
            formatter: (params: any) => `${Math.round(params.value)}°`,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(245, 158, 11, 0.12)" },
              { offset: 1, color: "rgba(245, 158, 11, 0)" },
            ]),
          },
          data: days.map((d) => d.tempMax),
        },
        {
          name: "低温",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: {
            color: "#64748b",
            width: 1.5,
          },
          itemStyle: {
            color: "#64748b",
            borderWidth: 1.5,
            borderColor: "#ffffff",
          },
          label: {
            show: true,
            position: "bottom",
            color: "#64748b",
            fontSize: 9,
            fontWeight: 400,
            formatter: (params: any) => `${Math.round(params.value)}°`,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(100, 116, 139, 0.06)" },
              { offset: 1, color: "rgba(100, 116, 139, 0)" },
            ]),
          },
          data: days.map((d) => d.tempMin),
        },
        {
          name: "降水",
          type: "bar",
          yAxisIndex: 1,
          barWidth: "20%",
          itemStyle: {
            color: (params: any) => {
              const val = params.value
              return val > 50 
                ? "rgba(96, 165, 250, 0.5)" 
                : "rgba(147, 197, 253, 0.4)"
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
      <div className="min-w-[280px]">
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          style={{ height: "140px", width: "100%" }}
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