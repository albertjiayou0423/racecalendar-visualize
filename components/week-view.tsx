"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, X, CalendarDays, Clock } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { BEIJING_TZ, SERIES_META, firstSession, formatTime, formatDateTime } from "@/lib/format"
import { countryCodeToFlag } from "@/lib/tz"
import { cn } from "@/lib/utils"
import { EventCard } from "./event-card"

const WEEKDAY_HEADERS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]

/** 取某 UTC 时间在北京时区的 YYYY-MM-DD */
function dayKeyInBeijing(utc: string): string {
  const d = new Date(utc)
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BEIJING_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return fmt.format(d)
}

/** 取某赛事在北京时区覆盖的所有日期（去重） */
function eventDayKeys(e: RaceEvent): string[] {
  const set = new Set<string>()
  for (const s of e.sessions) {
    set.add(dayKeyInBeijing(s.utc))
  }
  return [...set]
}

/** 获取某周的日期范围 */
function getWeekDates(cursor: { y: number; w: number }): string[] {
  const { y, w } = cursor
  const jan1 = new Date(Date.UTC(y, 0, 1))
  const dayOfWeek = jan1.getUTCDay()
  const firstMonday = new Date(jan1)
  firstMonday.setUTCDate(jan1.getUTCDate() + ((8 - dayOfWeek) % 7 || 7))
  const weekStart = new Date(firstMonday)
  weekStart.setUTCDate(firstMonday.getUTCDate() + (w - 1) * 7)
  
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setUTCDate(weekStart.getUTCDate() + i)
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: BEIJING_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    dates.push(fmt.format(d))
  }
  return dates
}

interface WeekViewProps {
  events: RaceEvent[]
  now: number
}

