"use client"

import { MotionLoader, MotionInput } from "@/components/interface-motion"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { SeriesRelay, RaceFarewell } from "./ritual-motion"
import { usePlayground } from "./playground-context"
import { UsageGuideButton } from "@/components/usage-guide"
import { EditionEntry } from "@/app/new/components/edition-entry"
import { CalendarDays, Clock, Flag, LayoutGrid, List, Search, TriangleAlert, Sparkles, Trophy, Inbox, WifiOff, Filter, Building2, Globe, CalendarRange, CalendarClock, Code, Hash, ImageIcon, ArrowUp, Activity } from "lucide-react"
import type { RaceEvent, ScheduleResponse, Series } from "@/lib/types"
import { mergeScheduleWithClientCache, parseClientScheduleCache, scheduleFromClientCache } from "@/lib/client-schedule-cache"
import {
    BEIJING_TZ,
    SERIES_META,
    formatDateTime,
    formatTime,
    isPast,
    mainSession,
  } from "@/lib/format"
import { EventCard } from "@/components/event-card"
import { FeedbackButton } from "@/components/feedback-button"
import { LastRaceResults } from "@/components/last-race-results"
import { NextRacePreview } from "@/components/next-race-preview"
import { CountdownAutoEntry } from "@/components/countdown-auto-entry"
import { MonthView } from "@/components/month-view"
import { WeekView } from "@/components/week-view"
import { WeekendView } from "@/components/weekend-view"
import { NotificationManager } from "@/components/notification-manager"
import { OpenStatusBadge } from "@/components/openstatus-badge"
import { cn } from "@/lib/utils"
import { useAppPreferences, updateAppPreferences, type HomeClockMode } from "@/lib/app-preferences"
import Link from "next/link"

const CACHE_KEY = "schedule-cache-v2"
const LEGACY_CACHE_KEY = "schedule-cache"
const CLIENT_FAILURE_REPORT_KEY = "schedule-load-failure-report-v1"
const EVENT_NAME_TRANSLATION_CACHE_KEY = "event-name-translations-v1"

function reportScheduleLoadFailure() {
  try {
    const lastReport = Number(sessionStorage.getItem(CLIENT_FAILURE_REPORT_KEY) ?? 0)
    if (Date.now() - lastReport < 10 * 60 * 1000) return
    sessionStorage.setItem(CLIENT_FAILURE_REPORT_KEY, String(Date.now()))
    void fetch("/api/client-health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "schedule-load-failed" }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Storage may be disabled; reporting is best effort and must not affect the schedule UI.
  }
}

function readScheduleCache() {
  try {
    const current = parseClientScheduleCache(localStorage.getItem(CACHE_KEY))
    if (current) return current
    const legacy = parseClientScheduleCache(localStorage.getItem(LEGACY_CACHE_KEY))
    if (legacy) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(legacy))
        localStorage.removeItem(LEGACY_CACHE_KEY)
      } catch { /* Keep using the legacy cache if storage is read-only. */ }
    }
    return legacy
  } catch {
    return null
  }
}

const fetcher = async (url: string): Promise<ScheduleResponse> => {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as ScheduleResponse
    if (!Array.isArray(data?.events) || !Array.isArray(data?.sources) || typeof data?.fetchedAt !== "string") {
      throw new Error("Invalid schedule response")
    }
    const { response, cache } = mergeScheduleWithClientCache(data, readScheduleCache())
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
      localStorage.removeItem(LEGACY_CACHE_KEY)
    } catch {
      // localStorage 不可用时忽略
    }
    return response
  } catch (err) {
    // 网络请求失败，尝试从缓存读取
    try {
      const cache = readScheduleCache()
      if (cache) {
        const data = scheduleFromClientCache(cache, true)
        // 标记为离线模式
        return data
      }
    } catch {
      // 缓存读取失败
    }
    reportScheduleLoadFailure()
    throw err
  }
}

