"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Activity, Clock, ExternalLink, Flag, Pause, RefreshCw, Shield, Timer, TrendingUp, AlertTriangle } from "lucide-react"
import type { LiveTimingData, LiveTimingDriver } from "@/lib/live-timing"
import { cn } from "@/lib/utils"

interface LiveTimingProps {
  series: "F1" | "FE" | "WRC"
  eventName: string
  isExpanded: boolean
}

const SERIES_LINKS: Record<string, string> = {
  F1: "https://www.formula1.com/en/latest/article/live-timing",
  FE: "https://fiaformulae.com/en/race-centre",
  WRC: "https://www.wrc.com/en/wrc-plus/live-timing/",
}

export function LiveTiming({ series, eventName, isExpanded }: LiveTimingProps) {
  const [data, setData] = useState<LiveTimingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<number>(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchData = useCallback(async () => {
    if (!isExpanded) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/live-timing?series=${series}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
        setLastRefresh(Date.now())
      } else {
        const err = await res.json().catch(() => ({}))
        setError(err.error || "获取数据失败")
      }
    } catch (err) {
      setError("网络错误")
    } finally {
      setLoading(false)
    }
  }, [series, isExpanded])

  // 首次加载 + 轮询
  useEffect(() => {
    if (isExpanded) {
      fetchData()
      intervalRef.current = setInterval(fetchData, 10000) // 每10秒刷新
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isExpanded, fetchData])

  if (!isExpanded) return null

  const officialLink = SERIES_LINKS[series]

  // 如果正在加载且没有数据，显示加载状态
  if (loading && !data) {
    return (
      <div className="border-t border-border bg-card px-4 py-6">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="size-4 animate-spin" />
          正在加载 Live Timing...
        </div>
      </div>
    )
  }

  // 如果有错误且没有数据
  if (error && !data) {
    return (
      <div className="border-t border-border bg-card px-4 py-6">
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle className="size-5 text-amber-500" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <a
            href={officialLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ExternalLink className="size-4" />
            前往官方 Live Timing
          </a>
        </div>
      </div>
    )
  }

  // 如果没有数据（WRC/FE 默认返回空数据）
  if (!data || (data.drivers.length === 0 && series !== "F1")) {
    return (
      <div className="border-t border-border bg-card px-4 py-6">
        <div className="flex flex-col items-center gap-3">
          <Activity className="size-5 text-primary" />
          <p className="text-sm font-medium">{eventName} Live Timing</p>
          <p className="text-xs text-muted-foreground">
            {series === "WRC" ? "WRC 实时计时数据" : "Formula E 实时计时数据"}
          </p>
          <a
            href={officialLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ExternalLink className="size-4" />
            前往官方 Live Timing
          </a>
        </div>
      </div>
    )
  }

  const isLive = data.status === "live"

  return (
    <div className="border-t border-border bg-card">
      {/* 头部信息 */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
          ) : (
            <Flag className="size-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold">
            {isLive ? "LIVE" : data.status === "finished" ? "已结束" : data.sessionName}
          </span>
          {data.currentLap && data.totalLaps ? (
            <span className="text-xs text-muted-foreground">
              第 {data.currentLap}/{data.totalLaps} 圈
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {data.safetyCar && (
            <span className="flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-500">
              <Shield className="size-3" />
              安全车
            </span>
          )}
          {data.virtualSafetyCar && (
            <span className="flex items-center gap-1 rounded bg-yellow-500/15 px-2 py-0.5 text-[10px] font-medium text-yellow-500">
              <Pause className="size-3" />
              VSC
            </span>
          )}
          {data.redFlag && (
            <span className="flex items-center gap-1 rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-500">
              <AlertTriangle className="size-3" />
              红旗
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            刷新
          </button>
        </div>
      </div>

      {/* 天气信息 */}
      {(data.trackTemp || data.airTemp || data.weather) && (
        <div className="flex items-center gap-4 border-b border-border/50 px-4 py-2 text-xs text-muted-foreground">
          {data.trackTemp ? (
            <span className="flex items-center gap-1">
              <TrendingUp className="size-3" />
              赛道 {data.trackTemp}°C
            </span>
          ) : null}
          {data.airTemp ? (
            <span className="flex items-center gap-1">
              <Timer className="size-3" />
              空气 {data.airTemp}°C
            </span>
          ) : null}
          {data.weather ? <span>{data.weather}</span> : null}
          {lastRefresh > 0 && (
            <span className="ml-auto flex items-center gap-1">
              <Clock className="size-3" />
              更新于 {Math.floor((Date.now() - lastRefresh) / 1000)}秒前
            </span>
          )}
        </div>
      )}

      {/* 车手排名表格 */}
      {data.drivers.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 text-left">位置</th>
                <th className="px-4 py-2 text-left">车手</th>
                <th className="px-4 py-2 text-left">车队</th>
                <th className="px-4 py-2 text-right">差距</th>
                <th className="px-4 py-2 text-right">区间</th>
                <th className="px-4 py-2 text-right">上一圈</th>
                <th className="px-4 py-2 text-right">最快圈</th>
                <th className="px-4 py-2 text-right">圈数</th>
                <th className="px-4 py-2 text-right">进站</th>
              </tr>
            </thead>
            <tbody>
              {data.drivers.map((driver, index) => (
                <DriverRow key={driver.driverNumber} driver={driver} index={index} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          暂无车手数据
        </div>
      )}

      {/* 底部官方链接 */}
      <div className="border-t border-border/50 px-4 py-2">
        <a
          href={officialLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="size-3" />
          查看官方 Live Timing 获取完整数据
        </a>
      </div>
    </div>
  )
}

function DriverRow({ driver, index }: { driver: LiveTimingDriver; index: number }) {
  return (
    <tr
      className={cn(
        "border-b border-border/30 transition-colors hover:bg-secondary/50",
        index === 0 && "bg-primary/5",
        driver.retired && "opacity-50",
      )}
    >
      <td className="px-4 py-2">
        <span
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold",
            index === 0 && "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
            index === 1 && "bg-slate-400/20 text-slate-600 dark:text-slate-400",
            index === 2 && "bg-amber-700/20 text-amber-700 dark:text-amber-500",
            index > 2 && "text-muted-foreground",
          )}
        >
          {driver.position}
        </span>
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          {driver.teamColor && (
            <span
              className="inline-block h-3 w-1 rounded-full"
              style={{ backgroundColor: driver.teamColor }}
            />
          )}
          <div>
            <div className="font-medium">{driver.driverName}</div>
            <div className="text-[10px] text-muted-foreground">{driver.driverCode}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-2 text-muted-foreground">{driver.team}</td>
      <td className="px-4 py-2 text-right font-mono tabular-nums">{driver.gap}</td>
      <td className="px-4 py-2 text-right font-mono tabular-nums text-muted-foreground">{driver.interval}</td>
      <td className="px-4 py-2 text-right font-mono tabular-nums">{driver.lastLap}</td>
      <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
        {driver.bestLap}
      </td>
      <td className="px-4 py-2 text-right font-mono tabular-nums">{driver.laps}</td>
      <td className="px-4 py-2 text-right">{driver.pitStops}</td>
    </tr>
  )
}
