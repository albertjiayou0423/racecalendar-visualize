"use client"

import { useState, useEffect, useCallback } from "react"
import { Cloud, CloudRain, CloudSnow, Droplets, Sun, Thermometer, Wind, RefreshCw, Clock } from "lucide-react"
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="size-4 animate-spin" />
        加载天气...
      </div>
    )
  }

  if (error) {
    return null
  }

  if (daily.length === 0) {
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
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          {getWeatherIcon(raceHour?.weatherCode || 0)}
        </div>
        <div>
          <div className="flex items-center gap-1 text-sm font-medium">
            <span>{weatherInfo.icon}</span>
            <span>{weatherInfo.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {day.tempMin}° ~ {day.tempMax}°
          </div>
        </div>
      </div>

      <div className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
        {raceHour && (
          <>
            <div className="flex items-center gap-1">
              <Thermometer className="size-3" />
              <span>{raceHour.temperature}°C</span>
            </div>
            <div className="flex items-center gap-1">
              <Droplets className="size-3" />
              <span>{raceHour.precipitationProbability}%</span>
            </div>
            <div className="flex items-center gap-1">
              <Wind className="size-3" />
              <span>{raceHour.windSpeed} km/h</span>
            </div>
          </>
        )}
      </div>
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
  const relevantHours = hourly.filter((h) => {
    const hh = parseInt(h.time.split("T")[1]?.split(":")[0] || "0")
    return hh >= Math.max(0, startHour - 4) && hh <= Math.min(23, startHour + 4)
  })

  if (relevantHours.length === 0) return null

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="size-3" />
        <span>{startTime} 前后天气变化</span>
      </div>
      <div className="mt-2 flex gap-1">
        {relevantHours.map((h) => {
          const hh = parseInt(h.time.split("T")[1]?.split(":")[0] || "0")
          const isRaceTime = Math.abs(hh - startHour) <= 1
          const weatherInfo = getWeatherInfo(h.weatherCode)
          return (
            <div
              key={h.time}
              className={cn(
                "flex flex-col items-center rounded-md px-2 py-1.5 text-xs",
                isRaceTime && "bg-primary/10 ring-1 ring-primary/50",
              )}
            >
              <span className={cn(isRaceTime && "font-medium")}>{hh}:00</span>
              <span className="mt-1">{weatherInfo.icon}</span>
              <span className={cn("mt-0.5 tabular-nums", isRaceTime && "font-medium")}>
                {Math.round(h.temperature)}°
              </span>
              {h.precipitationProbability > 20 && (
                <span className="text-[10px] text-blue-500">{h.precipitationProbability}%</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
