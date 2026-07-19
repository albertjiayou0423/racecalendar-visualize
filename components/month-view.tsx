"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, X, CalendarDays, Flag, Clock } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { BEIJING_TZ, SERIES_META, firstSession, formatTime } from "@/lib/format"
import { countryCodeToFlag } from "@/lib/tz"
import { cn } from "@/lib/utils"
import { EventCard } from "./event-card"

const WEEKDAY_HEADERS = ["一", "二", "三", "四", "五", "六", "日"]

/** 取某 UTC 时间在北京时区的 YYYY-MM-DD */
function dayKeyInBeijing(utc: string): string {
  const d = new Date(utc)
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BEIJING_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return fmt.format(d) // YYYY-MM-DD
}

interface MonthViewProps {
  events: RaceEvent[]
  now: number
}

export function MonthView({ events, now }: MonthViewProps) {
  // 默认定位到最近一场赛事所在月份，否则当前月
  const firstEventMonth = useMemo(() => {
    const upcoming = events
      .filter((e) => {
        const first = firstSession(e)
        return first && new Date(first.utc).getTime() >= now
      })
      .sort((a, b) => (firstSession(a)?.utc ?? "").localeCompare(firstSession(b)?.utc ?? ""))
    const target = firstSession(upcoming[0] ?? events[0])?.utc
    if (!target) return new Date()
    const key = dayKeyInBeijing(target)
    const [y, m] = key.split("-").map(Number)
    return new Date(Date.UTC(y, m - 1, 1))
  }, [events, now])

  const [cursor, setCursor] = useState(() => ({
    y: firstEventMonth.getUTCFullYear(),
    m: firstEventMonth.getUTCMonth() + 1,
  }))

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

  // 生成月历格子：从本月1号所在的周一开始
  const cells = useMemo(() => {
    const { y, m } = cursor
    const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
    const leadDays = (firstDow + 6) % 7 // 周一为0
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const totalCells = Math.ceil((leadDays + daysInMonth) / 7) * 7

    const todayKey = dayKeyInBeijing(new Date(now).toISOString())

    const arr: { key: string | null; day: number | null; isToday: boolean }[] = []
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - leadDays + 1
      if (dayNum < 1 || dayNum > daysInMonth) {
        arr.push({ key: null, day: null, isToday: false })
      } else {
        const key = `${y}-${String(m).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
        arr.push({ key, day: dayNum, isToday: key === todayKey })
      }
    }
    return arr
  }, [cursor, now])

  const monthLabel = `${cursor.y} 年 ${cursor.m} 月`

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(Date.UTC(c.y, c.m - 1 + delta, 1))
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }
    })
  }

  const monthEventDays = useMemo(() => {
    const prefix = `${cursor.y}-${String(cursor.m).padStart(2, "0")}`
    let n = 0
    for (const key of byDay.keys()) {
      if (key.startsWith(prefix)) n += byDay.get(key)!.length
    }
    return n
  }, [byDay, cursor])

  return (
    <section className="flex flex-col gap-3" aria-label="月视图">
      {/* 月份切换 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{monthLabel}</span>
          {monthEventDays > 0 ? (
            <span className="bg-secondary/50 px-2 py-0.5 rounded-full text-xs text-muted-foreground font-medium">
              本月共 {monthEventDays} 场次
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-md border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="上一月"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date()
              setCursor({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 })
            }}
            className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            今天
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-md border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="下一月"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* 星期表头 */}
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
        {WEEKDAY_HEADERS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      {/* 日历格子 */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell.key) {
            return <div key={i} className="min-h-24 rounded-lg border border-border/40 bg-card/10" />
          }
          const dayItems = byDay.get(cell.key) ?? []
          const past = dayItems.every(({ event }) => {
            const f = firstSession(event)
            return f && new Date(f.utc).getTime() < now
          })

          // 计算昨天的 YYYY-MM-DD
          let yesterdayKey = ""
          if (cell.key) {
            const [cy, cm, cd] = cell.key.split("-").map(Number)
            const yesterdayDate = new Date(Date.UTC(cy, cm - 1, cd - 1))
            yesterdayKey = `${yesterdayDate.getUTCFullYear()}-${String(yesterdayDate.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterdayDate.getUTCDate()).padStart(2, "0")}`
          }

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => setSelectedDay(cell.key)}
              className={cn(
                "min-h-24 w-full rounded-lg border bg-card p-1.5 text-left transition-all relative flex flex-col justify-between hover:scale-[1.01] hover:shadow-sm",
                cell.isToday
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border hover:border-primary/40",
                selectedDay === cell.key && "ring-2 ring-primary bg-primary/5",
              )}
            >
              <div
                className={cn(
                  "text-xs font-bold tabular-nums",
                  cell.isToday ? "text-primary bg-primary/10 px-1 rounded" : "text-muted-foreground",
                )}
              >
                {cell.day}
              </div>
              <div className="mt-1.5 flex flex-col gap-1 w-full flex-1 justify-end">
                {dayItems.slice(0, 3).map(({ event: e, firstUtc }, idx) => {
                  const meta = SERIES_META[e.series]
                  const time = new Intl.DateTimeFormat("en-GB", {
                    timeZone: BEIJING_TZ,
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                  }).format(new Date(firstUtc))

                  const flag = countryCodeToFlag(e.countryCode)

                  // 甘特图连线判断 (Continuation matching across consecutive days):
                  // 1. 如果当天不是该赛事的第一天（即昨天的数据里也包含此赛事的 id），则标记为"跨天连线"
                  const hasContinuation = yesterdayKey ? byDay.get(yesterdayKey)?.some(({ event: prevE }) => prevEventIdMatch(prevE.id, e.id)) : false

                  return (
                    <div
                      key={`${e.id}-${idx}`}
                      className={cn(
                        "flex items-center gap-1 px-1 py-0.5 text-[9px] leading-none select-none font-medium",
                        hasContinuation ? "rounded-r border-l-0" : "rounded",
                        past && "opacity-45",
                      )}
                      style={{
                        backgroundColor: `${meta.color}15`,
                        borderLeft: hasContinuation ? "none" : `2px solid ${meta.color}`,
                        color: meta.color,
                      }}
                      title={`${e.name}${hasContinuation ? "（续）" : ""} · ${time} 北京`}
                    >
                      <span className="truncate font-semibold flex items-center gap-0.5">
                        {hasContinuation ? (
                          <span className="opacity-80">续 · {meta.label}</span>
                        ) : (
                          <>
                            {flag ? <span>{flag}</span> : null}
                            <span>{meta.label}</span>
                          </>
                        )}
                      </span>
                      <span className="ml-auto font-mono tabular-nums opacity-80 text-[8px]">
                        {time}
                      </span>
                    </div>
                  )
                })}
                {dayItems.length > 3 ? (
                  <div className="px-1 text-[9px] font-semibold text-muted-foreground">
                    + {dayItems.length - 3} 场
                  </div>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>

      {/* 图例 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground bg-secondary/15 px-3 py-2 rounded-lg">
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
        <span className="text-[10px] text-muted-foreground/60 border-l border-border pl-3">
          续 = 该赛事跨越数日的赛段
        </span>
      </div>

      {/* 选中日期展开面板：升级为华丽的、无 Layout Shift 的半透明高斯模糊 Drawer/Modal 遮罩 */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div
            className="bg-card border border-border/80 w-full max-w-lg rounded-2xl p-5 shadow-2xl relative flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CalendarDays className="size-4 text-primary" />
                <span className="text-foreground">{selectedDay}</span>
                <span className="text-muted-foreground font-normal">
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
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
                aria-label="关闭"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Event List Container (Scrollable) */}
            <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
              {(byDay.get(selectedDay) ?? []).map(({ event }) => (
                <div key={event.id} className="relative group">
                  <EventCard event={event} now={now} />
                </div>
              ))}
              {(byDay.get(selectedDay) ?? []).length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
                  <Flag className="size-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">当天暂无赛事安排</p>
                </div>
              )}
            </div>

            {/* Footer summary */}
            <div className="mt-4 pt-3 border-t border-border/40 flex justify-between items-center text-[10px] text-muted-foreground">
              <span>共计 {(byDay.get(selectedDay) ?? []).length} 场赛事</span>
              <span>点击空白处或右上角可关闭</span>
            </div>
          </div>
          {/* 点击背景关闭 */}
          <div className="absolute inset-0 -z-10" onClick={() => setSelectedDay(null)} />
        </div>
      )}
    </section>
  )
}

function prevEventIdMatch(a: string, b: string): boolean {
  return a === b
}
