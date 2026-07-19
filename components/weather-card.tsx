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

  // 计算赛事时段（赛前/赛时/赛后，即开始时间前后 3 小时内）的最大降水概率
  const raceRainAlertInfo = useMemo(() => {
    if (hourly.length === 0) return { shouldAlert: false, maxProbability: 0 }

    const startHour = parseInt(startTime.split(":")[0]) || 14
    const raceHours = hourly.filter((h) => {
      const hh = parseInt(h.time.split("T")[1]?.split(":")[0] || "0")
      // 比赛通常持续 2-3 小时，因此关注开赛前 1 小时至开赛后 3 小时之间的窗口
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
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCw className="size-3.5 animate-spin" />
        正在分析赛道天气...
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
    <div className="flex flex-col gap-3 w-full bg-secondary/15 rounded-xl p-3 border border-border/40">
      {/* 顶部天气快照 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-card border border-border/50 text-base shadow-sm">
            {getWeatherIcon(raceHour?.weatherCode || 0)}
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <span>{weatherInfo.icon}</span>
              <span>{weatherInfo.label}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-mono">{raceHour ? `${Math.round(raceHour.temperature)}°C` : ""}</span>
            </div>
            <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
              本周温差：{day.tempMin}° ~ {day.tempMax}°
            </div>
          </div>
        </div>

        {/* 右侧：特定天气特征与闪烁的雨战预警标志 */}
        <div className="flex items-center gap-2 shrink-0">
          {raceRainAlertInfo.shouldAlert && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/30 px-2 py-1 text-[10px] font-bold text-amber-500 animate-pulse shadow-sm">
              <AlertTriangle className="size-3 text-amber-500" />
              <span>雨战预警 ({raceRainAlertInfo.maxProbability}%)</span>
            </span>
          )}

          {raceHour && (
            <div className="hidden items-center gap-3 text-[10px] font-medium text-muted-foreground sm:flex">
              <div className="flex items-center gap-1">
                <Thermometer className="size-3 text-red-400" />
                <span>风速 {Math.round(raceHour.windSpeed)} km/h</span>
              </div>
              <div className="flex items-center gap-1">
                <Droplets className="size-3 text-blue-400" />
                <span>湿度 {raceHour.humidity}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 增加天气趋势图表与时段趋势 */}
      {hourly.length > 0 && (
        <div className="border-t border-border/40 pt-2.5">
          <WeatherTimeline hourly={hourly} startTime={startTime} />
        </div>
      )}
    </div>
  )
}

function getWeatherIcon(code: number) {
  if (code >= 51 && code <= 65) return <CloudRain className="size-5 text-blue-500" />
  if (code >= 71 && code <= 77) return <CloudSnow className="size-5 text-sky-400" />
  if (code >= 80 && code <= 86) return <CloudRain className="size-5 text-blue-500" />
  if (code >= 95 && code <= 99) return <CloudRain className="size-5 text-purple-500" />
  if (code === 0) return <Sun className="size-5 text-yellow-500" />
  if (code >= 45 && code <= 48) return <Cloud className="size-5 text-slate-500" />
  return <Cloud className="size-5 text-slate-400" />
}

interface WeatherTimelineProps {
  hourly: HourlyForecast[]
  startTime: string
}

export function WeatherTimeline({ hourly, startTime }: WeatherTimelineProps) {
  const startHour = parseInt(startTime.split(":")[0]) || 14
  // 获取比赛时段（ race hour 前 4 小时至后 4 小时之间）的精细小时气象
  const relevantHours = hourly.filter((h) => {
    const hh = parseInt(h.time.split("T")[1]?.split(":")[0] || "0")
    return hh >= Math.max(0, startHour - 4) && hh <= Math.min(23, startHour + 4)
  })

  if (relevantHours.length === 0) return null

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        <Clock className="size-3" />
        <span>开赛时段前后（{startTime}）天气变化及降水趋势</span>
      </div>

      {/* 趋势气象方块 */}
      <div className="grid grid-cols-9 gap-1 text-center">
        {relevantHours.map((h) => {
          const hh = parseInt(h.time.split("T")[1]?.split(":")[0] || "0")
          const isRaceTime = Math.abs(hh - startHour) <= 1
          const weatherInfo = getWeatherInfo(h.weatherCode)
          const isRaining = h.precipitationProbability > 20

          return (
            <div
              key={h.time}
              className={cn(
                "flex flex-col items-center rounded-lg p-1.5 transition-all",
                isRaceTime
                  ? "bg-primary/10 border border-primary/30 ring-1 ring-primary/5"
                  : "bg-card/40 border border-border/30"
              )}
            >
              <span className={cn("text-[9px] font-bold text-muted-foreground", isRaceTime && "text-primary")}>
                {hh}:00
              </span>
              <span className="my-1.5 text-xs select-none">{weatherInfo.icon}</span>
              <span className={cn("text-[10px] font-bold text-foreground font-mono tabular-nums", isRaceTime && "text-primary text-xs")}>
                {Math.round(h.temperature)}°
              </span>

              {/* 降水概率条形图 */}
              <div className="w-full mt-2 space-y-0.5">
                <div className="h-1 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", isRaining ? "bg-blue-500" : "bg-muted-foreground/30")}
                    style={{ width: `${h.precipitationProbability}%` }}
                  />
                </div>
                {h.precipitationProbability > 0 && (
                  <span className={cn("text-[8px] font-mono font-semibold text-muted-foreground/60 tabular-nums block", isRaining && "text-blue-500 font-bold")}>
                    {h.precipitationProbability}%
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