type SeriesFilter = "ALL" | Series
type TimeFilter = "upcoming" | "all" | "past"
type SeasonFilter = "current-next" | "all" | number
type ViewMode = "list" | "week" | "month" | "weekend"
type CircuitTypeFilter = "all" | "street" | "permanent" | "hybrid" | "rally"
type RegionFilter = "all" | "europe" | "asia" | "americas" | "middle-east" | "africa" | "oceania"

const SERIES_TABS: { key: SeriesFilter; label: string }[] = [
  { key: "ALL", label: "全部" },
  { key: "F1", label: "F1" },
  { key: "WRC", label: "WRC" },
  { key: "FE", label: "FE" },
]

const TIME_TABS: { key: TimeFilter; label: string }[] = [
  { key: "upcoming", label: "即将开始" },
  { key: "all", label: "全部" },
  { key: "past", label: "已结束" },
]

function getEventYear(event: RaceEvent): number | null {
  const idYear = event.id.match(/(?:f1|wrc)-(20\d{2})-/)?.[1]
  if (idYear) return Number(idYear)
  const firstSession = event.sessions[0]
  if (!firstSession || !Number.isFinite(Date.parse(firstSession.utc))) return null
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: BEIJING_TZ, year: "numeric" }).format(new Date(firstSession.utc)))
}

/** 每秒刷新的当前时间戳（标签页隐藏时暂停以降低后台 CPU） */
function useNow(serverTime: number) {
  const [now, setNow] = useState<number>(serverTime)
  useEffect(() => {
    setNow(Date.now())
    let id: ReturnType<typeof setInterval> | null = setInterval(() => setNow(Date.now()), 1000)
    const start = () => {
      if (id) return
      setNow(Date.now())
      id = setInterval(() => setNow(Date.now()), 1000)
    }
    const stop = () => {
      if (id) {
        clearInterval(id)
        id = null
      }
    }
    const onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])
  return now
}

function BeijingClock({ now }: { now: number }) {
  const { preferences, hydrated } = useAppPreferences()
  const mode: HomeClockMode = preferences.homeClockMode
  const userTimeZone = hydrated ? Intl.DateTimeFormat().resolvedOptions().timeZone || BEIJING_TZ : BEIJING_TZ
  const timeZone = mode === "utc" ? "UTC" : userTimeZone
  const label = !hydrated ? "北京时间" : mode === "utc" ? "UTC 世界标准时间 · UTC+00:00" : "用户当地时间"
  const toggleClock = () => updateAppPreferences({ homeClockMode: mode === "utc" ? "user" : "utc" })
  const iso = new Date(now).toISOString()
  return (
    <button
      type="button"
      onClick={toggleClock}
      aria-label={`当前显示${label}，点击切换到${mode === "utc" ? "用户当地时间" : "UTC 时间"}`}
      title={`点击切换到${mode === "utc" ? "用户当地时间" : "UTC 时间"}`}
      className="flex w-full max-w-[15.75rem] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/50"
    >
      <Clock className="size-4 text-primary" aria-hidden />
      <div key={mode} className="clock-flip min-w-0 leading-tight">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-mono text-sm font-semibold tabular-nums">{formatDateTime(iso, timeZone)}{mode === "utc" ? " UTC" : ""}</div>
      </div>
    </button>
  )
}

