"use client"

import { useState, useMemo, useEffect } from "react"
import { Search, MapPin, Calendar, TrendingUp, Hash, Clock, ArrowLeft } from "lucide-react"
import Link from "@/components/edition-link"
import { buildCircuitDatabase, type CircuitDetail } from "@/lib/circuits"
import type { ScheduleResponse, Series } from "@/lib/types"
import { cn } from "@/lib/utils"

const TYPE_LABELS: Record<CircuitDetail["type"], string> = {
  street: "街道赛道",
  permanent: "永久赛道",
  hybrid: "混合赛道",
  rally: "拉力赛段",
  unknown: "赛事地点",
}

const TYPE_COLORS: Record<CircuitDetail["type"], string> = {
  street: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  permanent: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  hybrid: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  rally: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  unknown: "bg-secondary text-muted-foreground",
}

const SERIES_LABELS: Record<Series, string> = { F1: "F1", WRC: "WRC", FE: "FE" }

function DifficultyDots({ level }: { level?: 1 | 2 | 3 | 4 | 5 }) {
  if (!level) return <span className="text-xs text-muted-foreground">暂无可靠数据</span>
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            i <= level ? "bg-red-500" : "bg-muted"
          )}
        />
      ))}
    </div>
  )
}

export default function CircuitsPage() {
  const [events, setEvents] = useState<ScheduleResponse["events"]>([])
  const [scheduleLoaded, setScheduleLoaded] = useState(false)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<CircuitDetail["type"] | "all">("all")
  const [seriesFilter, setSeriesFilter] = useState<Series | "all">("all")

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/schedule", { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("赛历暂不可用")
        return await response.json() as ScheduleResponse
      })
      .then(schedule => setEvents(schedule.events ?? []))
      .catch(error => { if (!controller.signal.aborted) console.warn("赛道目录未能同步赛历", error) })
      .finally(() => { if (!controller.signal.aborted) setScheduleLoaded(true) })
    return () => controller.abort()
  }, [])

  const circuits = useMemo(() => buildCircuitDatabase(events), [events])

  const filtered = useMemo(() => {
    return circuits.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false
      if (seriesFilter !== "all" && !c.series?.includes(seriesFilter)) return false
      if (!search) return true
      const s = search.toLowerCase()
      return (
        c.name.toLowerCase().includes(s) ||
        c.nameEn.toLowerCase().includes(s) ||
        c.city.toLowerCase().includes(s) ||
        c.country.toLowerCase().includes(s)
      )
    })
  }, [search, typeFilter, seriesFilter, circuits])

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-6">
      <header className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          返回
        </Link>
        <h1 className="text-xl font-bold">赛道数据库</h1>
        <span className="text-xs text-muted-foreground">· {filtered.length} 个地点{scheduleLoaded ? "" : " · 正在同步赛历"}</span>
      </header>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索赛道名称、城市、国家..."
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div data-guide="circuit-filters" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTypeFilter("all")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              typeFilter === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            全部
          </button>
          {(Object.keys(TYPE_LABELS) as CircuitDetail["type"][]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                typeFilter === type
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="按赛事系列筛选">
          {(["all", "F1", "WRC", "FE"] as const).map(series => <button key={series} type="button" onClick={() => setSeriesFilter(series)} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", seriesFilter === series ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}>{series === "all" ? "全部赛事" : SERIES_LABELS[series]}</button>)}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            <Search className="size-8 text-muted-foreground/50" />
            未找到匹配的赛道
          </div>
        ) : (
          filtered.map((c) => (
            <article
              key={c.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-muted-foreground/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">{c.name}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.nameEn}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded px-2 py-0.5 text-[10px] font-medium",
                    TYPE_COLORS[c.type]
                  )}
                >
                  {TYPE_LABELS[c.type]}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3" />
                {c.city}，{c.country}
              </div>
              {typeof c.lat === "number" && typeof c.lon === "number" ? <a className="mt-1 inline-block text-xs text-primary hover:underline" href={`https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lon}#map=11/${c.lat}/${c.lon}`} target="_blank" rel="noopener noreferrer">查看赛事地点地图 →</a> : null}

              <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                {c.description || "赛道介绍暂缺。"}
              </p>

              {c.series?.length ? <div className="mt-2 flex flex-wrap gap-1.5">{c.series.map(series => <span key={series} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{SERIES_LABELS[series]}</span>)}{c.seasons?.length ? <span className="px-1 py-0.5 text-[10px] text-muted-foreground">赛历覆盖 {c.seasons[0]}{c.seasons.length > 1 ? `–${c.seasons[c.seasons.length - 1]}` : ""}</span> : null}</div> : null}

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <div className="rounded-lg bg-secondary/40 px-2 py-1.5">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Hash className="size-2.5" />
                    长度
                  </div>
                  <div className="mt-0.5 text-sm font-medium tabular-nums">
                    {c.length ? `${c.type === "rally" ? c.length.toFixed(0) : c.length.toFixed(3)} km` : "暂无数据"}
                  </div>
                </div>
                <div className="rounded-lg bg-secondary/40 px-2 py-1.5">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <TrendingUp className="size-2.5" />
                    弯道
                  </div>
                  <div className="mt-0.5 text-sm font-medium tabular-nums">
                    {c.turns ? `${c.turns} 个` : "暂无数据"}
                  </div>
                </div>
                <div className="rounded-lg bg-secondary/40 px-2 py-1.5">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Calendar className="size-2.5" />
                    首次
                  </div>
                  <div className="mt-0.5 text-sm font-medium tabular-nums">
                    {c.firstUsed ?? "暂无数据"}
                  </div>
                </div>
                <div className="rounded-lg bg-secondary/40 px-2 py-1.5">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Calendar className="size-2.5" />
                    圈数 / 天数
                  </div>
                  <div className="mt-0.5 text-sm font-medium tabular-nums">{c.laps ?? "暂无数据"}</div>
                </div>
                <div className="rounded-lg bg-secondary/40 px-2 py-1.5">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    难度
                  </div>
                  <div className="mt-1.5">
                    <DifficultyDots level={c.difficulty} />
                  </div>
                </div>
              </div>

              {c.lapRecord && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-1.5 text-xs">
                  <Clock className="size-3 text-primary" />
                  <span className="text-muted-foreground">单圈纪录</span>
                  <span className="font-mono font-medium">{c.lapRecord.time}</span>
                  <span className="text-muted-foreground">·</span>
                  <span>{c.lapRecord.driver} ({c.lapRecord.year})</span>
                </div>
              )}

              {c.wikipediaUrl && (
                <a
                  href={c.wikipediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-primary hover:underline"
                >
                  查看 Wikipedia →
                </a>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  )
}
