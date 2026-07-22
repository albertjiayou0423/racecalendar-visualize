"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Cloud,
  CloudRain,
  CloudSnow,
  Droplets,
  Sun,
  RefreshCw,
  CloudLightning,
  AlertTriangle,
  Thermometer,
} from "lucide-react"
import type { DailyForecast, WeatherAlert } from "@/app/api/weather/route"
import { cn } from "@/lib/utils"

interface WeatherCardProps {
  city: string
  country: string
  date: string
  startTime: string
  lat?: number
  lon?: number
}

interface WeatherData {
  daily: DailyForecast[]
  alerts: WeatherAlert[]
}

export function WeatherCard({ city, country, date, startTime, lat, lon }: WeatherCardProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<WeatherData | null>(null)

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
        setData({ daily: json.daily || [], alerts: json.alerts || [] })
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
    if (!data?.daily.length) return null
    return data.daily.find((d) => d.date === date) || data.daily[3] || null
  }, [data, date])

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <RefreshCw className="size-3 animate-spin" />
        天气
      </div>
    )
  }

  if (error || !data?.daily.length) return null

  return (
    <div className="space-y-2">
      {/* 比赛日摘要 — 极简 */}
      {raceDayData && (
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
            <Thermometer className="size-3" />
            {raceDayData.tempMax}° / {raceDayData.tempMin}°
          </span>
          {raceDayData.precipitationProbability > 30 && (
            <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-500">
              <Droplets className="size-3" />
              {raceDayData.precipitationProbability}%
            </span>
          )}
        </div>
      )}

      {/* SVG 整周天气图 */}
      <WeekWeatherChart daily={data.daily} raceDate={date} />

      {/* 预警 */}
      {data.alerts.length > 0 && (
        <div className="space-y-1">
          {data.alerts.slice(0, 2).map((alert, idx) => (
            <div
              key={idx}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-0.5 text-[10px]",
                alert.level === "severe"
                  ? "bg-red-500/10 text-red-500"
                  : "bg-amber-500/10 text-amber-500"
              )}
            >
              <AlertTriangle className="size-2.5" />
              <span className="truncate">{alert.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WeekWeatherChart({ daily, raceDate }: { daily: DailyForecast[]; raceDate: string }) {
  const days = useMemo(() => {
    return daily.slice(0, 7).map((d) => ({
      ...d,
      label: formatDayLabel(d.date, raceDate),
      isRace: d.date === raceDate,
    }))
  }, [daily, raceDate])

  if (days.length === 0) return null

  // 计算温度范围
  const allTemps = days.flatMap((d) => [d.tempMax, d.tempMin])
  const maxT = Math.max(...allTemps)
  const minT = Math.min(...allTemps)
  const pad = Math.max((maxT - minT) * 0.15, 2)
  const yMax = Math.ceil(maxT + pad)
  const yMin = Math.floor(minT - pad)
  const yRange = Math.max(yMax - yMin, 1)

  const W = 700
  const H = 140
  const padL = 28
  const padR = 8
  const padT = 32
  const padB = 28
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const colW = chartW / days.length

  const yScale = (t: number) => padT + chartH - ((t - yMin) / yRange) * chartH
  const xCenter = (i: number) => padL + colW * i + colW / 2

  // 温度折线路径
  const maxPath = days
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xCenter(i)} ${yScale(d.tempMax)}`)
    .join(" ")
  const minPath = days
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xCenter(i)} ${yScale(d.tempMin)}`)
    .join(" ")

  // 填充面积路径
  const areaPath =
    maxPath +
    " " +
    days
      .map((d, i) => `L ${xCenter(days.length - 1 - i)} ${yScale(days[days.length - 1 - i].tempMin)}`)
      .join(" ") +
    " Z"

  // 降水柱状最大高度
  const rainMaxH = 18

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[320px]"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* 温度面积渐变 */}
          <linearGradient id="tempArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.08" />
          </linearGradient>
          {/* 比赛日高亮 */}
          <linearGradient id="raceHighlight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* 比赛日背景高亮 */}
        {days.map((d, i) =>
          d.isRace ? (
            <rect
              key={`bg-${i}`}
              x={padL + colW * i + 2}
              y={padT - 4}
              width={colW - 4}
              height={chartH + padB - 4}
              rx={6}
              fill="url(#raceHighlight)"
              stroke="#f97316"
              strokeOpacity={0.25}
              strokeWidth={1}
            />
          ) : null
        )}

        {/* 温度填充面积 */}
        <path d={areaPath} fill="url(#tempArea)" />

        {/* 最低温折线 */}
        <path
          d={minPath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.7}
        />
        {/* 最高温折线 */}
        <path
          d={maxPath}
          fill="none"
          stroke="#f97316"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 温度数据点 + 标签 */}
        {days.map((d, i) => {
          const cx = xCenter(i)
          return (
            <g key={`pt-${i}`}>
              {/* 最高温点 */}
              <circle cx={cx} cy={yScale(d.tempMax)} r={3} fill="#f97316" />
              {/* 最低温点 */}
              <circle cx={cx} cy={yScale(d.tempMin)} r={2.5} fill="#3b82f6" />
              {/* 最高温数值 */}
              <text
                x={cx}
                y={yScale(d.tempMax) - 8}
                textAnchor="middle"
                className="fill-foreground"
                style={{ fontSize: "10px", fontWeight: 600 }}
              >
                {Math.round(d.tempMax)}°
              </text>
              {/* 最低温数值 */}
              <text
                x={cx}
                y={yScale(d.tempMin) + 14}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: "9px" }}
              >
                {Math.round(d.tempMin)}°
              </text>
            </g>
          )
        })}

        {/* 降水概率柱状图（底部） */}
        {days.map((d, i) => {
          const cx = xCenter(i)
          const barW = Math.min(colW * 0.5, 28)
          const barH = (d.precipitationProbability / 100) * rainMaxH
          const barY = H - padB + 4 - barH
          return (
            <g key={`rain-${i}`}>
              <rect
                x={cx - barW / 2}
                y={barY}
                width={barW}
                height={barH}
                rx={2}
                fill="#3b82f6"
                opacity={0.15 + (d.precipitationProbability / 100) * 0.5}
              />
              {d.precipitationProbability > 20 && (
                <text
                  x={cx}
                  y={barY - 3}
                  textAnchor="middle"
                  className="fill-blue-500"
                  style={{ fontSize: "8px" }}
                >
                  {d.precipitationProbability}%
                </text>
              )}
            </g>
          )
        })}

        {/* 天气图标（用 foreignObject 嵌入 Lucide） */}
        {days.map((d, i) => {
          const cx = xCenter(i)
          const iconSize = 16
          return (
            <foreignObject
              key={`icon-${i}`}
              x={cx - iconSize / 2}
              y={2}
              width={iconSize}
              height={iconSize}
            >
              <div className="flex items-center justify-center">
                <MiniWeatherIcon code={d.weatherCode} size={iconSize} />
              </div>
            </foreignObject>
          )
        })}

        {/* 星期标签 */}
        {days.map((d, i) => {
          const cx = xCenter(i)
          return (
            <text
              key={`label-${i}`}
              x={cx}
              y={H - 6}
              textAnchor="middle"
              className={cn(
                "fill-muted-foreground",
                d.isRace && "fill-primary font-semibold"
              )}
              style={{ fontSize: "10px" }}
            >
              {d.label}
            </text>
          )
        })}

        {/* Y轴刻度（只画最高和最低） */}
        <text
          x={padL - 4}
          y={padT + 4}
          textAnchor="end"
          className="fill-muted-foreground"
          style={{ fontSize: "8px" }}
        >
          {yMax}°
        </text>
        <text
          x={padL - 4}
          y={padT + chartH + 3}
          textAnchor="end"
          className="fill-muted-foreground"
          style={{ fontSize: "8px" }}
        >
          {yMin}°
        </text>
      </svg>
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

function MiniWeatherIcon({ code, size }: { code: number; size: number }) {
  const props = { size, strokeWidth: 1.5 }
  if (code === 0) return <Sun {...props} className="text-amber-500" />
  if (code <= 3) return <Cloud {...props} className="text-gray-400" />
  if (code <= 49) return <Cloud {...props} className="text-gray-500" />
  if (code <= 59) return <Droplets {...props} className="text-blue-400" />
  if (code <= 69) return <CloudRain {...props} className="text-blue-500" />
  if (code <= 79) return <CloudSnow {...props} className="text-cyan-400" />
  if (code <= 99) return <CloudLightning {...props} className="text-purple-500" />
  return <Cloud {...props} className="text-gray-400" />
}