export function ScheduleView({ serverTime = 0 }: { serverTime?: number }) {
  const playground = usePlayground()
  const { preferences } = useAppPreferences()
  const liveNow = useNow(serverTime)
  const now = playground?.now ?? liveNow
  const [cachedSchedule, setCachedSchedule] = useState<ScheduleResponse | undefined>()
  useEffect(() => {
    if (playground) return
    try {
      const cache = readScheduleCache()
      if (cache) setCachedSchedule(scheduleFromClientCache(cache))
    } catch { /* Invalid or unavailable browser cache. */ }
  }, [playground])
  const request = useSWR(playground ? null : "/api/schedule", fetcher, {
    revalidateOnFocus: false,
    fallbackData: cachedSchedule,
  })
  const data = playground ? ["error", "loading"].includes(playground.scenario) ? undefined : playground.data : request.data
  const error = playground ? playground.scenario === "error" : request.error
  const requestLoading = playground ? playground.scenario === "loading" : request.isLoading
  const isLoading = requestLoading && !data
  const [eventNameTranslations, setEventNameTranslations] = useState<Record<string, string>>({})
  const requestedTranslations = useRef(new Set<string>())
  useEffect(() => {
    if (!data || playground) return
    let cached: Record<string, string> = {}
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(EVENT_NAME_TRANSLATION_CACHE_KEY) ?? "{}")
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) cached = parsed as Record<string, string>
    } catch { /* Ignore invalid or unavailable local cache. */ }
    if (Object.keys(cached).length) setEventNameTranslations(previous => {
      const hasNewValue = Object.entries(cached).some(([name, value]) => previous[name] !== value)
      return hasNewValue ? { ...cached, ...previous } : previous
    })

    const known = new Set([...Object.keys(cached), ...Object.keys(eventNameTranslations)])
    const names = [...new Set(data.events.map(event => event.name.trim()))]
      .filter(name => name && !/\p{Script=Han}/u.test(name) && !known.has(name) && !requestedTranslations.current.has(name))
    if (!names.length) return
    names.forEach(name => requestedTranslations.current.add(name))

    void (async () => {
      for (let start = 0; start < names.length; start += 25) {
        const batch = names.slice(start, start + 25)
        try {
          const response = await fetch("/api/event-name-translations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ names: batch }),
          })
          if (!response.ok) break
          const result = await response.json() as { translations?: Record<string, string> }
          const valid = Object.fromEntries(Object.entries(result.translations ?? {}).filter(([source, translated]) =>
            batch.includes(source) && typeof translated === "string" && /\p{Script=Han}/u.test(translated),
          ))
          if (!Object.keys(valid).length) continue
          setEventNameTranslations(previous => {
            const next = { ...previous, ...valid }
            try {
              const stored = JSON.parse(localStorage.getItem(EVENT_NAME_TRANSLATION_CACHE_KEY) ?? "{}") as Record<string, string>
              localStorage.setItem(EVENT_NAME_TRANSLATION_CACHE_KEY, JSON.stringify({ ...stored, ...valid }))
            } catch { /* Keep translated names usable for this page if storage is unavailable. */ }
            return next
          })
        } catch {
          // Keep provider names visible if the free translation service is unavailable or out of quota.
          break
        }
      }
    })()
  }, [data, eventNameTranslations, playground])
  const [series, setSeries] = useState<SeriesFilter>("ALL")
  const [time, setTime] = useState<TimeFilter>("upcoming")
  const [season, setSeason] = useState<SeasonFilter>("current-next")
  const [view, setView] = useState<ViewMode>("list")
  const [search, setSearch] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [circuitType, setCircuitType] = useState<CircuitTypeFilter>("all")
  const [region, setRegion] = useState<RegionFilter>("all")
  const [filterStuck, setFilterStuck] = useState(false)
  useEffect(() => {
    const prepare = () => setView("list")
    window.addEventListener("racecalendar:guide-card", prepare)
    return () => window.removeEventListener("racecalendar:guide-card", prepare)
  }, [])
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setView(preferences.defaultHomeView)
  }, [preferences.defaultHomeView])

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    if (!isMobile) {
      setFilterStuck(false)
      return
    }

    let ticking = false
    const thresholdUp = 80
    const thresholdDown = 180

    const updateFilter = () => {
      const currentY = window.scrollY
      setFilterStuck((prev) => {
        if (prev) {
          return currentY > thresholdUp
        } else {
          return currentY > thresholdDown
        }
      })
      ticking = false
    }

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateFilter)
        ticking = true
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [isMobile])

  // 回到顶部按钮：滚动超过 1 屏显示
  const [showBackToTop, setShowBackToTop] = useState(false)
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > window.innerHeight)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // 全局键盘快捷键：/ 聚焦搜索 · j/k 列表焦点 · 1–4 切换视图
  useEffect(() => {
    const moveListFocus = (dir: 1 | -1) => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-event-card]"))
      if (cards.length === 0) return
      const current = document.activeElement as HTMLElement | null
      const currentIdx = cards.findIndex((c) => c === current || c.contains(current))
      const nextIdx = currentIdx < 0 ? 0 : Math.max(0, Math.min(cards.length - 1, currentIdx + dir))
      const target = cards[nextIdx]
      target?.focus()
      target?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
    const handleKeydown = (e: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return
      const target = e.target as HTMLElement
      const tag = target?.tagName
      const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable
      if (inField) return
      if (e.key === "/") {
        e.preventDefault()
        const input = document.getElementById("search-input") as HTMLInputElement | null
        input?.focus()
        input?.select()
      } else if (e.key === "j") {
        e.preventDefault()
        moveListFocus(1)
      } else if (e.key === "k") {
        e.preventDefault()
        moveListFocus(-1)
      } else if (e.key === "1") {
        e.preventDefault()
        setView("list")
      } else if (e.key === "2") {
        e.preventDefault()
        setView("week")
      } else if (e.key === "3") {
        e.preventDefault()
        setView("month")
      } else if (e.key === "4") {
        e.preventDefault()
        setView("weekend")
      }
    }
    window.addEventListener("keydown", handleKeydown)
    return () => window.removeEventListener("keydown", handleKeydown)
  }, [])

  const rawEvents = data?.events ?? []
  const allEvents = useMemo(() => rawEvents.map(event => {
    const translated = eventNameTranslations[event.name]
    return translated && translated !== event.name
      ? { ...event, originalName: event.name, name: translated }
      : event
  }), [rawEvents, eventNameTranslations])
  const isOffline = data ? ("offline" in data && (data as { offline?: boolean }).offline) : false
  const currentYear = Number(new Intl.DateTimeFormat("en-US", { timeZone: BEIJING_TZ, year: "numeric" }).format(new Date(now)))
  const yearCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const event of allEvents.filter((item) => series === "ALL" || item.series === series)) {
      const year = getEventYear(event)
      if (year !== null) counts.set(year, (counts.get(year) ?? 0) + 1)
    }
    return counts
  }, [allEvents, series])

  const filtered = useMemo(() => {
    let list = allEvents.filter((e) => (series === "ALL" ? true : e.series === series))
    if (season === "current-next") {
      list = list.filter((event) => {
        const year = getEventYear(event)
        return year === currentYear || year === currentYear + 1
      })
    } else if (typeof season === "number") {
      list = list.filter((event) => getEventYear(event) === season)
    }
    if (search) {
      const query = search.toLowerCase()
      list = list.filter((e) =>
        e.name.toLowerCase().includes(query) ||
        e.originalName?.toLowerCase().includes(query) ||
        e.country.toLowerCase().includes(query) ||
        e.locality.toLowerCase().includes(query) ||
        e.circuit.toLowerCase().includes(query)
      )
    }
    if (circuitType !== "all") {
      list = list.filter((e) => e.circuitType === circuitType)
    }
    if (region !== "all") {
      list = list.filter((e) => e.region === region)
    }
    if (view === "list") {
      if (time === "upcoming") list = list.filter((e) => !isPast(e, now))
      else if (time === "past") list = list.filter((e) => isPast(e, now))
    }
    return [...list].sort((a, b) => {
      const am = mainSession(a)?.utc ?? ""
      const bm = mainSession(b)?.utc ?? ""
      return am.localeCompare(bm)
    })
  }, [allEvents, series, time, view, now, search, circuitType, region, season, currentYear])

  const nextUp = useMemo(() => {
    const upcoming = allEvents
      .filter((e) => (series === "ALL" ? true : e.series === series))
      .filter((e) => !isPast(e, now))
      .sort((a, b) => (mainSession(a)?.utc ?? "").localeCompare(mainSession(b)?.utc ?? ""))
    return upcoming[0]
  }, [allEvents, series, now])

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:py-10">
      {!playground && !isLoading && !error && <CountdownAutoEntry events={allEvents} now={now} />}
      {/* 页头 */}
      <header className="flex flex-col gap-4">
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[minmax(0,1fr)_15.75rem]">
          <div className="min-w-0">
            <h1 className="text-pretty text-2xl font-bold tracking-tight sm:text-3xl">赛道时刻</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              WRC · F1 · Formula E 未来赛程 — 当地时间与北京时间双时区，含中国大陆直播提示
            </p>
          </div>
          <div className="justify-self-end sm:w-full">
            <BeijingClock now={now} />
          </div>
        </div>
        <OpenStatusBadge />
        {isOffline ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
            <WifiOff className="size-4" aria-hidden />
            <span className="font-medium">离线模式</span>
            <span className="text-muted-foreground">· 显示上次缓存的数据，部分信息可能已过期</span>
          </div>
        ) : null}
      </header>

      {/* 筛选 */}
      <div
        data-filter-bar
        className={cn(
          "sticky top-0 z-10 -mx-4 px-4 py-3 flex flex-col gap-3 bg-background/80 backdrop-blur-md border-b border-border/50 transition-all",
          filterStuck && isMobile && "py-2 gap-1"
        )}
      >
        {/* 搜索框 - 移动端吸顶时隐藏 */}
        <div className={cn("relative transition-all", filterStuck && isMobile && "hidden")}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <MotionInput
            noResults={!!data && !filtered.length}
            id="search-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索赛事名称、国家、城市..."
            aria-label="搜索赛事"
            className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        {/* 赛事系列 - 始终显示，吸顶时只保留这一行 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="赛事系列">
            {SERIES_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={series === t.key}
                onClick={() => setSeries(t.key)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  series === t.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {/* 视图切换 + 通知 - 移动端吸顶时隐藏 */}
          <div className={cn("flex items-center gap-2", filterStuck && isMobile && "hidden")}>
            <div data-guide="views" className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setView("list")}
                aria-label="列表视图"
                aria-pressed={view === "list"}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors",
                  view === "list"
                    ? "rounded-[4.3px] bg-secondary text-secondary-foreground"
                    : "rounded text-muted-foreground hover:text-foreground",
                )}
              >
                <List className="size-3.5" />
                列表
              </button>
              <button
                type="button"
                onClick={() => setView("week")}
                aria-label="周视图"
                aria-pressed={view === "week"}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors",
                  view === "week"
                    ? "rounded-[4.3px] bg-secondary text-secondary-foreground"
                    : "rounded text-muted-foreground hover:text-foreground",
                )}
              >
                <CalendarRange className="size-3.5" />
                周
              </button>
              <button
                type="button"
                onClick={() => setView("month")}
                aria-label="月视图"
                aria-pressed={view === "month"}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors",
                  view === "month"
                    ? "rounded-[4.3px] bg-secondary text-secondary-foreground"
                    : "rounded text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutGrid className="size-3.5" />
                月历
              </button>
              <button
                type="button"
                onClick={() => setView("weekend")}
                aria-label="比赛周末视图"
                aria-pressed={view === "weekend"}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors",
                  view === "weekend"
                    ? "rounded-[4.3px] bg-secondary text-secondary-foreground"
                    : "rounded text-muted-foreground hover:text-foreground",
                )}
              >
                <CalendarClock className="size-3.5" />
                周末
              </button>
            </div>
            {data && !playground ? <NotificationManager events={allEvents} /> : null}
          </div>
        </div>
        {/* 移动端吸顶时保留时间范围，其他筛选仍可回到顶部访问 */}
        <div className={cn("flex flex-col gap-2 transition-all")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {view === "list" ? (
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="时间范围">
                {TIME_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={time === t.key}
                    onClick={() => setTime(t.key)}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                      time === t.key
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className={cn("flex flex-wrap items-center gap-1", filterStuck && isMobile && "hidden")} role="tablist" aria-label="赛季范围">
              {([
                { key: "current-next" as const, label: "今明两年" },
                { key: currentYear, label: `${currentYear} 年 · ${yearCounts.get(currentYear) ?? 0}` },
                { key: currentYear + 1, label: `${currentYear + 1} 年 · ${yearCounts.get(currentYear + 1) ?? 0}` },
                { key: "all" as const, label: "全部年份" },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={season === tab.key}
                  onClick={() => setSeason(tab.key)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    season === tab.key
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          {season === "current-next" && (yearCounts.get(currentYear + 1) ?? 0) === 0 ? (
            <p className={cn("text-xs text-muted-foreground", filterStuck && isMobile && "hidden")}>
              当前数据快照还未收录 {currentYear + 1} 年赛事。
            </p>
          ) : null}

          {/* 高级筛选 */}
          <div className={cn("flex flex-wrap items-center gap-2", filterStuck && isMobile && "hidden")}>
            <button
              type="button"
              data-guide="advanced-filters" onClick={() => setShowAdvancedFilters((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                showAdvancedFilters || circuitType !== "all" || region !== "all"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Filter className="size-3.5" />
              高级筛选
              {(circuitType !== "all" || region !== "all") ? (
                <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                  {[circuitType !== "all" ? 1 : 0, region !== "all" ? 1 : 0].reduce((a, b) => a + b, 0)}
                </span>
              ) : null}
            </button>
            {showAdvancedFilters ? (
              <>
                <div className="flex items-center gap-1.5">
                  <Building2 className="size-3 text-muted-foreground" />
                  <select
                    value={circuitType}
                    onChange={(e) => setCircuitType(e.target.value as CircuitTypeFilter)}
                    className="rounded-md border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary"
                  >
                    <option value="all">全部赛道</option>
                    <option value="street">街道赛道</option>
                    <option value="permanent">专用赛道</option>
                    <option value="hybrid">混合赛道</option>
                    <option value="rally">拉力赛</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <Globe className="size-3 text-muted-foreground" />
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value as RegionFilter)}
                    className="rounded-md border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary"
                  >
                    <option value="all">全部地区</option>
                    <option value="europe">欧洲</option>
                    <option value="asia">亚洲</option>
                    <option value="americas">美洲</option>
                    <option value="middle-east">中东</option>
                    <option value="africa">非洲</option>
                    <option value="oceania">大洋洲</option>
                  </select>
                </div>
                {circuitType !== "all" || region !== "all" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCircuitType("all")
                      setRegion("all")
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    清除筛选
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <SeriesRelay series={series} />
      {/* 加载 / 错误 */}
      {isLoading ? (
        <div role="status" aria-label="赛程加载中" aria-busy="true" className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MotionLoader kind="schedule" size={16} />
            <span>正在加载赛程…</span>
          </div>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-4 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <div className="h-6 w-20 animate-pulse rounded bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-muted/70" />
                </div>
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              </div>
              <div className="mt-3 flex gap-2">
                <div className="h-6 w-20 animate-pulse rounded bg-muted/50" />
                <div className="h-6 w-16 animate-pulse rounded bg-muted/50" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {error ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 py-10 text-sm text-foreground">
          <TriangleAlert className="size-5 text-destructive" aria-hidden />
          数据加载失败，请稍后重试。
        </div>
      ) : null}

      {/* 上一站回顾 + 下一站预览（上下排列） */}
      {!isLoading && !error && view === "list" && nextUp && time !== "past" && series === "F1" ? (
        <div className="flex flex-col gap-4">
          {!playground && <LastRaceResults />}
          <NextRacePreview event={nextUp} now={now} />
        </div>
      ) : null}

      {/* 下一场高亮 */}
      {!isLoading && !error && view === "list" && nextUp && time !== "past" && series !== "F1" ? (
        <NextRacePreview event={nextUp} now={now} />
      ) : null}

      <div className="transition-all duration-300 ease-out animate-fade-in">
        {/* 周视图 */}
        {!isLoading && !error && view === "week" ? (
          <WeekView events={filtered} now={now} />
        ) : null}

        {/* 月视图 */}
        {!isLoading && !error && view === "month" ? (
          <MonthView events={filtered} now={now} />
        ) : null}

        {/* 比赛周末：按赛事聚合该站跨日场次 */}
        {!isLoading && !error && view === "weekend" ? (
          <WeekendView events={filtered} now={now} />
        ) : null}

        {/* 列表 */}
        {!isLoading && !error && view === "list" ? (
          <section className="flex flex-col gap-3" aria-label="赛程列表">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden />
            共 {filtered.length} 场赛事
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-4 py-10 text-center">
              <Inbox className="size-10 text-muted-foreground/50" />
              <div>
                <p className="font-medium text-foreground">未找到匹配的赛事</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search
                    ? `没有找到包含「${search}」的赛事`
                    : typeof season === "number" && (yearCounts.get(season) ?? 0) === 0
                      ? `当前数据中没有 ${season} 年的赛事；数据源更新后会自动显示。`
                      : "当前筛选条件下暂无赛事"}
                </p>
              </div>
              {search ? (
                <button
                  onClick={() => setSearch("")}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                  清除搜索
                </button>
              ) : null}
            </div>
          ) : (
            filtered.map((e, index) => {
              const year = getEventYear(e)
              const previousYear = index > 0 ? getEventYear(filtered[index - 1]) : null
              const yearBoundary = season === "current-next" && year === currentYear + 1 && previousYear === currentYear
              return (
                <Fragment key={e.id}>
                  {yearBoundary ? (
                    <div role="separator" aria-label={`${currentYear + 1} 年赛事`} className="my-3 flex items-center gap-3 px-1">
                      <span className="h-0.5 flex-1 rounded-full bg-muted-foreground/40" />
                      <span className="text-xs font-semibold text-muted-foreground">{currentYear + 1} 年</span>
                      <span className="h-0.5 flex-1 rounded-full bg-muted-foreground/40" />
                    </div>
                  ) : null}
                  <EventCard event={e} now={now} />
                </Fragment>
              )
            })
          )}
        </section>
      ) : null}
      </div>

      <div className="flex justify-center">
        <FeedbackButton />
      </div>

      {data && !isLoading && filtered.length > 0 && <RaceFarewell />}

      <div className="flex flex-wrap justify-start gap-2">
        <Link prefetch={!playground}
          href="/standings"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <Trophy className="size-3.5" />
          积分榜
        </Link>
        <Link prefetch={!playground}
          href="/results"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <Flag className="size-3.5" />
          历史赛果
        </Link>
        <Link prefetch={!playground}
          href="/wallpaper"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <ImageIcon className="size-3.5" />
          壁纸生成
        </Link>
        <Link prefetch={!playground}
          href="/circuits"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <Hash className="size-3.5" />
          赛道数据库
        </Link>
        <Link prefetch={!playground}
          href="/status"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <Activity className="size-3.5" />
          服务状态
        </Link>
        <Link prefetch={!playground}
            href="/about"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <Sparkles className="size-3.5" />
            v2.3.4 · 比赛周末视图
          </Link>
          {!playground && <UsageGuideButton />}
          {!playground && <EditionEntry />}
        <Link prefetch={!playground}
          href="/developer"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <Code className="size-3.5" />
          开发者信息
        </Link>
      </div>

      <footer className="border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
        <p>
          时间说明：F1 与 Formula E 场次时间来自官方公开接口并换算为北京时间（UTC+8）；WRC
          为官方公布赛历，各赛段具体发车时间以官方 itinerary 为准（标有
          <TriangleAlert className="mx-0.5 inline size-3" aria-hidden />
          的为估计时间）。转播信息仅供参考，请以对应平台节目单为准。
        </p>
      </footer>

      {/* 回到顶部 */}
      {showBackToTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-4 right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-lg transition-all hover:bg-secondary hover:border-muted-foreground/40"
          aria-label="回到顶部"
        >
          <ArrowUp className="size-4" />
        </button>
      ) : null}
    </div>
  )
}