export function WeekView({ events, now }: WeekViewProps) {
  // 默认定位到当前周
  const currentWeek = useMemo(() => {
    const d = new Date(now)
    const start = new Date(d)
    const day = start.getUTCDay()
    start.setUTCDate(start.getUTCDate() - ((day + 6) % 7))
    const y = start.getUTCFullYear()
    const jan1 = new Date(Date.UTC(y, 0, 1))
    const jan1Day = jan1.getUTCDay()
    const firstMonday = new Date(jan1)
    firstMonday.setUTCDate(jan1.getUTCDate() + ((8 - jan1Day) % 7 || 7))
    const ms = start.getTime() - firstMonday.getTime()
    const w = Math.floor(ms / (7 * 24 * 60 * 60 * 1000)) + 1
    return { y, w }
  }, [now])

  const [cursor, setCursor] = useState(() => currentWeek)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // 把赛事按北京日期分桶
  const byDay = useMemo(() => {
    const map = new Map<string, { event: RaceEvent; firstUtc: string }[]>()
    for (const e of events) {
      const dayFirst = new Map<string, string>()
      for (const s of e.sessions) {
        const key = dayKeyInBeijing(s.utc)
        const prev = dayFirst.get(key)
        if (!prev || s.utc < prev) dayFirst.set(key, s.utc)
      }
      for (const [key, firstUtc] of dayFirst) {
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push({ event: e, firstUtc })
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.firstUtc.localeCompare(b.firstUtc))
    }
    return map
  }, [events])

  const weekDates = useMemo(() => getWeekDates(cursor), [cursor])
  const todayKey = dayKeyInBeijing(new Date(now).toISOString())

  const weekLabel = `${cursor.y} 年第 ${cursor.w} 周`

  function shiftWeek(delta: number) {
    setCursor((c) => {
      const d = new Date(Date.UTC(c.y, 0, 1))
      const jan1Day = d.getUTCDay()
      const firstMonday = new Date(d)
      firstMonday.setUTCDate(d.getUTCDate() + ((8 - jan1Day) % 7 || 7))
      const weekStart = new Date(firstMonday)
      weekStart.setUTCDate(firstMonday.getUTCDate() + (c.w - 1 + delta) * 7)
      const y = weekStart.getUTCFullYear()
      const jan1 = new Date(Date.UTC(y, 0, 1))
      const jan1D = jan1.getUTCDay()
      const fMon = new Date(jan1)
      fMon.setUTCDate(jan1.getUTCDate() + ((8 - jan1D) % 7 || 7))
      const ms = weekStart.getTime() - fMon.getTime()
      const w = Math.floor(ms / (7 * 24 * 60 * 60 * 1000)) + 1
      return { y, w: Math.max(1, w) }
    })
  }

  // 统计本周赛事数
  const weekEventCount = useMemo(() => {
    const set = new Set<string>()
    for (const key of weekDates) {
      const items = byDay.get(key) ?? []
      for (const { event } of items) set.add(event.id)
    }
    return set.size
  }, [weekDates, byDay])

  return (
    <section className="flex flex-col gap-3" aria-label="周视图">
      {/* 周切换 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{weekLabel}</span>
          {weekEventCount > 0 ? (
            <span>· {weekEventCount} 场赛事</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            className="rounded-md border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="上一周"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursor(currentWeek)}
            className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            本周
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            className="rounded-md border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="下一周"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* 周视图主体 */}
      <div className="grid grid-cols-7 gap-1">
        {weekDates.map((key, i) => {
          const dayItems = byDay.get(key) ?? []
          const [y, m, d] = key.split("-").map(Number)
          const date = new Date(Date.UTC(y, m - 1, d))
          const isToday = key === todayKey
          const selected = selectedDay === key

          return (
            <div
              key={key}
              className={cn(
                "min-h-[140px] rounded-lg border bg-card p-2 transition-all",
                isToday ? "border-primary ring-1 ring-primary/30" : "border-border",
                selected && "ring-2 ring-primary"
              )}
            >
              {/* 日期标题 */}
              <button
                type="button"
                onClick={() => setSelectedDay(selected ? null : key)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{WEEKDAY_HEADERS[i]}</span>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      isToday ? "text-primary" : "text-foreground"
                    )}
                  >
                    {d}
                  </span>
                </div>
              </button>

              {/* 当日赛事 */}
              <div className="mt-2 flex flex-col gap-1">
                {dayItems.slice(0, 4).map(({ event: e, firstUtc }, idx) => {
                  const meta = SERIES_META[e.series]
                  const time = new Intl.DateTimeFormat("en-GB", {
                    timeZone: BEIJING_TZ,
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                  }).format(new Date(firstUtc))
                  const flag = countryCodeToFlag(e.countryCode)
                  
                  return (
                    <button
                      key={`${e.id}-${idx}`}
                      type="button"
                      onClick={() => setSelectedDay(key)}
                      className={cn(
                        "flex items-center gap-1 rounded px-1.5 py-1 text-[10px] leading-tight text-left w-full transition-colors hover:bg-secondary/80"
                      )}
                      style={{
                        backgroundColor: `${meta.color}15`,
                      }}
                      title={`${e.name} · ${time} 北京时间`}
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: meta.color }}
                        aria-hidden
                      />
                      <span className="truncate font-medium flex-1" style={{ color: meta.color }}>
                        {meta.label}
                      </span>
                      <span className="font-mono tabular-nums text-muted-foreground shrink-0">
                        {time}
                      </span>
                    </button>
                  )
                })}
                {dayItems.length > 4 ? (
                  <span className="px-1.5 text-[10px] text-muted-foreground">
                    +{dayItems.length - 4}
                  </span>
                ) : null}
                {dayItems.length === 0 ? (
                  <span className="px-1.5 text-[10px] text-muted-foreground/50">-</span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {/* 图例 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {(["F1", "WRC", "FE"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: SERIES_META[s].color }}
              aria-hidden
            />
            {SERIES_META[s].label}
          </span>
        ))}
      </div>

      {/* 选中日期展开面板 */}
      {selectedDay ? (
        <div className="rounded-xl border border-primary/30 bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="size-4 text-muted-foreground" />
              <span className="font-medium">{selectedDay}</span>
              <span className="text-muted-foreground">
                {(() => {
                  const [y, m, d] = selectedDay.split("-").map(Number)
                  const date = new Date(Date.UTC(y, m - 1, d))
                  return date.toLocaleDateString("zh-CN", { weekday: "long" })
                })()}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="关闭"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {(byDay.get(selectedDay) ?? []).map(({ event }) => (
              <EventCard key={event.id} event={event} now={now} />
            ))}
            {byDay.get(selectedDay)?.length === 0 ? (
              <p className="text-sm text-muted-foreground">当天暂无赛事</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}