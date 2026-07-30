"use client"

import { useState, useEffect, useMemo } from "react"
import { Cloud, CloudRain, CloudSnow, Sun, CloudSun, RefreshCw, Droplets } from "lucide-react"

interface WeatherStripProps {
  city: string
  country: string
  lat?: number
  lon?: number
  /** 所有赛段的 UTC 时间数组 */
  sessions: { utc: string; name: string }[]
}

interface HourlyWeather {
  date: string
  tempMax: number
  tempMin: number
  precipitationProbability: number
  weatherCode: number
}

/** 根据 weatherCode 选择图标 */
function getWeatherIcon(code: number) {
  if (code === 0) return <Sun className="size-3.5 text-amber-500" />
  if (code <= 3) return <CloudSun className="size-3.5 text-muted-foreground" />
  if (code >= 51 && code <= 57) return <Cloud className="size-3.5 text-muted-foreground" />
  if (code >= 61 && code <= 67) return <CloudRain className="size-3.5 text-blue-400" />
  if (code >= 71 && code <= 77) return <CloudSnow className="size-3.5 text-sky-300" />
  return <Cloud className="size-3.5 text-muted-foreground" />
}

export function WeatherStrip({ city, country, lat, lon, sessions }: WeatherStripProps) {
  const [loading, setLoading] = useState(true)
  const [daily, setDaily] = useState<HourlyWeather[]>([])

  useEffect(() => {
    let cancelled = false
    async function fetchWeather() {
      try {
        const params = new URLSearchParams({ city, country, date: sessions[0]?.utc ?? "" })
        if (lat !== undefined) params.set("lat", lat.toString())
        if (lon !== undefined) params.set("lon", lon.toString())
        const res = await fetch(`/api/weather?${params.toString()}`)
        if (res.ok) {
          const json = await res.json()
          if (!cancelled) {
            setDaily(json.daily || [])
          }
        }
      } catch {
        // 静默失败
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchWeather()
    return () => { cancelled = true }
  }, [city, country, lat, lon, sessions])

  // 按 session 日期匹配天气
  const sessionWeather = useMemo(() => {
    return sessions.map((s) => {
      const dateStr = new Date(s.utc).toISOString().slice(0, 10)
      const match = daily.find((d) => d.date === dateStr)
      return { session: s, weather: match }
    })
  }, [sessions, daily])

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <RefreshCw className="size-3 animate-spin" />
        天气加载中...
      </div>
    )
  }

  if (daily.length === 0) return null

  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-1">
      {sessionWeather.map(({ session, weather }, i) => {
        if (!weather) return (
          <div key={i} className="flex flex-col items-center gap-0.5 min-w-[48px]">
            <span className="text-[9px] text-muted-foreground truncate max-w-[48px]">
              {session.name.slice(0, 4)}
            </span>
            <Cloud className="size-3.5 text-muted-foreground/40" />
          </div>
        )
        return (
          <div key={i} className="flex flex-col items-center gap-0.5 min-w-[48px]" title={`${session.name}: ${Math.round(weather.tempMax)}° / ${weather.precipitationProbability}%降水`}>
            <span className="text-[9px] text-muted-foreground truncate max-w-[48px]">
              {session.name.slice(0, 4)}
            </span>
            {getWeatherIcon(weather.weatherCode)}
            <span className="text-[9px] font-medium text-amber-500">
              {Math.round(weather.tempMax)}°
            </span>
            {weather.precipitationProbability > 30 && (
              <span className="flex items-center text-[8px] text-blue-400">
                <Droplets className="size-2 mr-0.5" />
                {weather.precipitationProbability}%
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
