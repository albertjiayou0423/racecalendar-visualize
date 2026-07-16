"use client"

import { useState, useEffect } from "react"
import { ChevronDown, Clock, MapPin, Radio, Trophy, TriangleAlert, ExternalLink, Activity, Info, X } from "lucide-react"
import { LiveTiming } from "./live-timing"
import { WeatherCard } from "./weather-card"
import { WikipediaImage } from "./wikipedia-image"
import type { RaceEvent, RaceSession } from "@/lib/types"
import {
  BEIJING_TZ,
  SERIES_META,
  countdown,
  firstSession,
  formatDate,
  formatDateTime,
  formatTime,
  isLive,
  mainSession,
  offsetLabel,
} from "@/lib/format"
import { countryCodeToFlag } from "@/lib/tz"
import { cn } from "@/lib/utils"

interface DayGroup {
  date: string
  sessions: RaceSession[]
}

function CountdownPill({ utc, now }: { utc: string; now: number }) {
  const c = countdown(utc, now)
  if (c.past) {
    return (
      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        已结束
      </span>
    )
  }
  const soon = c.days === 0
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
        soon ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
      )}
    >
      {c.days > 0 ? `${c.days}天 ` : ""}
      {c.hours}时 {c.minutes}分{c.days === 0 ? ` ${c.seconds}秒` : ""}后
    </span>
  )
}

function groupSessionsByDay(sessions: RaceSession[]): DayGroup[] {
  const groups: DayGroup[] = []
  let currentDate = ""
  let currentGroup: DayGroup | null = null

  for (const s of sessions) {
    const date = formatDate(s.utc, BEIJING_TZ)
    if (date !== currentDate) {
      if (currentGroup) groups.push(currentGroup)
      currentDate = date
      currentGroup = { date, sessions: [s] }
    } else if (currentGroup) {
      currentGroup.sessions.push(s)
    }
  }
  if (currentGroup) groups.push(currentGroup)
  return groups
}

