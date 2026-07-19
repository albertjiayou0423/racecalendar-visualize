"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Trophy } from "lucide-react"
import type { RaceEvent, RaceSession } from "@/lib/types"
import { BEIJING_TZ, SERIES_META, firstSession, formatTime } from "@/lib/format"
import { countryCodeToFlag } from "@/lib/tz"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"]
const START_HOUR = 6 // 早上 6 点开始展示
const END_HOUR = 23   // 晚上 23 点结束展示
const HOUR_HEIGHT = 44 // 每小时高度 (px)

interface WeekViewProps {
  events: RaceEvent[]
  now: number
}

interface FlattenedSession {
  event: RaceEvent
  session: RaceSession
  utc: string
  beijingDate: string // YYYY-MM-DD
  startHour: number
  startMin: number
  durationMin: number // 估计时间长度
}

/** 取北京时区下的 YYYY-MM-DD */
function getBeijingDateString(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BEIJING_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return fmt.format(date)
}

export function WeekView({ events, now }: WeekViewProps) {
  // 1. 定位到当前或最近一场赛事所在的周
  const activeWeekStart = useMemo(() => {
    // 寻找下一个即将开始或进行中的赛事首个场次
    const upcoming = events
      .filter((e) => {
        const first = firstSession(e)
        return first && new Date(first.utc).getTime() >= now
      })
      .sort((a, b) => (firstSession(a)?.utc ?? "").localeCompare(firstSession(b)?.utc ?? ""))

    const targetUtc = firstSession(upcoming[0] ?? events[0])?.utc
    const baseDate = targetUtc ? new Date(targetUtc) : new Date(now)

    // 转换到北京时间，并定位到周一
    const bjFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: BEIJING_TZ,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    })
    const parts = bjFormatter.formatToParts(baseDate)
    const year = Number(parts.find(p => p.type === "year")?.value)
    const month = Number(parts.find(p => p.type === "month")?.value)
    const day = Number(parts.find(p => p.type === "day")?.value)

    const bjDate = new Date(Date.UTC(year, month - 1, day))
    const bjDow = bjDate.getUTCDay()
    const diffToMon = bjDow === 0 ? -6 : 1 - bjDow // 周一是1，周日是0

    return new Date(Date.UTC(year, month - 1, day + diffToMon))
  }, [events, now])

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(activeWeekStart)
  const containerRef = useRef<HTMLDivElement>(null)

  // 每次切换周重置当前周开始时间
  useEffect(() => {
    setCurrentWeekStart(activeWeekStart)
  }, [activeWeekStart])

  // 2. 生成当前周的 7 天日期列表（北京时间）
  const weekDays = useMemo(() => {
    return [...Array(7)].map((_, i) => {
      const d = new Date(currentWeekStart.getTime() + i * 24 * 60 * 60 * 1000)
      const dayStr = getBeijingDateString(d)
      return {
        date: d,
        dayStr,
        dayNum: d.getUTCDate(),
        monthNum: d.getUTCMonth() + 1,
        dow: (d.getUTCDay() + 6) % 7, // 0 = 周一, 6 = 周日
      }
    })
  }, [currentWeekStart])

  const weekLabel = useMemo(() => {
    const start = weekDays[0]
    const end = weekDays[6]
    return `${start.monthNum}月${start.dayNum}日 - ${end.monthNum}月${end.dayNum}日`
  }, [weekDays])

  // 3. 收集并扁平化当前周北京时间内的所有 Session
  const weekSessions = useMemo(() => {
    const list: FlattenedSession[] = []
    const dayStrings = new Set(weekDays.map(d => d.dayStr))

    events.forEach(event => {
      event.sessions.forEach(session => {
        const d = new Date(session.utc)
        // 北京时间转换
        const bjFmt = new Intl.DateTimeFormat("en-CA", {
          timeZone: BEIJING_TZ,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        })
        const match = bjFmt.format(d).match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})$/)
        if (!match) return

        const [, dateStr, hh, mm] = match
        if (dayStrings.has(dateStr)) {
          const hour = Number(hh)
          const min = Number(mm)

          // 根据赛车场次特性智能设定估计时间段长度 (Duration minutes)
          let duration = 60 // 默认一小时
          if (session.isMain) {
            duration = event.series === "F1" ? 120 : 90 // F1正赛2小时，其他1.5小时
          } else if (session.name.includes("Practice") || session.name.includes("练习")) {
            duration = 60
          } else if (session.name.includes("Qualifying") || session.name.includes("排位")) {
            duration = 60
          }

          list.push({
            event,
            session,
            utc: session.utc,
            beijingDate: dateStr,
            startHour: hour,
            startMin: min,
            durationMin: duration,
          })
        }
      })
    })

    return list
  }, [events, weekDays])

  const hoursArray = useMemo(() => {
    return [...Array(END_HOUR - START_HOUR + 1)].map((_, i) => START_HOUR + i)
  }, [])

  function shiftWeek(weeks: number) {
    setCurrentWeekStart(prev => new Date(prev.getTime() + weeks * 7 * 24 * 60 * 60 * 1000))
  }

  return (
    <div className="flex flex-col gap-3" aria-label="周视图">
      {/* 头部控制栏：单色精简极简主义 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4 text-primary" />
          <span className="font-extrabold text-foreground font-mono uppercase">{weekLabel}</span>
          {weekSessions.length > 0 && (
            <span className="bg-secondary/60 px-1.5 py-0.2 rounded text-[10px] font-bold font-mono text-muted-foreground">
              {weekSessions.length} SES
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            className="rounded-md border border-border bg-card p-1 text-muted-foreground transition-all active:scale-95"
            aria-label="上一周"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentWeekStart(activeWeekStart)}
            className="rounded-md border border-border bg-card px-2.5 py-1 text-[10px] font-bold font-mono text-muted-foreground uppercase transition-all"
          >
            CURR
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            className="rounded-md border border-border bg-card p-1 text-muted-foreground transition-all active:scale-95"
            aria-label="下一周"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {/* 苹果日历周历主体 (仿 Apple Calendar) */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
        {/* 周几标头行 */}
        <div className="grid grid-cols-[40px_1fr] border-b border-border/50 bg-secondary/15">
          <div className="border-r border-border/50" /> {/* 时间轴留空 */}
          <div className="grid grid-cols-7 text-center py-1.5 divide-x divide-border/20">
            {weekDays.map((day) => {
              const todayKey = getBeijingDateString(new Date(now))
              const isToday = day.dayStr === todayKey
              return (
                <div key={day.dayStr} className="flex flex-col items-center">
                  <span className="text-[10px] font-bold text-muted-foreground">{WEEKDAYS[day.dow]}</span>
                  <span className={cn(
                    "text-xs font-black font-mono mt-0.5 h-5 w-5 flex items-center justify-center rounded-full leading-none",
                    isToday ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground"
                  )}>
                    {day.dayNum}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 滚动日程区 */}
        <div
          ref={containerRef}
          className="relative grid grid-cols-[40px_1fr] overflow-y-auto"
          style={{ height: `${(END_HOUR - START_HOUR + 1) * HOUR_HEIGHT}px` }}
        >
          {/* 左侧 24 小时时间轴 */}
          <div className="border-r border-border/50 bg-secondary/5 flex flex-col relative" style={{ height: `${hoursArray.length * HOUR_HEIGHT}px` }}>
            {hoursArray.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 text-[8px] font-bold font-mono text-muted-foreground/60 text-right pr-1.5"
                style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px`, transform: "translateY(-50%)" }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* 右侧 7 天日历槽与网格背景 */}
          <div className="relative grid grid-cols-7 divide-x divide-border/30 h-full">
            {/* 绘制横向网线 */}
            {hoursArray.map((hour) => (
              <div
                key={`line-${hour}`}
                className="absolute left-0 right-0 border-b border-border/10"
                style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px`, height: "0px" }}
              />
            ))}

            {/* 渲染每一个北京时间当天的 Column */}
            {weekDays.map((day, colIdx) => {
              // 筛选属于这一天的 Sessions
              const daySessions = weekSessions.filter(s => s.beijingDate === day.dayStr)

              return (
                <div key={day.dayStr} className="relative h-full select-none group">
                  {daySessions.map((item, idx) => {
                    const meta = SERIES_META[item.event.series]
                    const flag = countryCodeToFlag(item.event.countryCode)

                    // 计算绝对定位
                    const startVal = item.startHour + item.startMin / 60
                    const endVal = startVal + item.durationMin / 60

                    // 裁剪超出显示视口的场次
                    const renderStart = Math.max(START_HOUR, startVal)
                    const renderEnd = Math.min(END_HOUR + 1, endVal)
                    if (renderEnd <= renderStart) return null

                    const top = (renderStart - START_HOUR) * HOUR_HEIGHT
                    const height = (renderEnd - renderStart) * HOUR_HEIGHT

                    return (
                      <div
                        key={`${item.event.id}-${item.session.name}-${idx}`}
                        className={cn(
                          "absolute left-0.5 right-0.5 rounded p-1 border-l-2 text-[8px] flex flex-col justify-between overflow-hidden cursor-default transition-all shadow-sm hover:scale-[1.01] hover:shadow-md",
                          item.session.isMain && "ring-1 ring-primary/25"
                        )}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          borderColor: meta.color,
                          backgroundColor: `${meta.color}18`,
                          color: meta.color,
                        }}
                        title={`${item.event.name} - ${item.session.name}\n时间: ${formatTime(item.utc, BEIJING_TZ)} 北京时间`}
                      >
                        {/* 紧凑单色卡片内容 */}
                        <div className="min-w-0 font-sans leading-tight">
                          <div className="flex items-center gap-0.5 font-mono text-[7px] font-extrabold uppercase opacity-85">
                            <span>{flag}</span>
                            <span>{meta.label}</span>
                            {item.session.isMain && <Trophy className="size-2 text-primary" />}
                          </div>
                          <div className="font-bold text-[9px] text-foreground/90 truncate mt-0.5 leading-none">
                            {item.session.name}
                          </div>
                        </div>

                        {/* 时间刻度标签 */}
                        <div className="font-mono text-[7px] text-muted-foreground/80 text-right font-semibold leading-none self-end">
                          {String(item.startHour).padStart(2, "0")}:{String(item.startMin).padStart(2, "0")}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
