"use client"

import { useState } from "react"
import { ChevronDown, Clock, MapPin, Radio, Trophy, TriangleAlert, ExternalLink, Activity, Info, X, CalendarDays, ExternalLink as LinkIcon } from "lucide-react"
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
  mainSession,
  offsetLabel,
  isUpcoming,
  isOngoing,
  isPast,
} from "@/lib/format"
import { countryCodeToFlag } from "@/lib/tz"
import { cn } from "@/lib/utils"

interface DayGroup {
  date: string
  sessions: RaceSession[]
}

function CountdownPill({ event, now }: { event: RaceEvent; now: number }) {
  if (isPast(event, now)) {
    return (
      <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground uppercase">
        已结束
      </span>
    )
  }

  if (isOngoing(event, now)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-450 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        LIVE
      </span>
    )
  }

  const first = firstSession(event)
  if (!first) return null

  const c = countdown(first.utc, now)
  const soon = c.days === 0
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[10px] font-bold tabular-nums uppercase",
        soon ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
      )}
    >
      {c.days > 0 ? `${c.days}D ` : ""}
      {c.hours}H {c.minutes}M{c.days === 0 ? ` ${c.seconds}S` : ""}
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
  const [isDetailOpen, setIsDetailOpen] = useState(false) // 替代 3D 翻转为 Modal 弹窗
  const meta = SERIES_META[event.series]
  const main = mainSession(event)
  const first = firstSession(event)
  const flag = countryCodeToFlag(event.countryCode)
  const localOffset = main ? offsetLabel(main.utc, event.tz) : ""
  const dayGroups = groupSessionsByDay(event.sessions)
  const hasTentative = event.tentative === true
  const isEventPast = isPast(event, now)

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

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-300 hover:border-muted-foreground/30 hover:shadow-md">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5">
        {/* 系列 + 轮次 */}
        <div className="flex items-center gap-3 sm:w-28 sm:shrink-0">
          <span
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-sm font-bold shadow-sm"
            style={{ backgroundColor: meta.color, color: meta.textColor }}
          >
            {meta.label}
          </span>
          <span className="text-xs text-muted-foreground font-mono">ROUND {event.round}</span>
        </div>

        {/* 名称与地点 */}
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-balance text-base font-semibold leading-tight">
            {flag ? <span aria-hidden>{flag}</span> : null}
            <span className="truncate">{event.name}</span>
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <MapPin className="size-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
            <span className="truncate">
              {event.circuit} · {event.locality}，{event.country}
            </span>
          </p>
        </div>

        {/* 开赛时间 + 倒计时 */}
        <div className="flex items-center justify-between gap-3 sm:w-56 sm:shrink-0 sm:flex-col sm:items-end">
          {first ? (
            <div className="text-right">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-wider justify-end">
                <Clock className="size-3" aria-hidden />
                <span>START · BJ</span>
              </div>
              <div className="font-mono text-sm font-bold tabular-nums text-foreground mt-0.5">
                {formatDateTime(first.utc, BEIJING_TZ)}
              </div>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider font-mono">TBD</span>
          )}
          {first ? <CountdownPill event={event} now={now} /> : null}
        </div>
      </div>

      {/* 转播条 + 展开按钮 */}
      <div className="flex items-center justify-between gap-3 border-t border-border bg-secondary/30 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-muted-foreground">
          {event.broadcaster ? (
            <>
              <Radio className="size-3.5 shrink-0 text-primary" aria-hidden />
              <span className="font-bold text-foreground">{event.broadcaster.name}</span>
              {event.broadcaster.note ? (
                <span className="truncate text-muted-foreground/80 font-normal">({event.broadcaster.note})</span>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground/75 font-mono uppercase">TBD BROADCAST</span>
          )}

          {/* 优化：已结束的赛事不显示估计/警告标签，自动展示为清洁结果 */}
          {event.series === "WRC" && !isEventPast && (
            <span className={cn("rounded px-1.5 py-0.2 text-[9px] font-black uppercase font-mono tracking-wider", hasTentative ? "bg-muted text-muted-foreground/70" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400")}>
              {hasTentative ? "EST" : "OFFICIAL"}
            </span>
          )}
          {event.url ? (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline font-bold uppercase font-mono text-[10px]"
            >
              <ExternalLink className="size-3" aria-hidden />
              WEB
            </a>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsDetailOpen(true)}
            className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold text-muted-foreground transition-all hover:bg-secondary hover:text-foreground border border-border/40"
          >
            详情
            <Info className="size-3.5 text-muted-foreground" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-muted-foreground transition-all hover:bg-secondary hover:text-foreground border border-border/40"
            aria-expanded={open}
          >
            {open ? "收起" : "时间"}
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        </div>
      </div>

      {/* 详细场次时间表 */}
      {open ? (
        <div className="border-t border-border">
          {/* 只在时间详情展开页直接嵌入显示 F1 赛道图片 */}
          {event.series === "F1" && event.circuitWikipediaUrl && (
            <div className="px-4 py-3 border-b border-border/40 bg-secondary/10">
              <WikipediaImage url={event.circuitWikipediaUrl} />
            </div>
          )}

          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-4 py-2 text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80 font-mono">
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
                    <span className="font-semibold text-xs text-foreground/80">{group.date}</span>
                    <span className="flex items-center gap-1 text-xs font-mono text-[10px] font-bold text-muted-foreground">
                      {group.sessions.length} SES
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
                          <span className="flex items-center gap-1.5 text-xs">
                            {s.isMain ? <Trophy className="size-3.5 text-primary" aria-hidden /> : null}
                            <span className={cn(s.isMain && "font-bold text-foreground")}>{s.name}</span>
                            {/* 优化：已结束的赛事不显示任何警告三角形/估计标识 */}
                            {s.tentative && !isEventPast && (
                              <TriangleAlert className="size-3 text-muted-foreground" aria-label="时间待确认" />
                            )}
                          </span>
                          <span className="text-right font-mono text-xs tabular-nums text-muted-foreground/90">
                            {s.tentative && !isEventPast ? "约 " : ""}
                            {formatTime(s.utc, event.tz)}
                          </span>
                          <span className="text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                            {s.tentative && !isEventPast ? "约 " : ""}
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
          <p className="px-4 py-2 text-[10px] text-muted-foreground/60 border-t border-border/30 font-mono">
            FIRST: {first ? formatDateTime(first.utc, BEIJING_TZ) : "—"} (BJ)
            <span className="ml-2">·</span>
            {event.series === "WRC" ? (
              hasTentative && !isEventPast ? (
                <span className="ml-2">赛段为估计时间，以官方 Itinerary 为准</span>
              ) : (
                <span className="ml-2 text-emerald-600 dark:text-emerald-400">时间来源：WRC 官方 Itinerary</span>
              )
            ) : event.series === "F1" ? (
              <span className="ml-2 text-emerald-600 dark:text-emerald-400">时间来源：F1 官方数据</span>
            ) : event.series === "FE" ? (
              <span className="ml-2 text-emerald-600 dark:text-emerald-400">时间来源：Formula E 官方 API</span>
            ) : null}
          </p>

          {/* 天气预报 */}
          {main && (
            <div className="border-t border-border/50 px-4 py-3">
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

      {/* 赛事详情 Modal 弹窗：取代原本的卡片翻转，更流畅，保持设计语言 */}
      {isDetailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div
            className="bg-card border border-border/80 w-full max-w-lg rounded-2xl p-5 shadow-2xl relative flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-xs font-bold font-mono shadow-sm"
                  style={{ backgroundColor: meta.color, color: meta.textColor }}
                >
                  {meta.label}
                </span>
                <span className="text-sm font-bold text-foreground">{event.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">R{event.round}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
                aria-label="关闭"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 弹窗内容 (可滚动) */}
            <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
              {/* 赛道图片 */}
              {(event.circuitWikipediaUrl || event.wikipediaUrl) && (
                <div className="rounded-xl border border-border bg-secondary/10 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-foreground font-mono uppercase tracking-wider">TRACK SCHEMATIC</h4>
                    <span className="text-[9px] text-muted-foreground font-mono">WIKIPEDIA</span>
                  </div>
                  <WikipediaImage url={event.circuitWikipediaUrl || event.wikipediaUrl} />
                </div>
              )}

              {/* 当地天气预报（优化去除“当地天气预报”文字，直接展示极简折线图气象） */}
              {main && (
                <div className="rounded-xl border border-border bg-secondary/10 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-foreground font-mono uppercase tracking-wider">REALTIME TRACK WEATHER</h4>
                    <span className="text-[9px] text-muted-foreground font-mono">{new Date(main.utc).toISOString().split("T")[0]}</span>
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
                <div className="rounded-xl border border-border bg-secondary/10 p-3">
                  <h4 className="mb-2 text-xs font-bold text-foreground font-mono uppercase tracking-wider">CIRCUIT DETAILS</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-secondary/50 px-3 py-1.5">
                      <div className="text-[9px] text-muted-foreground uppercase font-semibold">LENGTH</div>
                      <div className="mt-0.5 text-xs font-extrabold font-mono">{event.circuitInfo.length}</div>
                    </div>
                    <div className="rounded-lg bg-secondary/50 px-3 py-1.5">
                      <div className="text-[9px] text-muted-foreground uppercase font-semibold">TOTAL LAPS</div>
                      <div className="mt-0.5 text-xs font-extrabold font-mono">{event.circuitInfo.laps} LAPS</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 去年冠军 */}
              {event.lastYearWinner && (
                <div className="rounded-xl border border-border bg-secondary/10 p-3">
                  <h4 className="mb-2 text-xs font-bold text-foreground font-mono uppercase tracking-wider">2025 CHAMPION</h4>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-border/20">
                    <span className="text-muted-foreground">车手 / Driver</span>
                    <span className="font-extrabold">{event.lastYearWinner.driver}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1 mt-0.5">
                    <span className="text-muted-foreground">车队 / Team</span>
                    <span className="font-extrabold">{event.lastYearWinner.constructor}</span>
                  </div>
                </div>
              )}

              {/* 去年最快圈速 */}
              {event.lastYearFastestLap && (
                <div className="rounded-xl border border-border bg-secondary/10 p-3">
                  <h4 className="mb-2 text-xs font-bold text-foreground font-mono uppercase tracking-wider">2025 FASTEST LAP</h4>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-border/20">
                    <span className="text-muted-foreground">车手 / Driver</span>
                    <span className="font-bold">{event.lastYearFastestLap.driver}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-border/20 mt-0.5">
                    <span className="text-muted-foreground">圈速 / Laptime</span>
                    <span className="font-extrabold font-mono text-primary">{event.lastYearFastestLap.time}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1 mt-0.5">
                    <span className="text-muted-foreground">圈数 / Lap</span>
                    <span className="font-bold">第 {event.lastYearFastestLap.lap} 圈</span>
                  </div>
                </div>
              )}

              {/* WRC 额外信息 */}
              {event.extraInfo && event.extraInfo.length > 0 && (
                <div className="rounded-xl border border-border bg-secondary/10 p-3">
                  <h4 className="mb-2 text-xs font-bold text-foreground font-mono uppercase tracking-wider">EXTRA RALLY INFO</h4>
                  <div className="grid gap-2">
                    {event.extraInfo.map((info, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-1.5 text-xs">
                        <span className="text-muted-foreground">{info.label}</span>
                        <span className="font-bold">{info.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 弹窗底部操作区 */}
            <div className="mt-4 pt-3 border-t border-border/40 flex flex-wrap gap-2 justify-between items-center">
              <div className="flex gap-2">
                {event.circuitWikipediaUrl && (
                  <a
                    href={event.circuitWikipediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase text-primary transition-all hover:bg-secondary/80"
                  >
                    <LinkIcon className="size-3" />
                    Track Wiki
                  </a>
                )}
                {event.url && (
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase text-primary transition-all hover:bg-secondary/80"
                  >
                    <LinkIcon className="size-3" />
                    Official Website
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="rounded bg-primary text-primary-foreground px-4 py-1 text-[11px] font-bold uppercase transition-all active:scale-95 shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
          {/* 点击背景关闭 */}
          <div className="absolute inset-0 -z-10" onClick={() => setIsDetailOpen(false)} />
        </div>
      )}
    </article>
  )
}