export function EventCard({ event, now }: { event: RaceEvent; now: number }) {
  const [open, setOpen] = useState(false)
  const [openDays, setOpenDays] = useState<Set<string>>(new Set())
  const [showLiveTiming, setShowLiveTiming] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const meta = SERIES_META[event.series]
  const main = mainSession(event)
  const first = firstSession(event)
  const flag = countryCodeToFlag(event.countryCode)
  const localOffset = main ? offsetLabel(main.utc, event.tz) : ""
  const dayGroups = groupSessionsByDay(event.sessions)
  const hasTentative = event.tentative === true

  const isLiveNow = event.sessions.some((s) => {
    const start = new Date(s.utc).getTime()
    const end = start + 2 * 60 * 60 * 1000
    return now >= start && now <= end
  })

  const toggleDay = (date: string) => {
    setOpenDays((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  // ESC 关闭模态框
  useEffect(() => {
    if (!showDetail) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowDetail(false)
    }
    window.addEventListener("keydown", handler)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", handler)
      document.body.style.overflow = ""
    }
  }, [showDetail])

  return (
    <>
      <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-300 hover:border-muted-foreground/30 hover:shadow-md">
        {/* 顶部 LIVE 条 */}
        {isLiveNow && (
          <div className="flex items-center justify-center gap-2 bg-red-500 px-4 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            <span className="text-xs font-bold text-white">LIVE</span>
          </div>
        )}
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5">
          {/* 系列 + 轮次 */}
          <div className="flex items-center gap-3 sm:w-28 sm:shrink-0">
            <span
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-sm font-bold"
              style={{ backgroundColor: isLiveNow ? "#ef4444" : meta.color, color: isLiveNow ? "#fff" : meta.textColor }}
            >
              {isLiveNow ? "LIVE" : meta.label}
            </span>
            <span className="text-xs text-muted-foreground">第 {event.round} 站</span>
          </div>

          {/* 名称与地点 */}
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-2 text-balance text-base font-semibold leading-tight">
              {flag ? <span aria-hidden>{flag}</span> : null}
              <span className="truncate">{event.name}</span>
              {isLiveNow && (
                <span className="flex items-center gap-1 shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-500">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                  </span>
                  LIVE
                </span>
              )}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                {event.circuit} · {event.locality}，{event.country}
              </span>
            </p>
            {/* F1 赛道平面图 */}
            {event.series === "F1" && event.circuitImageUrl && (
              <div className="mt-2">
                <img
                  src={event.circuitImageUrl}
                  alt={`${event.circuit} 赛道平面图`}
                  className="h-auto w-full max-h-[180px] rounded-lg object-contain"
                  loading="lazy"
                />
              </div>
            )}
          </div>

          {/* 开赛时间 + 倒计时 */}
          <div className="flex items-center justify-between gap-3 sm:w-56 sm:shrink-0 sm:flex-col sm:items-end">
            {first ? (
              <div className="text-right">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" aria-hidden />
                  <span>开赛 · 北京时间</span>
                </div>
                <div className="font-mono text-sm font-semibold tabular-nums">
                  {formatDateTime(first.utc, BEIJING_TZ)}
                </div>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">赛程待定</span>
            )}
            {first ? <CountdownPill utc={first.utc} now={now} /> : null}
          </div>
        </div>

        {/* 转播条 + 展开按钮 */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-secondary/30 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2 text-xs">
            {event.broadcaster ? (
              <>
                <Radio className="size-3.5 shrink-0 text-primary" aria-hidden />
                <span className="font-medium">{event.broadcaster.name}</span>
                {event.broadcaster.note ? (
                  <span className="truncate text-muted-foreground">{event.broadcaster.note}</span>
                ) : null}
              </>
            ) : (
              <span className="text-muted-foreground">转播信息待确认</span>
            )}
            {event.series === "WRC" && (
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", hasTentative ? "bg-muted text-muted-foreground" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400")}>
                {hasTentative ? "估计" : "官方"}
              </span>
            )}
            {event.url ? (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="size-3" aria-hidden />
                官网
              </a>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setShowDetail(true)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              赛事详情
              <Info className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-expanded={open}
            >
              {open ? "收起" : "详细时间"}
              <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
            </button>
          </div>
        </div>

        {/* 详细场次时间表 */}
        {open ? (
          <div className="border-t border-border">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>场次</span>
              <span className="text-right">当地时间 · {localOffset}</span>
              <span className="text-right">北京时间 · UTC+8</span>
            </div>
            <div className="border-t border-border/60">
              {dayGroups.map((group) => {
                const isDayOpen = openDays.has(group.date)
                return (
                  <div key={group.date}>
                    <button
                      type="button"
                      onClick={() => toggleDay(group.date)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <span>{group.date}</span>
                      <span className="flex items-center gap-1 text-xs">
                        {group.sessions.length} 个场次
                        <ChevronDown className={cn("size-3 transition-transform", isDayOpen && "rotate-180")} aria-hidden />
                      </span>
                    </button>
                    {isDayOpen ? (
                      <ul>
                        {group.sessions.map((s, i) => (
                          <li
                            key={`${s.name}-${i}`}
                            className={cn(
                              "grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-t border-border/40 px-4 py-2 text-sm",
                              s.isMain && "bg-primary/10",
                            )}
                          >
                            <span className="flex items-center gap-1.5">
                              {s.isMain ? <Trophy className="size-3.5 text-primary" aria-hidden /> : null}
                              <span className={cn(s.isMain && "font-semibold")}>{s.name}</span>
                              {s.tentative ? (
                                <TriangleAlert className="size-3 text-muted-foreground" aria-label="时间待确认" />
                              ) : null}
                            </span>
                            <span className="text-right font-mono tabular-nums">
                              {s.tentative ? "约 " : ""}
                              {formatTime(s.utc, event.tz)}
                            </span>
                            <span className="text-right font-mono font-medium tabular-nums text-foreground">
                              {s.tentative ? "约 " : ""}
                              {formatTime(s.utc, BEIJING_TZ)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                )
              })}
            </div>
            <p className="px-4 py-2 text-[11px] text-muted-foreground">
              首个场次：{first ? formatDateTime(first.utc, BEIJING_TZ) : "—"}（北京时间）
              <span className="ml-2">·</span>
              {event.series === "WRC" ? (
                hasTentative ? (
                  <span className="ml-2">赛段时间为估计值，以官方 itinerary 为准</span>
                ) : (
                  <span className="ml-2 text-emerald-600 dark:text-emerald-400">时间来源：WRC 官方 itinerary</span>
                )
              ) : event.series === "F1" ? (
                <span className="ml-2 text-emerald-600 dark:text-emerald-400">时间来源：F1 官方公开数据</span>
              ) : event.series === "FE" ? (
                <span className="ml-2 text-emerald-600 dark:text-emerald-400">时间来源：Formula E 官方 API</span>
              ) : null}
            </p>

            {/* 天气预报 */}
            {main && (
              <div className="border-t border-border/50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">当地天气预报</span>
                  <WeatherCard
                    city={event.locality}
                    country={event.country}
                    date={new Date(main.utc).toISOString().split("T")[0]}
                    startTime={formatTime(main.utc, event.tz)}
                    lat={event.lat}
                    lon={event.lon}
                  />
                </div>
              </div>
            )}

            {/* Live Timing - 只在 session 进行中显示 */}
            {isLiveNow && (
              <div className="border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowLiveTiming((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                    <Activity className="size-4 text-primary" />
                    <span>Live Timing</span>
                    <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
                      LIVE
                    </span>
                  </div>
                  <ChevronDown className={cn("size-4 transition-transform", showLiveTiming && "rotate-180")} />
                </button>
                <LiveTiming
                  series={event.series}
                  eventName={event.name}
                  isExpanded={showLiveTiming}
                />
              </div>
            )}
          </div>
        ) : null}
      </article>

      {/* 赛事详情模态框 */}
      {showDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowDetail(false)}
        >
          {/* 遮罩 */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />

          {/* 模态框内容 */}
          <div
            className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
                  style={{ backgroundColor: meta.color, color: meta.textColor }}
                >
                  {meta.label}
                </span>
                <div>
                  <h3 className="text-sm font-semibold leading-tight">{event.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {event.circuit} · {event.locality}，{event.country}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDetail(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="关闭"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 内容区 */}
            <div className="space-y-4 p-5">
              {/* 赛道图片 - F1 直接嵌入显示 */}
              {event.circuitImageUrl ? (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">赛道平面图</h4>
                  <img
                    src={event.circuitImageUrl}
                    alt={`${event.circuit} 赛道平面图`}
                    className="h-auto w-full max-h-[240px] rounded-lg object-contain"
                    loading="lazy"
                  />
                </div>
              ) : (event.circuitWikipediaUrl || event.wikipediaUrl) ? (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">赛道图片</h4>
                  <WikipediaImage url={event.circuitWikipediaUrl || event.wikipediaUrl} />
                </div>
              ) : null}

              {/* 天气预报 */}
              {main && (
                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-semibold">当地天气预报</h4>
                    <span className="text-[10px] text-muted-foreground">{new Date(main.utc).toISOString().split("T")[0]}</span>
                  </div>
                  <WeatherCard
                    city={event.locality}
                    country={event.country}
                    date={new Date(main.utc).toISOString().split("T")[0]}
                    startTime={formatTime(main.utc, event.tz)}
                    lat={event.lat}
                    lon={event.lon}
                  />
                </div>
              )}

              {/* 赛道信息 */}
              {event.circuitInfo && (
                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                  <h4 className="mb-3 text-sm font-semibold">赛道信息</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-secondary/50 px-3 py-2">
                      <div className="text-[10px] text-muted-foreground">赛道长度</div>
                      <div className="mt-0.5 text-sm font-medium">{event.circuitInfo.length}</div>
                    </div>
                    <div className="rounded-lg bg-secondary/50 px-3 py-2">
                      <div className="text-[10px] text-muted-foreground">比赛圈数</div>
                      <div className="mt-0.5 text-sm font-medium">{event.circuitInfo.laps} 圈</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 去年冠军 */}
              {event.lastYearWinner && (
                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                  <h4 className="mb-2 text-sm font-semibold">2025 冠军</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">车手</span>
                    <span className="text-sm font-medium">{event.lastYearWinner.driver}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">车队</span>
                    <span className="text-sm font-medium">{event.lastYearWinner.constructor}</span>
                  </div>
                </div>
              )}

              {/* 去年最快圈速 */}
              {event.lastYearFastestLap && (
                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                  <h4 className="mb-2 text-sm font-semibold">2025 最快圈速</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">车手</span>
                    <span className="text-sm font-medium">{event.lastYearFastestLap.driver}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">圈速</span>
                    <span className="text-sm font-medium font-mono">{event.lastYearFastestLap.time}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">圈数</span>
                    <span className="text-sm font-medium">第 {event.lastYearFastestLap.lap} 圈</span>
                  </div>
                </div>
              )}

              {/* 更多信息（WRC） */}
              {event.extraInfo && event.extraInfo.length > 0 && (
                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                  <h4 className="mb-3 text-sm font-semibold">更多信息</h4>
                  <div className="grid gap-2">
                    {event.extraInfo.map((info, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                        <span className="text-muted-foreground">{info.label}</span>
                        <span className="font-medium">{info.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 赛事链接 */}
              <div className="flex flex-wrap gap-2 pt-1">
                {event.circuitWikipediaUrl && (
                  <a
                    href={event.circuitWikipediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-2 text-sm text-primary shadow-sm transition-all duration-200 hover:bg-secondary/80 hover:shadow-md hover:-translate-y-0.5"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    赛道 Wiki
                  </a>
                )}
                {event.wikipediaUrl && event.wikipediaUrl !== event.circuitWikipediaUrl && (
                  <a
                    href={event.wikipediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-2 text-sm text-primary shadow-sm transition-all duration-200 hover:bg-secondary/80 hover:shadow-md hover:-translate-y-0.5"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    赛事 Wiki
                  </a>
                )}
                {event.url && (
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-2 text-sm text-primary shadow-sm transition-all duration-200 hover:bg-secondary/80 hover:shadow-md hover:-translate-y-0.5"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    官方网站
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
