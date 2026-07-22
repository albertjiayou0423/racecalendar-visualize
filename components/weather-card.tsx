"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Droplets,
  Thermometer,
  RefreshCw,
} from "lucide-react"
import type { DailyForecast } from "@/app/api/weather/route"
import { cn } from "@/lib/utils"

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
      <WeekWeatherChart daily={daily} raceDate={date} />
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

  const allTemps = days.flatMap((d) => [d.tempMax, d.tempMin])
  const maxT = Math.max(...allTemps)
  const minT = Math.min(...allTemps)
  const pad = Math.max((maxT - minT) * 0.2, 4)
  const yMax = Math.ceil(maxT + pad)
  const yMin = Math.floor(minT - pad)
  const yRange = Math.max(yMax - yMin, 1)

  const W = 700
  const H = 160
  const padL = 32
  const padR = 16
  const padT = 8
  const padB = 36
  const chartH = H - padT - padB
  const chartW = W - padL - padR
  const colW = chartW / days.length

  const yScale = (t: number) => padT + ((t - yMin) / yRange) * chartH
  const xCenter = (i: number) => padL + colW * i + colW / 2

  const maxPath = days
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xCenter(i)} ${yScale(d.tempMax)}`)
    .join(" ")
  const minPath = days
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xCenter(i)} ${yScale(d.tempMin)}`)
    .join(" ")

  const areaPath =
    maxPath +
    " " +
    days
      .map((d, i) => `L ${xCenter(days.length - 1 - i)} ${yScale(days[days.length - 1 - i].tempMin)}`)
      .join(" ") +
    " Z"

  const rainMax = Math.max(...days.map((d) => d.precipitationProbability), 1)

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[300px]">
        <defs>
          <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="raceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {days.map((d, i) =>
          d.isRace ? (
            <rect
              key={`race-${i}`}
              x={padL + colW * i + 4}
              y={padT - 4}
              width={colW - 8}
              height={chartH + padB + 4}
              rx={10}
              fill="url(#raceGradient)"
              stroke="#f59e0b"
              strokeOpacity={0.2}
              strokeWidth={1}
            />
          ) : null
        )}

        <path d={areaPath} fill="url(#tempGradient)" />

        <path
          d={minPath}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={maxPath}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {days.map((d, i) => {
          const cx = xCenter(i)
          return (
            <g key={`dots-${i}`}>
              <circle cx={cx} cy={yScale(d.tempMax)} r={3.5} fill="#f59e0b" />
              <circle cx={cx} cy={yScale(d.tempMax)} r={1.5} fill="white" />
              <circle cx={cx} cy={yScale(d.tempMin)} r={3} fill="#cbd5e1" />
              <circle cx={cx} cy={yScale(d.tempMin)} r={1.2} fill="white" />
            </g>
          )
        })}

        {days.map((d, i) => {
          const cx = xCenter(i)
          const barW = Math.min(colW * 0.4, 24)
          const barH = (d.precipitationProbability / rainMax) * 18
          const barY = padT + chartH - barH
          return (
            <rect
              key={`rain-${i}`}
              x={cx - barW / 2}
              y={barY}
              width={barW}
              height={barH}
              rx={barW / 2}
              fill={d.precipitationProbability > 50 ? "#60a5fa" : "#93c5fd"}
              opacity={0.6 + (d.precipitationProbability / 100) * 0.4}
            />
          )
        })}

        {days.map((d, i) => {
          const cx = xCenter(i)
          return (
            <foreignObject
              key={`icon-${i}`}
              x={cx - 12}
              y={padT + chartH + 4}
              width={24}
              height={24}
            >
              <div className="flex items-center justify-center">
                <WeatherIcon code={d.weatherCode} size={20} />
              </div>
            </foreignObject>
          )
        })}

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
                d.isRace && "fill-primary font-medium"
              )}
              style={{ fontSize: "11px", letterSpacing: "0.2px" }}
            >
              {d.label}
            </text>
          )
        })}

        <g transform={`translate(${padL}, ${padT - 6})`}>
          <rect x={0} y={4} width={20} height={2} rx={1} fill="#f59e0b" />
          <text x={26} y={8} className="fill-muted-foreground" style={{ fontSize: "9px" }}>
            高
          </text>
        </g>
        <g transform={`translate(${padL + 40}, ${padT - 6})`}>
          <rect x={0} y={4} width={20} height={2} rx={1} fill="#94a3b8" />
          <text x={26} y={8} className="fill-muted-foreground" style={{ fontSize: "9px" }}>
            低
          </text>
        </g>
        <g transform={`translate(${padL + 80}, ${padT - 6})`}>
          <rect x={4} y={4} width={8} height={8} rx={2} fill="#60a5fa" opacity={0.5} />
          <text x={18} y={10} className="fill-muted-foreground" style={{ fontSize: "9px" }}>
            降水
          </text>
        </g>
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

function WeatherIcon({ code, size }: { code: number; size: number }) {
  const props = { size, strokeWidth: 1.5 }
  if (code === 0) return <Sun {...props} className="text-amber-500" />
  if (code <= 3) return <Cloud {...props} className="text-slate-400" />
  if (code <= 49) return <Cloud {...props} className="text-slate-500" />
  if (code <= 59) return <Droplets {...props} className="text-blue-400" />
  if (code <= 69) return <CloudRain {...props} className="text-blue-500" />
  if (code <= 79) return <CloudSnow {...props} className="text-cyan-400" />
  if (code <= 99) return <CloudLightning {...props} className="text-purple-500" />
  return <Cloud {...props} className="text-slate-400" />
}