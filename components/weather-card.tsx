"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Cloud, CloudRain, CloudSnow, Droplets, Sun, Thermometer, Wind, RefreshCw, Clock, AlertTriangle } from "lucide-react"
import type { HourlyForecast, DailyForecast } from "@/app/api/weather/route"
import { getWeatherInfo } from "@/app/api/weather/route"
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
  const [hourly, setHourly] = useState<HourlyForecast[]>([])
  const [daily, setDaily] = useState<DailyForecast[]>([])

  const fetchWeather = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        city: city,
        country: country,
        date: date,
      })
      if (lat !== undefined) params.set("lat", lat.toString())
      if (lon !== undefined) params.set("lon", lon.toString())
      const res = await fetch(`/api/weather?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setHourly(data.hourly || [])
        setDaily(data.daily || [])
      } else {
        const err = await res.json().catch(() => ({}))
        setError(err.error || "获取天气失败")
      }
    } catch (err) {
      setError("网络错误")
    } finally {
      setLoading(false)
    }
  }, [city, country, date, lat, lon])

  useEffect(() => {
    fetchWeather()
  }, [fetchWeather])

  const raceRainAlertInfo = useMemo(() => {
    if (hourly.length === 0) return { shouldAlert: false, maxProbability: 0 }

    const startHour = parseInt(startTime.split(":")[0]) || 14
    const raceHours = hourly.filter((h) => {
      const hh = parseInt(h.time.split("T")[1]?.split(":")[0] || "0")
      return hh >= startHour - 1 && hh <= startHour + 3
    })

    if (raceHours.length === 0) return { shouldAlert: false, maxProbability: 0 }

    const maxProbability = Math.max(...raceHours.map((h) => h.precipitationProbability))
    return {
      shouldAlert: maxProbability >= 50,
      maxProbability,
    }
  }, [hourly, startTime])

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <RefreshCw className="size-3.5 animate-spin text-muted-foreground/60" />
        <span>天气分析中...</span>
      </div>
    )
  }

  if (error || daily.length === 0) {
    return null
  }

  const day = daily[0]
  const startHour = parseInt(startTime.split(":")[0]) || 14
  const raceHour = hourly.find((h) => {
    const hh = parseInt(h.time.split("T")[1]?.split(":")[0] || "0")
    return Math.abs(hh - startHour) <= 2
  }) || hourly[startHour] || hourly[0]

  const weatherInfo = raceHour ? getWeatherInfo(raceHour.weatherCode) : getWeatherInfo(0)

  return (
    <div className="flex flex-col gap-2.5 w-full bg-secondary/15 rounded-xl p-3 border border-border/40">
      {/* 顶部简明快照：以单色线条风格与高度可视化为主，极大缩减文字文字 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card border border-border/50 text-sm text-foreground/80">
            {getWeatherIcon(raceHour?.weatherCode || 0)}
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <span>{weatherInfo.icon}</span>
              <span>{weatherInfo.label}</span>
              <span className="font-mono text-[11px] font-bold text-primary">{raceHour ? `${Math.round(raceHour.temperature)}°C` : ""}</span>
            </div>
            <div className="text-[9px] text-muted-foreground/80 font-mono mt-0.5">
              RANGE: {day.tempMin}° ~ {day.tempMax}°
            </div>
          </div>
        </div>

        {/* 简洁闪烁的警警示标 */}
        <div className="flex items-center gap-2 shrink-0">
          {raceRainAlertInfo.shouldAlert && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-500 animate-pulse">
              <AlertTriangle className="size-3 text-amber-500" />
              <span>WET ({raceRainAlertInfo.maxProbability}%)</span>
            </span>
          )}

          {raceHour && (
            <div className="flex items-center gap-2.5 text-[10px] font-semibold text-muted-foreground/80 font-mono">
              <div className="flex items-center gap-0.5">
                <Wind className="size-3 text-muted-foreground/60" />
                <span>{Math.round(raceHour.windSpeed)} km/h</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Droplets className="size-3 text-muted-foreground/60" />
                <span>{raceHour.humidity}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 整合并渲染基于 SVG 的精美折线图趋势 */}
      {hourly.length > 0 && (
        <div className="border-t border-border/40 pt-2">
          <WeatherTimeline hourly={hourly} startTime={startTime} />
        </div>
      )}
    </div>
  )
}

function getWeatherIcon(code: number) {
  if (code >= 51 && code <= 65) return <CloudRain className="size-4 text-blue-500" />
  if (code >= 71 && code <= 77) return <CloudSnow className="size-4 text-sky-400" />
  if (code >= 80 && code <= 86) return <CloudRain className="size-4 text-blue-500" />
  if (code >= 95 && code <= 99) return <CloudRain className="size-4 text-purple-500" />
  if (code === 0) return <Sun className="size-4 text-yellow-500" />
  if (code >= 45 && code <= 48) return <Cloud className="size-4 text-slate-500" />
  return <Cloud className="size-4 text-slate-400" />
}

interface WeatherTimelineProps {
  hourly: HourlyForecast[]
  startTime: string
}

export function WeatherTimeline({ hourly, startTime }: WeatherTimelineProps) {
  const startHour = parseInt(startTime.split(":")[0]) || 14

  // 筛选 race hour ± 4小时
  const relevantHours = useMemo(() => {
    return hourly.filter((h) => {
      const hh = parseInt(h.time.split("T")[1]?.split(":")[0] || "0")
      return hh >= Math.max(0, startHour - 4) && hh <= Math.min(23, startHour + 4)
    })
  }, [hourly, startHour])

  if (relevantHours.length === 0) return null

  // 1. 计算折线图 SVG 的点
  const chartHeight = 50
  const chartWidth = 320
  const paddingX = 15
  const paddingY = 8

  const temps = relevantHours.map((h) => h.temperature)
  const minTemp = Math.min(...temps)
  const maxTemp = Math.max(...temps)
  const tempRange = maxTemp - minTemp || 1

  const points = relevantHours.map((h, i) => {
    const x = paddingX + (i / (relevantHours.length - 1)) * (chartWidth - 2 * paddingX)
    const y = chartHeight - paddingY - ((h.temperature - minTemp) / tempRange) * (chartHeight - 2 * paddingY)
    return { x, y, temp: h.temperature, prob: h.precipitationProbability, code: h.weatherCode }
  })

  // 生成折线 PATH
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")

  // 生成降水概率面积图 PATH (位于底部)
  const areaPath = points.map((p, i) => {
    const py = chartHeight - paddingY - (p.prob / 100) * (chartHeight - 2 * paddingY) * 0.7 // 限高在 70% 避免遮盖
    return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${py.toFixed(1)}`
  }).concat([
    `L ${points[points.length - 1].x.toFixed(1)} ${(chartHeight - paddingY).toFixed(1)}`,
    `L ${points[0].x.toFixed(1)} ${(chartHeight - paddingY).toFixed(1)}`,
    "Z"
  ]).join(" ")

  return (
    <div className="space-y-2">
      {/* 极简单色标题 */}
      <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
        <Clock className="size-3" />
        <span>天气折线走势 ({startTime} 前后)</span>
      </div>

      {/* SVG 趋势折线图 */}
      <div className="relative w-full bg-card/25 rounded-lg border border-border/30 p-1">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible select-none" xmlns="http://www.w3.org/2000/svg">
          {/* 渐变遮罩定义 */}
          <defs>
            <linearGradient id="rainAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="tempLineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* 1. 降水概率阴影区 */}
          <path d={areaPath} fill="url(#rainAreaGrad)" stroke="none" />

          {/* 2. 温度面积渐变阴影 */}
          <path
            d={linePath + ` L ${points[points.length-1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`}
            fill="url(#tempLineGrad)"
            stroke="none"
          />

          {/* 3. 温度趋势主折线 (单色线条风格) */}
          <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

          {/* 4. 数据节点圆圈与文本数值 */}
          {points.map((p, idx) => {
            const isRaceTime = Math.abs((parseInt(relevantHours[idx].time.split("T")[1]?.split(":")[0]) || 0) - startHour) <= 1
            return (
              <g key={idx}>
                {/* 节点气温 */}
                <text
                  x={p.x}
                  y={p.y - 4}
                  textAnchor="middle"
                  className={cn("text-[7px] font-extrabold font-mono tabular-nums fill-muted-foreground", isRaceTime && "fill-primary text-[8px]")}
                >
                  {Math.round(p.temp)}°
                </text>

                {/* 节点触点 */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isRaceTime ? 3 : 2}
                  fill={isRaceTime ? "var(--primary)" : "var(--card)"}
                  stroke="var(--primary)"
                  strokeWidth="1.2"
                />
              </g>
            )
          })}
        </svg>

        {/* 5. 对应的时间轴与单色线条气象 Icon (少字多图) */}
        <div className="grid grid-cols-9 text-center mt-1 border-t border-border/20 pt-1.5">
          {relevantHours.map((h, i) => {
            const hh = parseInt(h.time.split("T")[1]?.split(":")[0] || "0")
            const isRaceTime = Math.abs(hh - startHour) <= 1
            const weatherInfo = getWeatherInfo(h.weatherCode)
            return (
              <div key={h.time} className="flex flex-col items-center">
                <span className={cn("text-[8px] font-bold text-muted-foreground/80 font-mono", isRaceTime && "text-primary font-black")}>
                  {hh}:00
                </span>
                <span className="text-[10px] my-0.5 select-none" title={weatherInfo.label}>
                  {weatherInfo.icon}
                </span>
                {h.precipitationProbability > 0 && (
                  <span className={cn("text-[7px] font-mono font-bold text-muted-foreground/50", h.precipitationProbability > 20 && "text-blue-500 font-extrabold")}>
                    {h.precipitationProbability}%
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
