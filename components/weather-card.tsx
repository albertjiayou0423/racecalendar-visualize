"use client"

import { useState, useEffect, useCallback } from "react"
import { Cloud, CloudRain, CloudSnow, Droplets, Sun, Thermometer, Wind, RefreshCw, CloudLightning, Snowflake, AlertTriangle } from "lucide-react"
import type { HourlyForecast, WeatherAlert } from "@/app/api/weather/route"
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
  const [alerts, setAlerts] = useState<WeatherAlert[]>([])

  const fetchWeather = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ city, country, date })
      if (lat !== undefined) params.set("lat", lat.toString())
      if (lon !== undefined) params.set("lon", lon.toString())
      const res = await fetch(`/api/weather?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setHourly(data.hourly || [])
        setAlerts(data.alerts || [])
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

  if (loading) {
    return <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><RefreshCw className="size-3 animate-spin" />天气</div>
  }

  if (error || hourly.length === 0) return null

  // 取比赛当天的天气
  const startHour = parseInt(startTime.split(":")[0]) || 14
  const raceHour = hourly.find((h) => {
    const hh = parseInt(h.time.split("T")[1]?.split(":")[0] || "0")
    return Math.abs(hh - startHour) <= 2
  }) || hourly[Math.min(startHour, hourly.length - 1)]

  const weatherInfo = raceHour ? getWeatherInfo(raceHour.weatherCode) : getWeatherInfo(0)

  // 取一周天气数据（每天取中午12点）
  const weekData: { day: string; temp: number; rain: number; code: number }[] = []
  const seenDays = new Set<string>()
  for (const h of hourly) {
    const d = new Date(h.time)
    const dayKey = d.toISOString().slice(0, 10)
    if (seenDays.has(dayKey)) continue
    seenDays.add(dayKey)
    const hour = d.getHours()
    // 取最接近12点的数据
    const dayHours = hourly.filter(x => x.time.startsWith(dayKey))
    const midDay = dayHours.find(x => Math.abs(parseInt(x.time.split("T")[1]?.split(":")[0] || "0") - 12) <= 3) || dayHours[0]
    if (midDay) {
      weekData.push({
        day: ["日", "一", "二", "三", "四", "五", "六"][d.getDay()],
        temp: midDay.temperature,
        rain: midDay.precipitationProbability,
        code: midDay.weatherCode,
      })
    }
  }

  const maxTemp = Math.max(...weekData.map(d => d.temp))
  const minTemp = Math.min(...weekData.map(d => d.temp))
  const tempRange = Math.max(maxTemp - minTemp, 1)

  return (
    <div className="space-y-2">
      {/* 当前天气摘要 */}
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 shrink-0">
          {getWeatherIcon(raceHour?.weatherCode || 0)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm">
            <span>{weatherInfo.icon}</span>
            <span className="font-medium truncate">{raceHour?.temperature}°C</span>
            <span className="text-muted-foreground text-xs">{raceHour?.precipitationProbability}%雨</span>
          </div>
        </div>
      </div>

      {/* 一周气温折线图 */}
      {weekData.length > 1 && (
        <div className="flex items-end gap-1 h-12 px-1">
          {weekData.slice(0, 7).map((d, i) => {
            const heightPercent = ((d.temp - minTemp) / tempRange) * 100
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="relative w-full flex justify-center" style={{ height: "28px" }}>
                  <div
                    className="w-1 rounded-full bg-gradient-to-t from-blue-500 to-orange-400"
                    style={{ height: `${Math.max(heightPercent, 20)}%`, minHeight: "4px" }}
                    title={`${d.temp}°C`}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground">{d.day}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* 预警条 */}
      {alerts.length > 0 && (
        <div className="space-y-1">
          {alerts.slice(0, 2).map((alert, idx) => (
            <div
              key={idx}
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1 text-[10px]",
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

function getWeatherIcon(code: number) {
  if (code === 0) return <Sun className="size-3.5 text-amber-500" />
  if (code <= 3) return <Cloud className="size-3.5 text-gray-400" />
  if (code <= 49) return <Cloud className="size-3.5 text-gray-500" />
  if (code <= 59) return <Droplets className="size-3.5 text-blue-400" />
  if (code <= 69) return <CloudRain className="size-3.5 text-blue-500" />
  if (code <= 79) return <CloudSnow className="size-3.5 text-cyan-400" />
  if (code <= 99) return <CloudLightning className="size-3.5 text-purple-500" />
  return <Cloud className="size-3.5 text-gray-400" />
}