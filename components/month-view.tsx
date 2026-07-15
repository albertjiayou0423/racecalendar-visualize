"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { BEIJING_TZ, SERIES_META, mainSession } from "@/lib/format"
import { countryCodeToFlag } from "@/lib/tz"
import { cn } from "@/lib/utils"

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

/** 取某赛事在北京时区覆盖的所有日期（去重） */
function eventDayKeys(e: RaceEvent): string[] {
  const set = new Set<string>()
  for (const s of e.sessions) {
    set.add(dayKeyInBeijing(s.utc))
  }
  return [...set]
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
        const main = mainSession(e)
        return main && new Date(main.utc).getTime() >= now
      })
      .sort((a, b) => (mainSession(a)?.utc ?? "").localeCompare(mainSession(b)?.utc ?? ""))
    const target = mainSession(upcoming[0] ?? events[0])?.utc
    if (!target) return new Date()
    const key = dayKeyInBeijing(target)
    const [y, m] = key.split("-").map(Number)
    return new Date(Date.UTC(y, m - 1, 1))
  }, [events, now])

  const [cursor, setCursor] = useState(() => ({
    y: firstEventMonth.getUTCFullYear(),
    m: firstEventMonth.getUTCMonth() + 1,
  }))

  // 把赛事按北京日期分桶（同一场赛事在每个覆盖日期都出现一次）
  // 每个分桶条目带上当天该赛事的首个场次 UTC，用于显示当日开始时间
  const byDay = useMemo(() => {
    const map = new Map<string, { event: RaceEvent; firstUtc: string }[]>()
    for (const e of events) {
      // 计算该赛事每个北京日期的首个场次
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
    // 每天内部按当天首个场次时间排序
    for (const list of map.values()) {
      list.sort((a, b) => a.firstUtc.localeCompare(b.firstUtc))
    }
    return map
  }, [events])

  // 生成月历格子：从本月1号所在的周一开始
  const cells = useMemo(() => {
    const { y, m } = cursor
    // 1号是周几（0=周日 → 转成周一为起点的偏移）
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

  // 该月有赛事的天数（去重赛事数）
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
            <span>· {monthEventDays} 场次</span>
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
            className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
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
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
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
            return <div key={i} className="min-h-20 rounded-lg border border-border/40 bg-card/30" />
          }
          const dayItems = byDay.get(cell.key) ?? []
          const past = dayItems.every(({ event }) => {
            const m = mainSession(event)
            return m && new Date(m.utc).getTime() < now
          })
          return (
            <div
              key={cell.key}
              className={cn(
                "min-h-20 rounded-lg border bg-card p-1.5 transition-colors",
                cell.isToday
                  ? "border-primary"
                  : "border-border hover:border-primary/40",
              )}
            >
              <div
                className={cn(
                  "text-xs font-medium tabular-nums",
                  cell.isToday ? "text-primary" : "text-muted-foreground",
                )}
              >
                {cell.day}
              </div>
              <div className="mt-1 flex flex-col gap-0.5">
                {dayItems.slice(0, 3).map(({ event: e, firstUtc }, idx) => {
                  const meta = SERIES_META[e.series]
                  const time = new Intl.DateTimeFormat("en-GB", {
                    timeZone: BEIJING_TZ,
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                  }).format(new Date(firstUtc))
                  const flag = countryCodeToFlag(e.countryCode)
                  // 同一天如果同一赛事已出现过（同一 event id），标记为"续"
                  const prevSameEvent = idx > 0 && dayItems[idx - 1].event.id === e.id
                  return (
                    <div
                      key={`${e.id}-${idx}`}
                      className={cn(
                        "flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight",
                        past && "opacity-50",
                      )}
                      style={{
                        backgroundColor: `${meta.color}22`,
                      }}
                      title={`${e.name}${prevSameEvent ? "（续）" : ""} · ${time} 北京时间`}
                    >
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: meta.color }}
                        aria-hidden
                      />
                      <span className="truncate font-medium" style={{ color: meta.color }}>
                        {prevSameEvent ? "续" : `${flag ? `${flag} ` : ""}${meta.label}`}
                      </span>
                      <span className="ml-auto font-mono tabular-nums text-muted-foreground">
                        {time}
                      </span>
                    </div>
                  )
                })}
                {dayItems.length > 3 ? (
                  <div className="px-1 text-[10px] text-muted-foreground">
                    +{dayItems.length - 3} 场
                  </div>
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
              className="size-1.5 rounded-full"
              style={{ backgroundColor: SERIES_META[s].color }}
              aria-hidden
            />
            {SERIES_META[s].label}
          </span>
        ))}
        <span className="text-muted-foreground/70">续 = 该赛事跨日场次</span>
      </div>
    </section>
  )
}
