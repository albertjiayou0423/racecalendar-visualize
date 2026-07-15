"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { BEIJING_TZ, SERIES_META, mainSession } from "@/lib/format"
import { countryCodeToFlag } from "@/lib/tz"
import { cn } from "@/lib/utils"

const WEEKDAY_HEADERS = ["一", "二", "三", "四", "五", "六", "日"]

/** 取某 UTC 时间在北京时区的 YYYY-MM-DD 与日序号 */
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

/** 取年月日的数字 */
function ymdOfKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split("-").map(Number)
  return { y, m, d }
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
    const { y, m } = ymdOfKey(key)
    return new Date(Date.UTC(y, m - 1, 1))
  }, [events, now])

  const [cursor, setCursor] = useState(() => ({
    y: firstEventMonth.getUTCFullYear(),
    m: firstEventMonth.getUTCMonth() + 1,
  }))

  // 把赛事按北京日期分桶
  const byDay = useMemo(() => {
    const map = new Map<string, RaceEvent[]>()
    for (const e of events) {
      const main = mainSession(e)
      if (!main) continue
      const key = dayKeyInBeijing(main.utc)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
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

  // 该月是否有赛事
  const monthEventCount = useMemo(() => {
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
          {monthEventCount > 0 ? (
            <span>· {monthEventCount} 场赛事</span>
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
          const dayEvents = byDay.get(cell.key) ?? []
          const past = dayEvents.every((e) => new Date(mainSession(e)!.utc).getTime() < now)
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
                {dayEvents.slice(0, 3).map((e) => {
                  const meta = SERIES_META[e.series]
                  const main = mainSession(e)!
                  const time = new Intl.DateTimeFormat("en-GB", {
                    timeZone: BEIJING_TZ,
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                  }).format(new Date(main.utc))
                  const flag = countryCodeToFlag(e.countryCode)
                  return (
                    <div
                      key={e.id}
                      className={cn(
                        "flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight",
                        past && "opacity-50",
                      )}
                      style={{
                        backgroundColor: `${meta.color}22`,
                      }}
                      title={`${e.name} · ${time} 北京时间`}
                    >
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: meta.color }}
                        aria-hidden
                      />
                      <span className="truncate font-medium" style={{ color: meta.color }}>
                        {flag ? `${flag} ` : ""}
                        {meta.label}
                      </span>
                      <span className="ml-auto font-mono tabular-nums text-muted-foreground">
                        {time}
                      </span>
                    </div>
                  )
                })}
                {dayEvents.length > 3 ? (
                  <div className="px-1 text-[10px] text-muted-foreground">
                    +{dayEvents.length - 3} 场
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
      </div>
    </section>
  )
}
