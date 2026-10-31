"use client"

import { MotionLoader } from "@/components/interface-motion"

import { useState, useEffect, useMemo } from "react"
import { Cloud, CloudRain, CloudSnow, Sun, CloudSun, RefreshCw, Droplets } from "lucide-react"
import { sessionWeatherDate } from "@/lib/weather-date"

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
  const [weatherStatus, setWeatherStatus] = useState<"unavailable" | "error" | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  // SessionTimeline updates its countdown every second and constructs a fresh
  // sessions array on each render. Keep request and display dependencies tied
  // to the actual values so those countdown updates do not refetch weather.
  const sessionsKey = JSON.stringify(sessions.map(({ utc, name }) => [utc, name]))
  const weatherSessions = useMemo(
    () => JSON.parse(sessionsKey) as { utc: string; name: string }[],
    [sessionsKey]
  )
  const firstSessionUtc = weatherSessions.find(({ utc }) => sessionWeatherDate(utc))?.utc ?? ""

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    async function fetchWeather() {
      if (!firstSessionUtc) {
        setDaily([])
        setWeatherStatus(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setDaily([])
      setWeatherStatus(null)
      try {
        const params = new URLSearchParams({ city, country, date: firstSessionUtc })
        if (lat !== undefined) params.set("lat", lat.toString())
        if (lon !== undefined) params.set("lon", lon.toString())
        const res = await fetch(`/api/weather?${params.toString()}`, { signal: controller.signal })
        const json = await res.json()
        if (cancelled) return

        if (!res.ok || !Array.isArray(json?.daily) || json.daily.length === 0) {
          setWeatherStatus(res.status === 400 || res.status === 404 || res.ok ? "unavailable" : "error")
          return
        }

        setDaily(json.daily)
      } catch {
        if (!cancelled) setWeatherStatus("error")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchWeather()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [city, country, lat, lon, firstSessionUtc, retryCount])

  // 按 session 日期匹配天气
  const sessionWeather = useMemo(() => {
    return weatherSessions.map((s) => {
      const dateStr = sessionWeatherDate(s.utc)
      const match = dateStr ? daily.find((d) => d.date === dateStr) : undefined
      return { session: s, weather: match }
    })
  }, [weatherSessions, daily])

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <MotionLoader kind="weather" size={12} />
        天气加载中...
      </div>
    )
  }

  if (weatherStatus) {
    return (
      <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
        <span>
          {weatherStatus === "unavailable"
            ? "该赛事日期或赛道位置暂无可用天气预报。"
            : "天气服务暂时不可用。"}
        </span>
        <button
          type="button"
          onClick={() => setRetryCount((count) => count + 1)}
          className="inline-flex min-h-7 items-center gap-1 rounded-md px-1.5 text-primary transition-colors hover:bg-secondary"
        >
          <RefreshCw className="size-3" />
          重试
        </button>
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
